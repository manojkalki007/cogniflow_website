"""Per-tenant credential resolver with AES-256-GCM encryption and TTL cache.

Lookup order: tenant DB config → global env vars (settings.*).
Credentials are cached in-memory for 5 minutes per tenant+type pair.
"""

import base64
import logging
import os
import time

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.credentials")

CACHE_TTL = 300

SENSITIVE_KEYS = {
    "api_key", "key_secret", "key_id", "password", "client_secret",
    "service_account_json", "auth_token", "api_token", "webhook_secret",
}

INTEGRATION_SETTINGS_MAP = {
    "whatsapp": {
        "api_key": "whatsapp_api_key",
        "api_url": "whatsapp_api_url",
    },
    "smtp": {
        "host": "smtp_host",
        "port": "smtp_port",
        "user": "smtp_user",
        "password": "smtp_password",
        "from_email": "smtp_from_email",
        "from_name": "smtp_from_name",
    },
    "calcom": {
        "api_key": "cal_api_key",
        "event_type_id": "cal_event_type_id",
        "api_url": "cal_api_url",
    },
    "hubspot": {
        "api_key": "hubspot_api_key",
    },
    "salesforce": {
        "client_id": "salesforce_client_id",
        "client_secret": "salesforce_client_secret",
        "username": "salesforce_username",
        "password": "salesforce_password",
    },
    "leadrat": {
        "api_key": "leadrat_api_key",
        "account_name": "leadrat_account_name",
        "base_url": "leadrat_base_url",
    },
    "razorpay": {
        "key_id": "razorpay_key_id",
        "key_secret": "razorpay_key_secret",
    },
    "google_calendar": {
        "calendar_id": "google_calendar_id",
        "service_account_json": "google_service_account_json",
        "service_account_path": "google_service_account_path",
    },
}


class CredentialResolver:

    def __init__(self):
        self._cache: dict[str, tuple[dict, float]] = {}
        self._encryption_key = self._load_key()

    def _load_key(self) -> bytes | None:
        hex_key = settings.credential_encryption_key
        if not hex_key:
            return None
        try:
            key = bytes.fromhex(hex_key)
            if len(key) != 32:
                logger.error("CREDENTIAL_ENCRYPTION_KEY must be 32 bytes (64 hex chars)")
                return None
            return key
        except ValueError:
            logger.error("CREDENTIAL_ENCRYPTION_KEY is not valid hex")
            return None

    def _encrypt_value(self, plaintext: str) -> str:
        if not self._encryption_key:
            return plaintext
        from cryptography.hazmat.primitives.ciphers.aead import AESGCM
        nonce = os.urandom(12)
        ct = AESGCM(self._encryption_key).encrypt(nonce, plaintext.encode(), None)
        return "enc:" + base64.b64encode(nonce + ct).decode()

    def _decrypt_value(self, value: str) -> str:
        if not value or not self._encryption_key:
            return value
        if not value.startswith("enc:"):
            return value
        try:
            from cryptography.hazmat.primitives.ciphers.aead import AESGCM
            raw = base64.b64decode(value[4:])
            nonce, ct = raw[:12], raw[12:]
            return AESGCM(self._encryption_key).decrypt(nonce, ct, None).decode()
        except Exception:
            logger.warning("Failed to decrypt credential value, returning as-is")
            return value

    def encrypt_config(self, config: dict) -> dict:
        result = {}
        for k, v in config.items():
            if k in SENSITIVE_KEYS and isinstance(v, str) and v and not v.startswith("enc:"):
                result[k] = self._encrypt_value(v)
            else:
                result[k] = v
        return result

    def _decrypt_config(self, config: dict) -> dict:
        result = {}
        for k, v in config.items():
            if isinstance(v, str) and v.startswith("enc:"):
                result[k] = self._decrypt_value(v)
            else:
                result[k] = v
        return result

    def _get_global_fallback(self, integration_type: str) -> dict:
        mapping = INTEGRATION_SETTINGS_MAP.get(integration_type, {})
        result = {}
        for config_key, settings_attr in mapping.items():
            val = getattr(settings, settings_attr, "")
            if val:
                result[config_key] = val if isinstance(val, str) else str(val)
        return result

    async def get(self, tenant_id: str, integration_type: str) -> dict:
        """Lookup order: cache -> tenant_integrations -> integrations (legacy) -> global env."""
        cache_key = f"{tenant_id}:{integration_type}"

        cached = self._cache.get(cache_key)
        if cached:
            config, expiry = cached
            if time.time() < expiry:
                return config

        fallback = self._get_global_fallback(integration_type)

        if not tenant_id:
            self._cache[cache_key] = (fallback, time.time() + CACHE_TTL)
            return fallback

        try:
            from cogniflow_home.db.supabase import db

            # 1. Check tenant_integrations table (new, preferred)
            ti_rows = await db.select("tenant_integrations", {
                "tenant_id": tenant_id,
                "integration": integration_type,
            }, limit=1)
            if ti_rows and ti_rows[0].get("status") == "connected":
                db_creds = ti_rows[0].get("credentials") or {}
                db_config = ti_rows[0].get("config") or {}
                decrypted = self._decrypt_config({**db_creds, **db_config})
                merged = {**fallback, **{k: v for k, v in decrypted.items() if v}}
                self._cache[cache_key] = (merged, time.time() + CACHE_TTL)
                return merged

            # 2. Check integrations table (legacy fallback)
            rows = await db.select("integrations", {
                "tenant_id": tenant_id,
                "type": integration_type,
            }, limit=1)
            if rows and rows[0].get("status") == "connected":
                db_config = rows[0].get("config") or {}
                decrypted = self._decrypt_config(db_config)
                merged = {**fallback, **{k: v for k, v in decrypted.items() if v}}
                self._cache[cache_key] = (merged, time.time() + CACHE_TTL)
                return merged
        except Exception:
            logger.debug("Credential lookup failed, using global fallback", exc_info=True)

        # 3. Global env var fallback
        self._cache[cache_key] = (fallback, time.time() + CACHE_TTL)
        return fallback

    def invalidate(self, tenant_id: str, integration_type: str = ""):
        if integration_type:
            self._cache.pop(f"{tenant_id}:{integration_type}", None)
        else:
            keys = [k for k in self._cache if k.startswith(f"{tenant_id}:")]
            for k in keys:
                del self._cache[k]


credentials = CredentialResolver()
