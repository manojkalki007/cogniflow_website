"""
Predictive pre-call intent engine.

When a known caller connects, analyse their recent activity to predict
why they're calling. Feed the prediction to the agent so it can greet
them proactively.
"""

import logging
from datetime import datetime, timezone

from cogniflow_home.db.supabase import db

logger = logging.getLogger(__name__)


class PreCallPredictor:
    """Predict why a caller is calling based on their history."""

    async def predict(self, phone_number: str) -> dict | None:
        calls = await db.select(
            "calls",
            {"caller_number": f"eq.{phone_number}"},
            order="created_at.desc",
            limit=5,
        )

        if not calls:
            return None

        contacts = await db.select("contacts", {"phone_number": f"eq.{phone_number}"})
        contact = contacts[0] if contacts else {}

        last_call = calls[0]
        last_intent = last_call.get("intent_primary")
        last_summary = last_call.get("summary", "")
        last_disposition = last_call.get("disposition")
        days_since_last = self._days_since(last_call.get("created_at"))

        if last_disposition in ("unresolved", "callback_requested", "escalated"):
            return {
                "predicted_intent": last_intent or "follow_up",
                "confidence": 0.85,
                "context": f"Last call ({days_since_last} days ago) was unresolved: {last_summary}",
                "suggested_greeting": self._build_followup_greeting(
                    contact.get("name"), last_summary
                ),
            }

        intents = [c.get("intent_primary") for c in calls if c.get("intent_primary")]
        if intents and len(intents) >= 2:
            most_common = max(set(intents), key=intents.count)
            if intents.count(most_common) >= 2:
                return {
                    "predicted_intent": most_common,
                    "confidence": 0.70,
                    "context": f"Called about '{most_common}' {intents.count(most_common)} times recently",
                    "suggested_greeting": self._build_recurring_greeting(
                        contact.get("name"), most_common
                    ),
                }

        if days_since_last and days_since_last <= 3:
            return {
                "predicted_intent": last_intent or "follow_up",
                "confidence": 0.60,
                "context": f"Called {days_since_last} day(s) ago about: {last_summary}",
                "suggested_greeting": self._build_recent_greeting(
                    contact.get("name"), last_summary
                ),
            }

        return None

    def build_prediction_prompt(self, prediction: dict) -> str:
        return (
            f"\n[PRE-CALL PREDICTION — confidence {prediction['confidence']:.0%}]\n"
            f"Predicted intent: {prediction['predicted_intent']}\n"
            f"Context: {prediction['context']}\n"
            f"Suggested greeting: {prediction['suggested_greeting']}\n"
            f"\nUse the suggested greeting if confidence is above 70%. "
            f"If below 70%, use a softer version: 'Welcome back! How can I help today?'\n"
            f"If the prediction is wrong, smoothly pivot: 'No problem! What can I help with instead?'"
        )

    def _days_since(self, iso_date: str | None) -> int | None:
        if not iso_date:
            return None
        try:
            dt = datetime.fromisoformat(iso_date.replace("Z", "+00:00"))
            return (datetime.now(timezone.utc) - dt).days
        except Exception:
            return None

    def _build_followup_greeting(self, name: str | None, summary: str) -> str:
        name_part = f"Hi {name}" if name else "Hi there"
        short_summary = summary[:100] if summary else "your previous inquiry"
        return f"{name_part}, welcome back! I see we spoke recently about {short_summary}. Has that been resolved, or would you like to continue where we left off?"

    def _build_recurring_greeting(self, name: str | None, intent: str) -> str:
        name_part = f"Hi {name}" if name else "Hi there"
        return f"{name_part}, welcome back! Are you calling about {intent} again? I'd like to make sure we get this fully resolved for you today."

    def _build_recent_greeting(self, name: str | None, summary: str) -> str:
        name_part = f"Hi {name}" if name else "Hi there"
        return f"{name_part}, good to hear from you again! Is this about {summary[:80]}?"


pre_call_predictor = PreCallPredictor()
