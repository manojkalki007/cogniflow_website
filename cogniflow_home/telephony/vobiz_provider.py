"""Vobiz telephony provider for Indian calls.

Handles Vobiz XML Application + Audio Streams (WebSocket) protocol.
Audio format: mulaw 8kHz, base64 encoded (same as Twilio).
Vobiz docs: https://www.docs.vobiz.ai

Architecture:
  Caller → Vobiz PSTN → XML webhook → returns <Stream> XML
  → Vobiz opens WebSocket → bidirectional audio
  → Pipeline: STT → LLM → TTS → audio back via WebSocket

Cost: ₹0.45/min voice, ₹0.65/min streaming, INR billing, TRAI compliant.
"""

import base64
import json
import logging

import httpx
from starlette.websockets import WebSocket

from cogniflow_home.config import settings
from cogniflow_home.telephony.base import (
    AudioEncoding,
    CallInfo,
    OutboundCallResult,
    TelephonyProvider,
)

logger = logging.getLogger("cogniflow_home.telephony.vobiz")


class VobizProvider(TelephonyProvider):
    name = "vobiz"
    encoding = AudioEncoding.MULAW
    sample_rate = 8000

    def __init__(self):
        self._websocket: WebSocket | None = None
        self._stream_id: str | None = None

    async def handle_websocket(
        self, websocket: WebSocket, on_audio, on_call_start, on_call_end
    ):
        self._websocket = websocket
        await websocket.accept()

        try:
            async for raw_message in websocket.iter_text():
                message = json.loads(raw_message)
                event = message.get("event", "")

                if event == "start":
                    self._stream_id = message.get("streamId", "")
                    custom = message.get("customParameters", {})
                    call_info = CallInfo(
                        call_sid=message.get("callUUID", custom.get("CallUUID", "")),
                        stream_sid=self._stream_id,
                        caller_number=custom.get("caller", custom.get("From", "unknown")),
                        called_number=custom.get("called", custom.get("To", "")),
                        direction=custom.get("direction", "inbound"),
                        provider=self.name,
                    )
                    await on_call_start(call_info)

                elif event == "media":
                    media = message.get("media", {})
                    payload = media.get("payload", "")
                    if payload:
                        audio_bytes = base64.b64decode(payload)
                        await on_audio(audio_bytes)

                elif event == "stop":
                    logger.info(f"Vobiz stream stopped: {self._stream_id}")
                    break

        except Exception:
            logger.exception("Vobiz WebSocket error")
        finally:
            await on_call_end()

    async def send_audio(self, payload: str):
        if self._websocket and self._stream_id:
            msg = {
                "event": "playAudio",
                "media": {
                    "contentType": "audio/x-mulaw",
                    "sampleRate": "8000",
                    "payload": payload,
                },
            }
            await self._websocket.send_json(msg)

    async def clear_audio(self):
        if self._websocket and self._stream_id:
            await self._websocket.send_json({
                "event": "clear",
                "streamId": self._stream_id,
            })

    def get_twiml_or_response(self, ws_url: str, caller: str) -> str:
        return f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Stream
        bidirectional="true"
        keepCallAlive="true"
        contentType="audio/x-mulaw;rate=8000"
        statusCallbackUrl="{settings.public_url}/voice/vobiz/stream-status"
        statusCallbackMethod="POST">
        {ws_url}
    </Stream>
</Response>"""

    async def initiate_outbound_call(
        self, to_number: str, webhook_url: str, status_callback_url: str | None = None
    ) -> OutboundCallResult:
        payload = {
            "from": settings.vobiz_phone_number,
            "to": to_number,
            "answer_url": webhook_url,
            "answer_method": "POST",
            "hangup_url": f"{settings.public_url}/voice/vobiz/hangup",
            "hangup_method": "POST",
            "ring_url": f"{settings.public_url}/voice/vobiz/ring",
            "ring_method": "POST",
            "time_limit": 3600,
            "machine_detection": "true",
            "machine_detection_time": 5000,
        }
        if status_callback_url:
            payload["hangup_url"] = status_callback_url

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"https://api.vobiz.ai/api/v1/Account/{settings.vobiz_auth_id}/Call/",
                headers={
                    "X-Auth-ID": settings.vobiz_auth_id,
                    "X-Auth-Token": settings.vobiz_auth_token,
                    "Content-Type": "application/json",
                },
                json=payload,
            )

        if response.status_code not in (200, 201, 202):
            logger.error(f"Vobiz outbound call failed: {response.status_code} {response.text}")
            raise RuntimeError(f"Vobiz API error: {response.status_code}")

        data = response.json()
        call_uuid = data.get("request_uuid", "")
        logger.info(f"Vobiz outbound call initiated: {call_uuid} -> {to_number}")
        return OutboundCallResult(
            call_sid=call_uuid, status="dialing", provider=self.name, metadata=data
        )
