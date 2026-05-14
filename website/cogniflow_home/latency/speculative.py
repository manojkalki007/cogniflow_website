"""Speculative LLM pre-generation.

Starts generating a response while the user is still speaking.
If the final transcript matches the partial, we use the pre-generated
response. Otherwise discard and generate fresh.
"""

import asyncio
import logging

logger = logging.getLogger("cogniflow_home.latency.speculative")


class SpeculativeGenerator:

    def __init__(self, eot_threshold: float = 0.7, min_words: int = 4):
        self.eot_threshold = eot_threshold
        self.min_words = min_words
        self._speculative_task: asyncio.Task | None = None
        self._speculative_text = ""
        self._speculative_response: list[str] = []
        self._generate_fn = None

    def set_generate_fn(self, fn):
        self._generate_fn = fn

    async def on_partial_transcript(self, text: str, eot_probability: float):
        word_count = len(text.split())
        if word_count >= self.min_words and eot_probability >= self.eot_threshold:
            if self._speculative_task and not self._speculative_task.done():
                self._speculative_task.cancel()
            self._speculative_text = text
            self._speculative_response = []
            self._speculative_task = asyncio.create_task(
                self._generate_speculative(text)
            )

    async def _generate_speculative(self, text: str):
        if not self._generate_fn:
            return
        try:
            async for sentence in self._generate_fn(text):
                self._speculative_response.append(sentence)
        except asyncio.CancelledError:
            pass
        except Exception:
            logger.debug("Speculative generation failed, will fall back to normal")

    async def on_final_transcript(self, final_text: str) -> list[str] | None:
        if (
            self._speculative_text
            and self._speculative_response
            and self._is_similar(final_text, self._speculative_text)
        ):
            logger.info("Speculative response matched — using pre-generated")
            result = list(self._speculative_response)
            self._reset()
            return result

        if self._speculative_task and not self._speculative_task.done():
            self._speculative_task.cancel()
        self._reset()
        return None

    def _is_similar(self, a: str, b: str, threshold: float = 0.85) -> bool:
        words_a = set(a.lower().split())
        words_b = set(b.lower().split())
        if not words_a or not words_b:
            return False
        overlap = len(words_a & words_b) / max(len(words_a), len(words_b))
        return overlap >= threshold

    def _reset(self):
        self._speculative_text = ""
        self._speculative_response = []
        self._speculative_task = None

    def cancel(self):
        if self._speculative_task and not self._speculative_task.done():
            self._speculative_task.cancel()
        self._reset()
