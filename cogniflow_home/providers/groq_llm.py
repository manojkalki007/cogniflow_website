"""Streaming LLM via Groq.

Production-grade streaming with:
- Smart sentence boundary detection (handles Dr., U.S., 3.14, etc.)
- Word-count fallback for fast first-chunk delivery
- Bounded tool call recursion
- Configurable temperature/max_tokens per call
"""

import asyncio
import json
import logging
import re
from typing import AsyncIterator

import httpx

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.llm.groq")

_ABBREVIATIONS = re.compile(
    r'\b(?:Mr|Mrs|Ms|Dr|Prof|Jr|Sr|St|vs|etc|Inc|Ltd|Corp|Co|Dept'
    r'|Ave|Blvd|Rd|i\.e|e\.g|a\.m|p\.m|U\.S|U\.K)\.$',
    re.IGNORECASE,
)

_SENTENCE_END = re.compile(r'[.!?](?=\s|$)')
_SENTENCE_END_EOF = re.compile(r'[.!?]$')


def _find_sentence_boundary(text: str) -> int:
    """Find the best split point that is a real sentence boundary.
    Returns index after the delimiter+space, or -1 if none found."""
    for m in _SENTENCE_END.finditer(text):
        candidate = text[:m.end()].rstrip()
        if _ABBREVIATIONS.search(candidate):
            continue
        return m.end()
    return -1


class GroqLLM:

    def __init__(
        self,
        model: str = "llama-3.3-70b-versatile",
        system_prompt: str = "",
        temperature: float = 0.7,
        max_tokens: int = 150,
    ):
        self.model = model
        self.system_prompt = system_prompt
        self.temperature = temperature
        self.max_tokens = max_tokens
        self.conversation_history: list[dict] = []
        self.call_context: dict = {}
        self.on_tool_call = None
        self._client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=30.0, write=5.0, pool=5.0)
        )

        if system_prompt:
            self.conversation_history.append(
                {"role": "system", "content": system_prompt}
            )

        self._groq_url = "https://api.groq.com/openai/v1/chat/completions"

    def add_message(self, role: str, content: str):
        self.conversation_history.append({"role": role, "content": content})
        total_chars = sum(len(m.get("content", "")) for m in self.conversation_history)
        max_chars = 12000
        while total_chars > max_chars and len(self.conversation_history) > 2:
            removed = self.conversation_history.pop(1)
            total_chars -= len(removed.get("content", ""))

    async def prewarm(self):
        api_key = settings.groq_api_key
        if not api_key:
            return
        body = {
            "model": self.model,
            "messages": self.conversation_history + [{"role": "user", "content": "."}],
            "max_tokens": 1,
            "temperature": 0,
        }
        try:
            await self._client.post(
                self._groq_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
        except Exception:
            logger.debug("LLM prewarm failed (non-fatal)", exc_info=True)

    async def generate_stream(
        self, user_text: str, tools: list | None = None
    ) -> AsyncIterator[str]:
        self.add_message("user", user_text)

        try:
            async for sentence in self._try_stream(
                settings.groq_api_key,
                self.model,
                tools,
                depth=0,
            ):
                yield sentence
        except Exception:
            logger.exception("Groq LLM failed")
            yield "I'm sorry, I'm having trouble right now. Could you repeat that?"

    async def _try_stream(
        self,
        api_key: str,
        model: str,
        tools: list | None = None,
        depth: int = 0,
    ) -> AsyncIterator[str]:
        if not api_key:
            raise ValueError("No Groq API key configured")
        if depth > 3:
            yield "I've run into an issue processing that. Let me try a different approach."
            return

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
        buffer = ""
        tool_calls_data: dict[int, dict] = {}
        first_chunk_sent = False
        word_count = 0

        _stream_ctx = None
        response = None
        for _attempt in range(2):
            _stream_ctx = self._client.stream(
                "POST",
                self._groq_url,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json=body,
            )
            response = await _stream_ctx.__aenter__()
            if response.status_code in (429, 503) and _attempt == 0:
                await _stream_ctx.__aexit__(None, None, None)
                _stream_ctx = None
                logger.warning(f"Groq returned {response.status_code}, retrying in 1s")
                await asyncio.sleep(1.0)
                continue
            if response.status_code != 200:
                error_body = await response.aread()
                await _stream_ctx.__aexit__(None, None, None)
                _stream_ctx = None
                raise RuntimeError(
                    f"LLM API error {response.status_code}: {error_body.decode()}"
                )
            break

        if response is None or _stream_ctx is None:
            raise RuntimeError("LLM API: failed to establish connection after retries")

        try:
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
                    buffer += token
                    word_count = len(buffer.split())

                    split_at = _find_sentence_boundary(buffer)
                    if split_at > 0:
                        sentence = buffer[:split_at].strip()
                        buffer = buffer[split_at:]
                        if sentence:
                            first_chunk_sent = True
                            yield sentence
                    elif not first_chunk_sent and word_count >= 6:
                        text = buffer.strip()
                        buffer = ""
                        if text:
                            first_chunk_sent = True
                            yield text
        finally:
            if _stream_ctx:
                await _stream_ctx.__aexit__(None, None, None)

        if buffer.strip() and not tool_calls_data:
            yield buffer.strip()

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
                    logger.warning(f"Bad tool args for {func_name}, using empty dict")

                logger.info(f"Tool call: {func_name}({func_args})")
                result = await execute_tool(func_name, func_args, self.call_context)

                self.conversation_history.append({
                    "role": "tool",
                    "tool_call_id": tc["id"],
                    "content": result,
                })

            async for sentence in self._try_stream(api_key, model, depth=depth + 1):
                yield sentence

        if full_response.strip() and not tool_calls_data:
            self.add_message("assistant", full_response.strip())

    async def close(self):
        await self._client.aclose()
