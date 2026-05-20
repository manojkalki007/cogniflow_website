"""Shared runtime state used across routers.

Centralises the in-process pipeline map, call-state manager,
rate limiter, and agent-override map so every router can import
from one place without circular dependencies.
"""

import re
import time

from cogniflow_home.pipeline import VoicePipeline
from cogniflow_home.scaling import get_call_state

active_calls: dict[str, VoicePipeline] = {}
call_state = get_call_state()

_pending_agent_overrides: dict[str, str] = {}

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def valid_uuid(val: str) -> bool:
    return bool(_UUID_RE.match(val))


class RateLimiter:
    def __init__(self, max_calls: int = 10, window_seconds: int = 60):
        self.max_calls = max_calls
        self.window = window_seconds
        self._buckets: dict[str, list[float]] = {}

    def check(self, tenant_id: str = "__global__") -> bool:
        now = time.time()
        if tenant_id not in self._buckets:
            self._buckets[tenant_id] = []
        calls = self._buckets[tenant_id]
        calls[:] = [t for t in calls if now - t < self.window]
        if len(calls) >= self.max_calls:
            return False
        calls.append(now)
        return True


call_limiter = RateLimiter(max_calls=20, window_seconds=60)
