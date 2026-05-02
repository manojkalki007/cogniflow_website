"""Streaming LLM via Groq (primary) with OpenAI fallback.

Groq delivers ~80ms TTFT vs OpenAI's 300-500ms.
Falls back to OpenAI automatically if Groq is unavailable.
"""

import json
import logging
from typing import AsyncIterator

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.llm.groq")


class GroqLLM:

    def __init__(
        self,
        model: str = "llama-3.3-70b-versatile",
        fallback_model: str = "gpt-4o-mini",
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 80,
    ):
        self.model = model
        self.fallback_model = fallback_model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.conversation_history: list[dict] = []
        self.call_context: dict = {}
        self.on_tool_call = None

        if system_prompt:
            self.conversation_history.append(
                {"role": "system", "content": system_prompt}
            )

        self._groq_url = "https://api.groq.com/openai/v1/chat/completions"
        self._openai_url = "https://api.openai.com/v1/chat/completions"

    def add_message(self, role: str, content: str):
        self.conversation_history.append({"role": role, "content": content})
        total_chars = sum(len(m.get("content", "")) for m in self.conversation_history)
        max_chars = 12000
        while total_chars > max_chars and len(self.conversation_history) > 2:
            removed = self.conversation_history.pop(1)
            total_chars -= len(removed.get("content", ""))

    async def generate_stream(
        self, user_text: str, tools: list | None = None
    ) -> AsyncIterator[str]:
        self.add_message("user", user_text)

        try:
            async for sentence in self._try_stream(
                self._groq_url,
                settings.groq_api_key,
                self.model,
                tools,
            ):
                yield sentence
        except Exception:
            logger.warning("Groq failed, falling back to OpenAI")
            try:
                async for sentence in self._try_stream(
                    self._openai_url,
                    settings.openai_api_key,
                    self.fallback_model,
                    tools,
                ):
                    yield sentence
            except Exception:
                logger.exception("Both Groq and OpenAI failed")
                yield "I'm sorry, I'm having trouble right now. Could you repeat that?"

    async def _try_stream(
        self,
        url: str,
        api_key: str,
        model: str,
        tools: list | None = None,
    ) -> AsyncIterator[str]:
        if not api_key:
            raise ValueError(f"No API key configured for {url}")

        body: dict = {
            "model": model,
            "messages": self.conversation_history,
            "stream": True,
            "temperature": self.temperature,
            "max_tokens": self.max_tokens,
        }
        if tools:
            body["tools"] = tools

        full_response = ""
        sentence_buffer = ""
        tool_calls_data: dict[int, dict] = {}

        async with httpx.AsyncClient(timeout=10.0) as client:
            async with client.stream(
                "POST",
                url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            ) as response:
                if response.status_code != 200:
                    error_body = await response.aread()
                    raise RuntimeError(
                        f"LLM API error {response.status_code}: {error_body.decode()}"
                    )

                async for line in response.aiter_lines():
                    if not line.startswith("data: ") or line == "data: [DONE]":
                        continue

                    chunk = json.loads(line[6:])
                    delta = chunk["choices"][0].get("delta", {})

                    if delta.get("tool_calls"):
                        for tc in delta["tool_calls"]:
                            idx = tc["index"]
                            if idx not in tool_calls_data:
                                tool_calls_data[idx] = {
                                    "id": "", "name": "", "arguments": ""
                                }
                            if tc.get("id"):
                                tool_calls_data[idx]["id"] = tc["id"]
                            if tc.get("function"):
                                if tc["function"].get("name"):
                                    tool_calls_data[idx]["name"] = tc["function"]["name"]
                                if tc["function"].get("arguments"):
                                    tool_calls_data[idx]["arguments"] += tc["function"]["arguments"]

                    elif delta.get("content"):
                        token = delta["content"]
                        full_response += token
                        sentence_buffer += token

                        for delimiter in [".", "!", "?"]:
                            if delimiter in sentence_buffer:
                                parts = sentence_buffer.split(delimiter, 1)
                                sentence = (parts[0] + delimiter).strip()
                                sentence_buffer = parts[1] if len(parts) > 1 else ""
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

            from cogniflow_home.providers.tools import execute_tool

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

            async for sentence in self._try_stream(url, api_key, model):
                yield sentence

        if full_response.strip():
            self.add_message("assistant", full_response.strip())
