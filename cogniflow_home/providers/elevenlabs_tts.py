"""ElevenLabs Text-to-Speech — premium streaming provider.

Production-grade TTS with:
- True streaming via chunked HTTP response
- Ultra-low latency with eleven_turbo_v2_5 model
- High-quality voice cloning and natural speech
- Configurable voice settings (stability, similarity, style)
"""

import logging
from typing import AsyncIterator

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.tts.elevenlabs")

ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1/text-to-speech"

VALID_VOICES = {
    "rachel", "drew", "clyde", "domi", "dave", "fin",
    "sarah", "adam", "antoni", "bella", "elli", "josh",
    "arnold", "sam",
}


class ElevenLabsTTS:
    """Streaming TTS provider using ElevenLabs API.

    Outputs raw PCM 16kHz 16-bit mono audio when raw_pcm=True,
    or mulaw 8kHz for telephony when raw_pcm=False.
    """

    VALID_VOICES = VALID_VOICES

    def __init__(
        self,
        voice_id: str = "",
        language: str = "en",
        sample_rate: int = 8000,
        raw_pcm: bool = False,
        model: str = "",
        stability: float = 0.5,
        similarity_boost: float = 0.75,
        style: float = 0.0,
        use_speaker_boost: bool = True,
    ):
        self.voice_id = voice_id if voice_id in VALID_VOICES else "rachel"
        self.language = language
        self.sample_rate = sample_rate
        self.raw_pcm = raw_pcm
        self.model = model or settings.elevenlabs_model or "eleven_turbo_v2_5"
        self.stability = stability
        self.similarity_boost = similarity_boost
        self.style = style
        self.use_speaker_boost = use_speaker_boost
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)
        )

    async def connect(self):
        logger.info(
            f"ElevenLabs TTS ready (voice={self.voice_id}, model={self.model}, "
            f"rate={self.sample_rate}, pcm={self.raw_pcm})"
        )

    async def synthesize(self, text: str, speed: float = 1.0, stability: float | None = None,
                         style: float | None = None, **kwargs) -> AsyncIterator[bytes]:
        if not text.strip():
            return

        api_key = settings.elevenlabs_api_key
        if not api_key:
            raise RuntimeError("ElevenLabs API key not configured")

        voice = kwargs.get("voice", self.voice_id)
        if voice not in VALID_VOICES:
            voice = self.voice_id

        # Use per-request overrides if provided, otherwise fall back to instance defaults
        req_stability = stability if stability is not None else self.stability
        req_style = style if style is not None else self.style

        # Determine output format based on target sample rate and mode
        if self.raw_pcm:
            output_format = "pcm_16000"
        else:
            output_format = "ulaw_8000"

        url = f"{ELEVENLABS_API_URL}/{voice}/stream"
        headers = {
            "xi-api-key": api_key,
            "Content-Type": "application/json",
        }
        body = {
            "text": text,
            "model_id": self.model,
            "voice_settings": {
                "stability": req_stability,
                "similarity_boost": self.similarity_boost,
                "style": req_style,
                "use_speaker_boost": self.use_speaker_boost,
            },
            "output_format": output_format,
        }

        async with self._client.stream("POST", url, json=body, headers=headers) as resp:
            if resp.status_code != 200:
                error = await resp.aread()
                raise RuntimeError(
                    f"ElevenLabs TTS error {resp.status_code}: {error.decode()[:200]}"
                )

            if self.raw_pcm:
                # Stream raw PCM chunks directly
                async for chunk in resp.aiter_bytes(4096):
                    if chunk:
                        yield chunk
            else:
                # Already ulaw 8kHz from ElevenLabs — stream directly
                async for chunk in resp.aiter_bytes(4096):
                    if chunk:
                        yield chunk

    async def close(self):
        await self._client.aclose()
        logger.info("ElevenLabs TTS closed")
