"""
Emotional mirroring — adapt agent voice and behavior based on caller sentiment.

Reads current emotion from EmotionTTSAdapter (single source of truth) and
provides prompt injection and escalation logic. Does NOT maintain its own
separate emotion state.
"""

import logging

logger = logging.getLogger(__name__)


# Prompt injection text keyed by emotion label from EmotionTTSAdapter.
EMOTION_PROMPTS = {
    "frustrated": (
        "The caller sounds frustrated. Respond with empathy. "
        "Acknowledge their frustration FIRST before solving. "
        "Use shorter sentences. Be clear and direct. "
        "Say things like 'I completely understand your frustration' "
        "or 'I'm sorry you're dealing with this.'"
    ),
    "angry": (
        "The caller is angry. Stay calm and professional. "
        "Do NOT match their energy. Acknowledge their feelings: "
        "'I hear you, and I want to help fix this right now.' "
        "Get to the solution quickly. Avoid filler phrases. "
        "If they curse, don't react — stay focused on resolution."
    ),
    "confused": (
        "The caller seems confused. Use simpler language. "
        "Break your answer into small steps. After each step, "
        "ask 'Does that make sense so far?' Don't overwhelm "
        "with information. One thing at a time."
    ),
    "happy": (
        "The caller is in a positive mood. Mirror their energy. "
        "It's okay to be conversational and warm. Use phrases like "
        "'That's great!' or 'Wonderful!' Be enthusiastic."
    ),
    "sad": (
        "The caller sounds sad or grieving. Be gentle, patient, "
        "and respectful. Don't rush. Acknowledge their feelings: "
        "'I'm really sorry to hear that.' Keep your tone soft."
    ),
    "anxious": (
        "The caller sounds anxious or worried. Be reassuring and "
        "give clear information. Reduce uncertainty: "
        "'Let me explain exactly what happens next.'"
    ),
    "neutral": "",
}


class EmotionalMirror:
    """Reads emotion from EmotionTTSAdapter and provides prompt injection + escalation logic.

    Does NOT own emotion state — EmotionTTSAdapter.current_emotion is the
    single source of truth. This class converts that into LLM prompt
    instructions and tracks escalation history.
    """

    def __init__(self):
        self.current_state = "neutral"
        self._negative_turn_count: int = 0

    def sync_from_adapter(self, emotion_label: str) -> None:
        """Called after EmotionTTSAdapter.update_caller_emotion() to keep in sync."""
        if emotion_label != self.current_state:
            logger.info(f"Emotional state changed: {self.current_state} -> {emotion_label}")
            self.current_state = emotion_label

        # Track consecutive negative turns for escalation
        if emotion_label in ("angry", "frustrated"):
            self._negative_turn_count += 1
        else:
            self._negative_turn_count = max(0, self._negative_turn_count - 1)

    def get_prompt_injection(self) -> str:
        return EMOTION_PROMPTS.get(self.current_state, "")

    def should_offer_human(self) -> bool:
        """Suggest human handoff after sustained negative emotion (5+ consecutive turns)."""
        return self._negative_turn_count >= 5
