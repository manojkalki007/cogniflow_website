"""Outbound call initiation, hangup, status, and call listing."""

import asyncio
import logging
import time

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, Response

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.state import (
    active_calls,
    call_limiter,
    call_state,
    _pending_agent_overrides,
    valid_uuid,
)
from cogniflow_home.telephony.registry import get_provider
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["calls"])


@router.post("/api/call")
async def make_outbound_call(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    to_number = body.get("to_number")
    provider_name = body.get("provider", "twilio")
    agent_id = body.get("agent_id")

    if not to_number:
        return JSONResponse({"error": "to_number is required"}, status_code=400)

    if not call_limiter.check(auth.tenant_id or "__global__"):
        return JSONResponse({"error": "Rate limit exceeded. Max 20 calls per minute."}, status_code=429)

    try:
        provider = get_provider(provider_name)
        webhook_url = f"{settings.public_url}/voice/{provider_name}/outbound"
        status_url = f"{settings.public_url}/api/call-status"
        result = await provider.initiate_outbound_call(to_number, webhook_url, status_url)
        if agent_id and result.call_sid:
            _pending_agent_overrides[result.call_sid] = agent_id
            asyncio.get_event_loop().call_later(
                300, lambda sid=result.call_sid: _pending_agent_overrides.pop(sid, None)
            )
        return {"call_sid": result.call_sid, "status": result.status, "to": to_number, "provider": provider_name}
    except NotImplementedError:
        return JSONResponse({"error": f"Outbound not implemented for {provider_name}"}, status_code=400)
    except Exception:
        logger.exception(f"Failed to initiate outbound call via {provider_name}")
        return JSONResponse({"error": "Failed to initiate call. Check server logs for details."}, status_code=500)


@router.post("/api/call/{call_id}/hangup")
async def hangup_call(call_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(call_id):
        return JSONResponse({"error": "Invalid call ID format"}, status_code=400)
    pipeline = active_calls.get(call_id)
    if not pipeline:
        return JSONResponse({"error": "Call not found or already ended"}, status_code=404)
    if auth.tenant_id and getattr(pipeline.state, "tenant_id", "") != auth.tenant_id:
        return JSONResponse({"error": "Call not found or already ended"}, status_code=404)
    await pipeline.stop()
    active_calls.pop(call_id, None)
    await call_state.unregister_call(call_id)
    return {"status": "ended", "call_id": call_id}


@router.get("/api/call/{call_id}/status")
async def call_status(call_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(call_id):
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


@router.get("/api/calls")
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
    calls = await db.select("calls", match or None, order="created_at.desc", limit=limit)
    return {"calls": calls, "count": len(calls)}


@router.get("/api/calls/{call_id}")
async def get_call(call_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(call_id):
        return {"error": "Invalid call ID format"}
    match = {"id": call_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", match)
    if not calls:
        return {"error": "Call not found"}
    return calls[0]


# ─── Twilio Callbacks ───

def _validate_twilio_request(request: Request, form: dict) -> bool:
    if not settings.twilio_auth_token:
        return True
    from twilio.request_validator import RequestValidator
    validator = RequestValidator(settings.twilio_auth_token)
    url = str(request.url)
    signature = request.headers.get("X-Twilio-Signature", "")
    return validator.validate(url, dict(form), signature)


@router.post("/api/recording-status")
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
