"""V1 API — AI SDR integration endpoints."""

import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request

from cogniflow_home.agents import get_agent_by_id, list_agents, update_agent
from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.state import (
    active_calls,
    call_limiter,
    _pending_agent_overrides,
    valid_uuid,
)
from cogniflow_home.telephony.registry import get_provider
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["v1"])


@router.post("/api/v1/calls/outbound")
async def v1_outbound_call(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    agent_id = body.get("agent_id")
    phone_number = body.get("phone_number")
    context = body.get("context", {})
    metadata = body.get("metadata", {})

    if not phone_number:
        raise HTTPException(status_code=400, detail="phone_number is required")
    if not agent_id:
        raise HTTPException(status_code=400, detail="agent_id is required")

    if not call_limiter.check(auth.tenant_id or "__global__"):
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    agent = await get_agent_by_id(agent_id)
    if not agent:
        raise HTTPException(status_code=404, detail="Agent not found")

    provider_name = agent.get("telephony_provider", "twilio")

    try:
        provider = get_provider(provider_name)
        webhook_url = f"{settings.public_url}/voice/{provider_name}/outbound"
        status_url = f"{settings.public_url}/api/call-status"
        result = await provider.initiate_outbound_call(phone_number, webhook_url, status_url)

        if result.call_sid:
            _pending_agent_overrides[result.call_sid] = agent_id
            call_metadata = {
                "source": "ai_sdr",
                "sdr_context": context,
                "sdr_metadata": metadata,
            }
            await db.insert("call_metadata", {
                "call_sid": result.call_sid,
                "data": call_metadata,
            })

        return {
            "callSid": result.call_sid,
            "status": result.status,
            "agentId": agent_id,
            "phoneNumber": phone_number,
        }
    except NotImplementedError:
        raise HTTPException(status_code=501, detail=f"Outbound not supported for {provider_name}")
    except Exception:
        logger.exception("V1 outbound call failed")
        raise HTTPException(status_code=500, detail="Failed to initiate call")


@router.get("/api/v1/calls/{call_sid}")
async def v1_call_status(call_sid: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(call_sid):
        raise HTTPException(status_code=400, detail="Invalid call ID")

    pipeline = active_calls.get(call_sid)
    if pipeline:
        if auth.tenant_id and getattr(pipeline.state, "tenant_id", "") != auth.tenant_id:
            raise HTTPException(status_code=404, detail="Call not found")
        return {
            "callSid": call_sid,
            "status": "in_progress",
            "duration": int(time.time() - pipeline.state.started_at),
            "transcript": "\n".join(
                f"{t['role']}: {t['text']}" for t in pipeline.state.transcript
            ) if pipeline.state.transcript else None,
        }

    match = {"id": call_sid}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", match)
    if not calls:
        raise HTTPException(status_code=404, detail="Call not found")

    call = calls[0]
    return {
        "callSid": call_sid,
        "status": call.get("status", "completed"),
        "duration": call.get("duration"),
        "transcript": call.get("transcript"),
        "summary": call.get("summary"),
        "endedReason": call.get("ended_reason"),
        "recordingUrl": call.get("recording_url"),
        "startedAt": call.get("created_at"),
        "endedAt": call.get("ended_at"),
    }


@router.get("/api/v1/agents")
async def v1_list_agents(auth: AuthContext = Depends(get_auth_context)):
    agents = await list_agents(auth.tenant_id)
    return [
        {"id": a["id"], "name": a.get("name", ""), "status": a.get("status", "active")}
        for a in agents
    ]
