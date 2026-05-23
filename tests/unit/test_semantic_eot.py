"""Unit tests for SemanticEOTDetector (cogniflow_home/latency/eot.py).

Pure unit tests -- no external deps required.
The eot module only imports asyncio and re.
"""

import pytest

from cogniflow_home.latency.eot import SemanticEOTDetector


class TestSemanticEOTDetector:
    def test_question_scores_above_threshold(self):
        det = SemanticEOTDetector()
        # "Can you book me an appointment?" has:
        #   "?" -> +0.40
        #   word count 6 >= 5 -> +0.10
        #   "can" question word + "?" -> +0.15
        # total = 0.65, which meets threshold
        score = det.predict("Can you book me an appointment?", silence_ms=80)
        assert score >= 0.65

    def test_incomplete_phrase_low_score(self):
        det = SemanticEOTDetector()
        # "I want to" -- no punctuation, 3 words, no turn-final
        score = det.predict("I want to", silence_ms=80)
        assert score < 0.65

    def test_silence_bonus_increases_score(self):
        det = SemanticEOTDetector()
        score_low = det.predict("I want to", silence_ms=80)
        score_high = det.predict("I want to", silence_ms=500)
        # 500ms silence adds +0.15 (>=300ms) + 0.20 (>=500ms) = +0.35
        assert score_high > score_low

    def test_turn_final_hindi_positive_but_below_threshold(self):
        det = SemanticEOTDetector()
        # "theek hai" is in TURN_FINALS -> +0.25
        # word count 2 (not < 2, so proceeds)
        # no punctuation, no question word, < 5 words
        # score = 0.25
        score = det.predict("theek hai", silence_ms=80)
        assert score > 0
        assert score < 0.65

    def test_single_word_returns_zero(self):
        det = SemanticEOTDetector()
        # "um" -> 1 word, which is < 2 -> returns 0.0
        score = det.predict("um", silence_ms=80)
        assert score == 0.0

    def test_incomplete_suffix_penalty(self):
        det = SemanticEOTDetector()
        # "I want to book but" ends with "but" (INCOMPLETE_SUFFIX -> -0.30)
        # 5 words >= 5 -> +0.10, but "but" penalty -> -0.30
        # net is low or zero (max(0.0, ...))
        score = det.predict("I want to book but", silence_ms=200)
        # Even with 200ms silence (no bonus -- need >=300), score should be low
        assert score < 0.65
