"""Vobiz telephony provider for Indian calls.

Handles Vobiz XML Application + Audio Streams (WebSocket) protocol.
Supports audio formats: mulaw 8kHz, L16 8kHz/16kHz.

Architecture:
  Caller -> Vobiz PSTN -> XML webhook -> returns <Stream> XML
  -> Vobiz opens WebSocket -> bidirectional audio
  -> Pipeline: STT -> LLM -> TTS -> audio back via WebSocket

Protocol notes (from Vobiz docs):
  - Vobiz sends `start` as first event (no `connected` event)
  - Send audio back with `playAudio` event (NOT `media`)
  - Clear queued audio with `clearAudio` event (NOT `clear`)
  - No in-band `stop` from Vobiz — WebSocket close IS the end signal
  - L16 audio uses big-endian byte order
  - Endpoints use capital letters (/Account/, /Call/) with trailing slashes

API base: https://api.vobiz.ai/api/v1
Auth: X-Auth-ID + X-Auth-Token headers
"""

import base64
import json
import logging

import httpx
from starlette.websockets import WebSocket, WebSocketDisconnect

from cogniflow_home.config import settings
from cogniflow_home.telephony.base import (
    AudioEncoding,
    CallInfo,
    OutboundCallResult,
    TelephonyProvider,
)

logger = logging.getLogger("cogniflow_home.telephony.vobiz")

VOBIZ_API_BASE = "https://api.vobiz.ai/api/v1"


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
                    start = message.get("start", {})
                    self._stream_id = start.get("streamId", message.get("streamId", ""))
                    call_id = start.get("callId", "")
                    media_format = start.get("mediaFormat", {})
                    extra = message.get("extra_headers", "{}")
                    if isinstance(extra, str):
                        try:
                            extra = json.loads(extra)
                        except (json.JSONDecodeError, TypeError):
                            extra = {}

                    call_info = CallInfo(
                        call_sid=call_id,
                        stream_sid=self._stream_id,
                        caller_number=extra.get("From", "unknown"),
                        called_number=extra.get("To", ""),
                        direction=extra.get("Direction", "inbound"),
                        provider=self.name,
                        metadata={
                            "encoding": media_format.get("encoding", ""),
                            "sample_rate": media_format.get("sampleRate", 8000),
                            "account_id": start.get("accountId", ""),
                            "tracks": start.get("tracks", []),
                        },
                    )
                    await on_call_start(call_info)

                elif event == "media":
                    media = message.get("media", {})
                    payload = media.get("payload", "")
                    if payload:
                        audio_bytes = base64.b64decode(payload)
                        await on_audio(audio_bytes)

                elif event == "playedStream":
                    name = message.get("name", "")
                    logger.debug(f"Vobiz playback completed: {name}")

                elif event == "clearedAudio":
                    logger.debug("Vobiz audio queue cleared")

        except WebSocketDisconnect:
            logger.info(f"Vobiz WebSocket closed (stream end): {self._stream_id}")
        except Exception:
            logger.exception("Vobiz WebSocket error")
        finally:
            await on_call_end()

    async def send_audio(self, payload: str):
        if self._websocket and self._stream_id:
            try:
                msg = {
                    "event": "playAudio",
                    "media": {
                        "contentType": "audio/x-mulaw",
                        "sampleRate": 8000,
                        "payload": payload,
                    },
                }
                await self._websocket.send_text(json.dumps(msg))
            except Exception:
                logger.warning("Vobiz WebSocket send failed (connection closed)")

    async def send_checkpoint(self, name: str):
        """Request acknowledgment when all queued audio finishes playing."""
        if self._websocket and self._stream_id:
            try:
                await self._websocket.send_text(json.dumps({
                    "event": "checkpoint",
                    "streamId": self._stream_id,
                    "name": name,
                }))
            except Exception:
                logger.warning("Vobiz checkpoint send failed")

    async def clear_audio(self):
        if self._websocket and self._stream_id:
            try:
                await self._websocket.send_text(json.dumps({
                    "event": "clearAudio",
                    "streamId": self._stream_id,
                }))
            except Exception:
                logger.warning("Vobiz clearAudio failed (connection closed)")

    async def stop_stream(self):
        """Terminate the stream from our side."""
        if self._websocket and self._stream_id:
            try:
                await self._websocket.send_text(json.dumps({
                    "event": "stop",
                    "streamId": self._stream_id,
                }))
            except Exception:
                pass

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
            "hangup_url": status_callback_url or f"{settings.public_url}/voice/vobiz/hangup",
            "hangup_method": "POST",
            "ring_url": f"{settings.public_url}/voice/vobiz/ring",
            "ring_method": "POST",
            "time_limit": 3600,
            "machine_detection": "true",
            "machine_detection_time": 5000,
        }

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{VOBIZ_API_BASE}/Account/{settings.vobiz_auth_id}/Call/",
                headers={
                    "X-Auth-ID": settings.vobiz_auth_id,
                    "X-Auth-Token": settings.vobiz_auth_token,
                    "Content-Type": "application/json",
                },
                json=payload,
                timeout=15.0,
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
