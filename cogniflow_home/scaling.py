"""Redis-backed call state for horizontal scaling.

Falls back to in-memory dict when Redis is unavailable,
allowing single-process development with zero config change.
"""

import json
import logging
import time
from typing import Optional

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.scaling")

# TTL for Redis keys: auto-expire stale calls after 1 hour
_CALL_TTL_SECONDS = 3600
_REDIS_KEY_PREFIX = "cogniflow:call:"
_REDIS_SET_KEY = "cogniflow:active_calls"


try:
    import redis.asyncio as aioredis
    _HAS_REDIS = True
except ImportError:
    aioredis = None  # type: ignore[assignment]
    _HAS_REDIS = False


class CallStateManager:
    """Manages active call state with optional Redis backend.

    When Redis is available and configured, call state is stored in Redis
    so multiple server instances can share it. When Redis is unavailable,
    falls back to a plain in-memory dict (fine for single-process dev).
    """

    def __init__(self, redis_url: Optional[str] = None):
        self._redis = None
        self._memory: dict[str, dict] = {}
        self._redis_url = redis_url

        if redis_url and _HAS_REDIS:
            try:
                self._redis = aioredis.from_url(
                    redis_url,
                    decode_responses=True,
                    socket_connect_timeout=3,
                )
                logger.info("CallStateManager using Redis backend: %s", redis_url)
            except Exception:
                logger.warning(
                    "Failed to create Redis connection — falling back to in-memory",
                    exc_info=True,
                )
                self._redis = None
        else:
            if redis_url and not _HAS_REDIS:
                logger.warning(
                    "redis_url configured but redis.asyncio not installed — "
                    "pip install redis to enable horizontal scaling"
                )
            logger.info("CallStateManager using in-memory backend")

    @property
    def using_redis(self) -> bool:
        return self._redis is not None

    # ── Public API ──────────────────────────────────────────────

    async def register_call(self, call_id: str, metadata: dict) -> bool:
        """Register a new active call. Returns False if at capacity."""
        if self._redis:
            try:
                key = f"{_REDIS_KEY_PREFIX}{call_id}"
                payload = json.dumps({
                    **metadata,
                    "call_id": call_id,
                    "registered_at": time.time(),
                })
                await self._redis.set(key, payload, ex=_CALL_TTL_SECONDS)
                await self._redis.sadd(_REDIS_SET_KEY, call_id)
                return True
            except Exception:
                logger.warning("Redis register_call failed — falling back", exc_info=True)
                # Fall through to in-memory
        self._memory[call_id] = {
            **metadata,
            "call_id": call_id,
            "registered_at": time.time(),
        }
        return True

    async def unregister_call(self, call_id: str) -> None:
        """Remove a call from active state."""
        if self._redis:
            try:
                key = f"{_REDIS_KEY_PREFIX}{call_id}"
                await self._redis.delete(key)
                await self._redis.srem(_REDIS_SET_KEY, call_id)
                return
            except Exception:
                logger.warning("Redis unregister_call failed — falling back", exc_info=True)
        self._memory.pop(call_id, None)

    async def get_active_count(self) -> int:
        """Return the number of currently active calls."""
        if self._redis:
            try:
                # Clean up stale set members (keys may have expired via TTL)
                members = await self._redis.smembers(_REDIS_SET_KEY)
                if members:
                    pipeline = self._redis.pipeline()
                    for m in members:
                        pipeline.exists(f"{_REDIS_KEY_PREFIX}{m}")
                    results = await pipeline.execute()
                    stale = [m for m, exists in zip(members, results) if not exists]
                    if stale:
                        await self._redis.srem(_REDIS_SET_KEY, *stale)
                    return len(members) - len(stale)
                return 0
            except Exception:
                logger.warning("Redis get_active_count failed — falling back", exc_info=True)
        return len(self._memory)

    async def get_call(self, call_id: str) -> Optional[dict]:
        """Get metadata for a specific active call."""
        if self._redis:
            try:
                key = f"{_REDIS_KEY_PREFIX}{call_id}"
                data = await self._redis.get(key)
                if data:
                    return json.loads(data)
                return None
            except Exception:
                logger.warning("Redis get_call failed — falling back", exc_info=True)
        return self._memory.get(call_id)

    async def list_calls(self) -> list[dict]:
        """List all active calls."""
        if self._redis:
            try:
                members = await self._redis.smembers(_REDIS_SET_KEY)
                if not members:
                    return []
                pipeline = self._redis.pipeline()
                for m in members:
                    pipeline.get(f"{_REDIS_KEY_PREFIX}{m}")
                results = await pipeline.execute()
                calls = []
                for data in results:
                    if data:
                        calls.append(json.loads(data))
                return calls
            except Exception:
                logger.warning("Redis list_calls failed — falling back", exc_info=True)
        return list(self._memory.values())

    async def is_at_capacity(self, max_calls: int) -> bool:
        """Check if the system has reached the maximum number of concurrent calls."""
        count = await self.get_active_count()
        return count >= max_calls

    async def clear(self) -> None:
        """Remove all active calls. Used during shutdown."""
        if self._redis:
            try:
                members = await self._redis.smembers(_REDIS_SET_KEY)
                if members:
                    pipeline = self._redis.pipeline()
                    for m in members:
                        pipeline.delete(f"{_REDIS_KEY_PREFIX}{m}")
                    pipeline.delete(_REDIS_SET_KEY)
                    await pipeline.execute()
                return
            except Exception:
                logger.warning("Redis clear failed — falling back", exc_info=True)
        self._memory.clear()


# ── Singleton ──────────────────────────────────────────────────

_instance: Optional[CallStateManager] = None


def get_call_state() -> CallStateManager:
    """Return the singleton CallStateManager instance."""
    global _instance
    if _instance is None:
        redis_url = settings.redis_url or None
        _instance = CallStateManager(redis_url=redis_url if redis_url else None)
    return _instance
