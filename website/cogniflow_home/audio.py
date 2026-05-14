"""Audio format conversion utilities.

Twilio sends/receives mulaw 8kHz.
Exotel sends/receives PCM 16-bit 8kHz (s16le).
Deepgram can accept both mulaw and PCM.

This module converts between formats so the pipeline always works
in a canonical format (mulaw 8kHz) and adapts at the edges.
"""

import audioop
import struct


def pcm16_to_mulaw(pcm_bytes: bytes) -> bytes:
    return audioop.lin2ulaw(pcm_bytes, 2)


def mulaw_to_pcm16(mulaw_bytes: bytes) -> bytes:
    return audioop.ulaw2lin(mulaw_bytes, 2)


def compute_energy_mulaw(mulaw_bytes: bytes) -> float:
    if not mulaw_bytes:
        return 0.0
    total = sum(abs(b - 128) for b in mulaw_bytes)
    return total / len(mulaw_bytes)


def compute_energy_pcm16(pcm_bytes: bytes) -> float:
    if len(pcm_bytes) < 2:
        return 0.0
    n_samples = len(pcm_bytes) // 2
    samples = struct.unpack(f"<{n_samples}h", pcm_bytes[: n_samples * 2])
    return sum(abs(s) for s in samples) / n_samples
