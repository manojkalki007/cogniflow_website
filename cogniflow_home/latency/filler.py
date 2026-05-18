"""Filler audio manager.

Pre-synthesizes common filler phrases at startup so they can be
played instantly while tool calls execute. Perceived latency drops
to near zero for tool-heavy conversations.

Fillers are emotion-aware: when the caller is frustrated, angry, etc.,
fillers acknowledge the emotion. Pre-cached audio covers neutral fillers;
emotion-specific fillers fall back to live TTS synthesis via get_filler_text().
"""

import logging
import random

logger = logging.getLogger("cogniflow_home.latency.filler")

# Default (neutral) fillers — pre-synthesized at startup
FILLERS = {
    "lookup": [
        "Let me check that for you.",
        "One moment while I pull that up.",
        "Let me look into that.",
    ],
    "booking": [
        "Let me check available times.",
        "One second, checking the calendar.",
    ],
    "payment": [
        "Processing that now.",
        "Let me handle that for you.",
    ],
    "general": [
        "Sure, give me just a moment.",
        "Absolutely, let me take care of that.",
        "One moment please.",
    ],
}

# Emotion-specific fillers — used at runtime via get_filler_text()
EMOTION_FILLERS = {
    "frustrated": {
        "general": [
            "I hear you, let me check on that.",
            "I understand, one moment please.",
        ],
        "lookup": [
            "I want to make sure I get this right for you.",
            "Let me look into that carefully.",
        ],
        "booking": [
            "Let me find the best option for you.",
            "I understand, checking available times now.",
        ],
        "payment": [
            "I want to get this sorted for you. One moment.",
            "Let me handle that right away.",
        ],
    },
    "happy": {
        "general": [
            "Great question! Let me check.",
            "Absolutely, one second!",
        ],
        "lookup": [
            "Oh nice, let me pull that up for you!",
            "Sure thing, checking now!",
        ],
        "booking": [
            "Awesome, let me check available times!",
            "Sure thing, pulling up the calendar!",
        ],
        "payment": [
            "Perfect, processing that now!",
            "Great, let me take care of that!",
        ],
    },
    "angry": {
        "general": [
            "I completely understand your concern. Let me help.",
            "I'm sorry about that. Let me look into this right away.",
        ],
        "lookup": [
            "I want to resolve this for you. Checking now.",
            "Let me get to the bottom of this.",
        ],
        "booking": [
            "I'm going to fix this for you. One moment.",
            "Let me find a solution right away.",
        ],
        "payment": [
            "I understand this is urgent. Processing now.",
            "Let me sort this out for you immediately.",
        ],
    },
    "confused": {
        "general": [
            "No worries, let me explain. One moment.",
            "Good question, let me check on that.",
        ],
        "lookup": [
            "Let me find the details so I can explain clearly.",
            "One moment, I'll get the specifics for you.",
        ],
        "booking": [
            "Let me walk you through the options.",
            "I'll check what's available and explain.",
        ],
        "payment": [
            "Let me pull up the details so it's clear.",
            "One moment, I'll explain as I go.",
        ],
    },
    "sad": {
        "general": [
            "Of course, let me take care of that for you.",
            "I'm here to help. One moment.",
        ],
        "lookup": [
            "Let me look into that for you.",
            "I'll check on that right away.",
        ],
        "booking": [
            "Let me see what works best for you.",
            "I'll check what's available.",
        ],
        "payment": [
            "Let me handle that for you.",
            "I'll take care of this.",
        ],
    },
    "anxious": {
        "general": [
            "Don't worry, let me check on that.",
            "I'll find out for you right now.",
        ],
        "lookup": [
            "Let me get you a clear answer on that.",
            "I'll look into this so you know exactly where things stand.",
        ],
        "booking": [
            "Let me confirm the details for you.",
            "I'll check and make sure everything is set.",
        ],
        "payment": [
            "Let me verify that for you right now.",
            "I'll confirm the details so you're all set.",
        ],
    },
}

TOOL_CATEGORIES = {
    "lookup": ["lookup", "search", "get", "find", "check", "fetch"],
    "booking": ["book", "schedule", "appointment", "reserve"],
    "payment": ["pay", "charge", "invoice", "bill", "process"],
}


class FillerAudioManager:

    def __init__(self):
        self.cached_audio: dict[str, list[bytes]] = {}
        self._initialized = False
        self._current_emotion = "neutral"

    def set_emotion(self, emotion: str) -> None:
        """Update current emotion for filler selection."""
        self._current_emotion = emotion

    async def initialize(self, tts_engine):
        self.cached_audio = {}
        for category, phrases in FILLERS.items():
            self.cached_audio[category] = []
            for phrase in phrases:
                chunks = []
                try:
                    async for audio_chunk in tts_engine.synthesize(phrase):
                        chunks.append(audio_chunk)
                    if chunks:
                        self.cached_audio[category].append(b"".join(chunks))
                except Exception:
                    logger.warning(f"Failed to pre-synthesize filler: {phrase}")
        self._initialized = True
        total = sum(len(v) for v in self.cached_audio.values())
        logger.info(f"Filler audio initialized: {total} clips cached")

    def get_filler(self, tool_name: str) -> bytes | None:
        """Return pre-cached audio filler. Only available for neutral emotion."""
        if not self._initialized:
            return None
        # Pre-cached audio is neutral only; for non-neutral emotions return None
        # so the pipeline falls back to get_filler_text() + live TTS.
        if self._current_emotion not in ("neutral", ""):
            return None
        category = self._classify_tool(tool_name)
        fillers = self.cached_audio.get(category) or self.cached_audio.get("general", [])
        return random.choice(fillers) if fillers else None

    def get_filler_text(self, tool_name: str) -> str:
        """Return emotion-aware filler text for live TTS synthesis."""
        category = self._classify_tool(tool_name)
        emotion = self._current_emotion

        # Try emotion-specific fillers first
        if emotion in EMOTION_FILLERS:
            emotion_set = EMOTION_FILLERS[emotion]
            phrases = emotion_set.get(category) or emotion_set.get("general", [])
            if phrases:
                return random.choice(phrases)

        # Fall back to neutral fillers
        phrases = FILLERS.get(category, FILLERS["general"])
        return random.choice(phrases)

    def _classify_tool(self, tool_name: str) -> str:
        name_lower = tool_name.lower()
        for category, keywords in TOOL_CATEGORIES.items():
            if any(kw in name_lower for kw in keywords):
                return category
        return "general"
