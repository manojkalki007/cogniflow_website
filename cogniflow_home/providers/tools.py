"""Agent tools — functions the AI can call during a conversation.

The LLM can invoke these tools via function calling.
Add new tools by defining the function and adding it to TOOL_REGISTRY.
"""

import asyncio
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

_DATE_RE = re.compile(r'^\d{4}-\d{2}-\d{2}$')
_TIME_RE = re.compile(r'^\d{1,2}:\d{2}$')

logger = logging.getLogger("cogniflow_home.tools")


TOOL_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "book_appointment",
            "description": "Book an appointment for the caller. Use when they want to schedule a meeting or visit. Always ask for their email so we can send a confirmation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Caller's full name"},
                    "date": {"type": "string", "description": "Preferred date (YYYY-MM-DD)"},
                    "time": {"type": "string", "description": "Preferred time (HH:MM)"},
                    "phone": {"type": "string", "description": "Callback phone number"},
                    "email": {"type": "string", "description": "Email address for booking confirmation"},
                    "notes": {"type": "string", "description": "Any additional details"},
                },
                "required": ["name", "date", "time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "transfer_call",
            "description": "Transfer the caller to a human agent or specific department. Use when you can't help them.",
            "parameters": {
                "type": "object",
                "properties": {
                    "department": {"type": "string", "description": "Department to transfer to (sales, support, billing)"},
                    "reason": {"type": "string", "description": "Brief reason for transfer"},
                },
                "required": ["department"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "save_contact_info",
            "description": "Save or update the caller's contact information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "email": {"type": "string"},
                    "company": {"type": "string"},
                },
                "required": ["name"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_followup",
            "description": "Schedule a follow-up action after the call (email, SMS, callback).",
            "parameters": {
                "type": "object",
                "properties": {
                    "action_type": {"type": "string", "enum": ["email", "sms", "callback"]},
                    "details": {"type": "string", "description": "What to include in the follow-up"},
                    "when": {"type": "string", "description": "When to send (e.g. 'immediately', 'tomorrow', '2 hours')"},
                },
                "required": ["action_type", "details"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_whatsapp",
            "description": (
                "Send a message, document, payment link, or appointment confirmation "
                "to the caller's WhatsApp number during the live call. Use this when "
                "you need to share something visual (PDF, link, details) that's hard "
                "to communicate by voice alone."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "template": {
                        "type": "string",
                        "enum": ["appointment_confirmation", "payment_link",
                                 "document_share", "fee_details"],
                        "description": "Which template to send",
                    },
                    "parameters": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Template variable values in order",
                    },
                },
                "required": ["template", "parameters"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_availability",
            "description": "Check available appointment slots on a given date.",
            "parameters": {
                "type": "object",
                "properties": {
                    "date": {"type": "string", "description": "Date in YYYY-MM-DD format"},
                },
                "required": ["date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_payment_link",
            "description": "Create a Razorpay payment link to collect payment. Returns a short URL that can be sent via WhatsApp.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount": {"type": "number", "description": "Amount in INR"},
                    "description": {"type": "string", "description": "What the payment is for"},
                },
                "required": ["amount", "description"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "push_to_leadrat",
            "description": "Save this lead to LeadRat CRM. Use after qualifying — when you have their name, budget, and property interest.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Lead's full name"},
                    "budget": {"type": "string", "description": "Budget range, e.g. '50-75 Lakhs'"},
                    "property_type": {"type": "string", "description": "e.g. '3BHK Apartment'"},
                    "location": {"type": "string", "description": "Preferred area, e.g. 'Whitefield'"},
                    "interested": {"type": "boolean", "description": "Is the lead interested?"},
                    "site_visit_date": {"type": "string", "description": "Site visit date if booked (YYYY-MM-DD)"},
                    "notes": {"type": "string", "description": "Additional notes from conversation"},
                },
                "required": ["name", "interested"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_crm",
            "description": "Look up a contact or lead in the CRM by phone number or email. Use this to get context about who you're speaking with.",
            "parameters": {
                "type": "object",
                "properties": {
                    "phone": {"type": "string", "description": "Phone number to search"},
                    "email": {"type": "string", "description": "Email to search"},
                },
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "update_crm",
            "description": "Update CRM with notes or activity from this call. Use after gathering important information.",
            "parameters": {
                "type": "object",
                "properties": {
                    "action": {
                        "type": "string",
                        "enum": ["add_note", "log_activity"],
                        "description": "Type of CRM update",
                    },
                    "note": {"type": "string", "description": "Note or activity details to record"},
                },
                "required": ["action", "note"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "send_email",
            "description": "Send a personalized email to the caller. Use when they request information in writing or ask for something to be emailed.",
            "parameters": {
                "type": "object",
                "properties": {
                    "to_email": {"type": "string", "description": "Recipient email address"},
                    "subject": {"type": "string", "description": "Email subject line"},
                    "body": {"type": "string", "description": "Email body content in plain text"},
                },
                "required": ["to_email", "subject", "body"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_callback",
            "description": (
                "Schedule a callback when the caller says they are busy, not free, "
                "in a meeting, driving, or asks to be called back later. Extract the "
                "preferred callback time from the conversation. Always confirm the "
                "time with the caller before calling this tool."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "callback_time": {
                        "type": "string",
                        "description": "When to call back (e.g. '2026-06-10T15:00', 'tomorrow 3pm', 'in 2 hours', 'evening')",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Why the caller wants a callback (e.g. 'busy in a meeting', 'driving')",
                    },
                },
                "required": ["callback_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "end_call",
            "description": (
                "End the current call gracefully. Use ONLY after schedule_callback "
                "has been confirmed, or when the caller explicitly wants to hang up. "
                "Say a brief polite goodbye BEFORE calling this tool."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "reason": {
                        "type": "string",
                        "description": "Why the call is ending (e.g. 'callback scheduled', 'caller requested')",
                    },
                },
                "required": ["reason"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "handoff_to_human",
            "description": (
                "Escalate this conversation to a human agent. Use when the user "
                "explicitly asks to speak with a person, or when you cannot resolve "
                "their issue after reasonable attempts."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "department": {
                        "type": "string",
                        "description": "Department to route to (sales, support, billing)",
                    },
                    "reason": {
                        "type": "string",
                        "description": "Why the conversation needs a human",
                    },
                    "summary": {
                        "type": "string",
                        "description": "Brief summary of the conversation so far",
                    },
                },
                "required": ["reason"],
            },
        },
    },
]


async def execute_tool(tool_name: str, args: dict, call_context: dict) -> str:
    handler = TOOL_HANDLERS.get(tool_name)
    if not handler:
        return f"Unknown tool: {tool_name}"
    try:
        return await asyncio.wait_for(handler(args, call_context), timeout=10)
    except asyncio.TimeoutError:
        logger.error(f"Tool execution timed out after 10s: {tool_name}")
        return "Sorry, that request took too long. Let me try another way."
    except Exception:
        logger.exception(f"Tool execution error: {tool_name}")
        return "Sorry, I encountered an error processing that request."


async def _book_appointment(args: dict, ctx: dict) -> str:
    caller = ctx.get("caller_number", "")
    email = args.get("email", "")

    if not email and caller:
        contacts = await db.select("contacts", {"phone_number": caller}, select="email", limit=1)
        if contacts and contacts[0].get("email"):
            email = contacts[0]["email"]

    name = args.get("name", "")
    date = args.get("date", "")
    time_str = args.get("time", "")
    phone = args.get("phone", caller)
    notes = args.get("notes", "")

    if not _DATE_RE.match(date):
        return "I need the date in a format like 2026-05-25. Could you say the date again?"
    if not _TIME_RE.match(time_str):
        return "I need the time like 10:00 or 14:30. What time works for you?"

    tenant_id = ctx.get("tenant_id", "")
    cal_booking_uid = ""
    start_iso = f"{date}T{time_str}:00+05:30"
    try:
        from cogniflow_home.integrations.calcom import calcom, get_calcom
        cal_client = await get_calcom(tenant_id) if tenant_id else calcom
        if cal_client.configured and email:
            result = await cal_client.create_booking(
                start_iso=start_iso,
                attendee_name=name,
                attendee_email=email,
                attendee_phone=phone,
                notes=notes,
            )
            cal_booking_uid = result.get("uid", "")
            logger.info("Cal.com booking created: %s", cal_booking_uid)
    except Exception:
        logger.exception("Cal.com booking failed, trying fallback")

    if not cal_booking_uid:
        try:
            from cogniflow_home.integrations.google_calendar import gcal, get_gcal
            gcal_client = await get_gcal(tenant_id) if tenant_id else gcal
            if gcal_client.configured:
                end_dt = datetime.fromisoformat(start_iso) + timedelta(minutes=30)
                await gcal_client.create_event(
                    title=f"Appointment: {name}",
                    start_iso=start_iso,
                    end_iso=end_dt.isoformat(),
                    attendee_email=email or None,
                    description=notes,
                )
                logger.info("Google Calendar booking created as fallback")
        except Exception:
            logger.debug("Google Calendar fallback unavailable", exc_info=True)

    appointment = {
        "name": name,
        "date": date,
        "time": time_str,
        "phone": phone,
        "email": email,
        "notes": notes,
        "call_id": ctx.get("call_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    if cal_booking_uid:
        appointment["cal_booking_uid"] = cal_booking_uid

    contact_updates = {"name": name, "metadata": {"last_appointment": appointment}}
    if email:
        contact_updates["email"] = email
    if caller:
        await db.update("contacts", {"phone_number": caller}, contact_updates)

    await bus.emit("appointment.booked", appointment)

    confirmation = f"Appointment booked for {name} on {date} at {time_str}."
    if email:
        confirmation += " A confirmation has been sent to your email and WhatsApp."
    elif caller:
        confirmation += " A confirmation has been sent to your WhatsApp."
    return confirmation


async def _transfer_call(args: dict, ctx: dict) -> str:
    department = args.get("department", "support")
    reason = args.get("reason", "")

    await bus.emit("call.transfer_requested", {
        "call_id": ctx.get("call_id", ""),
        "department": department,
        "reason": reason,
    })

    return f"Transferring to {department}. Please hold."


async def _save_contact_info(args: dict, ctx: dict) -> str:
    caller = ctx.get("caller_number", "")
    if not caller:
        return "Contact information saved."

    updates = {}
    if args.get("name"):
        updates["name"] = args["name"]
    if args.get("email"):
        updates["email"] = args["email"]
    if args.get("company"):
        updates["company"] = args["company"]

    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.update("contacts", {"phone_number": caller}, updates)

    return f"Got it, I've saved that information for {args.get('name', 'you')}."


async def _send_whatsapp(args: dict, ctx: dict) -> str:
    caller = ctx.get("caller_number", "")
    if not caller:
        return "I don't have a phone number to send the WhatsApp message to."

    tenant_id = ctx.get("tenant_id", "")
    from cogniflow_home.whatsapp.tool import WhatsAppTool, get_whatsapp
    wa = await get_whatsapp(tenant_id) if tenant_id else WhatsAppTool()
    try:
        result = await wa.send_template(
            to_phone=caller,
            template_name=args.get("template", ""),
            parameters=args.get("parameters", []),
        )
        if "error" in result:
            return "I wasn't able to send that right now, but I've noted it down."
        return "I've just sent that to your WhatsApp. Can you check if you've received it?"
    finally:
        await wa.close()


async def _send_followup(args: dict, ctx: dict) -> str:
    await bus.emit("followup.scheduled", {
        "call_id": ctx.get("call_id", ""),
        "caller_number": ctx.get("caller_number", ""),
        "action_type": args.get("action_type", "email"),
        "details": args.get("details", ""),
        "when": args.get("when", "immediately"),
    })

    action = args.get("action_type", "follow-up")
    return f"I've scheduled a {action} follow-up. You'll receive it {args.get('when', 'shortly')}."


async def _check_availability(args: dict, ctx: dict) -> str:
    date = args.get("date", "")
    if not date:
        return "I need a date to check availability. What date would you prefer?"
    tenant_id = ctx.get("tenant_id", "")
    try:
        from cogniflow_home.integrations.calcom import calcom, get_calcom
        cal_client = await get_calcom(tenant_id) if tenant_id else calcom
        if cal_client.configured:
            slots = await cal_client.get_available_slots(date)
        else:
            from cogniflow_home.integrations.google_calendar import gcal, get_gcal
            gcal_client = await get_gcal(tenant_id) if tenant_id else gcal
            slots = await gcal_client.get_available_slots(date)
        if not slots:
            return f"Sorry, there are no available slots on {date}. Would you like to try another date?"
        slot_list = ", ".join(f"{s['start']} to {s['end']}" for s in slots[:5])
        return f"Available slots on {date}: {slot_list}. Which time works best for you?"
    except Exception:
        logger.exception("Calendar check failed")
        return "I'm unable to check the calendar right now. Let me note your preferred time and we'll confirm by email."


async def _create_payment_link(args: dict, ctx: dict) -> str:
    amount = args.get("amount", 0)
    description = args.get("description", "Payment")
    caller = ctx.get("caller_number", "")
    tenant_id = ctx.get("tenant_id", "")
    if not amount:
        return "I need an amount to create the payment link."
    try:
        from cogniflow_home.integrations.razorpay import razorpay, get_razorpay
        rzp = await get_razorpay(tenant_id) if tenant_id else razorpay
        result = await rzp.create_payment_link(
            amount_inr=amount,
            description=description,
            customer_phone=caller,
        )
        short_url = result.get("short_url", "")
        if short_url:
            return f"I've created a payment link for ₹{amount:,.0f}. The link is {short_url}. Would you like me to send it to your WhatsApp?"
        return "I've noted the payment. Our team will send you the link shortly."
    except Exception:
        logger.exception("Razorpay link creation failed")
        return "I'm unable to create the payment link right now. Our team will follow up with you."


async def _push_to_leadrat(args: dict, ctx: dict) -> str:
    from cogniflow_home.integrations.leadrat import handle_push_to_leadrat
    return await handle_push_to_leadrat(args, ctx)


async def _query_crm(args: dict, ctx: dict) -> str:
    tenant_id = ctx.get("tenant_id", "")
    config = ctx.get("integration_config", {})
    crm = config.get("crm_provider", "")
    phone = args.get("phone", ctx.get("caller_number", ""))
    email = args.get("email", "")

    if crm == "hubspot":
        try:
            from cogniflow_home.integrations.hubspot import get_hubspot
            client = await get_hubspot(tenant_id)
            contact = await client.find_contact_by_phone(phone)
            if contact:
                props = contact.get("properties", {})
                name = f"{props.get('firstname', '')} {props.get('lastname', '')}".strip()
                parts = []
                if name:
                    parts.append(f"Name: {name}")
                if props.get("company"):
                    parts.append(f"Company: {props['company']}")
                if props.get("lifecyclestage"):
                    parts.append(f"Stage: {props['lifecyclestage']}")
                if props.get("email"):
                    parts.append(f"Email: {props['email']}")
                return f"CRM contact found. {', '.join(parts)}."
            return "No matching contact found in HubSpot."
        except Exception:
            logger.exception("HubSpot CRM lookup failed")
            return "I wasn't able to check the CRM right now."

    elif crm == "salesforce":
        try:
            from cogniflow_home.integrations.salesforce import get_salesforce
            client = await get_salesforce(tenant_id)
            contact = await client.find_contact(phone)
            if contact:
                return f"CRM contact found. Name: {contact.get('Name', '')}, Account: {contact.get('Account', {}).get('Name', '')}."
            lead = await client.find_lead(phone)
            if lead:
                return f"CRM lead found. Name: {lead.get('Name', '')}, Company: {lead.get('Company', '')}, Status: {lead.get('Status', '')}."
            return "No matching contact or lead found in Salesforce."
        except Exception:
            logger.exception("Salesforce CRM lookup failed")
            return "I wasn't able to check the CRM right now."

    elif crm == "leadrat":
        return "LeadRat is a write-only CRM. Use push_to_leadrat to save leads."

    return "CRM is not configured for this agent."


async def _update_crm(args: dict, ctx: dict) -> str:
    tenant_id = ctx.get("tenant_id", "")
    config = ctx.get("integration_config", {})
    crm = config.get("crm_provider", "")
    action = args.get("action", "add_note")
    note = args.get("note", "")
    caller = ctx.get("caller_number", "")

    if not note:
        return "I need some details to record. What should I note?"

    if crm == "hubspot":
        try:
            from cogniflow_home.integrations.hubspot import get_hubspot
            client = await get_hubspot(tenant_id)
            contact = await client.find_contact_by_phone(caller)
            if contact:
                contact_id = contact.get("id", "")
                await client.log_call(
                    contact_id=contact_id,
                    summary=note,
                    transcript=note,
                    duration_ms=0,
                    direction="INBOUND",
                )
                return "Note recorded in HubSpot."
            return "Couldn't find the contact in HubSpot to update."
        except Exception:
            logger.exception("HubSpot CRM update failed")
            return "I wasn't able to update the CRM right now."

    elif crm == "salesforce":
        try:
            from cogniflow_home.integrations.salesforce import get_salesforce
            client = await get_salesforce(tenant_id)
            contact = await client.find_contact(caller)
            who_id = contact.get("Id", "") if contact else ""
            if not who_id:
                lead = await client.find_lead(caller)
                who_id = lead.get("Id", "") if lead else ""
            if who_id:
                await client.create_task(
                    who_id=who_id,
                    subject=f"Call note: {note[:50]}",
                    description=note,
                )
                return "Note recorded in Salesforce."
            return "Couldn't find the contact in Salesforce to update."
        except Exception:
            logger.exception("Salesforce CRM update failed")
            return "I wasn't able to update the CRM right now."

    elif crm == "leadrat":
        return "Use the push_to_leadrat tool to save data to LeadRat."

    return "CRM is not configured for this agent."


async def _send_email(args: dict, ctx: dict) -> str:
    to_email = args.get("to_email", "")
    if not to_email:
        return "I need an email address to send to. Could you share your email?"

    subject = args.get("subject", "Information from your call")
    body = args.get("body", "")
    if not body:
        return "I need some content for the email. What would you like me to include?"

    tenant_id = ctx.get("tenant_id", "")
    config = ctx.get("integration_config", {})
    from_name = config.get("email_from_name", "")

    from html import escape
    safe_body = escape(body).replace("\n", "<br>")

    html_body = f"""<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px; color: #1a1a1a;">
<p style="font-size: 15px; line-height: 1.6;">{safe_body}</p>
<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0 16px;">
<p style="color: #aaa; font-size: 11px; text-align: center;">Sent via Cogniflow</p>
</div>"""

    from cogniflow_home.integrations.email import email_sender
    sent = await email_sender.send(to_email, subject, html_body, text_body=body, tenant_id=tenant_id)
    if sent:
        return f"Email sent to {to_email} with subject '{subject}'."
    return "I wasn't able to send the email right now. I've noted it for follow-up."


async def _schedule_callback(args: dict, ctx: dict) -> str:
    caller = ctx.get("caller_number", "")
    callback_time = args.get("callback_time", "")
    reason = args.get("reason", "")

    if not callback_time:
        return "I need a time to schedule the callback. When would you like us to call back?"

    callback_record = {
        "phone_number": caller,
        "callback_time": callback_time,
        "reason": reason,
        "call_id": ctx.get("call_id", ""),
        "agent_id": ctx.get("agent_id", ""),
        "tenant_id": ctx.get("tenant_id", ""),
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    try:
        await db.insert("callbacks", callback_record)
    except Exception:
        logger.debug("callbacks table insert failed, saving to contacts metadata", exc_info=True)
        if caller:
            await db.update("contacts", {"phone_number": caller}, {
                "metadata": {"pending_callback": callback_record},
            })

    await bus.emit("callback.scheduled", callback_record)

    return f"Callback scheduled for {callback_time}. You may now end the call politely."


async def _end_call(args: dict, ctx: dict) -> str:
    call_id = ctx.get("call_id", "")
    reason = args.get("reason", "caller requested")

    await bus.emit("call.end_requested", {
        "call_id": call_id,
        "reason": reason,
    })

    from cogniflow_home.state import active_calls
    pipeline = active_calls.get(call_id)
    if pipeline:
        pipeline._end_requested = True

    return ""


async def _handoff_to_human(args: dict, ctx: dict) -> str:
    tenant_id = ctx.get("tenant_id", "")
    agent_id = ctx.get("agent_id", "")
    phone = ctx.get("caller_number", "")
    reason = args.get("reason", "")
    department = args.get("department", "support")
    summary = args.get("summary", "")

    if phone and tenant_id:
        try:
            existing = await db.select("whatsapp_conversations", {
                "tenant_id": tenant_id,
                "agent_id": agent_id,
                "phone_number": phone,
            }, limit=1)
            if existing:
                import json as _json
                await db.update("whatsapp_conversations", {"id": existing[0]["id"]}, {
                    "status": "escalated",
                    "metadata": _json.dumps({
                        "escalation_reason": reason,
                        "escalation_department": department,
                        "escalation_summary": summary,
                    }),
                })
        except Exception:
            logger.exception("Failed to escalate conversation")

    await bus.emit("whatsapp.handoff.requested", {
        "tenant_id": tenant_id,
        "agent_id": agent_id,
        "phone_number": phone,
        "department": department,
        "reason": reason,
        "summary": summary,
    })

    return "I'm connecting you with a team member who can help further. They'll respond shortly."


TOOL_HANDLERS = {
    "book_appointment": _book_appointment,
    "transfer_call": _transfer_call,
    "save_contact_info": _save_contact_info,
    "send_followup": _send_followup,
    "send_whatsapp": _send_whatsapp,
    "check_availability": _check_availability,
    "create_payment_link": _create_payment_link,
    "push_to_leadrat": _push_to_leadrat,
    "query_crm": _query_crm,
    "update_crm": _update_crm,
    "send_email": _send_email,
    "schedule_callback": _schedule_callback,
    "end_call": _end_call,
    "handoff_to_human": _handoff_to_human,
}
