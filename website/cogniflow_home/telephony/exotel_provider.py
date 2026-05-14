"""Exotel telephony provider.

Handles Exotel Voicebot Applet bidirectional WebSocket protocol.
Audio format: PCM 16-bit signed little-endian, 8kHz mono, base64 encoded.
Chunk size must be a multiple of 320 bytes.
"""

import base64
import json
import logging

import httpx
from starlette.websockets import WebSocket

from cogniflow_home.audio import mulaw_to_pcm16, pcm16_to_mulaw
from cogniflow_home.config import settings
from cogniflow_home.telephony.base import AudioEncoding, CallInfo, OutboundCallResult, TelephonyProvider

logger = logging.getLogger("cogniflow_home.telephony.exotel")


class ExotelProvider(TelephonyProvider):
    name = "exotel"
    encoding = AudioEncoding.PCM16
    sample_rate = 8000

    def __init__(self):
        self._websocket: WebSocket | None = None
        self._stream_sid: str | None = None

    async def handle_websocket(self, websocket: WebSocket, on_audio, on_call_start, on_call_end):
        self._websocket = websocket
        await websocket.accept()

        try:
            async for raw_message in websocket.iter_text():
                message = json.loads(raw_message)
                event = message.get("event", "").lower()

                if event == "connected":
                    logger.info("Exotel WebSocket connected")

                elif event == "start":
                    start = message.get("start", {})
                    self._stream_sid = start.get("stream_sid") or start.get("streamSid", "")
                    call_info = CallInfo(
                        call_sid=start.get("call_sid") or start.get("callSid", ""),
                        stream_sid=self._stream_sid,
                        caller_number=start.get("from", "unknown"),
                        called_number=start.get("to", ""),
                        direction="inbound",
                        provider=self.name,
                    )
                    await on_call_start(call_info)

                elif event == "media":
                    media = message.get("media", {})
                    payload = media.get("payload", "")
                    if payload:
                        pcm_bytes = base64.b64decode(payload)
                        mulaw_bytes = pcm16_to_mulaw(pcm_bytes)
                        await on_audio(mulaw_bytes)

                elif event == "dtmf":
                    dtmf = message.get("dtmf", {})
                    digit = dtmf.get("digit", "")
                    logger.info(f"DTMF received: {digit}")

                elif event == "clear":
                    logger.info("Exotel clear event received")

                elif event == "stop":
                    logger.info("Exotel stream stopped")
                    break

        except Exception:
            logger.exception("Exotel WebSocket error")
        finally:
            await on_call_end()

    async def send_audio(self, payload: str):
        """Send audio back to Exotel. Input is base64 mulaw, we convert to PCM16."""
        if not self._websocket or not self._stream_sid:
            return

        mulaw_bytes = base64.b64decode(payload)
        pcm_bytes = mulaw_to_pcm16(mulaw_bytes)

        # Exotel requires chunks in multiples of 320 bytes
        CHUNK_SIZE = 320
        for i in range(0, len(pcm_bytes), CHUNK_SIZE):
            chunk = pcm_bytes[i : i + CHUNK_SIZE]
            pcm_payload = base64.b64encode(chunk).decode("ascii")
            msg = {
                "event": "media",
                "stream_sid": self._stream_sid,
                "media": {"payload": pcm_payload},
            }
            await self._websocket.send_text(json.dumps(msg))

    async def clear_audio(self):
        if self._websocket and self._stream_sid:
            msg = {
                "event": "clear",
                "stream_sid": self._stream_sid,
            }
            await self._websocket.send_text(json.dumps(msg))

    def get_twiml_or_response(self, ws_url: str, caller: str) -> str:
        return json.dumps({"websocket_url": ws_url, "caller": caller})

    async def initiate_outbound_call(
        self, to_number: str, webhook_url: str, status_callback_url: str | None = None
    ) -> OutboundCallResult:
        account_sid = settings.exotel_account_sid or settings.exotel_api_key
        url = f"https://{settings.exotel_subdomain}.exotel.com/v1/Accounts/{account_sid}/Calls/connect.json"

        data = {
            "From": to_number,
            "To": webhook_url,
            "CallerId": settings.exotel_caller_id,
            "CallType": "trans",
        }
        if status_callback_url:
            data["StatusCallback"] = status_callback_url

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                data=data,
                auth=(settings.exotel_api_key, settings.exotel_api_token),
            )

        if response.status_code not in (200, 201):
            logger.error(f"Exotel outbound call failed: {response.status_code} {response.text}")
            raise RuntimeError(f"Exotel API error: {response.status_code}")

        result = response.json()
        call_sid = result.get("Call", {}).get("Sid", "")
        logger.info(f"Exotel outbound call initiated: {call_sid} -> {to_number}")
        return OutboundCallResult(
            call_sid=call_sid, status="dialing", provider=self.name, metadata=result
        )
