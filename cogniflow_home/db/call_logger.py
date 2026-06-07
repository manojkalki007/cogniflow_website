"""Call logger — persists call data to Supabase.

Subscribes to the event bus and writes/updates call records
and contact records as calls progress.

calls table columns: id (uuid), user_id, agent_id, bolna_call_id, phone_number,
  status, duration_seconds, transcript (jsonb), recording_url, started_at,
  ended_at, created_at, campaign_id, tenant_id
"""

import logging
from datetime import datetime, timezone
from typing import Any

from openai import AsyncOpenAI

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

logger = logging.getLogger("cogniflow_home.db.logger")

_llm = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")


async def _generate_summary(transcript: list[dict]) -> str:
    if not transcript:
        return ""
    text = "\n".join(f"{t['role']}: {t['text']}" for t in transcript)
    try:
        resp = await _llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "Summarize this phone call in 2 sentences. Be factual and concise."},
                {"role": "user", "content": text},
            ],
            max_tokens=100,
        )
        return resp.choices[0].message.content.strip()
    except Exception:
        logger.exception("Failed to generate call summary")
        return ""


async def on_call_started(event: str, data: dict[str, Any]):
    call_data = {
        "bolna_call_id": data["call_id"],
        "phone_number": data.get("caller_number", ""),
        "status": "active",
        "started_at": datetime.now(timezone.utc).isoformat(),
    }
    if data.get("tenant_id"):
        call_data["tenant_id"] = data["tenant_id"]
    if data.get("agent_id"):
        call_data["agent_id"] = data["agent_id"]

    result = await db.insert("calls", call_data)
    if result:
        logger.info(f"Call {data['call_id']} logged as active")
    else:
        logger.error(f"Failed to log call {data['call_id']}")


async def on_call_completed(event: str, data: dict[str, Any]):
    transcript = data.get("transcript", [])
    duration = data.get("duration_seconds", 0)

    call_update = {
        "status": "completed",
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": duration,
        "transcript": transcript,
    }

    updated = await db.update("calls", {"bolna_call_id": data["call_id"]}, call_update)
    if not updated:
        call_update["bolna_call_id"] = data["call_id"]
        call_update["phone_number"] = data.get("caller_number", "")
        call_update["started_at"] = datetime.now(timezone.utc).isoformat()
        if data.get("tenant_id"):
            call_update["tenant_id"] = data["tenant_id"]
        if data.get("agent_id"):
            call_update["agent_id"] = data["agent_id"]
        await db.insert("calls", call_update)

    logger.info(f"Call {data['call_id']} completed — {duration}s, {len(transcript)} turns")


async def on_call_failed(event: str, data: dict[str, Any]):
    await db.update("calls", {"bolna_call_id": data["call_id"]}, {
        "status": "failed",
        "ended_at": datetime.now(timezone.utc).isoformat(),
    })


def register():
    bus.on("call.started", on_call_started)
    bus.on("call.completed", on_call_completed)
    bus.on("call.failed", on_call_failed)
    logger.info("Call logger registered")
