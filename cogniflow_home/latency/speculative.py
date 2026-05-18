"""Speculative LLM pre-generation.

Starts generating a response while the user is still speaking.
Uses SequenceMatcher for robust similarity detection (handles
word reordering, minor differences between partial and final).
"""

import asyncio
import logging
from difflib import SequenceMatcher

logger = logging.getLogger("cogniflow_home.latency.speculative")


class SpeculativeGenerator:

    def __init__(self, eot_threshold: float = 0.70, min_words: int = 5):
        self.eot_threshold = eot_threshold
        self.min_words = min_words
        self._speculative_task: asyncio.Task | None = None
        self._speculative_text = ""
        self._speculative_response: list[str] = []
        self._generate_fn = None
        self._last_trigger_text = ""

    def set_generate_fn(self, fn):
        self._generate_fn = fn

    async def on_partial_transcript(self, text: str, eot_probability: float):
        word_count = len(text.split())
        if word_count < self.min_words or eot_probability < self.eot_threshold:
            return

        if self._is_similar(text, self._last_trigger_text, 0.90):
            return

        if self._speculative_task and not self._speculative_task.done():
            self._speculative_task.cancel()

        self._speculative_text = text
        self._speculative_response = []
        self._last_trigger_text = text
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
            if self._speculative_task and not self._speculative_task.done():
                try:
                    await asyncio.wait_for(self._speculative_task, timeout=0.5)
                except (asyncio.TimeoutError, asyncio.CancelledError):
                    pass

            if self._speculative_response:
                logger.info("Speculative response matched — using pre-generated")
                result = list(self._speculative_response)
                self._reset()
                return result

        if self._speculative_task and not self._speculative_task.done():
            self._speculative_task.cancel()
        self._reset()
        return None

    def _is_similar(self, a: str, b: str, threshold: float = 0.80) -> bool:
        if not a or not b:
            return False
        return SequenceMatcher(None, a.lower(), b.lower()).ratio() >= threshold

    def _reset(self):
        self._speculative_text = ""
        self._speculative_response = []
        self._speculative_task = None
        self._last_trigger_text = ""

    def cancel(self):
        if self._speculative_task and not self._speculative_task.done():
            self._speculative_task.cancel()
        self._reset()
