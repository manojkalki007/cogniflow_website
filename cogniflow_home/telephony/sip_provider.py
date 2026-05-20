"""SIP Trunking telephony provider.

Handles SIP-based calls via WebSocket media streaming.
Works with any SIP trunk provider (Telnyx, Bandwidth, VoIP.ms,
Airtel ILD, Tata Communications, etc.).

Architecture:
  SIP Trunk → Asterisk/FreeSWITCH/Kamailio → WebSocket bridge → Pipeline

The SIP provider assumes a WebSocket media bridge (e.g., AudioSocket in
Asterisk, mod_audio_stream in FreeSWITCH) that:
  1. Accepts the SIP call
  2. Opens a WebSocket to Cogniflow
  3. Streams raw audio bidirectionally

Audio format: PCM16 signed little-endian 8kHz (SIP standard), or mulaw.
Configurable per-trunk.
"""

import base64
import json
import logging

from starlette.websockets import WebSocket

from cogniflow_home.audio import mulaw_to_pcm16, pcm16_to_mulaw
from cogniflow_home.config import settings
from cogniflow_home.telephony.base import (
    AudioEncoding,
    CallInfo,
    OutboundCallResult,
    TelephonyProvider,
)

logger = logging.getLogger("cogniflow_home.telephony.sip")


class SIPProvider(TelephonyProvider):
    """SIP Trunking provider via WebSocket media bridge.

    Supports two audio modes:
    - "mulaw": mulaw 8kHz (G.711u) — standard for US/international SIP
    - "pcm16": PCM 16-bit 8kHz — raw linear, used by some bridges

    The WebSocket bridge (Asterisk AudioSocket, FreeSWITCH mod_audio_stream,
    or custom) must send JSON messages with the following events:
      - {"event": "start", "call_id": "...", "from": "...", "to": "...", ...}
      - {"event": "media", "media": {"payload": "<base64 audio>"}}
      - {"event": "stop"}
    """

    name = "sip"
    encoding = AudioEncoding.MULAW
    sample_rate = 8000

    def __init__(self):
        self._websocket: WebSocket | None = None
        self._stream_sid: str | None = None
        self._audio_mode = "mulaw"

    async def handle_websocket(
        self, websocket: WebSocket, on_audio, on_call_start, on_call_end
    ):
        self._websocket = websocket
        await websocket.accept()

        try:
            async for raw_message in websocket.iter_text():
                message = json.loads(raw_message)
                event = message.get("event", "").lower()

                if event == "start":
                    start = message.get("start", message)
                    self._stream_sid = start.get("stream_id", start.get("session_id", ""))
                    self._audio_mode = start.get("codec", start.get("audio_format", "mulaw"))

                    call_info = CallInfo(
                        call_sid=start.get("call_id", start.get("unique_id", "")),
                        stream_sid=self._stream_sid,
                        caller_number=start.get("from", start.get("caller_id", "unknown")),
                        called_number=start.get("to", start.get("did", "")),
                        direction=start.get("direction", "inbound"),
                        provider=self.name,
                        metadata={
                            "sip_headers": start.get("headers", {}),
                            "codec": self._audio_mode,
                            "trunk": start.get("trunk", ""),
                        },
                    )
                    await on_call_start(call_info)

                elif event == "media":
                    media = message.get("media", {})
                    payload = media.get("payload", "")
                    if not payload:
                        continue
                    raw_bytes = base64.b64decode(payload)
                    if self._audio_mode == "pcm16":
                        mulaw_bytes = pcm16_to_mulaw(raw_bytes)
                        await on_audio(mulaw_bytes)
                    else:
                        await on_audio(raw_bytes)

                elif event in ("stop", "bye", "hangup"):
                    logger.info(f"SIP stream ended: {self._stream_sid}")
                    break

        except Exception:
            logger.exception("SIP WebSocket error")
        finally:
            await on_call_end()

    async def send_audio(self, payload: str):
        """Send mulaw audio back. Converts to PCM16 if trunk requires it."""
        if not self._websocket or not self._stream_sid:
            return
        try:
            if self._audio_mode == "pcm16":
                mulaw_bytes = base64.b64decode(payload)
                pcm_bytes = mulaw_to_pcm16(mulaw_bytes)
                out_payload = base64.b64encode(pcm_bytes).decode("ascii")
            else:
                out_payload = payload

            msg = {
                "event": "media",
                "stream_id": self._stream_sid,
                "media": {"payload": out_payload},
            }
            await self._websocket.send_text(json.dumps(msg))
        except Exception:
            logger.warning("SIP WebSocket send failed (connection closed)")

    async def clear_audio(self):
        if self._websocket and self._stream_sid:
            try:
                await self._websocket.send_text(json.dumps({
                    "event": "clear",
                    "stream_id": self._stream_sid,
                }))
            except Exception:
                logger.warning("SIP WebSocket clear failed (connection closed)")

    def get_twiml_or_response(self, ws_url: str, caller: str) -> str:
        return json.dumps({
            "websocket_url": ws_url,
            "caller": caller,
            "provider": "sip",
        })

    async def initiate_outbound_call(
        self, to_number: str, webhook_url: str, status_callback_url: str | None = None
    ) -> OutboundCallResult:
        """SIP outbound via Asterisk AMI / FreeSWITCH ESL / HTTP API.

        This sends an originate command to the PBX which dials out via
        the SIP trunk and connects the audio to a WebSocket bridge.
        """
        if not settings.sip_trunk_host:
            raise NotImplementedError("SIP trunk not configured. Set SIP_TRUNK_HOST in .env")

        import httpx
        payload = {
            "action": "originate",
            "to": to_number,
            "trunk": settings.sip_trunk_host,
            "webhook_url": webhook_url,
            "audio_ws_url": webhook_url.replace("/outbound", "/ws"),
        }
        if status_callback_url:
            payload["status_url"] = status_callback_url

        pbx_url = f"http://{settings.sip_trunk_host}:{settings.sip_trunk_port}/api/originate"
        if settings.sip_outbound_proxy:
            pbx_url = settings.sip_outbound_proxy

        async with httpx.AsyncClient() as client:
            response = await client.post(
                pbx_url,
                json=payload,
                auth=(settings.sip_trunk_username, settings.sip_trunk_password) if settings.sip_trunk_username else None,
                timeout=15.0,
            )

        if response.status_code not in (200, 201, 202):
            logger.error(f"SIP outbound call failed: {response.status_code} {response.text}")
            raise RuntimeError(f"SIP originate error: {response.status_code}")

        data = response.json()
        call_id = data.get("call_id", data.get("uuid", ""))
        logger.info(f"SIP outbound call initiated: {call_id} -> {to_number}")
        return OutboundCallResult(
            call_sid=call_id, status="dialing", provider=self.name, metadata=data
        )
