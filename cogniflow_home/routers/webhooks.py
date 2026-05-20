"""Webhook endpoint CRUD."""

from fastapi import APIRouter, Depends, Request

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.state import valid_uuid
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

router = APIRouter(tags=["webhooks"])


@router.post("/api/webhooks")
async def create_webhook(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    url = body.get("url")
    events = body.get("events", ["call.completed"])
    if not url:
        return {"error": "url is required"}
    data = {
        "url": url,
        "events": events,
        "secret": body.get("secret", settings.webhook_secret),
        "is_active": True,
    }
    if auth.tenant_id:
        data["tenant_id"] = auth.tenant_id
    result = await db.insert("webhook_endpoints", data)
    return result or {"error": "Failed to create webhook"}


@router.get("/api/webhooks")
async def list_webhooks(auth: AuthContext = Depends(get_auth_context)):
    match = {}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    webhooks = await db.select("webhook_endpoints", match or None)
    return {"webhooks": webhooks}


@router.delete("/api/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(webhook_id):
        return {"error": "Invalid webhook ID format"}
    match = {"id": webhook_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    await db.update("webhook_endpoints", match, {"is_active": False})
    return {"status": "deleted", "id": webhook_id}
