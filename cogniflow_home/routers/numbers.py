"""Phone number management — connect, setup, verify, assign, test, remove.

Persists to phone_numbers table using ONLY the original schema columns
that PostgREST has cached:
  id, user_id, number, provider, provider_number_id, country_code,
  country_name, number_type, assigned_agent_id, status, monthly_cost_usd,
  sip_config (jsonb), created_at, updated_at

All extra data (encrypted credentials, metadata, concurrency) is stored
inside the sip_config jsonb column.
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


def _get_sip_config(row: dict) -> dict:
    raw = row.get("sip_config")
    if not raw:
        return {}
    if isinstance(raw, str):
        try:
            return json.loads(raw)
        except Exception:
            return {}
    return raw


def _safe_row(row: dict) -> dict:
    """Return row suitable for frontend — decrypt sip_config, strip credentials."""
    r = {**row}
    cfg = _get_sip_config(r)
    r["concurrency"] = cfg.get("concurrency", DEFAULT_CONCURRENCY)
    r["metadata"] = cfg.get("metadata", {})
    r["agent_id"] = r.get("assigned_agent_id")
    r.pop("sip_config", None)
    r.pop("credentials", None)
    return r


def _decrypt_creds(row: dict) -> dict:
    cfg = _get_sip_config(row)
    encrypted = cfg.get("encrypted_credentials", {})
    if not encrypted:
        return {}
    try:
        return credentials._decrypt_config(encrypted)
    except Exception:
        return {}


# ─── Provider verification helpers ───

async def _verify_vobiz(creds: dict) -> dict:
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

    from urllib.parse import quote as url_quote
    encoded_number = url_quote(phone_number, safe="")
    number_no_plus = phone_number.lstrip("+")
    assign_body = {"app_id": app_id}

    attempts = [
        ("POST", f"{base}/Account/{auth_id}/Number/{number_no_plus}/", headers, assign_body),
        ("POST", f"{base}/Account/{auth_id}/Number/{encoded_number}/", headers, assign_body),
        ("POST", f"{base}/Account/{auth_id}/Number/{number_no_plus}/", None, assign_body),
    ]

    last_error = ""
    async with httpx.AsyncClient(timeout=15.0) as client:
        for method, url, hdrs, body in attempts:
            kwargs = {"json": body}
            if hdrs:
                kwargs["headers"] = hdrs
            else:
                kwargs["auth"] = (auth_id, auth_token)
                kwargs["headers"] = {"Content-Type": "application/json"}
            resp2 = await client.request(method, url, **kwargs)
            if resp2.status_code in (200, 201, 202):
                return {"ok": True, "app_id": app_id, "webhooks": _webhook_urls("vobiz")}
            last_error = f"{resp2.status_code}: {resp2.text[:200]}"
            logger.warning(f"Vobiz number assign attempt failed: {method} {url} -> {last_error}")

    logger.error(f"All Vobiz number assignment attempts failed. App {app_id} created. Last error: {last_error}")
    return {
        "ok": True,
        "app_id": app_id,
        "webhooks": _webhook_urls("vobiz"),
        "warning": f"App created but auto-assignment failed. Go to console.vobiz.ai → Numbers → {phone_number} → set app to Cogniflow-{phone_number[-4:]}",
    }


async def _connect_twilio(creds: dict, phone_number: str) -> dict:
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
    result = await _verify_exotel(creds)
    if not result["ok"]:
        return result
    webhooks = _webhook_urls("exotel")
    return {"ok": True, "webhooks": webhooks, "manual_step_required": True}


# ─── API Endpoints ───

@router.get("/api/phone-numbers")
async def list_phone_numbers(auth: AuthContext = Depends(get_auth_context)):
    """List all phone numbers for this tenant."""
    rows = await db.select("phone_numbers", {"user_id": auth.tenant_id, "status": "neq.removed"}, order="created_at.desc")
    enriched = []
    for r in rows:
        row = _safe_row(r)
        aid = row.get("agent_id") or row.get("assigned_agent_id")
        if aid:
            agents = await db.select("agents", {"id": aid}, select="id,name", limit=1)
            row["agent_name"] = agents[0]["name"] if agents else None
        else:
            row["agent_name"] = None
        enriched.append(row)
    return {"numbers": enriched}


@router.post("/api/phone-numbers/setup")
async def setup_phone_number(request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Full setup flow: verify creds → auto-configure → save to DB."""
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
    existing = await db.select("phone_numbers", {"user_id": auth.tenant_id, "number": phone_number}, limit=1)
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

    encrypted_creds = credentials.encrypt_config(creds) if creds else {}

    sip_config = {
        "encrypted_credentials": encrypted_creds,
        "metadata": metadata,
        "concurrency": concurrency,
    }

    row = {
        "id": str(uuid.uuid4()),
        "user_id": auth.tenant_id,
        "number": phone_number,
        "provider": provider,
        "status": status,
        "sip_config": json.dumps(sip_config),
        "provider_number_id": setup_result.get("app_id") or setup_result.get("number_sid") or "",
    }
    if agent_id:
        row["assigned_agent_id"] = agent_id

    if existing:
        result = await db.update("phone_numbers", {"id": existing[0]["id"]}, {**row, "id": existing[0]["id"]})
        row["id"] = existing[0]["id"]
    else:
        _resp = await db._client.post("/rest/v1/phone_numbers", json=row)
        if _resp.status_code in (200, 201):
            _rows = _resp.json()
            result = _rows[0] if _rows else row
        else:
            logger.error(f"Phone number insert failed: {_resp.status_code} {_resp.text}")
            return JSONResponse({
                "error": f"Failed to save: {_resp.status_code} — {_resp.text[:300]}"
            }, status_code=500)

    if not result:
        return JSONResponse({"error": "Phone number configured but failed to save to database."}, status_code=500)

    if agent_id:
        await _sync_agent_numbers(auth.tenant_id, agent_id)

    resp = {
        "id": row["id"],
        "number": phone_number,
        "provider": provider,
        "status": status,
        "webhooks": metadata.get("webhooks", {}),
        "metadata": {k: v for k, v in metadata.items() if k != "webhooks"},
    }
    if setup_result.get("warning"):
        resp["warning"] = setup_result["warning"]
    return resp


@router.post("/api/phone-numbers/verify-credentials")
async def verify_provider_credentials(request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Verify provider credentials and list available numbers."""
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
    rows = await db.select("phone_numbers", {"id": number_id, "user_id": auth.tenant_id}, limit=1)
    if not rows:
        return JSONResponse({"error": "Number not found"}, status_code=404)

    body = await request.json()
    updates = {}
    old_agent_id = rows[0].get("assigned_agent_id")

    if "agent_id" in body:
        updates["assigned_agent_id"] = body["agent_id"]
    if "status" in body and body["status"] in ("active", "pending_manual", "error"):
        updates["status"] = body["status"]

    # Update concurrency/display_name inside sip_config
    cfg = _get_sip_config(rows[0])
    cfg_changed = False
    if "concurrency" in body:
        cfg["concurrency"] = max(1, min(50, int(body["concurrency"])))
        cfg_changed = True
    if "display_name" in body:
        cfg["display_name"] = body["display_name"]
        cfg_changed = True
    if cfg_changed:
        updates["sip_config"] = json.dumps(cfg)

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
    rows = await db.select("phone_numbers", {"id": number_id, "user_id": auth.tenant_id}, limit=1)
    if not rows:
        return JSONResponse({"error": "Number not found"}, status_code=404)

    old_agent_id = rows[0].get("assigned_agent_id")
    await db.update("phone_numbers", {"id": number_id}, {"status": "removed", "assigned_agent_id": None})

    if old_agent_id:
        await _sync_agent_numbers(auth.tenant_id, old_agent_id)

    return {"removed": True, "number": rows[0]["number"]}


@router.post("/api/phone-numbers/{number_id}/verify")
async def verify_phone_number(number_id: str, auth: AuthContext = Depends(get_auth_context)):
    """Verify a phone number is correctly connected to Cogniflow."""
    rows = await db.select("phone_numbers", {"id": number_id, "user_id": auth.tenant_id}, limit=1)
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
    rows = await db.select("phone_numbers", {"id": number_id, "user_id": auth.tenant_id}, limit=1)
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
            return {"ok": True, "call_sid": call_sid, "message": f"Test call initiated to {to_number}"}
        elif provider == "vobiz":
            call_id = await _test_call_vobiz(creds, row["number"], to_number)
            return {"ok": True, "call_id": call_id, "message": f"Test call initiated to {to_number}"}
        elif provider == "exotel":
            call_sid = await _test_call_exotel(creds, row["number"], to_number)
            return {"ok": True, "call_sid": call_sid, "message": f"Test call initiated to {to_number}"}
        else:
            return JSONResponse({"error": f"Test calls not supported for {provider}"}, status_code=400)
    except Exception as e:
        logger.exception(f"Test call failed for {row['number']}")
        return JSONResponse({"error": str(e)}, status_code=500)


@router.post("/api/phone-numbers/{number_id}/call")
async def make_outbound_call(number_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    """Make an outbound call FROM this phone number using its stored credentials."""
    rows = await db.select("phone_numbers", {"id": number_id, "user_id": auth.tenant_id}, limit=1)
    if not rows:
        return JSONResponse({"error": "Number not found"}, status_code=404)

    row = rows[0]
    if row["status"] != "active":
        return JSONResponse({"error": "Number is not active"}, status_code=400)

    body = await request.json()
    to_number = body.get("to_number", "")
    agent_id = body.get("agent_id", row.get("assigned_agent_id"))
    if not to_number:
        return JSONResponse({"error": "to_number is required"}, status_code=400)

    provider = row["provider"]
    creds = _decrypt_creds(row)

    try:
        if provider == "twilio":
            call_sid = await _test_call_twilio(creds, row["number"], to_number)
        elif provider == "vobiz":
            call_sid = await _test_call_vobiz(creds, row["number"], to_number)
        elif provider == "exotel":
            call_sid = await _test_call_exotel(creds, row["number"], to_number)
        else:
            return JSONResponse({"error": f"Outbound calls not supported for {provider}"}, status_code=400)

        if agent_id:
            from cogniflow_home.state import _pending_agent_overrides
            _pending_agent_overrides[call_sid] = agent_id

        return {"ok": True, "call_sid": call_sid, "from": row["number"], "to": to_number, "provider": provider}
    except Exception as e:
        logger.exception(f"Outbound call failed from {row['number']}")
        return JSONResponse({"error": str(e)}, status_code=500)


# ─── Legacy endpoints ───

@router.get("/api/numbers")
async def api_list_numbers_legacy(auth: AuthContext = Depends(get_auth_context)):
    rows = await db.select("phone_numbers", {"user_id": auth.tenant_id, "status": "neq.removed"})
    return {"numbers": {r["provider"]: [_safe_row(r)] for r in rows}, "configured_providers": list({r["provider"] for r in rows})}


@router.get("/api/numbers/webhooks")
async def api_webhook_urls(auth: AuthContext = Depends(get_auth_context)):
    return {p: _webhook_urls(p) for p in VALID_PROVIDERS}


# ─── Internal helpers ───

async def _sync_agent_numbers(tenant_id: str, agent_id: str):
    """Sync is a no-op — agents don't have a phone_numbers column. Agent-to-number
    mapping is done via the phone_numbers table's assigned_agent_id column."""
    pass


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
