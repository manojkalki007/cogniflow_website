"""Do Not Call (DNC) list management.

Numbers on this list are automatically filtered out before
campaigns dial them. Numbers can be added manually, via API,
or automatically when a caller says "remove me" or "stop calling".
"""

import logging
from typing import Any

from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

logger = logging.getLogger("cogniflow_home.dnc")


async def is_blocked(phone_number: str) -> bool:
    results = await db.select("dnc_list", {"phone_number": phone_number})
    return len(results) > 0


async def add_number(phone_number: str, reason: str = "manual") -> dict | None:
    existing = await db.select("dnc_list", {"phone_number": phone_number})
    if existing:
        return existing[0]
    result = await db.insert("dnc_list", {
        "phone_number": phone_number,
        "reason": reason,
    })
    logger.info(f"Added {phone_number} to DNC list (reason: {reason})")
    return result


async def remove_number(phone_number: str):
    await db.update("dnc_list", {"phone_number": phone_number}, {"is_active": False})
    logger.info(f"Removed {phone_number} from DNC list")


async def get_list(limit: int = 500) -> list[dict]:
    return await db.select("dnc_list", {"is_active": "true"}, order="created_at.desc", limit=limit)


def filter_numbers(numbers: list[str], dnc_numbers: set[str]) -> list[str]:
    return [n for n in numbers if n not in dnc_numbers]


async def on_call_completed(event: str, data: dict[str, Any]):
    """Auto-add to DNC if the caller requested removal."""
    transcript = data.get("transcript", [])
    for turn in transcript:
        if turn.get("role") == "user":
            text = turn.get("text", "").lower()
            if any(phrase in text for phrase in [
                "stop calling", "remove me", "do not call",
                "don't call", "take me off", "unsubscribe",
            ]):
                phone = data.get("caller_number", "")
                if phone:
                    await add_number(phone, reason="caller_requested")
                    await bus.emit("dnc.added", {
                        "phone_number": phone,
                        "call_id": data.get("call_id"),
                        "reason": "caller_requested",
                    })
                break


def register():
    bus.on("call.completed", on_call_completed)
    logger.info("DNC auto-detection registered")
