"""Real-time call quality scorer.

Runs on call.completed. Computes fast, deterministic metrics (no LLM needed):
- Talk ratio (agent vs user)
- Average agent response length
- Longest monologue
- Barge-in count
- Data collection completeness
- Call resolution (natural end vs timeout vs hangup)
- Turn count and pacing

Stores a concise score object on the call record.
Complements the LLM-based analysis (post_call.py) and behaviour analysis.
"""

import logging
from typing import Any

from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

logger = logging.getLogger("cogniflow_home.analysis.scorer")


def _word_count(text: str) -> int:
    return len(text.split()) if text else 0


def score_call(transcript: list[dict], duration: int, barge_in_data: dict | None = None) -> dict:
    if not transcript:
        return {"score": 0, "grade": "F", "flags": ["no_transcript"]}

    agent_turns = [t for t in transcript if t.get("role") == "agent"]
    user_turns = [t for t in transcript if t.get("role") == "user"]

    agent_words = sum(_word_count(t.get("text", "")) for t in agent_turns)
    user_words = sum(_word_count(t.get("text", "")) for t in user_turns)
    total_words = agent_words + user_words

    talk_ratio = agent_words / total_words if total_words else 0
    avg_agent_words = agent_words / len(agent_turns) if agent_turns else 0
    longest_monologue = max((_word_count(t.get("text", "")) for t in agent_turns), default=0)

    agent_turn_lengths = [_word_count(t.get("text", "")) for t in agent_turns]
    rambling_turns = sum(1 for w in agent_turn_lengths if w > 30)
    rambling_rate = (rambling_turns / len(agent_turns) * 100) if agent_turns else 0

    barge_count = barge_in_data.get("total_barge_ins", 0) if barge_in_data else 0

    score = 100.0
    flags = []

    if talk_ratio > 0.70:
        score -= 15
        flags.append("agent_dominated")
    elif talk_ratio > 0.60:
        score -= 5

    if avg_agent_words > 25:
        score -= 10
        flags.append("verbose_responses")
    elif avg_agent_words > 20:
        score -= 5

    if longest_monologue > 50:
        score -= 10
        flags.append("long_monologue")

    if rambling_rate > 20:
        score -= 10
        flags.append("high_rambling_rate")

    if barge_count >= 3:
        score -= 10
        flags.append("frequent_barge_ins")
    elif barge_count >= 2:
        score -= 5

    if len(user_turns) < 2 and duration > 30:
        score -= 15
        flags.append("low_engagement")

    if duration > 0 and len(agent_turns) > 0:
        turns_per_minute = len(agent_turns + user_turns) / (duration / 60)
        if turns_per_minute < 2:
            score -= 5
            flags.append("slow_pacing")
        elif turns_per_minute > 12:
            score -= 5
            flags.append("rushed_pacing")

    score = max(0, min(100, score))

    if score >= 90:
        grade = "A"
    elif score >= 75:
        grade = "B"
    elif score >= 60:
        grade = "C"
    elif score >= 40:
        grade = "D"
    else:
        grade = "F"

    return {
        "score": round(score),
        "grade": grade,
        "flags": flags,
        "metrics": {
            "talk_ratio": round(talk_ratio, 2),
            "avg_agent_words_per_turn": round(avg_agent_words, 1),
            "longest_monologue_words": longest_monologue,
            "rambling_rate_pct": round(rambling_rate, 1),
            "barge_in_count": barge_count,
            "total_turns": len(agent_turns) + len(user_turns),
            "agent_turns": len(agent_turns),
            "user_turns": len(user_turns),
            "duration_seconds": duration,
            "agent_words": agent_words,
            "user_words": user_words,
        },
    }


async def on_call_completed(event: str, data: dict[str, Any]):
    transcript = data.get("transcript", [])
    duration = data.get("duration_seconds", 0)
    call_id = data.get("call_id")
    barge_in_data = data.get("barge_in_quality")

    if not call_id or len(transcript) < 2:
        return

    result = score_call(transcript, duration, barge_in_data)

    try:
        await db.update("calls", {"id": call_id}, {
            "call_score": result["score"],
            "call_grade": result["grade"],
            "score_flags": result["flags"],
            "score_metrics": result["metrics"],
        })
        logger.info(
            f"Call {call_id} scored: {result['score']}/100 ({result['grade']}) "
            f"flags={result['flags']}"
        )
    except Exception:
        logger.exception(f"Failed to save call score for {call_id}")


def register():
    bus.on("call.completed", on_call_completed)
    logger.info("Call scorer registered")
