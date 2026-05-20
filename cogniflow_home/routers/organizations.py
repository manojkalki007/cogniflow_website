"""Multi-tenant organization management and member CRUD."""

import re

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from cogniflow_home.state import valid_uuid
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

router = APIRouter(tags=["organizations"])


@router.post("/api/organizations")
async def api_create_organization(request: Request, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import create_organization
    body = await request.json()
    name = body.get("name", "").strip()
    slug = body.get("slug", "").strip().lower()
    owner_email = body.get("owner_email", "").strip()
    plan = body.get("plan", "starter")

    if not name or not slug or not owner_email:
        raise HTTPException(400, "name, slug, and owner_email are required")
    if not re.match(r'^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$', slug):
        raise HTTPException(400, "slug must be 3-50 lowercase alphanumeric with hyphens")

    from cogniflow_home.db.tenant import get_organization_by_slug
    existing = await get_organization_by_slug(slug)
    if existing:
        raise HTTPException(409, "Organization slug already exists")

    org = await create_organization(name, slug, owner_email, plan)
    if not org:
        raise HTTPException(500, "Failed to create organization")
    return org


@router.get("/api/organizations")
async def api_list_organizations(email: str = "", auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import list_organizations
    return await list_organizations(email or None)


@router.get("/api/organizations/{org_id}")
async def api_get_organization(org_id: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import get_organization
    if not valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    org = await get_organization(org_id)
    if not org:
        raise HTTPException(404, "Organization not found")
    return org


@router.get("/api/organizations/{org_id}/members")
async def api_list_members(org_id: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import get_members
    if not valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    return await get_members(org_id)


@router.post("/api/organizations/{org_id}/members")
async def api_add_member(org_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import add_member
    if not valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    body = await request.json()
    email = body.get("email", "").strip()
    role = body.get("role", "member")
    if not email:
        raise HTTPException(400, "email is required")
    if role not in ("owner", "admin", "member", "viewer"):
        raise HTTPException(400, "role must be owner, admin, member, or viewer")
    member = await add_member(org_id, email, role)
    if not member:
        raise HTTPException(500, "Failed to add member")
    return member


@router.delete("/api/organizations/{org_id}/members/{email}")
async def api_remove_member(org_id: str, email: str, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.db.tenant import remove_member
    if not valid_uuid(org_id):
        raise HTTPException(400, "Invalid org ID")
    removed = await remove_member(org_id, email)
    if not removed:
        raise HTTPException(404, "Member not found")
    return {"status": "removed"}


async def resolve_tenant(x_tenant_id: str = Header(default=""), x_api_key: str = Header(default="")):
    if x_tenant_id and valid_uuid(x_tenant_id):
        from cogniflow_home.db.tenant import get_organization
        org = await get_organization(x_tenant_id)
        if org and org.get("is_active"):
            return org
    if x_api_key:
        from cogniflow_home.db.tenant import get_organization_by_api_key
        org = await get_organization_by_api_key(x_api_key)
        if org:
            return org
    return None
