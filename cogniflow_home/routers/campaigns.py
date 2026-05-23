"""Campaign CRUD, upload, start/pause, A/B testing, analytics, and callbacks."""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import Response

from cogniflow_home.campaigns.manager import (
    create_campaign,
    get_campaign,
    list_campaigns,
    parse_csv,
    pause_campaign,
    start_campaign,
)
from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.state import valid_uuid
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["campaigns"])


def _validate_twilio_request(request: Request, form: dict) -> bool:
    if not settings.twilio_auth_token:
        return True
    from twilio.request_validator import RequestValidator
    validator = RequestValidator(settings.twilio_auth_token)
    url = str(request.url)
    signature = request.headers.get("X-Twilio-Signature", "")
    return validator.validate(url, dict(form), signature)


@router.get("/api/campaigns")
async def api_list_campaigns(auth: AuthContext = Depends(get_auth_context)):
    # DB-level tenant filtering — never load other tenants' campaigns into memory
    if auth.tenant_id:
        campaigns = await db.select("campaigns", {"tenant_id": auth.tenant_id}, order="created_at.desc", limit=500)
    else:
        campaigns = await list_campaigns()
    return {"campaigns": campaigns}


@router.get("/api/campaigns/{campaign_id}")
async def api_get_campaign(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    campaign = await get_campaign(campaign_id)
    if not campaign:
        return {"error": "Campaign not found"}
    if auth.tenant_id and campaign.get("tenant_id") != auth.tenant_id:
        return {"error": "Campaign not found"}
    return campaign


@router.post("/api/campaigns")
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


@router.post("/api/campaigns/{campaign_id}/start")
async def api_start_campaign(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
    return await start_campaign(campaign_id)


@router.post("/api/campaigns/{campaign_id}/pause")
async def api_pause_campaign(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
    return await pause_campaign(campaign_id)


@router.post("/api/campaigns/upload")
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


@router.post("/api/campaigns/{campaign_id}/call-status")
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


# ─── A/B Testing ───

@router.post("/api/campaigns/{campaign_id}/ab-test")
async def create_ab_test(campaign_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(campaign_id):
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


@router.get("/api/campaigns/{campaign_id}/ab-test/results")
async def get_ab_test_results(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
    from cogniflow_home.campaigns.ab_test import ab_test_manager
    return await ab_test_manager.get_results(campaign_id)


# ─── Campaign Analytics ───

@router.get("/api/campaigns/{campaign_id}/analytics")
async def api_campaign_analytics(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(campaign_id):
        return {"error": "Invalid campaign ID format"}
    if auth.tenant_id:
        campaign = await get_campaign(campaign_id)
        if not campaign or campaign.get("tenant_id") != auth.tenant_id:
            return {"error": "Campaign not found"}
    calls_match = {"campaign_id": campaign_id}
    if auth.tenant_id:
        calls_match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", calls_match, limit=2000)
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
