"""Telephony webhooks, WebSocket media streaming, and browser voice test."""

import asyncio
import base64
import io
import json
import logging
import struct
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, WebSocket
from fastapi.responses import Response
from pydantic import BaseModel, Field

from cogniflow_home.agents import DEFAULT_AGENT, get_agent_by_id, get_agent_for_number
from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.integrations.hubspot import get_caller_context as _hubspot_caller_context
from cogniflow_home.pipeline import VoicePipeline
from cogniflow_home.state import (
    active_calls,
    call_state,
    _pending_agent_overrides,
)
from cogniflow_home.telephony.base import CallInfo
from cogniflow_home.telephony.registry import get_provider
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["voice"])


_voice_preview_cache: dict[str, bytes] = {}


def _validate_twilio_request(request: Request, form: dict) -> bool:
    if not settings.twilio_auth_token:
        return True
    from twilio.request_validator import RequestValidator
    validator = RequestValidator(settings.twilio_auth_token)
    url = str(request.url)
    signature = request.headers.get("X-Twilio-Signature", "")
    return validator.validate(url, dict(form), signature)


def _pcm_to_wav(pcm_data: bytes, sample_rate: int = 16000, bits_per_sample: int = 16, channels: int = 1) -> bytes:
    data_size = len(pcm_data)
    byte_rate = sample_rate * channels * bits_per_sample // 8
    block_align = channels * bits_per_sample // 8
    buf = io.BytesIO()
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<IHHIIHH", 16, 1, channels, sample_rate, byte_rate, block_align, bits_per_sample))
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    buf.write(pcm_data)
    return buf.getvalue()


class VoicePreviewRequest(BaseModel):
    text: str = Field("Hello! This is a voice preview.", max_length=500)
    provider: str = "smallest"
    voice_id: str = ""
    language: str = "en"
    sample_rate: int = Field(16000, ge=8000, le=48000)


@router.post("/api/voice/preview")
async def voice_preview(body: VoicePreviewRequest, auth: AuthContext = Depends(get_auth_context)):
    text = body.text
    provider = body.provider
    voice_id = body.voice_id
    language = body.language
    sample_rate = body.sample_rate

    cache_key = f"{provider}:{voice_id}:{language}:{text[:50]}"
    if cache_key in _voice_preview_cache:
        wav = _voice_preview_cache[cache_key]
        encoded = base64.b64encode(wav).decode("ascii")
        return {"audio": encoded, "format": "wav", "cached": True}

    try:
        if provider == "smallest":
            from cogniflow_home.providers.smallest_tts import SmallestTTS
            tts = SmallestTTS(voice_id=voice_id or "jessica", language=language, sample_rate=sample_rate, raw_pcm=True)
        elif provider == "sarvam":
            from cogniflow_home.providers.sarvam_tts import SarvamTTS
            tts = SarvamTTS(voice=voice_id, language=language, sample_rate=sample_rate, raw_pcm=True)
        elif provider == "elevenlabs":
            from cogniflow_home.providers.elevenlabs_tts import ElevenLabsTTS
            tts = ElevenLabsTTS(voice_id=voice_id or "pNInz6obpgDQGcFmaJgB", raw_pcm=True)
        else:
            raise HTTPException(400, f"Unknown TTS provider: {provider}")

        await tts.connect()
        pcm_chunks = []
        async for chunk in tts.synthesize(text):
            pcm_chunks.append(chunk)
        await tts.close()
        pcm_data = b"".join(pcm_chunks)
        wav = _pcm_to_wav(pcm_data, sample_rate=sample_rate)
        if len(_voice_preview_cache) >= 100:
            _voice_preview_cache.clear()
        _voice_preview_cache[cache_key] = wav
        encoded = base64.b64encode(wav).decode("ascii")
        return {"audio": encoded, "format": "wav", "size_bytes": len(wav)}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Voice preview failed")
        raise HTTPException(500, "Voice preview failed. Try again later.")


# ─── Twilio Webhooks ───

@router.post("/voice/twilio/inbound")
async def twilio_inbound(request: Request):
    form = await request.form()
    if not _validate_twilio_request(request, form):
        return Response(status_code=403, content="Invalid signature")
    caller = form.get("From", "unknown")
    called = form.get("To", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/twilio/ws"
    provider = get_provider("twilio")
    twiml = provider.get_twiml_or_response(ws_url, caller, called)
    return Response(content=twiml, media_type="application/xml")


@router.post("/voice/twilio/outbound")
async def twilio_outbound(request: Request):
    form = await request.form()
    if not _validate_twilio_request(request, form):
        return Response(status_code=403, content="Invalid signature")
    called = form.get("To", "unknown")
    caller = form.get("From", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/twilio/ws"
    provider = get_provider("twilio")
    twiml = provider.get_twiml_or_response(ws_url, caller, called)
    return Response(content=twiml, media_type="application/xml")


# ─── Exotel Webhooks ───

@router.post("/voice/exotel/inbound")
async def exotel_inbound(request: Request):
    form = await request.form()
    caller = form.get("From", "unknown")
    called = form.get("To", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/exotel/ws"
    provider = get_provider("exotel")
    return json.loads(provider.get_twiml_or_response(ws_url, caller, called))


@router.post("/voice/exotel/outbound")
async def exotel_outbound(request: Request):
    form = await request.form()
    caller = form.get("From", "unknown")
    called = form.get("To", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/exotel/ws"
    provider = get_provider("exotel")
    return json.loads(provider.get_twiml_or_response(ws_url, caller, called))


# ─── Vobiz XML Webhooks ───

@router.post("/voice/vobiz/inbound")
async def vobiz_inbound(request: Request):
    form = await request.form()
    form_dict = dict(form)
    caller = form.get("From", "unknown")
    called = form.get("To", "unknown")
    call_uuid = form.get("CallUUID", "")
    direction = form.get("Direction", "unknown")
    logger.info(f"[VOBIZ INBOUND] CallUUID={call_uuid} From={caller} To={called} Direction={direction} AllParams={form_dict}")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/vobiz/ws"
    provider = get_provider("vobiz")
    xml = provider.get_twiml_or_response(ws_url, caller, called)
    logger.info(f"[VOBIZ INBOUND] Returning XML: {xml}")
    return Response(content=xml, media_type="application/xml")


@router.post("/voice/vobiz/outbound")
async def vobiz_outbound(request: Request):
    form = await request.form()
    called = form.get("To", "unknown")
    caller = form.get("From", "unknown")
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/vobiz/ws"
    provider = get_provider("vobiz")
    xml = provider.get_twiml_or_response(ws_url, caller, called)
    return Response(content=xml, media_type="application/xml")


@router.post("/voice/vobiz/hangup")
async def vobiz_hangup(request: Request):
    form = await request.form()
    form_dict = dict(form)
    call_uuid = form.get("CallUUID", "")
    duration = form.get("Duration", "0")
    hangup_cause = form.get("HangupCause", "NORMAL_CLEARING")
    logger.info(f"[VOBIZ HANGUP] CallUUID={call_uuid} Duration={duration}s Cause={hangup_cause} AllParams={form_dict}")
    return Response(content="OK", status_code=200)


@router.post("/voice/vobiz/ring")
async def vobiz_ring(request: Request):
    form = await request.form()
    logger.info(f"[VOBIZ] Call ringing: {form.get('CallUUID', '')}")
    return Response(content="OK", status_code=200)


@router.post("/voice/vobiz/stream-status")
async def vobiz_stream_status(request: Request):
    form = await request.form()
    logger.info(f"[VOBIZ] Stream event: {form.get('Event', '')} | Call: {form.get('CallUUID', '')}")
    return Response(content="OK", status_code=200)


@router.get("/api/vobiz/numbers")
async def api_vobiz_numbers(auth: AuthContext = Depends(get_auth_context)):
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


# ─── MCube Webhooks ───
# MCube does NOT support WebSocket audio streaming.
# These endpoints handle click-to-call callbacks only (hangup/status webhooks).

@router.post("/voice/mcube/inbound")
async def mcube_inbound(request: Request):
    """MCube inbound call callback.

    MCube does not support real-time audio streaming. This endpoint
    receives call notification webhooks only. For AI voice on MCube
    numbers, route through SIP trunk bridge.
    """
    body = {}
    try:
        body = await request.json()
    except Exception:
        try:
            form = await request.form()
            body = dict(form)
        except Exception:
            pass
    caller = body.get("From", body.get("caller", "unknown"))
    logger.info(f"[MCUBE] Inbound call from {caller}")
    return {"status": "received", "note": "MCube does not support WebSocket streaming"}


@router.post("/voice/mcube/status")
async def mcube_status(request: Request):
    """MCube call status/hangup callback (refurl webhook)."""
    body = {}
    try:
        body = await request.json()
    except Exception:
        try:
            form = await request.form()
            body = dict(form)
        except Exception:
            pass
    call_id = body.get("monitorUcid", body.get("call_id", ""))
    status = body.get("status", body.get("callStatus", ""))
    duration = body.get("duration", body.get("callDuration", ""))
    logger.info(f"[MCUBE] Call status: {status} | ID: {call_id} | Duration: {duration}s")
    return {"status": "ok"}


# ─── SIP Webhooks ───

@router.post("/voice/sip/inbound")
async def sip_inbound(request: Request):
    """SIP inbound call webhook — return WebSocket URL for PBX bridge."""
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/sip/ws"
    provider = get_provider("sip")
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    caller = body.get("from", body.get("caller_id", "unknown"))
    called = body.get("to", body.get("did", "unknown"))
    return json.loads(provider.get_twiml_or_response(ws_url, caller, called))


@router.post("/voice/sip/outbound")
async def sip_outbound(request: Request):
    """SIP outbound call answered — return WebSocket URL."""
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/sip/ws"
    provider = get_provider("sip")
    body = {}
    try:
        body = await request.json()
    except Exception:
        pass
    called = body.get("to", body.get("did", "unknown"))
    caller = body.get("from", body.get("caller_id", "unknown"))
    return json.loads(provider.get_twiml_or_response(ws_url, caller, called))


# ─── Generic Inbound Fallback ───

@router.post("/voice/{provider_name}/inbound")
async def generic_inbound(provider_name: str):
    ws_url = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
    ws_url = f"{ws_url}/voice/{provider_name}/ws"
    return {"websocket_url": ws_url, "provider": provider_name}


# ─── Universal WebSocket ───

@router.websocket("/voice/{provider_name}/ws")
async def voice_ws(websocket: WebSocket, provider_name: str):
    if await call_state.is_at_capacity(settings.max_concurrent_calls):
        await websocket.close(code=1013, reason="Server at capacity")
        return

    provider = get_provider(provider_name)
    pipeline: Optional[VoicePipeline] = None

    async def on_audio(audio_bytes: bytes):
        if pipeline:
            await pipeline.handle_audio(audio_bytes)

    async def on_call_start(call_info: CallInfo):
        nonlocal pipeline
        logger.info(f"[WS on_call_start] call_sid={call_info.call_sid} caller={call_info.caller_number} called={call_info.called_number} direction={call_info.direction} pending_overrides={list(_pending_agent_overrides.keys())}")
        # Try matching agent override by call_sid, then by any pending key
        # (Vobiz returns request_uuid from API but callId in WebSocket — they differ)
        override_id = _pending_agent_overrides.pop(call_info.call_sid, None)
        if not override_id and _pending_agent_overrides:
            # For outbound calls, the call_sid may not match — try matching by
            # checking if there's a single recent override (within a few seconds)
            for k, v in list(_pending_agent_overrides.items()):
                override_id = v
                _pending_agent_overrides.pop(k, None)
                break

        if override_id:
            agent_config = await get_agent_by_id(override_id)
            if not agent_config:
                agent_config = await get_agent_for_number(call_info.called_number)
        else:
            # Try called number first, then caller number (for outbound calls
            # the caller is our Vobiz number which has the agent assigned)
            agent_config = await get_agent_for_number(call_info.called_number)
            if agent_config.instructions == DEFAULT_AGENT.instructions and call_info.caller_number:
                from_agent = await get_agent_for_number(call_info.caller_number)
                if from_agent.instructions != DEFAULT_AGENT.instructions:
                    agent_config = from_agent

        # For concurrency, check both called and caller numbers
        check_number = call_info.called_number
        num_rows = await db.select("phone_numbers", {"number": check_number, "status": "active"}, limit=1)
        if not num_rows and call_info.caller_number:
            check_number = call_info.caller_number
            num_rows = await db.select("phone_numbers", {"number": call_info.caller_number, "status": "active"}, limit=1)
        if num_rows:
            sip_cfg = num_rows[0].get("sip_config") or {}
            if isinstance(sip_cfg, str):
                try:
                    sip_cfg = json.loads(sip_cfg)
                except Exception:
                    sip_cfg = {}
            max_conc = sip_cfg.get("concurrency", 5)
            current = sum(1 for p in active_calls.values() if getattr(getattr(p, "state", None), "called_number", None) == call_info.called_number)
            if current >= max_conc:
                logger.warning(f"Number {call_info.called_number} at concurrency limit ({max_conc})")
                return

        logger.info(f"[WS on_call_start] Agent resolved: name={getattr(agent_config, 'name', 'N/A')} id={getattr(agent_config, 'id', 'N/A')} override_id={override_id} greeting={agent_config.greeting[:50] if agent_config.greeting else 'NONE'}")
        pipeline = VoicePipeline(
            call_info, provider,
            instructions_override=agent_config.instructions,
            greeting_override=agent_config.greeting,
            language=agent_config.language,
            voice_id=agent_config.voice_id,
            tenant_id=agent_config.tenant_id,
            emotion_profile=agent_config.emotion_profile,
            voice_gender=agent_config.voice_gender,
            tools_enabled=agent_config.tools_enabled,
            enable_memory=agent_config.enable_memory,
            enable_prediction=agent_config.enable_prediction,
            enable_emotion=agent_config.enable_emotion,
            enable_language_switch=agent_config.enable_language_switch,
            enable_rag=agent_config.enable_rag,
            enable_barge_in=agent_config.enable_barge_in,
            enable_speculative=agent_config.enable_speculative,
            enable_filler=agent_config.enable_filler,
            tts_provider=agent_config.tts_provider,
            variables=agent_config.variables,
        )
        pipeline.agent_id = getattr(agent_config, "id", None)
        pipeline.llm.call_context["integration_config"] = agent_config.integration_config
        pipeline.llm.call_context["variables"] = agent_config.variables

        ic = agent_config.integration_config
        crm_context = ""
        if ic.get("enable_crm_lookup"):
            crm_provider = ic.get("crm_provider", "")
            if crm_provider == "hubspot":
                crm_context = await _hubspot_caller_context(call_info.caller_number)
            elif crm_provider == "salesforce":
                try:
                    from cogniflow_home.integrations.salesforce import get_salesforce
                    sf = await get_salesforce(agent_config.tenant_id)
                    contact = await sf.find_contact(call_info.caller_number)
                    if contact:
                        crm_context = f"You're speaking with {contact.get('Name', '')}. Account: {contact.get('Account', {}).get('Name', '')}."
                    else:
                        lead = await sf.find_lead(call_info.caller_number)
                        if lead:
                            crm_context = f"You're speaking with {lead.get('Name', '')} from {lead.get('Company', '')}. Status: {lead.get('Status', '')}."
                except Exception:
                    logger.debug("Salesforce caller lookup failed", exc_info=True)
        else:
            crm_context = await _hubspot_caller_context(call_info.caller_number)
        if crm_context:
            pipeline.inject_context(crm_context)
        active_calls[call_info.call_sid] = pipeline
        await call_state.register_call(call_info.call_sid, {
            "provider": provider_name,
            "caller": call_info.caller_number,
        })
        await pipeline.start()

    async def on_call_end():
        nonlocal pipeline
        if pipeline:
            call_sid = pipeline.state.call_sid
            try:
                await pipeline.stop()
            except Exception:
                logger.exception(f"Pipeline stop error for {call_sid}")
            finally:
                active_calls.pop(call_sid, None)
                await call_state.unregister_call(call_sid)
                pipeline = None

    await provider.handle_websocket(websocket, on_audio, on_call_start, on_call_end)


# ─── Browser Voice Test ───

@router.websocket("/voice/browser/test")
async def browser_voice_test(websocket: WebSocket):
    if await call_state.is_at_capacity(settings.max_concurrent_calls):
        await websocket.close(code=1013, reason="Server at capacity")
        return

    agent_id = websocket.query_params.get("agent_id", "")

    if not settings.groq_api_key:
        await websocket.accept()
        await websocket.send_text(json.dumps({"event": "error", "message": "No LLM provider configured. Add GROQ_API_KEY to .env"}))
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
            tools_enabled=agent_config.tools_enabled,
            enable_memory=agent_config.enable_memory,
            enable_prediction=agent_config.enable_prediction,
            enable_emotion=agent_config.enable_emotion,
            enable_language_switch=agent_config.enable_language_switch,
            enable_rag=agent_config.enable_rag,
            enable_barge_in=agent_config.enable_barge_in,
            enable_speculative=agent_config.enable_speculative,
            enable_filler=agent_config.enable_filler,
            tts_provider=agent_config.tts_provider,
            variables=agent_config.variables,
        )

        async def _send_transcript(role: str, text: str):
            await provider.send_event("transcript", {"role": role, "text": text})

        pipeline.on_transcript = _send_transcript

        async def _send_latency(data: dict):
            await provider.send_event("latency", data)

        pipeline.on_latency = _send_latency
        active_calls[call_info.call_sid] = pipeline
        await call_state.register_call(call_info.call_sid, {
            "provider": "browser",
            "type": "test",
            "agent_id": agent_id,
        })
        await pipeline.start()

    async def on_call_end():
        nonlocal pipeline
        saved_call_sid = None

        wav_data = None
        try:
            wav_data = provider.get_recording_wav()
            logger.info("Recording WAV: %d bytes (user=%d, agent=%d)",
                        len(wav_data) if wav_data else 0,
                        len(provider._rec_user), len(provider._rec_agent))
            if wav_data and len(wav_data) > 44:
                import base64 as _b64
                await provider.send_event("recording", {
                    "data": _b64.b64encode(wav_data).decode("ascii"),
                })
        except Exception:
            logger.exception("Recording send failed")

        if pipeline:
            saved_call_sid = pipeline.state.call_sid
            await pipeline.stop()
            active_calls.pop(saved_call_sid, None)
            await call_state.unregister_call(saved_call_sid)
            pipeline = None

        if wav_data and len(wav_data) > 44 and saved_call_sid:
            try:
                path = f"{saved_call_sid}.wav"
                public_url = await db.upload_file("recordings", path, wav_data, "audio/wav")
                if public_url:
                    await db.update("calls", {"id": saved_call_sid}, {"recording_url": public_url})
                    logger.info("Recording saved: %s", public_url)
            except Exception:
                logger.exception("Recording storage upload failed")

    await provider.handle_websocket(websocket, on_audio, on_call_start, on_call_end)
