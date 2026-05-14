"""Service latency measurement.

Run once from your deployed server to verify all services
are co-located. Target: <30ms for each endpoint.
"""

import time

import httpx


async def measure_service_latency() -> dict[str, float]:
    endpoints = {
        "Deepgram": "https://api.deepgram.com/v1/listen",
        "Groq": "https://api.groq.com/openai/v1/chat/completions",
        "Sarvam": "https://api.sarvam.ai/text-to-speech",
    }
    results = {}
    async with httpx.AsyncClient() as client:
        for name, url in endpoints.items():
            start = time.perf_counter()
            try:
                await client.head(url, timeout=5)
            except Exception:
                pass
            ms = (time.perf_counter() - start) * 1000
            results[name] = round(ms, 0)
    return results
