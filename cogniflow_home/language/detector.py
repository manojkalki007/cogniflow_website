"""
Real-time language detection on streaming STT output.
Detects when the caller switches language and triggers provider swaps.

Design: high-precision, low-recall — only switch when confident.
False switches are far worse than missed switches.
"""

import logging

logger = logging.getLogger(__name__)

# Words that exist in both English and Hindi/other languages — EXCLUDED
_AMBIGUOUS = {'hi', 'par', 'se', 'ka', 'ki', 'ko', 'or', 'is', 'are', 'but', 'he', 'she', 'me'}

HINDI_MARKERS = {
    'kya', 'hai', 'hain', 'nahi', 'aur', 'bhi', 'toh', 'yeh', 'woh',
    'kaise', 'kab', 'kyun', 'accha', 'theek', 'haan', 'nahin',
    'chahiye', 'karna', 'batao', 'bataiye', 'dijiye', 'karke', 'wala',
    'abhi', 'pehle', 'baad', 'sab', 'kuch', 'bohot', 'bahut', 'zaroor',
    'aapka', 'mujhe', 'humko', 'unka', 'lekin', 'phir', 'jaise',
    'samajh', 'suniye', 'bolo', 'hum', 'tum', 'aap', 'iska',
} - _AMBIGUOUS

TAMIL_MARKERS = {
    'enna', 'eppo', 'inga', 'anga', 'naan', 'nee', 'avan', 'aval',
    'vaanga', 'ponga', 'sollunga', 'pannunga',
    'theriyum', 'theriyathu', 'illai', 'irukku', 'vendum',
    'romba', 'konjam', 'eppadi', 'yaarum', 'anga',
} - _AMBIGUOUS

TELUGU_MARKERS = {
    'emi', 'enti', 'ela', 'ikkada', 'akkada', 'nenu', 'nuvvu',
    'atanu', 'aame', 'cheppandi', 'randi',
    'teliyadu', 'undi', 'ledu', 'kaavali', 'emiti', 'chala',
} - _AMBIGUOUS

KANNADA_MARKERS = {
    'enu', 'yavaga', 'illi', 'alli', 'naanu', 'neenu', 'avanu',
    'avalu', 'heli', 'banni', 'gotilla', 'ide',
    'illa', 'beku', 'yeshtu', 'hege', 'yaake',
} - _AMBIGUOUS

LANGUAGE_MARKERS = {
    'hi': HINDI_MARKERS,
    'ta': TAMIL_MARKERS,
    'te': TELUGU_MARKERS,
    'kn': KANNADA_MARKERS,
}

_MIN_WORDS_FOR_DETECTION = 4
_MIN_MARKER_DENSITY = 0.3


class LanguageDetector:
    """Detect language from STT transcript text using word-level markers.

    High threshold: requires 5 consecutive non-English detections
    AND minimum marker density to avoid false switches.
    """

    def __init__(self, primary_language: str = "en"):
        self.primary_language = primary_language
        self.current_language = primary_language
        self._consecutive_detections: list[str] = []
        self._switch_threshold = 5

    def detect(self, text: str) -> str:
        words = text.lower().split()
        word_set = set(words)
        if len(words) < _MIN_WORDS_FOR_DETECTION:
            return self.current_language

        best_lang = "en"
        best_density = 0.0
        for lang_code, markers in LANGUAGE_MARKERS.items():
            overlap = word_set & markers
            if overlap:
                density = len(overlap) / len(words)
                if density > best_density and density >= _MIN_MARKER_DENSITY:
                    best_density = density
                    best_lang = lang_code

        return best_lang

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
