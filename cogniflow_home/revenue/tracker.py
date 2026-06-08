"""Revenue attribution — tracks calls through the sales funnel.

Auto-classifies calls as qualified leads, appointments, etc.
Links CRM deal closures back to the originating AI call.
"""

import json
import logging

from openai import AsyncOpenAI

from cogniflow_home.config import settings

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
from cogniflow_home.db.supabase import db
from cogniflow_home.events import bus

logger = logging.getLogger("cogniflow_home.revenue")

FUNNEL_STAGES = [
    "call_completed",
    "lead_qualified",
    "appointment_booked",
    "follow_up_sent",
    "deal_created",
    "deal_won",
]

CLASSIFICATION_PROMPT = """
Based on this call transcript and summary, classify:

1. Was a lead qualified? (Did the caller express genuine interest
   and meet basic criteria like budget/need/timeline?)
2. Was an appointment/meeting/demo booked?
3. Was a follow-up action committed? (Agent promised to send info, call back, etc.)
4. What is the estimated deal value if this converts? (Based on
   product/service discussed, in INR)

Summary: {summary}
Transcript (last 3000 chars): {transcript}

Respond in JSON only:
{{
    "lead_qualified": true/false,
    "appointment_booked": true/false,
    "follow_up_needed": true/false,
    "estimated_value": 0,
    "confidence": 0.0-1.0,
    "reasoning": "brief explanation"
}}
"""


class FunnelTracker:

    def __init__(self):
        self._client = AsyncOpenAI(api_key=settings.groq_api_key, base_url=GROQ_BASE_URL)

    async def classify_call(self, call_id: str, transcript: list[dict], summary: str):
        transcript_text = "\n".join(
            f"{t.get('role', 'unknown')}: {t.get('text', '')}" for t in transcript
        )

        try:
            resp = await self._client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {
                        "role": "user",
                        "content": CLASSIFICATION_PROMPT.format(
                            summary=summary,
                            transcript=transcript_text[-3000:],
                        ),
                    }
                ],
                max_tokens=200,
                temperature=0,
                response_format={"type": "json_object"},
            )
            analysis = json.loads(resp.choices[0].message.content)
        except Exception:
            logger.exception(f"Funnel classification failed for call {call_id}")
            return

        stage = "call_completed"
        if analysis.get("appointment_booked"):
            stage = "appointment_booked"
        elif analysis.get("lead_qualified"):
            stage = "lead_qualified"
        elif analysis.get("follow_up_needed"):
            stage = "follow_up_sent"

        update = {
            "funnel_stage": stage,
            "funnel_analysis": analysis,
        }
        estimated = analysis.get("estimated_value", 0)
        if estimated and estimated > 0:
            update["estimated_revenue"] = estimated

        await db.update("calls", {"bolna_call_id": call_id}, update)
        logger.info(
            f"Call {call_id} classified: {stage} "
            f"(value: ₹{estimated}, confidence: {analysis.get('confidence', 0)})"
        )

        await bus.emit("funnel.classified", {
            "call_id": call_id,
            "stage": stage,
            "analysis": analysis,
        })


async def handle_deal_closed(deal_id: str, amount: float, contact_phone: str):
    calls = await db.select("calls", {"phone_number": contact_phone})
    qualified = [
        c for c in calls
        if c.get("funnel_stage") in ("lead_qualified", "appointment_booked")
    ]

    if not qualified:
        logger.info(f"No matching AI call found for deal {deal_id}")
        return

    qualified.sort(key=lambda c: c.get("created_at", ""), reverse=True)
    call = qualified[0]

    await db.update("calls", {"id": call["id"]}, {
        "funnel_stage": "deal_won",
        "revenue_amount": amount,
        "deal_id": deal_id,
    })
    logger.info(
        f"Revenue attributed: deal {deal_id} (₹{amount}) → call {call['id']}"
    )


async def get_revenue_summary(period_days: int = 30) -> dict:
    from datetime import datetime, timedelta, timezone
    cutoff = (datetime.now(timezone.utc) - timedelta(days=period_days)).isoformat()

    calls = await db.select("calls", {"created_at": f"gte.{cutoff}"})

    total = len(calls)
    leads = sum(1 for c in calls if c.get("funnel_stage") == "lead_qualified")
    appointments = sum(1 for c in calls if c.get("funnel_stage") == "appointment_booked")
    deals = sum(1 for c in calls if c.get("funnel_stage") == "deal_won")
    revenue = sum(
        c.get("revenue_amount", 0) or 0
        for c in calls
        if c.get("funnel_stage") == "deal_won"
    )
    conversion = (deals / total * 100) if total > 0 else 0

    return {
        "period_days": period_days,
        "total_calls": total,
        "leads_qualified": leads,
        "appointments_booked": appointments,
        "deals_won": deals,
        "total_revenue": revenue,
        "conversion_rate": round(conversion, 1),
    }


def register():
    tracker = FunnelTracker()

    async def on_call_completed(event: str, data: dict):
        transcript = data.get("transcript", [])
        if len(transcript) < 2:
            return
        summary = data.get("summary", "")
        await tracker.classify_call(data["call_id"], transcript, summary)

    bus.on("call.completed", on_call_completed)
    logger.info("Revenue tracker registered")
