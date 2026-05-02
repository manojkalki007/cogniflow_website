import time
import logging
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

@dataclass
class TurnEvent:
    turn_number: int
    user_speech_end_ms: float
    eot_fired_ms: float
    agent_first_audio_ms: float
    agent_speech_end_ms: float
    was_interruption: bool = False
    user_resumed_after_eot: bool = False

    @property
    def turn_gap_ms(self) -> float:
        return self.agent_first_audio_ms - self.user_speech_end_ms

    @property
    def eot_decision_ms(self) -> float:
        return self.eot_fired_ms - self.user_speech_end_ms

    @property
    def generation_latency_ms(self) -> float:
        return self.agent_first_audio_ms - self.eot_fired_ms


class TurnQualityAnalyzer:
    def __init__(self):
        self.turns: list[TurnEvent] = []
        self._current_turn = 0

    def record_turn(self, event: TurnEvent):
        self.turns.append(event)
        self._current_turn += 1
        if event.turn_gap_ms > 800:
            logger.warning(
                f"SLOW TURN #{event.turn_number}: "
                f"{event.turn_gap_ms:.0f}ms gap — "
                f"EOT={event.eot_decision_ms:.0f}ms, "
                f"gen={event.generation_latency_ms:.0f}ms"
            )

    def get_summary(self) -> dict:
        if not self.turns:
            return {}
        gaps = [t.turn_gap_ms for t in self.turns]
        gaps_sorted = sorted(gaps)
        n = len(gaps_sorted)
        false_endpoints = sum(1 for t in self.turns if t.user_resumed_after_eot)
        interruptions = sum(1 for t in self.turns if t.was_interruption)
        return {
            "total_turns": n,
            "turn_gap_p50_ms": round(gaps_sorted[n // 2], 1) if n else 0,
            "turn_gap_p95_ms": round(gaps_sorted[int(n * 0.95)], 1) if n else 0,
            "turn_gap_max_ms": round(max(gaps), 1) if gaps else 0,
            "false_endpoint_rate": round(false_endpoints / n * 100, 1) if n else 0,
            "interruption_count": interruptions,
            "avg_eot_decision_ms": round(sum(t.eot_decision_ms for t in self.turns) / n, 1) if n else 0,
            "avg_generation_latency_ms": round(sum(t.generation_latency_ms for t in self.turns) / n, 1) if n else 0,
        }
