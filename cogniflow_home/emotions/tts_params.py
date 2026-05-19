"""
Dynamic TTS parameter calculation based on emotion state.
Maps emotion + intensity to Sarvam Bulbul V3 parameters.

Bulbul V3 controls:
  - temperature: 0.01-1.0 (prosody variation — higher = more expressive)
  - pace: 0.5-2.0 (speech speed)
  - voice: one of 37 speakers (each has natural emotional baseline)

NOT supported in V3: pitch, loudness
"""


EMOTION_TTS_MAP = {
    "neutral": {
        "temperature": 0.60,
        "pace": 1.00,
    },
    "frustrated": {
        "temperature": 0.50,
        "pace": 0.90,
    },
    "happy": {
        "temperature": 0.78,
        "pace": 1.10,
    },
    "confused": {
        "temperature": 0.55,
        "pace": 0.88,
    },
    "sad": {
        "temperature": 0.50,
        "pace": 0.85,
    },
    "angry": {
        "temperature": 0.45,
        "pace": 0.88,
    },
    "anxious": {
        "temperature": 0.55,
        "pace": 0.90,
    },
}

PROFILE_BASELINES = {
    "empathetic":        {"temperature": 0.65, "pace": 0.95},
    "energetic":         {"temperature": 0.75, "pace": 1.10},
    "professional":      {"temperature": 0.50, "pace": 0.95},
    "friendly":          {"temperature": 0.60, "pace": 1.00},
    "hinglish":          {"temperature": 0.70, "pace": 1.05},
    "hinglish_friendly": {"temperature": 0.70, "pace": 1.05},
}

VOICE_MAP = {
    "empathetic":        {"female": "kavya",  "male": "manan"},
    "energetic":         {"female": "ishita", "male": "amit"},
    "professional":      {"female": "shreya", "male": "ratan"},
    "friendly":          {"female": "priya",  "male": "aditya"},
    "hinglish":          {"female": "kavya",  "male": "manan"},
    "hinglish_friendly": {"female": "kavya",  "male": "manan"},
}


def get_tts_params(
    profile: str,
    caller_emotion: str,
    caller_intensity: float,
) -> dict:
    """
    Calculate TTS parameters by blending:
    1. Agent profile baseline (set once per agent)
    2. Real-time caller emotion adjustment

    Returns: {"temperature": float, "pace": float}
    """
    baseline = PROFILE_BASELINES.get(profile, PROFILE_BASELINES["friendly"])
    emotion_adj = EMOTION_TTS_MAP.get(caller_emotion, EMOTION_TTS_MAP["neutral"])

    weight = min(caller_intensity * 0.7, 0.6)

    temperature = baseline["temperature"] * (1 - weight) + emotion_adj["temperature"] * weight
    pace = baseline["pace"] * (1 - weight) + emotion_adj["pace"] * weight

    temperature = max(0.01, min(1.0, round(temperature, 2)))
    pace = max(0.5, min(2.0, round(pace, 2)))

    return {"temperature": temperature, "pace": pace}
