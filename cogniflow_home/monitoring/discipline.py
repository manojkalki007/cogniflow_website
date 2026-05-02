"""
Detect conversational anti-patterns:
rambling, repetition, loops, filler abuse, dead-ends.
"""

import logging
from collections import Counter

logger = logging.getLogger(__name__)


class DisciplineAnalyzer:
    """Analyse conversational discipline from a transcript."""

    FILLER_PHRASES = {
        "absolutely", "great question", "of course", "that's a great question",
        "no problem at all", "happy to help", "i'd be happy to",
        "definitely", "certainly", "sure thing",
    }

    DEAD_END_PHRASES = {
        "i can't help with that", "that's not something i can do",
        "i don't have access to that", "there's nothing i can do",
        "you'll need to call back",
    }

    CIRCULAR_PHRASES = {
        "i understand", "i hear you", "i'm here to help",
        "let me help you with that", "i'll take care of that",
    }

    def analyse(self, transcript: list[dict]) -> dict:
        """
        Analyse agent behaviour from structured transcript.
        transcript: [{"role": "user"|"assistant", "content": "..."}]
        """
        agent_turns = [t for t in transcript if t["role"] == "assistant"]
        if not agent_turns:
            return {}

        n = len(agent_turns)

        word_counts = [len(t["content"].split()) for t in agent_turns]
        avg_words = sum(word_counts) / n if n else 0
        rambling_turns = sum(1 for wc in word_counts if wc > 30)

        seen_responses = []
        repetitions = 0
        for t in agent_turns:
            content = t["content"].lower().strip()
            for prev in seen_responses:
                words_a = set(content.split())
                words_b = set(prev.split())
                if words_a and words_b:
                    overlap = len(words_a & words_b) / max(len(words_a), len(words_b))
                    if overlap > 0.7 and len(words_a) > 5:
                        repetitions += 1
                        break
            seen_responses.append(content)

        filler_count = 0
        for t in agent_turns:
            content = t["content"].lower()
            for filler in self.FILLER_PHRASES:
                if filler in content:
                    filler_count += 1
                    break

        dead_ends = 0
        for t in agent_turns:
            content = t["content"].lower()
            for phrase in self.DEAD_END_PHRASES:
                if phrase in content:
                    dead_ends += 1
                    break

        circular_counts = Counter()
        for t in agent_turns:
            content = t["content"].lower()
            for phrase in self.CIRCULAR_PHRASES:
                if phrase in content:
                    circular_counts[phrase] += 1
        circular_loops = sum(1 for c in circular_counts.values() if c >= 3)

        monopolised = sum(1 for wc in word_counts if wc > 45)

        return {
            "total_agent_turns": n,
            "avg_words_per_turn": round(avg_words, 1),
            "rambling_rate": round(rambling_turns / n * 100, 1) if n else 0,
            "repetition_rate": round(repetitions / n * 100, 1) if n else 0,
            "filler_abuse_rate": round(filler_count / n * 100, 1) if n else 0,
            "dead_end_count": dead_ends,
            "circular_loop_count": circular_loops,
            "monopolisation_rate": round(monopolised / n * 100, 1) if n else 0,
            "issues": self._flag_issues(
                avg_words, rambling_turns, repetitions,
                filler_count, dead_ends, circular_loops, monopolised, n
            ),
        }

    def _flag_issues(self, avg_words, rambling, reps, fillers, deads, loops, mono, n):
        issues = []
        if avg_words > 25:
            issues.append(f"Avg response too long: {avg_words:.0f} words (target: 8-25)")
        if n > 0 and rambling / n > 0.15:
            issues.append(f"Rambling: {rambling}/{n} turns exceed 30 words")
        if n > 0 and reps / n > 0.03:
            issues.append(f"Repetition: {reps} repeated responses detected")
        if n > 0 and fillers / n > 0.10:
            issues.append(f"Filler abuse: {fillers}/{n} turns start with filler phrases")
        if deads > 0:
            issues.append(f"Dead ends: {deads} turns with no next step offered")
        if loops > 0:
            issues.append(f"Circular loops: {loops} comfort phrases repeated 3+ times without progress")
        if n > 0 and mono / n > 0.15:
            issues.append(f"Monopolising: {mono}/{n} turns exceed 45 words")
        return issues
