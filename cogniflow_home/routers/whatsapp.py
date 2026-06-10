"""WhatsApp webhook endpoints for Meta WhatsApp Business API."""

import asyncio
import hashlib
import hmac
import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import PlainTextResponse, JSONResponse

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home.whatsapp.webhook")

router = APIRouter(tags=["whatsapp"])


def _verify_signature(payload: bytes, signature: str) -> bool:
    """Verify X-Hub-Signature-256 from Meta."""
    if not settings.whatsapp_app_secret:
        return True
    if not signature:
        return False
    expected = hmac.new(
        settings.whatsapp_app_secret.encode(),
        payload,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


@router.get("/api/whatsapp/webhook")
async def whatsapp_verify(request: Request):
    """Meta webhook verification (GET with hub.challenge)."""
    params = request.query_params
    mode = params.get("hub.mode")
    token = params.get("hub.verify_token")
    challenge = params.get("hub.challenge")

    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        logger.info("WhatsApp webhook verified")
        return PlainTextResponse(challenge)
    return PlainTextResponse("Forbidden", status_code=403)


@router.post("/api/whatsapp/webhook")
async def whatsapp_incoming(request: Request):
    """Receive incoming WhatsApp messages from Meta API."""
    raw_body = await request.body()
    signature = request.headers.get("X-Hub-Signature-256", "")
    if not _verify_signature(raw_body, signature):
        return PlainTextResponse("Invalid signature", status_code=403)

    body = json.loads(raw_body)

    for entry in body.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value", {})
            messages = value.get("messages", [])
            metadata = value.get("metadata", {})
            phone_number_id = metadata.get("phone_number_id", "")

            for msg in messages:
                from_phone = msg.get("from", "")
                msg_type = msg.get("type", "")
                wa_message_id = msg.get("id", "")
                media_info = None

                if msg_type == "text":
                    text = msg.get("text", {}).get("body", "")
                elif msg_type == "interactive":
                    text = (
                        msg.get("interactive", {}).get("button_reply", {}).get("title", "")
                        or msg.get("interactive", {}).get("list_reply", {}).get("title", "")
                    )
                elif msg_type in ("image", "audio", "document", "video", "sticker"):
                    media_data = msg.get(msg_type, {})
                    media_info = {
                        "type": msg_type,
                        "media_id": media_data.get("id", ""),
                        "mime_type": media_data.get("mime_type", ""),
                        "filename": media_data.get("filename", ""),
                        "caption": media_data.get("caption", ""),
                    }
                    text = media_data.get("caption", "") or f"[Sent a {msg_type}]"
                else:
                    text = f"[{msg_type} message]"

                if not text or not from_phone:
                    continue

                agent_id, tenant_id = await _route_message(phone_number_id)
                if not agent_id:
                    logger.warning(f"No agent found for WA number {phone_number_id}")
                    continue

                from cogniflow_home.whatsapp.chat import chat_engine

                asyncio.create_task(
                    chat_engine.handle_message(
                        tenant_id, agent_id, from_phone, text, wa_message_id,
                        media_info=media_info,
                    )
                )

    return JSONResponse({"status": "ok"})


@router.get("/api/whatsapp/conversations")
async def list_conversations(
    agent_id: str = "",
    auth: AuthContext = Depends(get_auth_context),
):
    """List WhatsApp conversations for the tenant, optionally filtered by agent."""
    if not auth.tenant_id:
        return {"conversations": []}
    match: dict = {"tenant_id": auth.tenant_id}
    if agent_id:
        match["agent_id"] = agent_id
    convos = await db.select(
        "whatsapp_conversations",
        match,
        order="last_message_at.desc",
        limit=50,
    )
    return {"conversations": convos}


@router.get("/api/whatsapp/conversations/{phone}")
async def get_conversation_messages(
    phone: str,
    agent_id: str = "",
    auth: AuthContext = Depends(get_auth_context),
):
    """Get message history for a WhatsApp conversation."""
    if not auth.tenant_id:
        return {"messages": []}
    match: dict = {"tenant_id": auth.tenant_id, "phone_number": phone}
    if agent_id:
        match["agent_id"] = agent_id
    messages = await db.select(
        "whatsapp_messages",
        match,
        order="created_at.asc",
        limit=100,
    )
    return {"messages": messages}


@router.post("/api/whatsapp/conversations/{phone}/resolve")
async def resolve_conversation(
    phone: str,
    agent_id: str = "",
    auth: AuthContext = Depends(get_auth_context),
):
    """De-escalate a conversation back to AI-handled."""
    if not auth.tenant_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    match: dict = {"tenant_id": auth.tenant_id, "phone_number": phone}
    if agent_id:
        match["agent_id"] = agent_id
    convos = await db.select("whatsapp_conversations", match, limit=1)
    if not convos:
        return JSONResponse({"error": "Conversation not found"}, status_code=404)
    await db.update(
        "whatsapp_conversations",
        {"id": convos[0]["id"]},
        {"status": "active", "metadata": {}},
    )
    return {"status": "resolved"}


@router.post("/api/whatsapp/conversations/{phone}/reply")
async def human_reply(
    phone: str,
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
):
    """Send a human agent reply to a WhatsApp conversation."""
    if not auth.tenant_id:
        return JSONResponse({"error": "Unauthorized"}, status_code=401)
    body = await request.json()
    text = (body.get("text") or "").strip()
    if not text:
        return JSONResponse({"error": "text is required"}, status_code=400)

    convos = await db.select(
        "whatsapp_conversations",
        {"tenant_id": auth.tenant_id, "phone_number": phone},
        limit=1,
    )
    if not convos:
        return JSONResponse({"error": "Conversation not found"}, status_code=404)

    convo = convos[0]
    from cogniflow_home.whatsapp.tool import get_whatsapp

    outbound_wa_id = ""
    try:
        wa = await get_whatsapp(auth.tenant_id)
        result = await wa.send_text(phone, text)
        if isinstance(result, dict) and "messages" in result:
            outbound_wa_id = result["messages"][0].get("id", "")
        await wa.close()
    except Exception:
        logger.exception("Human reply send failed")
        return JSONResponse({"error": "Failed to send message"}, status_code=500)

    from datetime import datetime, timezone

    try:
        await db.insert("whatsapp_messages", {
            "tenant_id": auth.tenant_id,
            "agent_id": convo["agent_id"],
            "phone_number": phone,
            "direction": "outbound",
            "content": text,
            "wa_message_id": outbound_wa_id,
            "metadata": json.dumps({"sent_by": "human", "sender_email": auth.email}),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    except Exception:
        logger.exception("Failed to store human reply")

    return {"status": "sent", "wa_message_id": outbound_wa_id}


async def _route_message(phone_number_id: str) -> tuple[str, str]:
    """Map an incoming WhatsApp message to an agent + tenant.

    Uses DB-side JSONB query (find_agent_by_wa_phone_id RPC) to avoid
    loading all agents into memory. Falls back to tenant_integrations.
    """
    try:
        rows = await db.rpc("find_agent_by_wa_phone_id", {"phone_id": phone_number_id})
        if rows and isinstance(rows, list) and rows[0].get("agent_id"):
            return rows[0]["agent_id"], rows[0].get("tenant_id", "")
    except Exception:
        logger.exception("Agent routing by RPC failed")

    try:
        integrations = await db.select("tenant_integrations", {
            "integration": "whatsapp", "status": "connected",
        })
        for row in integrations:
            config = row.get("config") or {}
            if isinstance(config, str):
                config = json.loads(config)
            if config.get("phone_number_id") == phone_number_id:
                tenant_id = row["tenant_id"]
                agents = await db.select(
                    "agents",
                    {"tenant_id": tenant_id, "status": "active"},
                    limit=1,
                )
                if agents:
                    return agents[0]["id"], tenant_id
    except Exception:
        logger.debug("Fallback tenant routing failed", exc_info=True)

    return "", ""
