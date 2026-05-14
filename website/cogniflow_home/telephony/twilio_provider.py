"""Twilio telephony provider.

Handles Twilio Media Streams WebSocket protocol.
Audio format: mulaw 8kHz, base64 encoded.
Supports: call recording, DTMF events, barge-in via clear.
"""

import base64
import json
import logging
from xml.etree.ElementTree import Element, SubElement, tostring

from starlette.websockets import WebSocket

from twilio.rest import Client as TwilioClient

from cogniflow_home.config import settings
from cogniflow_home.telephony.base import AudioEncoding, CallInfo, OutboundCallResult, TelephonyProvider

logger = logging.getLogger("cogniflow_home.telephony.twilio")


class TwilioProvider(TelephonyProvider):
    name = "twilio"
    encoding = AudioEncoding.MULAW
    sample_rate = 8000

    def __init__(self):
        self._websocket: WebSocket | None = None
        self._stream_sid: str | None = None
        self._on_dtmf = None

    def set_dtmf_handler(self, handler):
        self._on_dtmf = handler

    async def handle_websocket(self, websocket: WebSocket, on_audio, on_call_start, on_call_end):
        self._websocket = websocket
        await websocket.accept()

        try:
            async for raw_message in websocket.iter_text():
                message = json.loads(raw_message)
                event = message.get("event")

                if event == "start":
                    start = message.get("start", {})
                    self._stream_sid = start.get("streamSid")
                    call_info = CallInfo(
                        call_sid=start.get("callSid", ""),
                        stream_sid=self._stream_sid,
                        caller_number=start.get("customParameters", {}).get("caller", "unknown"),
                        called_number=start.get("customParameters", {}).get("called", ""),
                        direction="inbound",
                        provider=self.name,
                    )
                    await on_call_start(call_info)

                elif event == "media":
                    payload = message["media"]["payload"]
                    audio_bytes = base64.b64decode(payload)
                    await on_audio(audio_bytes)

                elif event == "dtmf":
                    digit = message.get("dtmf", {}).get("digit", "")
                    logger.info(f"DTMF received: {digit}")
                    if self._on_dtmf:
                        await self._on_dtmf(digit)

                elif event == "mark":
                    pass

                elif event == "stop":
                    break

        except Exception:
            logger.exception("Twilio WebSocket error")
        finally:
            await on_call_end()

    async def send_audio(self, payload: str):
        if self._websocket and self._stream_sid:
            msg = {
                "event": "media",
                "streamSid": self._stream_sid,
                "media": {"payload": payload},
            }
            await self._websocket.send_json(msg)

    async def clear_audio(self):
        if self._websocket and self._stream_sid:
            msg = {
                "event": "clear",
                "streamSid": self._stream_sid,
            }
            await self._websocket.send_json(msg)

    def get_twiml_or_response(self, ws_url: str, caller: str, record: bool = True) -> str:
        response = Element("Response")

        if record:
            SubElement(response, "Start")
            start_el = response.find("Start")
            SubElement(start_el, "Record", {
                "recordingStatusCallback": "/api/recording-status",
                "recordingStatusCallbackEvent": "completed",
            })

        connect = SubElement(response, "Connect")
        stream = SubElement(connect, "Stream", url=ws_url)
        SubElement(stream, "Parameter", name="caller", value=caller)

        return tostring(response, encoding="unicode")

    async def initiate_outbound_call(
        self, to_number: str, webhook_url: str, status_callback_url: str | None = None
    ) -> OutboundCallResult:
        client = TwilioClient(settings.twilio_account_sid, settings.twilio_auth_token)
        kwargs = {
            "to": to_number,
            "from_": settings.twilio_phone_number,
            "url": webhook_url,
        }
        if status_callback_url:
            kwargs["status_callback"] = status_callback_url
            kwargs["status_callback_event"] = ["completed"]

        call = client.calls.create(**kwargs)
        logger.info(f"Twilio outbound call initiated: {call.sid} -> {to_number}")
        return OutboundCallResult(
            call_sid=call.sid, status="dialing", provider=self.name
        )
