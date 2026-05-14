"""Multi-tenant API key authentication.

Each API key:
- Is prefixed with "cgf_" so clients know it's a Cogniflow key
- Is stored as SHA-256 hash (never the raw key)
- Carries tenant_id, scopes, and rate limits

Usage in FastAPI:
    @app.get("/api/calls")
    async def list_calls(auth: AuthContext = Depends(get_auth_context)):
        ...
"""

import hashlib
import secrets
import time
from collections import defaultdict
from dataclasses import dataclass

from fastapi import Depends, Header, HTTPException

from cogniflow_home.db.supabase import db


_rate_counters: dict[str, list[float]] = defaultdict(list)


@dataclass
class AuthContext:
    tenant_id: str
    tenant_name: str
    plan: str
    api_key_id: str
    scopes: list[str]
    max_concurrent_calls: int
    monthly_minutes_limit: int
    current_month_minutes: int


def generate_api_key() -> tuple[str, str, str]:
    """Generate a new API key. Returns (raw_key, key_hash, key_prefix).
    The raw_key is shown ONCE to the client and never stored."""
    raw = f"cgf_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    key_prefix = raw[:12] + "..."
    return raw, key_hash, key_prefix


def hash_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def _check_rate_limit(key_id: str, rpm_limit: int) -> bool:
    now = time.time()
    timestamps = _rate_counters[key_id]
    _rate_counters[key_id] = [t for t in timestamps if now - t < 60.0]
    if len(_rate_counters[key_id]) >= rpm_limit:
        return False
    _rate_counters[key_id].append(now)
    return True


async def get_auth_context(
    x_api_key: str = Header(default=""),
    authorization: str = Header(default=""),
) -> AuthContext:
    """FastAPI dependency — validates API key and returns auth context.

    Accepts both:
    - cgf_ tenant keys → returns tenant-scoped context
    - Master key (settings.api_secret_key) → returns admin context with empty tenant_id
    """
    from cogniflow_home.config import settings

    raw_key = x_api_key or authorization.removeprefix("Bearer ").strip()

    # Dev mode: no API_SECRET_KEY configured and no key sent → allow as admin
    if not raw_key and not settings.api_secret_key:
        return AuthContext(
            tenant_id="",
            tenant_name="Master",
            plan="enterprise",
            api_key_id="master",
            scopes=["*"],
            max_concurrent_calls=999,
            monthly_minutes_limit=999999,
            current_month_minutes=0,
        )

    if not raw_key:
        raise HTTPException(status_code=401, detail="Missing or invalid API key")

    if settings.api_secret_key and raw_key == settings.api_secret_key:
        return AuthContext(
            tenant_id="",
            tenant_name="Master",
            plan="enterprise",
            api_key_id="master",
            scopes=["*"],
            max_concurrent_calls=999,
            monthly_minutes_limit=999999,
            current_month_minutes=0,
        )

    if not raw_key.startswith("cgf_"):
        raise HTTPException(status_code=401, detail="Missing or invalid API key")

    key_hash = hash_key(raw_key)

    rows = await db.select("api_keys", {"key_hash": key_hash, "is_active": True})
    if not rows:
        raise HTTPException(status_code=401, detail="Invalid API key")

    key_row = rows[0]

    if key_row.get("expires_at"):
        from datetime import datetime, timezone
        if datetime.fromisoformat(key_row["expires_at"]) < datetime.now(timezone.utc):
            raise HTTPException(status_code=401, detail="API key expired")

    if not _check_rate_limit(key_row["id"], key_row.get("rate_limit_rpm", 60)):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    tenant_rows = await db.select("tenants", {"id": key_row["tenant_id"]})
    if not tenant_rows:
        raise HTTPException(status_code=401, detail="Tenant not found")

    tenant = tenant_rows[0]

    if tenant.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended. Contact support@cogniflow.ai")

    import asyncio
    asyncio.create_task(db.update("api_keys", {"id": key_row["id"]}, {
        "last_used_at": "now()",
        "total_requests": key_row.get("total_requests", 0) + 1,
    }))

    return AuthContext(
        tenant_id=tenant["id"],
        tenant_name=tenant["name"],
        plan=tenant["plan"],
        api_key_id=key_row["id"],
        scopes=key_row.get("scopes", []),
        max_concurrent_calls=tenant.get("max_concurrent_calls", 5),
        monthly_minutes_limit=tenant.get("monthly_minutes_limit", 500),
        current_month_minutes=tenant.get("current_month_minutes", 0),
    )


def require_scope(scope: str):
    """Dependency factory — requires a specific scope."""
    async def _check(auth: AuthContext = Depends(get_auth_context)):
        if "*" not in auth.scopes and scope not in auth.scopes:
            raise HTTPException(
                status_code=403,
                detail=f"API key missing required scope: {scope}",
            )
        return auth
    return _check
