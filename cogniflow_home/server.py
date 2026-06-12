"""
FastAPI server — multi-provider telephony with full API.

Thin assembly file: lifespan, CORS middleware, and router registration.
All route handlers live in cogniflow_home/routers/*.
"""

import logging
import uuid as _uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI
from starlette.types import ASGIApp, Receive, Scope, Send

from cogniflow_home.campaigns.manager import resume_active_campaigns
from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.routers import all_routers
from cogniflow_home.state import active_calls, call_state

logger = logging.getLogger("cogniflow_home")


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
    from cogniflow_home.integrations import leadrat as leadrat_integration
    from cogniflow_home.analysis import behaviour as behaviour_analysis
    from cogniflow_home.analysis import call_scorer
    from cogniflow_home.notifications import confirmations

    call_logger.register()
    post_call.register()
    behaviour_analysis.register()
    call_scorer.register()
    confirmations.register()
    hubspot.register()
    dispatcher.register()
    dnc.register()
    revenue_tracker.register()
    register_memory()
    salesforce.register()
    leadrat_integration.register()
    logger.info("All modules registered")

    critical_vars = {
        "SUPABASE_URL": settings.supabase_url,
        "SUPABASE_KEY": settings.supabase_key,
        "GROQ_API_KEY": settings.groq_api_key,
    }
    missing = [k for k, v in critical_vars.items() if not v]
    if missing:
        logger.error("CRITICAL: Missing required env vars: %s — server may not function correctly", ", ".join(missing))

    stt_ok = settings.deepgram_api_key or settings.sarvam_api_key
    tts_ok = settings.smallest_ai_api_key or settings.sarvam_api_key or settings.elevenlabs_api_key
    if not stt_ok:
        logger.warning("No STT provider configured (DEEPGRAM_API_KEY or SARVAM_API_KEY)")
    if not tts_ok:
        logger.warning("No TTS provider configured (SMALLEST_AI_API_KEY, SARVAM_API_KEY, or ELEVENLABS_API_KEY)")

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

    try:
        await db.ensure_storage_bucket("recordings", public=True)
    except Exception:
        logger.debug("Storage bucket setup skipped", exc_info=True)

    # Warm the Groq client so first test-chat doesn't pay cold-start
    try:
        from cogniflow_home.routers.agents import _get_groq_client
        if settings.groq_api_key:
            _get_groq_client()
            logger.info("Groq client pre-warmed")
    except Exception:
        logger.debug("Groq client warm-up skipped", exc_info=True)

    yield

    for call_id, pipeline in list(active_calls.items()):
        try:
            await pipeline.stop()
        except Exception:
            logger.exception(f"Error stopping call {call_id} during shutdown")
    active_calls.clear()
    await call_state.clear()
    await db.close()
    logger.info("Shutdown complete")


# ─── App ───

app = FastAPI(title="Cogniflow Home Voice Agent", version="2.0.0", lifespan=lifespan)


# ─── CORS + Request-ID Middleware ───

class CORSAndRequestIDMiddleware:
    def __init__(self, app: ASGIApp):
        self.app = app
        self._allowed_origins = set(settings.cors_origins)

    def _get_allowed_origin(self, headers: dict) -> bytes | None:
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


# ─── Register all routers ───

for router in all_routers:
    app.include_router(router)
