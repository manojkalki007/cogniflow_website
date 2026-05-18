"""
Emotion-aware TTS adapter — single source of truth for caller emotion.

1. Agent template sets baseline (voice, temperature, pace)
2. Sentiment detector reads caller emotion from last transcript
3. This adapter merges baseline + real-time adjustments
4. Produces provider-specific TTS params (Sarvam, ElevenLabs, Smallest)
"""

import logging

from cogniflow_home.emotions.profiles import get_emotion_profile
from cogniflow_home.emotions.sentiment import detect_emotion, CallerEmotion

logger = logging.getLogger("cogniflow_home.emotions.tts_adapter")


# ElevenLabs emotion → voice_settings mapping
# stability: lower = more expressive, higher = more stable/monotone
# style: higher = more stylistic expression
ELEVENLABS_EMOTION_PARAMS = {
    "frustrated": {"stability": 0.35, "style": 0.2},
    "happy":      {"stability": 0.4,  "style": 0.6},
    "neutral":    {"stability": 0.5,  "style": 0.3},
    "angry":      {"stability": 0.6,  "style": 0.1},
    "confused":   {"stability": 0.45, "style": 0.2},
    "sad":        {"stability": 0.4,  "style": 0.15},
    "anxious":    {"stability": 0.45, "style": 0.2},
}

# SmallestTTS emotion → speed mapping
SMALLEST_EMOTION_SPEED = {
    "frustrated": 0.90,
    "happy":      1.05,
    "neutral":    1.0,
    "angry":      0.85,
    "confused":   0.90,
    "sad":        0.85,
    "anxious":    0.92,
}


class EmotionTTSAdapter:
    """
    Single source of truth for caller emotion state.
    Produces provider-specific TTS kwargs for Sarvam, ElevenLabs, and Smallest.

    Does NOT own a TTS instance — the pipeline keeps its own.
    """

    def __init__(self, template_type: str = "friendly", gender: str = "female"):
        self.profile = get_emotion_profile(template_type)
        tts_config = self.profile["tts"]

        if gender == "male":
            self.voice = tts_config.get("voice_male", tts_config["voice"])
        else:
            self.voice = tts_config.get("voice_female", tts_config["voice"])

        self.baseline_temperature = tts_config["temperature"]
        self.baseline_pace = tts_config["pace"]
        self.current_emotion = CallerEmotion("neutral", 0.5, {})

    def update_caller_emotion(self, transcript: str):
        """Detect emotion from transcript. This is the single source of truth."""
        detected = detect_emotion(transcript)
        if detected.confidence >= 0.3:
            if detected.emotion != self.current_emotion.emotion:
                logger.info(
                    f"Caller emotion: {self.current_emotion.emotion} -> "
                    f"{detected.emotion} (conf={detected.confidence:.2f})"
                )
            self.current_emotion = detected

    def get_tts_kwargs(self) -> dict:
        """Returns kwargs for SarvamTTS.synthesize() (temperature, pace, voice)."""
        adjustments = self.current_emotion.tts_adjustments
        confidence = self.current_emotion.confidence

        temperature = self.baseline_temperature
        pace = self.baseline_pace

        if adjustments:
            adj_temp = adjustments.get("temperature", self.baseline_temperature)
            adj_pace = adjustments.get("pace", self.baseline_pace)
            weight = min(confidence, 0.7)
            temperature = self.baseline_temperature * (1 - weight) + adj_temp * weight
            pace = self.baseline_pace * (1 - weight) + adj_pace * weight

        return {
            "temperature": round(max(0.01, min(1.0, temperature)), 2),
            "pace": round(max(0.5, min(2.0, pace)), 2),
            "voice": self.voice,
        }

    def get_elevenlabs_kwargs(self) -> dict:
        """Returns emotion-derived kwargs for ElevenLabsTTS.synthesize()."""
        emotion = self.current_emotion.emotion
        params = ELEVENLABS_EMOTION_PARAMS.get(emotion, ELEVENLABS_EMOTION_PARAMS["neutral"])
        return {
            "stability": params["stability"],
            "style": params["style"],
            "speed": self.baseline_pace,
        }

    def get_smallest_kwargs(self) -> dict:
        """Returns emotion-derived kwargs for SmallestTTS.synthesize()."""
        emotion = self.current_emotion.emotion
        speed = SMALLEST_EMOTION_SPEED.get(emotion, 1.0)
        return {"speed": speed}

    def get_llm_emotion_instructions(self) -> str:
        return self.profile.get("llm_emotion_instructions", "")

    def get_caller_emotion_prompt(self) -> str:
        emotion = self.current_emotion.emotion
        if emotion == "neutral":
            return ""
        return (
            f"\nCURRENT CALLER STATE: The caller sounds {emotion}.\n"
            "Adjust your tone accordingly:\n"
            "- frustrated: be extra patient and empathetic, acknowledge first\n"
            "- happy: match their energy, be enthusiastic\n"
            "- confused: slow down, explain simply, check understanding\n"
            "- sad: be gentle and respectful, don't rush\n"
            "- angry: stay calm, don't get defensive, acknowledge their frustration\n"
            "- anxious: be reassuring, give clear information, reduce uncertainty\n"
        )

    def get_emotion_state(self) -> dict:
        params = self.get_tts_kwargs()
        return {
            "caller_emotion": self.current_emotion.emotion,
            "confidence": self.current_emotion.confidence,
            "tts_temperature": params["temperature"],
            "tts_pace": params["pace"],
            "voice": self.voice,
            "profile": self.profile["description"],
        }
