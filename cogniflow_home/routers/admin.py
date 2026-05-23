"""Admin-only tenant management and billing overview."""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from cogniflow_home.db.supabase import db
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

router = APIRouter(tags=["admin"])


class CreateTenantRequest(BaseModel):
    name: str
    email: str
    plan: str = "starter"
    phone: str = ""


class UpdateTenantRequest(BaseModel):
    plan: Optional[str] = None
    status: Optional[str] = None
    monthly_minutes_limit: Optional[int] = None
    max_agents: Optional[int] = None
    max_concurrent_calls: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None


class AssignAgentRequest(BaseModel):
    tenant_id: str


@router.post("/admin/tenants")
async def admin_create_tenant(body: CreateTenantRequest, auth: AuthContext = Depends(get_auth_context)):
    if not auth.is_admin:
        raise HTTPException(403, "Admin only")
    from cogniflow_home.tenants.manager import create_tenant
    result = await create_tenant(
        name=body.name,
        email=body.email,
        plan=body.plan,
        phone=body.phone,
    )
    return result


@router.get("/admin/tenants")
async def admin_list_tenants(auth: AuthContext = Depends(get_auth_context)):
    if not auth.is_admin:
        raise HTTPException(403, "Admin only")
    tenants = await db.select("tenants", order="created_at.desc", limit=200)
    return {"tenants": tenants}


@router.get("/admin/tenants/{tenant_id}")
async def admin_get_tenant(tenant_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not auth.is_admin:
        raise HTTPException(403, "Admin only")
    rows = await db.select("tenants", {"id": tenant_id})
    if not rows:
        raise HTTPException(404, "Tenant not found")
    return rows[0]


@router.patch("/admin/tenants/{tenant_id}")
async def admin_update_tenant(tenant_id: str, body: UpdateTenantRequest, auth: AuthContext = Depends(get_auth_context)):
    if not auth.is_admin:
        raise HTTPException(403, "Admin only")
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(400, "No fields to update")
    await db.update("tenants", {"id": tenant_id}, updates)
    return {"ok": True}


@router.post("/admin/tenants/{tenant_id}/suspend")
async def admin_suspend_tenant(tenant_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not auth.is_admin:
        raise HTTPException(403, "Admin only")
    await db.update("tenants", {"id": tenant_id}, {"status": "suspended"})
    return {"ok": True}


@router.get("/admin/billing")
async def admin_billing_overview(auth: AuthContext = Depends(get_auth_context)):
    if not auth.is_admin:
        raise HTTPException(403, "Admin only")
    from cogniflow_home.tenants.billing import get_all_tenants_summary
    summaries = await get_all_tenants_summary()
    total_revenue = sum(s.get("total_bill_paise", 0) for s in summaries)
    total_cost = sum(s.get("infrastructure_cost_paise", 0) for s in summaries)
    return {
        "month": summaries[0]["month"] if summaries else "",
        "total_tenants": len(summaries),
        "total_revenue_paise": total_revenue,
        "total_cost_paise": total_cost,
        "total_margin_paise": total_revenue - total_cost,
        "tenants": summaries,
    }


@router.post("/admin/agents/{agent_id}/assign")
async def admin_assign_agent(agent_id: str, body: AssignAgentRequest, auth: AuthContext = Depends(get_auth_context)):
    if not auth.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    target_tenant_id = body.tenant_id
    from cogniflow_home.state import valid_uuid
    if not target_tenant_id or not valid_uuid(target_tenant_id):
        raise HTTPException(status_code=400, detail="Valid tenant_id is required")
    tenant_rows = await db.select("tenants", {"id": target_tenant_id})
    if not tenant_rows:
        raise HTTPException(status_code=404, detail="Target tenant not found")
    from cogniflow_home.agents import update_agent
    from cogniflow_home.routers.agents import _unpack_agent
    from fastapi.responses import JSONResponse
    result = await update_agent(agent_id, {"tenant_id": target_tenant_id})
    return _unpack_agent(result) if result else JSONResponse({"error": "Agent not found"}, status_code=404)
