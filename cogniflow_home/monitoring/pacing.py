"""
Analyse the flow and pacing of a completed conversation.
"""

import logging

logger = logging.getLogger(__name__)


class PacingAnalyzer:
    """Evaluate conversation pacing and flow."""

    def analyse(self, transcript: list[dict]) -> dict:
        if not transcript:
            return {}

        agent_turns = [t for t in transcript if t["role"] == "assistant"]
        user_turns = [t for t in transcript if t["role"] == "user"]
        n_agent = len(agent_turns)
        n_user = len(user_turns)
        total_turns = len(transcript)

        agent_questions = sum(
            1 for t in agent_turns
            if "?" in t["content"]
        )

        max_consecutive_questions = 0
        current_streak = 0
        for t in transcript:
            if t["role"] == "assistant" and "?" in t["content"]:
                current_streak += 1
                max_consecutive_questions = max(max_consecutive_questions, current_streak)
            elif t["role"] == "user":
                current_streak = 0

        q_ratio = agent_questions / n_agent if n_agent else 0

        action_keywords = [
            "booked", "scheduled", "confirmed", "processed", "sent",
            "updated", "created", "cancelled", "transferred", "resolved",
        ]
        resolution_turn = None
        for i, t in enumerate(transcript):
            if t["role"] == "assistant":
                content_lower = t["content"].lower()
                if any(kw in content_lower for kw in action_keywords):
                    resolution_turn = i
                    break

        if agent_turns:
            last_agent = agent_turns[-1]["content"].lower()
            has_summary = any(w in last_agent for w in ["so to summarize", "to recap", "in summary", "i've"])
            has_anything_else = any(w in last_agent for w in ["anything else", "something else", "other questions"])
            has_warm_close = any(w in last_agent for w in ["thank you", "have a great", "take care", "pleasure", "lovely"])
            closing_score = sum([has_summary, has_anything_else, has_warm_close])
        else:
            closing_score = 0
            has_summary = False
            has_anything_else = False
            has_warm_close = False

        return {
            "total_turns": total_turns,
            "agent_turns": n_agent,
            "user_turns": n_user,
            "agent_questions": agent_questions,
            "question_to_answer_ratio": round(q_ratio, 2),
            "max_consecutive_questions": max_consecutive_questions,
            "interrogation_detected": max_consecutive_questions >= 3,
            "resolution_turn": resolution_turn,
            "resolution_velocity": resolution_turn if resolution_turn else "unresolved",
            "closing_elements": {
                "has_summary": has_summary,
                "has_anything_else": has_anything_else,
                "has_warm_close": has_warm_close,
                "closing_score": closing_score,
            },
            "issues": self._flag_issues(
                q_ratio, max_consecutive_questions, resolution_turn, closing_score, total_turns
            ),
        }

    def _flag_issues(self, q_ratio, consec_q, res_turn, close_score, total):
        issues = []
        if q_ratio > 0.8:
            issues.append("Interrogation pattern: agent asks too many questions, not enough answers")
        if q_ratio < 0.1:
            issues.append("Monologue pattern: agent never asks questions — not a conversation")
        if consec_q >= 3:
            issues.append(f"Interrogation: {consec_q} consecutive questions without giving any information")
        if res_turn and res_turn > 16:
            issues.append(f"Slow resolution: took {res_turn} turns to reach first action (target: <8)")
        if close_score < 2:
            issues.append("Weak closing: missing summary, 'anything else?', or warm goodbye")
        return issues
