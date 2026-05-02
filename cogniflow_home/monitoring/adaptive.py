"""
Score how well the agent adapted to the caller's style.
Uses LLM-as-judge on the full transcript.
"""

import json
import logging
import httpx
from cogniflow_home.config import settings

logger = logging.getLogger(__name__)

ADAPTIVE_EVAL_PROMPT = """Evaluate how well this AI agent ADAPTED its behaviour to the caller.

TRANSCRIPT:
{transcript}

Score each adaptation dimension 0-5:

{{
  "formality_match": {{
    "score": 0-5,
    "caller_formality": "formal|casual|neutral",
    "agent_formality": "formal|casual|neutral",
    "matched": true/false,
    "notes": ""
  }},
  "pace_match": {{
    "score": 0-5,
    "caller_pace": "brief|normal|verbose",
    "agent_pace": "brief|normal|verbose",
    "matched": true/false,
    "notes": ""
  }},
  "technical_calibration": {{
    "score": 0-5,
    "caller_tech_level": "technical|moderate|non-technical",
    "agent_adjusted": true/false,
    "jargon_used_appropriately": true/false,
    "notes": ""
  }},
  "emotional_adaptation": {{
    "score": 0-5,
    "caller_emotion_arc": "describe how caller's emotion changed across the call",
    "agent_adapted": true/false,
    "notes": ""
  }},
  "overall_adaptation_score": 0-5,
  "best_moment": "describe the best moment of adaptation",
  "worst_moment": "describe the worst moment of missed adaptation"
}}
"""


async def evaluate_adaptation(transcript: str) -> dict:
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": ADAPTIVE_EVAL_PROMPT.format(transcript=transcript[:5000])}],
                    "temperature": 0,
                    "response_format": {"type": "json_object"},
                },
            )
            return json.loads(resp.json()["choices"][0]["message"]["content"])
    except Exception as e:
        logger.exception(f"Adaptive evaluation failed: {e}")
        return {"overall_adaptation_score": -1, "error": str(e)}
