"""
FastAPI server — multi-provider telephony with full API.

Telephony:
  POST /voice/{provider}/inbound     — Webhook for inbound calls
  POST /voice/{provider}/outbound    — Webhook for outbound calls
  WS   /voice/{provider}/ws          — WebSocket for media streaming

API:
  POST   /api/call                    — Trigger outbound call
  GET    /api/calls                   — List calls (with filters)
  GET    /api/calls/{id}              — Get call detail
  GET    /api/contacts                — List contacts
  GET    /api/contacts/{id}           — Get contact detail
  PATCH  /api/contacts/{id}           — Update contact
  GET    /api/agents                  — List agents
  POST   /api/agents                  — Create agent
  PATCH  /api/agents/{id}             — Update agent
  POST   /api/campaigns               — Create campaign
  GET    /api/campaigns               — List campaigns
  GET    /api/campaigns/{id}          — Get campaign
  POST   /api/campaigns/{id}/start    — Start campaign
  POST   /api/campaigns/{id}/pause    — Pause campaign
  POST   /api/webhooks                — Register a webhook endpoint
  GET    /api/webhooks                — List webhook endpoints
  DELETE /api/webhooks/{id}           — Remove a webhook endpoint
  GET    /api/stats                   — Dashboard stats
  GET    /health                      — Health check
"""

import logging
import re
import time
import uuid as _uuid
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Header, Request, WebSocket
from fastapi.responses import JSONResponse, Response
from starlette.types import ASGIApp, Receive, Scope, Send
from cogniflow_home.agents import create_agent, get_agent_by_id, get_agent_for_number, list_agents, update_agent
from cogniflow_home.campaigns.manager import (
    create_campaign,
    get_campaign,
    list_campaigns,
    parse_csv,
    pause_campaign,
    resume_active_campaigns,
    start_campaign,
)
from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.integrations.hubspot import get_caller_context
from cogniflow_home.pipeline import VoicePipeline
from cogniflow_home.telephony.base import CallInfo
from cogniflow_home.telephony.registry import get_provider

logger = logging.getLogger("cogniflow_home")

active_calls: dict[str, VoicePipeline] = {}
# call_sid → agent_id override for test calls
_pending_agent_overrides: dict[str, str] = {}

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def _valid_uuid(val: str) -> bool:
    return bool(_UUID_RE.match(val))


# ─── Authentication ───

async def verify_api_key(x_api_key: str = Header(default="")):
    if not settings.api_secret_key:
        return
    if x_api_key != settings.api_secret_key:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


# ─── Rate Limiting ───

class RateLimiter:
    def __init__(self, max_calls: int = 10, window_seconds: int = 60):
        self.max_calls = max_calls
        self.window = window_seconds
        self._calls: list[float] = []

    def check(self) -> bool:
        now = time.time()
        self._calls = [t for t in self._calls if now - t < self.window]
        if len(self._calls) >= self.max_calls:
            return False
        self._calls.append(now)
        return True


_call_limiter = RateLimiter(max_calls=20, window_seconds=60)


# ─── Twilio Signature Validation ───

def _validate_twilio_request(request: Request, form: dict) -> bool:
    if not settings.twilio_auth_token:
        return True
    from twilio.request_validator import RequestValidator
    validator = RequestValidator(settings.twilio_auth_token)
    url = str(request.url)
    signature = request.headers.get("X-Twilio-Signature", "")
    return validator.validate(url, dict(form), signature)


# ─── Lifespan ───

@asynccontextmanager
async def lifespan(app):
    from cogniflow_home.db import call_logger
    from cogniflow_home.analysis import post_call
    from cogniflow_home.integrations import hubspot
    from cogniflow_home.webhooks import dispatcher
    from cogniflow_home.campaigns import dnc
    from cogniflow_home.revenue import tracker as revenue_tracker

    from cogniflow_home.memory import register as register_memory
    from cogniflow_home.integrations import salesforce
    from cogniflow_home.analysis import behaviour as behaviour_analysis
    from cogniflow_home.notifications import confirmations

    call_logger.register()
    post_call.register()
    behaviour_analysis.register()
    confirmations.register()
    hubspot.register()
    dispatcher.register()
    dnc.register()
    revenue_tracker.register()
    register_memory()
    salesforce.register()
    logger.info("All modules registered")

    if not settings.webhook_secret:
        logger.warning(
            "WEBHOOK_SECRET is not set. Webhooks will be sent without "
            "HMAC signatures. Set WEBHOOK_SECRET in your .env file."
        )
    if not settings.api_secret_key:
        logger.warning(
            "API_SECRET_KEY is not set. API endpoints are unprotected. "
            "Set API_SECRET_KEY in your .env file for production."
        )

    await resume_active_campaigns()

    yield

    for call_id, pipeline in list(active_calls.items()):
        try:
            await pipeline.stop()
        except Exception:
            logger.exception(f"Error stopping call {call_id} during shutdown")
    active_calls.clear()
    await db.close()
    logger.info("Shutdown complete")


app = FastAPI(title="Cogniflow Home Voice Agent", version="2.0.0", lifespan=lifespan)


class CORSAndRequestIDMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "websocket":
            await self.app(scope, receive, send)
            return

        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            request_id = headers.get(b"x-request-id", str(_uuid.uuid4())[:8].encode()).decode()
            scope.setdefault("state", {})["request_id"] = request_id

            method = scope.get("method", "GET")
            if method == "OPTIONS":
                response_headers = [
                    (b"access-control-allow-origin", b"*"),
                    (b"access-control-allow-methods", b"GET, POST, PATCH, DELETE, OPTIONS"),
                    (b"access-control-allow-headers", b"Content-Type, X-Api-Key, X-Request-ID"),
                    (b"access-control-max-age", b"86400"),
                ]
                await send({"type": "http.response.start", "status": 204, "headers": response_headers})
                await send({"type": "http.response.body", "body": b""})
                return

            async def send_with_cors(message):
                if message["type"] == "http.response.start":
                    h = list(message.get("headers", []))
                    h.append((b"access-control-allow-origin", b"*"))
                    h.append((b"x-request-id", request_id.encode()))
                    message["headers"] = h
                await send(message)

            await self.app(scope, receive, send_with_cors)
            return

        await self.app(scope, receive, send)

app.add_middleware(CORSAndRequestIDMiddleware)


# ─── Health ───

@app.get("/health")
async def health():
    checks = {"active_calls": len(active_calls)}

    try:
        await db.select("calls", select="id", limit=1)
        checks["database"] = "ok"
    except Exception:
        checks["database"] = "error"

    checks["providers"] = {
        "stt": {
            "deepgram": "configured" if settings.deepgram_api_key else "not_configured",
            "sarvam": "configured" if settings.sarvam_api_key else "not_configured",
        },
        "llm": {
            "groq": "configured" if settings.groq_api_key else "not_configured",
            "openai": "configured" if settings.openai_api_key else "not_configured",
        },
        "tts": {
            "cartesia": "configured" if settings.cartesia_api_key else "not_configured",
            "elevenlabs": "configured" if settings.elevenlabs_api_key else "not_configured",
            "sarvam": "configured" if settings.sarvam_api_key else "not_configured",
            "smallest": "configured" if settings.smallest_ai_api_key else "not_configured",
        },
    }

    checks["telephony"] = {
        "twilio": "configured" if settings.twilio_account_sid else "not_configured",
        "exotel": "configured" if settings.exotel_api_key else "not_configured",
    }

    checks["integrations"] = {
        "hubspot": "configured" if settings.hubspot_api_key else "not_configured",
        "salesforce": "configured" if settings.salesforce_client_id else "not_configured",
        "whatsapp": "configured" if settings.whatsapp_api_key else "not_configured",
        "razorpay": "configured" if settings.razorpay_key_id else "not_configured",
        "google_calendar": "configured" if (settings.google_service_account_json or settings.google_service_account_path) else "not_configured",
    }

    has_stt = any(v == "configured" for v in checks["providers"]["stt"].values())
    has_llm = any(v == "configured" for v in checks["providers"]["llm"].values())
    has_tts = any(v == "configured" for v in checks["providers"]["tts"].values())
    has_tel = any(v == "configured" for v in checks["telephony"].values())

    if checks["database"] == "ok" and has_stt and has_llm and has_tts and has_tel:
        status = "ok"
    elif checks["database"] == "ok":
        status = "degraded"
    else:
        status = "error"

    return {"status": status, **checks}


# ─── Telephony webhooks (no API key — use Twilio signature validation) ───

@app.post("/voice/twilio/inbound")
async def twilio_inbound(request: Request):
    form = await request.form()
    if not _validate_twilio_request(request, form):
        return Response(status_code=403, content="Invalid signature")
    caller = form.get("From", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/twilio/ws"
    provider = get_provider("twilio")
    twiml = provider.get_twiml_or_response(ws_url, caller)
    return Response(content=twiml, media_type="application/xml")


@app.post("/voice/twilio/outbound")
async def twilio_outbound(request: Request):
    form = await request.form()
    if not _validate_twilio_request(request, form):
        return Response(status_code=403, content="Invalid signature")
    called = form.get("To", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/twilio/ws"
    provider = get_provider("twilio")
    twiml = provider.get_twiml_or_response(ws_url, called)
    return Response(content=twiml, media_type="application/xml")


@app.post("/voice/exotel/inbound")
async def exotel_inbound(request: Request):
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/exotel/ws"
    return {"websocket_url": ws_url}


@app.post("/voice/exotel/outbound")
async def exotel_outbound(request: Request):
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/exotel/ws"
    return {"websocket_url": ws_url}


@app.post("/voice/{provider_name}/inbound")
async def generic_inbound(provider_name: str):
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/{provider_name}/ws"
    return {"websocket_url": ws_url, "provider": provider_name}


# ─── Universal WebSocket ───

@app.websocket("/voice/{provider_name}/ws")
async def voice_ws(websocket: WebSocket, provider_name: str):
    if len(active_calls) >= settings.max_concurrent_calls:
        await websocket.close(code=1013, reason="Server at capacity")
        return

    provider = get_provider(provider_name)
    pipeline: Optional[VoicePipeline] = None

    async def on_audio(audio_bytes: bytes):
        if pipeline:
            await pipeline.handle_audio(audio_bytes)

    async def on_call_start(call_info: CallInfo):
        nonlocal pipeline

        override_id = _pending_agent_overrides.pop(call_info.call_sid, None)
        if override_id:
            agent_config = await get_agent_by_id(override_id)
            if not agent_config:
                agent_config = await get_agent_for_number(call_info.called_number)
        else:
            agent_config = await get_agent_for_number(call_info.called_number)
        pipeline = VoicePipeline(
            call_info, provider,
            instructions_override=agent_config.instructions,
            greeting_override=agent_config.greeting,
            language=agent_config.language,
            voice_id=agent_config.voice_id,
        )

        crm_context = await get_caller_context(call_info.caller_number)
        if crm_context:
            pipeline.inject_context(crm_context)

        active_calls[call_info.call_sid] = pipeline
        await pipeline.start()

    async def on_call_end():
        nonlocal pipeline
        if pipeline:
            call_sid = pipeline.state.call_sid
            await pipeline.stop()
            active_calls.pop(call_sid, None)
            pipeline = None

    await provider.handle_websocket(websocket, on_audio, on_call_start, on_call_end)


@app.websocket("/voice/browser/test")
async def browser_voice_test(websocket: WebSocket):
    """Browser-based voice test — pass agent_id as query param."""
    if len(active_calls) >= settings.max_concurrent_calls:
        await websocket.close(code=1013, reason="Server at capacity")
        return

    agent_id = websocket.query_params.get("agent_id", "")

    if not settings.groq_api_key and not settings.openai_api_key:
        await websocket.accept()
        import json as _json
        await websocket.send_text(_json.dumps({"event": "error", "message": "No LLM provider configured. Add GROQ_API_KEY or OPENAI_API_KEY to .env"}))
        await websocket.close()
        return

    provider = get_provider("browser")
    pipeline: Optional[VoicePipeline] = None

    async def on_audio(audio_bytes: bytes):
        if pipeline:
            await pipeline.handle_audio(audio_bytes)

    async def on_call_start(call_info: CallInfo):
        nonlocal pipeline
        if agent_id:
            agent_config = await get_agent_by_id(agent_id)
            if not agent_config:
                agent_config = await get_agent_for_number("")
        else:
            agent_config = await get_agent_for_number("")
        pipeline = VoicePipeline(
            call_info, provider,
            instructions_override=agent_config.instructions,
            greeting_override=agent_config.greeting,
            language=agent_config.language,
            voice_id=agent_config.voice_id,
            sample_rate=16000,
        )

        async def _send_transcript(role: str, text: str):
            await provider.send_event("transcript", {"role": role, "text": text})

        pipeline.on_transcript = _send_transcript
        active_calls[call_info.call_sid] = pipeline
        await pipeline.start()

    async def on_call_end():
        nonlocal pipeline
        if pipeline:
            call_sid = pipeline.state.call_sid
            await pipeline.stop()
            active_calls.pop(call_sid, None)
            pipeline = None

    await provider.handle_websocket(websocket, on_audio, on_call_start, on_call_end)


# ─── Outbound Calls ───

@app.post("/api/call", dependencies=[Depends(verify_api_key)])
async def make_outbound_call(request: Request):
    body = await request.json()
    to_number = body.get("to_number")
    provider_name = body.get("provider", "twilio")
    agent_id = body.get("agent_id")

    if not to_number:
        return {"error": "to_number is required"}

    if not _call_limiter.check():
        return {"error": "Rate limit exceeded. Max 20 calls per minute."}

    try:
        provider = get_provider(provider_name)
        webhook_url = f"{settings.public_url}/voice/{provider_name}/outbound"
        status_url = f"{settings.public_url}/api/call-status"
        result = await provider.initiate_outbound_call(to_number, webhook_url, status_url)
        if agent_id and result.call_sid:
            _pending_agent_overrides[result.call_sid] = agent_id
        return {"call_sid": result.call_sid, "status": result.status, "to": to_number, "provider": provider_name}
    except NotImplementedError:
        return {"error": f"Outbound not implemented for {provider_name}"}
    except Exception:
        logger.exception(f"Failed to initiate outbound call via {provider_name}")
        return {"error": "Failed to initiate call. Check server logs for details."}


@app.post("/api/call/{call_id}/hangup", dependencies=[Depends(verify_api_key)])
async def hangup_call(call_id: str):
    if not _valid_uuid(call_id):
        return {"error": "Invalid call ID format"}
    pipeline = active_calls.get(call_id)
    if not pipeline:
        return {"error": "Call not found or already ended"}
    await pipeline.stop()
    active_calls.pop(call_id, None)
    return {"status": "ended", "call_id": call_id}


@app.get("/api/call/{call_id}/status", dependencies=[Depends(verify_api_key)])
async def call_status(call_id: str):
    if not _valid_uuid(call_id):
        return {"error": "Invalid call ID format"}
    pipeline = active_calls.get(call_id)
    if pipeline:
        return {
            "call_id": call_id,
            "status": "active",
            "duration": int(time.time() - pipeline.state.started_at),
            "turns": len(pipeline.state.transcript),
        }
    calls = await db.select("calls", {"id": call_id})
    if calls:
        return calls[0]
    return {"error": "Call not found"}


# ─── Calls API ───

@app.get("/api/calls", dependencies=[Depends(verify_api_key)])
async def list_calls(
    direction: str | None = None,
    status: str | None = None,
    caller: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    match = {}
    if direction:
        match["direction"] = direction
    if status:
        match["status"] = status
    if caller:
        match["caller_number"] = caller

    calls = await db.select("calls", match or None, order="started_at.desc", limit=limit)
    return {"calls": calls, "count": len(calls)}


@app.get("/api/calls/{call_id}", dependencies=[Depends(verify_api_key)])
async def get_call(call_id: str):
    if not _valid_uuid(call_id):
        return {"error": "Invalid call ID format"}
    calls = await db.select("calls", {"id": call_id})
    if not calls:
        return {"error": "Call not found"}
    return calls[0]


# ─── Contacts API ───

@app.get("/api/contacts", dependencies=[Depends(verify_api_key)])
async def list_contacts(limit: int = 50, search: str | None = None):
    contacts = await db.select("contacts", order="last_call_at.desc.nullslast", limit=limit)
    if search:
        search_lower = search.lower()
        contacts = [c for c in contacts if
                    search_lower in (c.get("name") or "").lower() or
                    search_lower in (c.get("phone_number") or "") or
                    search_lower in (c.get("company") or "").lower()]
    return {"contacts": contacts, "count": len(contacts)}


@app.get("/api/contacts/{contact_id}", dependencies=[Depends(verify_api_key)])
async def get_contact(contact_id: str):
    if not _valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    contacts = await db.select("contacts", {"id": contact_id})
    if not contacts:
        return {"error": "Contact not found"}
    contact = contacts[0]
    calls = await db.select("calls", {"caller_number": contact["phone_number"]},
                            order="started_at.desc", limit=20)
    contact["calls"] = calls
    return contact


@app.patch("/api/contacts/{contact_id}", dependencies=[Depends(verify_api_key)])
async def update_contact(contact_id: str, request: Request):
    if not _valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    body = await request.json()
    allowed = {"name", "email", "company", "notes", "language", "tags"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return {"error": "No valid fields to update"}
    result = await db.update("contacts", {"id": contact_id}, updates)
    return result or {"error": "Contact not found"}


# ─── Webhooks API ───

@app.post("/api/webhooks", dependencies=[Depends(verify_api_key)])
async def create_webhook(request: Request):
    body = await request.json()
    url = body.get("url")
    events = body.get("events", ["call.completed"])
    if not url:
        return {"error": "url is required"}
    result = await db.insert("webhook_endpoints", {
        "url": url,
        "events": events,
        "secret": body.get("secret", settings.webhook_secret),
        "is_active": True,
    })
    return result or {"error": "Failed to create webhook"}


@app.get("/api/webhooks", dependencies=[Depends(verify_api_key)])
async def list_webhooks():
    webhooks = await db.select("webhook_endpoints")
    return {"webhooks": webhooks}


@app.delete("/api/webhooks/{webhook_id}", dependencies=[Depends(verify_api_key)])
async def delete_webhook(webhook_id: str):
    if not _valid_uuid(webhook_id):
        return {"error": "Invalid webhook ID format"}
    await db.update("webhook_endpoints", {"id": webhook_id}, {"is_active": False})
    return {"status": "deleted", "id": webhook_id}


# ─── Stats API ───

@app.get("/api/stats", dependencies=[Depends(verify_api_key)])
async def get_stats():
    from datetime import date

    today_iso = date.today().isoformat()
    today_calls = await db.select(
        "calls",
        {"created_at": f"gte.{today_iso}T00:00:00"},
        order="created_at.desc",
        limit=500,
    )

    today_total = len(today_calls)
    inbound = sum(1 for c in today_calls if c.get("direction") == "inbound")
    outbound = sum(1 for c in today_calls if c.get("direction") == "outbound")
    durations = [c.get("duration_seconds", 0) for c in today_calls if c.get("duration_seconds")]
    avg_duration = sum(durations) / len(durations) if durations else 0

    all_time_count = await db.count("calls")

    return {
        "today": {
            "total_calls": today_total,
            "inbound": inbound,
            "outbound": outbound,
            "avg_duration_seconds": round(avg_duration),
        },
        "all_time": {
            "total_calls": all_time_count,
        },
        "active_calls": len(active_calls),
    }


# ─── Agents API ───

@app.get("/api/agents", dependencies=[Depends(verify_api_key)])
async def api_list_agents():
    agents = await list_agents()
    return {"agents": agents}


@app.post("/api/agents", dependencies=[Depends(verify_api_key)])
async def api_create_agent(request: Request):
    body = await request.json()
    name = body.get("name")
    instructions = body.get("instructions")
    if not name or not instructions:
        return {"error": "name and instructions are required"}
    agent_data = {
        "name": name,
        "instructions": instructions,
        "voice_id": body.get("voice_id", ""),
        "language": body.get("language", "en"),
        "phone_numbers": body.get("phone_numbers", []),
        "is_active": True,
        "metadata": body.get("metadata", {}),
        "greeting": body.get("greeting", ""),
        "guardrails": body.get("guardrails", {}),
        "llm_provider": body.get("llm_provider", "groq"),
        "llm_model": body.get("llm_model", "llama-3.3-70b-versatile"),
        "tts_provider": body.get("tts_provider", "cartesia"),
        "temperature": body.get("temperature", 0.7),
        "tools_enabled": body.get("tools_enabled", []),
        "max_call_duration": body.get("max_call_duration", 600),
        "enable_memory": body.get("enable_memory", True),
        "enable_prediction": body.get("enable_prediction", True),
        "enable_emotion": body.get("enable_emotion", True),
        "enable_language_switch": body.get("enable_language_switch", True),
        "enable_rag": body.get("enable_rag", False),
    }
    result = await create_agent(agent_data)
    if not result:
        return JSONResponse({"error": "Failed to create agent"}, status_code=500)
    return result


@app.patch("/api/agents/{agent_id}", dependencies=[Depends(verify_api_key)])
async def api_update_agent(agent_id: str, request: Request):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    body = await request.json()
    allowed = {"name", "instructions", "voice_id", "language", "phone_numbers", "is_active", "metadata",
               "greeting", "guardrails", "llm_provider", "llm_model", "tts_provider", "tts_voice_name",
               "max_call_duration", "enable_memory", "enable_prediction", "enable_emotion",
               "enable_language_switch", "enable_rag", "temperature", "tools_enabled"}
    updates = {k: v for k, v in body.items() if k in allowed}
    result = await update_agent(agent_id, updates)
    return result or {"error": "Agent not found"}


# ─── Campaigns API ───

@app.get("/api/campaigns", dependencies=[Depends(verify_api_key)])
async def api_list_campaigns():
    campaigns = await list_campaigns()
    return {"campaigns": campaigns}


@app.get("/api/campaigns/{campaign_id}", dependencies=[Depends(verify_api_key)])
async def api_get_campaign(campaign_id: str):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    campaign = await get_campaign(campaign_id)
    if not campaign:
        return {"error": "Campaign not found"}
    return campaign


@app.post("/api/campaigns", dependencies=[Depends(verify_api_key)])
async def api_create_campaign(request: Request):
    body = await request.json()
    name = body.get("name")
    phone_numbers = body.get("phone_numbers", [])
    if not name or not phone_numbers:
        return {"error": "name and phone_numbers are required"}
    result = await create_campaign(
        name=name,
        agent_id=body.get("agent_id"),
        phone_numbers=phone_numbers,
        max_concurrent=body.get("max_concurrent", 1),
    )
    return result or {"error": "Failed to create campaign"}


@app.post("/api/campaigns/{campaign_id}/start", dependencies=[Depends(verify_api_key)])
async def api_start_campaign(campaign_id: str):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    return await start_campaign(campaign_id)


@app.post("/api/campaigns/{campaign_id}/pause", dependencies=[Depends(verify_api_key)])
async def api_pause_campaign(campaign_id: str):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    return await pause_campaign(campaign_id)


@app.post("/api/campaigns/upload", dependencies=[Depends(verify_api_key)])
async def api_upload_campaign(request: Request):
    form = await request.form()
    name = form.get("name", "Uploaded Campaign")
    agent_id = form.get("agent_id")
    file = form.get("file")
    if not file:
        return {"error": "file is required"}
    content = (await file.read()).decode("utf-8")
    if len(content) > 5_000_000:
        return {"error": "File too large. Maximum 5MB."}
    numbers = parse_csv(content)
    if not numbers:
        return {"error": "No valid phone numbers found in CSV"}
    result = await create_campaign(
        name=name,
        agent_id=agent_id,
        phone_numbers=numbers,
        max_concurrent=int(form.get("max_concurrent", "1")),
        provider=form.get("provider", "twilio"),
    )
    return result or {"error": "Failed to create campaign"}


# ─── Twilio Callbacks (no API key — validated by Twilio signature) ───

@app.post("/api/campaigns/{campaign_id}/call-status")
async def campaign_call_status(campaign_id: str, request: Request):
    form = await request.form()
    if not _validate_twilio_request(request, form):
        return Response(status_code=403, content="Invalid signature")
    status = form.get("CallStatus", "")
    if status == "completed":
        campaign = await get_campaign(campaign_id)
        if campaign:
            await db.update("campaigns", {"id": campaign_id}, {
                "completed_count": campaign.get("completed_count", 0) + 1,
            })
    return {"status": "ok"}


@app.post("/api/recording-status")
async def recording_status(request: Request):
    form = await request.form()
    if not _validate_twilio_request(request, form):
        return Response(status_code=403, content="Invalid signature")
    call_sid = form.get("CallSid", "")
    recording_url = form.get("RecordingUrl", "")
    if call_sid and recording_url:
        await db.update("calls", {"id": call_sid}, {
            "recording_url": f"{recording_url}.mp3",
        })
    return {"status": "ok"}


# ─── DNC List API ───

@app.get("/api/dnc", dependencies=[Depends(verify_api_key)])
async def list_dnc():
    from cogniflow_home.campaigns.dnc import get_list
    numbers = await get_list()
    return {"dnc_list": numbers, "count": len(numbers)}


@app.post("/api/dnc", dependencies=[Depends(verify_api_key)])
async def add_dnc(request: Request):
    from cogniflow_home.campaigns.dnc import add_number
    body = await request.json()
    phone = body.get("phone_number")
    if not phone:
        return {"error": "phone_number is required"}
    result = await add_number(phone, reason=body.get("reason", "manual"))
    return result or {"error": "Failed to add to DNC list"}


@app.delete("/api/dnc/{phone_number}", dependencies=[Depends(verify_api_key)])
async def remove_dnc(phone_number: str):
    from cogniflow_home.campaigns.dnc import remove_number
    await remove_number(phone_number)
    return {"status": "removed"}


# ─── Contact Import ───

@app.post("/api/contacts/import", dependencies=[Depends(verify_api_key)])
async def import_contacts(request: Request):
    import csv, io
    form = await request.form()
    file = form.get("file")
    if not file:
        return {"error": "file is required"}
    content = (await file.read()).decode("utf-8")
    if len(content) > 5_000_000:
        return {"error": "File too large. Maximum 5MB."}
    reader = csv.DictReader(io.StringIO(content))
    imported = 0
    skipped = 0
    for row in reader:
        phone = (row.get("phone") or row.get("phone_number") or "").strip()
        if not phone:
            continue
        if not phone.startswith("+"):
            phone = f"+{phone}"
        result = await db.upsert("contacts", {
            "phone_number": phone,
            "name": (row.get("name") or "").strip() or None,
            "email": (row.get("email") or "").strip() or None,
            "company": (row.get("company") or "").strip() or None,
        })
        if result:
            imported += 1
        else:
            skipped += 1
    return {"imported": imported, "skipped": skipped}


# ─── Revenue Attribution API ───

@app.get("/api/revenue", dependencies=[Depends(verify_api_key)])
async def api_revenue_summary(period_days: int = 30):
    from cogniflow_home.revenue.tracker import get_revenue_summary
    return await get_revenue_summary(period_days)


@app.post("/api/revenue/deal-closed", dependencies=[Depends(verify_api_key)])
async def api_deal_closed(request: Request):
    from cogniflow_home.revenue.tracker import handle_deal_closed
    body = await request.json()
    deal_id = body.get("deal_id")
    amount = body.get("amount", 0)
    contact_phone = body.get("contact_phone")
    if not deal_id or not contact_phone:
        return {"error": "deal_id and contact_phone are required"}
    await handle_deal_closed(deal_id, amount, contact_phone)
    return {"status": "attributed", "deal_id": deal_id}


# ─── Agent Cloning API ───

@app.post("/api/agents/clone", dependencies=[Depends(verify_api_key)])
async def api_clone_agent(request: Request):
    from cogniflow_home.cloning.cloner import AgentCloner
    body = await request.json()
    recording_urls = body.get("recording_urls", [])
    agent_name = body.get("agent_name", "Cloned Agent")
    if not recording_urls:
        return {"error": "recording_urls is required (list of audio URLs)"}
    cloner = AgentCloner()
    try:
        system_prompt = await cloner.clone_from_recordings(recording_urls, agent_name)
        result = await create_agent({
            "name": agent_name,
            "instructions": system_prompt,
            "is_active": True,
            "metadata": {"cloned": True, "source_recordings": len(recording_urls)},
        })
        return result or {"error": "Failed to save cloned agent"}
    except Exception:
        logger.exception("Agent cloning failed")
        return {"error": "Agent cloning failed. Check server logs for details."}


# ─── Latency Measurement ───

# ─── Knowledge Base API ───

@app.post("/api/agents/{agent_id}/knowledge", dependencies=[Depends(verify_api_key)])
async def upload_knowledge(agent_id: str, request: Request):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    from cogniflow_home.knowledge.base import kb
    form = await request.form()
    file = form.get("file")
    if not file:
        return {"error": "file is required"}
    content = (await file.read()).decode("utf-8")
    if len(content) > 5_000_000:
        return {"error": "File too large. Max 5MB."}
    await kb.ingest_text(agent_id, content, source=file.filename)
    return {"status": "ingested", "source": file.filename}


@app.post("/api/agents/{agent_id}/knowledge/query", dependencies=[Depends(verify_api_key)])
async def query_knowledge(agent_id: str, request: Request):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    from cogniflow_home.knowledge.base import kb
    body = await request.json()
    results = await kb.query(agent_id, body.get("question", ""))
    return {"results": results}


@app.delete("/api/agents/{agent_id}/knowledge/{source}", dependencies=[Depends(verify_api_key)])
async def delete_knowledge(agent_id: str, source: str):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    from cogniflow_home.knowledge.base import kb
    await kb.delete_source(agent_id, source)
    return {"status": "deleted"}


# ─── A/B Testing API ───

@app.post("/api/campaigns/{campaign_id}/ab-test", dependencies=[Depends(verify_api_key)])
async def create_ab_test(campaign_id: str, request: Request):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    from cogniflow_home.campaigns.ab_test import ab_test_manager
    body = await request.json()
    variants = body.get("variants", [])
    if not variants:
        return {"error": "variants is required"}
    result = await ab_test_manager.create_test(campaign_id, variants)
    return result


@app.get("/api/campaigns/{campaign_id}/ab-test/results", dependencies=[Depends(verify_api_key)])
async def get_ab_test_results(campaign_id: str):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    from cogniflow_home.campaigns.ab_test import ab_test_manager
    return await ab_test_manager.get_results(campaign_id)


# ─── Latency Measurement ───

@app.get("/api/latency", dependencies=[Depends(verify_api_key)])
async def api_measure_latency():
    from cogniflow_home.latency.measure import measure_service_latency
    results = await measure_service_latency()
    return {"latency_ms": results}


# ─── Compliance Events ───

@app.get("/api/compliance/events", dependencies=[Depends(verify_api_key)])
async def api_compliance_events(call_id: str | None = None):
    calls = await db.select("calls", {"id": call_id} if call_id else None,
                            order="created_at.desc", limit=50)
    events = []
    for call in calls:
        meta = call.get("metadata", {})
        if isinstance(meta, dict) and "compliance_events" in meta:
            for event in meta["compliance_events"]:
                event["call_id"] = call["id"]
                events.append(event)
    return {"events": events}


# ─── Contacts CRUD ───

@app.post("/api/contacts", dependencies=[Depends(verify_api_key)])
async def create_contact(request: Request):
    body = await request.json()
    phone = body.get("phone_number", "").strip()
    if not phone:
        return {"error": "phone_number is required"}
    if not phone.startswith("+"):
        phone = f"+{phone}"
    existing = await db.select("contacts", {"phone_number": phone})
    if existing:
        return {"error": "Contact with this phone number already exists", "existing": existing[0]}
    contact = {
        "phone_number": phone,
        "name": body.get("name", "").strip(),
        "email": body.get("email", "").strip(),
        "company": body.get("company", "").strip(),
        "notes": body.get("notes", ""),
        "tags": body.get("tags", []),
    }
    result = await db.insert("contacts", contact)
    return result or {"error": "Failed to create contact"}


@app.post("/api/contacts/import-mapped", dependencies=[Depends(verify_api_key)])
async def import_contacts_mapped(request: Request):
    body = await request.json()
    contacts_data = body.get("contacts", [])
    if not contacts_data:
        return {"error": "contacts array is required"}
    imported = 0
    duplicates = 0
    for row in contacts_data:
        phone = (row.get("phone_number") or "").strip()
        if not phone:
            continue
        if not phone.startswith("+"):
            phone = f"+{phone}"
        existing = await db.select("contacts", {"phone_number": phone})
        if existing:
            duplicates += 1
            continue
        await db.insert("contacts", {
            "phone_number": phone,
            "name": (row.get("name") or "").strip(),
            "email": (row.get("email") or "").strip(),
            "company": (row.get("company") or "").strip(),
            "tags": row.get("tags", []),
            "notes": row.get("notes", ""),
        })
        imported += 1
    return {"imported": imported, "duplicates": duplicates, "total": len(contacts_data)}


@app.delete("/api/contacts/{contact_id}", dependencies=[Depends(verify_api_key)])
async def delete_contact(contact_id: str):
    if not _valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    result = await db.delete("contacts", {"id": contact_id})
    return {"status": "deleted"} if result else {"error": "Contact not found"}


# ─── Agent Details & Performance ───

@app.get("/api/agents/{agent_id}", dependencies=[Depends(verify_api_key)])
async def api_get_agent(agent_id: str):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    agents = await db.select("agents", {"id": agent_id})
    if not agents:
        return {"error": "Agent not found"}
    return agents[0]


@app.delete("/api/agents/{agent_id}", dependencies=[Depends(verify_api_key)])
async def api_delete_agent(agent_id: str):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    result = await db.delete("agents", {"id": agent_id})
    return {"status": "deleted"} if result else {"error": "Agent not found"}


@app.get("/api/agents/{agent_id}/performance", dependencies=[Depends(verify_api_key)])
async def api_agent_performance(agent_id: str):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    calls = await db.select("calls", {"agent_id": agent_id}, order="created_at.desc", limit=200)
    total = len(calls)
    if total == 0:
        return {"total_calls": 0, "avg_duration": 0, "avg_sentiment": 0, "conversion_rate": 0, "dispositions": {}}
    durations = [c.get("duration_seconds", 0) for c in calls if c.get("duration_seconds")]
    sentiments = [c.get("sentiment_score", 0) for c in calls if c.get("sentiment_score") is not None]
    dispositions = {}
    for c in calls:
        d = c.get("disposition", "unknown")
        dispositions[d] = dispositions.get(d, 0) + 1
    interested = dispositions.get("interested", 0)
    return {
        "total_calls": total,
        "avg_duration": round(sum(durations) / len(durations), 1) if durations else 0,
        "avg_sentiment": round(sum(sentiments) / len(sentiments), 2) if sentiments else 0,
        "conversion_rate": round(interested / total * 100, 1) if total else 0,
        "dispositions": dispositions,
    }


@app.post("/api/agents/{agent_id}/test-chat", dependencies=[Depends(verify_api_key)])
async def api_test_agent_chat(agent_id: str, request: Request):
    if not _valid_uuid(agent_id):
        return JSONResponse({"error": "Invalid agent ID format"}, status_code=400)
    agents = await db.select("agents", {"id": agent_id})
    if not agents:
        return JSONResponse({"error": "Agent not found"}, status_code=404)
    agent = agents[0]
    body = await request.json()
    messages = body.get("messages", [])
    user_msg = body.get("message", "")
    if user_msg:
        messages.append({"role": "user", "content": user_msg})
    if not messages:
        return JSONResponse({"error": "No message provided"}, status_code=400)

    system_prompt = agent.get("instructions", "")
    greeting = agent.get("greeting", "")
    if greeting:
        system_prompt += f"\n\nYour greeting when starting a conversation: {greeting}"

    provider = agent.get("llm_provider", "openai")
    model = agent.get("llm_model", "gpt-4o-mini")
    temperature = agent.get("temperature", 0.7)

    try:
        from openai import AsyncOpenAI
        if provider == "groq" and settings.groq_api_key:
            client = AsyncOpenAI(
                api_key=settings.groq_api_key,
                base_url="https://api.groq.com/openai/v1",
            )
        elif settings.openai_api_key:
            client = AsyncOpenAI(api_key=settings.openai_api_key)
            if provider == "groq":
                model = "gpt-4o-mini"
                provider = "openai"
        else:
            return JSONResponse({"error": "No LLM provider configured"}, status_code=500)

        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            temperature=temperature,
            max_tokens=500,
        )
        reply = resp.choices[0].message.content
        return {"reply": reply, "model": model, "provider": provider}
    except Exception as e:
        logger.error(f"Test chat error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Integrations ───

@app.get("/api/integrations", dependencies=[Depends(verify_api_key)])
async def api_list_integrations():
    integrations = await db.select("integrations", order="created_at.desc")
    if not integrations:
        defaults = [
            {"type": "salesforce", "name": "Salesforce", "status": "disconnected"},
            {"type": "hubspot", "name": "HubSpot", "status": "disconnected"},
            {"type": "zoho", "name": "Zoho CRM", "status": "disconnected"},
            {"type": "google_calendar", "name": "Google Calendar", "status": "disconnected"},
            {"type": "razorpay", "name": "Razorpay", "status": "disconnected"},
            {"type": "webhook", "name": "Custom Webhook", "status": "disconnected"},
        ]
        return {"integrations": defaults}
    return {"integrations": integrations}


@app.patch("/api/integrations/{integration_id}", dependencies=[Depends(verify_api_key)])
async def api_update_integration(integration_id: str, request: Request):
    body = await request.json()
    if _valid_uuid(integration_id):
        result = await db.update("integrations", {"id": integration_id}, body)
        return result or {"error": "Integration not found"}
    result = await db.upsert("integrations", {
        "type": integration_id,
        "name": body.get("name", integration_id),
        "status": body.get("status", "connected"),
        "config": body.get("config", {}),
    })
    return result or {"error": "Failed to update integration"}


@app.post("/api/integrations/{integration_id}/test", dependencies=[Depends(verify_api_key)])
async def api_test_integration(integration_id: str):
    checks = {
        "hubspot": lambda: bool(settings.hubspot_api_key),
        "salesforce": lambda: bool(settings.salesforce_client_id),
        "google_calendar": lambda: bool(settings.google_service_account_json or settings.google_service_account_path),
        "razorpay": lambda: bool(settings.razorpay_key_id),
        "whatsapp": lambda: bool(settings.whatsapp_api_key),
    }
    checker = checks.get(integration_id)
    if not checker:
        return {"status": "unknown", "message": f"No test available for {integration_id}"}
    configured = checker()
    if configured:
        return {"status": "ok", "message": f"{integration_id} credentials are configured"}
    else:
        return {"status": "error", "message": f"{integration_id} is not configured. Add API keys in Settings."}


# ─── Analytics Trends & Agent Comparison ───

@app.get("/api/analytics/trends", dependencies=[Depends(verify_api_key)])
async def api_analytics_trends(days: int = 30):
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    calls = await db.select("calls", {"created_at": f"gte.{cutoff}"}, order="created_at.asc", limit=5000)
    daily = {}
    for c in calls:
        day = (c.get("created_at") or "")[:10]
        if not day:
            continue
        if day not in daily:
            daily[day] = {"date": day, "total": 0, "inbound": 0, "outbound": 0, "durations": [], "sentiments": [], "interested": 0}
        daily[day]["total"] += 1
        if c.get("direction") == "inbound":
            daily[day]["inbound"] += 1
        else:
            daily[day]["outbound"] += 1
        if c.get("duration_seconds"):
            daily[day]["durations"].append(c["duration_seconds"])
        if c.get("sentiment_score") is not None:
            daily[day]["sentiments"].append(c["sentiment_score"])
        if c.get("disposition") == "interested":
            daily[day]["interested"] += 1
    trends = []
    for day, d in sorted(daily.items()):
        trends.append({
            "date": day,
            "total": d["total"],
            "inbound": d["inbound"],
            "outbound": d["outbound"],
            "avg_duration": round(sum(d["durations"]) / len(d["durations"]), 1) if d["durations"] else 0,
            "avg_sentiment": round(sum(d["sentiments"]) / len(d["sentiments"]), 2) if d["sentiments"] else 0,
            "conversion_rate": round(d["interested"] / d["total"] * 100, 1) if d["total"] else 0,
        })
    return {"trends": trends}


@app.get("/api/analytics/agents", dependencies=[Depends(verify_api_key)])
async def api_analytics_agents(days: int = 30):
    from cogniflow_home.agents import list_agents

    agents = await list_agents()
    if not agents:
        return {"agents": []}

    try:
        perf = await db.rpc("agent_performance", {"days_back": days})
        if perf:
            agent_names = {str(a["id"]): a.get("name", "Unknown") for a in agents}
            results = []
            for p in perf:
                aid = str(p["agent_id"])
                total = p["total_calls"] or 0
                interested = p["interested_count"] or 0
                results.append({
                    "agent_id": aid,
                    "agent_name": agent_names.get(aid, "Unknown"),
                    "total_calls": total,
                    "avg_duration": float(p["avg_duration"] or 0),
                    "avg_sentiment": float(p["avg_sentiment"] or 0),
                    "conversion_rate": round(interested / total * 100, 1) if total else 0,
                })
            return {"agents": results}
    except Exception:
        logger.debug("agent_performance RPC not available, using fallback")

    from datetime import date, timedelta
    cutoff = (date.today() - timedelta(days=days)).isoformat()
    all_calls = await db.select("calls", {"created_at": f"gte.{cutoff}T00:00:00"}, limit=5000)

    agent_calls: dict[str, list] = {}
    for c in all_calls:
        aid = c.get("agent_id", "")
        if aid not in agent_calls:
            agent_calls[aid] = []
        agent_calls[aid].append(c)

    results = []
    for agent in agents:
        aid = str(agent.get("id", ""))
        calls = agent_calls.get(aid, [])
        total = len(calls)
        durations = [c.get("duration_seconds", 0) for c in calls if c.get("duration_seconds")]
        sentiments = [c.get("sentiment_score", 0) for c in calls if c.get("sentiment_score") is not None]
        interested = sum(1 for c in calls if c.get("disposition") == "interested")
        results.append({
            "agent_id": aid,
            "agent_name": agent.get("name", "Unknown"),
            "total_calls": total,
            "avg_duration": round(sum(durations) / len(durations), 1) if durations else 0,
            "avg_sentiment": round(sum(sentiments) / len(sentiments), 2) if sentiments else 0,
            "conversion_rate": round(interested / total * 100, 1) if total else 0,
        })
    return {"agents": results}


# ─── Campaign Analytics ───

@app.get("/api/campaigns/{campaign_id}/analytics", dependencies=[Depends(verify_api_key)])
async def api_campaign_analytics(campaign_id: str):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    calls = await db.select("calls", {"campaign_id": campaign_id}, limit=2000)
    total = len(calls)
    if total == 0:
        return {"total_calls": 0, "dispositions": {}, "conversion_rate": 0, "avg_duration": 0}
    dispositions = {}
    durations = []
    sentiments = []
    for c in calls:
        d = c.get("disposition", "unknown")
        dispositions[d] = dispositions.get(d, 0) + 1
        if c.get("duration_seconds"):
            durations.append(c["duration_seconds"])
        if c.get("sentiment_score") is not None:
            sentiments.append(c["sentiment_score"])
    interested = dispositions.get("interested", 0)
    return {
        "total_calls": total,
        "dispositions": dispositions,
        "conversion_rate": round(interested / total * 100, 1) if total else 0,
        "avg_duration": round(sum(durations) / len(durations), 1) if durations else 0,
        "avg_sentiment": round(sum(sentiments) / len(sentiments), 2) if sentiments else 0,
        "unique_contacts": len(set(c.get("caller_number", "") for c in calls)),
    }


# ─── Templates ───

@app.get("/api/templates", dependencies=[Depends(verify_api_key)])
async def api_list_templates():
    from cogniflow_home.templates.registry import list_templates
    return {"templates": list_templates()}


@app.get("/api/templates/{template_id}", dependencies=[Depends(verify_api_key)])
async def api_get_template(template_id: str):
    from cogniflow_home.templates.registry import get_template
    tpl = get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@app.post("/api/templates/{template_id}/deploy", dependencies=[Depends(verify_api_key)])
async def api_deploy_template(template_id: str, request: Request):
    from cogniflow_home.templates.registry import get_template
    tpl = get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")

    body = {}
    try:
        body = await request.json()
    except Exception:
        pass

    company_name = body.get("company_name", "My Company")
    agent_name = body.get("name", tpl["persona"]["agent_name"])
    instructions_extra = body.get("instructions_extra", "")

    instructions = tpl["instructions"].replace("{{COMPANY_NAME}}", company_name)
    if instructions_extra:
        instructions += f"\n\nADDITIONAL INSTRUCTIONS:\n{instructions_extra}"

    if settings.groq_api_key:
        llm_provider, llm_model = "groq", "llama-3.3-70b-versatile"
    elif settings.openai_api_key:
        llm_provider, llm_model = "openai", "gpt-4o-mini"
    else:
        llm_provider, llm_model = "openai", "gpt-4o-mini"

    lang = tpl["languages"][0] if tpl["languages"] else "en"
    indian_langs = {"hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "pa", "od"}

    if lang in indian_langs and settings.sarvam_api_key:
        tts_provider = "sarvam"
    elif settings.cartesia_api_key:
        tts_provider = "cartesia"
    elif settings.elevenlabs_api_key:
        tts_provider = "elevenlabs"
    elif settings.smallest_ai_api_key:
        tts_provider = "smallest"
    elif settings.sarvam_api_key:
        tts_provider = "sarvam"
    else:
        tts_provider = "cartesia"

    llm_provider = body.get("llm_provider", llm_provider)
    llm_model = body.get("llm_model", llm_model)
    tts_provider = body.get("tts_provider", tts_provider)

    agent_data = {
        "name": agent_name,
        "instructions": instructions,
        "greeting": f"Hello, this is {agent_name} from {company_name}.",
        "language": lang,
        "llm_provider": llm_provider,
        "llm_model": llm_model,
        "tts_provider": tts_provider,
        "voice_id": body.get("voice_id", tpl["persona"].get("voice_id", "")),
        "tools_enabled": tpl.get("tools_used", []),
        "metadata": {"template_id": template_id},
    }
    agent = await create_agent(agent_data)
    if not agent:
        return JSONResponse({"error": "Failed to deploy template agent"}, status_code=500)
    return {
        "agent_id": str(agent.get("id", "")),
        "agent_name": agent.get("name", agent_name),
        "template_id": template_id,
        "providers": {"llm": llm_provider, "tts": tts_provider},
        "status": "deployed",
    }


# ─── Benchmarks API ───

@app.post("/api/benchmarks/run", dependencies=[Depends(verify_api_key)])
async def api_run_benchmarks():
    from cogniflow_home.monitoring.voice_quality import VoiceQualityEvaluator
    from cogniflow_home.monitoring.scorecard import ScorecardGenerator

    voice_eval = VoiceQualityEvaluator()
    voice_data = {}

    try:
        from cogniflow_home.providers.smallest_tts import SmallestTTS
        tts = SmallestTTS(voice_id="emily", language="en", sample_rate=16000, raw_pcm=True)
        await tts.connect()
        ttfb = await voice_eval.measure_tts_ttfb(tts)
        emotion_results = await voice_eval.evaluate_tts_emotions(tts)
        await tts.close()

        all_scores = [r["avg_score"] for r in emotion_results.values() if r["avg_score"] > 0]
        voice_data = {
            "ttfb_ms": ttfb,
            "avg_emotion_score": round(sum(all_scores) / len(all_scores), 1) if all_scores else 0,
            "emotions": emotion_results,
        }
    except Exception:
        logger.exception("Voice benchmark failed")

    turn_data = None
    barge_data = None
    for pipeline in active_calls.values():
        ts = pipeline.turn_quality.get_summary()
        if ts:
            turn_data = ts
        bs = pipeline.barge_in_tracker.get_summary()
        if bs and bs.get("total_barge_ins", 0) > 0:
            barge_data = bs
        break

    intel_data = None
    try:
        from tests.intelligence.runner import run_all_tests
        intel_data = await run_all_tests()
    except Exception:
        logger.debug("Intelligence tests not available", exc_info=True)

    behaviour_data = None
    try:
        from tests.intelligence.runner import run_behaviour_tests
        from cogniflow_home.monitoring.discipline import DisciplineAnalyzer
        from cogniflow_home.monitoring.pacing import PacingAnalyzer
        from cogniflow_home.monitoring.boundaries import BoundaryDetector

        beh_results = await run_behaviour_tests()
        beh_pass_rate = beh_results.get("pass_rate", 0)

        persona_sc = min(beh_pass_rate / 20, 5.0)
        disc_sc = 5.0 - len(beh_results.get("failed_tests", [])) * 0.5
        disc_sc = max(disc_sc, 0)

        by_cat = beh_results.get("by_category", {})
        persona_rate = by_cat.get("persona", {}).get("pass_rate", 0)
        discipline_rate = by_cat.get("discipline", {}).get("pass_rate", 0)
        boundary_rate = by_cat.get("boundaries", {}).get("pass_rate", 0)
        adaptation_rate = by_cat.get("adaptation", {}).get("pass_rate", 0)
        escalation_rate = by_cat.get("escalation", {}).get("pass_rate", 0)

        behaviour_data = {
            "persona_consistency": round(persona_rate / 20, 2),
            "conversational_discipline": round(discipline_rate / 20, 2),
            "pacing_quality": round(by_cat.get("pacing", {}).get("pass_rate", 0) / 20, 2),
            "boundary_compliance": round(boundary_rate / 20, 2),
            "adaptation_score": round(adaptation_rate / 20, 2),
            "test_results": beh_results,
        }
    except Exception:
        logger.debug("Behaviour tests not available", exc_info=True)

    scorecard = ScorecardGenerator().generate(
        turn_quality=turn_data,
        barge_in=barge_data,
        voice_quality=voice_data or None,
        intelligence=intel_data,
        behaviour=behaviour_data,
    )

    try:
        await db.insert("benchmarks", {
            "scorecard": scorecard,
            "overall_score": scorecard["overall_score"],
            "grade": scorecard["grade"],
        })
    except Exception:
        pass

    return scorecard


@app.get("/api/benchmarks/latest", dependencies=[Depends(verify_api_key)])
async def api_latest_benchmark():
    try:
        results = await db.select("benchmarks", order="created_at.desc", limit=1)
        if results:
            return results[0]
    except Exception:
        pass
    return {"error": "No benchmark results yet. Run POST /api/benchmarks/run first."}


@app.get("/api/benchmarks/pipeline", dependencies=[Depends(verify_api_key)])
async def api_pipeline_metrics():
    from cogniflow_home.monitoring.pipeline_integrity import PipelineIntegrityChecker
    checker = PipelineIntegrityChecker()
    memory = await checker.check_memory_usage(active_calls)
    isolation = checker.check_state_isolation(active_calls)

    call_metrics = {}
    for call_id, pipeline in active_calls.items():
        call_metrics[call_id] = {
            "turns": pipeline.turn_quality.get_summary(),
            "barge_ins": pipeline.barge_in_tracker.get_summary(),
            "emotion_state": pipeline.emotional_mirror.current_state,
            "duration": int(time.time() - pipeline.state.started_at),
        }

    return {
        "memory": memory,
        "state_isolation": isolation,
        "active_calls": call_metrics,
    }


@app.get("/api/benchmarks/drift", dependencies=[Depends(verify_api_key)])
async def api_behaviour_drift():
    from cogniflow_home.monitoring.drift import BehaviourDriftDetector
    detector = BehaviourDriftDetector()
    try:
        return await detector.check_drift()
    except Exception:
        logger.debug("Drift check failed", exc_info=True)
        return {"status": "insufficient_data"}


# ─── Multi-Tenant / Organizations ───

@app.post("/api/organizations", dependencies=[Depends(verify_api_key)])
async def api_create_organization(request: Request):
    from cogniflow_home.db.tenant import create_organization
    body = await request.json()
    name = body.get("name", "").strip()
    slug = body.get("slug", "").strip().lower()
    owner_email = body.get("owner_email", "").strip()
    plan = body.get("plan", "starter")

    if not name or not slug or not owner_email:
        raise HTTPException(400, "name, slug, and owner_email are required")

    import re
    if not re.match(r'^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$', slug):
        raise HTTPException(400, "slug must be 3-50 lowercase alphanumeric with hyphens")

    from cogniflow_home.db.tenant import get_organization_by_slug
    existing = await get_organization_by_slug(slug)
    if existing:
        raise HTTPException(409, "Organization slug already exists")

    org = await create_organization(name, slug, owner_email, plan)
    if not org:
        raise HTTPException(500, "Failed to create organization")
    return org


@app.get("/api/organizations", dependencies=[Depends(verify_api_key)])
async def api_list_organizations(email: str = ""):
    from cogniflow_home.db.tenant import list_organizations
    return await list_organizations(email or None)


@app.get("/api/organizations/{org_id}", dependencies=[Depends(verify_api_key)])
async def api_get_organization(org_id: str):
    from cogniflow_home.db.tenant import get_organization
    if not _valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    org = await get_organization(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


@app.get("/api/organizations/{org_id}/members", dependencies=[Depends(verify_api_key)])
async def api_list_members(org_id: str):
    from cogniflow_home.db.tenant import get_members
    if not _valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    return await get_members(org_id)


@app.post("/api/organizations/{org_id}/members", dependencies=[Depends(verify_api_key)])
async def api_add_member(org_id: str, request: Request):
    from cogniflow_home.db.tenant import add_member
    if not _valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    body = await request.json()
    email = body.get("email", "").strip()
    role = body.get("role", "member")
    if not email:
        raise HTTPException(400, "email is required")
    if role not in ("owner", "admin", "member", "viewer"):
        raise HTTPException(400, "role must be owner, admin, member, or viewer")
    member = await add_member(org_id, email, role)
    if not member:
        raise HTTPException(500, "Failed to add member")
    return member


@app.delete("/api/organizations/{org_id}/members/{email}", dependencies=[Depends(verify_api_key)])
async def api_remove_member(org_id: str, email: str):
    from cogniflow_home.db.tenant import remove_member
    if not _valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    removed = await remove_member(org_id, email)
    if not removed:
        raise HTTPException(404, "Member not found")
    return {"status": "removed"}


async def resolve_tenant(x_tenant_id: str = Header(default=""), x_api_key: str = Header(default="")):
    """Resolve tenant from X-Tenant-Id header or org API key."""
    if x_tenant_id and _valid_uuid(x_tenant_id):
        from cogniflow_home.db.tenant import get_organization
        org = await get_organization(x_tenant_id)
        if org and org.get("is_active"):
            return org
    if x_api_key:
        from cogniflow_home.db.tenant import get_organization_by_api_key
        org = await get_organization_by_api_key(x_api_key)
        if org:
            return org
    return None
