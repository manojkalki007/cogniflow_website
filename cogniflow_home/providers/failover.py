"""Provider failover with circuit breaker pattern.

Wraps LLM/TTS/STT providers with automatic failover when primary fails.
Circuit breaker opens after N consecutive failures, auto-resets after cooldown.
"""

import asyncio
import enum
import logging
import time
from typing import Any

logger = logging.getLogger("cogniflow_home.failover")


class CircuitState(str, enum.Enum):
    CLOSED = "CLOSED"        # Normal operation — requests flow through
    OPEN = "OPEN"            # Failing — skip to next provider
    HALF_OPEN = "HALF_OPEN"  # Cooldown expired — allow one test request


class CircuitBreaker:
    """Thread-safe circuit breaker for a single provider.

    States:
        CLOSED   — normal, requests pass through
        OPEN     — too many consecutive failures, skip this provider
        HALF_OPEN — cooldown elapsed, allow one test request
    """

    def __init__(
        self,
        name: str,
        failure_threshold: int = 3,
        reset_timeout: float = 60.0,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time: float = 0.0
        self._last_success_time: float = 0.0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        return self._state

    @property
    def failure_count(self) -> int:
        return self._failure_count

    @property
    def last_failure_time(self) -> float:
        return self._last_failure_time

    async def can_execute(self) -> bool:
        """Check whether requests should be sent to this provider."""
        async with self._lock:
            if self._state == CircuitState.CLOSED:
                return True

            if self._state == CircuitState.OPEN:
                elapsed = time.monotonic() - self._last_failure_time
                if elapsed >= self.reset_timeout:
                    self._state = CircuitState.HALF_OPEN
                    logger.info(
                        f"Circuit breaker [{self.name}] OPEN -> HALF_OPEN "
                        f"after {elapsed:.1f}s cooldown"
                    )
                    return True
                return False

            # HALF_OPEN — allow exactly one test request
            return True

    async def record_success(self) -> None:
        async with self._lock:
            prev = self._state
            self._failure_count = 0
            self._state = CircuitState.CLOSED
            self._last_success_time = time.monotonic()
            if prev != CircuitState.CLOSED:
                logger.info(
                    f"Circuit breaker [{self.name}] {prev.value} -> CLOSED "
                    f"(provider recovered)"
                )

    async def record_failure(self) -> None:
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()

            if self._state == CircuitState.HALF_OPEN:
                # Test request failed — go back to OPEN
                self._state = CircuitState.OPEN
                logger.warning(
                    f"Circuit breaker [{self.name}] HALF_OPEN -> OPEN "
                    f"(test request failed, failures={self._failure_count})"
                )
            elif (
                self._state == CircuitState.CLOSED
                and self._failure_count >= self.failure_threshold
            ):
                self._state = CircuitState.OPEN
                logger.warning(
                    f"Circuit breaker [{self.name}] CLOSED -> OPEN "
                    f"after {self._failure_count} consecutive failures"
                )

    def status(self) -> dict[str, Any]:
        """Return a serializable snapshot of this breaker's state."""
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "failure_threshold": self.failure_threshold,
            "last_failure_time": self._last_failure_time or None,
            "last_success_time": self._last_success_time or None,
            "reset_timeout_seconds": self.reset_timeout,
        }


class ProviderChain:
    """Ordered chain of providers with independent circuit breakers.

    On ``execute(fn_name, *args, **kwargs)``, tries each provider in order,
    skipping those whose circuit breaker is OPEN.  Returns the result from
    the first provider that succeeds.

    Usage::

        chain = ProviderChain([
            ("groq-70b", groq_70b_instance),
            ("groq-8b",  groq_8b_instance),
        ])
        result = await chain.execute("generate_stream", user_text)
    """

    def __init__(
        self,
        providers: list[tuple[str, Any]],
        failure_threshold: int = 3,
        reset_timeout: float = 60.0,
    ):
        self._providers: list[tuple[str, Any, CircuitBreaker]] = []
        for name, provider in providers:
            cb = CircuitBreaker(
                name=name,
                failure_threshold=failure_threshold,
                reset_timeout=reset_timeout,
            )
            self._providers.append((name, provider, cb))

    async def execute(self, fn_name: str, *args: Any, **kwargs: Any) -> Any:
        """Call *fn_name* on providers in order until one succeeds.

        Raises ``RuntimeError`` if every provider is exhausted.
        """
        last_error: Exception | None = None

        for name, provider, cb in self._providers:
            if not await cb.can_execute():
                logger.debug(f"Skipping provider [{name}] (circuit OPEN)")
                continue

            fn = getattr(provider, fn_name, None)
            if fn is None:
                logger.warning(
                    f"Provider [{name}] has no method '{fn_name}', skipping"
                )
                continue

            try:
                logger.debug(f"Trying provider [{name}].{fn_name}()")
                result = await fn(*args, **kwargs)
                await cb.record_success()
                return result
            except Exception as exc:
                last_error = exc
                await cb.record_failure()
                logger.warning(
                    f"Provider [{name}].{fn_name}() failed: {exc!r}"
                )

        raise RuntimeError(
            f"All providers exhausted for '{fn_name}': {last_error!r}"
        )

    async def execute_stream(self, fn_name: str, *args: Any, **kwargs: Any):
        """Like ``execute`` but for async-generator methods (e.g. TTS synthesize).

        Yields chunks from the first provider whose generator produces at
        least one item without error.  If a provider's generator raises
        mid-stream, we log the failure and fall through to the next provider.
        """
        last_error: Exception | None = None

        for name, provider, cb in self._providers:
            if not await cb.can_execute():
                logger.debug(f"Skipping provider [{name}] (circuit OPEN)")
                continue

            fn = getattr(provider, fn_name, None)
            if fn is None:
                logger.warning(
                    f"Provider [{name}] has no method '{fn_name}', skipping"
                )
                continue

            try:
                logger.debug(f"Trying stream provider [{name}].{fn_name}()")
                yielded_any = False
                async for chunk in fn(*args, **kwargs):
                    yielded_any = True
                    yield chunk
                # If we got here without error, the stream completed
                await cb.record_success()
                return
            except Exception as exc:
                last_error = exc
                await cb.record_failure()
                logger.warning(
                    f"Provider [{name}].{fn_name}() stream failed: {exc!r}"
                )

        if last_error:
            raise RuntimeError(
                f"All providers exhausted for stream '{fn_name}': {last_error!r}"
            )

    def get_breaker(self, name: str) -> CircuitBreaker | None:
        """Look up a circuit breaker by provider name."""
        for n, _, cb in self._providers:
            if n == name:
                return cb
        return None

    def all_status(self) -> list[dict[str, Any]]:
        """Serializable status of every breaker in the chain."""
        return [cb.status() for _, _, cb in self._providers]


# ─── Global registry for health monitoring ───

_registry: dict[str, ProviderChain] = {}


def register_chain(category: str, chain: ProviderChain) -> None:
    """Register a ProviderChain under a category (e.g. 'llm', 'tts')."""
    _registry[category] = chain
    logger.info(
        f"Registered failover chain [{category}] with "
        f"{len(chain._providers)} providers: "
        f"{[n for n, _, _ in chain._providers]}"
    )


def get_chain(category: str) -> ProviderChain | None:
    return _registry.get(category)


def all_chain_status() -> dict[str, list[dict[str, Any]]]:
    """Return circuit breaker status for every registered chain."""
    return {cat: chain.all_status() for cat, chain in _registry.items()}
