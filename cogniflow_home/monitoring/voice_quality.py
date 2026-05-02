import logging
import httpx
from cogniflow_home.config import settings

logger = logging.getLogger(__name__)

class VoiceQualityEvaluator:
    EMOTION_TEST_PHRASES = {
        "empathy": [
            "I completely understand your frustration, and I'm here to help.",
            "I'm sorry you're going through this. Let me take care of it right now.",
        ],
        "enthusiasm": [
            "That's wonderful news! I'm so happy we could help!",
            "Congratulations! Everything is all set for you!",
        ],
        "calm_authority": [
            "Let me walk you through this step by step.",
            "Here's exactly what's going to happen next.",
        ],
        "urgency": [
            "I need to flag this immediately. Let me connect you right now.",
            "This is time-sensitive. I'm processing this as priority.",
        ],
        "warmth": [
            "It was lovely speaking with you today. Take care!",
            "Thank you so much for your patience. You've been wonderful.",
        ],
    }

    async def evaluate_tts_emotions(self, tts_engine) -> dict:
        results = {}
        for emotion, phrases in self.EMOTION_TEST_PHRASES.items():
            scores = []
            for phrase in phrases:
                try:
                    audio_chunks = []
                    async for chunk in tts_engine.synthesize(phrase):
                        audio_chunks.append(chunk)
                    total_bytes = sum(len(c) for c in audio_chunks)
                    score = await self._score_emotion_alignment(phrase, emotion)
                    scores.append(score)
                except Exception as e:
                    logger.error(f"TTS emotion test failed for {emotion}: {e}")
                    scores.append(0)
            results[emotion] = {
                "avg_score": round(sum(scores) / len(scores), 1) if scores else 0,
                "phrases_tested": len(phrases),
            }
        return results

    async def _score_emotion_alignment(self, phrase: str, target_emotion: str) -> float:
        prompt = f"""Rate this phrase for conveying '{target_emotion}' emotion on a scale of 1-5:
Phrase: "{phrase}"
5 = perfectly conveys {target_emotion}
3 = somewhat conveys it
1 = wrong emotion entirely
Reply with just the number."""
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {settings.groq_api_key}"},
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": prompt}],
                        "temperature": 0,
                        "max_tokens": 5,
                    },
                )
                data = resp.json()
                score_text = data["choices"][0]["message"]["content"].strip()
                return min(max(float(score_text), 1.0), 5.0)
        except Exception:
            return 3.0

    async def measure_tts_ttfb(self, tts_engine, test_text: str = "Hello, how can I help you today?") -> float:
        import time
        start = time.perf_counter()
        try:
            async for chunk in tts_engine.synthesize(test_text):
                return round((time.perf_counter() - start) * 1000, 1)
        except Exception:
            return -1
        return -1
