"""Exotel telephony provider.

Handles Exotel Voicebot Applet bidirectional WebSocket protocol.
Audio format: PCM 16-bit signed little-endian, 8kHz mono, base64 encoded.
Chunk size must be a multiple of 320 bytes (min 3.2KB = 100ms).

Protocol (from Exotel docs):
  Events from Exotel: connected, start, media, dtmf, stop, mark
  Events to Exotel: media (send audio), mark, clear
  Max session: 60 min. Bot must respond within 10 seconds.

Auth: HTTP Basic (api_key:api_token), Account SID in path.
Regional base URLs: api.exotel.com (Singapore), api.in.exotel.com (Mumbai).
Rate limit: 200 req/min per account.

Outbound approaches:
  1. Connect + StreamUrl: POST /v1/Accounts/{sid}/Calls/connect (From, CallerId, StreamUrl)
  2. Connect to Flow: POST /v1/Accounts/{sid}/Calls/connect (From, CallerId, Url=flow_url)
  3. AgentStream v2: POST /v2/accounts/{sid}/legs then /legs/{lid}/actions/start_stream
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


def _exotel_base_url() -> str:
    subdomain = settings.exotel_subdomain or "api"
    return f"https://{subdomain}.exotel.com"


def _exotel_auth() -> tuple[str, str]:
    return (settings.exotel_api_key, settings.exotel_api_token)


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
                    self._stream_sid = start.get("stream_sid", "")
                    call_info = CallInfo(
                        call_sid=start.get("call_sid", ""),
                        stream_sid=self._stream_sid,
                        caller_number=start.get("from", "unknown"),
                        called_number=start.get("to", ""),
                        direction="inbound",
                        provider=self.name,
                        metadata={
                            "account_sid": start.get("account_sid", ""),
                            "media_format": start.get("media_format", {}),
                            "custom_parameters": start.get("custom_parameters", {}),
                        },
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

                elif event == "mark":
                    mark = message.get("mark", {})
                    logger.debug(f"Exotel mark event: {mark.get('name', '')}")

                elif event == "stop":
                    stop = message.get("stop", {})
                    reason = stop.get("reason", "unknown")
                    logger.info(f"Exotel stream stopped: {self._stream_sid} reason={reason}")
                    break

        except Exception:
            logger.exception("Exotel WebSocket error")
        finally:
            await on_call_end()

    async def send_audio(self, payload: str):
        """Send audio back to Exotel. Input is base64 mulaw, we convert to PCM16."""
        if not self._websocket or not self._stream_sid:
            return

        try:
            mulaw_bytes = base64.b64decode(payload)
            pcm_bytes = mulaw_to_pcm16(mulaw_bytes)

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
        except Exception:
            logger.warning("Exotel WebSocket send failed (connection closed)")

    async def send_mark(self, label: str):
        """Request notification when audio finishes playing."""
        if self._websocket and self._stream_sid:
            try:
                await self._websocket.send_text(json.dumps({
                    "event": "mark",
                    "sequence_number": 15,
                    "stream_sid": self._stream_sid,
                    "mark": {"name": label},
                }))
            except Exception:
                logger.warning("Exotel mark send failed")

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
        """Initiate outbound call via Exotel Connect API.

        Uses the StreamUrl parameter to start bidirectional WebSocket streaming
        when the call connects — this avoids needing a pre-configured flow.
        """
        account_sid = settings.exotel_account_sid or settings.exotel_api_key
        url = f"{_exotel_base_url()}/v1/Accounts/{account_sid}/Calls/connect"

        ws_base = settings.public_url.replace("https://", "wss://").replace("http://", "ws://")
        stream_url = f"{ws_base}/voice/exotel/ws"

        data = {
            "From": to_number,
            "CallerId": settings.exotel_caller_id,
            "CallType": "trans",
            "StreamUrl": stream_url,
            "StreamBegin": "at Leg1Connect",
        }
        if status_callback_url:
            data["StatusCallback"] = status_callback_url
            data["StatusCallbackEvents[0]"] = "terminal"
            data["StatusCallbackEvents[1]"] = "answered"

        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                data=data,
                auth=_exotel_auth(),
                timeout=15.0,
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
