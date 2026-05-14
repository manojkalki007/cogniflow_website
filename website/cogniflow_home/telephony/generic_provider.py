"""Generic telephony provider template.

Use this as a starting point for providers that support WebSocket
media streaming (MCube, Plivo, Knowlarity, Ozonetel, etc.).

To add a new provider:
1. Copy this file and rename it (e.g., mcube_provider.py)
2. Implement the WebSocket message parsing for your provider's protocol
3. Register it in the PROVIDERS dict in telephony/registry.py
"""

import base64
import json
import logging

from starlette.websockets import WebSocket

from cogniflow_home.telephony.base import AudioEncoding, CallInfo, TelephonyProvider

logger = logging.getLogger("cogniflow_home.telephony.generic")


class GenericProvider(TelephonyProvider):
    """
    Generic WebSocket media streaming provider.

    Assumes a protocol similar to Twilio/Exotel:
      - JSON messages over WebSocket
      - Events: start, media, stop
      - Audio: base64 encoded in a "media.payload" field

    Override the methods below to match your provider's exact protocol.
    """

    name = "generic"
    encoding = AudioEncoding.MULAW
    sample_rate = 8000

    def __init__(self):
        self._websocket: WebSocket | None = None
        self._stream_sid: str | None = None

    def parse_start_event(self, message: dict) -> CallInfo:
        """Override this to extract call info from your provider's start event."""
        start = message.get("start", message.get("data", {}))
        return CallInfo(
            call_sid=start.get("call_sid", start.get("callSid", "")),
            stream_sid=start.get("stream_sid", start.get("streamSid", "")),
            caller_number=start.get("from", start.get("caller", "unknown")),
            called_number=start.get("to", start.get("called", "")),
            direction="inbound",
            provider=self.name,
        )

    def parse_audio_event(self, message: dict) -> bytes:
        """Override this to extract audio bytes from your provider's media event."""
        media = message.get("media", {})
        payload = media.get("payload", "")
        return base64.b64decode(payload) if payload else b""

    def build_audio_response(self, payload: str) -> str:
        """Override this to build the JSON response for sending audio back."""
        return json.dumps({
            "event": "media",
            "stream_sid": self._stream_sid,
            "media": {"payload": payload},
        })

    async def handle_websocket(self, websocket: WebSocket, on_audio, on_call_start, on_call_end):
        self._websocket = websocket
        await websocket.accept()

        try:
            async for raw_message in websocket.iter_text():
                message = json.loads(raw_message)
                event = message.get("event", "").lower()

                if event == "start":
                    call_info = self.parse_start_event(message)
                    self._stream_sid = call_info.stream_sid
                    await on_call_start(call_info)

                elif event == "media":
                    audio_bytes = self.parse_audio_event(message)
                    if audio_bytes:
                        await on_audio(audio_bytes)

                elif event in ("stop", "end", "disconnect"):
                    break

        except Exception:
            logger.exception(f"{self.name} WebSocket error")
        finally:
            await on_call_end()

    async def send_audio(self, payload: str):
        if self._websocket and self._stream_sid:
            msg = self.build_audio_response(payload)
            await self._websocket.send_text(msg)

    def get_twiml_or_response(self, ws_url: str, caller: str) -> str:
        return json.dumps({"websocket_url": ws_url, "caller": caller})
