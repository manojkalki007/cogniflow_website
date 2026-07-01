"""Smallest AI Lightning v3.1 Text-to-Speech.

Lightning v3.1 — 217 voices, 15 languages, ~200ms TTFB, $0.025/1K chars.
Native 44.1kHz, auto language detection, mid-sentence code-mixing.
"""

import logging
from typing import AsyncIterator

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.tts.smallest")

API_URL = "https://api.smallest.ai/waves/v1/lightning-v3.1/get_speech"

LANGUAGE_CODES = {
    "en", "hi", "ta", "kn", "te", "ml", "mr", "gu",
    "es", "fr", "it", "de", "nl", "sv", "pt",
}


VALID_VOICES = {
    "jessica", "sophia", "natasha", "rachel", "olivia", "isla", "chloe",
    "maya", "meera", "kavya", "anika", "divya", "sita", "priyanka", "aanya",
    "ethan", "daniel", "ryan", "lucas", "jordan", "liam", "noah",
    "arjun", "vikram", "kartik", "devansh", "kunal",
}


class SmallestTTS:

    def __init__(self, voice_id: str = "jessica", language: str = "en", sample_rate: int = 8000, raw_pcm: bool = False):
        requested = (voice_id or "jessica").lower().strip()
        if requested not in VALID_VOICES:
            logger.warning("Voice '%s' not in Smallest AI catalog, falling back to 'jessica'", requested)
            requested = "jessica"
        self.voice_id = requested
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
        effective_speed = max(0.5, min(2.0, speed)) if speed > 0 else 1.0
        body = {
            "text": text,
            "voice_id": self.voice_id,
            "sample_rate": self.sample_rate,
            "speed": effective_speed,
            "language": self.language,
            "add_wav_header": False,
        }

        async with self._client.stream("POST", API_URL, json=body, headers=headers) as resp:
            if resp.status_code == 400 and self.voice_id != "jessica":
                error = await resp.aread()
                logger.warning("Voice '%s' rejected by API, retrying with 'jessica': %s",
                               self.voice_id, error.decode()[:100])
                self.voice_id = "jessica"
                body["voice_id"] = "jessica"
                async with self._client.stream("POST", API_URL, json=body, headers=headers) as retry:
                    if retry.status_code != 200:
                        err2 = await retry.aread()
                        raise RuntimeError(f"Smallest AI TTS error {retry.status_code}: {err2.decode()[:200]}")
                    async for chunk in retry.aiter_bytes(4096):
                        if chunk:
                            yield chunk
                return
            if resp.status_code != 200:
                error = await resp.aread()
                raise RuntimeError(
                    f"Smallest AI TTS error {resp.status_code}: {error.decode()[:200]}"
                )

            async for chunk in resp.aiter_bytes(8192):
                if chunk:
                    yield chunk

    async def close(self):
        await self._client.aclose()
        logger.info("Smallest AI TTS closed")
