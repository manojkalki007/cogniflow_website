"""WhatsApp Business API tool for live call handoff.

Sends template messages to the caller's WhatsApp during an active call.
Supports appointment confirmations, payment links, documents, fee details.
"""

import logging

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.whatsapp")

TEMPLATES = {
    "appointment_confirmation": {
        "name": "appointment_confirm_v1",
        "language": "en",
    },
    "payment_link": {
        "name": "payment_link_v1",
        "language": "en",
    },
    "document_share": {
        "name": "doc_share_v1",
        "language": "en",
    },
    "fee_details": {
        "name": "fee_details_v1",
        "language": "en",
    },
}


class WhatsAppTool:

    def __init__(self):
        self._client = httpx.AsyncClient(
            base_url=settings.whatsapp_api_url,
            headers={"Authorization": f"Bearer {settings.whatsapp_api_key}"},
            timeout=15.0,
        )

    async def send_template(
        self,
        to_phone: str,
        template_name: str,
        parameters: list[str],
        media_url: str | None = None,
    ) -> dict:
        template_config = TEMPLATES.get(template_name)
        if not template_config:
            return {"error": f"Unknown template: {template_name}"}

        components = [
            {
                "type": "body",
                "parameters": [{"type": "text", "text": p} for p in parameters],
            }
        ]

        if media_url:
            components.insert(0, {
                "type": "header",
                "parameters": [
                    {"type": "document", "document": {"link": media_url}}
                ],
            })

        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "template",
            "template": {
                "name": template_config["name"],
                "language": {"code": template_config["language"]},
                "components": components,
            },
        }

        try:
            response = await self._client.post("/messages", json=payload)
            result = response.json()
            logger.info(f"WhatsApp sent to {to_phone}: {template_name}")
            return result
        except Exception:
            logger.exception(f"WhatsApp send failed to {to_phone}")
            return {"error": "Failed to send WhatsApp message"}

    async def close(self):
        await self._client.aclose()


WHATSAPP_TOOL_DEFINITION = {
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
                    "enum": list(TEMPLATES.keys()),
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
}

WHATSAPP_PROMPT_ADDITION = """
You can send messages to the caller's WhatsApp during this call.
Use the send_whatsapp tool when you need to share:
- Appointment confirmations
- Payment links
- Fee details or invoices
- Documents or brochures

After sending, say: "I've just sent that to your WhatsApp. Can you check
if you've received it?" Wait for confirmation before continuing.

NEVER send WhatsApp messages unless the information is genuinely useful.
Don't send for simple yes/no answers that can be handled by voice.
"""
