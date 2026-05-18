import logging
import time

logger = logging.getLogger(__name__)


class VoiceQualityEvaluator:
    """Measures TTS performance (TTFB). Emotion scoring removed — it was
    scoring text content via LLM, not actual audio expressiveness."""

    async def measure_tts_ttfb(self, tts_engine, test_text: str = "Hello, how can I help you today?") -> float:
        start = time.perf_counter()
        try:
            async for chunk in tts_engine.synthesize(test_text):
                return round((time.perf_counter() - start) * 1000, 1)
        except Exception:
            return -1
        return -1
