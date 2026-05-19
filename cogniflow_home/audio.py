"""Audio format conversion and smoothing utilities.

Twilio sends/receives mulaw 8kHz.
Exotel sends/receives PCM 16-bit 8kHz (s16le).
Deepgram can accept both mulaw and PCM.
Browser sends/receives PCM 16-bit 16kHz.

This module converts between formats so the pipeline always works
in a canonical format (mulaw 8kHz) and adapts at the edges.
"""

import struct

try:
    import audioop
except ImportError:
    audioop = None

_MULAW_BIAS = 0x84
_MULAW_CLIP = 32635

_MULAW_COMPRESS_TABLE = [
    0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3,
    4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
    7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
]


def _lin2ulaw_sample(sample: int) -> int:
    sign = 0
    if sample < 0:
        sign = 0x80
        sample = -sample
    if sample > _MULAW_CLIP:
        sample = _MULAW_CLIP
    sample += _MULAW_BIAS
    exponent = _MULAW_COMPRESS_TABLE[(sample >> 7) & 0xFF]
    mantissa = (sample >> (exponent + 3)) & 0x0F
    return ~(sign | (exponent << 4) | mantissa) & 0xFF


def pcm16_to_mulaw(pcm_bytes: bytes) -> bytes:
    if audioop:
        return audioop.lin2ulaw(pcm_bytes, 2)
    n_samples = len(pcm_bytes) // 2
    samples = struct.unpack(f"<{n_samples}h", pcm_bytes[:n_samples * 2])
    return bytes(_lin2ulaw_sample(s) for s in samples)


def mulaw_to_pcm16(mulaw_bytes: bytes) -> bytes:
    if audioop:
        return audioop.ulaw2lin(mulaw_bytes, 2)
    result = bytearray(len(mulaw_bytes) * 2)
    for i, b in enumerate(mulaw_bytes):
        b = ~b & 0xFF
        sign = b & 0x80
        exponent = (b >> 4) & 0x07
        mantissa = b & 0x0F
        sample = ((mantissa << 3) + _MULAW_BIAS) << exponent
        sample -= _MULAW_BIAS
        if sign:
            sample = -sample
        struct.pack_into("<h", result, i * 2, max(-32768, min(32767, sample)))
    return bytes(result)


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


class AudioSmoother:
    """Crossfades consecutive TTS audio chunks to eliminate clicks and pops."""

    def __init__(self, sample_rate: int = 8000, crossfade_ms: int = 8):
        self.sample_rate = sample_rate
        self.crossfade_samples = max(1, int(sample_rate * crossfade_ms / 1000))
        self._previous_tail = None
        self._first_chunk = True

    def process(self, audio_bytes: bytes) -> bytes:
        if len(audio_bytes) < self.crossfade_samples * 4:
            return audio_bytes

        n_samples = len(audio_bytes) // 2
        samples = list(struct.unpack(f"<{n_samples}h", audio_bytes[:n_samples * 2]))

        # Remove DC offset
        mean = sum(samples) / len(samples)
        if abs(mean) > 10:
            samples = [max(-32768, min(32767, int(s - mean))) for s in samples]

        # Fade-in on first chunk
        if self._first_chunk:
            fade_in = min(self.crossfade_samples, len(samples))
            for i in range(fade_in):
                samples[i] = int(samples[i] * (i / fade_in))
            self._first_chunk = False

        # Crossfade with previous chunk's tail
        if self._previous_tail is not None:
            fade_len = min(len(self._previous_tail), len(samples), self.crossfade_samples)
            for i in range(fade_len):
                alpha = i / fade_len
                blended = int(
                    self._previous_tail[-(fade_len - i)] * (1 - alpha) +
                    samples[i] * alpha
                )
                samples[i] = max(-32768, min(32767, blended))

        self._previous_tail = samples[-self.crossfade_samples:]
        return struct.pack(f"<{len(samples)}h", *samples)

    def flush(self) -> bytes:
        if self._previous_tail:
            fade_len = len(self._previous_tail)
            for i in range(fade_len):
                self._previous_tail[i] = int(self._previous_tail[i] * (1 - i / fade_len))
            result = struct.pack(f"<{len(self._previous_tail)}h", *self._previous_tail)
            self._previous_tail = None
            return result
        return b""

    def reset(self):
        self._previous_tail = None
        self._first_chunk = True
