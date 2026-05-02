"""Auto-send booking confirmations via email and WhatsApp.

Listens to appointment.booked and followup.scheduled events.
Sends confirmations automatically — no manual action needed.
"""

import logging
from typing import Any

from cogniflow_home.config import settings
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


async def _send_whatsapp_confirmation(phone: str, name: str, date: str, time: str):
    if not settings.whatsapp_api_key:
        logger.debug("WhatsApp not configured — skipping confirmation")
        return

    try:
        from cogniflow_home.whatsapp.tool import WhatsAppTool
        wa = WhatsAppTool()
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
        )
        if sent:
            logger.info(f"Booking email sent to {email} for {name}")
    else:
        logger.debug(f"No email for {phone} — skipping email confirmation")

    # Send WhatsApp confirmation
    if phone:
        await _send_whatsapp_confirmation(phone, name, date, time)


async def on_followup_scheduled(event: str, data: dict[str, Any]):
    """Handle scheduled follow-ups — send email or WhatsApp."""
    action = data.get("action_type", "")
    details = data.get("details", "")
    phone = data.get("caller_number", "")
    when = data.get("when", "immediately")

    if action == "email":
        email = await _get_contact_email(phone)
        name = await _get_contact_name(phone) or "there"
        if email:
            await email_sender.send_followup(
                to_email=email,
                name=name,
                details=details,
            )
            logger.info(f"Follow-up email sent to {email}")
        else:
            logger.warning(f"No email found for {phone} — follow-up email not sent")

    elif action == "sms":
        logger.info(f"SMS follow-up scheduled for {phone}: {details}")
        # SMS integration placeholder

    elif action == "callback":
        logger.info(f"Callback scheduled for {phone}: {details} ({when})")


def register():
    bus.on("appointment.booked", on_appointment_booked)
    bus.on("followup.scheduled", on_followup_scheduled)
    logger.info("Notification confirmations registered (email + WhatsApp)")
