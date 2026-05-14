"""Base telephony provider interface.

Every telephony provider (Twilio, Exotel, MCube, etc.) implements this
interface. The pipeline doesn't care which provider is handling the call —
it just receives audio and sends audio back through these callbacks.
"""

from dataclasses import dataclass, field
from enum import Enum
from typing import Callable, Awaitable


class AudioEncoding(Enum):
    MULAW = "mulaw"
    PCM16 = "pcm16"


@dataclass
class TelephonyConfig:
    provider: str
    sample_rate: int = 8000
    encoding: AudioEncoding = AudioEncoding.MULAW
    chunk_duration_ms: int = 20


@dataclass
class CallInfo:
    call_sid: str
    stream_sid: str
    caller_number: str
    called_number: str
    direction: str  # "inbound" or "outbound"
    provider: str
    metadata: dict = field(default_factory=dict)


@dataclass
class OutboundCallResult:
    call_sid: str
    status: str
    provider: str
    metadata: dict = field(default_factory=dict)


class TelephonyProvider:
    """Base class for all telephony providers."""

    name: str = "base"
    encoding: AudioEncoding = AudioEncoding.MULAW
    sample_rate: int = 8000

    async def handle_websocket(self, websocket, on_audio: Callable, on_call_start: Callable, on_call_end: Callable):
        raise NotImplementedError

    async def send_audio(self, payload: str):
        raise NotImplementedError

    async def clear_audio(self):
        """Tell the provider to stop playing any queued audio (for barge-in)."""
        pass

    def get_twiml_or_response(self, ws_url: str, caller: str) -> str:
        """Return the provider-specific webhook response (TwiML, XML, JSON, etc.)."""
        raise NotImplementedError

    async def initiate_outbound_call(
        self, to_number: str, webhook_url: str, status_callback_url: str | None = None
    ) -> OutboundCallResult:
        """Initiate an outbound call via the provider's REST API."""
        raise NotImplementedError(f"Outbound calls not implemented for {self.name}")
