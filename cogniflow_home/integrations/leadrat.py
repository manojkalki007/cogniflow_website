"""LeadRat CRM integration for real estate AI calling agents.

Two modes:
1. POST-CALL: Auto-push lead data after every call via event bus
2. LIVE TOOL: LLM pushes qualified leads during the call

LeadRat API: https://connect.leadrat.com/api/v1/integration/
Auth: API-Key header
"""

import json
import logging
import re
from typing import Any

import httpx
from openai import AsyncOpenAI

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

logger = logging.getLogger(__name__)

QUALIFICATION_PROMPT = """From this real estate call transcript, extract qualification data.
Return ONLY a JSON object:
{
  "interested": true/false,
  "budget": "e.g. 50-75 Lakhs",
  "property_type": "e.g. 3BHK Apartment",
  "location_interest": "e.g. Whitefield",
  "city": "e.g. Bangalore",
  "state": "e.g. Karnataka",
  "timeline": "e.g. this month, 3 months, just exploring",
  "site_visit_booked": true/false,
  "site_visit_date": "YYYY-MM-DD or empty",
  "next_action": "e.g. follow up after site visit",
  "caller_name": "name if mentioned",
  "caller_email": "email if mentioned"
}
Return ONLY the JSON object, no other text."""


class LeadRatCRM:

    def __init__(self):
        self.api_key = settings.leadrat_api_key
        self.account_name = settings.leadrat_account_name
        self.base_url = settings.leadrat_base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=10.0, write=5.0, pool=5.0)
        )

    @property
    def configured(self) -> bool:
        return bool(self.api_key and self.account_name)

    def _headers(self) -> dict:
        return {
            "API-Key": self.api_key,
            "Content-Type": "application/json",
        }

    async def push_lead(self, lead_data: dict) -> dict:
        if not self.configured:
            return {"status": "error", "message": "LeadRat not configured"}

        if not lead_data.get("customermobilenumber"):
            return {"status": "error", "message": "Phone number required"}

        lead_data.setdefault("source", "Cogniflow AI")
        lead_data.setdefault("countryCode", "91")

        url = f"{self.base_url}/IVR/common/body/{self.account_name}"

        try:
            resp = await self._client.post(
                url, headers=self._headers(), json=lead_data,
            )
            result = resp.json()

            if resp.status_code == 200 and result.get("status") == "success":
                logger.info(
                    "LeadRat push success: phone=***%s project=%s",
                    lead_data.get("customermobilenumber", "")[-4:],
                    lead_data.get("project", ""),
                )
            else:
                logger.error(
                    "LeadRat push failed: %d %s",
                    resp.status_code, str(result)[:200],
                )
            return result

        except httpx.TimeoutException:
            logger.error("LeadRat API timeout")
            return {"status": "error", "message": "LeadRat API timeout"}
        except Exception as e:
            logger.exception("LeadRat push error")
            return {"status": "error", "message": str(e)}

    async def close(self):
        await self._client.aclose()


leadrat = LeadRatCRM()


# ── Post-call hook ──

_llm = None


def _get_llm():
    global _llm
    if _llm is None and settings.groq_api_key:
        _llm = AsyncOpenAI(
            api_key=settings.groq_api_key,
            base_url="https://api.groq.com/openai/v1",
        )
    return _llm


async def _extract_qualification(transcript: list[dict]) -> dict:
    llm = _get_llm()
    if not llm:
        return {"interested": False}

    text = "\n".join(f"{t['role']}: {t['text']}" for t in transcript[:60])

    try:
        resp = await llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": QUALIFICATION_PROMPT},
                {"role": "user", "content": text[:3000]},
            ],
            max_tokens=200,
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)
    except Exception:
        logger.exception("Qualification extraction failed")
        return {"interested": False}


async def on_call_completed(event: str, data: dict[str, Any]):
    if not leadrat.configured:
        return

    transcript = data.get("transcript", [])
    if len(transcript) < 3:
        return

    qualification = await _extract_qualification(transcript)

    summary_parts = []
    for t in transcript:
        summary_parts.append(f"{t['role']}: {t['text']}")
    summary = " | ".join(summary_parts[-10:])

    phone = data.get("caller_number", "")
    if phone.startswith("+91"):
        phone = phone[3:]
    elif phone.startswith("91") and len(phone) > 10:
        phone = phone[2:]

    lead_data = {
        "customermobilenumber": phone,
        "name": qualification.get("caller_name", ""),
        "email": qualification.get("caller_email", ""),
        "city": qualification.get("city", ""),
        "state": qualification.get("state", ""),
        "location": qualification.get("location_interest", ""),
        "budget": qualification.get("budget", ""),
        "property": qualification.get("property_type", ""),
        "notes": _build_notes(summary, qualification, data),
        "source": "Cogniflow AI",
        "subSource": data.get("direction", "outbound"),
    }

    budget_num = _parse_budget_number(qualification.get("budget", ""))
    if budget_num:
        lead_data["leadExpectedBudget"] = str(budget_num)

    result = await leadrat.push_lead(lead_data)

    if result.get("status") == "success":
        try:
            await db.update("calls", {"id": data.get("call_id")}, {
                "crm_synced": True,
                "crm_provider": "leadrat",
            })
        except Exception:
            pass

    await bus.emit("leadrat.push_completed", {
        "call_id": data.get("call_id"),
        "status": result.get("status"),
        "qualified": qualification.get("interested", False),
    })


def _build_notes(summary: str, qualification: dict, call_data: dict) -> str:
    parts = [f"AI Call Summary: {summary[:500]}"]
    parts.append(f"Duration: {call_data.get('duration_seconds', 0)}s")
    parts.append(f"Direction: {call_data.get('direction', 'outbound')}")

    if qualification.get("interested"):
        parts.append("Status: INTERESTED")
    else:
        parts.append("Status: NOT INTERESTED")

    for key, label in [
        ("budget", "Budget"),
        ("property_type", "Looking for"),
        ("location_interest", "Preferred location"),
        ("timeline", "Timeline"),
    ]:
        if qualification.get(key):
            parts.append(f"{label}: {qualification[key]}")

    if qualification.get("site_visit_booked"):
        parts.append(f"Site visit: {qualification.get('site_visit_date', 'TBD')}")

    if qualification.get("next_action"):
        parts.append(f"Next action: {qualification['next_action']}")

    return " | ".join(parts)


def _parse_budget_number(budget_str: str) -> int | None:
    if not budget_str:
        return None

    s = budget_str.lower().replace(",", "")

    m = re.search(r'(\d+)\s*-\s*(\d+)\s*(?:lakh|lac|l)', s)
    if m:
        return (int(m.group(1)) + int(m.group(2))) * 100000 // 2

    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:crore|cr)', s)
    if m:
        return int(float(m.group(1)) * 10000000)

    m = re.search(r'(\d+(?:\.\d+)?)\s*(?:lakh|lac|l)', s)
    if m:
        return int(float(m.group(1)) * 100000)

    return None


# ── LLM tool handler ──

LEADRAT_TOOL_DEFINITION = {
    "type": "function",
    "function": {
        "name": "push_to_leadrat",
        "description": (
            "Save this lead to LeadRat CRM. Use after qualifying — "
            "when you have their name, budget, and property interest."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Lead's full name"},
                "budget": {"type": "string", "description": "Budget range, e.g. '50-75 Lakhs'"},
                "property_type": {"type": "string", "description": "e.g. '3BHK Apartment'"},
                "location": {"type": "string", "description": "Preferred area, e.g. 'Whitefield'"},
                "interested": {"type": "boolean", "description": "Is the lead interested?"},
                "site_visit_date": {"type": "string", "description": "Site visit date if booked (YYYY-MM-DD)"},
                "notes": {"type": "string", "description": "Additional notes from conversation"},
            },
            "required": ["name", "interested"],
        },
    },
}


async def handle_push_to_leadrat(args: dict, ctx: dict) -> str:
    phone = ctx.get("caller_number", "")
    if phone.startswith("+91"):
        phone = phone[3:]
    elif phone.startswith("91") and len(phone) > 10:
        phone = phone[2:]

    lead_data = {
        "customermobilenumber": phone,
        "name": args.get("name", ""),
        "location": args.get("location", ""),
        "budget": args.get("budget", ""),
        "property": args.get("property_type", ""),
        "notes": args.get("notes", ""),
        "source": "Cogniflow AI",
        "subSource": "live_call",
    }

    budget_num = _parse_budget_number(args.get("budget", ""))
    if budget_num:
        lead_data["leadExpectedBudget"] = str(budget_num)

    result = await leadrat.push_lead(lead_data)

    if result.get("status") == "success":
        return "Lead saved to CRM successfully."
    return "Could not save to CRM right now. I'll make sure it's saved after the call."


def register():
    bus.on("call.completed", on_call_completed)
    logger.info("LeadRat CRM integration registered")
