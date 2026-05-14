"""HubSpot CRM integration.

Before inbound calls: looks up caller in HubSpot and injects context.
After calls: logs call activity, creates contacts, creates tasks.

Enable by calling register().
"""

import logging
from datetime import datetime, timezone
from typing import Any

import httpx

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

logger = logging.getLogger("cogniflow_home.integrations.hubspot")

BASE_URL = "https://api.hubapi.com"


class HubSpotClient:
    def __init__(self):
        self._client = httpx.AsyncClient(timeout=15.0)
        self._headers = {
            "Authorization": f"Bearer {settings.hubspot_api_key}",
            "Content-Type": "application/json",
        }

    @property
    def enabled(self) -> bool:
        return bool(settings.hubspot_api_key)

    async def find_contact_by_phone(self, phone: str) -> dict | None:
        url = f"{BASE_URL}/crm/v3/objects/contacts/search"
        body = {
            "filterGroups": [{
                "filters": [{
                    "propertyName": "phone",
                    "operator": "EQ",
                    "value": phone,
                }]
            }],
            "properties": ["firstname", "lastname", "email", "company", "phone",
                           "lifecyclestage", "hs_lead_status"],
        }
        resp = await self._client.post(url, json=body, headers=self._headers)
        if resp.status_code == 200:
            results = resp.json().get("results", [])
            return results[0] if results else None
        logger.error(f"HubSpot search error: {resp.status_code}")
        return None

    async def create_contact(self, properties: dict) -> dict | None:
        url = f"{BASE_URL}/crm/v3/objects/contacts"
        resp = await self._client.post(url, json={"properties": properties}, headers=self._headers)
        if resp.status_code == 201:
            return resp.json()
        logger.error(f"HubSpot create contact error: {resp.status_code} {resp.text}")
        return None

    async def log_call(self, contact_id: str, summary: str, transcript: str,
                       duration_ms: int, direction: str) -> dict | None:
        url = f"{BASE_URL}/crm/v3/objects/calls"
        body = {
            "properties": {
                "hs_call_body": summary,
                "hs_call_direction": "INBOUND" if direction == "inbound" else "OUTBOUND",
                "hs_call_duration": str(duration_ms),
                "hs_call_status": "COMPLETED",
                "hs_timestamp": datetime.now(timezone.utc).isoformat(),
                "hs_call_title": f"AI Agent Call — {summary[:50]}",
            }
        }
        resp = await self._client.post(url, json=body, headers=self._headers)
        if resp.status_code != 201:
            logger.error(f"HubSpot log call error: {resp.status_code}")
            return None

        call_obj = resp.json()
        call_id = call_obj.get("id")

        assoc_url = f"{BASE_URL}/crm/v3/objects/calls/{call_id}/associations/contacts/{contact_id}/194"
        await self._client.put(assoc_url, headers=self._headers)
        return call_obj

    async def close(self):
        await self._client.aclose()


hubspot = HubSpotClient()


async def on_call_completed(event: str, data: dict[str, Any]):
    if not hubspot.enabled:
        return

    phone = data.get("caller_number", "")
    if not phone:
        return

    contact = await hubspot.find_contact_by_phone(phone)
    transcript = data.get("transcript", [])
    summary = data.get("summary", "")
    if not summary:
        summary = " | ".join(t["text"] for t in transcript[:3])
    duration_ms = data.get("duration_seconds", 0) * 1000
    direction = data.get("direction", "inbound")
    transcript_text = "\n".join(f"{t['role']}: {t['text']}" for t in transcript)

    if contact:
        contact_id = contact["id"]
        hubspot_id = contact_id

        await db.update(
            "contacts",
            {"phone_number": phone},
            {"hubspot_id": hubspot_id},
        )
    else:
        new_contact = await hubspot.create_contact({"phone": phone})
        if new_contact:
            contact_id = new_contact["id"]
            await db.update(
                "contacts",
                {"phone_number": phone},
                {"hubspot_id": contact_id},
            )
        else:
            return

    await hubspot.log_call(contact_id, summary, transcript_text, duration_ms, direction)
    logger.info(f"HubSpot: logged call for contact {contact_id}")


async def get_caller_context(phone: str) -> str:
    """Look up a caller in HubSpot and return context for the agent prompt."""
    if not hubspot.enabled:
        return ""

    contact = await hubspot.find_contact_by_phone(phone)
    if not contact:
        return ""

    props = contact.get("properties", {})
    name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()
    company = props.get("company", "")
    stage = props.get("lifecyclestage", "")
    lead_status = props.get("hs_lead_status", "")

    parts = []
    if name:
        parts.append(f"You're speaking with {name}.")
    if company:
        parts.append(f"They're from {company}.")
    if stage:
        parts.append(f"Lifecycle stage: {stage}.")
    if lead_status:
        parts.append(f"Lead status: {lead_status}.")

    return " ".join(parts)


def register():
    bus.on("call.completed", on_call_completed)
    logger.info("HubSpot integration registered")
