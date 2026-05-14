"""
A/B testing for outbound campaigns.
Test different agent configurations and measure which variant converts better.
"""

import logging
import random

from cogniflow_home.db.supabase import db

logger = logging.getLogger(__name__)


class ABTestManager:
    """Manage A/B test variants for campaigns."""

    async def create_test(
        self,
        campaign_id: str,
        variants: list[dict],
    ) -> dict:
        test = {
            "campaign_id": campaign_id,
            "variants": variants,
            "status": "active",
            "results": {
                v["name"]: {"calls": 0, "conversions": 0, "avg_duration": 0, "avg_sentiment": 0}
                for v in variants
            },
        }
        await db.insert("ab_tests", test)
        return test

    def select_variant(self, variants: list[dict]) -> dict:
        rand = random.random()
        cumulative = 0
        for v in variants:
            cumulative += v["weight"]
            if rand <= cumulative:
                return v
        return variants[-1]

    async def record_result(
        self,
        campaign_id: str,
        variant_name: str,
        converted: bool,
        duration: int,
        sentiment: float,
    ):
        tests = await db.select("ab_tests", {"campaign_id": f"eq.{campaign_id}"})
        if not tests:
            return

        test = tests[0]
        results = test.get("results", {})
        v_results = results.get(variant_name, {"calls": 0, "conversions": 0, "avg_duration": 0})

        n = v_results["calls"]
        v_results["calls"] = n + 1
        if converted:
            v_results["conversions"] += 1
        v_results["avg_duration"] = (v_results["avg_duration"] * n + duration) / (n + 1)
        v_results["avg_sentiment"] = (v_results.get("avg_sentiment", 0.5) * n + sentiment) / (n + 1)
        v_results["conversion_rate"] = (
            v_results["conversions"] / v_results["calls"] if v_results["calls"] > 0 else 0
        )

        results[variant_name] = v_results
        await db.update("ab_tests", {"id": test["id"]}, {"results": results})

    async def get_results(self, campaign_id: str) -> dict:
        tests = await db.select("ab_tests", {"campaign_id": f"eq.{campaign_id}"})
        if not tests:
            return {}

        results = tests[0].get("results", {})

        eligible = {k: v for k, v in results.items() if v.get("calls", 0) >= 30}
        winner = None
        if eligible:
            winner = max(eligible, key=lambda k: eligible[k].get("conversion_rate", 0))

        return {
            "variants": results,
            "winner": winner,
            "total_calls": sum(v.get("calls", 0) for v in results.values()),
            "statistically_significant": all(v.get("calls", 0) >= 30 for v in results.values()),
        }


ab_test_manager = ABTestManager()
