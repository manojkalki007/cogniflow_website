"""
Real-time caller sentiment detection.
Runs on every STT final transcript to detect caller emotion.
Lightweight keyword + pattern matching — runs in <1ms.
"""

import re
from dataclasses import dataclass


@dataclass
class CallerEmotion:
    emotion: str
    confidence: float
    tts_adjustments: dict


EMOTION_PATTERNS = {
    "frustrated": {
        "keywords": [
            "not working", "doesn't work", "problem", "issue", "wrong",
            "again", "still", "already told", "how many times", "ridiculous",
            "unacceptable", "waste of time", "useless", "terrible", "worst",
            "kaam nahi kar raha", "problem hai", "phir se", "kitni baar",
            "bakwaas", "bekar", "kharab",
        ],
        "patterns": [
            r"why (can't|won't|isn't|doesn't)",
            r"i('ve| have) (been|already)",
            r"this is (so |really )?(frustrating|annoying|ridiculous)",
        ],
        "tts_adjustments": {
            "temperature": 0.55,
            "pace": 0.90,
        },
    },
    "happy": {
        "keywords": [
            "great", "awesome", "perfect", "wonderful", "thank you so much",
            "love it", "amazing", "fantastic", "excellent", "brilliant",
            "bahut accha", "shandar", "mast", "shukriya", "bahut badiya",
            "wah", "kya baat", "zabardast",
        ],
        "patterns": [
            r"(that's |this is )(great|perfect|awesome|amazing)",
            r"thank(s| you)( so much)?",
        ],
        "tts_adjustments": {
            "temperature": 0.75,
            "pace": 1.10,
        },
    },
    "confused": {
        "keywords": [
            "don't understand", "confused", "what do you mean", "not sure",
            "can you explain", "what", "how does", "sorry what",
            "samajh nahi aaya", "kya matlab", "confuse", "phir se batao",
            "clear nahi hua",
        ],
        "patterns": [
            r"(what|how|why) (do|does|is|are|did)",
            r"i (don't|do not) (understand|get|follow)",
            r"can you (repeat|explain|say that again)",
        ],
        "tts_adjustments": {
            "temperature": 0.55,
            "pace": 0.90,
        },
    },
    "sad": {
        "keywords": [
            "passed away", "died", "lost", "unfortunately", "bad news",
            "cancer", "hospital", "accident", "sorry to say",
            "guzar gaye", "kho diya", "bura", "dukh", "hospital mein",
        ],
        "patterns": [
            r"(passed away|no more|lost (my|our))",
            r"(diagnosed with|suffering from)",
        ],
        "tts_adjustments": {
            "temperature": 0.50,
            "pace": 0.85,
        },
    },
    "angry": {
        "keywords": [
            "outrageous", "scam", "fraud", "cheat", "liar", "sue",
            "complaint", "manager", "supervisor", "escalate",
            "dhokha", "fraud", "pagal", "complaint karunga",
            "manager se baat karo",
        ],
        "patterns": [
            r"(i want to|let me) (speak|talk) to (a |your )?(manager|supervisor)",
            r"(i('ll| will)|going to) (file|make) a complaint",
        ],
        "tts_adjustments": {
            "temperature": 0.45,
            "pace": 0.88,
        },
    },
    "anxious": {
        "keywords": [
            "worried", "nervous", "scared", "afraid", "what if",
            "will it", "is it safe", "guarantee",
            "chinta", "darr", "tension", "kya hoga", "safe hai",
        ],
        "patterns": [
            r"(what if|will (it|this))",
            r"(is it|are you) (safe|sure|certain)",
            r"i('m| am) (worried|nervous|scared|anxious)",
        ],
        "tts_adjustments": {
            "temperature": 0.55,
            "pace": 0.92,
        },
    },
}


def detect_emotion(transcript: str) -> CallerEmotion:
    transcript_lower = transcript.lower().strip()

    if not transcript_lower or len(transcript_lower) < 3:
        return CallerEmotion("neutral", 0.5, {})

    scores = {}

    for emotion, config in EMOTION_PATTERNS.items():
        score = 0.0

        for keyword in config["keywords"]:
            if keyword.lower() in transcript_lower:
                score += 0.3

        for pattern in config["patterns"]:
            if re.search(pattern, transcript_lower, re.IGNORECASE):
                score += 0.5

        if score > 0:
            scores[emotion] = min(score, 1.0)

    if not scores:
        return CallerEmotion("neutral", 0.5, {})

    best_emotion = max(scores, key=scores.get)
    return CallerEmotion(
        emotion=best_emotion,
        confidence=scores[best_emotion],
        tts_adjustments=EMOTION_PATTERNS[best_emotion]["tts_adjustments"],
    )
