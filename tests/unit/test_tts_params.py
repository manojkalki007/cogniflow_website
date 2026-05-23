"""Unit tests for get_tts_params (cogniflow_home/emotions/tts_params.py).

Pure unit tests -- no external deps required.
"""

import pytest

from cogniflow_home.emotions.tts_params import get_tts_params, PROFILE_BASELINES


class TestGetTtsParams:
    def test_frustrated_slows_pace_and_lowers_temp(self):
        result = get_tts_params("friendly", "frustrated", 0.7)
        # Frustrated: pace=0.90 (lower than friendly baseline 1.00)
        # Weight = min(0.7*0.7, 0.6) = min(0.49, 0.6) = 0.49
        # pace = 1.00 * 0.51 + 0.90 * 0.49 = 0.51 + 0.441 = 0.951 -> rounds ~0.95
        assert result["pace"] < 1.0
        # temperature: 0.60*0.51 + 0.50*0.49 = 0.306+0.245 = 0.551 -> ~0.55
        assert result["temperature"] < 0.6

    def test_happy_increases_pace_and_temp(self):
        result = get_tts_params("friendly", "happy", 0.7)
        # Happy: pace=1.10, temp=0.78
        # pace = 1.00*0.51 + 1.10*0.49 = 0.51+0.539 = 1.049 -> ~1.05
        assert result["pace"] > 1.0
        # temp = 0.60*0.51 + 0.78*0.49 = 0.306+0.3822 = 0.6882 -> ~0.69
        assert result["temperature"] > 0.65

    def test_zero_intensity_returns_baseline(self):
        result = get_tts_params("friendly", "neutral", 0.0)
        baseline = PROFILE_BASELINES["friendly"]
        # weight = min(0.0 * 0.7, 0.6) = 0.0 -> pure baseline
        assert result["temperature"] == baseline["temperature"]
        assert result["pace"] == baseline["pace"]

    def test_output_ranges_are_valid(self):
        emotions = ["neutral", "frustrated", "happy", "confused", "sad", "angry", "anxious"]
        profiles = ["empathetic", "energetic", "professional", "friendly", "hinglish"]
        for profile in profiles:
            for emotion in emotions:
                for intensity in [0.0, 0.3, 0.5, 0.7, 1.0]:
                    result = get_tts_params(profile, emotion, intensity)
                    assert 0.01 <= result["temperature"] <= 1.0, (
                        f"temperature {result['temperature']} out of range "
                        f"for {profile}/{emotion}/{intensity}"
                    )
                    assert 0.5 <= result["pace"] <= 2.0, (
                        f"pace {result['pace']} out of range "
                        f"for {profile}/{emotion}/{intensity}"
                    )
