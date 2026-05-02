"""
Detect gradual quality degradation across all behaviour dimensions.
Compare current week's scores against baseline (first week's scores).
Alert when any dimension drops >10% from baseline.
"""

import logging
from datetime import date, timedelta
from cogniflow_home.db.supabase import db

logger = logging.getLogger(__name__)


class BehaviourDriftDetector:
    """Detect gradual quality degradation in agent behaviour."""

    DIMENSIONS = [
        "persona_consistency",
        "conversational_discipline",
        "pacing_quality",
        "boundary_compliance",
        "adaptation_score",
        "escalation_accuracy",
        "overall_quality",
    ]

    async def check_drift(self, days_current: int = 7, days_baseline: int = 30) -> dict:
        """
        Compare current period scores against baseline.
        Alert on any dimension that dropped >10%.
        """
        today = date.today()
        current_start = (today - timedelta(days=days_current)).isoformat()
        baseline_start = (today - timedelta(days=days_baseline)).isoformat()

        recent_calls = await db.select(
            "calls",
            {"created_at": f"gte.{current_start}T00:00:00"},
            limit=500,
        )

        baseline_calls = await db.select(
            "calls",
            {"created_at": f"gte.{baseline_start}T00:00:00"},
            limit=2000,
        )

        if not recent_calls or not baseline_calls:
            return {"status": "insufficient_data"}

        def avg_score(calls, key):
            scores = [
                c.get("quality_details", {}).get(key, 0)
                for c in calls
                if c.get("quality_details", {}).get(key) is not None
                and c["quality_details"][key] > 0
            ]
            return sum(scores) / len(scores) if scores else 0

        drift_report = {"status": "ok", "alerts": [], "dimensions": {}}

        for dim in self.DIMENSIONS:
            current = avg_score(recent_calls, dim)
            baseline = avg_score(baseline_calls, dim)

            if baseline == 0:
                continue

            change_pct = ((current - baseline) / baseline) * 100
            drift_report["dimensions"][dim] = {
                "current": round(current, 2),
                "baseline": round(baseline, 2),
                "change_pct": round(change_pct, 1),
            }

            if change_pct < -10:
                drift_report["status"] = "drifting"
                drift_report["alerts"].append({
                    "dimension": dim,
                    "current": round(current, 2),
                    "baseline": round(baseline, 2),
                    "drop": f"{abs(change_pct):.1f}%",
                    "severity": "critical" if change_pct < -20 else "warning",
                })
                logger.warning(
                    f"BEHAVIOUR DRIFT: {dim} dropped {abs(change_pct):.1f}% "
                    f"from {baseline:.2f} → {current:.2f}"
                )

        return drift_report
