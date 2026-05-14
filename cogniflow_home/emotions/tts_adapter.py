"""
Emotion-aware TTS adapter.
Wraps SarvamTTS with emotion-based parameter adjustments.

1. Agent template sets baseline (voice, temperature, pace)
2. Sentiment detector reads caller emotion from last transcript
3. This adapter merges baseline + real-time adjustments
4. Sends the final parameters to Sarvam Bulbul v3
"""

import re
import logging

from cogniflow_home.emotions.profiles import get_emotion_profile
from cogniflow_home.emotions.sentiment import detect_emotion, CallerEmotion

logger = logging.getLogger("cogniflow_home.emotions.tts_adapter")


class EmotionTTSAdapter:
    """
    Manages emotion state and produces TTS kwargs (temperature, pace, voice)
    for the pipeline's existing SarvamTTS instance.

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
        detected = detect_emotion(transcript)
        if detected.confidence >= 0.3:
            if detected.emotion != self.current_emotion.emotion:
                logger.info(
                    f"Caller emotion: {self.current_emotion.emotion} -> "
                    f"{detected.emotion} (conf={detected.confidence:.2f})"
                )
            self.current_emotion = detected

    def get_tts_kwargs(self) -> dict:
        """Returns kwargs to pass to SarvamTTS.synthesize()."""
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

    def add_prosody_hints(self, text: str) -> str:
        text = re.sub(r'\b(um|hmm|uh|ah)\s+(so|well|okay|like|yeah)\b',
                      r'\1... \2', text, flags=re.IGNORECASE)
        text = re.sub(r'\b(achha|haan|hmm)\s+(toh|so|dekhiye)\b',
                      r'\1... \2', text, flags=re.IGNORECASE)

        if self.current_emotion.emotion in ("sad", "frustrated", "anxious"):
            text = re.sub(
                r'(sorry|understand|hear that|tough|difficult)',
                r'\1...',
                text, count=1, flags=re.IGNORECASE
            )

        return text

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
