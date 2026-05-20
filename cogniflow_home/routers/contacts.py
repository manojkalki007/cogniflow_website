"""Contacts CRUD, import (CSV and mapped), and delete."""

import csv
import io
import logging

from fastapi import APIRouter, Depends, Request

from cogniflow_home.db.supabase import db
from cogniflow_home.state import valid_uuid
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["contacts"])


@router.get("/api/contacts")
async def list_contacts(limit: int = 50, search: str | None = None, auth: AuthContext = Depends(get_auth_context)):
    match = {}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    contacts = await db.select("contacts", match or None, order="last_call_at.desc.nullslast", limit=limit)
    if search:
        search_lower = search.lower()
        contacts = [c for c in contacts if
                    search_lower in (c.get("name") or "").lower() or
                    search_lower in (c.get("phone_number") or "") or
                    search_lower in (c.get("company") or "").lower()]
    return {"contacts": contacts, "count": len(contacts)}


@router.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    match = {"id": contact_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    contacts = await db.select("contacts", match)
    if not contacts:
        return {"error": "Contact not found"}
    contact = contacts[0]
    calls = await db.select("calls", {"caller_number": contact["phone_number"]},
                            order="created_at.desc", limit=20)
    contact["calls"] = calls
    return contact


@router.patch("/api/contacts/{contact_id}")
async def update_contact(contact_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    body = await request.json()
    allowed = {"name", "email", "company", "notes", "language", "tags"}
    updates = {k: v for k, v in body.items() if k in allowed}
    if not updates:
        return {"error": "No valid fields to update"}
    match = {"id": contact_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    result = await db.update("contacts", match, updates)
    return result or {"error": "Contact not found"}


@router.post("/api/contacts")
async def create_contact(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    phone = body.get("phone_number", "").strip()
    if not phone:
        return {"error": "phone_number is required"}
    if not phone.startswith("+"):
        phone = f"+{phone}"
    match = {"phone_number": phone}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    existing = await db.select("contacts", match)
    if existing:
        return {"error": "Contact with this phone number already exists", "existing": existing[0]}
    contact = {
        "phone_number": phone,
        "name": body.get("name", "").strip(),
        "email": body.get("email", "").strip(),
        "company": body.get("company", "").strip(),
        "notes": body.get("notes", ""),
        "tags": body.get("tags", []),
    }
    if auth.tenant_id:
        contact["tenant_id"] = auth.tenant_id
    result = await db.insert("contacts", contact)
    return result or {"error": "Failed to create contact"}


@router.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    match = {"id": contact_id}
    if auth.tenant_id:
        match["tenant_id"] = auth.tenant_id
    result = await db.delete("contacts", match)
    return {"status": "deleted"} if result else {"error": "Contact not found"}


@router.post("/api/contacts/import")
async def import_contacts(request: Request, auth: AuthContext = Depends(get_auth_context)):
    form = await request.form()
    file = form.get("file")
    if not file:
        return {"error": "file is required"}
    content = (await file.read()).decode("utf-8")
    if len(content) > 5_000_000:
        return {"error": "File too large. Maximum 5MB."}
    reader = csv.DictReader(io.StringIO(content))
    imported = 0
    skipped = 0
    for row in reader:
        phone = (row.get("phone") or row.get("phone_number") or "").strip()
        if not phone:
            continue
        if not phone.startswith("+"):
            phone = f"+{phone}"
        contact_data = {
            "phone_number": phone,
            "name": (row.get("name") or "").strip() or None,
            "email": (row.get("email") or "").strip() or None,
            "company": (row.get("company") or "").strip() or None,
        }
        if auth.tenant_id:
            contact_data["tenant_id"] = auth.tenant_id
        result = await db.upsert("contacts", contact_data)
        if result:
            imported += 1
        else:
            skipped += 1
    return {"imported": imported, "skipped": skipped}


@router.post("/api/contacts/import-mapped")
async def import_contacts_mapped(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    contacts_data = body.get("contacts", [])
    if not contacts_data:
        return {"error": "contacts array is required"}
    imported = 0
    duplicates = 0
    for row in contacts_data:
        phone = (row.get("phone_number") or "").strip()
        if not phone:
            continue
        if not phone.startswith("+"):
            phone = f"+{phone}"
        dup_match = {"phone_number": phone}
        if auth.tenant_id:
            dup_match["tenant_id"] = auth.tenant_id
        existing = await db.select("contacts", dup_match)
        if existing:
            duplicates += 1
            continue
        contact_row = {
            "phone_number": phone,
            "name": (row.get("name") or "").strip(),
            "email": (row.get("email") or "").strip(),
            "company": (row.get("company") or "").strip(),
            "tags": row.get("tags", []),
            "notes": row.get("notes", ""),
        }
        if auth.tenant_id:
            contact_row["tenant_id"] = auth.tenant_id
        await db.insert("contacts", contact_row)
        imported += 1
    return {"imported": imported, "duplicates": duplicates, "total": len(contacts_data)}
