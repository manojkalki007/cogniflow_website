"""Unit tests for EmotionDetector (cogniflow_home/emotions/detector.py).

Pure unit tests -- no external deps required.
The detector module only imports re and dataclasses.
"""

import pytest

from cogniflow_home.emotions.detector import EmotionDetector, EmotionState


class TestEmotionDetectorInit:
    def test_creates_instance_with_neutral_state(self):
        det = EmotionDetector()
        assert det.current == EmotionState("neutral", 0.0)
        assert det.current.emotion == "neutral"
        assert det.current.intensity == 0.0


class TestEmotionDetectorDetect:
    def test_frustrated_english(self):
        det = EmotionDetector()
        # "not working" keyword (+0.15) + "again" keyword (+0.15) = 0.30
        # strong_signal "how many times" -> +0.35 = 0.65
        result = det.detect("how many times do I have to call, it is not working again")
        assert result.emotion == "frustrated"
        assert result.intensity > 0.3

    def test_frustrated_hinglish(self):
        det = EmotionDetector()
        result = det.detect("kitni baar call kiya kaam nahi ho raha")
        assert result.emotion == "frustrated"
        assert result.intensity > 0.3

    def test_happy_english(self):
        det = EmotionDetector()
        result = det.detect("oh that's amazing, thank you so much!")
        assert result.emotion == "happy"
        assert result.intensity > 0.4

    def test_short_neutral_stays_neutral(self):
        det = EmotionDetector()
        result = det.detect("yes")
        # "yes" is only 3 chars, passes the len<3 check (len("yes")==3, not <3)
        # but no keywords match, so scores dict is empty -> decay from neutral 0.0
        # intensity decays to 0.0 * 0.7 = 0.0 -> stays neutral
        assert result.emotion == "neutral"

    def test_smoothing_does_not_flip_instantly(self):
        det = EmotionDetector()
        # First: strong frustration signal
        # "this is really frustrating" matches strong_signal (+0.35)
        # + "not working" keyword (+0.15) -> raw = 0.50
        r1 = det.detect("this is really frustrating, not working at all")
        assert r1.emotion == "frustrated"
        prev_intensity = r1.intensity

        # Second: mild neutral input -- should NOT flip to neutral,
        # should stay frustrated with decayed intensity
        r2 = det.detect("okay fine")
        assert r2.emotion == "frustrated"
        assert r2.intensity < prev_intensity  # decayed
        assert r2.intensity > 0  # but not zero

    def test_angry_with_manager_request(self):
        det = EmotionDetector()
        result = det.detect("I want to speak to the manager right now")
        assert result.emotion == "angry"

    def test_anxious_worry(self):
        det = EmotionDetector()
        result = det.detect("I'm worried, what if something goes wrong")
        assert result.emotion == "anxious"
