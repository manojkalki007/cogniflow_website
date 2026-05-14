"""Filler audio manager.

Pre-synthesizes common filler phrases at startup so they can be
played instantly while tool calls execute. Perceived latency drops
to near zero for tool-heavy conversations.
"""

import logging
import random

logger = logging.getLogger("cogniflow_home.latency.filler")

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

TOOL_CATEGORIES = {
    "lookup": ["lookup", "search", "get", "find", "check", "fetch"],
    "booking": ["book", "schedule", "appointment", "reserve"],
    "payment": ["pay", "charge", "invoice", "bill", "process"],
}


class FillerAudioManager:

    def __init__(self):
        self.cached_audio: dict[str, list[bytes]] = {}
        self._initialized = False

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
        if not self._initialized:
            return None
        category = self._classify_tool(tool_name)
        fillers = self.cached_audio.get(category) or self.cached_audio.get("general", [])
        return random.choice(fillers) if fillers else None

    def get_filler_text(self, tool_name: str) -> str:
        category = self._classify_tool(tool_name)
        phrases = FILLERS.get(category, FILLERS["general"])
        return random.choice(phrases)

    def _classify_tool(self, tool_name: str) -> str:
        name_lower = tool_name.lower()
        for category, keywords in TOOL_CATEGORIES.items():
            if any(kw in name_lower for kw in keywords):
                return category
        return "general"
