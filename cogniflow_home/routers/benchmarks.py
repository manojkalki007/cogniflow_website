"""Benchmark runs, pipeline metrics, and behaviour drift detection."""

import logging
import time

from fastapi import APIRouter, Depends

from cogniflow_home.db.supabase import db
from cogniflow_home.state import active_calls
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["benchmarks"])


@router.post("/api/benchmarks/run")
async def api_run_benchmarks(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.monitoring.voice_quality import VoiceQualityEvaluator
    from cogniflow_home.monitoring.scorecard import ScorecardGenerator

    voice_eval = VoiceQualityEvaluator()
    voice_data = {}

    try:
        from cogniflow_home.providers.smallest_tts import SmallestTTS
        tts = SmallestTTS(voice_id="emily", language="en", sample_rate=16000, raw_pcm=True)
        await tts.connect()
        ttfb = await voice_eval.measure_tts_ttfb(tts)
        await tts.close()
        voice_data = {"ttfb_ms": ttfb}
    except Exception:
        logger.exception("Voice benchmark failed")

    turn_data = None
    barge_data = None
    for pipeline in active_calls.values():
        ts = pipeline.turn_quality.get_summary()
        if ts:
            turn_data = ts
        bs = pipeline.barge_in_tracker.get_summary()
        if bs and bs.get("total_barge_ins", 0) > 0:
            barge_data = bs
        break

    intel_data = None
    try:
        from tests.intelligence.runner import run_all_tests
        intel_data = await run_all_tests()
    except Exception:
        logger.debug("Intelligence tests not available", exc_info=True)

    behaviour_data = None
    try:
        from tests.intelligence.runner import run_behaviour_tests

        beh_results = await run_behaviour_tests()
        beh_pass_rate = beh_results.get("pass_rate", 0)

        by_cat = beh_results.get("by_category", {})
        persona_rate = by_cat.get("persona", {}).get("pass_rate", 0)
        discipline_rate = by_cat.get("discipline", {}).get("pass_rate", 0)
        boundary_rate = by_cat.get("boundaries", {}).get("pass_rate", 0)
        adaptation_rate = by_cat.get("adaptation", {}).get("pass_rate", 0)

        behaviour_data = {
            "persona_consistency": round(persona_rate / 20, 2),
            "conversational_discipline": round(discipline_rate / 20, 2),
            "pacing_quality": round(by_cat.get("pacing", {}).get("pass_rate", 0) / 20, 2),
            "boundary_compliance": round(boundary_rate / 20, 2),
            "adaptation_score": round(adaptation_rate / 20, 2),
            "test_results": beh_results,
        }
    except Exception:
        logger.debug("Behaviour tests not available", exc_info=True)

    scorecard = ScorecardGenerator().generate(
        turn_quality=turn_data,
        barge_in=barge_data,
        voice_quality=voice_data or None,
        intelligence=intel_data,
        behaviour=behaviour_data,
    )

    try:
        await db.insert("benchmarks", {
            "scorecard": scorecard,
            "overall_score": scorecard["overall_score"],
            "grade": scorecard["grade"],
        })
    except Exception:
        pass

    return scorecard


@router.get("/api/benchmarks/latest")
async def api_latest_benchmark(auth: AuthContext = Depends(get_auth_context)):
    try:
        results = await db.select("benchmarks", order="created_at.desc", limit=1)
        if results:
            return results[0]
    except Exception:
        pass
    return {"error": "No benchmark results yet. Run POST /api/benchmarks/run first."}


@router.get("/api/benchmarks/pipeline")
async def api_pipeline_metrics(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.monitoring.pipeline_integrity import PipelineIntegrityChecker
    checker = PipelineIntegrityChecker()
    memory = await checker.check_memory_usage(active_calls)
    isolation = checker.check_state_isolation(active_calls)

    call_metrics = {}
    for call_id, pipeline in active_calls.items():
        call_metrics[call_id] = {
            "turns": pipeline.turn_quality.get_summary(),
            "barge_ins": pipeline.barge_in_tracker.get_summary(),
            "emotion_state": pipeline.emotion_adapter.get_emotion_state(),
            "duration": int(time.time() - pipeline.state.started_at),
        }

    return {
        "memory": memory,
        "state_isolation": isolation,
        "active_calls": call_metrics,
    }


@router.get("/api/benchmarks/drift")
async def api_behaviour_drift(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.monitoring.drift import BehaviourDriftDetector
    detector = BehaviourDriftDetector()
    try:
        return await detector.check_drift()
    except Exception:
        logger.debug("Drift check failed", exc_info=True)
        return {"status": "insufficient_data"}
