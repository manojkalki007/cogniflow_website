import time
import logging

logger = logging.getLogger(__name__)

class BargeInTracker:
    def __init__(self):
        self.events: list[dict] = []

    def record_barge_in(
        self,
        user_speech_detected_ms: float,
        agent_audio_stopped_ms: float,
        llm_cancelled_ms: float,
        stt_resumed_ms: float,
        new_response_started_ms: float,
    ) -> dict:
        event = {
            "audio_stop_latency": agent_audio_stopped_ms - user_speech_detected_ms,
            "llm_cancel_latency": llm_cancelled_ms - user_speech_detected_ms,
            "stt_resume_latency": stt_resumed_ms - user_speech_detected_ms,
            "total_recovery": new_response_started_ms - user_speech_detected_ms,
            "timestamp": time.time(),
        }
        self.events.append(event)
        if event["audio_stop_latency"] > 100:
            logger.warning(f"SLOW BARGE-IN: audio stop took {event['audio_stop_latency']:.0f}ms (target: <100ms)")
        if event["total_recovery"] > 500:
            logger.warning(f"SLOW BARGE-IN RECOVERY: {event['total_recovery']:.0f}ms total (target: <500ms)")
        return event

    def get_summary(self) -> dict:
        if not self.events:
            return {"total_barge_ins": 0}
        n = len(self.events)
        return {
            "total_barge_ins": n,
            "avg_audio_stop_ms": round(sum(e["audio_stop_latency"] for e in self.events) / n, 1),
            "avg_total_recovery_ms": round(sum(e["total_recovery"] for e in self.events) / n, 1),
            "worst_recovery_ms": round(max(e["total_recovery"] for e in self.events), 1),
            "pct_under_100ms_stop": round(sum(1 for e in self.events if e["audio_stop_latency"] < 100) / n * 100, 1),
            "pct_under_500ms_recovery": round(sum(1 for e in self.events if e["total_recovery"] < 500) / n * 100, 1),
        }
