"""API keys, usage tracking, and billing endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Request

from cogniflow_home.db.supabase import db
from cogniflow_home.state import active_calls
from cogniflow_home.tenants.auth import AuthContext, generate_api_key, get_auth_context

router = APIRouter(tags=["billing"])


@router.get("/api/keys")
async def list_api_keys(auth: AuthContext = Depends(get_auth_context)):
    keys = await db.select("api_keys", {"tenant_id": auth.tenant_id})
    safe_keys = [{
        "id": k["id"],
        "name": k["name"],
        "key_prefix": k["key_prefix"],
        "scopes": k.get("scopes", []),
        "is_active": k["is_active"],
        "last_used_at": k.get("last_used_at"),
        "total_requests": k.get("total_requests", 0),
        "created_at": k["created_at"],
        "expires_at": k.get("expires_at"),
    } for k in keys]
    return {"keys": safe_keys}


@router.post("/api/keys")
async def create_api_key_endpoint(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    raw_key, key_hash, key_prefix = generate_api_key()
    await db.insert("api_keys", {
        "tenant_id": auth.tenant_id,
        "name": body.get("name", "New Key"),
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "scopes": body.get("scopes", ["calls:read", "calls:write"]),
        "rate_limit_rpm": body.get("rate_limit_rpm", 60),
        "expires_at": body.get("expires_at"),
    })
    return {
        "key": raw_key,
        "prefix": key_prefix,
        "message": "Save this key now. It will not be shown again.",
    }


@router.delete("/api/keys/{key_id}")
async def revoke_api_key(key_id: str, auth: AuthContext = Depends(get_auth_context)):
    keys = await db.select("api_keys", {"id": key_id, "tenant_id": auth.tenant_id})
    if not keys:
        raise HTTPException(404, "Key not found")
    await db.update("api_keys", {"id": key_id}, {"is_active": False})
    return {"ok": True, "message": "Key revoked"}


@router.get("/api/usage")
async def get_usage(month: str = None, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.tenants.billing import get_billing_summary
    return await get_billing_summary(auth.tenant_id, month)


@router.get("/api/usage/history")
async def get_usage_history(auth: AuthContext = Depends(get_auth_context)):
    records = await db.select(
        "usage_records",
        {"tenant_id": auth.tenant_id},
        order="recorded_at.desc",
        limit=5000,
    )
    return {"records": records, "count": len(records)}


@router.get("/api/usage/live")
async def get_live_usage(auth: AuthContext = Depends(get_auth_context)):
    tenant_calls = [
        cid for cid, p in active_calls.items()
        if getattr(p.state, "tenant_id", None) == auth.tenant_id
    ]
    return {
        "active_calls": len(tenant_calls),
        "max_concurrent": auth.max_concurrent_calls,
        "this_month_minutes": auth.current_month_minutes,
        "monthly_limit": auth.monthly_minutes_limit,
        "usage_pct": round(auth.current_month_minutes / max(auth.monthly_minutes_limit, 1) * 100, 1),
    }
