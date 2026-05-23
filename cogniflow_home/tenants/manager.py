"""Tenant lifecycle management.

Create, update, suspend tenants and their API keys.
"""

import logging
import secrets

from cogniflow_home.db.supabase import db
from cogniflow_home.tenants.auth import generate_api_key

logger = logging.getLogger("cogniflow_home.tenants.manager")


async def create_tenant(
    name: str,
    email: str,
    plan: str = "starter",
    phone: str = "",
) -> dict:
    """Create a new tenant and generate their first API key.
    Returns the tenant record + the RAW api key (shown once)."""
    slug = name.lower().replace(" ", "-").replace("'", "")[:30]
    existing = await db.select("tenants", {"slug": slug})
    if existing:
        slug = f"{slug}-{secrets.token_hex(3)}"

    plans = await db.select("plans", {"id": plan})
    plan_data = plans[0] if plans else {}

    tenant = await db.insert("tenants", {
        "name": name,
        "slug": slug,
        "email": email,
        "phone": phone,
        "plan": plan,
        "monthly_minutes_limit": plan_data.get("included_minutes", 500),
        "max_agents": plan_data.get("max_agents", 1),
        "max_concurrent_calls": plan_data.get("max_concurrent", 5),
    })

    if not tenant:
        return {"error": "Failed to create tenant"}

    raw_key, key_hash, key_prefix = generate_api_key()
    await db.insert("api_keys", {
        "tenant_id": tenant["id"],
        "name": "Default Key",
        "key_hash": key_hash,
        "key_prefix": key_prefix,
        "scopes": ["calls:read", "calls:write", "agents:read", "agents:write",
                    "campaigns:read", "campaigns:write", "analytics:read"],
    })

    await db.insert("tenant_users", {
        "tenant_id": tenant["id"],
        "email": email,
        "name": name,
        "role": "owner",
    })

    return {
        "tenant": tenant,
        "api_key": raw_key,
        "key_prefix": key_prefix,
    }


async def record_call_usage(
    tenant_id: str,
    call_id: str,
    duration_seconds: int,
    language: str = "hi",
    provider: str = "twilio",
):
    """Record usage for a completed call. Calculates per-component costs in paise."""
    duration_minutes = duration_seconds / 60

    stt = int(duration_minutes * 50)     # Sarvam STT: 50 paise/min
    llm = int(duration_minutes * 11)     # Groq: ~11 paise/min
    tts = int(duration_minutes * 90)     # Sarvam TTS: ~90 paise/min
    tel_rates = {"twilio": 64, "exotel": 30, "vobiz": 45, "mcube": 60, "sip": 0, "browser": 0}
    tel = int(duration_minutes * tel_rates.get(provider, 64))
    server = int(duration_minutes * 51)  # Server share: ~51 paise/min
    total = stt + llm + tts + tel + server

    await db.insert("usage_records", {
        "tenant_id": tenant_id,
        "call_id": call_id,
        "duration_seconds": duration_seconds,
        "stt_cost_paise": stt,
        "llm_cost_paise": llm,
        "tts_cost_paise": tts,
        "tel_cost_paise": tel,
        "total_cost_paise": total,
        "language": language,
        "provider": provider,
    })

    # Update tenant monthly counters via select + update (no raw SQL needed)
    tenant_rows = await db.select("tenants", {"id": tenant_id})
    if not tenant_rows:
        return
    tenant = tenant_rows[0]
    duration_minutes_int = max(1, round(duration_minutes))
    new_minutes = tenant.get("current_month_minutes", 0) + duration_minutes_int
    new_cost = tenant.get("current_month_cost_paise", 0) + total

    await db.update("tenants", {"id": tenant_id}, {
        "current_month_minutes": new_minutes,
        "current_month_cost_paise": new_cost,
    })

    # 90% limit warning
    limit = tenant.get("monthly_minutes_limit", 500)
    old_minutes = tenant.get("current_month_minutes", 0)
    if new_minutes >= limit * 0.9 and old_minutes < limit * 0.9:
        logger.warning(
            f"Tenant {tenant['name']} ({tenant_id}) approaching limit: "
            f"{new_minutes}/{limit} minutes ({round(new_minutes / limit * 100, 1)}%)"
        )
