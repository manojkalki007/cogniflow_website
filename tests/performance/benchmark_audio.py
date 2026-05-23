"""
Audio quality benchmark — measures crossfade effectiveness.
Simulates multiple TTS chunks being processed by AudioSmoother
and counts abrupt volume transitions (artifacts).
"""

import struct
import math
import statistics

from cogniflow_home.audio import AudioSmoother


def generate_sine_chunk(freq: float, duration_ms: int, sample_rate: int = 8000, amplitude: int = 8000) -> bytes:
    n_samples = int(sample_rate * duration_ms / 1000)
    samples = [
        int(amplitude * math.sin(2 * math.pi * freq * i / sample_rate))
        for i in range(n_samples)
    ]
    return struct.pack(f"<{n_samples}h", *samples)


def measure_artifacts(audio_bytes: bytes, chunk_size_samples: int = 400) -> int:
    n_samples = len(audio_bytes) // 2
    samples = list(struct.unpack(f"<{n_samples}h", audio_bytes[:n_samples * 2]))

    volumes = []
    for i in range(0, len(samples) - chunk_size_samples, chunk_size_samples):
        chunk = samples[i:i + chunk_size_samples]
        rms = (sum(s * s for s in chunk) / len(chunk)) ** 0.5
        volumes.append(rms)

    abrupt = sum(
        1 for i in range(1, len(volumes))
        if volumes[i] > 0 and volumes[i-1] > 0
        and abs(volumes[i] - volumes[i-1]) / max(volumes[i-1], 1) > 3.0
    )
    return abrupt


def benchmark():
    smoother = AudioSmoother(sample_rate=8000, crossfade_ms=8)

    chunks = [
        generate_sine_chunk(440, 500),
        generate_sine_chunk(880, 300),
        generate_sine_chunk(660, 400),
        generate_sine_chunk(550, 350),
        generate_sine_chunk(440, 500),
    ]

    smoothed_audio = b""
    for chunk in chunks:
        smoothed_audio += smoother.process(chunk)
    smoothed_audio += smoother.flush()

    raw_smoother = AudioSmoother(sample_rate=8000, crossfade_ms=0)
    raw_audio = b""
    for chunk in chunks:
        raw_audio += raw_smoother.process(chunk)

    smoothed_artifacts = measure_artifacts(smoothed_audio)
    raw_artifacts = measure_artifacts(raw_audio)

    print("=" * 50)
    print("AUDIO QUALITY BENCHMARK")
    print("=" * 50)
    print(f"  Total audio: {len(smoothed_audio) / 8000 / 2:.1f}s")
    print(f"  Chunks processed: {len(chunks)}")
    print(f"  Raw artifacts (no crossfade): {raw_artifacts}")
    print(f"  Smoothed artifacts (8ms crossfade): {smoothed_artifacts}")
    print()

    if smoothed_artifacts < 10:
        print("  PASS: Audio artifacts < 10")
    else:
        print(f"  FAIL: {smoothed_artifacts} artifacts (target: < 10)")

    return smoothed_artifacts < 10


if __name__ == "__main__":
    benchmark()
