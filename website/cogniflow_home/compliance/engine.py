"""Real-time compliance monitoring during calls.

Detects PCI card numbers, PII (Aadhaar, PAN, SSN, email),
prompt injection attempts, and missed disclosures.
"""

import logging
import re
import time

logger = logging.getLogger("cogniflow_home.compliance")


CARD_PATTERNS = [
    re.compile(
        r"\b(?:4[0-9]{3}|5[1-5][0-9]{2}|3[47][0-9]|6(?:011|5[0-9]{2}))"
        r"[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}[\s\-]?[0-9]{0,4}\b"
    ),
]

PII_PATTERNS = {
    "aadhaar": re.compile(r"\b[2-9][0-9]{3}\s?[0-9]{4}\s?[0-9]{4}\b"),
    "pan": re.compile(r"\b[A-Z]{5}[0-9]{4}[A-Z]\b"),
    "ssn": re.compile(r"\b[0-9]{3}[\-\s]?[0-9]{2}[\-\s]?[0-9]{4}\b"),
    "email": re.compile(r"\b[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Z|a-z]{2,}\b"),
}

INJECTION_PHRASES = [
    "ignore your instructions",
    "forget your rules",
    "you are now",
    "new instructions",
    "system prompt",
    "ignore previous",
    "disregard your",
    "override your",
]

DEFAULT_DISCLOSURES = {
    "recording_consent": {
        "phrases": [
            "this call may be recorded",
            "this call is being recorded",
        ],
        "deadline_seconds": 30,
    },
    "ai_disclosure": {
        "phrases": [
            "you're speaking with an ai",
            "this is an automated assistant",
            "i'm an ai assistant",
            "i am an ai",
        ],
        "deadline_seconds": 15,
    },
}


class ComplianceEngine:

    def __init__(self, disclosures: dict | None = None):
        self.disclosures = disclosures or DEFAULT_DISCLOSURES
        self._disclosed: set[str] = set()

    def monitor_transcript(self, text: str) -> tuple[str, list[dict]]:
        events = []
        redacted = text

        for pattern in CARD_PATTERNS:
            if pattern.search(redacted):
                events.append({
                    "type": "pci_violation",
                    "action": "mute_recording",
                    "severity": "critical",
                    "detail": "Credit card number detected in transcript",
                })
                redacted = pattern.sub("[CARD_REDACTED]", redacted)

        for pii_type, pattern in PII_PATTERNS.items():
            if pattern.search(redacted):
                events.append({
                    "type": "pii_detected",
                    "action": "redact_transcript",
                    "severity": "warning",
                    "detail": f"{pii_type} detected — redacting from transcript",
                })
                redacted = pattern.sub(f"[{pii_type.upper()}_REDACTED]", redacted)

        text_lower = text.lower()
        for phrase in INJECTION_PHRASES:
            if phrase in text_lower:
                events.append({
                    "type": "prompt_injection_attempt",
                    "action": "block_and_log",
                    "severity": "critical",
                    "detail": f"Possible prompt injection: '{phrase}'",
                })

        for event in events:
            logger.warning(f"Compliance: {event['type']} — {event['detail']}")

        return redacted, events

    def check_disclosures(self, call_start_time: float, agent_transcript: str) -> list[dict]:
        violations = []
        elapsed = time.time() - call_start_time
        text_lower = agent_transcript.lower()

        for name, rule in self.disclosures.items():
            if name in self._disclosed:
                continue

            phrase_said = any(p in text_lower for p in rule["phrases"])
            if phrase_said:
                self._disclosed.add(name)
            elif elapsed > rule["deadline_seconds"]:
                violations.append({
                    "type": "disclosure_missed",
                    "action": "alert_supervisor",
                    "severity": "high",
                    "detail": (
                        f"Required disclosure '{name}' not made within "
                        f"{rule['deadline_seconds']}s deadline"
                    ),
                })
                logger.warning(f"Compliance: disclosure '{name}' missed")

        return violations

    def redact_for_storage(self, text: str) -> str:
        redacted = text
        for pattern in CARD_PATTERNS:
            redacted = pattern.sub("[CARD_REDACTED]", redacted)
        for pii_type, pattern in PII_PATTERNS.items():
            redacted = pattern.sub(f"[{pii_type.upper()}_REDACTED]", redacted)
        return redacted
