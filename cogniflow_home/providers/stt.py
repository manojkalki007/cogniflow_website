"""Streaming Speech-to-Text via Deepgram.

Emits both partial and final transcripts. Partials feed the EOT detector
for faster turn detection. Finals are the confirmed transcripts.
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
        self._transcript_queue: asyncio.Queue[str] = asyncio.Queue()
        self._result_queue: asyncio.Queue[STTResult] = asyncio.Queue()
        self._running = False
        self._receive_task = None

    async def connect(self):
        params = (
            f"?encoding=mulaw&sample_rate={self.sample_rate}&channels=1"
            f"&model=nova-3&language={self.language}"
            f"&punctuate=true&interim_results=true&endpointing=200"
            f"&vad_events=true&smart_format=true&utterance_end_ms=1000"
        )
        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}
        self._ws = await websockets.connect(
            DEEPGRAM_WS_URL + params,
            additional_headers=headers,
            ping_interval=5,
            ping_timeout=20,
        )
        self._running = True
        self._receive_task = asyncio.create_task(self._receive_loop())
        logger.info("Deepgram STT connected")

    async def _receive_loop(self):
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

                    result = STTResult(
                        transcript=transcript,
                        is_final=is_final,
                        speech_final=speech_final,
                    )
                    await self._result_queue.put(result)

                    if is_final:
                        await self._transcript_queue.put(transcript)

        except websockets.exceptions.ConnectionClosed:
            logger.info("Deepgram connection closed")
        except Exception:
            logger.exception("Deepgram receive error")
        finally:
            self._running = False

    async def send_audio(self, audio_bytes: bytes):
        if self._ws and self._running:
            try:
                await self._ws.send(audio_bytes)
            except Exception:
                logger.exception("Failed to send audio to Deepgram")

    async def transcripts(self) -> AsyncIterator[str]:
        while self._running or not self._transcript_queue.empty():
            try:
                transcript = await asyncio.wait_for(
                    self._transcript_queue.get(), timeout=0.1
                )
                yield transcript
            except asyncio.TimeoutError:
                continue

    async def results(self) -> AsyncIterator[STTResult]:
        while self._running or not self._result_queue.empty():
            try:
                result = await asyncio.wait_for(
                    self._result_queue.get(), timeout=0.1
                )
                yield result
            except asyncio.TimeoutError:
                continue

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
