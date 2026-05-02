"""Tenant-aware database operations.

Wraps SupabaseClient to auto-inject tenant_id into queries.
Use TenantDB(tenant_id) for all tenant-scoped operations.
"""

import logging
from typing import Any

from cogniflow_home.db.supabase import db

logger = logging.getLogger("cogniflow_home.db.tenant")

TENANT_TABLES = {
    "calls", "contacts", "agents", "campaigns",
    "webhook_endpoints", "dnc_list", "appointments", "benchmarks",
}


class TenantDB:
    """Database client that auto-scopes all queries to a tenant."""

    def __init__(self, tenant_id: str):
        self.tenant_id = tenant_id

    def _inject(self, data: dict) -> dict:
        return {**data, "tenant_id": self.tenant_id}

    def _scope(self, match: dict | None) -> dict:
        m = dict(match) if match else {}
        m["tenant_id"] = self.tenant_id
        return m

    async def insert(self, table: str, data: dict) -> dict | None:
        if table in TENANT_TABLES:
            data = self._inject(data)
        return await db.insert(table, data)

    async def update(self, table: str, match: dict, data: dict) -> dict | None:
        if table in TENANT_TABLES:
            match = self._scope(match)
        return await db.update(table, match, data)

    async def select(self, table: str, match: dict | None = None,
                     select: str = "*", order: str | None = None,
                     limit: int | None = None) -> list[dict]:
        if table in TENANT_TABLES:
            match = self._scope(match)
        return await db.select(table, match, select, order, limit)

    async def delete(self, table: str, match: dict) -> bool:
        if table in TENANT_TABLES:
            match = self._scope(match)
        return await db.delete(table, match)

    async def upsert(self, table: str, data: dict, on_conflict: str = "id") -> dict | None:
        if table in TENANT_TABLES:
            data = self._inject(data)
        return await db.upsert(table, data, on_conflict)

    async def count(self, table: str, match: dict | None = None) -> int:
        if table in TENANT_TABLES:
            match = self._scope(match)
        return await db.count(table, match)

    async def rpc(self, function_name: str, params: dict | None = None) -> Any:
        return await db.rpc(function_name, params)


# Organization management (not tenant-scoped)

async def create_organization(name: str, slug: str, owner_email: str, plan: str = "starter") -> dict | None:
    org = await db.insert("organizations", {
        "name": name,
        "slug": slug,
        "owner_email": owner_email,
        "plan": plan,
    })
    if org:
        await db.insert("org_members", {
            "org_id": org["id"],
            "email": owner_email,
            "role": "owner",
        })
    return org


async def get_organization(org_id: str) -> dict | None:
    orgs = await db.select("organizations", {"id": org_id}, limit=1)
    return orgs[0] if orgs else None


async def get_organization_by_slug(slug: str) -> dict | None:
    orgs = await db.select("organizations", {"slug": slug}, limit=1)
    return orgs[0] if orgs else None


async def get_organization_by_api_key(api_key: str) -> dict | None:
    orgs = await db.select("organizations", {"api_key": api_key, "is_active": True}, limit=1)
    return orgs[0] if orgs else None


async def list_organizations(email: str | None = None) -> list[dict]:
    if email:
        members = await db.select("org_members", {"email": email})
        if not members:
            return []
        org_ids = [m["org_id"] for m in members]
        orgs = []
        for oid in org_ids:
            o = await get_organization(oid)
            if o:
                orgs.append(o)
        return orgs
    return await db.select("organizations", order="created_at.desc")


async def add_member(org_id: str, email: str, role: str = "member") -> dict | None:
    return await db.insert("org_members", {
        "org_id": org_id,
        "email": email,
        "role": role,
    })


async def get_members(org_id: str) -> list[dict]:
    return await db.select("org_members", {"org_id": org_id})


async def remove_member(org_id: str, email: str) -> bool:
    members = await db.select("org_members", {"org_id": org_id, "email": email}, limit=1)
    if members:
        return await db.delete("org_members", {"id": members[0]["id"]})
    return False
