"""Post-call behaviour analysis.

Runs 4 evaluators in parallel after every completed call:
1. Persona consistency (LLM-as-judge)
2. Conversational discipline (rule-based)
3. Pacing & flow (structural analysis)
4. Boundary violations (regex)
5. Adaptive behaviour (LLM-as-judge)

Results stored on the call record under quality_details.
"""

import asyncio
import logging
from typing import Any

from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus
from cogniflow_home.monitoring.persona import evaluate_persona
from cogniflow_home.monitoring.discipline import DisciplineAnalyzer
from cogniflow_home.monitoring.pacing import PacingAnalyzer
from cogniflow_home.monitoring.boundaries import BoundaryDetector
from cogniflow_home.monitoring.adaptive import evaluate_adaptation

logger = logging.getLogger("cogniflow_home.analysis.behaviour")

_discipline = DisciplineAnalyzer()
_pacing = PacingAnalyzer()
_boundaries = BoundaryDetector()


def _convert_transcript(raw: list[dict]) -> list[dict]:
    """Convert pipeline transcript format to evaluator format."""
    return [
        {
            "role": "assistant" if t["role"] == "agent" else "user",
            "content": t.get("text", t.get("content", "")),
        }
        for t in raw
    ]


def _transcript_text(raw: list[dict]) -> str:
    return "\n".join(
        f"{t['role']}: {t.get('text', t.get('content', ''))}"
        for t in raw
    )


def _discipline_score(result: dict) -> float:
    """Convert discipline metrics to a 0-5 score."""
    score = 5.0
    if result.get("avg_words_per_turn", 0) > 25:
        score -= 1.0
    if result.get("rambling_rate", 0) > 15:
        score -= 0.5
    if result.get("repetition_rate", 0) > 3:
        score -= 0.5
    if result.get("filler_abuse_rate", 0) > 10:
        score -= 0.5
    if result.get("dead_end_count", 0) > 0:
        score -= 1.0
    if result.get("circular_loop_count", 0) > 0:
        score -= 0.5
    if result.get("monopolisation_rate", 0) > 15:
        score -= 0.5
    return max(score, 0.0)


def _pacing_score(result: dict) -> float:
    """Convert pacing metrics to a 0-5 score."""
    score = 5.0
    q_ratio = result.get("question_to_answer_ratio", 0.5)
    if q_ratio > 0.8 or q_ratio < 0.1:
        score -= 1.0
    if result.get("interrogation_detected", False):
        score -= 1.0
    rv = result.get("resolution_turn")
    if rv and isinstance(rv, int) and rv > 16:
        score -= 1.0
    closing = result.get("closing_elements", {}).get("closing_score", 0)
    if closing < 2:
        score -= 1.0
    return max(score, 0.0)


def _boundary_score(result: dict) -> float:
    """Convert boundary violations to a 0-5 score."""
    if result.get("clean", True):
        return 5.0
    critical = len(result.get("critical", []))
    high = len(result.get("high", []))
    score = 5.0 - (critical * 2.0) - (high * 1.0)
    return max(score, 0.0)


async def analyse_behaviour(event: str, data: dict[str, Any]):
    transcript = data.get("transcript", [])
    if len(transcript) < 4:
        return

    call_id = data.get("call_id")
    converted = _convert_transcript(transcript)
    text = _transcript_text(transcript)

    agent_config = {
        "name": data.get("agent_name", "Agent"),
        "company": "Cogniflow",
        "personality": "warm and professional",
        "role": "AI voice agent",
    }

    persona_task = asyncio.create_task(evaluate_persona(text, agent_config))
    adaptive_task = asyncio.create_task(evaluate_adaptation(text))

    discipline_result = _discipline.analyse(converted)
    pacing_result = _pacing.analyse(converted)
    boundary_result = _boundaries.analyse_transcript(converted)

    persona_result = await persona_task
    adaptive_result = await adaptive_task

    persona_sc = persona_result.get("overall_persona_score", 0)
    if persona_sc < 0:
        persona_sc = 0
    discipline_sc = _discipline_score(discipline_result)
    pacing_sc = _pacing_score(pacing_result)
    boundary_sc = _boundary_score(boundary_result)
    adaptive_sc = adaptive_result.get("overall_adaptation_score", 0)
    if adaptive_sc < 0:
        adaptive_sc = 0

    quality_details = {
        "persona_consistency": round(persona_sc, 2),
        "conversational_discipline": round(discipline_sc, 2),
        "pacing_quality": round(pacing_sc, 2),
        "boundary_compliance": round(boundary_sc, 2),
        "adaptation_score": round(adaptive_sc, 2),
        "overall_quality": round(
            (persona_sc + discipline_sc + pacing_sc + boundary_sc + adaptive_sc) / 5, 2
        ),
        "details": {
            "persona": persona_result,
            "discipline": discipline_result,
            "pacing": pacing_result,
            "boundaries": boundary_result,
            "adaptive": adaptive_result,
        },
    }

    try:
        await db.update("calls", {"id": call_id}, {
            "quality_details": quality_details,
        })
        logger.info(
            f"Behaviour analysis for {call_id}: "
            f"persona={persona_sc:.1f} discipline={discipline_sc:.1f} "
            f"pacing={pacing_sc:.1f} boundaries={boundary_sc:.1f} "
            f"adaptive={adaptive_sc:.1f}"
        )
    except Exception:
        logger.exception(f"Failed to save behaviour analysis for {call_id}")


def register():
    bus.on("call.completed", analyse_behaviour)
    logger.info("Behaviour analysis registered")
