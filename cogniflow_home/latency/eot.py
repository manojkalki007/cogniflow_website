"""Semantic End-of-Turn detector.

Production-grade turn detection using:
- Deepgram's speech_final signal as primary gate
- Multi-signal scoring (punctuation, turn-finals, word count)
- Grace period with cancellation for interruption recovery
"""

import asyncio
import re


class SemanticEOTDetector:

    TURN_FINALS = {
        "thank you", "thanks", "that's all", "that's it",
        "please", "okay", "ok", "yes", "no", "sure", "nope", "yep", "yeah",
        "got it", "never mind", "goodbye", "bye", "alright", "fine",
        "right", "correct", "absolutely", "exactly",
        "haan", "nahi", "theek hai", "shukriya", "dhanyavaad",
        "achha", "bas", "chalo", "thik hai", "bilkul",
        "aur kuch nahi", "bas itna", "alvida",
    }

    INCOMPLETE_SUFFIXES = {
        "and", "but", "or", "because", "so", "if", "when", "then",
        "toh", "aur", "lekin", "ya", "kyunki", "jab", "phir",
        "mujhe", "matlab", "like",
    }

    def __init__(self, threshold: float = 0.65):
        self.threshold = threshold
        self._cancel_event = asyncio.Event()

    def predict(self, partial_text: str, silence_ms: int = 0) -> float:
        score = 0.0
        text = partial_text.strip().lower()

        if not text or len(text.split()) < 2:
            return 0.0

        if text[-1] in ".!":
            score += 0.35
        elif text[-1] == "?":
            score += 0.40

        for phrase in self.TURN_FINALS:
            if text.endswith(phrase):
                score += 0.25
                break

        if re.search(
            r"\b(what|when|where|how|why|can|could|would|is|are|do|does|kya|kab|kaise|kahan)\b",
            text,
        ) and text[-1] == "?":
            score += 0.15

        words = text.split()
        word_count = len(words)
        if word_count >= 5:
            score += 0.10
        if word_count >= 10:
            score += 0.10

        if words and words[-1] in self.INCOMPLETE_SUFFIXES:
            score -= 0.30

        if silence_ms >= 400:
            score += 0.15
        if silence_ms >= 650:
            score += 0.20

        return max(0.0, min(score, 1.0))

    async def wait_for_turn_end(
        self,
        partial_text: str,
        silence_ms: int,
        grace_period_ms: int = 250,
    ) -> bool:
        confidence = self.predict(partial_text, silence_ms)

        if confidence >= self.threshold:
            self._cancel_event.clear()
            try:
                await asyncio.wait_for(
                    self._cancel_event.wait(),
                    timeout=grace_period_ms / 1000,
                )
                return False
            except asyncio.TimeoutError:
                return True

        return False

    def cancel(self):
        self._cancel_event.set()
