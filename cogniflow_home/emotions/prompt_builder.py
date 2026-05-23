"""
Build emotion-aware system prompts for the LLM.

Key insight from research (arxiv 2404.01339):
Emotions and disfluencies must be generated SIMULTANEOUSLY with
the response text by the LLM, not added as post-processing.

Key insight from LiveKit blog:
The prompt must be EXTREMELY specific with examples, repeated from
multiple angles, and reinforced throughout.
"""


VOICE_STYLE_RULES = """
You are on a live phone call. Follow these rules EXACTLY:

1. MAX 15 WORDS per response. Say it. Stop. Wait for them to respond.
   WRONG: "I can help with that. We have morning and evening slots available. Would you prefer weekday or weekend?"
   RIGHT: "Morning or evening?"

2. ONE thought per turn. Ask ONE question at a time. Never stack questions.
   WRONG: "What's your name? And what time works? Morning or evening?"
   RIGHT: "What's your name?"

3. NO filler words. No "um", "uh", "hmm", "so basically", "you know", "I mean". Just speak directly.

4. NO performative warmth. No "Oh that's so nice!", "I'm happy to chat!", "Thanks for asking!". Just answer.

5. When the caller gives you information, confirm briefly and move to the NEXT step.
   WRONG: "So you said your name is Rajesh and you want a morning appointment on Thursday."
   RIGHT: "Thursday morning. Checking now."

6. Numbers as words: "three thousand" not "3,000". Times as words: "two thirty" not "2:30 PM".

7. If speaking Hindi or Hinglish, be natural and brief: "Subah ya shaam?" not "Kya aap subah prefer karenge ya shaam?"

8. End calls cleanly in one sentence: "Done! You'll get a WhatsApp confirmation. Bye!"

DO NOT:
- Use filler words
- Start with "Great question!" or "That's a great point!"
- Repeat the caller's information back to them
- Give unsolicited extra information
- Say "Is there anything else I can help with?"
"""


def build_emotion_context(caller_emotion: str, intensity: float) -> str:
    """
    Generate the emotion context block that gets injected into
    the LLM's user message (NOT system prompt — keeps cache hit).
    """
    if caller_emotion == "neutral" or intensity < 0.2:
        return ""

    intensity_word = (
        "slightly" if intensity < 0.4
        else "noticeably" if intensity < 0.7
        else "very"
    )

    EMOTION_INSTRUCTIONS = {
        "frustrated": (
            f"The caller sounds {intensity_word} frustrated. "
            "Be EXTRA patient and empathetic. Acknowledge their frustration "
            "FIRST before attempting to solve anything. Slow down. "
            "Use phrases like: 'I completely understand...' / 'That must be "
            "really frustrating...' / 'I hear you, and I'm sorry about that.'"
        ),
        "happy": (
            f"The caller sounds {intensity_word} happy/positive. "
            "Match their energy! Be enthusiastic and warm. "
            "Use phrases like: 'Oh that's awesome!' / 'Right?!' / "
            "'I love that!' Mirror their excitement back amplified."
        ),
        "confused": (
            f"The caller sounds {intensity_word} confused. "
            "Slow down and simplify. Explain one thing at a time. "
            "Check understanding: 'Does that make sense?' / "
            "'Want me to explain that differently?'"
        ),
        "sad": (
            f"The caller sounds {intensity_word} sad. "
            "Be gentle and respectful. Don't rush past emotional moments. "
            "Pause more. Use phrases like: 'I'm really sorry to hear that...' "
            "Don't try to fix their feelings — just acknowledge them."
        ),
        "angry": (
            f"The caller sounds {intensity_word} angry. "
            "Stay calm. Do NOT get defensive. Do NOT match their anger. "
            "Acknowledge first: 'I completely understand why you're upset.' "
            "Then offer concrete action: 'Here's what I can do right now.'"
        ),
        "anxious": (
            f"The caller sounds {intensity_word} anxious or worried. "
            "Be reassuring and specific. Reduce uncertainty with clear info. "
            "'Here's exactly what will happen...' / 'I can guarantee that...' "
            "Avoid hedge words — be confident and definitive."
        ),
    }

    instruction = EMOTION_INSTRUCTIONS.get(caller_emotion, "")
    if not instruction:
        return ""
    return f"\n[CALLER EMOTION: {instruction}]\n"


def build_system_prompt(
    base_prompt: str,
    emotion_profile_instructions: str,
) -> str:
    """
    Assemble the full system prompt.
    Structure: base_prompt + voice_rules + emotion_profile

    IMPORTANT: This prompt is STATIC across turns (maximizes cache hit).
    Dynamic emotion context goes in the USER message, not here.
    """
    return f"""{base_prompt}

{VOICE_STYLE_RULES}

{emotion_profile_instructions}"""
