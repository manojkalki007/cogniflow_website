"""Cal.com integration — check availability and create bookings via API v2."""

import logging
from datetime import datetime, timedelta

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger(__name__)


class CalCom:

    def __init__(self):
        self.api_url = settings.cal_api_url.rstrip("/")
        self._raw_event_type_id = settings.cal_event_type_id
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=15.0, write=5.0, pool=5.0)
        )

        if self._raw_event_type_id:
            try:
                self._event_type_id = int(self._raw_event_type_id)
            except ValueError:
                logger.error("CAL_EVENT_TYPE_ID must be numeric, got: %r", self._raw_event_type_id)
                self._event_type_id = 0
        else:
            self._event_type_id = 0

    @property
    def configured(self) -> bool:
        return bool(settings.cal_api_key and self._event_type_id)

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
        try:
            start_dt = datetime.fromisoformat(date)
        except (ValueError, TypeError):
            logger.warning("Invalid date for availability check: %s", date)
            return []

        start = f"{date}T00:00:00Z"
        end_date = (start_dt + timedelta(days=1)).strftime("%Y-%m-%d")
        end = f"{end_date}T00:00:00Z"

        resp = await self._client.get(
            f"{self.api_url}/slots/available",
            headers=self._headers(),
            params={
                "startTime": start,
                "endTime": end,
                "eventTypeId": str(self._event_type_id),
                "duration": str(duration_minutes),
            },
        )
        if resp.status_code != 200:
            logger.error("Cal.com availability check failed: %d %s", resp.status_code, resp.text[:200])
            return []
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
            "eventTypeId": self._event_type_id,
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

        resp = await self._client.post(
            f"{self.api_url}/bookings",
            headers=self._headers(),
            json=body,
        )
        if resp.status_code not in (200, 201):
            error_detail = resp.text[:300]
            logger.error("Cal.com booking failed: %d %s", resp.status_code, error_detail)
            raise RuntimeError(f"Cal.com booking error {resp.status_code}: {error_detail}")
        data = resp.json().get("data", {})
        return {
            "uid": data.get("uid", ""),
            "start_time": data.get("start", ""),
            "end_time": data.get("end", ""),
            "status": data.get("status", ""),
            "meeting_url": data.get("metadata", {}).get("videoCallUrl", ""),
        }

    async def cancel_booking(self, booking_uid: str, reason: str = "") -> bool:
        resp = await self._client.post(
            f"{self.api_url}/bookings/{booking_uid}/cancel",
            headers=self._headers(),
            json={"cancellationReason": reason} if reason else {},
        )
        return resp.status_code in (200, 204)

    async def get_event_types(self) -> list[dict]:
        resp = await self._client.get(
            f"{self.api_url}/event-types",
            headers=self._headers(),
        )
        if resp.status_code != 200:
            logger.error("Cal.com event types fetch failed: %d", resp.status_code)
            return []
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

    async def close(self):
        await self._client.aclose()


calcom = CalCom()
