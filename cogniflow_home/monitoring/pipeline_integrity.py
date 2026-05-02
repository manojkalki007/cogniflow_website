import logging
import sys

logger = logging.getLogger(__name__)

class PipelineIntegrityChecker:
    async def check_memory_usage(self, active_calls: dict) -> dict:
        try:
            import resource
            rss_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            rss_mb = rss_kb / 1024
        except ImportError:
            import psutil, os
            rss_mb = psutil.Process(os.getpid()).memory_info().rss / (1024 * 1024)
        per_call = rss_mb / max(len(active_calls), 1)
        return {
            "total_rss_mb": round(rss_mb, 1),
            "active_calls": len(active_calls),
            "rss_per_call_mb": round(per_call, 1),
            "alert": per_call > 10,
        }

    async def check_websocket_health(self, stt_ws, tts_ws) -> dict:
        stt_ok = stt_ws is not None and not getattr(stt_ws, 'closed', True)
        tts_ok = tts_ws is not None
        return {
            "stt_websocket": "connected" if stt_ok else "disconnected",
            "tts_websocket": "connected" if tts_ok else "disconnected",
            "alert": not stt_ok or not tts_ok,
        }

    def check_state_isolation(self, active_calls: dict) -> dict:
        call_ids = list(active_calls.keys())
        issues = []
        for i, cid in enumerate(call_ids):
            pipeline = active_calls[cid]
            for j, other_id in enumerate(call_ids):
                if i >= j:
                    continue
                other = active_calls[other_id]
                if pipeline.llm is other.llm:
                    issues.append(f"Calls {cid} and {other_id} share LLM instance")
                if pipeline.stt is other.stt:
                    issues.append(f"Calls {cid} and {other_id} share STT instance")
        return {"isolated": len(issues) == 0, "issues": issues}
