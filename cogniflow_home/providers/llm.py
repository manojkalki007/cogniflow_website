"""Streaming LLM responses via OpenAI with function calling support."""

import json
import logging
from typing import AsyncIterator

from openai import AsyncOpenAI

from cogniflow_home.config import settings
from cogniflow_home.providers.tools import TOOL_DEFINITIONS, execute_tool

logger = logging.getLogger("cogniflow_home.llm")


class OpenAILLM:
    def __init__(self, model: str = "gpt-4o-mini", system_prompt: str = ""):
        self.model = model
        self.system_prompt = system_prompt
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
        self.conversation_history: list[dict] = []
        self.call_context: dict = {}
        self.on_tool_call = None
        if system_prompt:
            self.conversation_history.append(
                {"role": "system", "content": system_prompt}
            )

    def add_message(self, role: str, content: str):
        self.conversation_history.append({"role": role, "content": content})
        total_chars = sum(len(m.get("content", "")) for m in self.conversation_history)
        max_chars = 12000
        while total_chars > max_chars and len(self.conversation_history) > 2:
            removed = self.conversation_history.pop(1)
            total_chars -= len(removed.get("content", ""))

    async def generate_stream(self, user_text: str) -> AsyncIterator[str]:
        self.add_message("user", user_text)

        try:
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=self.conversation_history,
                stream=True,
                max_tokens=80,
                temperature=0.7,
                tools=TOOL_DEFINITIONS if TOOL_DEFINITIONS else None,
            )

            full_response = ""
            sentence_buffer = ""
            tool_calls_data: dict[int, dict] = {}

            async for chunk in response:
                delta = chunk.choices[0].delta

                if delta.tool_calls:
                    for tc in delta.tool_calls:
                        idx = tc.index
                        if idx not in tool_calls_data:
                            tool_calls_data[idx] = {"id": "", "name": "", "arguments": ""}
                        if tc.id:
                            tool_calls_data[idx]["id"] = tc.id
                        if tc.function:
                            if tc.function.name:
                                tool_calls_data[idx]["name"] = tc.function.name
                            if tc.function.arguments:
                                tool_calls_data[idx]["arguments"] += tc.function.arguments

                elif delta.content:
                    token = delta.content
                    full_response += token
                    sentence_buffer += token

                    for delimiter in [".", "!", "?", ",", ";", ":"]:
                        if delimiter in sentence_buffer:
                            parts = sentence_buffer.split(delimiter, 1)
                            sentence = parts[0] + delimiter
                            sentence_buffer = parts[1] if len(parts) > 1 else ""
                            sentence = sentence.strip()
                            if sentence:
                                yield sentence
                            break

            if sentence_buffer.strip() and not tool_calls_data:
                yield sentence_buffer.strip()

            if tool_calls_data:
                tool_call_messages = []
                for idx in sorted(tool_calls_data.keys()):
                    tc = tool_calls_data[idx]
                    tool_call_messages.append({
                        "id": tc["id"],
                        "type": "function",
                        "function": {"name": tc["name"], "arguments": tc["arguments"]},
                    })

                self.conversation_history.append({
                    "role": "assistant",
                    "tool_calls": tool_call_messages,
                })

                for tc in tool_call_messages:
                    func_name = tc["function"]["name"]
                    if self.on_tool_call:
                        await self.on_tool_call(func_name)
                    try:
                        func_args = json.loads(tc["function"]["arguments"])
                    except json.JSONDecodeError:
                        func_args = {}

                    logger.info(f"Tool call: {func_name}({func_args})")
                    result = await execute_tool(func_name, func_args, self.call_context)

                    self.conversation_history.append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result,
                    })

                followup = await self.client.chat.completions.create(
                    model=self.model,
                    messages=self.conversation_history,
                    stream=True,
                    max_tokens=80,
                    temperature=0.7,
                )

                followup_text = ""
                followup_buffer = ""
                async for chunk in followup:
                    delta = chunk.choices[0].delta
                    if delta.content:
                        token = delta.content
                        followup_text += token
                        followup_buffer += token

                        for delimiter in [".", "!", "?", ",", ";", ":"]:
                            if delimiter in followup_buffer:
                                parts = followup_buffer.split(delimiter, 1)
                                sentence = parts[0] + delimiter
                                followup_buffer = parts[1] if len(parts) > 1 else ""
                                sentence = sentence.strip()
                                if sentence:
                                    yield sentence
                                break

                if followup_buffer.strip():
                    yield followup_buffer.strip()

                full_response = followup_text

            if full_response.strip():
                self.add_message("assistant", full_response.strip())

        except Exception:
            logger.exception("LLM generation error")
            yield "I'm sorry, I didn't catch that. Could you say that again?"
