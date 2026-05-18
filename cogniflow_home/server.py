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

import asyncio
import logging
import re
import time
import uuid as _uuid
from contextlib import asynccontextmanager
from typing import Optional

import httpx
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
from cogniflow_home.tenants.auth import AuthContext, get_auth_context, generate_api_key

logger = logging.getLogger("cogniflow_home")

active_calls: dict[str, VoicePipeline] = {}
# call_sid → agent_id override for test calls
_pending_agent_overrides: dict[str, str] = {}

_UUID_RE = re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$', re.I)


def _valid_uuid(val: str) -> bool:
    return bool(_UUID_RE.match(val))


# ─── Rate Limiting (per-tenant) ───

class RateLimiter:
    def __init__(self, max_calls: int = 10, window_seconds: int = 60):
        self.max_calls = max_calls
        self.window = window_seconds
        self._buckets: dict[str, list[float]] = {}

    def check(self, tenant_id: str = "__global__") -> bool:
        now = time.time()
        if tenant_id not in self._buckets:
            self._buckets[tenant_id] = []
        calls = self._buckets[tenant_id]
        calls[:] = [t for t in calls if now - t < self.window]
        if len(calls) >= self.max_calls:
            return False
        calls.append(now)
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

    try:
        await resume_active_campaigns()
    except Exception:
        logger.exception("Failed to resume campaigns on startup — continuing anyway")

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
        self._allowed_origins = set(settings.cors_origins)

    def _get_allowed_origin(self, headers: dict) -> bytes | None:
        """Check if the request Origin is in the allowed list."""
        origin = headers.get(b"origin", b"").decode()
        if origin in self._allowed_origins:
            return origin.encode()
        return None

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        if scope["type"] == "websocket":
            await self.app(scope, receive, send)
            return

        if scope["type"] == "http":
            headers = dict(scope.get("headers", []))
            request_id = headers.get(b"x-request-id", str(_uuid.uuid4())[:8].encode()).decode()
            scope.setdefault("state", {})["request_id"] = request_id
            allowed_origin = self._get_allowed_origin(headers)

            method = scope.get("method", "GET")
            if method == "OPTIONS":
                response_headers = [
                    (b"access-control-allow-methods", b"GET, POST, PATCH, DELETE, OPTIONS"),
                    (b"access-control-allow-headers", b"Content-Type, Authorization, X-Api-Key, X-Tenant-Id, X-Request-ID"),
                    (b"access-control-max-age", b"86400"),
                ]
                if allowed_origin:
                    response_headers.insert(0, (b"access-control-allow-origin", allowed_origin))
                await send({"type": "http.response.start", "status": 204, "headers": response_headers})
                await send({"type": "http.response.body", "body": b""})
                return

            async def send_with_cors(message):
                if message["type"] == "http.response.start":
                    h = list(message.get("headers", []))
                    if allowed_origin:
                        h.append((b"access-control-allow-origin", allowed_origin))
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
        },
        "tts": {
            "sarvam": "configured" if settings.sarvam_api_key else "not_configured",
            "smallest": "configured" if settings.smallest_ai_api_key else "not_configured",
        },
    }

    checks["telephony"] = {
        "twilio": "configured" if settings.twilio_account_sid else "not_configured",
        "exotel": "configured" if settings.exotel_api_key else "not_configured",
        "vobiz": "configured" if settings.vobiz_auth_id else "not_configured",
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


@app.get("/api/providers/health")
async def providers_health():
    """Return circuit breaker state for all registered provider failover chains."""
    from cogniflow_home.providers.failover import all_chain_status

    chains = all_chain_status()
    if not chains:
        return {
            "status": "no_chains_registered",
            "message": "No active calls — failover chains are created per-call.",
            "chains": {},
        }

    # Determine overall health from breaker states
    all_closed = True
    any_open = False
    for category, breakers in chains.items():
        for b in breakers:
            if b["state"] != "CLOSED":
                all_closed = False
            if b["state"] == "OPEN":
                any_open = True

    if all_closed:
        status = "healthy"
    elif any_open:
        status = "degraded"
    else:
        status = "recovering"  # HALF_OPEN

    return {"status": status, "chains": chains}


@app.get("/api/voice/diagnose")
async def diagnose_voice():
    """Test each voice provider connection in isolation."""
    results = {}

    # STT
    try:
        from cogniflow_home.providers.stt import DeepgramSTT
        stt = DeepgramSTT(language="en", sample_rate=16000)
        await asyncio.wait_for(stt.connect(), timeout=10)
        await stt.close()
        results["stt_deepgram"] = "ok"
    except Exception as e:
        results["stt_deepgram"] = f"error: {e}"

    # TTS
    try:
        from cogniflow_home.providers.smallest_tts import SmallestTTS
        tts = SmallestTTS(voice_id="emily", language="en", sample_rate=16000, raw_pcm=True)
        await tts.connect()
        chunks = []
        async for chunk in tts.synthesize("hello"):
            chunks.append(chunk)
        results["tts_smallest"] = f"ok ({len(chunks)} chunks, {sum(len(c) for c in chunks)} bytes)"
    except Exception as e:
        results["tts_smallest"] = f"error: {e}"

    # LLM
    try:
        from cogniflow_home.providers.groq_llm import GroqLLM
        llm = GroqLLM(system_prompt="You are a test.")
        await asyncio.wait_for(llm.prewarm(), timeout=10)
        results["llm_groq"] = "ok"
    except Exception as e:
        results["llm_groq"] = f"error: {e}"

    # Agent lookup
    try:
        agents = await list_agents()
        if agents:
            agent_config = await get_agent_by_id(agents[0]["id"])
            results["agent_lookup"] = f"ok ({agent_config.name})" if agent_config else "error: agent not found"
        else:
            results["agent_lookup"] = "no agents"
    except Exception as e:
        results["agent_lookup"] = f"error: {e}"

    return results


# ─── API Hub: Provider status, usage tracking ───

@app.get("/api/providers")
async def api_provider_status(auth: AuthContext = Depends(get_auth_context)):
    """Full provider inventory with status, category, pricing links, and usage."""
    from datetime import datetime, timezone

    providers = [
        {
            "id": "deepgram", "name": "Deepgram", "category": "stt",
            "configured": bool(settings.deepgram_api_key),
            "docs": "https://console.deepgram.com",
            "pricing": "https://deepgram.com/pricing",
            "description": "Speech-to-text (Nova-2). Pay-per-minute.",
            "unit": "min", "rate_per_unit": 0.36,
        },
        {
            "id": "sarvam_stt", "name": "Sarvam AI (STT)", "category": "stt",
            "configured": bool(settings.sarvam_api_key),
            "docs": "https://dashboard.sarvam.ai",
            "pricing": "https://www.sarvam.ai/pricing",
            "description": "Indian language STT. Hindi, Tamil, Telugu + 7 more.",
            "unit": "min", "rate_per_unit": 0.20,
        },
        {
            "id": "groq", "name": "Groq", "category": "llm",
            "configured": bool(settings.groq_api_key),
            "docs": "https://console.groq.com",
            "pricing": "https://groq.com/pricing",
            "description": "Ultra-fast LLM inference. Llama 3.3 70B.",
            "unit": "1K tokens", "rate_per_unit": 0.06,
        },
        {
            "id": "sarvam_tts", "name": "Sarvam AI (TTS)", "category": "tts",
            "configured": bool(settings.sarvam_api_key),
            "docs": "https://dashboard.sarvam.ai",
            "pricing": "https://www.sarvam.ai/pricing",
            "description": "Indian language TTS. Native Hindi, Tamil, Telugu voices.",
            "unit": "1K chars", "rate_per_unit": 0.08,
        },
        {
            "id": "smallest", "name": "Smallest AI", "category": "tts",
            "configured": bool(settings.smallest_ai_api_key),
            "docs": "https://smallest.ai",
            "pricing": "https://smallest.ai/pricing",
            "description": "Lightning TTS with emotion control. Low-latency streaming.",
            "unit": "1K chars", "rate_per_unit": 0.05,
        },
        {
            "id": "twilio", "name": "Twilio", "category": "telephony",
            "configured": bool(settings.twilio_account_sid),
            "docs": "https://console.twilio.com",
            "pricing": "https://www.twilio.com/en-us/voice/pricing",
            "description": "Global telephony. Inbound + outbound voice calls.",
            "unit": "min", "rate_per_unit": 1.30,
        },
        {
            "id": "exotel", "name": "Exotel", "category": "telephony",
            "configured": bool(settings.exotel_api_key),
            "docs": "https://my.exotel.com",
            "pricing": "https://exotel.com/pricing",
            "description": "India telephony. Local DIDs, IVR, call recording.",
            "unit": "min", "rate_per_unit": 0.50,
        },
        {
            "id": "vobiz", "name": "Vobiz", "category": "telephony",
            "configured": bool(settings.vobiz_auth_id),
            "docs": "https://console.vobiz.ai",
            "pricing": "https://www.docs.vobiz.ai",
            "description": "India-first telephony. ₹0.45/min voice, INR billing, TRAI compliant.",
            "unit": "min", "rate_per_unit": 0.45,
        },
        {
            "id": "supabase", "name": "Supabase", "category": "database",
            "configured": bool(settings.supabase_url),
            "docs": "https://supabase.com/dashboard",
            "pricing": "https://supabase.com/pricing",
            "description": "PostgreSQL database + auth + realtime + storage.",
            "unit": "GB", "rate_per_unit": 0.0,
        },
        {
            "id": "hubspot", "name": "HubSpot", "category": "crm",
            "configured": bool(settings.hubspot_api_key),
            "docs": "https://app.hubspot.com",
            "pricing": "https://www.hubspot.com/pricing",
            "description": "CRM sync. Auto-log calls, contacts, deals.",
            "unit": "api calls", "rate_per_unit": 0.0,
        },
        {
            "id": "salesforce", "name": "Salesforce", "category": "crm",
            "configured": bool(settings.salesforce_client_id),
            "docs": "https://login.salesforce.com",
            "pricing": "https://www.salesforce.com/pricing",
            "description": "Enterprise CRM integration. Leads, contacts, activities.",
            "unit": "api calls", "rate_per_unit": 0.0,
        },
        {
            "id": "whatsapp", "name": "WhatsApp Business", "category": "messaging",
            "configured": bool(settings.whatsapp_api_key),
            "docs": "https://business.facebook.com",
            "pricing": "https://developers.facebook.com/docs/whatsapp/pricing",
            "description": "WhatsApp Business API for follow-ups & notifications.",
            "unit": "msg", "rate_per_unit": 0.05,
        },
        {
            "id": "razorpay", "name": "Razorpay", "category": "payments",
            "configured": bool(settings.razorpay_key_id),
            "docs": "https://dashboard.razorpay.com",
            "pricing": "https://razorpay.com/pricing",
            "description": "Payment gateway for INR billing & subscriptions.",
            "unit": "txn", "rate_per_unit": 0.0,
        },
        {
            "id": "google_calendar", "name": "Google Calendar", "category": "scheduling",
            "configured": bool(settings.google_service_account_json or settings.google_service_account_path),
            "docs": "https://console.cloud.google.com",
            "pricing": "https://workspace.google.com/pricing",
            "description": "Calendar booking & appointment scheduling.",
            "unit": "api calls", "rate_per_unit": 0.0,
        },
        {
            "id": "smtp", "name": "Email (SMTP)", "category": "messaging",
            "configured": bool(settings.smtp_user and settings.smtp_password),
            "docs": "",
            "pricing": "",
            "description": f"Outbound email via {settings.smtp_host}. Sender: {settings.smtp_from_email}",
            "unit": "email", "rate_per_unit": 0.0,
        },
    ]

    # Pull usage from usage_records if tenant-scoped
    usage_by_provider = {}
    if auth.tenant_id:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        records = await db.select("usage_records", {"tenant_id": auth.tenant_id}, limit=5000)
        for r in records:
            if (r.get("recorded_at") or "")[:7] == month:
                p = r.get("provider", "")
                usage_by_provider[p] = usage_by_provider.get(p, 0) + r.get("duration_seconds", 0)

    # Count calls by provider this month
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()
    call_match = {"created_at": f"gte.{month_start}"}
    if auth.tenant_id:
        call_match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", call_match, limit=10000)

    total_calls = len(calls)
    total_minutes = sum(c.get("duration_seconds", 0) for c in calls) / 60
    calls_by_provider = {}
    for c in calls:
        p = c.get("provider", "twilio")
        calls_by_provider[p] = calls_by_provider.get(p, 0) + 1

    summary = {
        "total_providers": len(providers),
        "configured": sum(1 for p in providers if p["configured"]),
        "not_configured": sum(1 for p in providers if not p["configured"]),
        "this_month_calls": total_calls,
        "this_month_minutes": round(total_minutes, 1),
        "calls_by_provider": calls_by_provider,
    }

    return {"providers": providers, "summary": summary}


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


# ─── Vobiz XML webhooks ───

@app.post("/voice/vobiz/inbound")
async def vobiz_inbound(request: Request):
    """Vobiz inbound call → return <Stream> XML to start audio WebSocket."""
    form = await request.form()
    call_uuid = form.get("CallUUID", "")
    caller = form.get("From", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/vobiz/ws"
    provider = get_provider("vobiz")
    xml = provider.get_twiml_or_response(ws_url, caller)
    return Response(content=xml, media_type="application/xml")


@app.post("/voice/vobiz/outbound")
async def vobiz_outbound(request: Request):
    """Vobiz outbound call answered → return <Stream> XML."""
    form = await request.form()
    called = form.get("To", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/vobiz/ws"
    provider = get_provider("vobiz")
    xml = provider.get_twiml_or_response(ws_url, called)
    return Response(content=xml, media_type="application/xml")


@app.post("/voice/vobiz/hangup")
async def vobiz_hangup(request: Request):
    """Vobiz hangup callback — log call end."""
    form = await request.form()
    call_uuid = form.get("CallUUID", "")
    duration = form.get("Duration", "0")
    hangup_cause = form.get("HangupCause", "NORMAL_CLEARING")
    logger.info(f"[VOBIZ] Call ended: {call_uuid} | Duration: {duration}s | Cause: {hangup_cause}")
    return Response(content="OK", status_code=200)


@app.post("/voice/vobiz/ring")
async def vobiz_ring(request: Request):
    """Vobiz ring callback — outbound call is ringing."""
    form = await request.form()
    logger.info(f"[VOBIZ] Call ringing: {form.get('CallUUID', '')}")
    return Response(content="OK", status_code=200)


@app.post("/voice/vobiz/stream-status")
async def vobiz_stream_status(request: Request):
    """Vobiz stream status callback."""
    form = await request.form()
    logger.info(f"[VOBIZ] Stream event: {form.get('Event', '')} | Call: {form.get('CallUUID', '')}")
    return Response(content="OK", status_code=200)


@app.get("/api/vobiz/numbers")
async def api_vobiz_numbers(auth: AuthContext = Depends(get_auth_context)):
    """List available Vobiz DID numbers for purchase."""
    if not settings.vobiz_auth_id:
        return {"numbers": [], "error": "Vobiz not configured"}
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"https://api.vobiz.ai/api/v1/Account/{settings.vobiz_auth_id}/PhoneNumber/",
            headers={
                "X-Auth-ID": settings.vobiz_auth_id,
                "X-Auth-Token": settings.vobiz_auth_token,
            },
            params={"country_iso": "IN", "type": "local"},
        )
        data = response.json()
    return {"numbers": data.get("objects", [])}


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
            tenant_id=agent_config.tenant_id,
            emotion_profile=agent_config.emotion_profile,
            voice_gender=agent_config.voice_gender,
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

    if not settings.groq_api_key:
        await websocket.accept()
        import json as _json
        await websocket.send_text(_json.dumps({"event": "error", "message": "No LLM provider configured. Add GROQ_API_KEY to .env"}))
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
            tenant_id=agent_config.tenant_id,
            emotion_profile=agent_config.emotion_profile,
            voice_gender=agent_config.voice_gender,
        )

        async def _send_transcript(role: str, text: str):
            await provider.send_event("transcript", {"role": role, "text": text})

        pipeline.on_transcript = _send_transcript

        async def _send_latency(data: dict):
            await provider.send_event("latency", data)

        pipeline.on_latency = _send_latency
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

@app.post("/api/call")
async def make_outbound_call(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    to_number = body.get("to_number")
    provider_name = body.get("provider", "twilio")
    agent_id = body.get("agent_id")

    if not to_number:
        return {"error": "to_number is required"}

    if not _call_limiter.check(auth.tenant_id or "__global__"):
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


@app.post("/api/call/{call_id}/hangup")
async def hangup_call(call_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(call_id):
        return {"error": "Invalid call ID format"}
    pipeline = active_calls.get(call_id)
    if not pipeline:
        return {"error": "Call not found or already ended"}
    if auth.tenant_id and getattr(pipeline.state, "tenant_id", "") != auth.tenant_id:
        return {"error": "Call not found or already ended"}
    await pipeline.stop()
    active_calls.pop(call_id, None)
    return {"status": "ended", "call_id": call_id}


@app.get("/api/call/{call_id}/status")
async def call_status(call_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(call_id):
        return {"error": "Invalid call ID format"}
    pipeline = active_calls.get(call_id)
    if pipeline:
        if auth.tenant_id and getattr(pipeline.state, "tenant_id", "") != auth.tenant_id:
            return {"error": "Call not found"}
        return {
            "call_id": call_id,
            "status": "active",
            "duration": int(time.time() - pipeline.state.started_at),
            "turns": len(pipeline.state.transcript),
        }
    match = {"id": call_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", match)
    if calls:
        return calls[0]
    return {"error": "Call not found"}


# ─── Calls API ───

@app.get("/api/calls")
async def list_calls(
    direction: str | None = None,
    status: str | None = None,
    caller: str | None = None,
    limit: int = 50,
    offset: int = 0,
    auth: AuthContext = Depends(get_auth_context),
):
    match = {}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    if direction:
        match["direction"] = direction
    if status:
        match["status"] = status
    if caller:
        match["caller_number"] = caller

    calls = await db.select("calls", match or None, order="started_at.desc", limit=limit)
    return {"calls": calls, "count": len(calls)}


@app.get("/api/calls/{call_id}")
async def get_call(call_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(call_id):
        return {"error": "Invalid call ID format"}
    match = {"id": call_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", match)
    if not calls:
        return {"error": "Call not found"}
    return calls[0]


# ─── Contacts API ───

@app.get("/api/contacts")
async def list_contacts(limit: int = 50, search: str | None = None, auth: AuthContext = Depends(get_auth_context)):
    match = {}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    contacts = await db.select("contacts", match or None, order="last_call_at.desc.nullslast", limit=limit)
    if search:
        search_lower = search.lower()
        contacts = [c for c in contacts if
                    search_lower in (c.get("name") or "").lower() or
                    search_lower in (c.get("phone_number") or "") or
                    search_lower in (c.get("company") or "").lower()]
    return {"contacts": contacts, "count": len(contacts)}


@app.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    match = {"id": contact_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    contacts = await db.select("contacts", match)
    if not contacts:
        return {"error": "Contact not found"}
    contact = contacts[0]
    calls = await db.select("calls", {"caller_number": contact["phone_number"]},
                            order="started_at.desc", limit=20)
    contact["calls"] = calls
    return contact


@app.patch("/api/contacts/{contact_id}")
async def update_contact(contact_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    body = await request.json()
    allowed = {"name", "email", "company", "notes", "language", "tags"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return {"error": "No valid fields to update"}
    match = {"id": contact_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    result = await db.update("contacts", match, updates)
    return result or {"error": "Contact not found"}


# ─── Webhooks API ───

@app.post("/api/webhooks")
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


@app.get("/api/webhooks")
async def list_webhooks(auth: AuthContext = Depends(get_auth_context)):
    match = {}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    webhooks = await db.select("webhook_endpoints", match or None)
    return {"webhooks": webhooks}


@app.delete("/api/webhooks/{webhook_id}")
async def delete_webhook(webhook_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(webhook_id):
        return {"error": "Invalid webhook ID format"}
    match = {"id": webhook_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    await db.update("webhook_endpoints", match, {"is_active": False})
    return {"status": "deleted", "id": webhook_id}


# ─── Stats API ───

@app.get("/api/stats")
async def get_stats(auth: AuthContext = Depends(get_auth_context)):
    from datetime import date

    today_iso = date.today().isoformat()
    match = {"created_at": f"gte.{today_iso}T00:00:00"}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    today_calls = await db.select(
        "calls",
        match,
        order="created_at.desc",
        limit=500,
    )

    today_total = len(today_calls)
    inbound = sum(1 for c in today_calls if c.get("direction") == "inbound")
    outbound = sum(1 for c in today_calls if c.get("direction") == "outbound")
    durations = [c.get("duration_seconds", 0) for c in today_calls if c.get("duration_seconds")]
    avg_duration = sum(durations) / len(durations) if durations else 0

    count_match = {}
    if auth.tenant_id:
        count_match["tenant_id"] = auth.tenant_id
    all_time_count = await db.count("calls", count_match or None)

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

@app.get("/api/agents")
async def api_list_agents(auth: AuthContext = Depends(get_auth_context)):
    agents = await list_agents()
    if auth.tenant_id:
        agents = [a for a in agents if a.get("tenant_id") == auth.tenant_id]
    return {"agents": agents}


@app.post("/api/agents")
async def api_create_agent(request: Request, auth: AuthContext = Depends(get_auth_context)):
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
        "tts_provider": body.get("tts_provider", "smallest"),
        "temperature": body.get("temperature", 0.7),
        "tools_enabled": body.get("tools_enabled", []),
        "max_call_duration": body.get("max_call_duration", 600),
        "enable_memory": body.get("enable_memory", True),
        "enable_prediction": body.get("enable_prediction", True),
        "enable_emotion": body.get("enable_emotion", True),
        "enable_language_switch": body.get("enable_language_switch", True),
        "enable_rag": body.get("enable_rag", False),
        "emotion_profile": body.get("emotion_profile", "friendly"),
        "voice_gender": body.get("voice_gender", "female"),
    }
    if auth.tenant_id:
        agent_data["tenant_id"] = auth.tenant_id
    result = await create_agent(agent_data)
    if not result:
        return JSONResponse({"error": "Failed to create agent"}, status_code=500)
    return result


@app.patch("/api/agents/{agent_id}")
async def api_update_agent(agent_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id, "tenant_id": auth.tenant_id})
        if not agents:
            return {"error": "Agent not found"}
    body = await request.json()
    allowed = {"name", "instructions", "voice_id", "language", "phone_numbers", "is_active", "metadata",
               "greeting", "guardrails", "llm_provider", "llm_model", "tts_provider", "tts_voice_name",
               "max_call_duration", "enable_memory", "enable_prediction", "enable_emotion",
               "enable_language_switch", "enable_rag", "temperature", "tools_enabled",
               "emotion_profile", "voice_gender"}
    updates = {k: v for k, v in body.items() if k in allowed}
    result = await update_agent(agent_id, updates)
    return result or {"error": "Agent not found"}


# ─── Campaigns API ───

@app.get("/api/campaigns")
async def api_list_campaigns(auth: AuthContext = Depends(get_auth_context)):
    campaigns = await list_campaigns()
    if auth.tenant_id:
        campaigns = [c for c in campaigns if c.get("tenant_id") == auth.tenant_id]
    return {"campaigns": campaigns}


@app.get("/api/campaigns/{campaign_id}")
async def api_get_campaign(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    campaign = await get_campaign(campaign_id)
    if not campaign:
        return {"error": "Campaign not found"}
    if auth.tenant_id and campaign.get("tenant_id") != auth.tenant_id:
        return {"error": "Campaign not found"}
    return campaign


@app.post("/api/campaigns")
async def api_create_campaign(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    name = body.get("name")
    phone_numbers = body.get("phone_numbers", [])
    if not name or not phone_numbers:
        return {"error": "name and phone_numbers are required"}
    campaign_data = dict(
        name=name,
        agent_id=body.get("agent_id"),
        phone_numbers=phone_numbers,
        max_concurrent=body.get("max_concurrent", 1),
    )
    if auth.tenant_id:
        campaign_data["tenant_id"] = auth.tenant_id
    result = await create_campaign(**campaign_data)
    return result or {"error": "Failed to create campaign"}


@app.post("/api/campaigns/{campaign_id}/start")
async def api_start_campaign(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
    return await start_campaign(campaign_id)


@app.post("/api/campaigns/{campaign_id}/pause")
async def api_pause_campaign(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
    return await pause_campaign(campaign_id)


@app.post("/api/campaigns/upload")
async def api_upload_campaign(request: Request, auth: AuthContext = Depends(get_auth_context)):
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
    campaign_kwargs = dict(
        name=name,
        agent_id=agent_id,
        phone_numbers=numbers,
        max_concurrent=int(form.get("max_concurrent", "1")),
        provider=form.get("provider", "twilio"),
    )
    if auth.tenant_id:
        campaign_kwargs["tenant_id"] = auth.tenant_id
    result = await create_campaign(**campaign_kwargs)
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

@app.get("/api/dnc")
async def list_dnc(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.campaigns.dnc import get_list
    numbers = await get_list()
    return {"dnc_list": numbers, "count": len(numbers)}


@app.post("/api/dnc")
async def add_dnc(request: Request, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.campaigns.dnc import add_number
    body = await request.json()
    phone = body.get("phone_number")
    if not phone:
        return {"error": "phone_number is required"}
    result = await add_number(phone, reason=body.get("reason", "manual"))
    return result or {"error": "Failed to add to DNC list"}


@app.delete("/api/dnc/{phone_number}")
async def remove_dnc(phone_number: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.campaigns.dnc import remove_number
    await remove_number(phone_number)
    return {"status": "removed"}


# ─── Contact Import ───

@app.post("/api/contacts/import")
async def import_contacts(request: Request, auth: AuthContext = Depends(get_auth_context)):
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
        contact_data = {
            "phone_number": phone,
            "name": (row.get("name") or "").strip() or None,
            "email": (row.get("email") or "").strip() or None,
            "company": (row.get("company") or "").strip() or None,
        }
        if auth.tenant_id:
            contact_data["tenant_id"] = auth.tenant_id
        result = await db.upsert("contacts", contact_data)
        if result:
            imported += 1
        else:
            skipped += 1
    return {"imported": imported, "skipped": skipped}


# ─── Revenue Attribution API ───

@app.get("/api/revenue")
async def api_revenue_summary(period_days: int = 30, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.revenue.tracker import get_revenue_summary
    return await get_revenue_summary(period_days)


@app.post("/api/revenue/deal-closed")
async def api_deal_closed(request: Request, auth: AuthContext = Depends(get_auth_context)):
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

@app.post("/api/agents/clone")
async def api_clone_agent(request: Request, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.cloning.cloner import AgentCloner
    body = await request.json()
    recording_urls = body.get("recording_urls", [])
    agent_name = body.get("agent_name", "Cloned Agent")
    if not recording_urls:
        return {"error": "recording_urls is required (list of audio URLs)"}
    cloner = AgentCloner()
    try:
        system_prompt = await cloner.clone_from_recordings(recording_urls, agent_name)
        agent_data = {
            "name": agent_name,
            "instructions": system_prompt,
            "is_active": True,
            "metadata": {"cloned": True, "source_recordings": len(recording_urls)},
        }
        if auth.tenant_id:
            agent_data["tenant_id"] = auth.tenant_id
        result = await create_agent(agent_data)
        return result or {"error": "Failed to save cloned agent"}
    except Exception:
        logger.exception("Agent cloning failed")
        return {"error": "Agent cloning failed. Check server logs for details."}


# ─── Latency Measurement ───

# ─── Knowledge Base API ───

@app.post("/api/agents/{agent_id}/knowledge")
async def upload_knowledge(agent_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id})
        if not agents or agents[0].get("tenant_id") != auth.tenant_id:
            return {"error": "Agent not found"}
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


@app.post("/api/agents/{agent_id}/knowledge/query")
async def query_knowledge(agent_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id})
        if not agents or agents[0].get("tenant_id") != auth.tenant_id:
            return {"error": "Agent not found"}
    from cogniflow_home.knowledge.base import kb
    body = await request.json()
    results = await kb.query(agent_id, body.get("question", ""))
    return {"results": results}


@app.delete("/api/agents/{agent_id}/knowledge/{source}")
async def delete_knowledge(agent_id: str, source: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agents = await db.select("agents", {"id": agent_id})
        if not agents or agents[0].get("tenant_id") != auth.tenant_id:
            return {"error": "Agent not found"}
    from cogniflow_home.knowledge.base import kb
    await kb.delete_source(agent_id, source)
    return {"status": "deleted"}


# ─── A/B Testing API ───

@app.post("/api/campaigns/{campaign_id}/ab-test")
async def create_ab_test(campaign_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
    from cogniflow_home.campaigns.ab_test import ab_test_manager
    body = await request.json()
    variants = body.get("variants", [])
    if not variants:
        return {"error": "variants is required"}
    result = await ab_test_manager.create_test(campaign_id, variants)
    return result


@app.get("/api/campaigns/{campaign_id}/ab-test/results")
async def get_ab_test_results(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
    from cogniflow_home.campaigns.ab_test import ab_test_manager
    return await ab_test_manager.get_results(campaign_id)


# ─── Latency Measurement ───

@app.get("/api/latency")
async def api_measure_latency(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.latency.measure import measure_service_latency
    results = await measure_service_latency()
    return {"latency_ms": results}


# ─── Compliance Events ───

@app.get("/api/compliance/events")
async def api_compliance_events(call_id: str | None = None, auth: AuthContext = Depends(get_auth_context)):
    match = {}
    if call_id:
        match["id"] = call_id
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", match or None, order="created_at.desc", limit=50)
    events = []
    for call in calls:
        meta = call.get("metadata", {})
        if isinstance(meta, dict) and "compliance_events" in meta:
            for event in meta["compliance_events"]:
                event["call_id"] = call["id"]
                events.append(event)
    return {"events": events}


# ─── Contacts CRUD ───

@app.post("/api/contacts")
async def create_contact(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    phone = body.get("phone_number", "").strip()
    if not phone:
        return {"error": "phone_number is required"}
    if not phone.startswith("+"):
        phone = f"+{phone}"
    match = {"phone_number": phone}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    existing = await db.select("contacts", match)
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
    if auth.tenant_id:
        contact["tenant_id"] = auth.tenant_id
    result = await db.insert("contacts", contact)
    return result or {"error": "Failed to create contact"}


@app.post("/api/contacts/import-mapped")
async def import_contacts_mapped(request: Request, auth: AuthContext = Depends(get_auth_context)):
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
        dup_match = {"phone_number": phone}
        if auth.tenant_id:
            dup_match["tenant_id"] = auth.tenant_id
        existing = await db.select("contacts", dup_match)
        if existing:
            duplicates += 1
            continue
        contact_row = {
            "phone_number": phone,
            "name": (row.get("name") or "").strip(),
            "email": (row.get("email") or "").strip(),
            "company": (row.get("company") or "").strip(),
            "tags": row.get("tags", []),
            "notes": row.get("notes", ""),
        }
        if auth.tenant_id:
            contact_row["tenant_id"] = auth.tenant_id
        await db.insert("contacts", contact_row)
        imported += 1
    return {"imported": imported, "duplicates": duplicates, "total": len(contacts_data)}


@app.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    match = {"id": contact_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    result = await db.delete("contacts", match)
    return {"status": "deleted"} if result else {"error": "Contact not found"}


# ─── Agent Details & Performance ───

@app.get("/api/agents/{agent_id}")
async def api_get_agent(agent_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    match = {"id": agent_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    agents = await db.select("agents", match)
    if not agents:
        return {"error": "Agent not found"}
    return agents[0]


@app.delete("/api/agents/{agent_id}")
async def api_delete_agent(agent_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    match = {"id": agent_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    result = await db.delete("agents", match)
    return {"status": "deleted"} if result else {"error": "Agent not found"}


@app.get("/api/agents/{agent_id}/performance")
async def api_agent_performance(agent_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(agent_id):
        return {"error": "Invalid agent ID format"}
    if auth.tenant_id:
        agent_rows = await db.select("agents", {"id": agent_id, "tenant_id": auth.tenant_id})
        if not agent_rows:
            return {"error": "Agent not found"}
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


@app.post("/api/agents/{agent_id}/test-chat")
async def api_test_agent_chat(agent_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(agent_id):
        return JSONResponse({"error": "Invalid agent ID format"}, status_code=400)
    match = {"id": agent_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    agents = await db.select("agents", match)
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

    model = agent.get("llm_model", "llama-3.3-70b-versatile")
    temperature = agent.get("temperature", 0.7)

    try:
        from openai import AsyncOpenAI
        if not settings.groq_api_key:
            return JSONResponse({"error": "No LLM provider configured. Add GROQ_API_KEY to .env"}, status_code=500)
        client = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )

        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "system", "content": system_prompt}] + messages,
            temperature=temperature,
            max_tokens=500,
        )
        reply = resp.choices[0].message.content
        return {"reply": reply, "model": model, "provider": "groq"}
    except Exception as e:
        logger.error(f"Test chat error: {e}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Integrations ───

@app.get("/api/integrations")
async def api_list_integrations(auth: AuthContext = Depends(get_auth_context)):
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


@app.patch("/api/integrations/{integration_id}")
async def api_update_integration(integration_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
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


@app.post("/api/integrations/{integration_id}/test")
async def api_test_integration(integration_id: str, auth: AuthContext = Depends(get_auth_context)):
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

@app.get("/api/analytics/trends")
async def api_analytics_trends(days: int = 30, auth: AuthContext = Depends(get_auth_context)):
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    match = {"created_at": f"gte.{cutoff}"}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", match, order="created_at.asc", limit=5000)
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


@app.get("/api/analytics/agents")
async def api_analytics_agents(days: int = 30, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.agents import list_agents

    agents = await list_agents()
    if auth.tenant_id:
        agents = [a for a in agents if a.get("tenant_id") == auth.tenant_id]
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

@app.get("/api/campaigns/{campaign_id}/analytics")
async def api_campaign_analytics(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not _valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
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

@app.get("/api/templates")
async def api_list_templates(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.templates.registry import list_templates
    return {"templates": list_templates()}


@app.get("/api/templates/{template_id}")
async def api_get_template(template_id: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.templates.registry import get_template
    tpl = get_template(template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    return tpl


@app.post("/api/templates/{template_id}/deploy")
async def api_deploy_template(template_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
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

    llm_provider, llm_model = "groq", "llama-3.3-70b-versatile"

    lang = tpl["languages"][0] if tpl["languages"] else "en"
    indian_langs = {"hi", "ta", "te", "kn", "ml", "bn", "mr", "gu", "pa", "od"}

    if lang in indian_langs and settings.sarvam_api_key:
        tts_provider = "sarvam"
    elif settings.smallest_ai_api_key:
        tts_provider = "smallest"
    elif settings.sarvam_api_key:
        tts_provider = "sarvam"
    else:
        tts_provider = "smallest"

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
    if auth.tenant_id:
        agent_data["tenant_id"] = auth.tenant_id
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

@app.post("/api/benchmarks/run")
async def api_run_benchmarks(auth: AuthContext = Depends(get_auth_context)):
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


@app.get("/api/benchmarks/latest")
async def api_latest_benchmark(auth: AuthContext = Depends(get_auth_context)):
    try:
        results = await db.select("benchmarks", order="created_at.desc", limit=1)
        if results:
            return results[0]
    except Exception:
        pass
    return {"error": "No benchmark results yet. Run POST /api/benchmarks/run first."}


@app.get("/api/benchmarks/pipeline")
async def api_pipeline_metrics(auth: AuthContext = Depends(get_auth_context)):
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


@app.get("/api/benchmarks/drift")
async def api_behaviour_drift(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.monitoring.drift import BehaviourDriftDetector
    detector = BehaviourDriftDetector()
    try:
        return await detector.check_drift()
    except Exception:
        logger.debug("Drift check failed", exc_info=True)
        return {"status": "insufficient_data"}


# ─── Admin: Tenant Management (master key only) ───

@app.post("/admin/tenants")
async def admin_create_tenant(request: Request, auth: AuthContext = Depends(get_auth_context)):
    if auth.tenant_id:
        raise HTTPException(403, "Admin only")
    body = await request.json()
    from cogniflow_home.tenants.manager import create_tenant
    result = await create_tenant(
        name=body["name"],
        email=body["email"],
        plan=body.get("plan", "starter"),
        phone=body.get("phone", ""),
    )
    return result


@app.get("/admin/tenants")
async def admin_list_tenants(auth: AuthContext = Depends(get_auth_context)):
    if auth.tenant_id:
        raise HTTPException(403, "Admin only")
    tenants = await db.select("tenants", order="created_at.desc", limit=200)
    return {"tenants": tenants}


@app.get("/admin/tenants/{tenant_id}")
async def admin_get_tenant(tenant_id: str, auth: AuthContext = Depends(get_auth_context)):
    if auth.tenant_id:
        raise HTTPException(403, "Admin only")
    rows = await db.select("tenants", {"id": tenant_id})
    if not rows:
        raise HTTPException(404, "Tenant not found")
    return rows[0]


@app.patch("/admin/tenants/{tenant_id}")
async def admin_update_tenant(tenant_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if auth.tenant_id:
        raise HTTPException(403, "Admin only")
    body = await request.json()
    allowed = {"plan", "status", "monthly_minutes_limit", "max_agents",
               "max_concurrent_calls", "name", "email"}
    updates = {k: v for k, v in body.items() if k in allowed}
    await db.update("tenants", {"id": tenant_id}, updates)
    return {"ok": True}


@app.post("/admin/tenants/{tenant_id}/suspend")
async def admin_suspend_tenant(tenant_id: str, auth: AuthContext = Depends(get_auth_context)):
    if auth.tenant_id:
        raise HTTPException(403, "Admin only")
    await db.update("tenants", {"id": tenant_id}, {"status": "suspended"})
    return {"ok": True}


@app.get("/admin/billing")
async def admin_billing_overview(auth: AuthContext = Depends(get_auth_context)):
    if auth.tenant_id:
        raise HTTPException(403, "Admin only")
    from cogniflow_home.tenants.billing import get_all_tenants_summary
    summaries = await get_all_tenants_summary()
    total_revenue = sum(s.get("total_bill_paise", 0) for s in summaries)
    total_cost = sum(s.get("infrastructure_cost_paise", 0) for s in summaries)
    return {
        "month": summaries[0]["month"] if summaries else "",
        "total_tenants": len(summaries),
        "total_revenue_paise": total_revenue,
        "total_cost_paise": total_cost,
        "total_margin_paise": total_revenue - total_cost,
        "tenants": summaries,
    }


# ─── Tenant API Keys ───

@app.get("/api/keys")
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


@app.post("/api/keys")
async def create_api_key_endpoint(
    request: Request,
    auth: AuthContext = Depends(get_auth_context),
):
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


@app.delete("/api/keys/{key_id}")
async def revoke_api_key(
    key_id: str,
    auth: AuthContext = Depends(get_auth_context),
):
    keys = await db.select("api_keys", {"id": key_id, "tenant_id": auth.tenant_id})
    if not keys:
        raise HTTPException(404, "Key not found")
    await db.update("api_keys", {"id": key_id}, {"is_active": False})
    return {"ok": True, "message": "Key revoked"}


# ─── Tenant Usage + Billing ───

@app.get("/api/usage")
async def get_usage(
    month: str = None,
    auth: AuthContext = Depends(get_auth_context),
):
    from cogniflow_home.tenants.billing import get_billing_summary
    return await get_billing_summary(auth.tenant_id, month)


@app.get("/api/usage/history")
async def get_usage_history(auth: AuthContext = Depends(get_auth_context)):
    records = await db.select(
        "usage_records",
        {"tenant_id": auth.tenant_id},
        order="recorded_at.desc",
        limit=5000,
    )
    return {"records": records, "count": len(records)}


@app.get("/api/usage/live")
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


# ─── Multi-Tenant / Organizations ───

@app.post("/api/organizations")
async def api_create_organization(request: Request, auth: AuthContext = Depends(get_auth_context)):
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


@app.get("/api/organizations")
async def api_list_organizations(email: str = "", auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import list_organizations
    return await list_organizations(email or None)


@app.get("/api/organizations/{org_id}")
async def api_get_organization(org_id: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import get_organization
    if not _valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    org = await get_organization(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


@app.get("/api/organizations/{org_id}/members")
async def api_list_members(org_id: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import get_members
    if not _valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    return await get_members(org_id)


@app.post("/api/organizations/{org_id}/members")
async def api_add_member(org_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
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


@app.delete("/api/organizations/{org_id}/members/{email}")
async def api_remove_member(org_id: str, email: str, auth: AuthContext = Depends(get_auth_context)):
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
