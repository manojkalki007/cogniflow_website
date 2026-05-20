"""Health, diagnostics, and provider-status endpoints."""

import logging

from fastapi import APIRouter, Depends

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.state import active_calls, call_state
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    checks = {"active_calls": await call_state.get_active_count()}

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
            "elevenlabs": "configured" if settings.elevenlabs_api_key else "not_configured",
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


@router.get("/api/providers/health")
async def providers_health():
    results = {}
    import httpx

    async def check_url(name, url, headers=None):
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                resp = await client.get(url, headers=headers or {})
                results[name] = {"status": "ok" if resp.status_code < 400 else "error", "code": resp.status_code}
        except Exception as e:
            results[name] = {"status": "unreachable", "error": str(e)}

    import asyncio
    tasks = []
    if settings.deepgram_api_key:
        tasks.append(check_url("deepgram", "https://api.deepgram.com/v1/projects",
                               {"Authorization": f"Token {settings.deepgram_api_key}"}))
    if settings.groq_api_key:
        tasks.append(check_url("groq", "https://api.groq.com/openai/v1/models",
                               {"Authorization": f"Bearer {settings.groq_api_key}"}))
    if settings.supabase_url:
        tasks.append(check_url("supabase", f"{settings.supabase_url}/rest/v1/",
                               {"apikey": settings.supabase_key}))
    if tasks:
        await asyncio.gather(*tasks)
    return {"provider_health": results}


@router.get("/api/voice/diagnose")
async def diagnose_voice():
    diag = {
        "stt": {"deepgram": bool(settings.deepgram_api_key), "sarvam": bool(settings.sarvam_api_key)},
        "llm": {"groq": bool(settings.groq_api_key)},
        "tts": {
            "smallest": bool(settings.smallest_ai_api_key),
            "sarvam": bool(settings.sarvam_api_key),
            "elevenlabs": bool(getattr(settings, "elevenlabs_api_key", "")),
        },
        "telephony": {
            "twilio": bool(settings.twilio_account_sid),
            "exotel": bool(settings.exotel_api_key),
            "vobiz": bool(settings.vobiz_auth_id),
        },
    }

    pipeline_ready = (
        diag["stt"]["deepgram"]
        and diag["llm"]["groq"]
        and (diag["tts"]["smallest"] or diag["tts"]["sarvam"] or diag["tts"]["elevenlabs"])
    )

    can_make_calls = pipeline_ready and any(diag["telephony"].values())

    issues = []
    if not diag["stt"]["deepgram"]:
        issues.append("No STT provider configured. Add DEEPGRAM_API_KEY.")
    if not diag["llm"]["groq"]:
        issues.append("No LLM provider configured. Add GROQ_API_KEY.")
    if not any(diag["tts"].values()):
        issues.append("No TTS provider configured. Add SMALLEST_AI_API_KEY or SARVAM_API_KEY.")
    if not any(diag["telephony"].values()):
        issues.append("No telephony provider configured. Calls cannot be made. Add TWILIO or EXOTEL or VOBIZ credentials.")

    return {
        "pipeline_ready": pipeline_ready,
        "can_make_calls": can_make_calls,
        "providers": diag,
        "issues": issues,
        "active_calls": len(active_calls),
    }


@router.get("/api/latency")
async def api_measure_latency(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.latency.measure import measure_service_latency
    results = await measure_service_latency()
    return {"latency_ms": results}


@router.get("/api/compliance/events")
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
