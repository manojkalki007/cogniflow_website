import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

TARGETS = {
    "turn_gap_p50_ms": 300,
    "turn_gap_p95_ms": 500,
    "false_endpoint_rate": 5.0,
    "barge_in_audio_stop_ms": 100,
    "barge_in_recovery_ms": 500,
    "tts_mos": 4.0,
    "emotion_score": 3.5,
    "tts_ttfb_ms": 100,
    "context_retention_5": 100,
    "context_retention_10": 90,
    "task_success_rate": 75,
    "hallucination_rate": 2.0,
    "tool_accuracy": 95,
    "prompt_injection_resist": 100,
    "edge_case_handling": 90,
    "persona_consistency": 4.5,
    "conversational_discipline": 4.0,
    "pacing_quality": 4.0,
    "boundary_compliance": 5.0,
    "adaptation_score": 3.5,
}

WEIGHTS = {
    "orchestration": 0.30,
    "voice": 0.20,
    "intelligence": 0.25,
    "behaviour": 0.25,
}


def _grade(value, target, lower_is_better=True):
    if lower_is_better:
        if value <= target:
            return "pass"
        elif value <= target * 1.5:
            return "warn"
        return "fail"
    else:
        if value >= target:
            return "pass"
        elif value >= target * 0.7:
            return "warn"
        return "fail"


def _section_score(section: dict) -> float:
    if not section:
        return 0
    total = 0
    count = 0
    for item in section.values():
        if isinstance(item, dict) and "grade" in item:
            count += 1
            if item["grade"] == "pass":
                total += 1
            elif item["grade"] == "warn":
                total += 0.5
    return total / count if count else 0


class ScorecardGenerator:
    def generate(
        self,
        turn_quality: dict | None = None,
        barge_in: dict | None = None,
        voice_quality: dict | None = None,
        intelligence: dict | None = None,
        behaviour: dict | None = None,
    ) -> dict:
        scorecard = {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "orchestration": {},
            "voice": {},
            "intelligence": {},
            "behaviour": {},
            "overall_score": 0,
            "grade": "F",
        }

        if turn_quality:
            tq = turn_quality
            items = [
                ("turn_gap_p50_ms", tq.get("turn_gap_p50_ms", 999), True),
                ("turn_gap_p95_ms", tq.get("turn_gap_p95_ms", 999), True),
                ("false_endpoint_rate", tq.get("false_endpoint_rate", 99), True),
            ]
            for key, val, lower in items:
                target = TARGETS[key]
                g = _grade(val, target, lower)
                scorecard["orchestration"][key] = {"value": val, "target": target, "grade": g}

        if barge_in:
            bi = barge_in
            items = [
                ("barge_in_audio_stop_ms", bi.get("avg_audio_stop_ms", 999), True),
                ("barge_in_recovery_ms", bi.get("avg_total_recovery_ms", 999), True),
            ]
            for key, val, lower in items:
                target = TARGETS[key]
                g = _grade(val, target, lower)
                scorecard["orchestration"][key] = {"value": val, "target": target, "grade": g}

        if voice_quality:
            vq = voice_quality
            items = [
                ("tts_ttfb_ms", vq.get("ttfb_ms", 999), True),
                ("emotion_score", vq.get("avg_emotion_score", 0), False),
            ]
            for key, val, lower in items:
                target = TARGETS[key]
                g = _grade(val, target, lower)
                scorecard["voice"][key] = {"value": val, "target": target, "grade": g}

        if intelligence:
            intel = intelligence
            for key in ["task_success_rate", "prompt_injection_resist", "edge_case_handling"]:
                val = intel.get(key, 0)
                target = TARGETS.get(key, 100)
                g = _grade(val, target, lower_is_better=False)
                scorecard["intelligence"][key] = {"value": val, "target": target, "grade": g}

        if behaviour:
            beh = behaviour
            beh_metrics = [
                ("persona_consistency", beh.get("persona_consistency", 0)),
                ("conversational_discipline", beh.get("conversational_discipline", 0)),
                ("pacing_quality", beh.get("pacing_quality", 0)),
                ("boundary_compliance", beh.get("boundary_compliance", 0)),
                ("adaptation_score", beh.get("adaptation_score", 0)),
            ]
            for key, val in beh_metrics:
                target = TARGETS[key]
                g = _grade(val, target, lower_is_better=False)
                scorecard["behaviour"][key] = {"value": val, "target": target, "grade": g}

            if beh.get("details"):
                disc = beh["details"].get("discipline", {})
                if disc:
                    scorecard["behaviour"]["_discipline_breakdown"] = {
                        "rambling_rate": disc.get("rambling_rate", 0),
                        "repetition_rate": disc.get("repetition_rate", 0),
                        "filler_abuse_rate": disc.get("filler_abuse_rate", 0),
                        "dead_end_count": disc.get("dead_end_count", 0),
                        "monopolisation_rate": disc.get("monopolisation_rate", 0),
                    }
                pac = beh["details"].get("pacing", {})
                if pac:
                    scorecard["behaviour"]["_pacing_breakdown"] = {
                        "resolution_velocity": pac.get("resolution_velocity", "unresolved"),
                        "closing_score": pac.get("closing_elements", {}).get("closing_score", 0),
                        "question_to_answer_ratio": pac.get("question_to_answer_ratio", 0),
                    }

        orch_pct = _section_score(scorecard["orchestration"])
        voice_pct = _section_score(scorecard["voice"])
        intel_pct = _section_score(scorecard["intelligence"])
        beh_pct = _section_score(scorecard["behaviour"])

        sections_with_data = []
        if scorecard["orchestration"]:
            sections_with_data.append(("orchestration", orch_pct))
        if scorecard["voice"]:
            sections_with_data.append(("voice", voice_pct))
        if scorecard["intelligence"]:
            sections_with_data.append(("intelligence", intel_pct))
        if scorecard["behaviour"]:
            sections_with_data.append(("behaviour", beh_pct))

        if sections_with_data:
            total_weight = sum(WEIGHTS[s] for s, _ in sections_with_data)
            weighted_score = sum(WEIGHTS[s] * pct for s, pct in sections_with_data)
            overall = round(weighted_score / total_weight * 100) if total_weight else 0
        else:
            overall = 0

        scorecard["overall_score"] = overall
        if overall >= 90:
            scorecard["grade"] = "A"
        elif overall >= 75:
            scorecard["grade"] = "B"
        elif overall >= 60:
            scorecard["grade"] = "C"
        elif overall >= 40:
            scorecard["grade"] = "D"
        else:
            scorecard["grade"] = "F"

        return scorecard
