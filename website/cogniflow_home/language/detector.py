"""
Real-time language detection on streaming STT output.
Detects when the caller switches language and triggers provider swaps.
"""

import logging

logger = logging.getLogger(__name__)

HINDI_MARKERS = {
    'kya', 'hai', 'hain', 'mein', 'nahi', 'aur', 'ka', 'ki', 'ko',
    'se', 'par', 'bhi', 'toh', 'yeh', 'woh', 'kaise', 'kab',
    'kyun', 'accha', 'theek', 'haan', 'nahin', 'chahiye', 'karna',
    'batao', 'bataiye', 'dijiye', 'karke', 'wala', 'abhi', 'pehle',
    'baad', 'sab', 'kuch', 'bohot', 'bahut', 'zaroor',
}

TAMIL_MARKERS = {
    'enna', 'eppo', 'inga', 'anga', 'naan', 'nee', 'avan', 'aval',
    'oru', 'iru', 'vaanga', 'ponga', 'sollunga', 'pannunga',
    'theriyum', 'theriyathu', 'illai', 'irukku', 'vendum',
}

TELUGU_MARKERS = {
    'emi', 'enti', 'ela', 'ikkada', 'akkada', 'nenu', 'nuvvu',
    'atanu', 'aame', 'oka', 'rendu', 'cheppandi', 'randi',
    'teliyadu', 'undi', 'ledu', 'kaavali',
}

KANNADA_MARKERS = {
    'enu', 'yavaga', 'illi', 'alli', 'naanu', 'neenu', 'avanu',
    'avalu', 'ondu', 'eradu', 'heli', 'banni', 'gotilla', 'ide',
    'illa', 'beku',
}

LANGUAGE_MARKERS = {
    'hi': HINDI_MARKERS,
    'ta': TAMIL_MARKERS,
    'te': TELUGU_MARKERS,
    'kn': KANNADA_MARKERS,
}


class LanguageDetector:
    """Detect language from STT transcript text using word-level markers (~1ms)."""

    def __init__(self, primary_language: str = "en"):
        self.primary_language = primary_language
        self.current_language = primary_language
        self._consecutive_detections: list[str] = []
        self._switch_threshold = 3

    def detect(self, text: str) -> str:
        words = set(text.lower().split())
        if not words:
            return self.current_language

        scores: dict[str, int] = {"en": 0}
        for lang_code, markers in LANGUAGE_MARKERS.items():
            overlap = words & markers
            if overlap:
                scores[lang_code] = len(overlap)

        if not any(v > 0 for k, v in scores.items() if k != "en"):
            scores["en"] = len(words)

        detected = max(scores, key=lambda k: scores[k])
        return detected

    def should_switch(self, text: str) -> str | None:
        detected = self.detect(text)

        if detected == self.current_language:
            self._consecutive_detections.clear()
            return None

        self._consecutive_detections.append(detected)

        if len(self._consecutive_detections) >= self._switch_threshold:
            recent = self._consecutive_detections[-self._switch_threshold:]
            if all(lang == recent[0] for lang in recent):
                new_lang = recent[0]
                self.current_language = new_lang
                self._consecutive_detections.clear()
                logger.info(f"Language switch detected: → {new_lang}")
                return new_lang

        return None


class LanguageRouter:
    """Route to appropriate STT/TTS providers based on detected language."""

    PROVIDER_MAP = {
        "en": {
            "stt": "deepgram",
            "tts": "smallest",
            "stt_config": {"model": "nova-3", "language": "en"},
            "tts_config": {"language": "en"},
        },
        "hi": {
            "stt": "sarvam",
            "tts": "sarvam",
            "stt_config": {"language_code": "hi-IN"},
            "tts_config": {"target_language_code": "hi-IN"},
        },
        "ta": {
            "stt": "sarvam",
            "tts": "sarvam",
            "stt_config": {"language_code": "ta-IN"},
            "tts_config": {"target_language_code": "ta-IN"},
        },
        "te": {
            "stt": "sarvam",
            "tts": "sarvam",
            "stt_config": {"language_code": "te-IN"},
            "tts_config": {"target_language_code": "te-IN"},
        },
        "kn": {
            "stt": "sarvam",
            "tts": "sarvam",
            "stt_config": {"language_code": "kn-IN"},
            "tts_config": {"target_language_code": "kn-IN"},
        },
    }

    def get_providers(self, language: str) -> dict:
        return self.PROVIDER_MAP.get(language, self.PROVIDER_MAP["en"])
