"""Provider inventory and integration management."""

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.state import valid_uuid
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["integrations"])


@router.get("/api/providers")
async def api_provider_status(auth: AuthContext = Depends(get_auth_context)):
    providers = [
        {"id": "deepgram", "name": "Deepgram", "category": "stt",
         "configured": bool(settings.deepgram_api_key),
         "docs": "https://console.deepgram.com", "pricing": "https://deepgram.com/pricing",
         "description": "Speech-to-text (Nova-2). Pay-per-minute.", "unit": "min", "rate_per_unit": 0.36},
        {"id": "sarvam_stt", "name": "Sarvam AI (STT)", "category": "stt",
         "configured": bool(settings.sarvam_api_key),
         "docs": "https://dashboard.sarvam.ai", "pricing": "https://www.sarvam.ai/pricing",
         "description": "Indian language STT. Hindi, Tamil, Telugu + 7 more.", "unit": "min", "rate_per_unit": 0.20},
        {"id": "groq", "name": "Groq", "category": "llm",
         "configured": bool(settings.groq_api_key),
         "docs": "https://console.groq.com", "pricing": "https://groq.com/pricing",
         "description": "Ultra-fast LLM inference. Llama 3.3 70B.", "unit": "1K tokens", "rate_per_unit": 0.06},
        {"id": "sarvam_tts", "name": "Sarvam AI (TTS)", "category": "tts",
         "configured": bool(settings.sarvam_api_key),
         "docs": "https://dashboard.sarvam.ai", "pricing": "https://www.sarvam.ai/pricing",
         "description": "Indian language TTS. Native Hindi, Tamil, Telugu voices.", "unit": "1K chars", "rate_per_unit": 0.08},
        {"id": "smallest", "name": "Smallest AI", "category": "tts",
         "configured": bool(settings.smallest_ai_api_key),
         "docs": "https://smallest.ai", "pricing": "https://smallest.ai/pricing",
         "description": "Lightning TTS with emotion control. Low-latency streaming.", "unit": "1K chars", "rate_per_unit": 0.05},
        {"id": "twilio", "name": "Twilio", "category": "telephony",
         "configured": bool(settings.twilio_account_sid),
         "docs": "https://console.twilio.com", "pricing": "https://www.twilio.com/en-us/voice/pricing",
         "description": "Global telephony. Inbound + outbound voice calls.", "unit": "min", "rate_per_unit": 1.30},
        {"id": "exotel", "name": "Exotel", "category": "telephony",
         "configured": bool(settings.exotel_api_key),
         "docs": "https://my.exotel.com", "pricing": "https://exotel.com/pricing",
         "description": "India telephony. Local DIDs, IVR, call recording.", "unit": "min", "rate_per_unit": 0.50},
        {"id": "vobiz", "name": "Vobiz", "category": "telephony",
         "configured": bool(settings.vobiz_auth_id),
         "docs": "https://console.vobiz.ai", "pricing": "https://www.docs.vobiz.ai",
         "description": "India-first telephony. ₹0.45/min voice, INR billing, TRAI compliant.", "unit": "min", "rate_per_unit": 0.45},
        {"id": "mcube", "name": "MCube", "category": "telephony",
         "configured": bool(settings.mcube_api_key),
         "docs": "https://www.mcube.com/developer-docs", "pricing": "https://www.mcube.com/pricing",
         "description": "India cloud telephony. Virtual numbers, IVR, call tracking.", "unit": "min", "rate_per_unit": 0.40},
        {"id": "sip", "name": "SIP Trunking", "category": "telephony",
         "configured": bool(settings.sip_trunk_host),
         "docs": "", "pricing": "",
         "description": "SIP trunk via Asterisk/FreeSWITCH. BYOC (Bring Your Own Carrier).", "unit": "min", "rate_per_unit": 0.0},
        {"id": "supabase", "name": "Supabase", "category": "database",
         "configured": bool(settings.supabase_url),
         "docs": "https://supabase.com/dashboard", "pricing": "https://supabase.com/pricing",
         "description": "PostgreSQL database + auth + realtime + storage.", "unit": "GB", "rate_per_unit": 0.0},
        {"id": "hubspot", "name": "HubSpot", "category": "crm",
         "configured": bool(settings.hubspot_api_key),
         "docs": "https://app.hubspot.com", "pricing": "https://www.hubspot.com/pricing",
         "description": "CRM sync. Auto-log calls, contacts, deals.", "unit": "api calls", "rate_per_unit": 0.0},
        {"id": "salesforce", "name": "Salesforce", "category": "crm",
         "configured": bool(settings.salesforce_client_id),
         "docs": "https://login.salesforce.com", "pricing": "https://www.salesforce.com/pricing",
         "description": "Enterprise CRM integration. Leads, contacts, activities.", "unit": "api calls", "rate_per_unit": 0.0},
        {"id": "whatsapp", "name": "WhatsApp Business", "category": "messaging",
         "configured": bool(settings.whatsapp_api_key),
         "docs": "https://business.facebook.com", "pricing": "https://developers.facebook.com/docs/whatsapp/pricing",
         "description": "WhatsApp Business API for follow-ups & notifications.", "unit": "msg", "rate_per_unit": 0.05},
        {"id": "razorpay", "name": "Razorpay", "category": "payments",
         "configured": bool(settings.razorpay_key_id),
         "docs": "https://dashboard.razorpay.com", "pricing": "https://razorpay.com/pricing",
         "description": "Payment gateway for INR billing & subscriptions.", "unit": "txn", "rate_per_unit": 0.0},
        {"id": "google_calendar", "name": "Google Calendar", "category": "scheduling",
         "configured": bool(settings.google_service_account_json or settings.google_service_account_path),
         "docs": "https://console.cloud.google.com", "pricing": "https://workspace.google.com/pricing",
         "description": "Calendar booking & appointment scheduling.", "unit": "api calls", "rate_per_unit": 0.0},
        {"id": "smtp", "name": "Email (SMTP)", "category": "messaging",
         "configured": bool(settings.smtp_user and settings.smtp_password),
         "docs": "", "pricing": "",
         "description": f"Outbound email via {settings.smtp_host}. Sender: {settings.smtp_from_email}",
         "unit": "email", "rate_per_unit": 0.0},
    ]

    usage_by_provider = {}
    if auth.tenant_id:
        month = datetime.now(timezone.utc).strftime("%Y-%m")
        records = await db.select("usage_records", {"tenant_id": auth.tenant_id}, limit=5000)
        for r in records:
            if (r.get("recorded_at") or "")[:7] == month:
                p = r.get("provider", "")
                usage_by_provider[p] = usage_by_provider.get(p, 0) + r.get("duration_seconds", 0)

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


@router.get("/api/integrations")
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


@router.patch("/api/integrations/{integration_id}")
async def api_update_integration(integration_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    if valid_uuid(integration_id):
        result = await db.update("integrations", {"id": integration_id}, body)
        return result or {"error": "Integration not found"}
    result = await db.upsert("integrations", {
        "type": integration_id,
        "name": body.get("name", integration_id),
        "status": body.get("status", "connected"),
        "config": body.get("config", {}),
    })
    return result or {"error": "Failed to update integration"}


@router.post("/api/integrations/{integration_id}/test")
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


# ─── DNC ───

@router.get("/api/dnc")
async def list_dnc(auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.campaigns.dnc import get_list
    numbers = await get_list()
    return {"dnc_list": numbers, "count": len(numbers)}


@router.post("/api/dnc")
async def add_dnc(request: Request, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.campaigns.dnc import add_number
    body = await request.json()
    phone = body.get("phone_number")
    if not phone:
        return {"error": "phone_number is required"}
    result = await add_number(phone, reason=body.get("reason", "manual"))
    return result or {"error": "Failed to add to DNC list"}


@router.delete("/api/dnc/{phone_number}")
async def remove_dnc(phone_number: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.campaigns.dnc import remove_number
    await remove_number(phone_number)
    return {"status": "removed"}


# ─── Revenue Attribution ───

@router.get("/api/revenue")
async def api_revenue_summary(period_days: int = 30, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.revenue.tracker import get_revenue_summary
    return await get_revenue_summary(period_days)


@router.post("/api/revenue/deal-closed")
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
