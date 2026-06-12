"""Sarvam AI Speech-to-Text for Indian languages.

Supports: Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi,
Gujarati, Punjabi, Odia, English (Indian accent), Assamese, and more.

Uses the REST API with audio buffering for now. For lowest latency,
upgrade to WebSocket streaming via the Sarvam Python SDK when available.
"""

import asyncio
import base64
import io
import logging
import wave
from typing import AsyncIterator

import httpx

from cogniflow_home.config import settings
from cogniflow_home.providers.stt import STTResult

logger = logging.getLogger("cogniflow_home.stt.sarvam")

SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"

SUPPORTED_LANGUAGES = {
    "hi": "hi-IN", "ta": "ta-IN", "te": "te-IN", "kn": "kn-IN",
    "ml": "ml-IN", "bn": "bn-IN", "mr": "mr-IN", "gu": "gu-IN",
    "pa": "pa-IN", "od": "od-IN", "en-in": "en-IN", "as": "as-IN",
    "ur": "ur-IN", "ne": "ne-IN",
}


class SarvamSTT:
    """Buffers audio and sends to Sarvam REST API for transcription.

    For real-time calls, audio is buffered in ~2-second chunks
    and sent for transcription when silence is detected.
    """

    def __init__(self, language: str = "hi", sample_rate: int = 8000):
        lang_code = SUPPORTED_LANGUAGES.get(language, language)
        self.language = lang_code
        self.sample_rate = sample_rate
        self._client = httpx.AsyncClient(timeout=15.0)
        self._headers = {"api-subscription-key": settings.sarvam_api_key}
        self._buffer = bytearray()
        self._transcript_queue: asyncio.Queue[str] = asyncio.Queue()
        self._running = False
        self._flush_task = None
        self._buffer_duration_ms = 0
        self._flush_threshold_ms = 250

    async def connect(self):
        self._running = True
        self._flush_task = asyncio.create_task(self._auto_flush_loop())
        logger.info(f"Sarvam STT ready (language={self.language})")

    async def send_audio(self, mulaw_bytes: bytes):
        if not self._running:
            return
        self._buffer.extend(mulaw_bytes)
        chunk_ms = (len(mulaw_bytes) / self.sample_rate) * 1000
        self._buffer_duration_ms += chunk_ms

    async def _auto_flush_loop(self):
        try:
            while self._running:
                await asyncio.sleep(0.15)
                if self._buffer_duration_ms >= self._flush_threshold_ms:
                    await self._flush()
        except asyncio.CancelledError:
            pass

    async def _flush(self):
        if not self._buffer:
            return

        audio_data = bytes(self._buffer)
        self._buffer.clear()
        self._buffer_duration_ms = 0

        wav_buffer = self._mulaw_to_wav(audio_data)

        try:
            files = {"file": ("audio.wav", wav_buffer, "audio/wav")}
            data = {
                "model": "saaras:v3",
                "language_code": self.language,
                "with_disfluencies": "false",
                "debug_mode": "false",
            }
            resp = await self._client.post(
                SARVAM_STT_URL, files=files, data=data, headers=self._headers
            )
            if resp.status_code == 200:
                result = resp.json()
                transcript = result.get("transcript", "").strip()
                if transcript:
                    await self._transcript_queue.put(transcript)
            else:
                logger.warning(f"Sarvam STT error: {resp.status_code}")
        except Exception:
            logger.exception("Sarvam STT request failed")

    def flush_pending(self):
        self._buffer.clear()
        self._buffer_duration_ms = 0
        while not self._transcript_queue.empty():
            try:
                self._transcript_queue.get_nowait()
            except Exception:
                break

    def _mulaw_to_wav(self, mulaw_data: bytes) -> bytes:
        from cogniflow_home.audio import mulaw_to_pcm16
        pcm_data = mulaw_to_pcm16(mulaw_data)

        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(self.sample_rate)
            wf.writeframes(pcm_data)
        buf.seek(0)
        return buf.read()

    async def transcripts(self) -> AsyncIterator[str]:
        while self._running or not self._transcript_queue.empty():
            try:
                transcript = await asyncio.wait_for(
                    self._transcript_queue.get(), timeout=0.1
                )
                yield transcript
            except asyncio.TimeoutError:
                continue

    async def results(self) -> AsyncIterator[STTResult]:
        async for transcript in self.transcripts():
            yield STTResult(
                transcript=transcript,
                is_final=True,
                speech_final=True,
            )

    async def close(self):
        self._running = False
        if self._buffer:
            await self._flush()
        if self._flush_task:
            self._flush_task.cancel()
            try:
                await self._flush_task
            except asyncio.CancelledError:
                pass
        await self._client.aclose()
        logger.info("Sarvam STT closed")
