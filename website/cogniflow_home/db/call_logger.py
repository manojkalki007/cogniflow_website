"""Call logger — persists call data to Supabase.

Subscribes to the event bus and writes/updates call records
and contact records as calls progress.
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
        "id": data["call_id"],
        "direction": data.get("direction", "inbound"),
        "caller_number": data.get("caller_number", ""),
        "called_number": data.get("called_number", ""),
        "agent_name": data.get("agent_name", ""),
        "provider": data.get("provider", "twilio"),
        "status": "active",
    }
    await db.insert("calls", call_data)
    logger.info(f"Call {data['call_id']} logged as active")


async def on_call_completed(event: str, data: dict[str, Any]):
    transcript = data.get("transcript", [])
    summary = await _generate_summary(transcript)
    duration = data.get("duration_seconds", 0)

    call_update = {
        "status": "completed",
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": duration,
        "transcript": transcript,
        "summary": summary,
    }
    await db.update("calls", {"id": data["call_id"]}, call_update)

    phone = data.get("caller_number", "")
    if phone:
        existing = await db.select("contacts", {"phone_number": phone})
        if existing:
            contact = existing[0]
            await db.update("contacts", {"id": contact["id"]}, {
                "total_calls": contact.get("total_calls", 0) + 1,
                "last_call_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })
        else:
            await db.insert("contacts", {
                "phone_number": phone,
                "total_calls": 1,
                "last_call_at": datetime.now(timezone.utc).isoformat(),
            })
            await bus.emit("contact.created", {"phone_number": phone})

    logger.info(f"Call {data['call_id']} completed — {duration}s, {len(transcript)} turns")


async def on_call_failed(event: str, data: dict[str, Any]):
    await db.update("calls", {"id": data["call_id"]}, {
        "status": "failed",
        "ended_at": datetime.now(timezone.utc).isoformat(),
        "metadata": {"error": data.get("error", "unknown")},
    })


def register():
    bus.on("call.started", on_call_started)
    bus.on("call.completed", on_call_completed)
    bus.on("call.failed", on_call_failed)
    logger.info("Call logger registered")
