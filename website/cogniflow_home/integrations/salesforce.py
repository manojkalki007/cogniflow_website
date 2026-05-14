"""
Salesforce CRM integration.
Mirrors the HubSpot integration pattern:
- Before call: pull contact/lead/opportunity data
- After call: create Task/Activity record with summary
"""

import logging
import re
from datetime import datetime, timezone

import httpx

from cogniflow_home.config import settings
from cogniflow_home.events import bus

logger = logging.getLogger(__name__)

SFDC_BASE = "https://login.salesforce.com"


class SalesforceIntegration:
    def __init__(self):
        self.access_token = None
        self.instance_url = None

    def _sanitize_phone(self, phone: str) -> str:
        return re.sub(r"[^\d+\s\-()]", "", phone or "")

    async def authenticate(self):
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                f"{SFDC_BASE}/services/oauth2/token",
                data={
                    "grant_type": "password",
                    "client_id": settings.salesforce_client_id,
                    "client_secret": settings.salesforce_client_secret,
                    "username": settings.salesforce_username,
                    "password": settings.salesforce_password,
                },
            )
            data = resp.json()
            self.access_token = data["access_token"]
            self.instance_url = data["instance_url"]

    async def _api(self, method: str, path: str, **kwargs) -> dict:
        if not self.access_token:
            await self.authenticate()
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.request(
                method,
                f"{self.instance_url}/services/data/v59.0{path}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                **kwargs,
            )
            if resp.status_code == 401:
                await self.authenticate()
                resp = await client.request(
                    method,
                    f"{self.instance_url}/services/data/v59.0{path}",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    timeout=10.0,
                    **kwargs,
                )
            return resp.json()

    async def find_contact(self, phone: str) -> dict | None:
        clean_phone = self._sanitize_phone(phone)
        if not clean_phone:
            return None
        safe = clean_phone.replace("'", "\\'")
        query = (
            f"SELECT Id, Name, Email, Phone, AccountId, Account.Name, Title "
            f"FROM Contact WHERE Phone = '{safe}' OR MobilePhone = '{safe}' "
            f"LIMIT 1"
        )
        result = await self._api("GET", "/query", params={"q": query})
        records = result.get("records", [])
        return records[0] if records else None

    async def find_lead(self, phone: str) -> dict | None:
        clean_phone = self._sanitize_phone(phone)
        if not clean_phone:
            return None
        safe = clean_phone.replace("'", "\\'")
        query = (
            f"SELECT Id, Name, Email, Phone, Company, Status "
            f"FROM Lead WHERE Phone = '{safe}' OR MobilePhone = '{safe}' "
            f"LIMIT 1"
        )
        result = await self._api("GET", "/query", params={"q": query})
        records = result.get("records", [])
        return records[0] if records else None

    async def create_task(
        self,
        who_id: str,
        subject: str,
        description: str,
        status: str = "Completed",
    ) -> dict:
        return await self._api("POST", "/sobjects/Task", json={
            "WhoId": who_id,
            "Subject": subject,
            "Description": description,
            "Status": status,
            "Type": "Call",
            "ActivityDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        })

    async def create_lead(self, phone: str, name: str = None, company: str = None) -> dict:
        return await self._api("POST", "/sobjects/Lead", json={
            "Phone": phone,
            "LastName": name or "Unknown Caller",
            "Company": company or "Unknown",
            "LeadSource": "AI Phone Call",
        })


sfdc = SalesforceIntegration()


def register():
    if settings.salesforce_client_id:
        bus.on("call.completed", _on_call_completed)
        logger.info("Salesforce integration registered")


async def _on_call_completed(event: str, data: dict):
    phone = data.get("caller_number")
    summary = data.get("summary", "AI call completed")

    if not phone:
        return

    try:
        contact = await sfdc.find_contact(phone)
        if contact:
            await sfdc.create_task(
                contact["Id"],
                f"AI Call — {data.get('disposition', 'completed')}",
                summary,
            )
            return

        lead = await sfdc.find_lead(phone)
        if lead:
            await sfdc.create_task(
                lead["Id"],
                f"AI Call — {data.get('disposition', 'completed')}",
                summary,
            )
            return

        await sfdc.create_lead(phone)

    except Exception as e:
        logger.exception(f"Salesforce sync failed: {e}")
