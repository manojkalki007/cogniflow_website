"""Agent behavioral cloning from human call recordings.

Analyzes recordings of a human agent and generates a system prompt
that mirrors their communication style. No fine-tuning needed.
"""

import logging

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.cloning")

ANALYSIS_PROMPT = """
Analyse these {count} call transcripts from a human agent named {name}.
Extract their communication patterns:

1. OPENING STYLE: How do they greet callers? Formal or casual?
2. PACING: Short sentences or long explanations? How many words per turn?
3. EMPATHY PATTERNS: How do they handle frustrated callers?
   What exact phrases do they use to acknowledge frustration?
4. OBJECTION HANDLING: When a caller says no or pushes back,
   how does this agent respond? What techniques do they use?
5. CLOSING TECHNIQUE: How do they end calls? Do they summarise?
   Do they ask "is there anything else"?
6. FILLER WORDS: Do they use "um", "so", "actually", "great question"?
7. UNIQUE PHRASES: Any signature phrases they repeat across calls?
8. TONE: Warm? Professional? Energetic? Calm?
9. INFORMATION DELIVERY: Do they give all info at once or ask
   questions first? Do they confirm understanding?
10. UPSELL/CROSS-SELL: Do they proactively suggest additional
    services? How do they transition to it?

Transcripts:
{transcripts}

Respond with a detailed analysis for each of the 10 categories above.
Use SPECIFIC EXAMPLES from the transcripts to illustrate each pattern.
"""

PROMPT_GEN_TEMPLATE = """
Based on this analysis of human agent {name}'s communication style:

{analysis}

Generate a system prompt for an AI voice agent that EXACTLY mirrors
{name}'s communication patterns. The prompt should:

1. Capture their exact greeting style (use their actual words)
2. Match their sentence length and pacing
3. Include their empathy phrases verbatim
4. Replicate their objection handling technique
5. Mirror their closing style
6. Include their filler words and signature phrases
7. Set the right tone

The prompt should be written in second person ("You are...")
and be specific enough that the AI agent feels like {name}
on the phone.

DO NOT make it generic. Every line should be informed by the
actual analysis above. If {name} says "absolutely" a lot,
the prompt should say "Use 'absolutely' frequently."

Also add these critical voice rules at the end:
- ALWAYS start your response with a short acknowledgment (3-6 words).
- Keep all sentences SHORT. Max 15 words per sentence.
- Never use lists, bullet points, or formatting. This is a phone call.
- Say numbers as words: "four hundred fifty" not "450".
"""


class AgentCloner:

    async def clone_from_recordings(
        self,
        recording_urls: list[str],
        agent_name: str,
    ) -> str:
        transcripts = []
        for url in recording_urls:
            transcript = await self._transcribe(url)
            if transcript:
                transcripts.append(transcript)

        if not transcripts:
            raise ValueError("No transcripts could be extracted from recordings")

        formatted = "\n\n---\n\n".join(
            f"Call {i+1}:\n{t}" for i, t in enumerate(transcripts)
        )

        analysis = await self._call_llm(
            ANALYSIS_PROMPT.format(
                count=len(transcripts),
                name=agent_name,
                transcripts=formatted,
            )
        )

        system_prompt = await self._call_llm(
            PROMPT_GEN_TEMPLATE.format(
                name=agent_name,
                analysis=analysis,
            )
        )

        logger.info(
            f"Agent cloned from {len(transcripts)} recordings: {agent_name}"
        )
        return system_prompt

    async def _transcribe(self, audio_url: str) -> str | None:
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    "https://api.deepgram.com/v1/listen",
                    headers={
                        "Authorization": f"Token {settings.deepgram_api_key}",
                        "Content-Type": "application/json",
                    },
                    json={"url": audio_url},
                    params={
                        "model": "nova-3",
                        "smart_format": "true",
                        "diarize": "true",
                        "utterances": "true",
                    },
                )
                data = response.json()
                utterances = (
                    data.get("results", {})
                    .get("utterances", [])
                )
                if utterances:
                    return "\n".join(
                        f"Speaker {u.get('speaker', '?')}: {u.get('transcript', '')}"
                        for u in utterances
                    )
                alternatives = (
                    data.get("results", {})
                    .get("channels", [{}])[0]
                    .get("alternatives", [{}])
                )
                if alternatives:
                    return alternatives[0].get("transcript", "")
                return None
        except Exception:
            logger.exception(f"Failed to transcribe: {audio_url}")
            return None

    async def _call_llm(self, prompt: str) -> str:
        from openai import AsyncOpenAI

        client = AsyncOpenAI(api_key=settings.groq_api_key, base_url="https://api.groq.com/openai/v1")
        resp = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            max_tokens=2000,
            temperature=0.7,
        )
        return resp.choices[0].message.content.strip()
