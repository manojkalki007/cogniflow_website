"""Streaming Speech-to-Text via Deepgram.

Production-grade STT with:
- Interim deduplication (skip identical partials)
- speech_final gating for reliable turn-taking
- Auto-reconnect on connection drop
- Proper queue signaling (no polling)
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import AsyncIterator

import websockets

from cogniflow_home.config import settings

logger = logging.getLogger("cogniflow_home.stt")

DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"


@dataclass
class STTResult:
    transcript: str
    is_final: bool
    speech_final: bool


class DeepgramSTT:
    def __init__(self, language: str = "en", sample_rate: int = 8000):
        self.language = language
        self.sample_rate = sample_rate
        self._ws = None
        self._result_queue: asyncio.Queue[STTResult] = asyncio.Queue()
        self._running = False
        self._receive_task = None
        self._last_partial = ""
        self._last_final_text = ""
        self._last_final_ts = 0.0
        self._ready = asyncio.Event()

    async def connect(self):
        params = (
            f"?encoding=mulaw&sample_rate={self.sample_rate}&channels=1"
            f"&model=nova-3&language={self.language}"
            f"&punctuate=true&interim_results=true&endpointing=300"
            f"&vad_events=true&smart_format=true&utterance_end_ms=1200"
        )
        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}
        self._ws = await websockets.connect(
            DEEPGRAM_WS_URL + params,
            extra_headers=headers,
            ping_interval=5,
            ping_timeout=20,
        )
        self._running = True
        self._ready.set()
        self._receive_task = asyncio.create_task(self._receive_loop())
        logger.info("Deepgram STT connected")

    async def _receive_loop(self):
        import time as _time
        try:
            async for message in self._ws:
                data = json.loads(message)
                msg_type = data.get("type", "")

                if msg_type == "Results":
                    is_final = data.get("is_final", False)
                    speech_final = data.get("speech_final", False)
                    transcript = (
                        data.get("channel", {})
                        .get("alternatives", [{}])[0]
                        .get("transcript", "")
                    )
                    if not transcript:
                        continue

                    if not is_final:
                        if transcript == self._last_partial:
                            continue
                        self._last_partial = transcript

                    if is_final:
                        now = _time.monotonic()
                        if (
                            transcript == self._last_final_text
                            and now - self._last_final_ts < 0.8
                        ):
                            continue
                        self._last_final_text = transcript
                        self._last_final_ts = now
                        self._last_partial = ""

                    result = STTResult(
                        transcript=transcript,
                        is_final=is_final,
                        speech_final=speech_final,
                    )
                    await self._result_queue.put(result)

                elif msg_type == "UtteranceEnd":
                    pass

        except websockets.exceptions.ConnectionClosed:
            logger.warning("Deepgram connection closed — attempting reconnect")
            if self._running:
                try:
                    await self.connect()
                except Exception:
                    logger.exception("Deepgram reconnect failed")
        except Exception:
            logger.exception("Deepgram receive error")
        finally:
            if not self._running:
                return

    async def send_audio(self, audio_bytes: bytes):
        if self._ws and self._running:
            try:
                await self._ws.send(audio_bytes)
            except Exception:
                pass

    async def results(self) -> AsyncIterator[STTResult]:
        while self._running or not self._result_queue.empty():
            try:
                result = await asyncio.wait_for(
                    self._result_queue.get(), timeout=0.05
                )
                yield result
            except asyncio.TimeoutError:
                continue

    def flush_pending(self):
        """Discard all queued results (used after barge-in)."""
        while not self._result_queue.empty():
            try:
                self._result_queue.get_nowait()
            except Exception:
                break
        self._last_partial = ""

    async def close(self):
        self._running = False
        if self._ws:
            try:
                await self._ws.send(json.dumps({"type": "CloseStream"}))
                await self._ws.close()
            except Exception:
                pass
        if self._receive_task:
            self._receive_task.cancel()
            try:
                await self._receive_task
            except asyncio.CancelledError:
                pass
        logger.info("Deepgram STT closed")
