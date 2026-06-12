"""
Emotion-aware TTS adapter — single source of truth for caller emotion.

Uses the intensity-based EmotionDetector and research-backed TTS params.
1. Agent template sets baseline (voice, temperature, pace)
2. EmotionDetector reads caller emotion + intensity from transcript
3. tts_params blends baseline + real-time adjustments
4. Produces provider-specific TTS params (Sarvam, ElevenLabs, Smallest)
"""

import logging

from cogniflow_home.emotions.detector import EmotionDetector, EmotionState
from cogniflow_home.emotions.profiles import get_emotion_profile
from cogniflow_home.emotions.tts_params import get_tts_params

logger = logging.getLogger("cogniflow_home.emotions.tts_adapter")


ELEVENLABS_EMOTION_PARAMS = {
    "frustrated": {"stability": 0.35, "style": 0.2},
    "happy":      {"stability": 0.4,  "style": 0.6},
    "neutral":    {"stability": 0.5,  "style": 0.3},
    "angry":      {"stability": 0.6,  "style": 0.1},
    "confused":   {"stability": 0.45, "style": 0.2},
    "sad":        {"stability": 0.4,  "style": 0.15},
    "anxious":    {"stability": 0.45, "style": 0.2},
}

SMALLEST_EMOTION_SPEED = {
    "frustrated": 1.20,
    "happy":      1.35,
    "neutral":    1.30,
    "angry":      1.15,
    "confused":   1.20,
    "sad":        1.10,
    "anxious":    1.20,
}


class EmotionTTSAdapter:
    """
    Single source of truth for caller emotion state.
    Wraps EmotionDetector (intensity-based) and produces provider-specific TTS kwargs.
    """

    def __init__(self, template_type: str = "friendly", gender: str = "female"):
        self.profile = get_emotion_profile(template_type)
        self._profile_name = template_type
        tts_config = self.profile["tts"]

        if gender == "male":
            self.voice = tts_config.get("voice_male", tts_config["voice"])
        else:
            self.voice = tts_config.get("voice_female", tts_config["voice"])

        self.emotion_detector = EmotionDetector()

    @property
    def current_emotion(self) -> EmotionState:
        return self.emotion_detector.current

    def update_caller_emotion(self, transcript: str):
        prev = self.emotion_detector.current
        detected = self.emotion_detector.detect(transcript)
        if detected.emotion != prev.emotion:
            logger.info(
                f"Caller emotion: {prev.emotion} -> "
                f"{detected.emotion} (intensity={detected.intensity:.2f})"
            )

    def get_tts_kwargs(self) -> dict:
        """Returns kwargs for SarvamTTS.synthesize() (temperature, pace). Voice is NOT overridden here — the TTS instance already has the agent-configured voice."""
        state = self.emotion_detector.current
        return get_tts_params(self._profile_name, state.emotion, state.intensity)

    def get_elevenlabs_kwargs(self) -> dict:
        emotion = self.emotion_detector.current.emotion
        params = ELEVENLABS_EMOTION_PARAMS.get(emotion, ELEVENLABS_EMOTION_PARAMS["neutral"])
        return {
            "stability": params["stability"],
            "style": params["style"],
            "speed": self.profile["tts"]["pace"],
        }

    def get_smallest_kwargs(self) -> dict:
        emotion = self.emotion_detector.current.emotion
        speed = SMALLEST_EMOTION_SPEED.get(emotion, 1.0)
        return {"speed": speed}

    def get_llm_emotion_instructions(self) -> str:
        return self.profile.get("llm_emotion_instructions", "")

    def should_offer_human(self) -> bool:
        return self.emotion_detector.should_offer_human()

    def get_emotion_state(self) -> dict:
        state = self.emotion_detector.current
        params = self.get_tts_kwargs()
        return {
            "caller_emotion": state.emotion,
            "intensity": state.intensity,
            "tts_temperature": params["temperature"],
            "tts_pace": params["pace"],
            "voice": self.voice,
            "profile": self.profile["description"],
        }
