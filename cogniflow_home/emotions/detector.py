"""
Real-time caller emotion detection with intensity tracking.
Lightweight keyword + pattern matching — runs in <1ms.
Returns emotion type + intensity (0.0 to 1.0).

Based on: "Humane Speech Synthesis" (arxiv 2404.01339)
Key insight: emotion detection must feed into LLM context
so the LLM generates emotionally-appropriate text with
disfluencies in the right places.
"""

import re
from dataclasses import dataclass


@dataclass
class EmotionState:
    emotion: str      # frustrated, happy, confused, sad, angry, anxious, neutral
    intensity: float  # 0.0 (barely detectable) to 1.0 (very strong)

    def to_context_string(self) -> str:
        if self.emotion == "neutral":
            return ""
        intensity_word = (
            "slightly" if self.intensity < 0.4
            else "noticeably" if self.intensity < 0.7
            else "very"
        )
        return f"The caller sounds {intensity_word} {self.emotion}."


PATTERNS = {
    "frustrated": {
        "keywords": [
            "not working", "doesn't work", "problem", "issue", "wrong",
            "again", "still", "already told", "how many times", "ridiculous",
            "unacceptable", "waste", "useless", "terrible", "worst",
            "kaam nahi", "problem hai", "phir se", "kitni baar", "bakwaas",
        ],
        "strong_signals": [
            r"(how many|kitni) (times|baar)",
            r"this is (so |really )?(frustrating|annoying|ridiculous)",
            r"i('ve| have) (been |already )(told|called|tried)",
        ],
    },
    "happy": {
        "keywords": [
            "great", "awesome", "perfect", "wonderful", "thank you",
            "love it", "amazing", "fantastic", "excellent", "brilliant",
            "bahut accha", "shandar", "mast", "bahut badiya", "wah",
        ],
        "strong_signals": [
            r"(that's |this is )(great|perfect|awesome|amazing)",
            r"thank(s| you)( so much)",
        ],
    },
    "confused": {
        "keywords": [
            "don't understand", "confused", "what do you mean", "not sure",
            "can you explain", "sorry what", "come again",
            "samajh nahi", "kya matlab", "phir se batao", "clear nahi",
        ],
        "strong_signals": [
            r"i (don't|do not) (understand|get|follow)",
            r"can you (repeat|explain|say that again)",
            r"what (do|does|is) that mean",
        ],
    },
    "sad": {
        "keywords": [
            "passed away", "died", "lost", "unfortunately", "bad news",
            "cancer", "hospital", "accident", "sorry to say",
            "guzar gaye", "kho diya", "bura hua",
        ],
        "strong_signals": [
            r"(passed away|no more|lost (my|our))",
            r"(diagnosed with|suffering from)",
        ],
    },
    "angry": {
        "keywords": [
            "outrageous", "scam", "fraud", "cheat", "liar", "sue",
            "complaint", "manager", "supervisor", "escalate",
            "dhokha", "fraud hai", "complaint karunga",
        ],
        "strong_signals": [
            r"(speak|talk) to .*(manager|supervisor)",
            r"(file|make) a complaint",
            r"(going to|will) sue",
        ],
    },
    "anxious": {
        "keywords": [
            "worried", "nervous", "scared", "afraid", "what if",
            "is it safe", "guarantee", "are you sure",
            "chinta", "darr", "tension", "kya hoga",
        ],
        "strong_signals": [
            r"what if .*(go wrong|doesn't work|fail)",
            r"i('m| am) (worried|nervous|scared|anxious)",
        ],
    },
}


class EmotionDetector:
    """
    Detect caller emotion from transcript.
    Maintains a smoothed emotion state across turns
    (emotions don't flip instantly — they decay gradually).
    Also tracks consecutive negative turns for escalation.
    """

    def __init__(self):
        self.current = EmotionState("neutral", 0.0)
        self._history: list[EmotionState] = []
        self._decay_rate = 0.3
        self._negative_turn_count = 0

    def detect(self, transcript: str) -> EmotionState:
        text = transcript.lower().strip()
        if not text or len(text) < 3:
            return self.current

        scores: dict[str, float] = {}
        for emotion, config in PATTERNS.items():
            score = 0.0
            for kw in config["keywords"]:
                if kw in text:
                    score += 0.15
            for pattern in config["strong_signals"]:
                if re.search(pattern, text, re.IGNORECASE):
                    score += 0.35
            if score > 0:
                scores[emotion] = min(score, 1.0)

        if not scores:
            new_intensity = self.current.intensity * (1 - self._decay_rate)
            if new_intensity < 0.1:
                self.current = EmotionState("neutral", 0.0)
            else:
                self.current = EmotionState(self.current.emotion, new_intensity)
            self._update_escalation()
            return self.current

        best = max(scores, key=scores.get)
        raw_intensity = scores[best]

        if best == self.current.emotion:
            smoothed = min(1.0, self.current.intensity * 0.5 + raw_intensity * 0.5)
        else:
            if raw_intensity > 0.3:
                smoothed = raw_intensity * 0.7
            else:
                return self.current

        self.current = EmotionState(best, round(smoothed, 2))
        self._history.append(self.current)
        self._update_escalation()
        return self.current

    def _update_escalation(self):
        if self.current.emotion in ("angry", "frustrated"):
            self._negative_turn_count += 1
        else:
            self._negative_turn_count = max(0, self._negative_turn_count - 1)

    def should_offer_human(self) -> bool:
        return self._negative_turn_count >= 5
