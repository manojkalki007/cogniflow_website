"""Sarvam AI Text-to-Speech for Indian languages.

Supports Hindi, Tamil, Telugu, Kannada, Malayalam, Bengali, Marathi,
Gujarati, Punjabi, Odia, English (Indian accent), and more.

Outputs mulaw 8kHz directly — no conversion needed for telephony.
"""

import base64
import logging
from typing import AsyncIterator

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.tts.sarvam")

SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

VOICES = {
    "hi":    {"voice": "priya",   "language": "hi-IN"},
    "ta":    {"voice": "priya",   "language": "ta-IN"},
    "te":    {"voice": "rahul",   "language": "te-IN"},
    "kn":    {"voice": "rahul",   "language": "kn-IN"},
    "ml":    {"voice": "priya",   "language": "ml-IN"},
    "bn":    {"voice": "rahul",   "language": "bn-IN"},
    "mr":    {"voice": "rahul",   "language": "mr-IN"},
    "gu":    {"voice": "priya",   "language": "gu-IN"},
    "pa":    {"voice": "rahul",   "language": "pa-IN"},
    "od":    {"voice": "rahul",   "language": "od-IN"},
    "en-in": {"voice": "priya",   "language": "en-IN"},
    "en":    {"voice": "priya",   "language": "en-IN"},
    "as":    {"voice": "priya",   "language": "as-IN"},
    "ur":    {"voice": "rahul",   "language": "ur-IN"},
}


class SarvamTTS:
    def __init__(self, language: str = "hi", sample_rate: int = 8000,
                 voice: str = "", temperature: float = 0.6, pace: float = 1.0):
        voice_config = VOICES.get(language, VOICES["hi"])
        self.voice = voice or voice_config["voice"]
        self.language = voice_config["language"]
        self.sample_rate = sample_rate
        self.temperature = temperature
        self.pace = pace
        self._client = httpx.AsyncClient(timeout=15.0)
        self._headers = {
            "api-subscription-key": settings.sarvam_api_key,
            "Content-Type": "application/json",
        }

    async def connect(self):
        logger.info(f"Sarvam TTS ready (language={self.language}, voice={self.voice}, "
                     f"temp={self.temperature}, pace={self.pace})")

    async def synthesize(self, text: str, **kwargs) -> AsyncIterator[bytes]:
        if not text.strip():
            return

        temperature = kwargs.get("temperature", self.temperature)
        pace = kwargs.get("pace", self.pace)

        body = {
            "inputs": [text],
            "target_language_code": self.language,
            "speaker": kwargs.get("voice", self.voice),
            "model": "bulbul:v3",
            "audio_format": "mulaw",
            "sample_rate": self.sample_rate,
            "temperature": max(0.01, min(1.0, temperature)),
            "pace": max(0.5, min(2.0, pace)),
        }

        try:
            resp = await self._client.post(
                SARVAM_TTS_URL, json=body, headers=self._headers
            )
            if resp.status_code == 200:
                result = resp.json()
                audios = result.get("audios", [])
                for audio_b64 in audios:
                    audio_bytes = base64.b64decode(audio_b64)
                    yield audio_bytes
            else:
                logger.warning(f"Sarvam TTS error: {resp.status_code} {resp.text}")
        except Exception:
            logger.exception("Sarvam TTS request failed")

    async def close(self):
        await self._client.aclose()
        logger.info("Sarvam TTS closed")
