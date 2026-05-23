"""Webhook dispatcher.

Fires signed HTTP POST requests to registered webhook endpoints
when call events occur. Supports Zapier, Make, n8n, or any custom receiver.

Payloads are signed with HMAC-SHA256 so the receiver can verify authenticity.
"""

import hashlib
import hmac
import json
import logging
import time
from typing import Any

import httpx

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

logger = logging.getLogger("cogniflow_home.webhooks")


def _sign_payload(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


_webhook_client = httpx.AsyncClient(timeout=10.0)


async def _fire_webhook(endpoint: dict, event: str, data: dict):
    payload = json.dumps({
        "event": event,
        "timestamp": time.time(),
        "data": data,
    }, default=str)

    secret = endpoint.get("secret") or settings.webhook_secret
    headers = {
        "Content-Type": "application/json",
        "X-CogniflowHome-Event": event,
    }
    if secret:
        headers["X-CogniflowHome-Signature"] = _sign_payload(payload, secret)

    try:
        resp = await _webhook_client.post(endpoint["url"], content=payload, headers=headers)
        if resp.status_code >= 400:
            logger.warning(f"Webhook {endpoint['url']} returned {resp.status_code}")
            await db.update("webhook_endpoints", {"id": endpoint["id"]}, {
                "failure_count": endpoint.get("failure_count", 0) + 1,
            })
        else:
            await db.update("webhook_endpoints", {"id": endpoint["id"]}, {
                "last_triggered_at": time.time(),
                "failure_count": 0,
            })
    except Exception:
        logger.exception(f"Webhook delivery failed: {endpoint['url']}")
        await db.update("webhook_endpoints", {"id": endpoint["id"]}, {
            "failure_count": endpoint.get("failure_count", 0) + 1,
        })


async def dispatch_webhook(event: str, data: dict[str, Any]):
    # Tenant isolation: only deliver webhooks to the tenant that owns the event.
    # The payload should include tenant_id (call.tenant_id, contact.tenant_id, etc).
    tenant_id = data.get("tenant_id") or (data.get("call", {}) or {}).get("tenant_id")
    if not tenant_id:
        logger.warning("dispatch_webhook: no tenant_id in payload for event %s — skipping to prevent cross-tenant leak", event)
        return
    endpoints = await db.select("webhook_endpoints", {"is_active": "true", "tenant_id": tenant_id})

    for endpoint in endpoints:
        subscribed_events = endpoint.get("events", [])
        if event in subscribed_events or "*" in subscribed_events:
            await _fire_webhook(endpoint, event, data)


async def on_event(event: str, data: dict[str, Any]):
    await dispatch_webhook(event, data)


def register():
    bus.on("call.started", on_event)
    bus.on("call.completed", on_event)
    bus.on("call.failed", on_event)
    bus.on("contact.created", on_event)
    bus.on("contact.updated", on_event)
    logger.info("Webhook dispatcher registered")
