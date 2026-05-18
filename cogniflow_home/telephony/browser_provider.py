"""Browser-based telephony provider for in-browser voice testing.

Handles WebSocket audio from the browser at 16kHz PCM16.
Audio stays as PCM16 end-to-end — no mulaw compression.
Input: PCM16 from browser mic → converted to mulaw for STT pipeline.
Output: raw PCM16 from TTS → forwarded directly to browser.
"""

import audioop
import base64
import json
import logging
import uuid

from starlette.websockets import WebSocket

from cogniflow_home.telephony.base import AudioEncoding, CallInfo, TelephonyProvider

logger = logging.getLogger("cogniflow_home.telephony.browser")


class BrowserProvider(TelephonyProvider):
    name = "browser"
    encoding = AudioEncoding.MULAW
    sample_rate = 16000
    raw_pcm = True

    def __init__(self):
        self._websocket: WebSocket | None = None
        self._stream_sid: str | None = None

    async def handle_websocket(self, websocket: WebSocket, on_audio, on_call_start, on_call_end):
        self._websocket = websocket
        await websocket.accept()

        try:
            async for raw in websocket.iter_text():
                msg = json.loads(raw)
                event = msg.get("event", "")

                if event == "start":
                    self._stream_sid = str(uuid.uuid4())
                    call_info = CallInfo(
                        call_sid=msg.get("call_sid", str(uuid.uuid4())),
                        stream_sid=self._stream_sid,
                        caller_number="browser",
                        called_number="agent",
                        direction="inbound",
                        provider="browser",
                        metadata=msg.get("metadata", {}),
                    )
                    try:
                        await on_call_start(call_info)
                    except Exception:
                        logger.exception("Pipeline start failed")
                        await websocket.send_text(json.dumps({
                            "event": "error",
                            "message": "Voice pipeline failed to start. Check server logs.",
                        }))
                        break
                    await websocket.send_text(json.dumps({
                        "event": "started",
                        "call_sid": call_info.call_sid,
                    }))

                elif event == "audio":
                    payload = msg.get("data", "")
                    if payload:
                        pcm16 = base64.b64decode(payload)
                        mulaw = audioop.lin2ulaw(pcm16, 2)
                        await on_audio(mulaw)

                elif event == "stop":
                    break

        except Exception:
            logger.exception("Browser WebSocket error")
        finally:
            await on_call_end()

    async def send_audio(self, payload: str):
        if not self._websocket:
            return
        try:
            await self._websocket.send_text(json.dumps({
                "event": "audio",
                "data": payload,
            }))
        except Exception:
            pass

    async def send_event(self, event_type: str, data: dict):
        if not self._websocket:
            return
        try:
            await self._websocket.send_text(json.dumps({"event": event_type, **data}))
        except Exception:
            pass

    async def clear_audio(self):
        if self._websocket:
            try:
                await self._websocket.send_text(json.dumps({"event": "clear"}))
            except Exception:
                pass
