"""Unified phone number management across all telephony providers.

Each provider has a different method for:
  - Listing available numbers to buy
  - Buying/provisioning a number
  - Configuring webhooks on a number (connecting it to Cogniflow)
  - Verifying a number is correctly connected
  - Releasing/deleting a number

This module provides a unified API over all of them.

Provider API references:
  - Twilio: Twilio SDK (python)
  - Exotel: v2_beta ExoPhone API (Basic Auth, api_key:api_token)
  - Vobiz: /api/v1/ REST API (X-Auth-ID + X-Auth-Token headers)
  - MCube: Dashboard only (no public number management API)
  - SIP: Manual PBX configuration
"""

import logging
from dataclasses import dataclass, field
from enum import Enum
from urllib.parse import quote as url_quote

import httpx

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db

logger = logging.getLogger("cogniflow_home.telephony.numbers")


class NumberStatus(str, Enum):
    AVAILABLE = "available"
    PROVISIONING = "provisioning"
    ACTIVE = "active"
    FAILED = "failed"
    RELEASED = "released"


@dataclass
class PhoneNumber:
    number: str
    provider: str
    country: str = ""
    capabilities: list[str] = field(default_factory=lambda: ["voice"])
    status: NumberStatus = NumberStatus.AVAILABLE
    monthly_cost: str = ""
    sid: str = ""
    metadata: dict = field(default_factory=dict)


# ─── Twilio ───

async def twilio_list_available(country: str = "US", area_code: str = "", number_type: str = "local") -> list[PhoneNumber]:
    if not settings.twilio_account_sid:
        return []
    from twilio.rest import Client
    import asyncio
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

    def _fetch():
        if number_type == "toll_free":
            numbers = client.available_phone_numbers(country).toll_free.list(limit=20)
        elif number_type == "mobile":
            numbers = client.available_phone_numbers(country).mobile.list(limit=20)
        else:
            kwargs = {"limit": 20}
            if area_code:
                kwargs["area_code"] = area_code
            numbers = client.available_phone_numbers(country).local.list(**kwargs)
        return numbers

    numbers = await asyncio.to_thread(_fetch)
    return [
        PhoneNumber(
            number=n.phone_number,
            provider="twilio",
            country=country,
            capabilities=[c for c in ["voice", "sms", "mms"] if getattr(n.capabilities, c, False)],
            status=NumberStatus.AVAILABLE,
            monthly_cost=str(getattr(n, "monthly_cost", "1.00")),
            metadata={"friendly_name": n.friendly_name, "locality": getattr(n, "locality", "")},
        )
        for n in numbers
    ]


async def twilio_buy_number(phone_number: str) -> PhoneNumber:
    from twilio.rest import Client
    import asyncio
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

    webhook_url = f"{settings.public_url}/voice/twilio/inbound"
    status_url = f"{settings.public_url}/api/recording-status"

    def _buy():
        return client.incoming_phone_numbers.create(
            phone_number=phone_number,
            voice_url=webhook_url,
            voice_method="POST",
            status_callback=status_url,
            status_callback_method="POST",
        )

    number = await asyncio.to_thread(_buy)
    return PhoneNumber(
        number=number.phone_number,
        provider="twilio",
        country=number.iso_country,
        capabilities=["voice"],
        status=NumberStatus.ACTIVE,
        sid=number.sid,
        metadata={"friendly_name": number.friendly_name},
    )


async def twilio_connect_number(phone_number_sid: str) -> bool:
    """Update an existing Twilio number's webhooks to point to Cogniflow."""
    from twilio.rest import Client
    import asyncio
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

    webhook_url = f"{settings.public_url}/voice/twilio/inbound"

    def _update():
        return client.incoming_phone_numbers(phone_number_sid).update(
            voice_url=webhook_url,
            voice_method="POST",
            status_callback=f"{settings.public_url}/api/recording-status",
            status_callback_method="POST",
        )

    try:
        await asyncio.to_thread(_update)
        return True
    except Exception:
        logger.exception(f"Failed to connect Twilio number {phone_number_sid}")
        return False


async def twilio_list_owned() -> list[PhoneNumber]:
    if not settings.twilio_account_sid:
        return []
    from twilio.rest import Client
    import asyncio
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

    numbers = await asyncio.to_thread(lambda: client.incoming_phone_numbers.list(limit=100))
    webhook_base = settings.public_url
    return [
        PhoneNumber(
            number=n.phone_number,
            provider="twilio",
            country=n.iso_country,
            capabilities=["voice"],
            status=NumberStatus.ACTIVE if webhook_base in (n.voice_url or "") else NumberStatus.AVAILABLE,
            sid=n.sid,
            metadata={
                "friendly_name": n.friendly_name,
                "voice_url": n.voice_url,
                "connected": webhook_base in (n.voice_url or ""),
            },
        )
        for n in numbers
    ]


async def twilio_verify_number(phone_number: str) -> dict:
    """Verify a Twilio number is correctly connected to Cogniflow webhooks."""
    if not settings.twilio_account_sid:
        return {"connected": False, "error": "Twilio not configured"}
    from twilio.rest import Client
    import asyncio
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)

    numbers = await asyncio.to_thread(
        lambda: client.incoming_phone_numbers.list(phone_number=phone_number)
    )
    if not numbers:
        return {"connected": False, "error": "Number not found in Twilio account"}

    n = numbers[0]
    expected_url = f"{settings.public_url}/voice/twilio/inbound"
    connected = n.voice_url == expected_url
    return {
        "connected": connected,
        "number": n.phone_number,
        "voice_url": n.voice_url,
        "expected_url": expected_url,
        "sid": n.sid,
        "fix_needed": not connected,
    }


async def twilio_release_number(phone_number_sid: str) -> bool:
    from twilio.rest import Client
    import asyncio
    client = Client(settings.twilio_account_sid, settings.twilio_auth_token)
    try:
        await asyncio.to_thread(lambda: client.incoming_phone_numbers(phone_number_sid).delete())
        return True
    except Exception:
        logger.exception(f"Failed to release Twilio number {phone_number_sid}")
        return False


# ─── Exotel ───
# API: v2_beta for ExoPhone management, v1 for calls
# Auth: HTTP Basic (api_key:api_token)
# Base: https://{subdomain}.exotel.com (api or api.in)

def _exotel_base() -> str:
    subdomain = settings.exotel_subdomain or "api"
    return f"https://{subdomain}.exotel.com"


def _exotel_auth() -> tuple[str, str]:
    return (settings.exotel_api_key, settings.exotel_api_token)


def _exotel_sid() -> str:
    return settings.exotel_account_sid or settings.exotel_api_key


async def exotel_list_available(country: str = "IN", area_code: str = "", number_type: str = "local") -> list[PhoneNumber]:
    """Search available numbers via GET /v2_beta/Accounts/{sid}/AvailablePhoneNumbers."""
    if not settings.exotel_api_key:
        return []
    url = f"{_exotel_base()}/v2_beta/Accounts/{_exotel_sid()}/AvailablePhoneNumbers"
    params = {}
    if country:
        params["country"] = country
    if number_type:
        params["type"] = number_type
    if area_code:
        params["region"] = area_code

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url, params=params,
            auth=_exotel_auth(),
            timeout=15.0,
        )
    if resp.status_code != 200:
        logger.error(f"Exotel list available failed: {resp.status_code} {resp.text}")
        return []

    data = resp.json()
    numbers = data.get("AvailablePhoneNumbers", data.get("available_phone_numbers", []))
    return [
        PhoneNumber(
            number=n.get("phone_number", n.get("PhoneNumber", "")),
            provider="exotel",
            country="IN",
            capabilities=n.get("capabilities", ["voice"]),
            status=NumberStatus.AVAILABLE,
            monthly_cost=str(n.get("monthly_rental_charge", n.get("MonthlyRentalCharge", ""))),
            metadata=n,
        )
        for n in numbers
    ]


async def exotel_buy_number(phone_number: str) -> PhoneNumber:
    """Purchase a number via POST /v2_beta/Accounts/{sid}/IncomingPhoneNumbers."""
    url = f"{_exotel_base()}/v2_beta/Accounts/{_exotel_sid()}/IncomingPhoneNumbers"

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            url,
            json={"phone_number": phone_number},
            auth=_exotel_auth(),
            timeout=15.0,
        )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Exotel buy number failed: {resp.status_code} {resp.text}")

    data = resp.json()
    incoming = data.get("IncomingPhoneNumber", data)
    return PhoneNumber(
        number=phone_number,
        provider="exotel",
        country="IN",
        status=NumberStatus.ACTIVE,
        sid=incoming.get("sid", incoming.get("Sid", "")),
        metadata=data,
    )


async def exotel_connect_number(exophone_sid: str) -> bool:
    """Assign an ExoPhone to a Cogniflow flow.

    Note: Exotel requires a Flow (with Voicebot applet) to be configured
    in the dashboard first. This API assigns the ExoPhone to that flow.
    The flow's Voicebot applet should point to our WebSocket URL.

    Uses PUT /v2_beta/Accounts/{sid}/IncomingPhoneNumbers/{exophone_sid}.
    """
    url = f"{_exotel_base()}/v2_beta/Accounts/{_exotel_sid()}/IncomingPhoneNumbers/{exophone_sid}"

    async with httpx.AsyncClient() as client:
        resp = await client.put(
            url,
            json={},
            auth=_exotel_auth(),
            timeout=15.0,
        )
    if resp.status_code not in (200, 204):
        logger.error(f"Exotel connect failed: {resp.status_code} {resp.text}")
        return False
    return True


async def exotel_list_owned() -> list[PhoneNumber]:
    """List all ExoPhones via GET /v2_beta/Accounts/{sid}/IncomingPhoneNumbers."""
    if not settings.exotel_api_key:
        return []
    url = f"{_exotel_base()}/v2_beta/Accounts/{_exotel_sid()}/IncomingPhoneNumbers"

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            url,
            auth=_exotel_auth(),
            timeout=15.0,
        )
    if resp.status_code != 200:
        return []

    data = resp.json()
    numbers = data.get("IncomingPhoneNumbers", data.get("incoming_phone_numbers", []))
    return [
        PhoneNumber(
            number=n.get("phone_number", n.get("PhoneNumber", "")),
            provider="exotel",
            country="IN",
            capabilities=n.get("capabilities", ["voice"]),
            status=NumberStatus.ACTIVE,
            sid=n.get("sid", n.get("Sid", "")),
            metadata={
                "friendly_name": n.get("friendly_name", n.get("FriendlyName", "")),
            },
        )
        for n in numbers
    ]


async def exotel_verify_number(phone_number: str) -> dict:
    """Verify an ExoPhone exists in the account."""
    owned = await exotel_list_owned()
    for n in owned:
        if n.number == phone_number or n.number.endswith(phone_number.lstrip("+")):
            return {
                "connected": True,
                "number": n.number,
                "sid": n.sid,
                "fix_needed": False,
                "note": "Exotel flow assignment must be verified in the Exotel dashboard",
            }
    return {"connected": False, "error": "Number not found in Exotel account"}


async def exotel_release_number(exophone_sid: str) -> bool:
    """Release an ExoPhone via DELETE /v2_beta/Accounts/{sid}/IncomingPhoneNumbers/{exophone_sid}."""
    url = f"{_exotel_base()}/v2_beta/Accounts/{_exotel_sid()}/IncomingPhoneNumbers/{exophone_sid}"
    async with httpx.AsyncClient() as client:
        resp = await client.delete(url, auth=_exotel_auth(), timeout=15.0)
    if resp.status_code not in (200, 204):
        logger.error(f"Exotel release failed: {resp.status_code} {resp.text}")
        return False
    return True


# ─── Vobiz ───
# API: https://api.vobiz.ai/api/v1
# Auth: X-Auth-ID + X-Auth-Token headers
# Endpoint casing: /Account/ (capital), /numbers (lowercase), /Application/ (capital)

VOBIZ_API_BASE = "https://api.vobiz.ai/api/v1"


def _vobiz_headers() -> dict:
    return {
        "X-Auth-ID": settings.vobiz_auth_id,
        "X-Auth-Token": settings.vobiz_auth_token,
        "Content-Type": "application/json",
    }


async def vobiz_list_available(country: str = "IN", area_code: str = "", number_type: str = "local") -> list[PhoneNumber]:
    """Search available numbers via GET /api/v1/Account/{auth_id}/inventory/numbers."""
    if not settings.vobiz_auth_id:
        return []
    params = {}
    if country:
        params["country"] = country
    if area_code:
        params["search"] = area_code

    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{VOBIZ_API_BASE}/Account/{settings.vobiz_auth_id}/inventory/numbers",
            headers=_vobiz_headers(),
            params=params,
            timeout=15.0,
        )
    if resp.status_code != 200:
        logger.error(f"Vobiz list available failed: {resp.status_code}")
        return []

    data = resp.json()
    items = data.get("items", [])
    return [
        PhoneNumber(
            number=n.get("e164", ""),
            provider="vobiz",
            country=n.get("country", country),
            capabilities=["voice"] + (["sms"] if n.get("voice_enabled") else []),
            status=NumberStatus.AVAILABLE,
            monthly_cost=str(n.get("monthly_fee", "")),
            metadata={
                "region": n.get("region", ""),
                "setup_fee": n.get("setup_fee", ""),
                "currency": n.get("currency", "INR"),
            },
        )
        for n in items
    ]


async def vobiz_buy_number(phone_number: str) -> PhoneNumber:
    """Purchase from inventory via POST /api/v1/Account/{auth_id}/numbers/purchase-from-inventory."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{VOBIZ_API_BASE}/Account/{settings.vobiz_auth_id}/numbers/purchase-from-inventory",
            headers=_vobiz_headers(),
            json={"e164": phone_number},
            timeout=15.0,
        )
    if resp.status_code not in (200, 201):
        raise RuntimeError(f"Vobiz buy number failed: {resp.status_code} {resp.text}")

    data = resp.json()
    num = data.get("number", {})
    return PhoneNumber(
        number=num.get("e164", phone_number),
        provider="vobiz",
        country=num.get("country", "IN"),
        status=NumberStatus.ACTIVE,
        sid=str(num.get("id", "")),
        metadata=data,
    )


async def vobiz_connect_number(phone_number: str) -> bool:
    """Create a Vobiz XML Application and attach the number to it.

    Step 1: POST /api/v1/Account/{auth_id}/Application/ — create app with answer_url
    Step 2: POST /api/v1/Account/{auth_id}/numbers/{number}/application — attach number
    """
    encoded_number = url_quote(phone_number, safe="")

    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{VOBIZ_API_BASE}/Account/{settings.vobiz_auth_id}/Application/",
            headers=_vobiz_headers(),
            json={
                "app_name": f"Cogniflow-{phone_number[-4:]}",
                "answer_url": f"{settings.public_url}/voice/vobiz/inbound",
                "answer_method": "POST",
                "hangup_url": f"{settings.public_url}/voice/vobiz/hangup",
                "hangup_method": "POST",
                "application_type": "XML",
            },
            timeout=15.0,
        )
    if resp.status_code not in (200, 201):
        logger.error(f"Vobiz app creation failed: {resp.status_code} {resp.text}")
        return False

    app_data = resp.json()
    app_id = app_data.get("app_id", "")
    if not app_id:
        logger.error("Vobiz app creation returned no app_id")
        return False

    async with httpx.AsyncClient() as client:
        resp2 = await client.post(
            f"{VOBIZ_API_BASE}/Account/{settings.vobiz_auth_id}/Number/{phone_number}/",
            headers=_vobiz_headers(),
            json={"app_id": app_id},
            timeout=15.0,
        )
    if resp2.status_code not in (200, 201):
        logger.error(f"Vobiz number attachment failed: {resp2.status_code} {resp2.text}")
        return False
    return True


async def vobiz_list_owned() -> list[PhoneNumber]:
    """List owned numbers via GET /api/v1/Account/{auth_id}/numbers."""
    if not settings.vobiz_auth_id:
        return []
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{VOBIZ_API_BASE}/Account/{settings.vobiz_auth_id}/numbers",
            headers=_vobiz_headers(),
            timeout=15.0,
        )
    if resp.status_code != 200:
        return []

    data = resp.json()
    items = data.get("items", data.get("objects", []))
    return [
        PhoneNumber(
            number=n.get("e164", n.get("number", "")),
            provider="vobiz",
            country=n.get("country", "IN"),
            capabilities=["voice"],
            status=NumberStatus.ACTIVE,
            sid=str(n.get("id", "")),
            metadata={
                "trunk_group_id": n.get("trunk_group_id", ""),
                "status": n.get("status", ""),
            },
        )
        for n in items
    ]


async def vobiz_verify_number(phone_number: str) -> dict:
    """Verify a Vobiz number exists in the account."""
    owned = await vobiz_list_owned()
    for n in owned:
        if n.number == phone_number or phone_number in n.number:
            return {
                "connected": True,
                "number": n.number,
                "sid": n.sid,
                "fix_needed": False,
            }
    return {"connected": False, "error": "Number not found in Vobiz account"}


async def vobiz_release_number(phone_number: str) -> bool:
    """Release a number via DELETE /api/v1/Account/{auth_id}/numbers/{number}."""
    encoded = url_quote(phone_number, safe="")
    async with httpx.AsyncClient() as client:
        resp = await client.delete(
            f"{VOBIZ_API_BASE}/Account/{settings.vobiz_auth_id}/numbers/{encoded}",
            headers=_vobiz_headers(),
            timeout=15.0,
        )
    if resp.status_code not in (200, 204):
        logger.error(f"Vobiz release failed: {resp.status_code} {resp.text}")
        return False
    return True


# ─── MCube ───
# MCube has NO public API for number management.
# Virtual numbers are managed through the MCube dashboard only.
# Auth: HTTP_AUTHORIZATION query parameter
# Base: https://api.mcube.com/Restmcube-api/

async def mcube_list_owned() -> list[PhoneNumber]:
    """MCube numbers cannot be listed via API.

    Returns the configured MCube number from settings if available.
    All other number management must be done through the MCube dashboard.
    """
    if not settings.mcube_api_key or not settings.mcube_phone_number:
        return []
    return [
        PhoneNumber(
            number=settings.mcube_phone_number,
            provider="mcube",
            country="IN",
            capabilities=["voice"],
            status=NumberStatus.ACTIVE,
            metadata={
                "note": "MCube numbers are managed through their dashboard",
                "dashboard": "https://www.mcube.com",
            },
        ),
    ]


async def mcube_verify_number(phone_number: str) -> dict:
    """MCube verification is limited — check if number matches config."""
    if not settings.mcube_api_key:
        return {"connected": False, "error": "MCube not configured"}
    if settings.mcube_phone_number and phone_number in settings.mcube_phone_number:
        return {
            "connected": True,
            "number": phone_number,
            "fix_needed": False,
            "note": "MCube numbers are configured in dashboard. Verify hangup URL is set.",
            "supports_streaming": False,
        }
    return {
        "connected": False,
        "error": "Number does not match configured MCube number",
        "configured_number": settings.mcube_phone_number,
    }


# ─── SIP ───

async def sip_verify_trunk() -> dict:
    """Verify SIP trunk connectivity by checking configuration."""
    if not settings.sip_trunk_host:
        return {"connected": False, "error": "SIP trunk not configured. Set SIP_TRUNK_HOST in .env"}

    return {
        "connected": bool(settings.sip_trunk_host and settings.sip_trunk_username),
        "host": settings.sip_trunk_host,
        "port": settings.sip_trunk_port,
        "transport": settings.sip_trunk_transport,
        "has_credentials": bool(settings.sip_trunk_username),
        "fix_needed": not bool(settings.sip_trunk_username),
    }


# ─── Unified API ───

PROVIDER_HANDLERS = {
    "twilio": {
        "list_available": twilio_list_available,
        "buy": twilio_buy_number,
        "connect": twilio_connect_number,
        "list_owned": twilio_list_owned,
        "verify": twilio_verify_number,
        "release": twilio_release_number,
    },
    "exotel": {
        "list_available": exotel_list_available,
        "buy": exotel_buy_number,
        "connect": exotel_connect_number,
        "list_owned": exotel_list_owned,
        "verify": exotel_verify_number,
        "release": exotel_release_number,
    },
    "vobiz": {
        "list_available": vobiz_list_available,
        "buy": vobiz_buy_number,
        "connect": vobiz_connect_number,
        "list_owned": vobiz_list_owned,
        "verify": vobiz_verify_number,
        "release": vobiz_release_number,
    },
    "mcube": {
        "list_owned": mcube_list_owned,
        "verify": mcube_verify_number,
    },
    "sip": {
        "verify": sip_verify_trunk,
    },
}


async def list_all_numbers() -> dict:
    """List all owned numbers across all configured providers."""
    results = {}
    for provider_name, handlers in PROVIDER_HANDLERS.items():
        if "list_owned" in handlers:
            try:
                numbers = await handlers["list_owned"]()
                results[provider_name] = [
                    {
                        "number": n.number,
                        "provider": n.provider,
                        "country": n.country,
                        "status": n.status.value,
                        "capabilities": n.capabilities,
                        "connected": n.metadata.get("connected", n.status == NumberStatus.ACTIVE),
                        "sid": n.sid,
                    }
                    for n in numbers
                ]
            except Exception:
                logger.debug(f"Failed to list {provider_name} numbers", exc_info=True)
                results[provider_name] = []
    return results


async def verify_all_numbers() -> dict:
    """Verify all phone numbers assigned to agents are correctly connected."""
    agents = await db.select("agents", {"is_active": "true"})
    results = []

    for agent in agents:
        phone_numbers = agent.get("phone_numbers", [])
        for number in phone_numbers:
            provider_name = _detect_provider(number, agent)
            handlers = PROVIDER_HANDLERS.get(provider_name, {})
            verify_fn = handlers.get("verify")
            if verify_fn:
                try:
                    status = await verify_fn(number)
                    results.append({
                        "number": number,
                        "provider": provider_name,
                        "agent_id": agent["id"],
                        "agent_name": agent.get("name", ""),
                        **status,
                    })
                except Exception as e:
                    results.append({
                        "number": number,
                        "provider": provider_name,
                        "agent_id": agent["id"],
                        "agent_name": agent.get("name", ""),
                        "connected": False,
                        "error": str(e),
                    })
            else:
                results.append({
                    "number": number,
                    "provider": provider_name,
                    "agent_id": agent["id"],
                    "agent_name": agent.get("name", ""),
                    "connected": False,
                    "error": f"No verification handler for {provider_name}",
                })

    return {"numbers": results, "total": len(results), "connected": sum(1 for r in results if r.get("connected"))}


def _detect_provider(phone_number: str, agent: dict) -> str:
    """Detect which provider a phone number belongs to based on metadata or format."""
    meta = agent.get("metadata", {})
    if meta.get("telephony_provider"):
        return meta["telephony_provider"]

    if phone_number.startswith("+1"):
        return "twilio"
    if phone_number.startswith("+91"):
        if settings.vobiz_auth_id:
            return "vobiz"
        if settings.exotel_api_key:
            return "exotel"
        if settings.mcube_api_key:
            return "mcube"
    if phone_number.startswith("sip:"):
        return "sip"
    return "twilio"
