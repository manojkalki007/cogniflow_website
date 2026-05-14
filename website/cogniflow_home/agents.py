"""
Multi-agent manager.

Supports multiple AI agents, each with their own personality, voice,
language, and phone number routing. For now defaults to a single agent
configured in agent.py. Add agents via the API or database.

Future: route inbound calls to different agents based on the called number.
"""

import logging
from dataclasses import dataclass

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


DEFAULT_AGENT = AgentConfig(
    id=None,
    name=AGENT_NAME,
    instructions=AGENT_INSTRUCTIONS,
    greeting=GREETING,
    voice_id=VOICE_ID,
    language=LANGUAGE,
)


async def get_agent_for_number(called_number: str) -> AgentConfig:
    """Look up which agent handles a given phone number.
    Falls back to default agent if no match found."""
    try:
        agents = await db.select("agents", {"is_active": "true"})
        for agent in agents:
            numbers = agent.get("phone_numbers", [])
            if called_number in numbers:
                return AgentConfig(
                    id=agent["id"],
                    name=agent["name"],
                    instructions=agent["instructions"],
                    greeting=agent.get("metadata", {}).get("greeting", GREETING),
                    voice_id=agent.get("voice_id", VOICE_ID),
                    language=agent.get("language", "en"),
                )
    except Exception:
        logger.debug("Agent lookup failed, using default")

    return DEFAULT_AGENT


async def get_agent_by_id(agent_id: str) -> AgentConfig | None:
    try:
        agents = await db.select("agents", {"id": agent_id})
        if agents:
            agent = agents[0]
            return AgentConfig(
                id=agent["id"],
                name=agent["name"],
                instructions=agent["instructions"],
                greeting=agent.get("greeting", "") or agent.get("metadata", {}).get("greeting", GREETING),
                voice_id=agent.get("voice_id", VOICE_ID),
                language=agent.get("language", "en"),
            )
    except Exception:
        logger.debug(f"Agent lookup by ID failed: {agent_id}")
    return None


async def list_agents() -> list[dict]:
    try:
        return await db.select("agents", order="created_at.desc")
    except Exception:
        return []


async def create_agent(data: dict) -> dict | None:
    result = await db.insert("agents", data)
    if result is None:
        logger.error(f"Failed to insert agent: {data.get('name', 'unknown')}")
    return result


async def update_agent(agent_id: str, data: dict) -> dict | None:
    return await db.update("agents", {"id": agent_id}, data)
