"""
Emotional mirroring — adapt agent voice and behavior based on caller sentiment.
"""

import logging

logger = logging.getLogger(__name__)


class EmotionalMirror:
    """Adapt agent behavior based on detected caller emotion."""

    EMOTION_PRESETS = {
        "frustrated": {
            "tts_speed": 0.95,
            "tts_emotion": ["calmness:high", "empathy:high"],
            "prompt_injection": (
                "The caller sounds frustrated. Respond with empathy. "
                "Acknowledge their frustration FIRST before solving. "
                "Use shorter sentences. Be clear and direct. "
                "Say things like 'I completely understand your frustration' "
                "or 'I'm sorry you're dealing with this.'"
            ),
        },
        "angry": {
            "tts_speed": 0.95,
            "tts_emotion": ["calmness:highest", "empathy:high"],
            "prompt_injection": (
                "The caller is angry. Stay calm and professional. "
                "Do NOT match their energy. Acknowledge their feelings: "
                "'I hear you, and I want to help fix this right now.' "
                "Get to the solution quickly. Avoid filler phrases. "
                "If they curse, don't react — stay focused on resolution."
            ),
        },
        "confused": {
            "tts_speed": 0.95,
            "tts_emotion": ["calmness:high", "positivity:medium"],
            "prompt_injection": (
                "The caller seems confused. Use simpler language. "
                "Break your answer into small steps. After each step, "
                "ask 'Does that make sense so far?' Don't overwhelm "
                "with information. One thing at a time."
            ),
        },
        "happy": {
            "tts_speed": 1.05,
            "tts_emotion": ["positivity:high", "enthusiasm:medium"],
            "prompt_injection": (
                "The caller is in a positive mood. Mirror their energy. "
                "It's okay to be conversational and warm. Use phrases like "
                "'That's great!' or 'Wonderful!' Be enthusiastic."
            ),
        },
        "neutral": {
            "tts_speed": 1.0,
            "tts_emotion": ["positivity:medium"],
            "prompt_injection": "",
        },
    }

    def __init__(self):
        self.current_state = "neutral"
        self._sentiment_history: list[float] = []

    def update(self, sentiment_score: float) -> str:
        self._sentiment_history.append(sentiment_score)
        if len(self._sentiment_history) > 100:
            self._sentiment_history = self._sentiment_history[-50:]
        recent = self._sentiment_history[-5:]
        avg = sum(recent) / len(recent)

        if avg < 0.2:
            new_state = "angry"
        elif avg < 0.35:
            new_state = "frustrated"
        elif avg < 0.45:
            new_state = "confused"
        elif avg > 0.75:
            new_state = "happy"
        else:
            new_state = "neutral"

        if new_state != self.current_state:
            logger.info(f"Emotional state changed: {self.current_state} → {new_state}")
            self.current_state = new_state

        return new_state

    def get_tts_params(self) -> dict:
        preset = self.EMOTION_PRESETS.get(self.current_state, self.EMOTION_PRESETS["neutral"])
        return {
            "speed": preset["tts_speed"],
            "emotion": preset["tts_emotion"],
        }

    def get_prompt_injection(self) -> str:
        preset = self.EMOTION_PRESETS.get(self.current_state, self.EMOTION_PRESETS["neutral"])
        return preset["prompt_injection"]

    def should_offer_human(self) -> bool:
        if len(self._sentiment_history) < 15:
            return False
        recent = self._sentiment_history[-15:]
        avg = sum(recent) / len(recent)
        return avg < 0.25
