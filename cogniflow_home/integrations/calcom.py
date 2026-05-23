"""Cal.com integration — check availability and create bookings via API v2."""

import logging
from datetime import datetime, timedelta

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger(__name__)


class CalCom:

    def __init__(self):
        self.api_url = settings.cal_api_url.rstrip("/")
        self.event_type_id = settings.cal_event_type_id

    @property
    def configured(self) -> bool:
        return bool(settings.cal_api_key and self.event_type_id)

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {settings.cal_api_key}",
            "cal-api-version": "2024-08-13",
            "Content-Type": "application/json",
        }

    async def get_available_slots(
        self,
        date: str,
        duration_minutes: int = 30,
    ) -> list[dict]:
        start = f"{date}T00:00:00Z"
        end_date = (datetime.fromisoformat(date) + timedelta(days=1)).strftime("%Y-%m-%d")
        end = f"{end_date}T00:00:00Z"

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.api_url}/slots/available",
                headers=self._headers(),
                params={
                    "startTime": start,
                    "endTime": end,
                    "eventTypeId": self.event_type_id,
                    "duration": str(duration_minutes),
                },
            )
            resp.raise_for_status()
            data = resp.json()

        slots_by_date = data.get("data", {}).get("slots", {})
        result = []
        for day_key, day_slots in slots_by_date.items():
            for slot in day_slots:
                slot_start = datetime.fromisoformat(slot["time"].replace("Z", "+00:00"))
                slot_end = slot_start + timedelta(minutes=duration_minutes)
                result.append({
                    "start": slot_start.strftime("%I:%M %p"),
                    "end": slot_end.strftime("%I:%M %p"),
                    "iso_start": slot_start.isoformat(),
                    "iso_end": slot_end.isoformat(),
                })
        return result

    async def create_booking(
        self,
        start_iso: str,
        attendee_name: str,
        attendee_email: str,
        attendee_phone: str = "",
        notes: str = "",
    ) -> dict:
        body = {
            "start": start_iso,
            "eventTypeId": int(self.event_type_id),
            "attendee": {
                "name": attendee_name,
                "email": attendee_email,
                "timeZone": "Asia/Kolkata",
            },
            "metadata": {},
        }
        if attendee_phone:
            body["attendee"]["phoneNumber"] = attendee_phone
        if notes:
            body["metadata"]["notes"] = notes

        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.post(
                f"{self.api_url}/bookings",
                headers=self._headers(),
                json=body,
            )
            resp.raise_for_status()
            data = resp.json().get("data", {})
            return {
                "uid": data.get("uid", ""),
                "start_time": data.get("start", ""),
                "end_time": data.get("end", ""),
                "status": data.get("status", ""),
                "meeting_url": data.get("metadata", {}).get("videoCallUrl", ""),
            }

    async def cancel_booking(self, booking_uid: str, reason: str = "") -> bool:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{self.api_url}/bookings/{booking_uid}/cancel",
                headers=self._headers(),
                json={"cancellationReason": reason} if reason else {},
            )
            return resp.status_code in (200, 204)

    async def get_event_types(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"{self.api_url}/event-types",
                headers=self._headers(),
            )
            resp.raise_for_status()
            items = resp.json().get("data", [])
            return [
                {
                    "id": et.get("id"),
                    "title": et.get("title", ""),
                    "slug": et.get("slug", ""),
                    "length": et.get("length", 0),
                }
                for et in items
            ]


calcom = CalCom()
