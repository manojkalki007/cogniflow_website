"""Browser-based telephony provider for in-browser voice testing.

Handles WebSocket audio from the browser at 16kHz PCM16.
Audio stays as PCM16 end-to-end — no mulaw compression.
Input: PCM16 from browser mic → converted to mulaw for STT pipeline.
Output: raw PCM16 from TTS → forwarded directly to browser.
"""

import struct
import base64
import json
import logging
import uuid

from starlette.websockets import WebSocket

from cogniflow_home.telephony.base import AudioEncoding, CallInfo, TelephonyProvider

logger = logging.getLogger("cogniflow_home.telephony.browser")

# ─── Pure-Python mu-law encoding (replaces audioop.lin2ulaw for Python 3.13+) ───

_MULAW_BIAS = 0x84
_MULAW_CLIP = 32635

_MULAW_COMPRESS_TABLE = [
    0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3,
    4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
]


def _lin2ulaw_sample(sample: int) -> int:
    """Encode a single 16-bit signed PCM sample to mu-law."""
    sign = 0
    if sample < 0:
        sign = 0x80
        sample = -sample
    if sample > _MULAW_CLIP:
        sample = _MULAW_CLIP
    sample += _MULAW_BIAS
    exponent = _MULAW_COMPRESS_TABLE[(sample >> 7) & 0xFF]
    mantissa = (sample >> (exponent + 3)) & 0x0F
    return ~(sign | (exponent << 4) | mantissa) & 0xFF


def _pcm16_to_mulaw(pcm_data: bytes) -> bytes:
    """Convert PCM16 (little-endian, 16-bit signed) to mu-law bytes."""
    n_samples = len(pcm_data) // 2
    samples = struct.unpack(f"<{n_samples}h", pcm_data[:n_samples * 2])
    return bytes(_lin2ulaw_sample(s) for s in samples)


class BrowserProvider(TelephonyProvider):
    name = "browser"
    encoding = AudioEncoding.MULAW
    sample_rate = 16000
    raw_pcm = True

    def __init__(self):
        self._websocket: WebSocket | None = None
        self._stream_sid: str | None = None
        self._rec_user = bytearray()
        self._rec_agent = bytearray()
        self._recording = True

    def get_recording_wav(self) -> bytes:
        """Mix user + agent PCM16 buffers into a mono 16kHz WAV."""
        import io
        import wave
        user = self._rec_user
        agent = self._rec_agent
        max_len = max(len(user), len(agent))
        if max_len == 0:
            return b""
        user_padded = user + bytes(max_len - len(user))
        agent_padded = agent + bytes(max_len - len(agent))
        n_samples = max_len // 2
        mixed = bytearray(max_len)
        for i in range(n_samples):
            off = i * 2
            u = struct.unpack_from("<h", user_padded, off)[0]
            a = struct.unpack_from("<h", agent_padded, off)[0]
            m = max(-32768, min(32767, (u + a * 2) // 3))
            struct.pack_into("<h", mixed, off, m)
        buf = io.BytesIO()
        with wave.open(buf, "wb") as wf:
            wf.setnchannels(1)
            wf.setsampwidth(2)
            wf.setframerate(16000)
            wf.writeframes(bytes(mixed))
        return buf.getvalue()

    async def handle_websocket(self, websocket: WebSocket, on_audio, on_call_start, on_call_end):
        self._websocket = websocket
        await websocket.accept()

        try:
            async for raw in websocket.iter_text():
                msg = json.loads(raw)
                event = msg.get("event", "")

                if event == "start":
                    self._stream_sid = str(uuid.uuid4())
                    self._rec_user = bytearray()
                    self._rec_agent = bytearray()
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
                        if self._recording:
                            self._rec_user.extend(pcm16)
                        mulaw = _pcm16_to_mulaw(pcm16)
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
        if self._recording:
            try:
                self._rec_agent.extend(base64.b64decode(payload))
            except Exception:
                pass
        try:
            await self._websocket.send_text(json.dumps({
                "event": "audio",
                "data": payload,
            }))
        except Exception:
            pass

    async def send_event(self, event_type: str, data: dict):
        if not self._websocket:
            logger.warning("send_event(%s): no websocket", event_type)
            return
        try:
            payload = json.dumps({"event": event_type, **data})
            logger.info("send_event(%s): %d bytes", event_type, len(payload))
            await self._websocket.send_text(payload)
        except Exception:
            logger.exception("send_event(%s) failed", event_type)

    async def clear_audio(self):
        if self._websocket:
            try:
                await self._websocket.send_text(json.dumps({"event": "clear"}))
            except Exception:
                pass
