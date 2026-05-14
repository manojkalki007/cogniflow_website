"""
Score persona consistency across a full conversation.
Runs post-call on every conversation transcript.
"""

import logging
import json
import httpx
from cogniflow_home.config import settings

logger = logging.getLogger(__name__)

PERSONA_EVAL_PROMPT = """You are evaluating an AI voice agent's BEHAVIOUR consistency.

AGENT CONFIGURATION:
- Name: {agent_name}
- Company: {company_name}
- Personality: {personality}
- Role: {role}

FULL TRANSCRIPT:
{transcript}

Score EACH dimension 0-5. Be strict — inconsistency destroys caller trust.

Respond ONLY in JSON:
{{
  "name_consistency": {{
    "score": 0-5,
    "violations": ["list any name inconsistencies"]
  }},
  "company_consistency": {{
    "score": 0-5,
    "violations": ["list any wrong company references"]
  }},
  "personality_stability": {{
    "score": 0-5,
    "violations": ["list any personality breaks"],
    "notes": "Did the personality drift? Where?"
  }},
  "role_boundary": {{
    "score": 0-5,
    "violations": ["list any role boundary violations"],
    "claimed_human": false,
    "overclaimed_capabilities": []
  }},
  "voice_persona_match": {{
    "score": 0-5,
    "mismatched_phrases": ["phrases that don't fit the persona"],
    "notes": "Does language match the configured personality?"
  }},
  "overall_persona_score": 0-5,
  "summary": "one sentence assessment"
}}
"""


async def evaluate_persona(
    transcript: str,
    agent_config: dict,
) -> dict:
    """Evaluate persona consistency for a completed call."""
    prompt = PERSONA_EVAL_PROMPT.format(
        agent_name=agent_config.get("name", "Agent"),
        company_name=agent_config.get("company", "Unknown"),
        personality=agent_config.get("personality", "professional"),
        role=agent_config.get("role", "customer service agent"),
        transcript=transcript[:5000],
    )

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                },
            )
            data = resp.json()
            return json.loads(data["choices"][0]["message"]["content"])
    except Exception as e:
        logger.exception(f"Persona evaluation failed: {e}")
        return {"overall_persona_score": -1, "error": str(e)}
