"""Phone number management — buy, connect, verify, list across all providers."""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from cogniflow_home.config import settings
from cogniflow_home.telephony.numbers import (
    PROVIDER_HANDLERS,
    list_all_numbers,
    verify_all_numbers,
)
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["numbers"])


@router.get("/api/numbers")
async def api_list_numbers(auth: AuthContext = Depends(get_auth_context)):
    """List all owned phone numbers across all configured providers."""
    numbers = await list_all_numbers()

    configured_providers = []
    if settings.twilio_account_sid:
        configured_providers.append("twilio")
    if settings.exotel_api_key:
        configured_providers.append("exotel")
    if settings.vobiz_auth_id:
        configured_providers.append("vobiz")
    if settings.mcube_api_key:
        configured_providers.append("mcube")
    if settings.sip_trunk_host:
        configured_providers.append("sip")

    return {
        "numbers": numbers,
        "configured_providers": configured_providers,
        "webhook_base": settings.public_url,
    }


@router.get("/api/numbers/available")
async def api_list_available(
    provider: str = "twilio",
    country: str = "US",
    area_code: str = "",
    number_type: str = "local",
    auth: AuthContext = Depends(get_auth_context),
):
    """List available phone numbers to buy from a provider."""
    handlers = PROVIDER_HANDLERS.get(provider)
    if not handlers or "list_available" not in handlers:
        return JSONResponse(
            {"error": f"Number listing not supported for {provider}"},
            status_code=400,
        )
    try:
        numbers = await handlers["list_available"](country=country, area_code=area_code, number_type=number_type)
        return {
            "numbers": [
                {
                    "number": n.number,
                    "provider": n.provider,
                    "country": n.country,
                    "capabilities": n.capabilities,
                    "monthly_cost": n.monthly_cost,
                    "metadata": n.metadata,
                }
                for n in numbers
            ],
            "count": len(numbers),
        }
    except Exception as e:
        logger.exception(f"Failed to list available numbers from {provider}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/api/numbers/buy")
async def api_buy_number(request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Buy/provision a phone number from a provider."""
    body = await request.json()
    provider = body.get("provider")
    phone_number = body.get("phone_number")

    if not provider or not phone_number:
        return JSONResponse({"error": "provider and phone_number are required"}, status_code=400)

    handlers = PROVIDER_HANDLERS.get(provider)
    if not handlers or "buy" not in handlers:
        return JSONResponse(
            {"error": f"Number purchasing not supported for {provider}"},
            status_code=400,
        )

    try:
        result = await handlers["buy"](phone_number)
        return {
            "number": result.number,
            "provider": result.provider,
            "status": result.status.value,
            "sid": result.sid,
            "message": f"Number {result.number} provisioned via {provider}",
        }
    except Exception as e:
        logger.exception(f"Failed to buy number {phone_number} from {provider}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/api/numbers/connect")
async def api_connect_number(request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Connect a phone number to Cogniflow (configure webhooks).

    Each provider has a different method:
    - Twilio: Update incoming phone number's voice_url webhook
    - Exotel: Configure ExoPhone to forward to Cogniflow webhook
    - Vobiz: Create XML application and assign number to it
    - MCube: Configure virtual number webhook forwarding
    - SIP: Verify trunk configuration (manual setup)
    """
    body = await request.json()
    provider = body.get("provider")
    phone_number = body.get("phone_number")
    number_sid = body.get("number_sid", phone_number)

    if not provider or not phone_number:
        return JSONResponse({"error": "provider and phone_number are required"}, status_code=400)

    handlers = PROVIDER_HANDLERS.get(provider)
    if not handlers or "connect" not in handlers:
        return JSONResponse(
            {"error": f"Number connection not supported for {provider}. Manual webhook configuration required."},
            status_code=400,
        )

    try:
        success = await handlers["connect"](number_sid)
        if success:
            webhook_urls = _get_webhook_urls(provider)
            return {
                "connected": True,
                "number": phone_number,
                "provider": provider,
                "webhooks": webhook_urls,
                "message": f"Number {phone_number} connected to Cogniflow via {provider}",
            }
        else:
            return JSONResponse(
                {"error": f"Failed to connect {phone_number}. Check provider credentials and number ownership."},
                status_code=500,
            )
    except Exception as e:
        logger.exception(f"Failed to connect number {phone_number} via {provider}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/api/numbers/verify")
async def api_verify_number(request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Verify a specific phone number is correctly connected."""
    body = await request.json()
    provider = body.get("provider")
    phone_number = body.get("phone_number")

    if not provider or not phone_number:
        return JSONResponse({"error": "provider and phone_number are required"}, status_code=400)

    handlers = PROVIDER_HANDLERS.get(provider)
    if not handlers or "verify" not in handlers:
        return JSONResponse(
            {"error": f"Verification not supported for {provider}"},
            status_code=400,
        )

    try:
        result = await handlers["verify"](phone_number)
        if result.get("fix_needed"):
            result["fix_instructions"] = _get_fix_instructions(provider, phone_number)
        return result
    except Exception as e:
        logger.exception(f"Failed to verify number {phone_number} via {provider}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/numbers/verify-all")
async def api_verify_all_numbers(auth: AuthContext = Depends(get_auth_context)):
    """Verify all phone numbers assigned to agents are correctly connected."""
    return await verify_all_numbers()


@router.post("/api/numbers/release")
async def api_release_number(request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Release/delete a phone number from a provider."""
    body = await request.json()
    provider = body.get("provider")
    number_sid = body.get("number_sid")

    if not provider or not number_sid:
        return JSONResponse({"error": "provider and number_sid are required"}, status_code=400)

    handlers = PROVIDER_HANDLERS.get(provider)
    if not handlers or "release" not in handlers:
        return JSONResponse(
            {"error": f"Number release not supported for {provider}"},
            status_code=400,
        )

    try:
        success = await handlers["release"](number_sid)
        return {"released": success, "provider": provider, "number_sid": number_sid}
    except Exception as e:
        logger.exception(f"Failed to release number {number_sid} via {provider}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.get("/api/numbers/webhooks")
async def api_webhook_urls(auth: AuthContext = Depends(get_auth_context)):
    """Show the webhook URLs that need to be configured for each provider.

    This is the manual setup guide — for users who configure numbers
    directly in the provider's dashboard.
    """
    return {
        "twilio": _get_webhook_urls("twilio"),
        "exotel": _get_webhook_urls("exotel"),
        "vobiz": _get_webhook_urls("vobiz"),
        "mcube": _get_webhook_urls("mcube"),
        "sip": _get_webhook_urls("sip"),
        "instructions": {
            "twilio": (
                "1. Go to Twilio Console > Phone Numbers > Active Numbers\n"
                "2. Click on your number\n"
                "3. Under Voice & Fax, set 'A CALL COMES IN' webhook URL\n"
                "4. Set HTTP method to POST\n"
                "5. Save"
            ),
            "exotel": (
                "1. Go to Exotel Dashboard > Apps > Create New App\n"
                "2. Select 'Voicebot Applet'\n"
                "3. Set webhook URL to the inbound webhook\n"
                "4. Go to ExoPhones > Assign this app to your ExoPhone\n"
                "5. Save"
            ),
            "vobiz": (
                "1. Go to Vobiz Console > Applications\n"
                "2. Create new XML Application\n"
                "3. Set Answer URL to the inbound webhook\n"
                "4. Set Hangup URL to the hangup webhook\n"
                "5. Go to Numbers > Assign application to your DID\n"
                "6. Save"
            ),
            "mcube": (
                "MCube does NOT support WebSocket audio streaming.\n"
                "It only supports click-to-call (connect agent to customer).\n"
                "1. Go to MCube Track > Groups > Edit Group\n"
                "2. Set 'On Hangup' URL to the status callback\n"
                "3. For AI voice, route MCube numbers through a SIP trunk bridge"
            ),
            "sip": (
                "1. Configure your PBX (Asterisk/FreeSWITCH) SIP trunk\n"
                "2. Set up a WebSocket media bridge (AudioSocket/mod_audio_stream)\n"
                "3. Route inbound calls through the bridge to the WebSocket URL\n"
                "4. Set SIP_TRUNK_HOST and credentials in .env"
            ),
        },
    }


def _get_webhook_urls(provider: str) -> dict:
    base = settings.public_url
    ws_base = base.replace("https://", "wss://").replace("http://", "ws://")

    if provider == "twilio":
        return {
            "inbound_webhook": f"{base}/voice/twilio/inbound",
            "outbound_webhook": f"{base}/voice/twilio/outbound",
            "websocket": f"{ws_base}/voice/twilio/ws",
            "recording_status": f"{base}/api/recording-status",
            "method": "POST",
        }
    elif provider == "exotel":
        return {
            "inbound_webhook": f"{base}/voice/exotel/inbound",
            "outbound_webhook": f"{base}/voice/exotel/outbound",
            "websocket": f"{ws_base}/voice/exotel/ws",
            "method": "POST",
        }
    elif provider == "vobiz":
        return {
            "inbound_webhook": f"{base}/voice/vobiz/inbound",
            "outbound_webhook": f"{base}/voice/vobiz/outbound",
            "hangup_webhook": f"{base}/voice/vobiz/hangup",
            "ring_webhook": f"{base}/voice/vobiz/ring",
            "stream_status": f"{base}/voice/vobiz/stream-status",
            "websocket": f"{ws_base}/voice/vobiz/ws",
            "method": "POST",
        }
    elif provider == "mcube":
        return {
            "status_callback": f"{base}/voice/mcube/status",
            "method": "POST",
            "note": "MCube does not support WebSocket streaming. Configure hangup URL in MCube dashboard.",
        }
    elif provider == "sip":
        return {
            "websocket": f"{ws_base}/voice/sip/ws",
            "note": "SIP calls are routed through a PBX WebSocket bridge",
        }
    return {}


def _get_fix_instructions(provider: str, phone_number: str) -> str:
    base = settings.public_url
    if provider == "twilio":
        return (
            f"Update the number's voice webhook to: {base}/voice/twilio/inbound\n"
            "Twilio Console > Phone Numbers > Active Numbers > Click number > Voice & Fax"
        )
    elif provider == "exotel":
        return (
            f"Set ExoPhone webhook to: {base}/voice/exotel/inbound\n"
            "Exotel Dashboard > ExoPhones > Select number > Configure Voicebot applet"
        )
    elif provider == "vobiz":
        return (
            f"Create XML app with answer_url: {base}/voice/vobiz/inbound\n"
            "Then assign this app to your DID number in Vobiz Console"
        )
    elif provider == "mcube":
        return (
            f"Set hangup URL to: {base}/voice/mcube/status\n"
            "MCube Track > Groups > Edit Group > On Hangup field.\n"
            "Note: MCube does not support WebSocket streaming for AI voice."
        )
    return "Check provider documentation for webhook configuration."
