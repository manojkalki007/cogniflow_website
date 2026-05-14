"""Billing summary and usage reporting per tenant."""

from cogniflow_home.db.supabase import db


async def get_billing_summary(tenant_id: str, month: str = None) -> dict:
    """Return full billing summary for a tenant for a given month.
    month format: "2026-05" (defaults to current month)."""
    from datetime import date
    if not month:
        month = date.today().strftime("%Y-%m")

    records = await db.select(
        "usage_records",
        {"tenant_id": tenant_id, "billing_month": month},
        limit=10000,
    )

    tenant_rows = await db.select("tenants", {"id": tenant_id})
    if not tenant_rows:
        return {"error": "Tenant not found"}
    tenant = tenant_rows[0]

    plan_rows = await db.select("plans", {"id": tenant["plan"]})
    plan_data = plan_rows[0] if plan_rows else {}

    total_minutes = sum(r.get("duration_seconds", 0) for r in records) / 60
    total_cost_paise = sum(r.get("total_cost_paise", 0) for r in records)
    included_minutes = plan_data.get("included_minutes", 500)
    overage_minutes = max(0, total_minutes - included_minutes)
    overage_cost = int(overage_minutes * plan_data.get("price_per_extra_minute_paise", 1500))

    breakdown = {
        "stt_paise": sum(r.get("stt_cost_paise", 0) for r in records),
        "llm_paise": sum(r.get("llm_cost_paise", 0) for r in records),
        "tts_paise": sum(r.get("tts_cost_paise", 0) for r in records),
        "tel_paise": sum(r.get("tel_cost_paise", 0) for r in records),
    }

    monthly_fee = plan_data.get("monthly_fee_paise", 0)

    return {
        "month": month,
        "tenant_id": tenant_id,
        "tenant_name": tenant["name"],
        "plan": tenant["plan"],
        "plan_monthly_fee_paise": monthly_fee,
        "included_minutes": included_minutes,
        "used_minutes": round(total_minutes, 1),
        "overage_minutes": round(overage_minutes, 1),
        "overage_cost_paise": overage_cost,
        "infrastructure_cost_paise": total_cost_paise,
        "total_bill_paise": monthly_fee + overage_cost,
        "margin_paise": monthly_fee + overage_cost - total_cost_paise,
        "total_calls": len(records),
        "component_breakdown": breakdown,
        "usage_percentage": round(total_minutes / max(included_minutes, 1) * 100, 1),
    }


async def get_all_tenants_summary() -> list[dict]:
    """Master view — all tenants, current month billing."""
    from datetime import date
    month = date.today().strftime("%Y-%m")
    tenants = await db.select("tenants", order="created_at.desc", limit=500)
    results = []
    for t in tenants:
        summary = await get_billing_summary(t["id"], month)
        results.append(summary)
    return results
