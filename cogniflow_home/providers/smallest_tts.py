"""Smallest AI Lightning v3.1 Text-to-Speech.

Lightning v3.1 — 217 voices, 15 languages, ~200ms TTFB, $0.025/1K chars.
Native 44.1kHz, auto language detection, mid-sentence code-mixing.
"""

import logging
from typing import AsyncIterator

import httpx

from cogniflow_home.audio import pcm16_to_mulaw
from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.tts.smallest")

API_URL = "https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech"

LANGUAGE_CODES = {
    "en", "hi", "ta", "kn", "te", "ml", "mr", "gu",
    "es", "fr", "it", "de", "nl", "sv", "pt",
}


VALID_VOICES = {
    "jessica", "sophia", "olivia", "isabella", "mia", "harper", "ella",
    "rachel", "natasha", "maya", "liam", "noah", "william", "lucas",
    "ethan", "daniel", "david", "arjun", "vikram",
}


class SmallestTTS:

    def __init__(self, voice_id: str = "jessica", language: str = "en", sample_rate: int = 8000, raw_pcm: bool = False):
        self.voice_id = voice_id if voice_id in VALID_VOICES else "jessica"
        self.language = language if language in LANGUAGE_CODES else "en"
        self.sample_rate = sample_rate
        self.raw_pcm = raw_pcm
        self._client = httpx.AsyncClient(timeout=10.0)

    async def connect(self):
        logger.info("Smallest AI Lightning v3.1 ready (voice=%s, lang=%s, rate=%d, pcm=%s)",
                     self.voice_id, self.language, self.sample_rate, self.raw_pcm)

    async def synthesize(self, text: str, speed: float = 0.0, **kwargs) -> AsyncIterator[bytes]:
        if not text.strip():
            return

        headers = {
            "Authorization": f"Bearer {settings.smallest_ai_api_key}",
            "Content-Type": "application/json",
        }
        effective_speed = max(0.5, min(2.0, speed)) if speed > 0 else 1.20
        body = {
            "text": text,
            "voice_id": self.voice_id,
            "sample_rate": self.sample_rate,
            "speed": effective_speed,
            "language": self.language,
            "add_wav_header": False,
        }

        chunk_bytes = 4096 if self.raw_pcm else 320
        async with self._client.stream("POST", API_URL, json=body, headers=headers) as resp:
            if resp.status_code != 200:
                error = await resp.aread()
                raise RuntimeError(
                    f"Smallest AI TTS error {resp.status_code}: {error.decode()[:200]}"
                )

            async for chunk in resp.aiter_bytes(chunk_bytes):
                if chunk:
                    yield chunk if self.raw_pcm else pcm16_to_mulaw(chunk)

    async def close(self):
        await self._client.aclose()
        logger.info("Smallest AI TTS closed")
