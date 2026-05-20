"""Telephony provider registry.

Maps provider names to their implementations.

Streaming-capable providers (support bidirectional WebSocket audio):
  - twilio, exotel, vobiz, sip, browser, generic

Non-streaming providers (click-to-call / callback only):
  - mcube (no WebSocket API — use SIP bridge for AI voice)
"""

from cogniflow_home.telephony.base import TelephonyProvider
from cogniflow_home.telephony.browser_provider import BrowserProvider
from cogniflow_home.telephony.exotel_provider import ExotelProvider
from cogniflow_home.telephony.generic_provider import GenericProvider
from cogniflow_home.telephony.mcube_provider import MCubeProvider
from cogniflow_home.telephony.sip_provider import SIPProvider
from cogniflow_home.telephony.twilio_provider import TwilioProvider
from cogniflow_home.telephony.vobiz_provider import VobizProvider

PROVIDERS: dict[str, type[TelephonyProvider]] = {
    "twilio": TwilioProvider,
    "exotel": ExotelProvider,
    "vobiz": VobizProvider,
    "mcube": MCubeProvider,
    "sip": SIPProvider,
    "generic": GenericProvider,
    "browser": BrowserProvider,
}

STREAMING_PROVIDERS = {"twilio", "exotel", "vobiz", "sip", "browser", "generic"}


def get_provider(name: str) -> TelephonyProvider:
    provider_class = PROVIDERS.get(name.lower())
    if not provider_class:
        raise ValueError(
            f"Unknown telephony provider: {name}. "
            f"Available: {', '.join(PROVIDERS.keys())}"
        )
    return provider_class()


def supports_streaming(name: str) -> bool:
    return name.lower() in STREAMING_PROVIDERS
