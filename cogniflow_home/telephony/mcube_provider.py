"""MCube telephony provider (India) — click-to-call only.

MCube is a traditional cloud telephony platform (IVR + call routing).
It does NOT support real-time WebSocket audio streaming, so it cannot
be used for AI voice agents that need bidirectional audio.

Supported operations:
  - Click-to-call outbound (connect agent extension to customer)
  - Webhook callbacks for call status (via refurl parameter)

NOT supported:
  - WebSocket/real-time audio streaming
  - Bidirectional media
  - Programmatic number management (dashboard only)

Auth: HTTP_AUTHORIZATION query parameter (API key from Edit Profile > API Key)
Base URL: https://api.mcube.com/Restmcube-api/
"""

import logging

import httpx

from cogniflow_home.config import settings
from cogniflow_home.telephony.base import (
    AudioEncoding,
    CallInfo,
    OutboundCallResult,
    TelephonyProvider,
)

logger = logging.getLogger("cogniflow_home.telephony.mcube")

MCUBE_API_BASE = "https://api.mcube.com/Restmcube-api"


class MCubeProvider(TelephonyProvider):
    """MCube Cloud Telephony — click-to-call only.

    MCube does not support real-time audio streaming (WebSocket).
    This provider only handles outbound click-to-call connections
    and webhook callbacks. It cannot be used for AI voice agents.

    For AI voice on MCube numbers, route through SIP trunk instead.
    """

    name = "mcube"
    encoding = AudioEncoding.MULAW
    sample_rate = 8000
    supports_streaming = False

    async def handle_websocket(self, websocket, on_audio, on_call_start, on_call_end):
        raise NotImplementedError(
            "MCube does not support WebSocket audio streaming. "
            "Use Twilio, Exotel, or Vobiz for AI voice agents, "
            "or route MCube numbers through a SIP trunk bridge."
        )

    async def send_audio(self, payload: str):
        raise NotImplementedError("MCube does not support real-time audio streaming")

    async def clear_audio(self):
        raise NotImplementedError("MCube does not support real-time audio streaming")

    def get_twiml_or_response(self, ws_url: str, caller: str) -> str:
        raise NotImplementedError(
            "MCube does not support webhook-triggered streaming. "
            "Configure call routing in the MCube dashboard instead."
        )

    async def initiate_outbound_call(
        self, to_number: str, webhook_url: str, status_callback_url: str | None = None
    ) -> OutboundCallResult:
        """MCube click-to-call via GET /Restmcube-api/outbound-calls.

        Initiates a call: MCube calls the agent extension first,
        then connects to the customer number when the agent picks up.

        Args:
            to_number: Customer phone number (domestic format, e.g. 95XXXXXXXX)
            webhook_url: Not used by MCube (agent extension is configured in settings)
            status_callback_url: URL for hangup callback (refurl parameter)
        """
        if not settings.mcube_api_key:
            raise RuntimeError("MCube API key not configured")

        params = {
            "HTTP_AUTHORIZATION": settings.mcube_api_key,
            "exenumber": settings.mcube_phone_number,
            "custnumber": to_number,
        }
        if status_callback_url:
            params["refurl"] = status_callback_url

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{MCUBE_API_BASE}/outbound-calls",
                params=params,
                timeout=15.0,
            )

        if response.status_code != 200:
            logger.error(f"MCube outbound call failed: {response.status_code} {response.text}")
            raise RuntimeError(f"MCube API error: {response.status_code}")

        data = response.json()
        call_id = data.get("monitorUcid", "")
        status = data.get("status", "unknown")
        logger.info(f"MCube click-to-call initiated: {call_id} -> {to_number}")
        return OutboundCallResult(
            call_sid=call_id, status=status, provider=self.name, metadata=data
        )
