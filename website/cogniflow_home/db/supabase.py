"""Supabase database client."""

import logging
from typing import Any

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.db")


class SupabaseClient:
    def __init__(self):
        self.url = settings.supabase_url.rstrip("/")
        self.key = settings.supabase_key
        self._headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation",
        }
        self._client = httpx.AsyncClient(timeout=30.0)

    async def insert(self, table: str, data: dict) -> dict | None:
        url = f"{self.url}/rest/v1/{table}"
        resp = await self._client.post(url, json=data, headers=self._headers)
        if resp.status_code in (200, 201):
            rows = resp.json()
            return rows[0] if rows else None
        logger.error(f"Supabase insert error: {resp.status_code} {resp.text}")
        return None

    async def update(self, table: str, match: dict, data: dict) -> dict | None:
        url = f"{self.url}/rest/v1/{table}"
        params = {f"{k}": f"eq.{v}" for k, v in match.items()}
        resp = await self._client.patch(url, json=data, headers=self._headers, params=params)
        if resp.status_code in (200, 204):
            rows = resp.json() if resp.text else []
            return rows[0] if rows else None
        logger.error(f"Supabase update error: {resp.status_code} {resp.text}")
        return None

    async def select(self, table: str, match: dict | None = None, select: str = "*",
                     order: str | None = None, limit: int | None = None) -> list[dict]:
        url = f"{self.url}/rest/v1/{table}"
        params: dict[str, Any] = {"select": select}
        if match:
            for k, v in match.items():
                if isinstance(v, str) and v.startswith(("eq.", "gte.", "lte.", "gt.", "lt.", "neq.")):
                    params[k] = v
                else:
                    params[k] = f"eq.{v}"
        if order:
            params["order"] = order
        if limit:
            params["limit"] = str(limit)
        resp = await self._client.get(url, headers=self._headers, params=params)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"Supabase select error: {resp.status_code} {resp.text}")
        return []

    async def upsert(self, table: str, data: dict, on_conflict: str = "id") -> dict | None:
        url = f"{self.url}/rest/v1/{table}"
        headers = {**self._headers, "Prefer": "resolution=merge-duplicates,return=representation"}
        resp = await self._client.post(url, json=data, headers=headers)
        if resp.status_code in (200, 201):
            rows = resp.json()
            return rows[0] if rows else None
        logger.error(f"Supabase upsert error: {resp.status_code} {resp.text}")
        return None

    async def rpc(self, function_name: str, params: dict | None = None) -> Any:
        url = f"{self.url}/rest/v1/rpc/{function_name}"
        resp = await self._client.post(url, json=params or {}, headers=self._headers)
        if resp.status_code == 200:
            return resp.json()
        logger.error(f"Supabase RPC error: {resp.status_code} {resp.text}")
        return None

    async def count(self, table: str, match: dict | None = None) -> int:
        url = f"{self.url}/rest/v1/{table}"
        headers = {
            **self._headers,
            "Prefer": "count=exact",
            "Range-Unit": "items",
            "Range": "0-0",
        }
        params: dict[str, Any] = {"select": "id"}
        if match:
            for k, v in match.items():
                if isinstance(v, str) and v.startswith(("eq.", "gte.", "lte.", "gt.", "lt.", "neq.")):
                    params[k] = v
                else:
                    params[k] = f"eq.{v}"
        resp = await self._client.get(url, headers=headers, params=params)
        content_range = resp.headers.get("Content-Range", "")
        if "/" in content_range:
            try:
                return int(content_range.split("/")[1])
            except (ValueError, IndexError):
                pass
        return 0

    async def delete(self, table: str, match: dict) -> bool:
        url = f"{self.url}/rest/v1/{table}"
        params = {}
        for k, v in match.items():
            if isinstance(v, str) and v.startswith(("eq.", "gte.", "lte.", "gt.", "lt.", "neq.")):
                params[k] = v
            else:
                params[k] = f"eq.{v}"
        resp = await self._client.delete(url, headers=self._headers, params=params)
        if resp.status_code in (200, 204):
            return True
        logger.error(f"Supabase delete error: {resp.status_code} {resp.text}")
        return False

    async def close(self):
        await self._client.aclose()


db = SupabaseClient()
