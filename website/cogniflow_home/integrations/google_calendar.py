"""
Google Calendar integration.
The agent can check availability and book real appointments.
"""

import json
import logging
import time
from datetime import datetime, timedelta

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger(__name__)


class GoogleCalendar:
    """Check availability and create events on Google Calendar."""

    def __init__(self):
        self.calendar_id = settings.google_calendar_id or "primary"
        self._cached_token = None
        self._token_expires = 0

    async def get_available_slots(
        self,
        date: str,
        duration_minutes: int = 30,
        business_hours: tuple = (9, 17),
    ) -> list[dict]:
        start_of_day = datetime.fromisoformat(f"{date}T{business_hours[0]:02d}:00:00")
        end_of_day = datetime.fromisoformat(f"{date}T{business_hours[1]:02d}:00:00")

        token = await self._get_access_token()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(
                f"https://www.googleapis.com/calendar/v3/calendars/{self.calendar_id}/events",
                headers={"Authorization": f"Bearer {token}"},
                params={
                    "timeMin": start_of_day.isoformat() + "Z",
                    "timeMax": end_of_day.isoformat() + "Z",
                    "singleEvents": "true",
                    "orderBy": "startTime",
                },
            )
            events = resp.json().get("items", [])

        busy = []
        for event in events:
            start = event.get("start", {}).get("dateTime")
            end = event.get("end", {}).get("dateTime")
            if start and end:
                busy.append((
                    datetime.fromisoformat(start),
                    datetime.fromisoformat(end),
                ))

        slots = []
        current = start_of_day
        while current + timedelta(minutes=duration_minutes) <= end_of_day:
            slot_end = current + timedelta(minutes=duration_minutes)
            is_available = not any(
                current < busy_end and slot_end > busy_start
                for busy_start, busy_end in busy
            )
            if is_available:
                slots.append({
                    "start": current.strftime("%I:%M %p"),
                    "end": slot_end.strftime("%I:%M %p"),
                    "iso_start": current.isoformat(),
                    "iso_end": slot_end.isoformat(),
                })
            current += timedelta(minutes=duration_minutes)

        return slots

    async def create_event(
        self,
        title: str,
        start_iso: str,
        end_iso: str,
        attendee_email: str = None,
        description: str = "",
    ) -> dict:
        token = await self._get_access_token()
        event = {
            "summary": title,
            "description": description,
            "start": {"dateTime": start_iso, "timeZone": "Asia/Kolkata"},
            "end": {"dateTime": end_iso, "timeZone": "Asia/Kolkata"},
        }
        if attendee_email:
            event["attendees"] = [{"email": attendee_email}]

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"https://www.googleapis.com/calendar/v3/calendars/{self.calendar_id}/events",
                headers={"Authorization": f"Bearer {token}"},
                json=event,
            )
            return resp.json()

    async def _get_access_token(self) -> str:
        if self._cached_token and time.time() < self._token_expires:
            return self._cached_token

        import jwt as pyjwt

        if settings.google_service_account_path:
            with open(settings.google_service_account_path) as f:
                creds = json.load(f)
        elif settings.google_service_account_json:
            creds = json.loads(settings.google_service_account_json)
        else:
            raise ValueError("No Google service account credentials configured")
        now = int(time.time())
        payload = {
            "iss": creds["client_email"],
            "scope": "https://www.googleapis.com/auth/calendar",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600,
        }
        signed = pyjwt.encode(payload, creds["private_key"], algorithm="RS256")

        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                "https://oauth2.googleapis.com/token",
                data={
                    "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
                    "assertion": signed,
                },
            )
            data = resp.json()
            self._cached_token = data["access_token"]
            self._token_expires = now + 3500
            return self._cached_token


gcal = GoogleCalendar()
