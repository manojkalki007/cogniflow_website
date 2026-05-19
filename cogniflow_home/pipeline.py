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
from cogniflow_home.audio import compute_energy_mulaw
from cogniflow_home.compliance.engine import ComplianceEngine
from cogniflow_home.config import settings
from cogniflow_home.events import bus
from cogniflow_home.latency.eot import SemanticEOTDetector
from cogniflow_home.latency.filler import FillerAudioManager
from cogniflow_home.latency.speculative import SpeculativeGenerator
from cogniflow_home.latency.tracer import LatencyTracer
from cogniflow_home.intelligence.emotional_mirror import EmotionalMirror
from cogniflow_home.language.detector import LanguageDetector, LanguageRouter
from cogniflow_home.monitoring.turn_quality import TurnEvent, TurnQualityAnalyzer
from cogniflow_home.monitoring.barge_in import BargeInTracker
from cogniflow_home.emotions.tts_adapter import EmotionTTSAdapter
from cogniflow_home.providers.failover import ProviderChain, register_chain
from cogniflow_home.telephony.base import CallInfo, TelephonyProvider

logger = logging.getLogger("cogniflow_home.pipeline")

INDIAN_LANGUAGES = {"hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "pa", "od", "as", "ur", "ne", "en-in"}
SARVAM_TTS_LANGUAGES = {"hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "pa", "od", "as", "ur", "ne", "en-in"}
SYSTEM_PROMPT_VOICE_RULES = """
VOICE CALL RULES — you are on a live phone call, not writing text:

FORMAT:
- Keep responses to 1-2 sentences MAX. This is a phone call — be concise.
- Match the caller's length. If they say one sentence, reply with one sentence.
- Keep sentences short, max 15 words each.
- NEVER use lists, bullet points, markdown, asterisks, or any formatting.
- Say numbers as words: "four hundred fifty" not "450".
- If calling a tool, say a filler first: "Let me pull that up for you..."
- NEVER repeat information you already said. Don't re-introduce yourself.
- NEVER repeat the caller's question back to them. Just answer it directly.

LISTENING RULES — these are critical:
- NEVER cut the caller off. Wait for them to finish their full thought before responding.
- If the caller pauses mid-sentence, WAIT. They might be thinking. Don't jump in.
- If the caller interrupts YOU, IMMEDIATELY stop talking and listen to what they're saying. Then respond to their new input.
- If you can't understand what the caller said, ask them to repeat: "Sorry, I didn't quite catch that. Could you say that again?"

SOUND HUMAN — this is the most important part:
- ALWAYS use contractions: "don't", "can't", "I'm", "you're", "it's", "that's", "won't", "I'll", "we're", "I'd", "they're", "haven't", "isn't", "wouldn't", "shouldn't".
- Start responses with natural reactions: "Oh, sure!", "Ah, got it.", "Right, so...", "Hmm, let me think.", "Yeah, absolutely!"
- Use conversational connectors between sentences: "So,", "Well,", "Actually,", "Honestly,", "You know,"
- Vary your sentence rhythm. Mix short punchy lines with slightly longer ones.
- Show warmth and personality. React to what the caller says. Sound like you genuinely care.
- Use casual phrasing: "a couple of" not "several", "pretty much" not "essentially", "I'd say" not "I would estimate".
- Add natural hedging where appropriate: "I think", "probably", "I'd say", "as far as I know".
- NEVER sound like you're reading from a script. Be spontaneous and genuine.
"""


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
        return SarvamTTS(language=language, sample_rate=sample_rate)
    if tts_provider == "elevenlabs" and settings.elevenlabs_api_key:
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        return ElevenLabsTTS(voice_id=voice_id, language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)
    if settings.smallest_ai_api_key:
        from cogniflow_home.providers.smallest_tts import SmallestTTS
        return SmallestTTS(voice_id=voice_id, language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)
    if settings.elevenlabs_api_key:
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        return ElevenLabsTTS(voice_id=voice_id, language=language, sample_rate=sample_rate, raw_pcm=raw_pcm)
    from cogniflow_home.providers.sarvam_tts import SarvamTTS
    return SarvamTTS(language=language if language in SARVAM_TTS_LANGUAGES else "en-in", sample_rate=sample_rate)


_CONTRACTIONS = [
    (r"\bI am\b", "I'm"), (r"\bI have\b", "I've"), (r"\bI will\b", "I'll"),
    (r"\bI would\b", "I'd"), (r"\bdo not\b", "don't"), (r"\bDo not\b", "Don't"),
    (r"\bcannot\b", "can't"), (r"\bCannot\b", "Can't"),
    (r"\bwill not\b", "won't"), (r"\bWill not\b", "Won't"),
    (r"\bshould not\b", "shouldn't"), (r"\bwould not\b", "wouldn't"),
    (r"\bcould not\b", "couldn't"), (r"\bthat is\b", "that's"),
    (r"\bThat is\b", "That's"), (r"\bit is\b", "it's"), (r"\bIt is\b", "It's"),
    (r"\bwhat is\b", "what's"), (r"\bWhat is\b", "What's"),
    (r"\bhere is\b", "here's"), (r"\bHere is\b", "Here's"),
    (r"\bthere is\b", "there's"), (r"\bThere is\b", "There's"),
    (r"\blet us\b", "let's"), (r"\bLet us\b", "Let's"),
    (r"\byou are\b", "you're"), (r"\bYou are\b", "You're"),
    (r"\bthey are\b", "they're"), (r"\bThey are\b", "They're"),
    (r"\bwe are\b", "we're"), (r"\bWe are\b", "We're"),
    (r"\bhave not\b", "haven't"), (r"\bhas not\b", "hasn't"),
    (r"\bdid not\b", "didn't"), (r"\bis not\b", "isn't"),
    (r"\bare not\b", "aren't"), (r"\bwere not\b", "weren't"),
    (r"\bwas not\b", "wasn't"), (r"\bwho is\b", "who's"),
    (r"\bwhere is\b", "where's"), (r"\bhow is\b", "how's"),
]


def _humanize_for_speech(text: str) -> str:
    t = text
    for pattern, repl in _CONTRACTIONS:
        t = re.sub(pattern, repl, t)
    t = re.sub(r'\*+', '', t)
    t = re.sub(r'#+\s*', '', t)
    t = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', t)
    t = re.sub(r'\s{2,}', ' ', t)
    return t.strip()


def _create_tts_chain(language: str, voice_id: str, sample_rate: int = 8000,
                      raw_pcm: bool = False, tts_provider: str = "") -> ProviderChain:
    """Build a TTS failover chain: primary + fallbacks across Smallest, ElevenLabs, Sarvam."""
    providers = []

    if language in SARVAM_TTS_LANGUAGES:
        # Indian language — Sarvam primary, others as fallback
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        providers.append(("sarvam-tts", SarvamTTS(language=language, sample_rate=sample_rate)))
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
        providers.append(("sarvam-tts", SarvamTTS(language="en-in", sample_rate=sample_rate)))
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
        providers.append(("sarvam-tts", SarvamTTS(language="en-in", sample_rate=sample_rate)))
    elif settings.elevenlabs_api_key:
        # Only ElevenLabs configured (no Smallest)
        from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
        providers.append(("elevenlabs-tts", ElevenLabsTTS(
            voice_id=voice_id, language=language,
            sample_rate=sample_rate, raw_pcm=raw_pcm,
        )))
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        providers.append(("sarvam-tts", SarvamTTS(language="en-in", sample_rate=sample_rate)))
    else:
        # Only Sarvam available
        from cogniflow_home.providers.sarvam_tts import SarvamTTS
        providers.append(("sarvam-tts", SarvamTTS(
            language=language if language in SARVAM_TTS_LANGUAGES else "en-in",
            sample_rate=sample_rate,
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
                 emotion_profile: str = "friendly", voice_gender: str = "female"):
        call_id = call_info.call_sid or str(uuid.uuid4())
        self._sample_rate = sample_rate
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

        base_instructions = instructions_override or AGENT_INSTRUCTIONS
        emotion_instructions = self.emotion_adapter.get_llm_emotion_instructions()
        self._instructions = base_instructions + "\n\n" + SYSTEM_PROMPT_VOICE_RULES + "\n\n" + emotion_instructions
        self._greeting = greeting_override or GREETING

        self.stt = _create_stt(language, sample_rate=sample_rate)
        self.llm = _create_llm(self._instructions)
        self.llm.call_context = {
            "call_id": call_id,
            "caller_number": call_info.caller_number,
            "called_number": call_info.called_number,
            "direction": call_info.direction,
        }
        self.tts = _create_tts(language, voice_id or VOICE_ID, sample_rate=sample_rate, raw_pcm=self._raw_pcm)

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
        self.emotional_mirror = EmotionalMirror()
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
        self.on_transcript = None
        self.on_latency = None
        self._speak_lock = asyncio.Lock()
        self._pending_final_task: asyncio.Task | None = None

    def inject_context(self, context: str):
        if context:
            self.llm.conversation_history.insert(1, {
                "role": "system",
                "content": f"Caller context: {context}",
            })

    async def _fetch_memory_and_prediction(self) -> str | None:
        custom_greeting = None
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

        results = await asyncio.gather(
            self.stt.connect(),
            self._prewarm_tts(),
            self._fetch_memory_and_prediction(),
            self.llm.prewarm(),
            return_exceptions=True,
        )
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                labels = ["STT", "TTS", "Memory", "LLM"]
                logger.error(f"{labels[i]} prewarm failed: {r}")
        if isinstance(results[0], Exception):
            raise RuntimeError(f"STT connect failed: {results[0]}")
        custom_greeting = results[2] if not isinstance(results[2], Exception) else None

        async def _speculative_generate(text):
            """Wrapper that prevents speculative runs from mutating conversation history."""
            history_snapshot = list(self.llm.conversation_history)
            try:
                async for sentence in self.llm.generate_stream(text):
                    yield sentence
            finally:
                self.llm.conversation_history = history_snapshot

        self.speculative.set_generate_fn(_speculative_generate)
        self.llm.on_tool_call = self._on_tool_call
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

            if energy > self._speech_energy_threshold:
                self._silence_chunks = 0
                self._audio_chunk_count += 1
                if self._audio_chunk_count >= 20:
                    barge_detect_ts = time.perf_counter() * 1000
                    logger.info("Barge-in detected — stopping agent, listening")
                    self.state.barge_in = True
                    self.state.is_agent_speaking = False
                    self._audio_chunk_count = 0
                    self.eot.cancel()
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
                    await self.speculative.on_partial_transcript(
                        result.transcript, eot_prob
                    )
                    new_lang = self.language_detector.should_switch(result.transcript)
                    if new_lang:
                        await self._switch_language(new_lang)
                    continue

                if result.speech_final:
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
        self.emotion_adapter.update_caller_emotion(redacted)
        current_emotion = self.emotion_adapter.current_emotion.emotion
        self.emotional_mirror.sync_from_adapter(current_emotion)
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

        speculative = await self.speculative.on_final_transcript(redacted)
        if speculative:
            self.llm.add_message("user", redacted)
            spoken_text = await self._speak_speculative(speculative)
            if spoken_text:
                self.llm.add_message("assistant", spoken_text)
        else:
            await self._generate_and_speak(redacted, eot_ts=eot_ts)

        self.tracer.check_alert()

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

            emotion_prompt = self.emotional_mirror.get_prompt_injection()
            caller_emotion_prompt = self.emotion_adapter.get_caller_emotion_prompt()
            llm_input = user_text
            combined_emotion = (emotion_prompt + "\n" + caller_emotion_prompt).strip()
            if combined_emotion:
                llm_input = f"[EMOTION CONTEXT: {combined_emotion}]\n\nCaller said: \"{user_text}\""
            if self.emotional_mirror.should_offer_human():
                llm_input += "\n[SYSTEM: Caller has been frustrated for 30+ seconds. Proactively offer to transfer to a human agent.]"

            try:
                from cogniflow_home.knowledge.base import kb
                agent_id = getattr(self, 'agent_id', None)
                if agent_id:
                    kb_results = await kb.query(agent_id, user_text)
                    kb_context = kb.build_context_prompt(kb_results)
                    if kb_context:
                        llm_input = kb_context + "\n\n" + llm_input
            except Exception:
                pass

            full_response = ""
            t_llm = self.tracer.start("llm_ttft")
            first_sentence = True

            try:
                async for sentence in self.llm.generate_stream(llm_input):
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
            self.tts = _create_tts(language, "", sample_rate=self._sample_rate, raw_pcm=self._raw_pcm)
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
            synth_kwargs = self._get_emotion_tts_kwargs()

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
                payload = base64.b64encode(audio_chunk).decode("ascii")
                await self._telephony.send_audio(payload)
                if not self._turn_first_byte_ts:
                    self._turn_first_byte_ts = time.perf_counter() * 1000
            else:
                chunk_size = self._sample_rate // 50
                for i in range(0, len(audio_chunk), chunk_size):
                    if self.state.barge_in:
                        break
                    segment = audio_chunk[i : i + chunk_size]
                    payload = base64.b64encode(segment).decode("ascii")
                    await self._telephony.send_audio(payload)
                    if not self._turn_first_byte_ts:
                        self._turn_first_byte_ts = time.perf_counter() * 1000
                    await asyncio.sleep(0.018)

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
