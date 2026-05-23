"""Unit tests for AudioSmoother (cogniflow_home/audio.py).

Pure unit tests -- no external deps required.
The audio module only imports struct (and optionally audioop).
"""

import struct

import pytest

from cogniflow_home.audio import AudioSmoother


def _make_pcm16(value: int, n_samples: int) -> bytes:
    """Generate PCM16 bytes with constant sample value."""
    return struct.pack(f"<{n_samples}h", *([value] * n_samples))


def _read_pcm16(data: bytes) -> list[int]:
    """Decode PCM16 bytes into sample list."""
    n = len(data) // 2
    return list(struct.unpack(f"<{n}h", data[:n * 2]))


class TestAudioSmootherInit:
    def test_default_params(self):
        smoother = AudioSmoother()
        assert smoother.sample_rate == 8000
        # crossfade_ms=8 -> crossfade_samples = max(1, int(8000*8/1000)) = 64
        assert smoother.crossfade_samples == 64


class TestAudioSmootherProcess:
    def test_returns_bytes_of_correct_format(self):
        smoother = AudioSmoother()
        # Need enough samples: crossfade_samples * 4 = 64 * 4 = 256
        pcm = _make_pcm16(1000, 300)
        result = smoother.process(pcm)
        assert isinstance(result, bytes)
        # Output should also be valid PCM16 (even number of bytes)
        assert len(result) % 2 == 0

    def test_first_chunk_fade_in(self):
        smoother = AudioSmoother()
        # Use a varying signal so DC offset removal does not zero everything.
        # Alternating +1000/-1000 has mean ~0, so no DC removal impact.
        n = 300
        values = [(1000 if i % 2 == 0 else -1000) for i in range(n)]
        pcm = struct.pack(f"<{n}h", *values)
        result = smoother.process(pcm)
        samples = _read_pcm16(result)
        # First sample should be attenuated (fade-in: sample[0] *= 0/fade_len = 0)
        assert samples[0] == 0
        # Sample well past the fade-in region should be near original amplitude
        idx = smoother.crossfade_samples + 10
        assert abs(samples[idx]) > 0


class TestAudioSmootherFlushAndReset:
    def test_flush_returns_tail_with_fadeout(self):
        smoother = AudioSmoother()
        pcm = _make_pcm16(1000, 300)
        smoother.process(pcm)
        tail = smoother.flush()
        assert isinstance(tail, bytes)
        assert len(tail) > 0
        # After flush, tail samples should fade toward zero
        tail_samples = _read_pcm16(tail)
        # Last sample should be near zero (fade-out applied)
        assert abs(tail_samples[-1]) < abs(tail_samples[0]) or tail_samples[-1] == 0

    def test_reset_clears_state(self):
        smoother = AudioSmoother()
        pcm = _make_pcm16(1000, 300)
        smoother.process(pcm)
        smoother.reset()
        assert smoother._previous_tail is None
        assert smoother._first_chunk is True
        # After reset, flush returns empty
        assert smoother.flush() == b""
