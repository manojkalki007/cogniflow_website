"""Post-call AI analysis.

Runs after every completed call to extract:
- Sentiment (positive/negative/neutral + score)
- Quality score (0-1)
- Action items
- Disposition (interested/not_interested/callback/booked/etc)

Enable by calling register(). Subscribes to call.completed events
and updates the call record with analysis results.
"""

import logging
from typing import Any
import json

from openai import AsyncOpenAI

from cogniflow_home.config import settings
from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

logger = logging.getLogger("cogniflow_home.analysis")

_llm = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")

ANALYSIS_PROMPT = """Analyze this phone call transcript and return a JSON object with:
{
  "sentiment": "positive" | "negative" | "neutral",
  "sentiment_score": float from -1.0 (very negative) to 1.0 (very positive),
  "quality_score": float from 0.0 to 1.0 (how well the agent handled the call),
  "disposition": one of "interested", "not_interested", "callback_requested", "appointment_booked", "information_provided", "complaint", "wrong_number", "no_answer", "other",
  "action_items": list of strings (things to follow up on)
}

Return ONLY the JSON object, no other text."""


async def analyze_call(event: str, data: dict[str, Any]):
    transcript = data.get("transcript", [])
    if len(transcript) < 2:
        return

    text = "\n".join(f"{t['role']}: {t['text']}" for t in transcript)

    try:
        resp = await _llm.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": ANALYSIS_PROMPT},
                {"role": "user", "content": text},
            ],
            max_tokens=300,
            response_format={"type": "json_object"},
        )
        analysis = json.loads(resp.choices[0].message.content)

        await db.update("calls", {"id": data["call_id"]}, {
            "sentiment": analysis.get("sentiment"),
            "sentiment_score": analysis.get("sentiment_score"),
            "quality_score": analysis.get("quality_score"),
            "disposition": analysis.get("disposition"),
            "action_items": analysis.get("action_items", []),
        })
        logger.info(f"Call {data['call_id']} analyzed: {analysis.get('disposition')}")

    except Exception:
        logger.exception(f"Post-call analysis failed for {data.get('call_id')}")


def register():
    bus.on("call.completed", analyze_call)
    logger.info("Post-call analysis registered")
