"""Provider inventory and integration management."""

import logging
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.state import valid_uuid
from cogniflow_home.tenants.auth import AuthContext, get_auth_context


class UpdateIntegrationRequest(BaseModel):
    name: Optional[str] = None
    status: Optional[str] = None
    config: Optional[dict] = None
    is_active: Optional[bool] = None


class TestEmailRequest(BaseModel):
    to_email: str


class TestWhatsAppRequest(BaseModel):
    to_phone: str
    template: str = "appointment_confirmation"


class AddDncRequest(BaseModel):
    phone_number: str
    reason: str = "manual"


class DealClosedRequest(BaseModel):
    deal_id: str
    amount: float = 0
    contact_phone: str

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
         "description": "Lightning v3.1 TTS. 217 voices, 15 languages, ~200ms TTFB.", "unit": "1K chars", "rate_per_unit": 0.025},
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
        {"id": "calcom", "name": "Cal.com", "category": "scheduling",
         "configured": bool(settings.cal_api_key and settings.cal_event_type_id),
         "docs": "https://cal.com/docs/api-reference/v2", "pricing": "https://cal.com/pricing",
         "description": "Scheduling & appointment booking. Availability checks + auto-booking during calls.", "unit": "api calls", "rate_per_unit": 0.0},
        {"id": "leadrat", "name": "LeadRat CRM", "category": "crm",
         "configured": bool(settings.leadrat_api_key and settings.leadrat_account_name),
         "docs": "https://apidocs.leadrat.com", "pricing": "https://www.leadrat.com/pricing",
         "description": "India real estate CRM. Auto-push leads from AI calls with qualification data.", "unit": "api calls", "rate_per_unit": 0.0},
        {"id": "smtp", "name": "Email (SMTP)", "category": "messaging",
         "configured": bool(settings.smtp_user and settings.smtp_password),
         "docs": "", "pricing": "",
         "description": f"Outbound email via {settings.smtp_host}. Sender: {settings.smtp_from_email}",
         "unit": "email", "rate_per_unit": 0.0},
    ]

    usage_by_provider = {}
    month_start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0).isoformat()
    if auth.tenant_id:
        records = await db.select(
            "usage_records",
            {"tenant_id": auth.tenant_id, "recorded_at": f"gte.{month_start}"},
            limit=5000,
        )
        for r in records:
            p = r.get("provider", "")
            usage_by_provider[p] = usage_by_provider.get(p, 0) + r.get("duration_seconds", 0)

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
    match = {"tenant_id": auth.tenant_id} if auth.tenant_id else {}
    integrations = await db.select("integrations", match, order="created_at.desc")
    if not integrations:
        defaults = [
            {"type": "salesforce", "name": "Salesforce", "status": "disconnected"},
            {"type": "hubspot", "name": "HubSpot", "status": "disconnected"},
            {"type": "zoho", "name": "Zoho CRM", "status": "disconnected"},
            {"type": "google_calendar", "name": "Google Calendar", "status": "disconnected"},
            {"type": "calcom", "name": "Cal.com", "status": "disconnected"},
            {"type": "leadrat", "name": "LeadRat CRM", "status": "disconnected"},
            {"type": "razorpay", "name": "Razorpay", "status": "disconnected"},
            {"type": "webhook", "name": "Custom Webhook", "status": "disconnected"},
        ]
        return {"integrations": defaults}
    return {"integrations": integrations}


@router.patch("/api/integrations/{integration_id}")
async def api_update_integration(integration_id: str, body: UpdateIntegrationRequest, auth: AuthContext = Depends(get_auth_context)):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    if valid_uuid(integration_id):
        match = {"id": integration_id}
        if auth.tenant_id:
            match["tenant_id"] = auth.tenant_id
        result = await db.update("integrations", match, updates)
        if not result:
            raise HTTPException(404, "Integration not found")
        return result
    upsert_data = {
        "type": integration_id,
        "name": updates.get("name", integration_id),
        "status": updates.get("status", "connected"),
        "config": updates.get("config", {}),
    }
    if auth.tenant_id:
        upsert_data["tenant_id"] = auth.tenant_id
    result = await db.upsert("integrations", upsert_data)
    if not result:
        raise HTTPException(500, "Failed to update integration")
    return result


@router.post("/api/integrations/{integration_id}/test")
async def api_test_integration(integration_id: str, auth: AuthContext = Depends(get_auth_context)):
    checks = {
        "hubspot": lambda: bool(settings.hubspot_api_key),
        "salesforce": lambda: bool(settings.salesforce_client_id),
        "google_calendar": lambda: bool(settings.google_service_account_json or settings.google_service_account_path),
        "calcom": lambda: bool(settings.cal_api_key and settings.cal_event_type_id and settings.cal_event_type_id.isdigit()),
        "leadrat": lambda: bool(settings.leadrat_api_key and settings.leadrat_account_name),
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


# ─── Test Endpoints ───

@router.post("/api/test-email")
async def api_test_email(body: TestEmailRequest, auth: AuthContext = Depends(get_auth_context)):
    if not settings.smtp_user or not settings.smtp_password:
        raise HTTPException(400, "SMTP not configured. Set SMTP_USER and SMTP_PASSWORD in environment.")
    from cogniflow_home.integrations.email import email_sender
    sent = await email_sender.send(
        to_email=body.to_email,
        subject="Cogniflow Test Email",
        html_body="""
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px 24px;">
            <h2 style="margin: 0 0 12px; font-size: 20px;">Email is working!</h2>
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
                This is a test email from your Cogniflow AI calling agent.
                If you're seeing this, your SMTP configuration is correct.
            </p>
            <div style="margin-top: 20px; padding: 16px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0;">
                <p style="margin: 0; color: #166534; font-size: 13px;">SMTP: {host}:{port} &middot; Sender: {sender}</p>
            </div>
        </div>
        """.format(host=settings.smtp_host, port=settings.smtp_port, sender=settings.smtp_from_email),
        text_body="This is a test email from Cogniflow. Your SMTP is configured correctly.",
    )
    if sent:
        return {"status": "ok", "message": f"Test email sent to {body.to_email}"}
    raise HTTPException(500, "Failed to send test email. Check SMTP credentials.")


@router.post("/api/test-whatsapp")
async def api_test_whatsapp(body: TestWhatsAppRequest, auth: AuthContext = Depends(get_auth_context)):
    if not settings.whatsapp_api_key:
        raise HTTPException(400, "WhatsApp not configured. Set WHATSAPP_API_KEY in environment.")
    from cogniflow_home.whatsapp.tool import WhatsAppTool
    wa = WhatsAppTool()
    try:
        result = await wa.send_template(
            to_phone=body.to_phone,
            template_name=body.template,
            parameters=["Test", "Now", "Cogniflow Office"],
        )
        if "error" in result:
            raise HTTPException(400, result.get("error", "WhatsApp send failed"))
        return {"status": "ok", "message": f"Test message sent to {body.to_phone}"}
    finally:
        await wa.close()


# ─── DNC ───

@router.get("/api/dnc")
async def list_dnc(auth: AuthContext = Depends(get_auth_context)):
    match = {"tenant_id": auth.tenant_id} if auth.tenant_id else {}
    numbers = await db.select("dnc_list", match, limit=10000)
    return {"dnc_list": numbers, "count": len(numbers)}


@router.post("/api/dnc")
async def add_dnc(body: AddDncRequest, auth: AuthContext = Depends(get_auth_context)):
    if not auth.tenant_id:
        raise HTTPException(403, "Tenant context required")
    result = await db.insert("dnc_list", {
        "tenant_id": auth.tenant_id,
        "phone_number": body.phone_number,
        "reason": body.reason,
    })
    if not result:
        raise HTTPException(500, "Failed to add to DNC list")
    return result


@router.delete("/api/dnc/{phone_number}")
async def remove_dnc(phone_number: str, auth: AuthContext = Depends(get_auth_context)):
    match = {"phone_number": phone_number}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    await db.delete("dnc_list", match)
    return {"status": "removed"}


# ─── Revenue Attribution ───

@router.get("/api/revenue")
async def api_revenue_summary(period_days: int = 30, auth: AuthContext = Depends(get_auth_context)):
    if not auth.tenant_id:
        raise HTTPException(403, "Tenant context required")
    from cogniflow_home.revenue.tracker import get_revenue_summary
    try:
        return await get_revenue_summary(period_days, tenant_id=auth.tenant_id)
    except TypeError:
        # Fallback if tracker signature hasn't been updated yet
        return await get_revenue_summary(period_days)


@router.post("/api/revenue/deal-closed")
async def api_deal_closed(body: DealClosedRequest, auth: AuthContext = Depends(get_auth_context)):
    if not auth.tenant_id:
        raise HTTPException(403, "Tenant context required")
    from cogniflow_home.revenue.tracker import handle_deal_closed
    try:
        await handle_deal_closed(body.deal_id, body.amount, body.contact_phone, tenant_id=auth.tenant_id)
    except TypeError:
        await handle_deal_closed(body.deal_id, body.amount, body.contact_phone)
    return {"status": "attributed", "deal_id": body.deal_id}
