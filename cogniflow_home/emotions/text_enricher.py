"""
Text enrichment for emotional TTS rendering.
Preprocesses LLM output to enhance prosody cues before sending to Bulbul V3.

Based on: Bulbul V3 documentation — the model's internal LLM reads
punctuation and disfluency words as prosody instructions.
"""

import re


class TextEnricher:
    """Enhance LLM output text with prosody cues for Sarvam Bulbul V3."""

    def enrich(self, text: str, emotion: str, intensity: float) -> str:
        text = self._clean_for_tts(text)
        if emotion != "neutral" and intensity >= 0.2:
            text = self._ensure_filler_pauses(text)
            text = self._add_emotion_markers(text, emotion, intensity)
            text = self._ensure_trail_offs(text)
        return text

    def _ensure_filler_pauses(self, text: str) -> str:
        text = re.sub(
            r'\b(um|hmm|uh|ah)\s+(so|well|okay|like|yeah|toh|achha)\b',
            r'\1... \2',
            text, flags=re.IGNORECASE
        )
        text = re.sub(
            r'\b(achha|haan|hmm|matlab)\s+(toh|so|dekhiye|basically)\b',
            r'\1... \2',
            text, flags=re.IGNORECASE
        )
        return text

    def _add_emotion_markers(self, text: str, emotion: str, intensity: float) -> str:
        if emotion in ("sad", "frustrated", "anxious") and intensity > 0.4:
            text = re.sub(
                r'\b(sorry|understand|hear that|tough|difficult|mushkil)\b',
                r'\1...',
                text, count=1, flags=re.IGNORECASE
            )

        if emotion == "happy" and intensity > 0.5:
            if "!" not in text and len(text) < 80:
                text = re.sub(r'^([^.!?]+)', r'\1!', text, count=1)

        return text

    def _ensure_trail_offs(self, text: str) -> str:
        trail_off_phrases = [
            "so yeah", "you know", "and stuff", "and all",
            "basically", "waise bhi", "and that",
        ]
        for phrase in trail_off_phrases:
            if text.rstrip().lower().endswith(phrase):
                text = text.rstrip() + "..."
                break
        return text

    def _clean_for_tts(self, text: str) -> str:
        text = re.sub(r'[*_#`]', '', text)
        text = re.sub(r'\s{2,}', ' ', text)
        text = re.sub(r'\.{4,}', '...', text)
        return text.strip()
