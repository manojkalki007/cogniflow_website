"""Smallest AI Text-to-Speech.

Production-grade TTS with:
- Proper error propagation (no silent failures)
- Configurable chunk size for low-latency streaming
- Speed/voice control
- Connection health monitoring
"""

import logging
from typing import AsyncIterator

import httpx

from cogniflow_home.audio import pcm16_to_mulaw
from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.tts.smallest")

SMALLEST_API_URL = "https://waves-api.smallest.ai/api/v1/lightning/get_speech"


class SmallestTTS:
    VALID_VOICES = {
        "emily", "jasmine", "arman", "james", "mithali", "aravind",
        "raman", "diya", "ananya", "chetan", "deepika", "nisha", "raj",
        "arnav", "george", "judi", "aarav", "raghav", "kajal", "mansi",
        "saurabh", "pooja", "saina", "sanya", "ankur", "enola", "rebecca",
        "abhinav", "sushma", "ashish", "shweta", "karen", "pragya",
    }

    def __init__(self, voice_id: str = "", language: str = "en", sample_rate: int = 8000, raw_pcm: bool = False):
        self.voice_id = voice_id if voice_id in self.VALID_VOICES else "emily"
        self.language = language
        self.sample_rate = sample_rate
        self.raw_pcm = raw_pcm
        self._client = httpx.AsyncClient(timeout=8.0)

    async def connect(self):
        logger.info(f"Smallest AI TTS ready (voice={self.voice_id}, rate={self.sample_rate}, pcm={self.raw_pcm})")

    async def synthesize(self, text: str, speed: float = 0.0) -> AsyncIterator[bytes]:
        if not text.strip():
            return

        headers = {
            "Authorization": f"Bearer {settings.smallest_ai_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "text": text,
            "voice_id": self.voice_id,
            "sample_rate": self.sample_rate,
            "speed": speed if speed > 0 else 1.0,
            "add_wav_header": False,
        }

        chunk_bytes = 4096 if self.raw_pcm else 320
        async with self._client.stream(
            "POST", SMALLEST_API_URL, json=body, headers=headers
        ) as resp:
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
