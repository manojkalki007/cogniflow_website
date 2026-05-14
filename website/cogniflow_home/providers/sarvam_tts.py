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
    "hi": {"voice": "arvind", "language": "hi-IN"},
    "ta": {"voice": "meera", "language": "ta-IN"},
    "te": {"voice": "arvind", "language": "te-IN"},
    "kn": {"voice": "arvind", "language": "kn-IN"},
    "ml": {"voice": "meera", "language": "ml-IN"},
    "bn": {"voice": "arvind", "language": "bn-IN"},
    "mr": {"voice": "arvind", "language": "mr-IN"},
    "gu": {"voice": "arvind", "language": "gu-IN"},
    "pa": {"voice": "arvind", "language": "pa-IN"},
    "od": {"voice": "arvind", "language": "od-IN"},
    "en-in": {"voice": "arvind", "language": "en-IN"},
}


class SarvamTTS:
    def __init__(self, language: str = "hi", sample_rate: int = 8000):
        voice_config = VOICES.get(language, VOICES["hi"])
        self.voice = voice_config["voice"]
        self.language = voice_config["language"]
        self.sample_rate = sample_rate
        self._client = httpx.AsyncClient(timeout=15.0)
        self._headers = {
            "api-subscription-key": settings.sarvam_api_key,
            "Content-Type": "application/json",
        }

    async def connect(self):
        logger.info(f"Sarvam TTS ready (language={self.language}, voice={self.voice})")

    async def synthesize(self, text: str) -> AsyncIterator[bytes]:
        if not text.strip():
            return

        body = {
            "inputs": [text],
            "target_language_code": self.language,
            "speaker": self.voice,
            "model": "bulbul:v2",
            "audio_format": "mulaw",
            "sample_rate": self.sample_rate,
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
