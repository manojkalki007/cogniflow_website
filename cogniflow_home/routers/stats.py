"""Dashboard stats, analytics trends, and agent comparison."""

import logging

from fastapi import APIRouter, Depends

from cogniflow_home.db.supabase import db
from cogniflow_home.state import active_calls, call_state
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["stats"])


@router.get("/api/stats")
async def get_stats(auth: AuthContext = Depends(get_auth_context)):
    from datetime import date

    today_iso = date.today().isoformat()
    match = {"created_at": f"gte.{today_iso}T00:00:00"}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    today_calls = await db.select("calls", match, order="created_at.desc", limit=500)

    today_total = len(today_calls)
    durations = [c.get("duration_seconds", 0) for c in today_calls if c.get("duration_seconds")]
    avg_duration = sum(durations) / len(durations) if durations else 0

    count_match = {}
    if auth.tenant_id:
        count_match["tenant_id"] = auth.tenant_id
    all_time_count = await db.count("calls", count_match or None)

    return {
        "today": {
            "total_calls": today_total,
            "inbound": 0,
            "outbound": today_total,
            "avg_duration_seconds": round(avg_duration),
        },
        "all_time": {
            "total_calls": all_time_count,
        },
        "active_calls": await call_state.get_active_count(),
    }


@router.get("/api/analytics/trends")
async def api_analytics_trends(days: int = 30, auth: AuthContext = Depends(get_auth_context)):
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()
    match = {"created_at": f"gte.{cutoff}"}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    calls = await db.select("calls", match, order="created_at.asc", limit=5000)
    daily = {}
    for c in calls:
        day = (c.get("created_at") or "")[:10]
        if not day:
            continue
        if day not in daily:
            daily[day] = {"date": day, "total": 0, "durations": []}
        daily[day]["total"] += 1
        if c.get("duration_seconds"):
            daily[day]["durations"].append(c["duration_seconds"])
    trends = []
    for day, d in sorted(daily.items()):
        trends.append({
            "date": day,
            "total": d["total"],
            "inbound": 0,
            "outbound": d["total"],
            "avg_duration": round(sum(d["durations"]) / len(d["durations"]), 1) if d["durations"] else 0,
            "avg_sentiment": 0,
            "conversion_rate": 0,
        })
    return {"trends": trends}


@router.get("/api/analytics/agents")
async def api_analytics_agents(days: int = 30, auth: AuthContext = Depends(get_auth_context)):
    from cogniflow_home.agents import list_agents
    from datetime import date, timedelta

    if auth.tenant_id:
        agents = await list_agents(tenant_id=auth.tenant_id)
    else:
        agents = await list_agents()
    if not agents:
        return {"agents": []}

    cutoff = (date.today() - timedelta(days=days)).isoformat()
    calls_match = {"created_at": f"gte.{cutoff}T00:00:00"}
    if auth.tenant_id:
        calls_match["tenant_id"] = auth.tenant_id
    all_calls = await db.select("calls", calls_match, limit=5000)

    agent_calls: dict[str, list] = {}
    for c in all_calls:
        aid = str(c.get("agent_id", ""))
        if aid not in agent_calls:
            agent_calls[aid] = []
        agent_calls[aid].append(c)

    results = []
    for agent in agents:
        aid = str(agent.get("id", ""))
        calls = agent_calls.get(aid, [])
        total = len(calls)
        durations = [c.get("duration_seconds", 0) for c in calls if c.get("duration_seconds")]
        results.append({
            "agent_id": aid,
            "agent_name": agent.get("name", "Unknown"),
            "total_calls": total,
            "avg_duration": round(sum(durations) / len(durations), 1) if durations else 0,
            "avg_sentiment": 0,
            "conversion_rate": 0,
        })
    return {"agents": results}
