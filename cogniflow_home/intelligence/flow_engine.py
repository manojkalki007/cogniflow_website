"""Conversation Flow Engine — state machine for call progression.

The LLM generates the words, but the flow engine controls WHAT the agent
should be doing at each stage. This prevents:
- Skipping required data collection
- Going off-topic
- Losing track of where the conversation is
- Asking the same thing twice

Each stage defines:
- goal: what to accomplish (injected into LLM context)
- required_fields: must be collected before advancing
- available_tools: which tools the LLM can use in this stage
- transitions: conditions that move to the next stage
- max_turns: safety valve to prevent getting stuck

The engine is optional — agents without a flow config get unconstrained behavior.
"""

import logging
from dataclasses import dataclass, field

logger = logging.getLogger("cogniflow_home.intelligence.flow")


@dataclass
class FlowStage:
    name: str
    goal: str
    required_fields: list[str] = field(default_factory=list)
    available_tools: list[str] = field(default_factory=list)
    transitions: dict[str, str] = field(default_factory=dict)
    max_turns: int = 10
    prompt_injection: str = ""


DEFAULT_FLOW = [
    FlowStage(
        name="greeting",
        goal="Greet the caller, introduce yourself briefly. One sentence max.",
        max_turns=1,
        transitions={"always": "qualify"},
    ),
    FlowStage(
        name="qualify",
        goal="Understand what the caller needs. Ask ONE question at a time to qualify them.",
        required_fields=["name"],
        available_tools=["query_crm", "collect_info"],
        max_turns=6,
        transitions={
            "callback_requested": "schedule",
            "fields_collected": "pitch",
            "not_interested": "close",
        },
        prompt_injection=(
            "CURRENT GOAL: Qualify the caller. Find out their name and what they need. "
            "Ask ONE question, then wait for the answer."
        ),
    ),
    FlowStage(
        name="pitch",
        goal="Present the solution based on what you learned. Keep it brief and relevant.",
        available_tools=[
            "check_availability", "send_whatsapp", "create_payment_link",
            "push_to_leadrat", "collect_info",
        ],
        max_turns=8,
        transitions={
            "wants_appointment": "book",
            "callback_requested": "schedule",
            "objection": "handle_objection",
            "not_interested": "close",
        },
        prompt_injection=(
            "CURRENT GOAL: Present the value proposition based on their needs. "
            "Be concise — 1-2 sentences, then check if they have questions."
        ),
    ),
    FlowStage(
        name="handle_objection",
        goal="Address the caller's concern directly. Acknowledge first, then respond.",
        available_tools=["check_availability", "send_whatsapp", "collect_info"],
        max_turns=4,
        transitions={
            "resolved": "pitch",
            "wants_appointment": "book",
            "callback_requested": "schedule",
            "not_interested": "close",
        },
        prompt_injection=(
            "CURRENT GOAL: Address their concern. Acknowledge it first, "
            "then offer a clear response. Don't be pushy."
        ),
    ),
    FlowStage(
        name="book",
        goal="Book the appointment. Collect date, time, and email.",
        required_fields=["date", "time"],
        available_tools=[
            "check_availability", "book_appointment", "collect_info",
            "send_whatsapp",
        ],
        max_turns=6,
        transitions={
            "booked": "close",
            "callback_requested": "schedule",
        },
        prompt_injection=(
            "CURRENT GOAL: Book the appointment. You need their preferred date and time. "
            "Check availability first, then confirm and book."
        ),
    ),
    FlowStage(
        name="schedule",
        goal="Schedule a callback. Get the preferred time, confirm, then end the call.",
        available_tools=["schedule_callback", "end_call"],
        max_turns=4,
        transitions={
            "scheduled": "close",
        },
        prompt_injection=(
            "CURRENT GOAL: Schedule a callback. Ask when they'd like to be called back, "
            "confirm the time, then use schedule_callback and end the call."
        ),
    ),
    FlowStage(
        name="close",
        goal="Wrap up the call naturally. Brief summary if needed, then goodbye.",
        available_tools=[
            "end_call", "save_contact_info", "update_crm", "send_followup",
            "send_email",
        ],
        max_turns=3,
        transitions={},
        prompt_injection=(
            "CURRENT GOAL: Close the conversation. Brief goodbye. "
            "Save any unsaved contact info, then end the call."
        ),
    ),
]

_ALWAYS_TOOLS = {"schedule_callback", "end_call", "handoff_to_human", "collect_info"}

_INTENT_KEYWORDS = {
    "callback_requested": [
        "busy", "meeting", "driving", "call back", "call later", "not free",
        "not now", "can't talk", "in a meeting", "call me back",
    ],
    "not_interested": [
        "not interested", "don't want", "no thanks", "stop calling",
        "remove my number", "don't call",
    ],
    "wants_appointment": [
        "book", "appointment", "schedule", "visit", "come see",
        "site visit", "meeting", "demo",
    ],
    "objection": [
        "too expensive", "too much", "not sure", "think about it",
        "competitor", "already have", "why should",
    ],
}


class ConversationFlowEngine:
    """Manages conversation stage progression."""

    def __init__(self, stages: list[FlowStage] | None = None):
        self._stages = {s.name: s for s in (stages or DEFAULT_FLOW)}
        self._stage_order = [s.name for s in (stages or DEFAULT_FLOW)]
        self._current_stage_name = self._stage_order[0] if self._stage_order else "greeting"
        self._turn_count = 0
        self._collected_fields: set[str] = set()
        self._events: list[str] = []

    @property
    def current_stage(self) -> FlowStage:
        return self._stages.get(self._current_stage_name, DEFAULT_FLOW[0])

    @property
    def stage_name(self) -> str:
        return self._current_stage_name

    def record_field_collected(self, field_name: str):
        self._collected_fields.add(field_name)

    def record_tool_called(self, tool_name: str):
        if tool_name == "schedule_callback":
            self._events.append("callback_requested")
            self._events.append("scheduled")
        elif tool_name == "book_appointment":
            self._events.append("booked")
        elif tool_name == "end_call":
            self._events.append("call_ended")

    def get_stage_context(self) -> str:
        stage = self.current_stage
        parts = [stage.prompt_injection or f"CURRENT GOAL: {stage.goal}"]

        if stage.required_fields:
            missing = [f for f in stage.required_fields if f not in self._collected_fields]
            if missing:
                parts.append(f"STILL NEED: {', '.join(missing)}")
            else:
                parts.append("All required info collected — ready to advance.")

        return "\n".join(parts)

    def get_available_tools(self, all_tools: list[dict]) -> list[dict]:
        stage = self.current_stage
        if not stage.available_tools:
            return all_tools

        allowed = set(stage.available_tools) | _ALWAYS_TOOLS
        return [t for t in all_tools if t["function"]["name"] in allowed]

    def advance(self, user_text: str) -> str | None:
        """Check if we should transition. Returns new stage name or None."""
        self._turn_count += 1
        stage = self.current_stage

        if self._turn_count >= stage.max_turns:
            next_stage = self._next_stage()
            if next_stage:
                return self._transition_to(next_stage)

        detected_intent = self._detect_intent(user_text)
        if detected_intent and detected_intent in stage.transitions:
            target = stage.transitions[detected_intent]
            return self._transition_to(target)

        for event in list(self._events):
            if event in stage.transitions:
                target = stage.transitions[event]
                self._events.remove(event)
                return self._transition_to(target)

        if "fields_collected" in stage.transitions and stage.required_fields:
            if all(f in self._collected_fields for f in stage.required_fields):
                target = stage.transitions["fields_collected"]
                return self._transition_to(target)

        if "always" in stage.transitions:
            return self._transition_to(stage.transitions["always"])

        return None

    def _detect_intent(self, text: str) -> str | None:
        text_lower = text.lower()
        best_intent = None
        best_count = 0
        for intent, keywords in _INTENT_KEYWORDS.items():
            count = sum(1 for kw in keywords if kw in text_lower)
            if count > best_count:
                best_count = count
                best_intent = intent
        return best_intent if best_count > 0 else None

    def _next_stage(self) -> str | None:
        try:
            idx = self._stage_order.index(self._current_stage_name)
            if idx + 1 < len(self._stage_order):
                return self._stage_order[idx + 1]
        except ValueError:
            pass
        return None

    def _transition_to(self, stage_name: str) -> str | None:
        if stage_name not in self._stages:
            return None
        logger.info(f"Flow: {self._current_stage_name} → {stage_name}")
        self._current_stage_name = stage_name
        self._turn_count = 0
        return stage_name

    def get_summary(self) -> dict:
        return {
            "current_stage": self._current_stage_name,
            "turns_in_stage": self._turn_count,
            "collected_fields": sorted(self._collected_fields),
            "events": list(self._events),
        }
