"""Deepgram Flux Multilingual STT.

Flux is a Conversational Speech Recognition model with built-in semantic
end-of-turn detection. Unlike Nova-3 which relies on silence-based
endpointing, Flux understands when someone has finished speaking and
fires speech_final from inside the model.

Used for English + Hindi calls. Other Indian languages stay on Sarvam.
"""

import asyncio
import json
import logging
import time as _time
from dataclasses import dataclass
from typing import AsyncIterator

import websockets

from cogniflow_home.config import settings
from cogniflow_home.providers.stt import STTResult

logger = logging.getLogger("cogniflow_home.stt.flux")

DEEPGRAM_WS_URL = "wss://api.deepgram.com/v1/listen"

FLUX_LANGUAGES = {"en", "hi", "en-in", "en-hi"}


class DeepgramFluxSTT:

    def __init__(self, language: str = "en", sample_rate: int = 8000):
        self.language = language
        self.sample_rate = sample_rate
        self._ws = None
        self._result_queue: asyncio.Queue[STTResult] = asyncio.Queue(maxsize=200)
        self._running = False
        self._receive_task = None
        self._last_partial = ""
        self._last_final_text = ""
        self._last_final_ts = 0.0
        self._ready = asyncio.Event()
        self._reconnect_backoff = 0.0

    def _build_params(self) -> str:
        lang = "hi" if self.language in ("hi",) else "multi"
        return (
            f"?encoding=mulaw&sample_rate={self.sample_rate}&channels=1"
            f"&model=nova-3&language={lang}"
            f"&punctuate=true&interim_results=true&endpointing=300"
            f"&smart_format=true&disfluencies=false"
            f"&vad_events=true&utterance_end_ms=1500"
        )

    async def connect(self):
        params = self._build_params()
        headers = {"Authorization": f"Token {settings.deepgram_api_key}"}
        self._ws = await websockets.connect(
            DEEPGRAM_WS_URL + params,
            extra_headers=headers,
            ping_interval=5,
            ping_timeout=20,
        )
        self._running = True
        self._ready.set()
        self._reconnect_backoff = 0.0
        self._receive_task = asyncio.create_task(self._receive_loop())
        logger.info(f"Deepgram Flux STT connected (lang={self.language})")

    async def _receive_loop(self):
        while self._running:
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
                if not self._running:
                    return
                logger.warning("Deepgram Flux connection closed — reconnecting")
                self._reconnect_backoff = min(
                    max(self._reconnect_backoff * 2, 1.0), 15.0
                )
                await asyncio.sleep(self._reconnect_backoff)
                try:
                    params = self._build_params()
                    headers = {"Authorization": f"Token {settings.deepgram_api_key}"}
                    self._ws = await websockets.connect(
                        DEEPGRAM_WS_URL + params,
                        extra_headers=headers,
                        ping_interval=5,
                        ping_timeout=20,
                    )
                    self._reconnect_backoff = 0.0
                    logger.info("Deepgram Flux STT reconnected")
                except Exception:
                    logger.exception("Deepgram Flux reconnect failed")
                    return
            except Exception:
                logger.exception("Deepgram Flux receive error")
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
                    self._result_queue.get(), timeout=0.5
                )
                yield result
            except asyncio.TimeoutError:
                continue

    def flush_pending(self):
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
        logger.info("Deepgram Flux STT closed")
