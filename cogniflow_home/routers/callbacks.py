"""Callback scheduling — list, update, and manage pending callbacks."""

import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from cogniflow_home.db.supabase import db
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home.callbacks")

router = APIRouter(tags=["callbacks"])


@router.get("/api/callbacks")
async def list_callbacks(request: Request, auth: AuthContext = Depends(get_auth_context)):
    status = request.query_params.get("status")
    match = {}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    if status:
        match["status"] = status
    rows = await db.select("callbacks", match or None, order="created_at.desc", limit=100)
    return {"callbacks": rows}


@router.get("/api/callbacks/{callback_id}")
async def get_callback(callback_id: str, auth: AuthContext = Depends(get_auth_context)):
    match = {"id": callback_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    rows = await db.select("callbacks", match)
    if not rows:
        return JSONResponse({"error": "Callback not found"}, status_code=404)
    return rows[0]


@router.patch("/api/callbacks/{callback_id}")
async def update_callback(callback_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    allowed = {"status", "callback_time", "notes", "attempted_at", "completed_at"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return JSONResponse({"error": "No valid fields to update"}, status_code=400)
    match = {"id": callback_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    result = await db.update("callbacks", match, updates)
    if result is None:
        return JSONResponse({"error": "Callback not found or update failed"}, status_code=404)
    return result


@router.delete("/api/callbacks/{callback_id}")
async def cancel_callback(callback_id: str, auth: AuthContext = Depends(get_auth_context)):
    match = {"id": callback_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    result = await db.update("callbacks", match, {"status": "cancelled"})
    if result is None:
        return JSONResponse({"error": "Callback not found"}, status_code=404)
    return {"status": "cancelled", "id": callback_id}
