"""
Cross-session caller memory.

When a call connects, look up the caller's phone number in the contacts table.
If they've called before, load their profile and inject it into the LLM prompt.
After the call, update their profile with new information.
"""

import logging
from datetime import datetime, timezone

from cogniflow_home.db.supabase import db

logger = logging.getLogger(__name__)


class CallerMemory:
    """Load and update caller profiles across sessions."""

    async def recall(self, phone_number: str) -> dict | None:
        contacts = await db.select("contacts", {"phone_number": f"eq.{phone_number}"})
        if not contacts:
            return None

        contact = contacts[0]

        calls = await db.select(
            "calls",
            {"caller_number": f"eq.{phone_number}"},
            order="created_at.desc",
            limit=3,
        )

        recent_summaries = [
            c.get("summary", "")
            for c in calls
            if c.get("summary")
        ]

        rolling_context = ""
        if recent_summaries:
            rolling_context = " | ".join(recent_summaries[:3])

        return {
            "name": contact.get("name"),
            "company": contact.get("company"),
            "total_calls": contact.get("total_calls", 0),
            "last_call_summary": recent_summaries[0] if recent_summaries else None,
            "recent_history": rolling_context,
            "notes": contact.get("notes"),
            "preferences": contact.get("preferences", {}),
        }

    def build_memory_prompt(self, profile: dict) -> str:
        parts = ["\n[CALLER MEMORY — this person has called before]"]

        if profile.get("name"):
            parts.append(f"Name: {profile['name']}")
        if profile.get("company"):
            parts.append(f"Company: {profile['company']}")
        if profile.get("total_calls"):
            parts.append(f"Total previous calls: {profile['total_calls']}")
        if profile.get("last_call_summary"):
            parts.append(f"Last call summary: {profile['last_call_summary']}")
        if profile.get("notes"):
            parts.append(f"Agent notes: {profile['notes']}")

        prefs = profile.get("preferences", {})
        if prefs.get("language"):
            parts.append(f"Preferred language: {prefs['language']}")

        parts.append(
            "\nUse this context naturally. Greet them by name if known. "
            "Reference their last interaction if relevant. Don't read "
            "this information out loud — use it to be helpful."
        )

        return "\n".join(parts)

    async def update_after_call(
        self,
        phone_number: str,
        summary: str,
        sentiment: dict | None = None,
        detected_name: str | None = None,
    ):
        contacts = await db.select("contacts", {"phone_number": f"eq.{phone_number}"})

        if contacts:
            contact = contacts[0]
            update_data = {
                "total_calls": (contact.get("total_calls", 0) or 0) + 1,
                "last_call_at": datetime.now(timezone.utc).isoformat(),
            }
            if detected_name and not contact.get("name"):
                update_data["name"] = detected_name

            await db.update("contacts", {"id": contact["id"]}, update_data)
        else:
            await db.insert("contacts", {
                "phone_number": phone_number,
                "name": detected_name,
                "total_calls": 1,
                "last_call_at": datetime.now(timezone.utc).isoformat(),
            })


caller_memory = CallerMemory()
