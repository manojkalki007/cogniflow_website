"""Unit tests for LatencyTracer (cogniflow_home/latency/tracer.py).

The tracer imports from cogniflow_home.db.supabase which depends on
pydantic_settings and httpx. We mock the entire import chain so
the tests work without any external dependencies.
"""

import sys
import time
from unittest.mock import MagicMock

# Mock external dependency chain BEFORE importing the module under test.
# config -> pydantic_settings, db.supabase -> config + httpx
sys.modules.setdefault("pydantic_settings", MagicMock())
sys.modules.setdefault("httpx", MagicMock())
sys.modules.setdefault("cogniflow_home.config", MagicMock())
sys.modules.setdefault("cogniflow_home.db", MagicMock())
sys.modules.setdefault("cogniflow_home.db.supabase", MagicMock())

from cogniflow_home.latency.tracer import LatencyTracer  # noqa: E402


class TestLatencyTracer:
    def test_start_returns_trace_id_string(self):
        tracer = LatencyTracer(call_id="test-call-001")
        trace_id = tracer.start("stt")
        assert isinstance(trace_id, str)
        assert "stt" in trace_id

    def test_end_records_duration(self):
        tracer = LatencyTracer(call_id="test-call-002")
        tid = tracer.start("llm")
        # Simulate a tiny delay
        time.sleep(0.005)
        tracer.end(tid)
        entry = tracer._index[tid]
        assert entry["duration_ms"] is not None
        assert entry["duration_ms"] > 0

    def test_get_total_latency_sums_components(self):
        tracer = LatencyTracer(call_id="test-call-003")

        # Record two components in the same turn (turn 0)
        t1 = tracer.start("stt")
        time.sleep(0.01)
        tracer.end(t1)

        t2 = tracer.start("llm")
        time.sleep(0.01)
        tracer.end(t2)

        total = tracer.get_total_latency()
        # Total should be the sum of both durations
        assert total > 0
        stt_ms = tracer._index[t1]["duration_ms"]
        llm_ms = tracer._index[t2]["duration_ms"]
        assert abs(total - (stt_ms + llm_ms)) < 0.01

    def test_check_alert_fires_when_above_threshold(self):
        import asyncio

        tracer = LatencyTracer(call_id="test-call-004")

        # Manually inject a trace with high duration to trigger alert
        tid = tracer.start("slow_component")
        tracer.end(tid)
        # Force the duration above the 500ms threshold
        tracer._index[tid]["duration_ms"] = 600.0

        # check_alert is async, so run it in an event loop
        msg = asyncio.run(tracer.check_alert())
        assert msg is not None
        assert "test-call-004" in msg
        assert "600" in msg
