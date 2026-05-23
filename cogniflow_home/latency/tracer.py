"""Per-component latency measurement.

Traces every stage of the pipeline on every turn. Stores results
in the database for dashboards and alerting.
"""

import logging
import time

import httpx

from cogniflow_home.db.supabase import db

logger = logging.getLogger("cogniflow_home.latency")

ALERT_THRESHOLD_MS = 500


class LatencyTracer:

    def __init__(self, call_id: str):
        self.call_id = call_id
        self.traces: list[dict] = []
        self._index: dict[str, dict] = {}
        self._turn_count = 0

    def start(self, component: str) -> str:
        trace_id = f"{component}_{time.perf_counter()}"
        entry = {
            "id": trace_id,
            "component": component,
            "start": time.perf_counter(),
            "end": None,
            "duration_ms": None,
            "turn": self._turn_count,
        }
        self.traces.append(entry)
        self._index[trace_id] = entry
        return trace_id

    def end(self, trace_id: str):
        t = self._index.get(trace_id)
        if t:
            t["end"] = time.perf_counter()
            t["duration_ms"] = (t["end"] - t["start"]) * 1000

    def new_turn(self):
        self._turn_count += 1

    def get_turn_summary(self, turn: int | None = None) -> dict:
        target_turn = turn if turn is not None else self._turn_count
        return {
            t["component"]: round(t["duration_ms"], 1)
            for t in self.traces
            if t["duration_ms"] is not None and t["turn"] == target_turn
        }

    def get_total_latency(self, turn: int | None = None) -> float:
        target_turn = turn if turn is not None else self._turn_count
        return sum(
            t["duration_ms"]
            for t in self.traces
            if t["duration_ms"] is not None and t["turn"] == target_turn
        )

    async def check_alert(self) -> str | None:
        total = self.get_total_latency()
        if total > ALERT_THRESHOLD_MS:
            summary = self.get_turn_summary()
            msg = (
                f"High latency on call {self.call_id} turn {self._turn_count}: "
                f"{total:.0f}ms — {summary}"
            )
            logger.warning(msg)
            try:
                from cogniflow_home.config import settings
                if getattr(settings, "alert_webhook", ""):
                    async with httpx.AsyncClient(timeout=5.0) as client:
                        await client.post(settings.alert_webhook, json={
                            "text": f"High latency: {total:.0f}ms on call {self.call_id}",
                            "call_id": self.call_id,
                            "turn": self._turn_count,
                            "total_ms": round(total),
                            "breakdown": summary,
                        })
            except Exception:
                logger.debug("Alert webhook failed", exc_info=True)
            return msg
        return None

    async def save(self):
        turn_summaries = {}
        for t in self.traces:
            if t["duration_ms"] is None:
                continue
            turn = t["turn"]
            if turn not in turn_summaries:
                turn_summaries[turn] = {}
            turn_summaries[turn][t["component"]] = round(t["duration_ms"], 1)

        await db.update("calls", {"id": self.call_id}, {
            "metadata": {"latency_traces": turn_summaries},
        })
