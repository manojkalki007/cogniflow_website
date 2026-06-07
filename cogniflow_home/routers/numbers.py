"""Phone number management — connect, setup, verify, assign, test, remove.

Persists to phone_numbers table. Each number is tenant-scoped and stores
encrypted provider credentials so multiple tenants can use different
Twilio/Vobiz/Exotel accounts independently.
"""

import json
import logging
import uuid

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from cogniflow_home.config import settings
from cogniflow_home.credentials.resolver import credentials
from cogniflow_home.db.supabase import db
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home.routers.numbers")

router = APIRouter(tags=["numbers"])

VALID_PROVIDERS = {"vobiz", "twilio", "exotel", "mcube", "sip"}
DEFAULT_CONCURRENCY = 5


# ─── Helpers ───

def _webhook_urls(provider: str) -> dict:
    base = settings.public_url
    ws = base.replace("https://", "wss://").replace("http://", "ws://")
    if provider == "twilio":
        return {"inbound": f"{base}/voice/twilio/inbound", "status": f"{base}/api/recording-status", "ws": f"{ws}/voice/twilio/ws"}
    if provider == "exotel":
        return {"inbound": f"{base}/voice/exotel/inbound", "ws": f"{ws}/voice/exotel/ws"}
    if provider == "vobiz":
        return {"inbound": f"{base}/voice/vobiz/inbound", "hangup": f"{base}/voice/vobiz/hangup", "ws": f"{ws}/voice/vobiz/ws"}
    if provider == "mcube":
        return {"status": f"{base}/voice/mcube/status"}
    if provider == "sip":
        return {"ws": f"{ws}/voice/sip/ws"}
    return {}


def _safe_row(row: dict) -> dict:
    """Strip encrypted credentials before returning to frontend."""
    r = {**row}
    r.pop("credentials", None)
    return r


# ─── Provider verification helpers ───

async def _verify_vobiz(creds: dict) -> dict:
    """Verify Vobiz credentials by listing numbers."""
    auth_id = creds.get("auth_id", "")
    auth_token = creds.get("auth_token", "")
    if not auth_id or not auth_token:
        return {"ok": False, "error": "Auth ID and Auth Token are required"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.vobiz.ai/api/v1/Account/{auth_id}/numbers",
            headers={"X-Auth-ID": auth_id, "X-Auth-Token": auth_token, "Content-Type": "application/json"},
        )
    if resp.status_code == 200:
        data = resp.json()
        items = data.get("items", data.get("objects", []))
        numbers = [{"number": n.get("e164", n.get("number", "")), "region": n.get("region", "")} for n in items]
        return {"ok": True, "numbers": numbers, "account": auth_id}
    return {"ok": False, "error": f"Vobiz API returned {resp.status_code}: {resp.text[:200]}"}


async def _verify_twilio(creds: dict) -> dict:
    """Verify Twilio credentials by listing numbers."""
    sid = creds.get("account_sid", "")
    token = creds.get("auth_token", "")
    if not sid or not token:
        return {"ok": False, "error": "Account SID and Auth Token are required"}
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/IncomingPhoneNumbers.json?PageSize=50",
            auth=(sid, token),
        )
    if resp.status_code == 200:
        data = resp.json()
        numbers = [{"number": n["phone_number"], "sid": n["sid"], "friendly_name": n.get("friendly_name", "")} for n in data.get("incoming_phone_numbers", [])]
        return {"ok": True, "numbers": numbers, "account": sid}
    return {"ok": False, "error": f"Twilio API returned {resp.status_code}"}


async def _verify_exotel(creds: dict) -> dict:
    """Verify Exotel credentials by listing ExoPhones."""
    api_key = creds.get("api_key", "")
    api_token = creds.get("api_token", "")
    account_sid = creds.get("account_sid", "")
    subdomain = creds.get("subdomain", "api")
    if not api_key or not api_token or not account_sid:
        return {"ok": False, "error": "API Key, API Token, and Account SID are required"}
    base = f"https://{subdomain}.exotel.com"
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.get(
            f"{base}/v2_beta/Accounts/{account_sid}/IncomingPhoneNumbers",
            auth=(api_key, api_token),
        )
    if resp.status_code == 200:
        data = resp.json()
        items = data.get("IncomingPhoneNumbers", data.get("incoming_phone_numbers", []))
        numbers = [{"number": n.get("phone_number", n.get("PhoneNumber", "")), "sid": n.get("sid", n.get("Sid", ""))} for n in items]
        return {"ok": True, "numbers": numbers, "account": account_sid}
    return {"ok": False, "error": f"Exotel API returned {resp.status_code}: {resp.text[:200]}"}


# ─── Provider auto-configure helpers ───

async def _connect_vobiz(creds: dict, phone_number: str) -> dict:
    """Create Vobiz XML Application and attach number."""
    auth_id = creds.get("auth_id", "")
    auth_token = creds.get("auth_token", "")
    headers = {"X-Auth-ID": auth_id, "X-Auth-Token": auth_token, "Content-Type": "application/json"}
    base = "https://api.vobiz.ai/api/v1"

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{base}/Account/{auth_id}/Application/",
            headers=headers,
            json={
                "app_name": f"Cogniflow-{phone_number[-4:]}",
                "answer_url": f"{settings.public_url}/voice/vobiz/inbound",
                "answer_method": "POST",
                "hangup_url": f"{settings.public_url}/voice/vobiz/hangup",
                "hangup_method": "POST",
                "application_type": "XML",
            },
        )
    if resp.status_code not in (200, 201):
        return {"ok": False, "error": f"Failed to create XML Application: {resp.text[:200]}"}

    app_data = resp.json()
    app_id = app_data.get("app_id", "")
    if not app_id:
        return {"ok": False, "error": "Application created but no app_id returned"}

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp2 = await client.post(
            f"{base}/Account/{auth_id}/Number/{phone_number}/",
            headers=headers,
            json={"app_id": app_id},
        )
    if resp2.status_code not in (200, 201):
        return {"ok": False, "error": f"App created (ID: {app_id}) but number assignment failed: {resp2.text[:200]}"}

    return {"ok": True, "app_id": app_id, "webhooks": _webhook_urls("vobiz")}


async def _connect_twilio(creds: dict, phone_number: str) -> dict:
    """Update Twilio number webhooks to point to Cogniflow."""
    sid = creds.get("account_sid", "")
    token = creds.get("auth_token", "")
    number_sid = creds.get("number_sid", "")

    if not number_sid:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://api.twilio.com/2010-04-01/Accounts/{sid}/IncomingPhoneNumbers.json?PhoneNumber={phone_number}",
                auth=(sid, token),
            )
        if resp.status_code == 200:
            nums = resp.json().get("incoming_phone_numbers", [])
            if nums:
                number_sid = nums[0]["sid"]
        if not number_sid:
            return {"ok": False, "error": f"Number {phone_number} not found in Twilio account"}

    webhooks = _webhook_urls("twilio")
    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/IncomingPhoneNumbers/{number_sid}.json",
            auth=(sid, token),
            data={
                "VoiceUrl": webhooks["inbound"],
                "VoiceMethod": "POST",
                "StatusCallback": webhooks["status"],
                "StatusCallbackMethod": "POST",
            },
        )
    if resp.status_code == 200:
        return {"ok": True, "number_sid": number_sid, "webhooks": webhooks}
    return {"ok": False, "error": f"Twilio webhook update failed: {resp.status_code}"}


async def _connect_exotel(creds: dict, phone_number: str) -> dict:
    """For Exotel we verify credentials; flow assignment is manual."""
    result = await _verify_exotel(creds)
    if not result["ok"]:
        return result
    webhooks = _webhook_urls("exotel")
    return {"ok": True, "webhooks": webhooks, "manual_step_required": True}


# ─── API Endpoints ───

@router.get("/api/phone-numbers")
async def list_phone_numbers(auth: AuthContext = Depends(get_auth_context)):
    """List all phone numbers for this tenant."""
    rows = await db.select("phone_numbers", {"tenant_id": auth.tenant_id, "status": "neq.removed"}, order="created_at.desc")
    enriched = []
    for r in rows:
        row = _safe_row(r)
        if r.get("agent_id"):
            agents = await db.select("agents", {"id": r["agent_id"]}, select="id,name", limit=1)
            row["agent_name"] = agents[0]["name"] if agents else None
        else:
            row["agent_name"] = None
        enriched.append(row)
    return {"numbers": enriched}


@router.post("/api/phone-numbers/setup")
async def setup_phone_number(request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Full setup flow: verify creds → auto-configure → save to DB.

    Body: {provider, credentials: {...}, phone_number, agent_id?}
    """
    body = await request.json()
    provider = body.get("provider", "")
    creds = body.get("credentials", {})
    phone_number = body.get("phone_number", "").strip()
    agent_id = body.get("agent_id")
    concurrency = body.get("concurrency", DEFAULT_CONCURRENCY)

    if provider not in VALID_PROVIDERS:
        return JSONResponse({"error": f"Invalid provider: {provider}"}, status_code=400)
    if not phone_number:
        return JSONResponse({"error": "phone_number is required"}, status_code=400)

    # Check for duplicate
    existing = await db.select("phone_numbers", {"tenant_id": auth.tenant_id, "number": phone_number}, limit=1)
    if existing and existing[0].get("status") != "removed":
        return JSONResponse({"error": f"Number {phone_number} is already connected"}, status_code=409)

    # Provider-specific setup
    setup_result = {"ok": True, "webhooks": _webhook_urls(provider)}
    metadata = {}
    status = "active"

    if provider == "vobiz":
        setup_result = await _connect_vobiz(creds, phone_number)
        if setup_result.get("ok"):
            metadata["app_id"] = setup_result.get("app_id", "")
    elif provider == "twilio":
        setup_result = await _connect_twilio(creds, phone_number)
        if setup_result.get("ok"):
            metadata["number_sid"] = setup_result.get("number_sid", "")
    elif provider == "exotel":
        setup_result = await _connect_exotel(creds, phone_number)
        if setup_result.get("ok") and setup_result.get("manual_step_required"):
            status = "pending_manual"
    elif provider == "mcube":
        tenant_sip = f"sip:cogniflow-{auth.tenant_id[:8]}@sip.cogniflowautomations.com"
        metadata["sip_endpoint"] = tenant_sip
        status = "pending_manual"
    elif provider == "sip":
        metadata["sip_endpoint"] = creds.get("sip_host", "")

    if not setup_result.get("ok"):
        return JSONResponse({"error": setup_result.get("error", "Setup failed")}, status_code=400)

    metadata["webhooks"] = setup_result.get("webhooks", _webhook_urls(provider))

    encrypted_creds = json.dumps(credentials.encrypt_config(creds)) if creds else None

    row = {
        "id": str(uuid.uuid4()),
        "tenant_id": auth.tenant_id,
        "provider": provider,
        "number": phone_number,
        "status": status,
        "agent_id": agent_id,
        "credentials": encrypted_creds,
        "metadata": metadata,
        "concurrency": concurrency,
    }

    if existing:
        await db.update("phone_numbers", {"id": existing[0]["id"]}, {**row, "id": existing[0]["id"]})
        row["id"] = existing[0]["id"]
    else:
        await db.insert("phone_numbers", row)

    if agent_id:
        await _sync_agent_numbers(auth.tenant_id, agent_id)

    return {
        "id": row["id"],
        "number": phone_number,
        "provider": provider,
        "status": status,
        "webhooks": metadata.get("webhooks", {}),
        "metadata": {k: v for k, v in metadata.items() if k != "webhooks"},
    }


@router.post("/api/phone-numbers/verify-credentials")
async def verify_provider_credentials(request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Step 1: Verify provider credentials and list available numbers.

    Body: {provider, credentials: {...}}
    Returns: {ok, numbers: [...], account}
    """
    body = await request.json()
    provider = body.get("provider", "")
    creds = body.get("credentials", {})

    if provider == "vobiz":
        return await _verify_vobiz(creds)
    elif provider == "twilio":
        return await _verify_twilio(creds)
    elif provider == "exotel":
        return await _verify_exotel(creds)
    elif provider == "mcube":
        return {"ok": True, "numbers": [], "note": "MCube requires manual SIP trunk setup"}
    return JSONResponse({"error": f"Unknown provider: {provider}"}, status_code=400)


@router.patch("/api/phone-numbers/{number_id}")
async def update_phone_number(number_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Update a phone number — assign agent, change concurrency, update display name."""
    rows = await db.select("phone_numbers", {"id": number_id, "tenant_id": auth.tenant_id}, limit=1)
    if not rows:
        return JSONResponse({"error": "Number not found"}, status_code=404)

    body = await request.json()
    updates = {}
    old_agent_id = rows[0].get("agent_id")

    if "agent_id" in body:
        updates["agent_id"] = body["agent_id"]
    if "concurrency" in body:
        updates["concurrency"] = max(1, min(50, int(body["concurrency"])))
    if "display_name" in body:
        updates["display_name"] = body["display_name"]
    if "status" in body and body["status"] in ("active", "pending_manual", "error"):
        updates["status"] = body["status"]

    if not updates:
        return JSONResponse({"error": "No valid fields to update"}, status_code=400)

    updated = await db.update("phone_numbers", {"id": number_id}, updates)

    new_agent_id = body.get("agent_id")
    if "agent_id" in body:
        if old_agent_id:
            await _sync_agent_numbers(auth.tenant_id, old_agent_id)
        if new_agent_id:
            await _sync_agent_numbers(auth.tenant_id, new_agent_id)

    return _safe_row(updated) if updated else {"ok": True}


@router.delete("/api/phone-numbers/{number_id}")
async def remove_phone_number(number_id: str, auth: AuthContext = Depends(get_auth_context)):
    """Remove a phone number (soft delete)."""
    rows = await db.select("phone_numbers", {"id": number_id, "tenant_id": auth.tenant_id}, limit=1)
    if not rows:
        return JSONResponse({"error": "Number not found"}, status_code=404)

    old_agent_id = rows[0].get("agent_id")
    await db.update("phone_numbers", {"id": number_id}, {"status": "removed", "agent_id": None})

    if old_agent_id:
        await _sync_agent_numbers(auth.tenant_id, old_agent_id)

    return {"removed": True, "number": rows[0]["number"]}


@router.post("/api/phone-numbers/{number_id}/verify")
async def verify_phone_number(number_id: str, auth: AuthContext = Depends(get_auth_context)):
    """Verify a phone number is correctly connected to Cogniflow."""
    rows = await db.select("phone_numbers", {"id": number_id, "tenant_id": auth.tenant_id}, limit=1)
    if not rows:
        return JSONResponse({"error": "Number not found"}, status_code=404)

    row = rows[0]
    provider = row["provider"]
    creds = _decrypt_creds(row)

    if provider == "vobiz":
        result = await _verify_vobiz(creds)
        connected = result.get("ok", False)
        matching = any(n["number"] == row["number"] or row["number"] in n.get("number", "") for n in result.get("numbers", []))
        return {"connected": connected and matching, "provider": provider, "number": row["number"]}
    elif provider == "twilio":
        result = await _verify_twilio(creds)
        if result.get("ok"):
            matching = any(n["number"] == row["number"] for n in result.get("numbers", []))
            return {"connected": matching, "provider": provider, "number": row["number"]}
        return {"connected": False, "error": result.get("error")}
    elif provider == "exotel":
        result = await _verify_exotel(creds)
        return {"connected": result.get("ok", False), "provider": provider, "number": row["number"], "manual_step_required": True}
    elif provider == "mcube":
        return {"connected": row["status"] == "active", "provider": provider, "number": row["number"], "note": "MCube connection verified via SIP trunk"}

    return {"connected": False, "error": "Verification not supported for this provider"}


@router.post("/api/phone-numbers/{number_id}/test-call")
async def test_call_number(number_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Make a quick test call to verify the number works end-to-end."""
    rows = await db.select("phone_numbers", {"id": number_id, "tenant_id": auth.tenant_id}, limit=1)
    if not rows:
        return JSONResponse({"error": "Number not found"}, status_code=404)

    row = rows[0]
    body = await request.json()
    to_number = body.get("to_number", "")
    if not to_number:
        return JSONResponse({"error": "to_number is required for test call"}, status_code=400)

    provider = row["provider"]
    creds = _decrypt_creds(row)

    try:
        if provider == "twilio":
            call_sid = await _test_call_twilio(creds, row["number"], to_number)
            await db.update("phone_numbers", {"id": number_id}, {"last_tested_at": "now()"})
            return {"ok": True, "call_sid": call_sid, "message": f"Test call initiated to {to_number}"}
        elif provider == "vobiz":
            call_id = await _test_call_vobiz(creds, row["number"], to_number)
            await db.update("phone_numbers", {"id": number_id}, {"last_tested_at": "now()"})
            return {"ok": True, "call_id": call_id, "message": f"Test call initiated to {to_number}"}
        elif provider == "exotel":
            call_sid = await _test_call_exotel(creds, row["number"], to_number)
            await db.update("phone_numbers", {"id": number_id}, {"last_tested_at": "now()"})
            return {"ok": True, "call_sid": call_sid, "message": f"Test call initiated to {to_number}"}
        else:
            return JSONResponse({"error": f"Test calls not supported for {provider}"}, status_code=400)
    except Exception as e:
        logger.exception(f"Test call failed for {row['number']}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Legacy endpoints (kept for backward compat) ───

@router.get("/api/numbers")
async def api_list_numbers_legacy(auth: AuthContext = Depends(get_auth_context)):
    """Legacy: list numbers from provider APIs directly."""
    rows = await db.select("phone_numbers", {"tenant_id": auth.tenant_id, "status": "neq.removed"})
    return {"numbers": {r["provider"]: [_safe_row(r)] for r in rows}, "configured_providers": list({r["provider"] for r in rows})}


@router.get("/api/numbers/webhooks")
async def api_webhook_urls(auth: AuthContext = Depends(get_auth_context)):
    return {p: _webhook_urls(p) for p in VALID_PROVIDERS}


# ─── Internal helpers ───

def _decrypt_creds(row: dict) -> dict:
    raw = row.get("credentials")
    if not raw:
        return {}
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else raw
        return credentials._decrypt_config(parsed)
    except Exception:
        return {}


async def _sync_agent_numbers(tenant_id: str, agent_id: str):
    """Sync the agents.phone_numbers array from phone_numbers table."""
    rows = await db.select("phone_numbers", {"agent_id": agent_id, "status": "neq.removed"}, select="number")
    numbers = [r["number"] for r in rows]
    await db.update("agents", {"id": agent_id}, {
        "phone_numbers": numbers,
        "metadata": {"telephony_provider": "multi"},
    })


async def _test_call_twilio(creds: dict, from_number: str, to_number: str) -> str:
    sid = creds.get("account_sid", "")
    token = creds.get("auth_token", "")
    webhooks = _webhook_urls("twilio")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Calls.json",
            auth=(sid, token),
            data={
                "To": to_number,
                "From": from_number,
                "Url": webhooks["inbound"],
                "StatusCallback": webhooks["status"],
                "StatusCallbackMethod": "POST",
            },
        )
    if resp.status_code == 201:
        return resp.json().get("sid", "")
    raise RuntimeError(f"Twilio call failed: {resp.status_code} {resp.text[:200]}")


async def _test_call_vobiz(creds: dict, from_number: str, to_number: str) -> str:
    auth_id = creds.get("auth_id", "")
    auth_token = creds.get("auth_token", "")
    webhooks = _webhook_urls("vobiz")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"https://api.vobiz.ai/api/v1/Account/{auth_id}/Call/",
            headers={"X-Auth-ID": auth_id, "X-Auth-Token": auth_token, "Content-Type": "application/json"},
            json={
                "from": from_number,
                "to": to_number,
                "answer_url": webhooks["inbound"],
                "answer_method": "POST",
                "hangup_url": webhooks["hangup"],
                "hangup_method": "POST",
            },
        )
    if resp.status_code in (200, 201):
        return resp.json().get("request_uuid", resp.json().get("call_uuid", ""))
    raise RuntimeError(f"Vobiz call failed: {resp.status_code} {resp.text[:200]}")


async def _test_call_exotel(creds: dict, from_number: str, to_number: str) -> str:
    api_key = creds.get("api_key", "")
    api_token = creds.get("api_token", "")
    account_sid = creds.get("account_sid", "")
    subdomain = creds.get("subdomain", "api")
    base = f"https://{subdomain}.exotel.com"
    webhooks = _webhook_urls("exotel")
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            f"{base}/v1/Accounts/{account_sid}/Calls/connect",
            auth=(api_key, api_token),
            data={
                "From": to_number,
                "CallerId": from_number,
                "Url": webhooks["inbound"],
                "StatusCallback": webhooks.get("inbound", ""),
                "StatusCallbackEvents[0]": "terminal",
            },
        )
    if resp.status_code in (200, 201):
        data = resp.json()
        call = data.get("Call", data)
        return call.get("Sid", call.get("sid", ""))
    raise RuntimeError(f"Exotel call failed: {resp.status_code} {resp.text[:200]}")
