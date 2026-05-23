"""API keys, usage tracking, and billing endpoints."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from cogniflow_home.db.supabase import db
from cogniflow_home.state import active_calls
from cogniflow_home.tenants.auth import AuthContext, generate_api_key, get_auth_context

router = APIRouter(tags=["billing"])


class CreateApiKeyRequest(BaseModel):
    name: str = "New Key"
    scopes: list[str] = Field(default=["calls:read", "calls:write"])
    rate_limit_rpm: int = 60
    expires_at: Optional[str] = None


class SubscribeRequest(BaseModel):
    plan: str = Field(..., pattern="^(starter|growth)$")


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
async def create_api_key_endpoint(body: CreateApiKeyRequest, auth: AuthContext = Depends(get_auth_context)):
    raw_key, key_hash, key_prefix = generate_api_key()
    await db.insert("api_keys", {
        "tenant_id": auth.tenant_id,
        "name": body.name,
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "scopes": body.scopes,
        "rate_limit_rpm": body.rate_limit_rpm,
        "expires_at": body.expires_at,
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


@router.post("/api/billing/subscribe")
async def subscribe(body: SubscribeRequest, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.integrations.razorpay import razorpay
    result = await razorpay.create_subscription(
        tenant_id=auth.tenant_id,
        plan_id=body.plan,
        email=auth.email,
    )
    await db.update("tenants", {"id": auth.tenant_id}, {
        "subscription_id": result["subscription_id"],
        "plan": body.plan,
        "status": "pending",
    })
    return result


@router.post("/api/billing/webhook")
async def razorpay_webhook(request: Request):
    raw_body = await request.body()
    signature = request.headers.get("x-razorpay-signature", "")
    from cogniflow_home.integrations.razorpay import razorpay
    if not await razorpay.verify_signature(raw_body, signature):
        raise HTTPException(400, "Invalid signature")
    import json as _json
    payload = _json.loads(raw_body)
    event = payload.get("event", "")
    entity = payload.get("payload", {}).get("subscription", {}).get("entity", {})
    tenant_id = entity.get("notes", {}).get("tenant_id")
    if not tenant_id:
        return {"ok": True, "skipped": "no tenant_id in notes"}
    if event == "subscription.activated":
        plan = entity.get("notes", {}).get("plan", "starter")
        await db.update("tenants", {"id": tenant_id}, {
            "status": "active",
            "plan": plan,
        })
    elif event == "subscription.halted":
        await db.update("tenants", {"id": tenant_id}, {"status": "suspended"})
    elif event == "subscription.cancelled":
        await db.update("tenants", {"id": tenant_id}, {"status": "cancelled"})
    return {"ok": True}
