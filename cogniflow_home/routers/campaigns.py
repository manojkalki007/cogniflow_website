"""Campaign CRUD, upload, start/pause, A/B testing, analytics, export, and callbacks."""

import csv
import io
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
        return {"total_calls": 0, "statuses": {}, "lead_scores": {}, "conversion_rate": 0, "avg_duration": 0, "calls": []}
    durations = [c["duration_seconds"] for c in calls if c.get("duration_seconds")]
    statuses = {}
    lead_scores = {}
    for c in calls:
        s = c.get("status", "unknown")
        statuses[s] = statuses.get(s, 0) + 1
        ls = c.get("lead_score", "unknown")
        lead_scores[ls] = lead_scores.get(ls, 0) + 1

    hot = lead_scores.get("hot", 0)
    warm = lead_scores.get("warm", 0)
    connected = statuses.get("completed", 0)
    conversion_rate = round((hot + warm) / connected * 100, 1) if connected else 0

    call_rows = []
    for c in calls:
        transcript = c.get("transcript") or []
        if isinstance(transcript, str):
            import json as _json
            try:
                transcript = _json.loads(transcript)
            except Exception:
                transcript = []
        transcript_text = "\n".join(
            f"{t.get('role', 'unknown')}: {t.get('text', '')}" for t in transcript
        ) if transcript else ""
        call_rows.append({
            "id": c.get("id"),
            "phone_number": c.get("phone_number", ""),
            "status": c.get("status", "unknown"),
            "lead_score": c.get("lead_score", "unknown"),
            "duration_seconds": c.get("duration_seconds", 0),
            "recording_url": c.get("recording_url", ""),
            "started_at": c.get("started_at", ""),
            "transcript_preview": transcript_text[:200] if transcript_text else "",
            "collected_data": c.get("collected_data") or {},
        })

    return {
        "total_calls": total,
        "statuses": statuses,
        "lead_scores": lead_scores,
        "conversion_rate": conversion_rate,
        "avg_duration": round(sum(durations) / len(durations), 1) if durations else 0,
        "unique_contacts": len(set(c.get("phone_number", "") for c in calls)),
        "funnel": {
            "total": total,
            "connected": connected,
            "interested": hot + warm,
            "hot": hot,
        },
        "calls": call_rows,
    }


# ─── Campaign Export ───

@router.get("/api/campaigns/{campaign_id}/export")
async def api_campaign_export(campaign_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(campaign_id):
        return Response(content="Invalid campaign ID", status_code=400)
    campaign = await get_campaign(campaign_id)
    if not campaign:
        return Response(content="Campaign not found", status_code=404)
    if auth.tenant_id and campaign.get("tenant_id") != auth.tenant_id:
        return Response(content="Campaign not found", status_code=404)

    calls_match = {"campaign_id": campaign_id}
    if auth.tenant_id:
        calls_match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", calls_match, limit=5000)

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([
        "Phone Number", "Status", "Lead Score", "Duration (sec)",
        "Started At", "Recording URL", "Transcript", "Collected Data",
    ])

    for c in calls:
        transcript = c.get("transcript") or []
        if isinstance(transcript, str):
            import json as _json
            try:
                transcript = _json.loads(transcript)
            except Exception:
                transcript = []
        transcript_text = "\n".join(
            f"{t.get('role', 'unknown')}: {t.get('text', '')}" for t in transcript
        )
        collected = c.get("collected_data") or {}
        collected_str = ", ".join(f"{k}: {v}" for k, v in collected.items()) if isinstance(collected, dict) else str(collected)

        writer.writerow([
            c.get("phone_number", ""),
            c.get("status", "unknown"),
            c.get("lead_score", "unknown"),
            c.get("duration_seconds", 0),
            c.get("started_at", ""),
            c.get("recording_url", ""),
            transcript_text,
            collected_str,
        ])

    safe_name = (campaign.get("name") or "campaign").replace(" ", "_")[:30]
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}_export.csv"'},
    )
