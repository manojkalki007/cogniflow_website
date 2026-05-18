"""Agent tools — functions the AI can call during a conversation.

The LLM can invoke these tools via function calling.
Add new tools by defining the function and adding it to TOOL_REGISTRY.
"""

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

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
            "description": "Check available appointment slots on a given date using Google Calendar.",
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

    appointment = {
        "name": args.get("name", ""),
        "date": args.get("date", ""),
        "time": args.get("time", ""),
        "phone": args.get("phone", caller),
        "email": email,
        "notes": args.get("notes", ""),
        "call_id": ctx.get("call_id", ""),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    contact_updates = {"name": args.get("name", ""), "metadata": {"last_appointment": appointment}}
    if email:
        contact_updates["email"] = email
    if caller:
        await db.update("contacts", {"phone_number": caller}, contact_updates)

    await bus.emit("appointment.booked", appointment)

    confirmation = f"Appointment booked for {args['name']} on {args['date']} at {args['time']}."
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

    if not settings.whatsapp_api_key:
        await bus.emit("whatsapp.requested", {
            "call_id": ctx.get("call_id", ""),
            "caller_number": caller,
            "template": args.get("template", ""),
            "parameters": args.get("parameters", []),
        })
        return "I've noted that down and we'll send it to your WhatsApp shortly."

    from cogniflow_home.whatsapp.tool import WhatsAppTool
    wa = WhatsAppTool()
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
    try:
        from cogniflow_home.integrations.google_calendar import gcal
        slots = await gcal.get_available_slots(date)
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
    if not amount:
        return "I need an amount to create the payment link."
    try:
        from cogniflow_home.integrations.razorpay import razorpay
        result = await razorpay.create_payment_link(
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


TOOL_HANDLERS = {
    "book_appointment": _book_appointment,
    "transfer_call": _transfer_call,
    "save_contact_info": _save_contact_info,
    "send_followup": _send_followup,
    "send_whatsapp": _send_whatsapp,
    "check_availability": _check_availability,
    "create_payment_link": _create_payment_link,
}
