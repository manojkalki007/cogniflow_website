"""WhatsApp chat engine — full conversational agent with tool calling."""

import json
import logging
from datetime import datetime, timezone

from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus
from cogniflow_home.providers.tools import TOOL_DEFINITIONS
from cogniflow_home.emotions.prompt_builder import build_variables_prompt

logger = logging.getLogger("cogniflow_home.whatsapp.chat")

MAX_HISTORY = 20

_WA_ALWAYS_AVAILABLE = {"schedule_callback", "handoff_to_human", "collect_info"}
_WA_EXCLUDED = {"end_call", "transfer_call"}

WA_SYSTEM_SUFFIX = (
    "\n\nYou are chatting on WhatsApp. Keep responses concise (1-3 sentences). "
    "Use simple formatting. You can use tools to book appointments, look up CRM data, "
    "send emails, create payment links, and more. When a tool result confirms an action, "
    "summarize it briefly for the user."
)



def _filter_tools(meta: dict) -> list[dict] | None:
    tools_enabled = meta.get("tools_enabled")
    if tools_enabled is not None:
        allowed = (set(tools_enabled) | _WA_ALWAYS_AVAILABLE) - _WA_EXCLUDED
    else:
        allowed = {t["function"]["name"] for t in TOOL_DEFINITIONS} - _WA_EXCLUDED
    filtered = [t for t in TOOL_DEFINITIONS if t["function"]["name"] in allowed]
    return filtered or None


class WhatsAppChatEngine:

    async def handle_message(
        self,
        tenant_id: str,
        agent_id: str,
        from_phone: str,
        message_text: str,
        wa_message_id: str = "",
        media_info: dict | None = None,
    ) -> str:
        agent = await self._load_agent(agent_id, tenant_id)
        if not agent:
            logger.error(f"Agent {agent_id} not found for tenant {tenant_id}")
            return ""

        await self._store_message(
            tenant_id, agent_id, from_phone, "inbound", message_text, wa_message_id
        )

        # Check escalation status — don't run AI for escalated conversations
        conversation = await self._get_conversation(tenant_id, agent_id, from_phone)
        if conversation and conversation.get("status") == "escalated":
            holding = "A team member is reviewing your conversation and will respond shortly."
            from cogniflow_home.whatsapp.tool import get_whatsapp
            try:
                wa = await get_whatsapp(tenant_id)
                await wa.send_text(from_phone, holding)
                await wa.close()
            except Exception:
                logger.exception("WhatsApp holding message failed")
            await self._store_message(tenant_id, agent_id, from_phone, "outbound", holding)
            await self._update_conversation(tenant_id, agent_id, from_phone)
            return holding

        # Parse agent config
        raw = agent.get("bolna_raw_config") or "{}"
        meta = json.loads(raw) if isinstance(raw, str) else (raw or {})
        ic = meta.get("integration_config", {})

        # Handle inbound media
        enriched_text = message_text
        if media_info and media_info.get("media_id"):
            enriched_text = await self._process_inbound_media(
                tenant_id, from_phone, message_text, media_info
            )

        # Build system prompt
        system_prompt = (
            agent.get("system_prompt") or agent.get("instructions") or ""
        )
        system_prompt += WA_SYSTEM_SUFFIX

        vars_prompt = build_variables_prompt(meta.get("variables", []))
        if vars_prompt:
            system_prompt += "\n\n" + vars_prompt

        try:
            from cogniflow_home.memory.caller_memory import caller_memory
            profile = await caller_memory.recall(from_phone)
            if profile:
                system_prompt += "\n" + caller_memory.build_memory_prompt(profile)
        except Exception:
            logger.debug("Caller memory recall failed (non-fatal)", exc_info=True)

        if ic.get("enable_crm_lookup") and ic.get("crm_provider", "none") != "none":
            crm_context = await self._get_crm_context(
                ic["crm_provider"], tenant_id, from_phone
            )
            if crm_context:
                system_prompt += f"\n\nCaller context: {crm_context}"

        # Build conversation history
        history = await self._load_history(tenant_id, agent_id, from_phone)
        messages = [{"role": "system", "content": system_prompt}]
        for msg in reversed(history):
            if not msg.get("id") or not msg.get("content"):
                continue
            if msg.get("wa_message_id") == wa_message_id and msg["direction"] == "inbound":
                continue
            role = "user" if msg["direction"] == "inbound" else "assistant"
            messages.append({"role": role, "content": msg["content"]})

        # Filter tools and build call context
        tools = _filter_tools(meta)
        call_context = {
            "call_id": "",
            "caller_number": from_phone,
            "called_number": "",
            "direction": "whatsapp_inbound",
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "integration_config": ic,
            "variables": meta.get("variables", []),
        }

        from cogniflow_home.providers.groq_llm import GroqLLM

        llm = GroqLLM(
            model=agent.get("llm_model", "llama-3.3-70b-versatile"),
            system_prompt="",
            temperature=float(agent.get("temperature", 0.7)),
            max_tokens=400,
        )
        llm.conversation_history = messages
        llm.call_context = call_context

        response_parts = []
        try:
            async for sentence in llm.generate_stream(enriched_text, tools=tools):
                response_parts.append(sentence)
        except Exception:
            logger.exception("WhatsApp LLM generation failed")
        finally:
            await llm.close()

        response_text = " ".join(response_parts).strip()
        if not response_text:
            response_text = meta.get(
                "fallback_message",
                "Sorry, I couldn't process that. Please try again.",
            )

        from cogniflow_home.whatsapp.tool import get_whatsapp

        outbound_wa_id = ""
        try:
            wa = await get_whatsapp(tenant_id)
            result = await wa.send_text(from_phone, response_text)
            if isinstance(result, dict) and "messages" in result:
                outbound_wa_id = result["messages"][0].get("id", "")
            await wa.close()
        except Exception:
            logger.exception("WhatsApp reply send failed")

        await self._store_message(
            tenant_id, agent_id, from_phone, "outbound", response_text, outbound_wa_id
        )
        await self._update_conversation(tenant_id, agent_id, from_phone)

        # Update caller memory every 10 messages
        if conversation and ((conversation.get("message_count") or 0) + 2) % 10 == 0:
            try:
                from cogniflow_home.memory.caller_memory import caller_memory as _cm
                recent = [m["content"] for m in history[:6] if m.get("content")]
                summary = f"WhatsApp chat: {'; '.join(recent[:5])}"[:300]
                await _cm.update_after_call(from_phone, summary)
            except Exception:
                logger.debug("WhatsApp memory update failed (non-fatal)", exc_info=True)

        await bus.emit("whatsapp.message.received", {
            "tenant_id": tenant_id,
            "agent_id": agent_id,
            "phone_number": from_phone,
            "message": message_text,
            "response": response_text,
        })

        return response_text

    async def _load_agent(self, agent_id: str, tenant_id: str) -> dict | None:
        rows = await db.select(
            "agents", {"id": agent_id, "tenant_id": tenant_id}, limit=1
        )
        return rows[0] if rows else None

    async def _store_message(
        self,
        tenant_id: str,
        agent_id: str,
        phone: str,
        direction: str,
        content: str,
        wa_id: str = "",
        metadata: dict | None = None,
    ):
        try:
            row = {
                "tenant_id": tenant_id,
                "agent_id": agent_id,
                "phone_number": phone,
                "direction": direction,
                "content": content,
                "wa_message_id": wa_id,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            if metadata:
                row["metadata"] = json.dumps(metadata)
            await db.insert("whatsapp_messages", row)
        except Exception:
            logger.exception("Failed to store WhatsApp message")

    async def _load_history(
        self, tenant_id: str, agent_id: str, phone: str
    ) -> list[dict]:
        try:
            return await db.select(
                "whatsapp_messages",
                {"tenant_id": tenant_id, "agent_id": agent_id, "phone_number": phone},
                order="created_at.desc",
                limit=MAX_HISTORY,
            )
        except Exception:
            logger.exception("Failed to load WhatsApp history")
            return []

    async def _get_conversation(
        self, tenant_id: str, agent_id: str, phone: str
    ) -> dict | None:
        try:
            rows = await db.select("whatsapp_conversations", {
                "tenant_id": tenant_id,
                "agent_id": agent_id,
                "phone_number": phone,
            }, limit=1)
            return rows[0] if rows else None
        except Exception:
            return None

    async def _get_crm_context(
        self, crm_provider: str, tenant_id: str, phone: str
    ) -> str:
        try:
            if crm_provider == "hubspot":
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
                    return ", ".join(parts) if parts else ""
            elif crm_provider == "salesforce":
                from cogniflow_home.integrations.salesforce import get_salesforce
                client = await get_salesforce(tenant_id)
                contact = await client.find_contact(phone)
                if contact:
                    return f"Name: {contact.get('Name', '')}, Account: {contact.get('Account', {}).get('Name', '')}"
                lead = await client.find_lead(phone)
                if lead:
                    return f"Lead: {lead.get('Name', '')}, Company: {lead.get('Company', '')}, Status: {lead.get('Status', '')}"
        except Exception:
            logger.debug("CRM context lookup failed for WhatsApp", exc_info=True)
        return ""

    async def _process_inbound_media(
        self, tenant_id: str, phone: str, text: str, media_info: dict
    ) -> str:
        media_type = media_info.get("type", "file")
        media_id = media_info.get("media_id", "")
        caption = media_info.get("caption", "")
        filename = media_info.get("filename", f"{media_type}_attachment")

        media_url = ""
        try:
            from cogniflow_home.whatsapp.tool import get_whatsapp
            wa = await get_whatsapp(tenant_id)
            data, content_type, dl_filename = await wa.download_media(media_id)
            await wa.close()
            if data:
                ts = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
                path = f"{tenant_id}/{phone}/{ts}_{dl_filename or filename}"
                media_url = await db.upload_file(
                    "whatsapp-media", path, data, content_type
                ) or ""
        except Exception:
            logger.debug("Media download/upload failed (non-fatal)", exc_info=True)

        desc = caption or text or ""
        if media_url:
            return f"{desc}\n[User sent a {media_type}: {filename}. Stored at: {media_url}]".strip()
        return f"{desc}\n[User sent a {media_type}: {filename}]".strip()

    async def _update_conversation(
        self, tenant_id: str, agent_id: str, phone: str
    ):
        now = datetime.now(timezone.utc).isoformat()
        try:
            existing = await db.select("whatsapp_conversations", {
                "tenant_id": tenant_id,
                "agent_id": agent_id,
                "phone_number": phone,
            }, limit=1)

            if existing:
                count = (existing[0].get("message_count") or 0) + 2
                update = {"last_message_at": now, "message_count": count}
                if existing[0].get("status") != "escalated":
                    update["status"] = "active"
                await db.update(
                    "whatsapp_conversations",
                    {"id": existing[0]["id"]},
                    update,
                )
            else:
                await db.insert("whatsapp_conversations", {
                    "tenant_id": tenant_id,
                    "agent_id": agent_id,
                    "phone_number": phone,
                    "status": "active",
                    "last_message_at": now,
                    "message_count": 2,
                })
        except Exception:
            logger.exception("Failed to update WhatsApp conversation")


chat_engine = WhatsAppChatEngine()
