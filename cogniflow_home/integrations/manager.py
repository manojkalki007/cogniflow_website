"""Multi-tenant integration manager.

Handles credential storage (AES-256-GCM encrypted), live API testing,
and connection lifecycle for all third-party integrations.
"""

import json
import logging
from datetime import datetime, timezone

import httpx

from cogniflow_home.credentials.resolver import credentials as cred_resolver
from cogniflow_home.db.supabase import db

logger = logging.getLogger("cogniflow_home.integrations.manager")

TABLE = "tenant_integrations"

# Friendly display names
INTEGRATION_NAMES = {
    "whatsapp": "WhatsApp Business",
    "email": "Email (SMTP)",
    "smtp": "Email (SMTP)",
    "leadrat": "LeadRat CRM",
    "hubspot": "HubSpot",
    "calcom": "Cal.com",
    "calendar_calcom": "Cal.com",
    "google_calendar": "Google Calendar",
    "calendar_google": "Google Calendar",
    "razorpay": "Razorpay",
    "salesforce": "Salesforce",
}


class IntegrationManager:

    async def get_integration(self, tenant_id: str, integration: str) -> dict | None:
        """Load a single integration with decrypted credentials."""
        rows = await db.select(TABLE, {
            "tenant_id": tenant_id,
            "integration": integration,
        }, limit=1)
        if not rows:
            return None
        row = rows[0]
        if row.get("credentials"):
            row["credentials"] = cred_resolver._decrypt_config(row["credentials"])
        return row

    async def save_integration(
        self,
        tenant_id: str,
        integration: str,
        credentials_data: dict,
        config: dict | None = None,
        setup_mode: str = "self",
    ) -> dict:
        """Encrypt credentials and upsert the integration record."""
        now_iso = datetime.now(timezone.utc).isoformat()
        encrypted_creds = cred_resolver.encrypt_config(credentials_data)

        # Check if row already exists
        existing = await db.select(TABLE, {
            "tenant_id": tenant_id,
            "integration": integration,
        }, limit=1)

        if existing:
            updates: dict = {
                "credentials": encrypted_creds,
                "status": "configuring",
                "setup_mode": setup_mode,
                "updated_at": now_iso,
            }
            if config is not None:
                updates["config"] = config
            result = await db.update(TABLE, {
                "tenant_id": tenant_id,
                "integration": integration,
            }, updates)
        else:
            data = {
                "tenant_id": tenant_id,
                "integration": integration,
                "status": "configuring",
                "credentials": encrypted_creds,
                "config": config or {},
                "setup_mode": setup_mode,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            result = await db.insert(TABLE, data)

        # Invalidate credential cache so next call picks up new values
        cred_resolver.invalidate(tenant_id, integration)

        return result or {}

    async def test_integration(self, tenant_id: str, integration: str) -> dict:
        """Run a live API test for the given integration."""
        row = await self.get_integration(tenant_id, integration)
        if not row:
            return {"ok": False, "message": "Integration not found", "error": "not_found"}

        creds = row.get("credentials") or {}
        config = row.get("config") or {}

        # Update status to testing
        now_iso = datetime.now(timezone.utc).isoformat()
        await db.update(TABLE, {
            "tenant_id": tenant_id,
            "integration": integration,
        }, {"status": "testing", "updated_at": now_iso})

        test_fn = {
            "whatsapp": self._test_whatsapp,
            "email": self._test_email,
            "smtp": self._test_email,
            "leadrat": self._test_leadrat,
            "hubspot": self._test_hubspot,
            "calcom": self._test_calcom,
            "calendar_calcom": self._test_calcom,
            "google_calendar": self._test_google_calendar,
            "calendar_google": self._test_google_calendar,
            "razorpay": self._test_razorpay,
            "salesforce": self._test_salesforce,
        }.get(integration)

        if not test_fn:
            await db.update(TABLE, {
                "tenant_id": tenant_id,
                "integration": integration,
            }, {
                "status": row.get("status", "configuring"),
                "updated_at": now_iso,
            })
            return {"ok": False, "message": f"No test available for {integration}", "error": "no_test"}

        result = await test_fn(creds, config)

        # Persist test outcome
        now_iso = datetime.now(timezone.utc).isoformat()
        if result["ok"]:
            await db.update(TABLE, {
                "tenant_id": tenant_id,
                "integration": integration,
            }, {
                "status": "connected",
                "last_tested_at": now_iso,
                "last_error": "",
                "updated_at": now_iso,
            })
        else:
            await db.update(TABLE, {
                "tenant_id": tenant_id,
                "integration": integration,
            }, {
                "status": "error",
                "last_tested_at": now_iso,
                "last_error": result.get("error", result.get("message", "Unknown error")),
                "updated_at": now_iso,
            })

        # Invalidate cache after status change
        cred_resolver.invalidate(tenant_id, integration)

        return result

    async def disconnect_integration(self, tenant_id: str, integration: str) -> dict:
        """Clear credentials and set status to disconnected."""
        now_iso = datetime.now(timezone.utc).isoformat()
        result = await db.update(TABLE, {
            "tenant_id": tenant_id,
            "integration": integration,
        }, {
            "credentials": {},
            "status": "disconnected",
            "last_error": "",
            "updated_at": now_iso,
        })
        cred_resolver.invalidate(tenant_id, integration)
        return result or {}

    async def get_all_for_tenant(self, tenant_id: str) -> list[dict]:
        """Load all connected integrations with decrypted credentials."""
        rows = await db.select(TABLE, {
            "tenant_id": tenant_id,
            "status": "eq.connected",
        })
        for row in rows:
            if row.get("credentials"):
                row["credentials"] = cred_resolver._decrypt_config(row["credentials"])
        return rows

    async def list_integrations(self, tenant_id: str) -> list[dict]:
        """List all integrations with status. NO credentials returned."""
        rows = await db.select(TABLE, {"tenant_id": tenant_id})
        safe_rows = []
        for row in rows:
            safe_rows.append({
                "id": row.get("id"),
                "tenant_id": row.get("tenant_id"),
                "integration": row.get("integration"),
                "name": INTEGRATION_NAMES.get(row.get("integration", ""), row.get("integration", "")),
                "status": row.get("status"),
                "config": row.get("config"),
                "last_tested_at": row.get("last_tested_at"),
                "last_error": row.get("last_error"),
                "setup_mode": row.get("setup_mode"),
                "created_at": row.get("created_at"),
                "updated_at": row.get("updated_at"),
            })
        return safe_rows

    async def save_managed_request(self, tenant_id: str, integration: str) -> dict:
        """Save a managed setup request (status=pending_setup, setup_mode=managed)."""
        now_iso = datetime.now(timezone.utc).isoformat()

        existing = await db.select(TABLE, {
            "tenant_id": tenant_id,
            "integration": integration,
        }, limit=1)

        if existing:
            result = await db.update(TABLE, {
                "tenant_id": tenant_id,
                "integration": integration,
            }, {
                "status": "pending_setup",
                "setup_mode": "managed",
                "updated_at": now_iso,
            })
        else:
            result = await db.insert(TABLE, {
                "tenant_id": tenant_id,
                "integration": integration,
                "status": "pending_setup",
                "credentials": {},
                "config": {},
                "setup_mode": "managed",
                "created_at": now_iso,
                "updated_at": now_iso,
            })

        logger.info(
            "Managed setup requested: tenant=%s integration=%s",
            tenant_id, integration,
        )
        return result or {}

    # ─── Live test methods ────────────────────────────────────────────

    async def _test_whatsapp(self, creds: dict, config: dict | None = None) -> dict:
        """Check Gupshup API key by listing apps."""
        api_key = creds.get("api_key", "")
        if not api_key:
            return {"ok": False, "message": "Missing api_key", "error": "missing_api_key"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.gupshup.io/wa/app/list",
                    headers={"apikey": api_key},
                )
            if resp.status_code == 200:
                return {"ok": True, "message": "WhatsApp API key is valid", "error": ""}
            return {
                "ok": False,
                "message": f"Gupshup returned {resp.status_code}",
                "error": resp.text[:200],
            }
        except Exception as e:
            return {"ok": False, "message": "WhatsApp connection failed", "error": str(e)}

    async def _test_email(self, creds: dict, config: dict | None = None) -> dict:
        """SMTP login test using aiosmtplib."""
        host = creds.get("host", "smtp.gmail.com")
        port = int(creds.get("port", 587))
        user = creds.get("user", "")
        password = creds.get("password", "")
        if not user or not password:
            return {"ok": False, "message": "Missing SMTP user or password", "error": "missing_credentials"}
        try:
            import aiosmtplib
            smtp = aiosmtplib.SMTP(hostname=host, port=port, start_tls=True)
            await smtp.connect()
            await smtp.login(user, password)
            await smtp.quit()
            return {"ok": True, "message": f"SMTP login successful ({host}:{port})", "error": ""}
        except Exception as e:
            return {"ok": False, "message": "SMTP connection failed", "error": str(e)}

    async def _test_leadrat(self, creds: dict, config: dict | None = None) -> dict:
        """POST test lead to LeadRat."""
        api_key = creds.get("api_key", "")
        account_name = creds.get("account_name", "")
        base_url = creds.get("base_url", "https://connect.leadrat.com/api/v1/integration")
        if not api_key or not account_name:
            return {"ok": False, "message": "Missing api_key or account_name", "error": "missing_credentials"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    f"{base_url}/{account_name}/leads",
                    json={
                        "name": "Cogniflow Test",
                        "phone": "+910000000000",
                        "email": "test@cogniflow.ai",
                        "source": "cogniflow_test",
                    },
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                )
            if resp.status_code in (200, 201):
                return {"ok": True, "message": "LeadRat API key is valid", "error": ""}
            return {
                "ok": False,
                "message": f"LeadRat returned {resp.status_code}",
                "error": resp.text[:200],
            }
        except Exception as e:
            return {"ok": False, "message": "LeadRat connection failed", "error": str(e)}

    async def _test_hubspot(self, creds: dict, config: dict | None = None) -> dict:
        """GET contacts?limit=1 with Bearer token."""
        api_key = creds.get("api_key", "")
        if not api_key:
            return {"ok": False, "message": "Missing api_key", "error": "missing_api_key"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.hubapi.com/crm/v3/objects/contacts",
                    params={"limit": "1"},
                    headers={"Authorization": f"Bearer {api_key}"},
                )
            if resp.status_code == 200:
                return {"ok": True, "message": "HubSpot API key is valid", "error": ""}
            return {
                "ok": False,
                "message": f"HubSpot returned {resp.status_code}",
                "error": resp.text[:200],
            }
        except Exception as e:
            return {"ok": False, "message": "HubSpot connection failed", "error": str(e)}

    async def _test_calcom(self, creds: dict, config: dict | None = None) -> dict:
        """GET event-types with Bearer + cal-api-version header."""
        api_key = creds.get("api_key", "")
        if not api_key:
            return {"ok": False, "message": "Missing api_key", "error": "missing_api_key"}
        api_url = creds.get("api_url", "https://api.cal.com/v2")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    f"{api_url}/event-types",
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "cal-api-version": "2024-08-13",
                    },
                )
            if resp.status_code == 200:
                return {"ok": True, "message": "Cal.com API key is valid", "error": ""}
            return {
                "ok": False,
                "message": f"Cal.com returned {resp.status_code}",
                "error": resp.text[:200],
            }
        except Exception as e:
            return {"ok": False, "message": "Cal.com connection failed", "error": str(e)}

    async def _test_google_calendar(self, creds: dict, config: dict | None = None) -> dict:
        """Validate service_account_json has client_email."""
        sa_json = creds.get("service_account_json", "")
        if not sa_json:
            return {"ok": False, "message": "Missing service_account_json", "error": "missing_credentials"}
        try:
            if isinstance(sa_json, str):
                sa_data = json.loads(sa_json)
            else:
                sa_data = sa_json
            if not sa_data.get("client_email"):
                return {
                    "ok": False,
                    "message": "service_account_json missing client_email field",
                    "error": "invalid_service_account",
                }
            return {
                "ok": True,
                "message": f"Service account: {sa_data['client_email']}",
                "error": "",
            }
        except json.JSONDecodeError as e:
            return {"ok": False, "message": "Invalid JSON in service_account_json", "error": str(e)}

    async def _test_razorpay(self, creds: dict, config: dict | None = None) -> dict:
        """GET payment_links?count=1 with basic auth."""
        key_id = creds.get("key_id", "")
        key_secret = creds.get("key_secret", "")
        if not key_id or not key_secret:
            return {"ok": False, "message": "Missing key_id or key_secret", "error": "missing_credentials"}
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(
                    "https://api.razorpay.com/v1/payment_links",
                    params={"count": "1"},
                    auth=(key_id, key_secret),
                )
            if resp.status_code == 200:
                return {"ok": True, "message": "Razorpay credentials are valid", "error": ""}
            return {
                "ok": False,
                "message": f"Razorpay returned {resp.status_code}",
                "error": resp.text[:200],
            }
        except Exception as e:
            return {"ok": False, "message": "Razorpay connection failed", "error": str(e)}

    async def _test_salesforce(self, creds: dict, config: dict | None = None) -> dict:
        """OAuth token exchange test."""
        client_id = creds.get("client_id", "")
        client_secret = creds.get("client_secret", "")
        username = creds.get("username", "")
        password = creds.get("password", "")
        if not client_id or not client_secret or not username or not password:
            return {
                "ok": False,
                "message": "Missing Salesforce credentials (client_id, client_secret, username, password)",
                "error": "missing_credentials",
            }
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                resp = await client.post(
                    "https://login.salesforce.com/services/oauth2/token",
                    data={
                        "grant_type": "password",
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "username": username,
                        "password": password,
                    },
                )
            if resp.status_code == 200:
                data = resp.json()
                if data.get("access_token"):
                    return {"ok": True, "message": "Salesforce OAuth successful", "error": ""}
            return {
                "ok": False,
                "message": f"Salesforce returned {resp.status_code}",
                "error": resp.text[:200],
            }
        except Exception as e:
            return {"ok": False, "message": "Salesforce connection failed", "error": str(e)}


integration_manager = IntegrationManager()
