"""Telephony provider registry.

Maps provider names to their implementations.
Add new providers here after creating their module.
"""

from cogniflow_home.telephony.base import TelephonyProvider
from cogniflow_home.telephony.browser_provider import BrowserProvider
from cogniflow_home.telephony.exotel_provider import ExotelProvider
from cogniflow_home.telephony.generic_provider import GenericProvider
from cogniflow_home.telephony.twilio_provider import TwilioProvider
from cogniflow_home.telephony.vobiz_provider import VobizProvider

PROVIDERS: dict[str, type[TelephonyProvider]] = {
    "twilio": TwilioProvider,
    "exotel": ExotelProvider,
    "vobiz": VobizProvider,
    "generic": GenericProvider,
    "browser": BrowserProvider,
}


def get_provider(name: str) -> TelephonyProvider:
    provider_class = PROVIDERS.get(name.lower())
    if not provider_class:
        raise ValueError(
            f"Unknown telephony provider: {name}. "
            f"Available: {', '.join(PROVIDERS.keys())}"
        )
    return provider_class()
