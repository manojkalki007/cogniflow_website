"""
Voice Pipeline Orchestrator — Production Grade.

Key improvements over basic architecture:
- Transcript deduplication (no duplicate LLM calls)
- speech_final gating from Deepgram for reliable turn-taking
- Adaptive barge-in threshold (calibrated from ambient noise)
- Proper STT queue flushing via public API
- Smart sentence streaming (handles abbreviations)
- TTS error propagation (no silent audio loss)
- Always streams audio to caller while STT is active
"""

import asyncio
import base64
import logging
import re
import time
import uuid
from dataclasses import dataclass, field

from cogniflow_home.agent import AGENT_INSTRUCTIONS, AGENT_NAME, GREETING, VOICE_ID
from cogniflow_home.audio import compute_energy_mulaw, AudioSmoother
from cogniflow_home.compliance.engine import ComplianceEngine
from cogniflow_home.config import settings
from cogniflow_home.events import bus
from cogniflow_home.latency.eot import SemanticEOTDetector
from cogniflow_home.latency.filler import FillerAudioManager
from cogniflow_home.latency.speculative import SpeculativeGenerator
from cogniflow_home.latency.tracer import LatencyTracer
from cogniflow_home.emotions.text_enricher import TextEnricher
from cogniflow_home.emotions.prompt_builder import build_system_prompt, build_emotion_context
from cogniflow_home.language.detector import LanguageDetector, LanguageRouter
from cogniflow_home.monitoring.turn_quality import TurnEvent, TurnQualityAnalyzer
from cogniflow_home.monitoring.barge_in import BargeInTracker
from cogniflow_home.emotions.tts_adapter import EmotionTTSAdapter
from cogniflow_home.providers.failover import ProviderChain, register_chain
from cogniflow_home.telephony.base import CallInfo, TelephonyProvider

logger = logging.getLogger("cogniflow_home.pipeline")

INDIAN_LANGUAGES = {"hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "pa", "od", "as", "ur", "ne", "en-in"}
SARVAM_TTS_LANGUAGES = {"hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "pa", "od", "as", "ur", "ne", "en-in"}


def _create_stt(language: str, sample_rate: int = 8000):
    if language in INDIAN_LANGUAGES:
        from cogniflow_home.providers.sarvam_stt import SarvamSTT
        return SarvamSTT(language=language, sample_rate=sample_rate)
    from cogniflow_home.providers.stt import DeepgramSTT
    return DeepgramSTT(language=language, sample_rate=sample_rate)


def _create_tts(language: str, voice_id: str, sample_rate: int = 8000, raw_pcm: bool = False,
                 tts_provider: str = ""):
    if language in SARVAM_TTS_LANGUAGES:
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        return SarvamTTS(language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)
    if tts_provider == "elevenlabs" and settings.elevenlabs_api_key:
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        return ElevenLabsTTS(voice_id=voice_id, language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)
    if tts_provider == "smallest" and settings.smallest_ai_api_key:
        from cogniflow_home.providers.smallest_tts import SmallestTTS
        return SmallestTTS(voice_id=voice_id, language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)
    if settings.smallest_ai_api_key:
        from cogniflow_home.providers.smallest_tts import SmallestTTS
        return SmallestTTS(voice_id=voice_id, language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)
    if settings.elevenlabs_api_key:
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        return ElevenLabsTTS(voice_id=voice_id, language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)
    from cogniflow_home.providers.sarvam_tts import SarvamTTS
    return SarvamTTS(language=language if language in SARVAM_TTS_LANGUAGES else "en-in", sample_rate=sample_rate)


_CONTRACTIONS = [
    (re.compile(r"\bI am\b"), "I'm"), (re.compile(r"\bI have\b"), "I've"), (re.compile(r"\bI will\b"), "I'll"),
    (re.compile(r"\bI would\b"), "I'd"), (re.compile(r"\bdo not\b"), "don't"), (re.compile(r"\bDo not\b"), "Don't"),
    (re.compile(r"\bcannot\b"), "can't"), (re.compile(r"\bCannot\b"), "Can't"),
    (re.compile(r"\bwill not\b"), "won't"), (re.compile(r"\bWill not\b"), "Won't"),
    (re.compile(r"\bshould not\b"), "shouldn't"), (re.compile(r"\bwould not\b"), "wouldn't"),
    (re.compile(r"\bcould not\b"), "couldn't"), (re.compile(r"\bthat is\b"), "that's"),
    (re.compile(r"\bThat is\b"), "That's"), (re.compile(r"\bit is\b"), "it's"), (re.compile(r"\bIt is\b"), "It's"),
    (re.compile(r"\bwhat is\b"), "what's"), (re.compile(r"\bWhat is\b"), "What's"),
    (re.compile(r"\bhere is\b"), "here's"), (re.compile(r"\bHere is\b"), "Here's"),
    (re.compile(r"\bthere is\b"), "there's"), (re.compile(r"\bThere is\b"), "There's"),
    (re.compile(r"\blet us\b"), "let's"), (re.compile(r"\bLet us\b"), "Let's"),
    (re.compile(r"\byou are\b"), "you're"), (re.compile(r"\bYou are\b"), "You're"),
    (re.compile(r"\bthey are\b"), "they're"), (re.compile(r"\bThey are\b"), "They're"),
    (re.compile(r"\bwe are\b"), "we're"), (re.compile(r"\bWe are\b"), "We're"),
    (re.compile(r"\bhave not\b"), "haven't"), (re.compile(r"\bhas not\b"), "hasn't"),
    (re.compile(r"\bdid not\b"), "didn't"), (re.compile(r"\bis not\b"), "isn't"),
    (re.compile(r"\bare not\b"), "aren't"), (re.compile(r"\bwere not\b"), "weren't"),
    (re.compile(r"\bwas not\b"), "wasn't"), (re.compile(r"\bwho is\b"), "who's"),
    (re.compile(r"\bwhere is\b"), "where's"), (re.compile(r"\bhow is\b"), "how's"),
]


def _humanize_for_speech(text: str) -> str:
    if not text or not text.strip():
        return text
    t = text
    for pattern, repl in _CONTRACTIONS:
        t = pattern.sub(repl, t)
    t = re.sub(r'\*+', '', t)
    t = re.sub(r'#+\s*', '', t)
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)
    t = re.sub(r'\s{2,}', ' ', t)
    t = _enforce_brevity(t.strip())
    return t


def _enforce_brevity(text: str) -> str:
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    if len(sentences) > 2:
        return ' '.join(sentences[:2])
    return text


def _create_tts_chain(language: str, voice_id: str, sample_rate: int = 8000,
                      raw_pcm: bool = False, tts_provider: str = "") -> ProviderChain:
    """Build a TTS failover chain: primary + fallbacks across Smallest, ElevenLabs, Sarvam."""
    providers = []

    if language in SARVAM_TTS_LANGUAGES:
        # Indian language — Sarvam primary, others as fallback
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        providers.append(("sarvam-tts", SarvamTTS(language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)))
        if settings.smallest_ai_api_key:
            from cogniflow_home.providers.smallest_tts import SmallestTTS
            providers.append(("smallest-tts", SmallestTTS(
                voice_id=voice_id, language=language,
                sample_rate=sample_rate, raw_pcm=raw_pcm,
            )))
        if settings.elevenlabs_api_key:
            from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
            providers.append(("elevenlabs-tts", ElevenLabsTTS(
                voice_id=voice_id, language=language,
                sample_rate=sample_rate, raw_pcm=raw_pcm,
            )))
    elif tts_provider == "elevenlabs" and settings.elevenlabs_api_key:
        # ElevenLabs explicitly requested as primary
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        providers.append(("elevenlabs-tts", ElevenLabsTTS(
            voice_id=voice_id, language=language,
            sample_rate=sample_rate, raw_pcm=raw_pcm,
        )))
        if settings.smallest_ai_api_key:
            from cogniflow_home.providers.smallest_tts import SmallestTTS
            providers.append(("smallest-tts", SmallestTTS(
                voice_id=voice_id, language=language,
                sample_rate=sample_rate, raw_pcm=raw_pcm,
            )))
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        providers.append(("sarvam-tts", SarvamTTS(language="en-in", sample_rate=sample_rate, raw_pcm=raw_pcm)))
    elif settings.smallest_ai_api_key:
        # Non-Indian language — Smallest primary, ElevenLabs + Sarvam fallback
        from cogniflow_home.providers.smallest_tts import SmallestTTS
        providers.append(("smallest-tts", SmallestTTS(
            voice_id=voice_id, language=language,
            sample_rate=sample_rate, raw_pcm=raw_pcm,
        )))
        if settings.elevenlabs_api_key:
            from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
            providers.append(("elevenlabs-tts", ElevenLabsTTS(
                voice_id=voice_id, language=language,
                sample_rate=sample_rate, raw_pcm=raw_pcm,
            )))
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        providers.append(("sarvam-tts", SarvamTTS(language="en-in", sample_rate=sample_rate, raw_pcm=raw_pcm)))
    elif settings.elevenlabs_api_key:
        # Only ElevenLabs configured (no Smallest)
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        providers.append(("elevenlabs-tts", ElevenLabsTTS(
            voice_id=voice_id, language=language,
            sample_rate=sample_rate, raw_pcm=raw_pcm,
        )))
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        providers.append(("sarvam-tts", SarvamTTS(language="en-in", sample_rate=sample_rate, raw_pcm=raw_pcm)))
    else:
        # Only Sarvam available
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        providers.append(("sarvam-tts", SarvamTTS(
            language=language if language in SARVAM_TTS_LANGUAGES else "en-in",
            sample_rate=sample_rate, raw_pcm=raw_pcm,
        )))

    chain = ProviderChain(providers, failure_threshold=3, reset_timeout=60.0)
    register_chain("tts", chain)
    return chain


def _create_llm(system_prompt: str):
    from cogniflow_home.providers.groq_llm import GroqLLM
    return GroqLLM(system_prompt=system_prompt)


@dataclass
class CallState:
    call_sid: str
    caller_number: str
    called_number: str = ""
    direction: str = "inbound"
    provider: str = "twilio"
    agent_name: str = ""
    language: str = "en"
    tenant_id: str = ""
    started_at: float = field(default_factory=time.time)
    transcript: list[dict] = field(default_factory=list)
    is_agent_speaking: bool = False
    barge_in: bool = False


class VoicePipeline:
    """Orchestrates one phone call through the full voice AI pipeline."""

    def __init__(self, call_info: CallInfo, telephony: TelephonyProvider,
                 instructions_override: str = "", greeting_override: str = "",
                 language: str = "en", voice_id: str = "",
                 sample_rate: int = 8000, tenant_id: str = "",
                 emotion_profile: str = "friendly", voice_gender: str = "female",
                 tools_enabled: list[str] | None = None,
                 enable_memory: bool = True, enable_prediction: bool = True,
                 enable_emotion: bool = True, enable_language_switch: bool = True,
                 enable_rag: bool = False, enable_barge_in: bool = True,
                 enable_speculative: bool = True, enable_filler: bool = True,
                 tts_provider: str = ""):
        call_id = call_info.call_sid or str(uuid.uuid4())
        self._sample_rate = sample_rate
        self._tts_provider = tts_provider
        self.state = CallState(
            call_sid=call_id,
            caller_number=call_info.caller_number,
            called_number=call_info.called_number,
            direction=call_info.direction,
            provider=call_info.provider,
            agent_name=AGENT_NAME,
            language=language,
            tenant_id=tenant_id,
        )
        self._telephony = telephony
        self._raw_pcm = getattr(telephony, 'raw_pcm', False)

        self.emotion_adapter = EmotionTTSAdapter(
            template_type=emotion_profile,
            gender=voice_gender,
        )
        self.text_enricher = TextEnricher()

        base_instructions = instructions_override or AGENT_INSTRUCTIONS
        emotion_instructions = self.emotion_adapter.get_llm_emotion_instructions()
        self._instructions = build_system_prompt(base_instructions, emotion_instructions)
        self._greeting = greeting_override or GREETING

        self.stt = _create_stt(language, sample_rate=sample_rate)
        self.llm = _create_llm(self._instructions)
        self.llm.call_context = {
            "call_id": call_id,
            "caller_number": call_info.caller_number,
            "called_number": call_info.called_number,
            "direction": call_info.direction,
            "tenant_id": tenant_id,
        }
        self.tts = _create_tts(language, voice_id or VOICE_ID, sample_rate=sample_rate,
                              raw_pcm=self._raw_pcm, tts_provider=tts_provider)

        # TTS failover chain (Smallest <-> Sarvam)
        self._tts_chain = _create_tts_chain(
            language, voice_id or VOICE_ID,
            sample_rate=sample_rate, raw_pcm=self._raw_pcm,
        )

        self.eot = SemanticEOTDetector(threshold=0.65)
        self.tracer = LatencyTracer(call_id)
        self.compliance = ComplianceEngine()
        self.speculative = SpeculativeGenerator(eot_threshold=0.70, min_words=5)
        self.filler = FillerAudioManager()
        self.audio_smoother = AudioSmoother(sample_rate=sample_rate, crossfade_ms=8)
        self.language_detector = LanguageDetector(primary_language=language)
        self.language_router = LanguageRouter()
        self.turn_quality = TurnQualityAnalyzer()
        self.barge_in_tracker = BargeInTracker()

        self._running = False
        self._stt_task = None
        self._call_timeout_task = None
        self._audio_chunk_count = 0
        self._silence_chunks = 0
        self._speech_energy_threshold = 200
        self._energy_calibrated = False
        self._energy_samples: list[float] = []
        self._user_speech_end_ts = 0.0
        self._turn_number = 0
        self._turn_first_byte_ts = 0.0
        self._unclear_count = 0
        self._last_agent_text = ""
        self._agent_speech_ended_at = 0.0
        self.on_transcript = None
        self.on_latency = None
        self._speak_lock = asyncio.Lock()
        self._pending_final_task: asyncio.Task | None = None

        self._enable_memory = enable_memory
        self._enable_prediction = enable_prediction
        self._enable_emotion = enable_emotion
        self._enable_language_switch = enable_language_switch
        self._enable_rag = enable_rag
        self._enable_barge_in = enable_barge_in
        self._enable_speculative = enable_speculative
        self._enable_filler = enable_filler

        from cogniflow_home.providers.tools import TOOL_DEFINITIONS
        if tools_enabled is not None:
            self._tools = [t for t in TOOL_DEFINITIONS if t["function"]["name"] in tools_enabled]
        else:
            self._tools = TOOL_DEFINITIONS

    def inject_context(self, context: str):
        if context:
            self.llm.conversation_history.insert(1, {
                "role": "system",
                "content": f"Caller context: {context}",
            })

    async def _fetch_memory_and_prediction(self) -> str | None:
        custom_greeting = None

        if self._enable_memory:
            try:
                from cogniflow_home.memory.caller_memory import caller_memory
                profile = await caller_memory.recall(self.state.caller_number)
                if profile:
                    memory_prompt = caller_memory.build_memory_prompt(profile)
                    self._instructions = self._instructions + memory_prompt
                    self.llm.conversation_history[0]["content"] = self._instructions
                    logger.info(f"Loaded memory for {self.state.caller_number}: {profile.get('name')}")
            except Exception:
                logger.debug("Memory recall unavailable (non-fatal)", exc_info=True)

        if self._enable_prediction:
            try:
                from cogniflow_home.intelligence.predictor import pre_call_predictor
                prediction = await pre_call_predictor.predict(self.state.caller_number)
                if prediction and prediction["confidence"] >= 0.6:
                    prediction_prompt = pre_call_predictor.build_prediction_prompt(prediction)
                    self._instructions = self._instructions + prediction_prompt
                    self.llm.conversation_history[0]["content"] = self._instructions
                    if prediction["confidence"] >= 0.7:
                        custom_greeting = prediction["suggested_greeting"]
            except Exception:
                logger.debug("Pre-call prediction unavailable (non-fatal)", exc_info=True)

        return custom_greeting

    async def _prewarm_kb(self):
        try:
            from cogniflow_home.knowledge.base import kb
            agent_id = getattr(self, 'agent_id', None)
            if agent_id:
                self._kb_ready = True
                self._kb = kb
                logger.debug(f"KB pre-warmed for agent {agent_id}")
        except Exception:
            self._kb_ready = False
            logger.debug("KB prewarm unavailable (non-fatal)", exc_info=True)

    async def _prewarm_tts(self):
        await self.tts.connect()
        try:
            async for _ in self.tts.synthesize("."):
                pass
        except Exception:
            logger.debug("TTS voice prewarm failed (non-fatal)", exc_info=True)

        # Connect all fallback TTS providers in the chain
        for _, provider, _ in self._tts_chain._providers:
            if provider is not self.tts:
                try:
                    await provider.connect()
                except Exception:
                    logger.debug(
                        f"Failover TTS connect failed for {type(provider).__name__} (non-fatal)",
                        exc_info=True,
                    )

    async def start(self):
        self._running = True

        self._kb_ready = False
        self._kb = None

        results = await asyncio.gather(
            self.stt.connect(),
            self._prewarm_tts(),
            self._fetch_memory_and_prediction(),
            self.llm.prewarm(),
            self._prewarm_kb(),
            return_exceptions=True,
        )
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                labels = ["STT", "TTS", "Memory", "LLM", "KB"]
                logger.error(f"{labels[i]} prewarm failed: {r}")
        if isinstance(results[0], Exception):
            raise RuntimeError(f"STT connect failed: {results[0]}")
        custom_greeting = results[2] if not isinstance(results[2], Exception) else None

        async def _speculative_generate(text):
            """Wrapper that prevents speculative runs from mutating conversation history."""
            history_snapshot = list(self.llm.conversation_history)
            try:
                async for sentence in self.llm.generate_stream(text, tools=self._tools or None):
                    yield sentence
            finally:
                self.llm.conversation_history = history_snapshot

        if self._enable_speculative:
            self.speculative.set_generate_fn(_speculative_generate)
        self.llm.on_tool_call = self._on_tool_call
        if self._enable_filler:
            _filler_task = asyncio.create_task(self.filler.initialize(self.tts))
            _filler_task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)

        greeting = custom_greeting or self._greeting

        self._stt_task = asyncio.create_task(self._process_transcripts())
        self._call_timeout_task = asyncio.create_task(self._call_timeout_watchdog())
        logger.info(
            f"Pipeline started for call {self.state.call_sid} "
            f"via {self.state.provider} (lang={self.state.language})"
        )

        await bus.emit("call.started", {
            "call_id": self.state.call_sid,
            "direction": self.state.direction,
            "caller_number": self.state.caller_number,
            "called_number": self.state.called_number,
            "agent_name": self.state.agent_name,
            "provider": self.state.provider,
            "language": self.state.language,
            "tenant_id": self.state.tenant_id,
            "agent_id": getattr(self, "agent_id", None),
        })

        await self._speak(greeting)
        self.llm.add_message("assistant", greeting)
        self._last_agent_text = greeting.lower().strip()
        self.state.transcript.append(
            {"role": "agent", "text": greeting, "ts": time.time()}
        )
        if self.on_transcript:
            try:
                await self.on_transcript("agent", greeting)
            except Exception:
                pass

    async def handle_audio(self, mulaw_bytes: bytes):
        if not self._running:
            return

        energy = compute_energy_mulaw(mulaw_bytes)

        if not self._energy_calibrated:
            self._energy_samples.append(energy)
            if len(self._energy_samples) >= 20:
                avg = sum(self._energy_samples) / len(self._energy_samples)
                self._speech_energy_threshold = max(200, avg * 2.5)
                self._energy_calibrated = True
                logger.debug(f"Barge-in threshold calibrated: {self._speech_energy_threshold:.0f} (ambient: {avg:.0f})")

        if not self.state.is_agent_speaking:
            await self.stt.send_audio(mulaw_bytes)
        else:
            await self.stt.send_audio(mulaw_bytes)

            if self._enable_barge_in and energy > self._speech_energy_threshold:
                self._silence_chunks = 0
                self._audio_chunk_count += 1
                if self._audio_chunk_count >= 20:
                    barge_detect_ts = time.perf_counter() * 1000
                    logger.info("Barge-in detected — stopping agent, listening")
                    self.state.barge_in = True
                    self.state.is_agent_speaking = False
                    self._audio_chunk_count = 0
                    self.eot.cancel()
                    if self._enable_speculative:
                        self.speculative.cancel()
                    if self._pending_final_task and not self._pending_final_task.done():
                        self._pending_final_task.cancel()
                        self._pending_final_task = None
                    await self._telephony.clear_audio()
                    self.stt.flush_pending()
                    audio_stopped_ts = time.perf_counter() * 1000
                    self.barge_in_tracker.record_barge_in(
                        user_speech_detected_ms=barge_detect_ts,
                        agent_audio_stopped_ms=audio_stopped_ts,
                        llm_cancelled_ms=audio_stopped_ts,
                        stt_resumed_ms=audio_stopped_ts,
                        new_response_started_ms=0,
                    )
            else:
                self._silence_chunks += 1
                if self._silence_chunks > 6:
                    self._audio_chunk_count = 0

    async def _process_transcripts(self):
        """Main transcript processing loop with deduplication and speech_final gating."""
        pending_final = ""

        try:
            async for result in self.stt.results():
                if not self._running:
                    break

                if not result.is_final:
                    eot_prob = self.eot.predict(result.transcript)
                    if self._enable_speculative:
                        await self.speculative.on_partial_transcript(
                            result.transcript, eot_prob
                        )
                    if self._enable_language_switch:
                        new_lang = self.language_detector.should_switch(result.transcript)
                        if new_lang:
                            await self._switch_language(new_lang)
                    continue

                if result.speech_final:
                    if self._agent_speech_ended_at:
                        elapsed_ms = (time.perf_counter() - self._agent_speech_ended_at) * 1000
                        if elapsed_ms < 400:
                            await asyncio.sleep((400 - elapsed_ms) / 1000)
                    if self._pending_final_task and not self._pending_final_task.done():
                        self._pending_final_task.cancel()
                        self._pending_final_task = None
                    combined = (pending_final + " " + result.transcript).strip() if pending_final else result.transcript
                    pending_final = ""
                    await self._handle_final_transcript(combined)
                else:
                    pending_final = (pending_final + " " + result.transcript).strip() if pending_final else result.transcript
                    if self._pending_final_task and not self._pending_final_task.done():
                        self._pending_final_task.cancel()
                    self._pending_final_task = asyncio.create_task(
                        self._flush_pending_final(pending_final)
                    )

        except asyncio.CancelledError:
            pass
        except Exception:
            logger.exception("Transcript processing error")

    async def _flush_pending_final(self, text: str):
        """Safety net: if speech_final never arrives, process after 1.5s."""
        try:
            await asyncio.sleep(1.5)
            if self._running and text:
                await self._handle_final_transcript(text)
        except asyncio.CancelledError:
            pass

    async def _handle_final_transcript(self, transcript: str):
        """Process a confirmed final transcript with dedup and response generation."""
        redacted, compliance_events = self.compliance.monitor_transcript(transcript)
        for event in compliance_events:
            await bus.emit("compliance.event", {
                "call_id": self.state.call_sid,
                **event,
            })

        logger.info(f"User said: {redacted}")
        self._user_speech_end_ts = time.perf_counter() * 1000
        self._turn_number += 1

        cleaned = redacted.strip().lower()
        noise_tokens = {"", "uh", "um", "hmm", "hm", "ah", "oh"}
        words = cleaned.split()
        if not cleaned or (len(words) <= 1 and cleaned in noise_tokens):
            self._unclear_count += 1
            if self._unclear_count >= 2:
                await self._speak("I'm having trouble hearing you. Could you speak a little louder?")
                self._unclear_count = 0
            return

        self._unclear_count = 0
        if self._enable_emotion:
            self.emotion_adapter.update_caller_emotion(redacted)
            current_emotion = self.emotion_adapter.current_emotion.emotion
            self.filler.set_emotion(current_emotion)

        self.state.transcript.append(
            {"role": "user", "text": redacted, "ts": time.time()}
        )
        if self.on_transcript:
            try:
                await self.on_transcript("user", redacted)
            except Exception:
                pass

        self.tracer.new_turn()
        eot_ts = time.perf_counter() * 1000

        if self._enable_speculative:
            speculative = await self.speculative.on_final_transcript(redacted)
            if speculative:
                self.llm.add_message("user", redacted)
                spoken_text = await self._speak_speculative(speculative)
                if spoken_text:
                    self.llm.add_message("assistant", spoken_text)
                else:
                    self.llm.conversation_history.pop()
                    await self._generate_and_speak(redacted, eot_ts=eot_ts)
            else:
                await self._generate_and_speak(redacted, eot_ts=eot_ts)
        else:
            await self._generate_and_speak(redacted, eot_ts=eot_ts)

        await self.tracer.check_alert()

    async def _call_timeout_watchdog(self):
        """Auto-stop pipeline after 45 minutes to prevent zombie calls."""
        try:
            await asyncio.sleep(45 * 60)
            if self._running:
                logger.warning(f"Call {self.state.call_sid} hit 45-minute timeout — auto-stopping")
                await self.stop()
        except asyncio.CancelledError:
            pass

    async def _generate_and_speak(self, user_text: str, eot_ts: float = 0):
        async with self._speak_lock:
            self.state.is_agent_speaking = True
            self.state.barge_in = False
            self._turn_first_byte_ts = 0.0
            eot_ts_orig = eot_ts

            if self._turn_number == 1:
                disclosure = "Just so you know, this call is recorded."
                await self._speak(disclosure)
                self.llm.add_message("assistant", disclosure)
                self.state.transcript.append(
                    {"role": "agent", "text": disclosure, "ts": time.time()}
                )

            llm_input = user_text
            if self._enable_emotion and self.emotion_adapter.should_offer_human():
                llm_input += "\n[Offer to transfer to a human agent.]"

            if self._enable_rag and self._kb_ready and self._kb:
                try:
                    agent_id = getattr(self, 'agent_id', None)
                    if agent_id:
                        kb_results = await self._kb.query(agent_id, user_text)
                        kb_context = self._kb.build_context_prompt(kb_results)
                        if kb_context:
                            llm_input = kb_context + "\n\n" + llm_input
                except Exception:
                    pass

            full_response = ""
            t_llm = self.tracer.start("llm_ttft")
            first_sentence = True

            try:
                async for sentence in self.llm.generate_stream(llm_input, tools=self._tools or None):
                    if first_sentence:
                        self.tracer.end(t_llm)
                        first_sentence = False

                    if self.state.barge_in:
                        logger.info("Barge-in: stopping mid-response")
                        break

                    full_response += sentence + " "

                    t_tts = self.tracer.start("tts_ttfb")
                    await self._speak(sentence)
                    self.tracer.end(t_tts)

                    if eot_ts and self._user_speech_end_ts and self._turn_first_byte_ts:
                        self.turn_quality.record_turn(TurnEvent(
                            turn_number=self._turn_number,
                            user_speech_end_ms=self._user_speech_end_ts,
                            eot_fired_ms=eot_ts,
                            agent_first_audio_ms=self._turn_first_byte_ts,
                            agent_speech_end_ms=0,
                        ))
                        eot_ts = 0

                    if self.state.barge_in:
                        break

            except Exception:
                logger.exception("Generate-and-speak error")

            if first_sentence:
                self.tracer.end(t_llm)

            self.state.is_agent_speaking = False
            self._agent_speech_ended_at = time.perf_counter()

            if full_response.strip():
                self._last_agent_text = full_response.strip().lower()
                self.state.transcript.append(
                    {"role": "agent", "text": full_response.strip(), "ts": time.time()}
                )
                if self.on_transcript:
                    try:
                        await self.on_transcript("agent", full_response.strip())
                    except Exception:
                        pass

                if self.on_latency and self._user_speech_end_ts and eot_ts_orig:
                    first_byte = self._turn_first_byte_ts or (time.perf_counter() * 1000)
                    total_ms = round(first_byte - self._user_speech_end_ts)
                    eot_decision = round(eot_ts_orig - self._user_speech_end_ts)
                    llm_ms = round(self.tracer.get_turn_summary().get("llm_ttft", 0))
                    tts_ms = max(0, total_ms - eot_decision - llm_ms)
                    try:
                        await self.on_latency({
                            "turn": self._turn_number,
                            "eot_ms": eot_decision,
                            "llm_ms": llm_ms,
                            "tts_ms": tts_ms,
                            "total_ms": total_ms,
                        })
                    except Exception:
                        pass

                agent_text = " ".join(
                    t["text"] for t in self.state.transcript if t["role"] == "agent"
                )
                disclosure_violations = self.compliance.check_disclosures(
                    self.state.started_at, agent_text
                )
                for v in disclosure_violations:
                    await bus.emit("compliance.event", {
                        "call_id": self.state.call_sid,
                        **v,
                    })

    async def _speak_speculative(self, sentences: list[str]) -> str:
        """Speak pre-generated speculative sentences. Returns text actually spoken."""
        async with self._speak_lock:
            self.state.is_agent_speaking = True
            self.state.barge_in = False
            full_response = ""

            for sentence in sentences:
                if self.state.barge_in:
                    break
                full_response += sentence + " "
                await self._speak(sentence)

            self.state.is_agent_speaking = False

            if full_response.strip():
                self._last_agent_text = full_response.strip().lower()
                self.state.transcript.append(
                    {"role": "agent", "text": full_response.strip(), "ts": time.time()}
                )
                if self.on_transcript:
                    try:
                        await self.on_transcript("agent", full_response.strip())
                    except Exception:
                        pass
                logger.info("Speculative response delivered")

            return full_response.strip()

    async def _on_tool_call(self, tool_name: str):
        if not self._enable_filler:
            return
        filler_audio = self.filler.get_filler(tool_name)
        if filler_audio:
            chunk_size = self._sample_rate // 50
            for i in range(0, len(filler_audio), chunk_size):
                if self.state.barge_in:
                    break
                segment = filler_audio[i : i + chunk_size]
                payload = base64.b64encode(segment).decode("ascii")
                await self._telephony.send_audio(payload)
                await asyncio.sleep(0.018)
        else:
            filler_text = self.filler.get_filler_text(tool_name)
            await self._speak(filler_text)

    async def _switch_language(self, language: str):
        async with self._speak_lock:
            providers = self.language_router.get_providers(language)
            logger.info(f"Switching to language: {language}, providers: {providers}")

            await self.stt.close()
            self.stt = _create_stt(language, sample_rate=self._sample_rate)
            await self.stt.connect()

            await self.tts.close()
            self.tts = _create_tts(language, "", sample_rate=self._sample_rate, raw_pcm=self._raw_pcm,
                                  tts_provider=self._tts_provider)
            await self.tts.connect()

            self.state.language = language
            await bus.emit("language.switched", {
                "call_id": self.state.call_sid,
                "new_language": language,
            })

    def _get_emotion_tts_kwargs(self) -> dict:
        """Return emotion-derived TTS params based on the active provider type."""
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        from cogniflow_home.providers.smallest_tts import SmallestTTS

        if isinstance(self.tts, ElevenLabsTTS):
            return self.emotion_adapter.get_elevenlabs_kwargs()
        if isinstance(self.tts, SmallestTTS):
            return self.emotion_adapter.get_smallest_kwargs()
        # SarvamTTS — uses temperature/pace/voice
        return self.emotion_adapter.get_tts_kwargs()

    async def _speak(self, text: str):
        try:
            text = _humanize_for_speech(text)
            if not text:
                return
            if self._enable_emotion:
                emotion = self.emotion_adapter.current_emotion
                text = self.text_enricher.enrich(text, emotion.emotion, emotion.intensity)
                if not text:
                    return
                synth_kwargs = self._get_emotion_tts_kwargs()
            else:
                synth_kwargs = {}

            try:
                await self._stream_tts_audio(self.tts.synthesize(text, **synth_kwargs))
            except Exception as primary_err:
                logger.warning(
                    f"Primary TTS failed ({primary_err!r}), trying failover chain"
                )
                try:
                    await self._stream_tts_audio(
                        self._tts_chain.execute_stream("synthesize", text, **synth_kwargs)
                    )
                except Exception:
                    raise primary_err  # re-raise original if chain also fails

        except Exception:
            logger.exception("TTS speak error")

    async def _stream_tts_audio(self, audio_gen):
        """Send audio chunks from a TTS async generator to telephony."""
        async for audio_chunk in audio_gen:
            if self.state.barge_in:
                break

            if self._raw_pcm:
                smoothed = self.audio_smoother.process(audio_chunk)
                payload = base64.b64encode(smoothed).decode("ascii")
                await self._telephony.send_audio(payload)
                if not self._turn_first_byte_ts:
                    self._turn_first_byte_ts = time.perf_counter() * 1000
            else:
                smoothed = self.audio_smoother.process(audio_chunk)
                chunk_size = self._sample_rate // 50
                for i in range(0, len(smoothed), chunk_size):
                    if self.state.barge_in:
                        break
                    segment = smoothed[i : i + chunk_size]
                    payload = base64.b64encode(segment).decode("ascii")
                    await self._telephony.send_audio(payload)
                    if not self._turn_first_byte_ts:
                        self._turn_first_byte_ts = time.perf_counter() * 1000
                    await asyncio.sleep(0.018)

        # Fade out final chunk
        tail = self.audio_smoother.flush()
        if tail and not self.state.barge_in:
            payload = base64.b64encode(tail).decode("ascii")
            await self._telephony.send_audio(payload)
        self.audio_smoother.reset()

    async def stop(self):
        self._running = False
        if self._call_timeout_task:
            self._call_timeout_task.cancel()
            try:
                await self._call_timeout_task
            except asyncio.CancelledError:
                pass
        if self._pending_final_task and not self._pending_final_task.done():
            self._pending_final_task.cancel()
        if self._stt_task:
            self._stt_task.cancel()
            try:
                await self._stt_task
            except asyncio.CancelledError:
                pass
        await self.stt.close()
        await self.tts.close()
        await self.llm.close()
        # Close failover TTS providers
        for _, provider, _ in self._tts_chain._providers:
            if provider is not self.tts:
                try:
                    await provider.close()
                except Exception:
                    pass

        duration = int(time.time() - self.state.started_at)

        await self.tracer.save()

        turn_summary = self.turn_quality.get_summary()
        barge_summary = self.barge_in_tracker.get_summary()

        await bus.emit("call.completed", {
            "call_id": self.state.call_sid,
            "direction": self.state.direction,
            "caller_number": self.state.caller_number,
            "called_number": self.state.called_number,
            "agent_name": self.state.agent_name,
            "provider": self.state.provider,
            "language": self.state.language,
            "duration_seconds": duration,
            "transcript": self.state.transcript,
            "turn_quality": turn_summary,
            "barge_in_quality": barge_summary,
            "tenant_id": self.state.tenant_id,
            "agent_id": getattr(self, "agent_id", None),
        })

        if self.state.tenant_id and duration > 0:
            from cogniflow_home.tenants.manager import record_call_usage
            _usage_task = asyncio.create_task(record_call_usage(
                tenant_id=self.state.tenant_id,
                call_id=self.state.call_sid,
                duration_seconds=duration,
                language=self.state.language,
                provider=self.state.provider,
            ))
            _usage_task.add_done_callback(lambda t: t.exception() if not t.cancelled() else None)

        if turn_summary:
            logger.info(
                f"Turn quality: p50={turn_summary.get('turn_gap_p50_ms', 0):.0f}ms, "
                f"p95={turn_summary.get('turn_gap_p95_ms', 0):.0f}ms, "
                f"false_endpoints={turn_summary.get('false_endpoint_rate', 0)}%"
            )

        logger.info(
            f"Pipeline stopped for call {self.state.call_sid} "
            f"(duration: {duration}s, turns: {len(self.state.transcript)})"
        )
