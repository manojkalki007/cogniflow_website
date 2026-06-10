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

    def __init__(self, api_key: str = "", api_url: str = ""):
        self._client = httpx.AsyncClient(
            base_url=api_url or settings.whatsapp_api_url,
            headers={"Authorization": f"Bearer {api_key or settings.whatsapp_api_key}"},
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

    async def send_text(self, to_phone: str, text: str) -> dict:
        """Send a free-form text message (within 24-hour conversation window)."""
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "text",
            "text": {"body": text},
        }
        try:
            response = await self._client.post("/messages", json=payload)
            result = response.json()
            logger.info(f"WhatsApp text sent to {to_phone}")
            return result
        except Exception:
            logger.exception(f"WhatsApp text send failed to {to_phone}")
            return {"error": "Failed to send WhatsApp message"}

    async def send_image(self, to_phone: str, image_url: str, caption: str = "") -> dict:
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "image",
            "image": {"link": image_url, "caption": caption},
        }
        try:
            response = await self._client.post("/messages", json=payload)
            return response.json()
        except Exception:
            logger.exception(f"WhatsApp image send failed to {to_phone}")
            return {"error": "Failed to send image"}

    async def send_document(
        self, to_phone: str, document_url: str, filename: str = "", caption: str = ""
    ) -> dict:
        doc: dict = {"link": document_url}
        if filename:
            doc["filename"] = filename
        if caption:
            doc["caption"] = caption
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "document",
            "document": doc,
        }
        try:
            response = await self._client.post("/messages", json=payload)
            return response.json()
        except Exception:
            logger.exception(f"WhatsApp document send failed to {to_phone}")
            return {"error": "Failed to send document"}

    async def send_interactive_buttons(
        self, to_phone: str, body_text: str, buttons: list[dict]
    ) -> dict:
        """Send up to 3 reply buttons. buttons: [{"id": "x", "title": "Label"}, ...]"""
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body_text},
                "action": {
                    "buttons": [
                        {"type": "reply", "reply": {"id": b["id"], "title": b["title"][:20]}}
                        for b in buttons[:3]
                    ]
                },
            },
        }
        try:
            response = await self._client.post("/messages", json=payload)
            return response.json()
        except Exception:
            logger.exception(f"WhatsApp buttons send failed to {to_phone}")
            return {"error": "Failed to send buttons"}

    async def send_interactive_list(
        self,
        to_phone: str,
        header: str,
        body: str,
        button_text: str,
        sections: list[dict],
    ) -> dict:
        """Send a list menu. sections: [{"title": "...", "rows": [{"id","title","description"}]}]"""
        payload = {
            "messaging_product": "whatsapp",
            "to": to_phone,
            "type": "interactive",
            "interactive": {
                "type": "list",
                "header": {"type": "text", "text": header},
                "body": {"text": body},
                "action": {"button": button_text, "sections": sections},
            },
        }
        try:
            response = await self._client.post("/messages", json=payload)
            return response.json()
        except Exception:
            logger.exception(f"WhatsApp list send failed to {to_phone}")
            return {"error": "Failed to send list"}

    async def download_media(self, media_id: str) -> tuple[bytes, str, str]:
        """Download media from Meta Graph API. Returns (data, content_type, filename)."""
        try:
            meta_resp = await self._client.get(f"/{media_id}")
            meta_data = meta_resp.json()
            download_url = meta_data.get("url", "")
            mime_type = meta_data.get("mime_type", "application/octet-stream")
            if not download_url:
                return b"", mime_type, ""
            dl_resp = await self._client.get(download_url)
            filename = media_id.split("/")[-1]
            return dl_resp.content, mime_type, filename
        except Exception:
            logger.exception(f"Media download failed for {media_id}")
            return b"", "", ""

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


async def get_whatsapp(tenant_id: str = "") -> WhatsAppTool:
    from cogniflow_home.credentials.resolver import credentials
    config = await credentials.get(tenant_id, "whatsapp")
    return WhatsAppTool(
        api_key=config.get("api_key", ""),
        api_url=config.get("api_url", ""),
    )
