"""Auto-send booking confirmations via email and WhatsApp.

Listens to appointment.booked and followup.scheduled events.
Sends confirmations automatically — no manual action needed.
"""

import logging
from typing import Any

from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus
from cogniflow_home.integrations.email import email_sender

logger = logging.getLogger("cogniflow_home.notifications")


async def _get_contact_email(phone: str) -> str | None:
    if not phone:
        return None
    contacts = await db.select("contacts", {"phone_number": phone}, select="email,name", limit=1)
    if contacts and contacts[0].get("email"):
        return contacts[0]["email"]
    return None


async def _get_contact_name(phone: str) -> str:
    if not phone:
        return ""
    contacts = await db.select("contacts", {"phone_number": phone}, select="name", limit=1)
    if contacts and contacts[0].get("name"):
        return contacts[0]["name"]
    return ""


async def _send_whatsapp_confirmation(phone: str, name: str, date: str, time: str,
                                      tenant_id: str = ""):
    try:
        from cogniflow_home.whatsapp.tool import WhatsAppTool, get_whatsapp
        wa = await get_whatsapp(tenant_id) if tenant_id else WhatsAppTool()
        try:
            await wa.send_template(
                to_phone=phone,
                template_name="appointment_confirmation",
                parameters=[name, date, time],
            )
            logger.info(f"WhatsApp booking confirmation sent to {phone}")
        finally:
            await wa.close()
    except Exception:
        logger.exception(f"WhatsApp confirmation failed for {phone}")


async def on_appointment_booked(event: str, data: dict[str, Any]):
    """Auto-send email + WhatsApp confirmation when an appointment is booked."""
    name = data.get("name", "")
    date = data.get("date", "")
    time = data.get("time", "")
    phone = data.get("phone", "")
    notes = data.get("notes", "")
    email = data.get("email", "")
    tenant_id = data.get("tenant_id", "")

    if not name or not date or not time:
        return

    if not email and phone:
        email = await _get_contact_email(phone)

    # Save to appointments table
    try:
        await db.insert("appointments", {
            "call_id": data.get("call_id"),
            "contact_phone": phone,
            "name": name,
            "date": date,
            "time": time,
            "notes": notes,
            "status": "confirmed",
        })
    except Exception:
        logger.debug("Appointment insert failed (may already exist)")

    # Send email confirmation
    if email:
        sent = await email_sender.send_booking_confirmation(
            to_email=email,
            name=name,
            date=date,
            time=time,
            notes=notes,
            tenant_id=tenant_id,
        )
        if sent:
            logger.info(f"Booking email sent to {email} for {name}")
    else:
        logger.debug(f"No email for {phone} — skipping email confirmation")

    # Send WhatsApp confirmation
    if phone:
        await _send_whatsapp_confirmation(phone, name, date, time, tenant_id=tenant_id)


async def on_followup_scheduled(event: str, data: dict[str, Any]):
    """Handle scheduled follow-ups — send email or WhatsApp."""
    action = data.get("action_type", "")
    details = data.get("details", "")
    phone = data.get("caller_number", "")
    when = data.get("when", "immediately")
    tenant_id = data.get("tenant_id", "")

    if action == "email":
        email = await _get_contact_email(phone)
        name = await _get_contact_name(phone) or "there"
        if email:
            await email_sender.send_followup(
                to_email=email,
                name=name,
                details=details,
                tenant_id=tenant_id,
            )
            logger.info(f"Follow-up email sent to {email}")
        else:
            logger.warning(f"No email found for {phone} — follow-up email not sent")

    elif action == "sms":
        logger.info(f"SMS follow-up scheduled for {phone}: {details}")

    elif action == "callback":
        logger.info(f"Callback scheduled for {phone}: {details} ({when})")


async def on_call_completed_wa(event: str, data: dict[str, Any]):
    """Send WhatsApp follow-up after a call if the agent has it enabled."""
    phone = data.get("caller_number", "")
    tenant_id = data.get("tenant_id", "")
    agent_id = data.get("agent_id", "")
    if not phone or not tenant_id or not agent_id:
        return

    import json
    agents = await db.select("agents", {"id": agent_id}, limit=1)
    if not agents:
        return
    raw_meta = agents[0].get("metadata") or "{}"
    meta = json.loads(raw_meta) if isinstance(raw_meta, str) else (raw_meta or {})
    ic = meta.get("integration_config", {})
    if not ic.get("enable_wa_post_call_followup"):
        return

    try:
        from cogniflow_home.whatsapp.tool import get_whatsapp
        wa = await get_whatsapp(tenant_id)
        try:
            summary = (data.get("summary") or "our recent conversation")[:100]
            await wa.send_template(
                to_phone=phone,
                template_name="appointment_confirmation",
                parameters=[summary, "follow-up", "soon"],
            )
            logger.info(f"Post-call WhatsApp follow-up sent to {phone}")
        finally:
            await wa.close()
    except Exception:
        logger.debug(f"Post-call WA follow-up failed for {phone}", exc_info=True)


async def on_callback_scheduled_wa(event: str, data: dict[str, Any]):
    """Notify the caller via WhatsApp when a callback is scheduled."""
    phone = data.get("phone_number", "")
    callback_time = data.get("callback_time", "")
    tenant_id = data.get("tenant_id", "")
    if not phone or not tenant_id:
        return
    try:
        from cogniflow_home.whatsapp.tool import get_whatsapp
        wa = await get_whatsapp(tenant_id)
        try:
            await wa.send_text(
                phone,
                f"We'll call you back at {callback_time}. Reply here if you need to reschedule.",
            )
            logger.info(f"Callback notification sent to {phone}")
        finally:
            await wa.close()
    except Exception:
        logger.debug(f"Callback WA notification failed for {phone}", exc_info=True)


def register():
    bus.on("appointment.booked", on_appointment_booked)
    bus.on("followup.scheduled", on_followup_scheduled)
    bus.on("call.completed", on_call_completed_wa)
    bus.on("callback.scheduled", on_callback_scheduled_wa)
    logger.info("Notification confirmations registered (email + WhatsApp + proactive)")
