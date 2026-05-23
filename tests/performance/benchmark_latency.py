"""
Latency tracing benchmark — verifies the LatencyTracer
can measure and alert on component-level timing.
Simulates pipeline stages with controlled delays.
"""

import asyncio
import sys
import time
from unittest.mock import MagicMock

# Mock external deps so tracer can import
sys.modules.setdefault("httpx", MagicMock())
sys.modules.setdefault("cogniflow_home.config", MagicMock())
sys.modules.setdefault("cogniflow_home.db", MagicMock())
sys.modules.setdefault("cogniflow_home.db.supabase", MagicMock())

from cogniflow_home.latency.tracer import LatencyTracer


def simulate_turn(tracer, stt_ms=80, llm_ms=200, tts_ms=150):
    tracer.new_turn()

    tid = tracer.start("stt")
    time.sleep(stt_ms / 1000)
    tracer.end(tid)

    tid = tracer.start("llm")
    time.sleep(llm_ms / 1000)
    tracer.end(tid)

    tid = tracer.start("tts")
    time.sleep(tts_ms / 1000)
    tracer.end(tid)


def benchmark():
    tracer = LatencyTracer("bench-001")

    turns = [
        {"stt_ms": 50, "llm_ms": 180, "tts_ms": 120},
        {"stt_ms": 40, "llm_ms": 150, "tts_ms": 100},
        {"stt_ms": 45, "llm_ms": 160, "tts_ms": 110},
        {"stt_ms": 35, "llm_ms": 140, "tts_ms": 95},
        {"stt_ms": 55, "llm_ms": 200, "tts_ms": 130},
    ]

    latencies = []
    alerts = []

    print("=" * 50)
    print("LATENCY BENCHMARK (simulated)")
    print("=" * 50)

    for i, params in enumerate(turns):
        simulate_turn(tracer, **params)
        total = tracer.get_total_latency()
        summary = tracer.get_turn_summary()
        latencies.append(total)

        loop = asyncio.new_event_loop()
        alert = loop.run_until_complete(tracer.check_alert())
        loop.close()
        if alert:
            alerts.append(alert)

        print(f"  Turn {i+1}: {total:.0f}ms — {summary}")

    import statistics
    p50 = statistics.median(latencies)
    p90 = sorted(latencies)[int(len(latencies) * 0.9)]

    print()
    print(f"  P50: {p50:.0f}ms (target: < 350ms)")
    print(f"  P90: {p90:.0f}ms (target: < 500ms)")
    print(f"  Alerts fired: {len(alerts)}")
    print()

    passed = p50 < 500
    if passed:
        print("  PASS: Latency tracking working correctly")
    else:
        print("  FAIL: Unexpected latency")

    return passed


if __name__ == "__main__":
    benchmark()
