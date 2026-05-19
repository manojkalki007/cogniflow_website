"""Multi-tenant API key + JWT authentication.

Supports:
- cgf_ tenant API keys → tenant-scoped context
- Master key → admin context
- Supabase JWT (dashboard users) → tenant-scoped context with auto-provisioning
"""

import hashlib
import logging
import secrets
import time
from collections import defaultdict
from dataclasses import dataclass, field

import jwt
from fastapi import Depends, Header, HTTPException

from cogniflow_home.db.supabase import db

logger = logging.getLogger("cogniflow_home.tenants.auth")

_rate_counters: dict[str, list[float]] = defaultdict(list)

_ROLE_SCOPES = {
    "owner": ["*"],
    "admin": ["*"],
    "member": [
        "calls:read", "calls:write", "agents:read", "agents:write",
        "campaigns:read", "campaigns:write", "analytics:read",
    ],
    "viewer": ["calls:read", "agents:read", "analytics:read"],
}


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
    is_admin: bool = False


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


async def _resolve_jwt(raw_token: str) -> AuthContext:
    """Verify a Supabase JWT and resolve the user's tenant."""
    from cogniflow_home.config import settings

    try:
        payload = jwt.decode(
            raw_token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user_email = payload.get("email", "")
    user_id = payload.get("sub", "")
    if not user_email:
        raise HTTPException(status_code=401, detail="Token missing email")

    tenant_user_rows = await db.select("tenant_users", {"email": user_email})

    if not tenant_user_rows:
        from cogniflow_home.tenants.manager import create_tenant
        user_meta = payload.get("user_metadata", {})
        tenant_name = (
            user_meta.get("company")
            or user_meta.get("full_name")
            or user_email.split("@")[0]
        )
        result = await create_tenant(
            name=tenant_name, email=user_email,
            plan="starter", phone=user_meta.get("phone", ""),
        )
        if not result or "error" in result:
            raise HTTPException(status_code=500, detail="Failed to provision account")
        tenant = result["tenant"]
        role = "owner"
        logger.info("Auto-provisioned tenant %s for %s", tenant["id"], user_email)
    else:
        tenant_user = tenant_user_rows[0]
        role = tenant_user.get("role", "member")
        tenant_rows = await db.select("tenants", {"id": tenant_user["tenant_id"]})
        if not tenant_rows:
            raise HTTPException(status_code=401, detail="Tenant not found")
        tenant = tenant_rows[0]

    if tenant.get("status") == "suspended":
        raise HTTPException(status_code=403, detail="Account suspended. Contact support@cogniflow.ai")

    is_admin = user_email in settings.admin_emails

    return AuthContext(
        tenant_id=tenant["id"],
        tenant_name=tenant["name"],
        plan=tenant["plan"],
        api_key_id=f"jwt:{user_id}",
        scopes=_ROLE_SCOPES.get(role, ["calls:read"]),
        max_concurrent_calls=tenant.get("max_concurrent_calls", 5),
        monthly_minutes_limit=tenant.get("monthly_minutes_limit", 500),
        current_month_minutes=tenant.get("current_month_minutes", 0),
        is_admin=is_admin,
    )


async def get_auth_context(
    x_api_key: str = Header(default=""),
    authorization: str = Header(default=""),
) -> AuthContext:
    """FastAPI dependency — validates API key or JWT and returns auth context."""
    from cogniflow_home.config import settings

    raw_key = x_api_key or authorization.removeprefix("Bearer ").strip()

    if not raw_key:
        raise HTTPException(status_code=401, detail="Missing or invalid API key")

    # Master key → admin
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
            is_admin=True,
        )

    # cgf_ API key → tenant-scoped
    if raw_key.startswith("cgf_"):
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

    # Supabase JWT → tenant-scoped with auto-provisioning
    if settings.supabase_jwt_secret:
        return await _resolve_jwt(raw_key)

    raise HTTPException(status_code=401, detail="Missing or invalid API key")


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
