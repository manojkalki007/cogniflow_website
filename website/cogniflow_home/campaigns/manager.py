"""
Campaign manager — batch outbound dialing.

Create a campaign with a list of phone numbers and an agent.
The manager dials numbers in batches, respects concurrency limits,
tracks progress, and can be paused/resumed.

API:
  POST /api/campaigns              — create a campaign
  POST /api/campaigns/{id}/start   — start dialing
  POST /api/campaigns/{id}/pause   — pause dialing
  GET  /api/campaigns/{id}         — get campaign status
  GET  /api/campaigns              — list all campaigns
  POST /api/campaigns/upload       — upload CSV of numbers
"""

import asyncio
import csv
import io
import logging
import re
import uuid

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus
from cogniflow_home.campaigns.dnc import is_blocked
from cogniflow_home.telephony.registry import get_provider

logger = logging.getLogger("cogniflow_home.campaigns")

_running_campaigns: dict[str, asyncio.Task] = {}


async def create_campaign(name: str, agent_id: str | None, phone_numbers: list[str],
                          max_concurrent: int = 1, provider: str = "twilio") -> dict | None:
    campaign = {
        "id": str(uuid.uuid4()),
        "name": name,
        "agent_id": agent_id,
        "status": "draft",
        "phone_numbers": phone_numbers,
        "total_numbers": len(phone_numbers),
        "dialed_count": 0,
        "connected_count": 0,
        "completed_count": 0,
        "max_concurrent": max_concurrent,
        "metadata": {"provider": provider},
    }
    return await db.insert("campaigns", campaign)


_PHONE_RE = re.compile(r'^\+?[\d\s\-()]{7,20}$')


def parse_csv(csv_content: str) -> list[str]:
    """Parse CSV content and extract valid phone numbers."""
    reader = csv.reader(io.StringIO(csv_content))
    numbers = []
    for row in reader:
        for cell in row:
            cleaned = cell.strip()
            if not cleaned:
                continue
            digits_only = re.sub(r'[\s\-()]', '', cleaned)
            if not _PHONE_RE.match(cleaned):
                continue
            if len(digits_only) < 7 or len(digits_only) > 15:
                continue
            if not digits_only.startswith('+'):
                digits_only = f"+{digits_only}"
            numbers.append(digits_only)
    return list(set(numbers))


async def start_campaign(campaign_id: str):
    campaigns = await db.select("campaigns", {"id": campaign_id})
    if not campaigns:
        return {"error": "Campaign not found"}

    campaign = campaigns[0]
    if campaign["status"] == "active":
        return {"error": "Campaign already running"}

    await db.update("campaigns", {"id": campaign_id}, {"status": "active"})

    task = asyncio.create_task(_run_campaign(campaign))
    _running_campaigns[campaign_id] = task
    return {"status": "started", "campaign_id": campaign_id}


async def pause_campaign(campaign_id: str):
    await db.update("campaigns", {"id": campaign_id}, {"status": "paused"})
    task = _running_campaigns.pop(campaign_id, None)
    if task:
        task.cancel()
    return {"status": "paused"}


async def _run_campaign(campaign: dict):
    campaign_id = campaign["id"]
    numbers = campaign.get("phone_numbers", [])
    max_concurrent = campaign.get("max_concurrent", 1)
    dialed = campaign.get("dialed_count", 0)
    provider = campaign.get("metadata", {}).get("provider", "twilio")

    semaphore = asyncio.Semaphore(max_concurrent)
    remaining = numbers[dialed:]
    completed = dialed

    async def dial_one(number: str, index: int):
        nonlocal completed
        async with semaphore:
            current = await db.select("campaigns", {"id": campaign_id})
            if not current or current[0].get("status") != "active":
                return

            if await is_blocked(number):
                logger.info(f"Campaign {campaign_id}: skipping {number} (DNC)")
                completed += 1
                await db.update("campaigns", {"id": campaign_id}, {"dialed_count": completed})
                return

            logger.info(f"Campaign {campaign_id}: dialing {number} ({index + 1}/{len(numbers)})")

            try:
                telephony = get_provider(provider)
                webhook_url = f"{settings.public_url}/voice/{provider}/outbound"
                status_url = f"{settings.public_url}/api/campaigns/{campaign_id}/call-status"
                result = await telephony.initiate_outbound_call(number, webhook_url, status_url)
                logger.info(f"  Call initiated: {result.call_sid}")

                await bus.emit("campaign.dialing", {
                    "campaign_id": campaign_id,
                    "phone_number": number,
                    "call_sid": result.call_sid,
                    "provider": provider,
                })

                await asyncio.sleep(2)

            except Exception:
                logger.exception(f"Failed to dial {number}")

            completed += 1
            await db.update("campaigns", {"id": campaign_id}, {
                "dialed_count": completed,
            })

    try:
        for i, number in enumerate(remaining):
            current = await db.select("campaigns", {"id": campaign_id})
            if not current or current[0].get("status") != "active":
                break
            await dial_one(number, dialed + i)

        final = await db.select("campaigns", {"id": campaign_id})
        if final and final[0].get("status") == "active":
            await db.update("campaigns", {"id": campaign_id}, {"status": "completed"})
            logger.info(f"Campaign {campaign_id} completed")

    except asyncio.CancelledError:
        logger.info(f"Campaign {campaign_id} paused")
    except Exception:
        logger.exception(f"Campaign {campaign_id} error")
        await db.update("campaigns", {"id": campaign_id}, {"status": "failed"})
    finally:
        _running_campaigns.pop(campaign_id, None)


async def get_campaign(campaign_id: str) -> dict | None:
    campaigns = await db.select("campaigns", {"id": campaign_id})
    return campaigns[0] if campaigns else None


async def list_campaigns() -> list[dict]:
    return await db.select("campaigns", order="created_at.desc")


async def resume_active_campaigns():
    campaigns = await db.select("campaigns", {"status": "active"})
    for campaign in campaigns:
        campaign_id = campaign["id"]
        if campaign_id not in _running_campaigns:
            logger.info(f"Resuming campaign {campaign_id}")
            task = asyncio.create_task(_run_campaign(campaign))
            _running_campaigns[campaign_id] = task
