"""Contacts CRUD, import (CSV and mapped), and delete."""

import csv
import io
import json
import logging

from fastapi import APIRouter, Depends, Request

from cogniflow_home.db.supabase import db
from cogniflow_home.state import valid_uuid
from cogniflow_home.tenants.auth import AuthContext, get_auth_context

logger = logging.getLogger("cogniflow_home")

router = APIRouter(tags=["contacts"])

TABLE = "Contact"


def _to_api(row: dict) -> dict:
    """Map Prisma camelCase DB row to API-friendly snake_case."""
    if not row:
        return row
    meta = row.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}
    return {
        "id": row.get("id"),
        "phone_number": row.get("phoneNumber", ""),
        "name": row.get("name", ""),
        "email": row.get("email", ""),
        "company": meta.get("company", ""),
        "notes": meta.get("notes", ""),
        "tags": meta.get("tags", []),
        "tenant_id": row.get("organizationId", ""),
        "created_at": row.get("createdAt"),
        "updated_at": row.get("updatedAt"),
    }


def _to_db(data: dict, tenant_id: str = "") -> dict:
    """Map API-friendly fields to Prisma DB columns."""
    row = {}
    if "phone_number" in data:
        row["phoneNumber"] = data["phone_number"]
    if "name" in data:
        row["name"] = data["name"]
    if "email" in data:
        row["email"] = data["email"]

    meta = {}
    for field in ("company", "notes", "tags", "language"):
        if field in data:
            meta[field] = data[field]
    if meta:
        row["metadata"] = json.dumps(meta)

    if tenant_id:
        row["organizationId"] = tenant_id
    return row


@router.get("/api/contacts")
async def list_contacts(limit: int = 50, search: str | None = None, auth: AuthContext = Depends(get_auth_context)):
    match = {}
    if auth.tenant_id:
        match["organizationId"] = auth.tenant_id
    contacts = await db.select(TABLE, match or None, order="createdAt.desc", limit=limit)
    result = [_to_api(c) for c in contacts]
    if search:
        q = search.lower()
        result = [c for c in result if
                  q in (c.get("name") or "").lower() or
                  q in (c.get("phone_number") or "") or
                  q in (c.get("company") or "").lower()]
    return {"contacts": result, "count": len(result)}


@router.get("/api/contacts/{contact_id}")
async def get_contact(contact_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    match = {"id": contact_id}
    if auth.tenant_id:
        match["organizationId"] = auth.tenant_id
    contacts = await db.select(TABLE, match)
    if not contacts:
        return {"error": "Contact not found"}
    contact = _to_api(contacts[0])
    phone = contacts[0].get("phoneNumber", "")
    if phone:
        calls_match = {"phone_number": phone}
        if auth.tenant_id:
            calls_match["tenant_id"] = auth.tenant_id
        calls = await db.select("calls", calls_match, order="created_at.desc", limit=20)
        contact["calls"] = calls
    else:
        contact["calls"] = []
    return contact


@router.patch("/api/contacts/{contact_id}")
async def update_contact(contact_id: str, request: Request, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    body = await request.json()
    allowed = {"name", "email", "company", "notes", "language", "tags"}
    filtered = {k: v for k, v in body.items() if k in allowed}
    if not filtered:
        return {"error": "No valid fields to update"}

    match = {"id": contact_id}
    if auth.tenant_id:
        match["organizationId"] = auth.tenant_id

    existing = await db.select(TABLE, match)
    if not existing:
        return {"error": "Contact not found"}

    updates = {}
    if "name" in filtered:
        updates["name"] = filtered["name"]
    if "email" in filtered:
        updates["email"] = filtered["email"]

    meta_fields = {k: v for k, v in filtered.items() if k in ("company", "notes", "tags", "language")}
    if meta_fields:
        old_meta = existing[0].get("metadata") or {}
        if isinstance(old_meta, str):
            try:
                old_meta = json.loads(old_meta)
            except Exception:
                old_meta = {}
        old_meta.update(meta_fields)
        updates["metadata"] = json.dumps(old_meta)

    if not updates:
        return {"error": "No valid fields to update"}

    result = await db.update(TABLE, match, updates)
    return _to_api(result) if result else {"error": "Contact not found"}


@router.post("/api/contacts")
async def create_contact(request: Request, auth: AuthContext = Depends(get_auth_context)):
    body = await request.json()
    phone = body.get("phone_number", "").strip()
    if not phone:
        return {"error": "phone_number is required"}
    if not phone.startswith("+"):
        phone = f"+{phone}"

    match = {"phoneNumber": phone}
    if auth.tenant_id:
        match["organizationId"] = auth.tenant_id
    existing = await db.select(TABLE, match)
    if existing:
        return {"error": "Contact with this phone number already exists", "existing": _to_api(existing[0])}

    row = _to_db(body, auth.tenant_id)
    row["phoneNumber"] = phone
    result = await db.insert(TABLE, row)
    return _to_api(result) if result else {"error": "Failed to create contact"}


@router.delete("/api/contacts/{contact_id}")
async def delete_contact(contact_id: str, auth: AuthContext = Depends(get_auth_context)):
    if not valid_uuid(contact_id):
        return {"error": "Invalid contact ID format"}
    match = {"id": contact_id}
    if auth.tenant_id:
        match["organizationId"] = auth.tenant_id
    result = await db.delete(TABLE, match)
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
            "phoneNumber": phone,
            "name": (row.get("name") or "").strip() or None,
            "email": (row.get("email") or "").strip() or None,
        }
        meta = {}
        if row.get("company"):
            meta["company"] = row["company"].strip()
        if meta:
            contact_data["metadata"] = json.dumps(meta)
        if auth.tenant_id:
            contact_data["organizationId"] = auth.tenant_id
        result = await db.upsert(TABLE, contact_data)
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
    for item in contacts_data:
        phone = (item.get("phone_number") or "").strip()
        if not phone:
            continue
        if not phone.startswith("+"):
            phone = f"+{phone}"
        dup_match = {"phoneNumber": phone}
        if auth.tenant_id:
            dup_match["organizationId"] = auth.tenant_id
        existing = await db.select(TABLE, dup_match)
        if existing:
            duplicates += 1
            continue
        row = _to_db(item, auth.tenant_id)
        row["phoneNumber"] = phone
        await db.insert(TABLE, row)
        imported += 1
    return {"imported": imported, "duplicates": duplicates, "total": len(contacts_data)}
