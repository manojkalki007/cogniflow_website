"""
Multi-agent manager.

Supports multiple AI agents, each with their own personality, voice,
language, and phone number routing. For now defaults to a single agent
configured in agent.py. Add agents via the API or database.

Future: route inbound calls to different agents based on the called number.
"""

import json
import logging
from dataclasses import dataclass, field

from cogniflow_home.agent import AGENT_INSTRUCTIONS, AGENT_NAME, GREETING, LANGUAGE, VOICE_ID
from cogniflow_home.db.supabase import db

logger = logging.getLogger("cogniflow_home.agents")


@dataclass
class AgentConfig:
    id: str | None
    name: str
    instructions: str
    greeting: str
    voice_id: str
    language: str
    tenant_id: str = ""
    emotion_profile: str = "friendly"
    voice_gender: str = "female"
    tts_provider: str = "smallest"
    tools_enabled: list[str] | None = None
    enable_memory: bool = True
    enable_prediction: bool = True
    enable_emotion: bool = True
    enable_language_switch: bool = True
    enable_rag: bool = False
    enable_barge_in: bool = True
    enable_speculative: bool = True
    enable_filler: bool = True
    integration_config: dict = field(default_factory=dict)
    variables: list = field(default_factory=list)


DEFAULT_AGENT = AgentConfig(
    id=None,
    name=AGENT_NAME,
    instructions=AGENT_INSTRUCTIONS,
    greeting=GREETING,
    voice_id=VOICE_ID,
    language=LANGUAGE,
)


def _agent_from_row(agent: dict) -> AgentConfig:
    meta = agent.get("metadata") or {}
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}

    return AgentConfig(
        id=agent["id"],
        name=agent["name"],
        instructions=agent.get("instructions") or AGENT_INSTRUCTIONS,
        greeting=agent.get("greeting") or GREETING,
        voice_id=agent.get("voice_id", VOICE_ID),
        language=agent.get("language", "en"),
        tenant_id=agent.get("tenant_id") or "",
        emotion_profile=agent.get("emotion_profile") or "friendly",
        voice_gender=agent.get("voice_gender") or "female",
        tts_provider=agent.get("tts_provider") or "smallest",
        tools_enabled=agent.get("tools_enabled"),
        enable_memory=agent.get("enable_memory", True),
        enable_prediction=agent.get("enable_prediction", True),
        enable_emotion=agent.get("enable_emotion", True),
        enable_language_switch=agent.get("enable_language_switch", True),
        enable_rag=agent.get("enable_rag", False),
        enable_barge_in=agent.get("enable_barge_in", True),
        enable_speculative=agent.get("enable_speculative", True),
        enable_filler=agent.get("enable_filler", True),
        integration_config=meta.get("integration_config", {}),
        variables=meta.get("variables", []),
    )


async def get_agent_for_number(called_number: str, tenant_id: str = "") -> AgentConfig:
    """Look up which agent handles a given phone number.
    Falls back to default agent if no match found.
    If tenant_id is provided, only agents owned by that tenant are considered."""
    try:
        match = {"is_active": "true"}
        if tenant_id:
            match["tenant_id"] = tenant_id
        agents = await db.select("agents", match)
        for agent in agents:
            numbers = agent.get("phone_numbers", [])
            if called_number in numbers:
                return _agent_from_row(agent)
    except Exception:
        logger.debug("Agent lookup failed, using default")

    return DEFAULT_AGENT


async def get_agent_by_id(agent_id: str) -> AgentConfig | None:
    try:
        agents = await db.select("agents", {"id": agent_id})
        if agents:
            return _agent_from_row(agents[0])
    except Exception:
        logger.debug(f"Agent lookup by ID failed: {agent_id}")
    return None


async def list_agents(tenant_id: str = "") -> list[dict]:
    try:
        match = {"tenant_id": tenant_id} if tenant_id else None
        return await db.select("agents", match, order="created_at.desc")
    except Exception:
        return []


async def create_agent(data: dict) -> dict | None:
    result = await db.insert("agents", data)
    if result is None:
        logger.error(f"Failed to insert agent: {data.get('name', 'unknown')}")
    return result


async def update_agent(agent_id: str, data: dict, tenant_id: str = "") -> dict | None:
    """Update an agent. If tenant_id is provided, the update is scoped to that tenant
    (prevents TOCTOU race where an agent was re-assigned between check and update)."""
    match = {"id": agent_id}
    if tenant_id:
        match["tenant_id"] = tenant_id
    return await db.update("agents", match, data)
