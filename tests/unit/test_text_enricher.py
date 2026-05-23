"""Unit tests for TextEnricher (cogniflow_home/emotions/text_enricher.py).

Pure unit tests -- no external deps required.
The module only imports re.
"""

import pytest

from cogniflow_home.emotions.text_enricher import TextEnricher


class TestTextEnricher:
    def test_filler_pause_insertion(self):
        enricher = TextEnricher()
        result = enricher.enrich(
            "um so basically its about three thousand", "neutral", 0.5
        )
        # "um so" matches filler pause pattern -> "um... so"
        assert "um..." in result

    def test_frustrated_empathy_pause(self):
        enricher = TextEnricher()
        result = enricher.enrich(
            "I understand that sounds tough", "frustrated", 0.7
        )
        # "frustrated" with intensity > 0.4 adds pause after empathy words
        # "understand" or "tough" should get "..." appended
        assert "understand..." in result or "tough..." in result

    def test_happy_exclamation(self):
        enricher = TextEnricher()
        result = enricher.enrich("That is great news", "happy", 0.8)
        # happy with intensity > 0.5 adds "!" if not already present
        assert "!" in result

    def test_trail_off_ellipsis(self):
        enricher = TextEnricher()
        result = enricher.enrich("Check it out and stuff", "neutral", 0.3)
        # "and stuff" is a trail-off phrase -> appends "..."
        assert result.endswith("...")
