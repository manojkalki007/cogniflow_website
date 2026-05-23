# Cogniflow Home — Full Platform Audit Report

**Date**: 2026-05-20
**Scope**: Backend, Frontend, Architecture, Telephony Pipeline, Load Testing, Optimization
**Agents**: 6 parallel analysis agents | **Files analyzed**: 140+ | **Total backend LOC**: 13,028

---

## Executive Summary

| Category | Critical | High | Medium | Low | Total |
|----------|----------|------|--------|-----|-------|
| Backend Security & API | 6 | 8 | 11 | 10 | 35 |
| Frontend | 2 | 5 | 6 | 5 | 18 |
| Architecture | 2 | 6 | 6 | 3 | 17 |
| Telephony Pipeline | 6 | 4 | 8 | - | 18 |
| **Total** | **16** | **23** | **31** | **18** | **88** |

**Top 5 revenue/reliability risks:**
1. ElevenLabs TTS plays at 2x speed on all telephony calls (audio corruption)
2. SarvamSTT crashes on every barge-in for Indian language calls
3. Race conditions in billing counters — silent revenue loss
4. Broken OAuth callback — Google login silently fails
5. Sequential event handlers — 5-10s post-call delay blocks CRM sync

---

## PART 1: CRITICAL BUGS (Fix before next deployment)

### CRIT-1: ElevenLabs TTS 2x speed on telephony
**File**: `providers/elevenlabs_tts.py:86-89`
**Bug**: Outputs PCM 16kHz but telephony expects 8kHz mulaw. `pcm16_to_mulaw` doesn't downsample — just encodes each sample. Audio plays at double speed.
**Fix**: Request `ulaw_8000` format from ElevenLabs API:
```python
if self.raw_pcm:
    output_format = "pcm_16000"
else:
    output_format = "ulaw_8000"
```

### CRIT-2: SarvamSTT crashes on barge-in
**File**: `providers/sarvam_stt.py` (missing method)
**Bug**: Pipeline calls `stt.flush_pending()` during barge-in (`pipeline.py:429`). DeepgramSTT has this method. SarvamSTT does NOT — raises `AttributeError` on every barge-in for Indian language calls.
**Fix**: Add to SarvamSTT:
```python
def flush_pending(self):
    self._buffer.clear()
    self._buffer_duration_ms = 0
    while not self._transcript_queue.empty():
        try: self._transcript_queue.get_nowait()
        except: break
```

### CRIT-3: SarvamSTT bare `audioop` import (Python 3.13+ crash)
**File**: `providers/sarvam_stt.py:107`
**Bug**: `import audioop` without try/except. `audio.py` correctly handles this deprecation (line 14-17), but SarvamSTT does not.
**Fix**: Replace with `from cogniflow_home.audio import mulaw_to_pcm16`

### CRIT-4: Race condition in billing — revenue loss
**File**: `tenants/manager.py:100-112`
**Bug**: `record_call_usage()` does read-then-write on `current_month_minutes` and `current_month_cost_paise`. Concurrent calls for the same tenant can overwrite each other.
**Fix**: Use atomic SQL increment via Supabase RPC:
```sql
UPDATE tenants SET current_month_minutes = current_month_minutes + $1 WHERE id = $2
```

### CRIT-5: Race condition in campaign completed_count
**File**: `server.py:1373-1377`
**Bug**: Same read-then-write race on `completed_count`. Concurrent call completions lose counts.
**Fix**: Same atomic increment approach.

### CRIT-6: Broken OAuth callback — Google login fails silently
**File**: `src/app/auth/callback/route.ts:9-14`
**Bug**: Creates ephemeral Supabase client, exchanges code for session, but session is never persisted to cookies. User redirected to dashboard but not authenticated.
**Fix**: Use `@supabase/ssr` with `createServerClient` that properly sets cookies on the response.

### CRIT-7: LLM httpx client never closed — connection leak
**File**: `pipeline.py:793-861`
**Bug**: `pipeline.stop()` closes STT and TTS but never calls `self.llm.close()`. The `GroqLLM` httpx.AsyncClient stays open. Leaks file descriptors and connections over many calls.
**Fix**: Add `await self.llm.close()` after TTS cleanup in `stop()`.

### CRIT-8: Webhook HMAC with empty secret = zero security
**File**: `webhooks/dispatcher.py:36-37`
**Bug**: When no secret is set, HMAC is computed with empty string key — deterministic, forgeable.
**Fix**: Skip signing if no secret available.

### CRIT-9: Unbounded memory growth — `_pending_agent_overrides`
**File**: `server.py:72, 934`
**Bug**: Entries set on outbound call initiation, only cleaned on connect. Failed calls (busy, no answer) leak entries forever. Campaign with 10K calls = 10K leaked entries.
**Fix**: Schedule TTL cleanup: `asyncio.get_event_loop().call_later(300, lambda: _pending_agent_overrides.pop(sid, None))`

### CRIT-10: Unbounded `_voice_preview_cache`
**File**: `server.py:377, 413-458`
**Bug**: WAV data cached with no max size. Repeated unique previews accumulate unlimited memory.
**Fix**: Add `if len(cache) > 100: cache.clear()` or use bounded `functools.lru_cache`.

---

## PART 2: HIGH PRIORITY ISSUES

### Backend

| # | Issue | File:Line | Impact |
|---|-------|-----------|--------|
| H1 | API errors return 200 with `{"error": ...}` instead of proper HTTP status codes | `server.py:923,926,940,949` | Clients can't distinguish errors; monitoring reports them as success |
| H2 | Blocking Twilio SDK call in async context | `twilio_provider.py:127` | Blocks entire event loop 1-3s during outbound calls |
| H3 | Single httpx.AsyncClient with default 100 connection limit | `db/supabase.py:23` | Connection pool exhaustion under 50 concurrent calls |
| H4 | Event bus handlers run sequentially | `events.py:40-46` | 7+ handlers on `call.completed` run one-by-one; HubSpot timeout blocks all others |
| H5 | In-memory rate limiter not shared across instances | `server.py:83-101` | Rate limits bypassed with horizontal scaling |
| H6 | DNC check hits DB per number — no batching | `campaigns/dnc.py:17-19` | 10K campaign = 10K individual queries |
| H7 | N+1 query in `get_all_tenants_summary()` | `tenants/billing.py:61-70` | 100 tenants = 300 sequential DB calls |
| H8 | Contact search fetches all, filters in Python | `server.py:1022-1033` | Wrong result count; limit applied before search |

### Frontend

| # | Issue | File | Impact |
|---|-------|------|--------|
| H9 | 9 unused heavy dependencies (~400KB) | `package.json:14-18,23-24` | Three.js, GSAP, Mux, hls.js, motion (duplicate) never imported |
| H10 | Render-blocking external Google Fonts CSS | `globals.css:1` | 100-300ms slower FCP |
| H11 | Zero `next/link` usage — all raw `<a>` tags | Entire codebase | No client-side navigation, no prefetching |
| H12 | 304KB favicon (30x overweight) | `public/favicon.png` | ~3s download on 3G |
| H13 | Unverified Cal.com webhook | `src/app/api/cal-webhook/route.ts` | Attackers can inject fake bookings |

### Telephony Pipeline

| # | Issue | File:Line | Impact |
|---|-------|-----------|--------|
| H14 | No STT failover — Deepgram failure = deaf call | `pipeline.py` | Single point of failure for all calls |
| H15 | No WebSocket send error handling in Twilio/Exotel/Vobiz | `twilio_provider.py:87` | WS close between check and send crashes the turn |
| H16 | `on_call_end` cleanup skipped if `pipeline.stop()` raises | `server.py:801-808` | Leaks call from active_calls and call_state |
| H17 | No Exotel/Vobiz webhook authentication | `server.py:661-687` | Anyone can trigger call flows |

---

## PART 3: TELEPHONY PIPELINE DEEP REVIEW

### Call Lifecycle (Inbound Twilio)

```
Twilio POST /voice/twilio/inbound
  -> Validate signature -> Return TwiML <Connect><Stream>
  
Twilio opens WebSocket /voice/twilio/ws
  -> Capacity check -> Create TwilioProvider -> Register callbacks
  
"start" event:
  -> get_agent_for_number() (DB lookup)
  -> VoicePipeline.__init__() (create STT, LLM, TTS, 14 subsystems)
  -> pipeline.start():
     asyncio.gather([
       stt.connect(),        # Deepgram WebSocket
       _prewarm_tts(),       # Warm TTS + fallbacks
       _fetch_memory(),      # Caller memory + intent prediction
       llm.prewarm(),        # Warm Groq connection
     ])
  -> Pre-synthesize filler audio
  -> Send greeting via TTS
  -> Emit "call.started"

Audio loop (continuous):
  Twilio mulaw -> handle_audio() -> energy detection -> STT
  If agent speaking: check barge-in (20 consecutive high-energy chunks)
  
Transcript processing:
  Partial -> EOT prediction + speculative generation + language detection
  Final -> compliance check -> noise filter -> emotion update
       -> speculative match OR _generate_and_speak()

_generate_and_speak (under _speak_lock):
  -> Build emotion context + query knowledge base
  -> Stream LLM sentence-by-sentence -> TTS -> telephony

Call end:
  -> Cancel tasks -> Close STT, TTS, failover chain
  -> Save latency traces -> Emit "call.completed"
  -> 11 event handlers fire (logging, CRM, webhooks, DNC, revenue, memory)
```

### Voice Pipeline Data Flow

```
PSTN Caller
  |
  mulaw 8kHz (Twilio/Vobiz) / PCM16 8kHz (Exotel) / PCM16 16kHz (Browser)
  |
  v
[Telephony Provider] -- normalize to mulaw --> [Energy Detection] -- barge-in check
  |
  mulaw bytes
  v
[STT: Deepgram Nova-3 / Sarvam] -- WebSocket/REST
  |
  text transcripts (partial + final)
  v
[EOT Detection] -> [Speculative Generation] -> [Language Detection]
  |
  final text
  v
[Compliance: PII/PCI redaction] -> [Emotion Detection] -> [Noise Filter]
  |
  cleaned text + emotion context
  v
[LLM: Groq Llama-3.3-70B] -- streaming SSE, sentence-by-sentence
  |                           (max_tokens=80, fallback: Llama-3.1-8B)
  sentences
  v
[Text Enricher + Humanizer] -- contractions, prosody cues
  |
  v
[TTS: Smallest / ElevenLabs / Sarvam] -- with CircuitBreaker failover
  |
  audio bytes
  v
[Audio Smoother] -- crossfade, DC removal, fade-in/out
  |
  v
[Telephony Provider] -- base64 encode --> WebSocket --> PSTN
```

### Barge-In Mechanism

- **Detection**: Energy threshold calibrated from first 20 audio chunks at `max(200, ambient * 2.5)`
- **Trigger**: 20 consecutive high-energy chunks (~400ms)
- **Reset**: 6 consecutive low-energy chunks (~120ms)
- **On trigger**: Cancel EOT + speculative + pending_final, clear telephony audio queue, flush STT
- **Audio still sent to STT during agent speech** (correct: captures barge-in text)
- **Known issue**: No echo cancellation — agent's own speech may be transcribed by STT

### Provider Failover

| Provider | Chain Order (English) | Chain Order (Indian) |
|----------|----------------------|---------------------|
| TTS | Smallest -> ElevenLabs -> Sarvam(en-in) | Sarvam -> Smallest -> ElevenLabs |
| LLM | Llama-3.3-70B -> Llama-3.1-8B (retry 429/503) | Same |
| STT | Deepgram only (auto-reconnect, no failover) | Sarvam (no failover) |

Circuit breaker: `failure_threshold=3`, `reset_timeout=60s`, half-open testing

### Latency Budget (Single Turn)

| Stage | Time | Measured? |
|-------|------|-----------|
| STT finalization | ~300ms (Deepgram endpointing) | No |
| EOT decision | ~0ms (synchronous heuristic) | No |
| Speculative check | ~0ms | No |
| LLM time-to-first-token | ~200-800ms | Yes (`llm_ttft`) |
| Sentence boundary buffer | ~50-200ms (6-word fallback) | No |
| TTS time-to-first-byte | ~100-500ms | Yes (`tts_ttfb`) |
| Audio streaming overhead | 18ms/chunk | No |
| Network (WS to Twilio) | ~10-50ms | No |
| **Total** | **600-2000ms** | Turn gap tracked |

### Latency Optimizations In Place

1. Parallel initialization (STT, TTS prewarm, memory, LLM prewarm)
2. Speculative generation during partial transcripts (0.80 similarity threshold)
3. Pre-cached filler audio for tool call gaps
4. Sentence-level streaming from LLM to TTS
5. 6-word fallback for fast first chunk
6. TTS prewarm (synthesize "." at startup)
7. LLM prewarm (minimal request to warm connection)
8. max_tokens=80 for fast LLM completion
9. EOT prediction on partial transcripts

### Architecture Strengths (Preserve These)

1. **Provider abstraction** — `TelephonyProvider` base class is truly agnostic
2. **Sentence-level streaming** — Smart boundary detection with abbreviation handling
3. **Adaptive barge-in** — Calibrates from ambient noise automatically
4. **Emotion-aware pipeline** — Detection flows through prompting, TTS params, and filler selection
5. **TTS failover with circuit breakers** — Production-grade with half-open recovery
6. **Speculative generation** — SequenceMatcher-based pre-generation with history snapshots
7. **Event bus decoupling** — Clean separation of call lifecycle from side effects
8. **Multi-language with atomic swap** — STT+TTS replaced together under speak lock
9. **Audio smoothing** — Crossfade eliminates chunk-boundary clicks
10. **Compliance in hot path** — PII redaction runs on every transcript, not post-processing

---

## PART 4: ARCHITECTURE OVERVIEW

### System Stats

| Metric | Value |
|--------|-------|
| Python files (backend) | 106 |
| Python LOC (backend) | 13,028 |
| Largest file | server.py (2,610 lines) |
| API endpoints | 70+ |
| WebSocket endpoints | 2 |
| External integrations | 14 |
| Event bus listeners | 11 modules |
| Industry templates | 10 |
| Frontend files (Next.js) | 33 |
| Dashboard files (React/Vite) | 42 |
| Test files | 2 (LLM-as-judge only) |

### Architecture Patterns

| Pattern | Location | Assessment |
|---------|----------|-----------|
| Event-Driven | `events.py` | Good decoupling, no durability |
| Circuit Breaker | `providers/failover.py` | Production-grade for TTS |
| Strategy | `telephony/base.py` | Clean provider abstraction |
| Singleton | `config.py`, `db/supabase.py` | Appropriate |
| DI (FastAPI Depends) | `tenants/auth.py` | Consistent usage |
| Template Method | `templates/registry.py` | Auto-discovery, clean |
| Adapter | `emotions/tts_adapter.py` | Good separation |
| Multi-tenant | `tenants/`, `db/migrations/` | Shared DB, row-level isolation |

### Structural Issues

| Issue | Impact |
|-------|--------|
| 2,610-line monolithic `server.py` | Impossible to maintain/test/review |
| In-memory state breaks horizontal scaling | `active_calls`, rate limiter, event bus are per-process |
| No message queue for side effects | Post-call analysis, CRM sync, webhooks have no durability |
| `TenantDB` defined but never used | Manual `tenant_id` filtering everywhere — data leak risk |
| Duplicate emotion detection (`detector.py` vs `sentiment.py`) | Dead code confusion |
| `EmotionalMirror` defined but never imported | Dead code |
| Nested `website/website/` — older copy of entire project | Disk bloat, confusion |
| No automated test coverage | 0 unit tests, 0 integration tests |
| API scope enforcement defined but never applied | API keys grant full access regardless of scopes |
| No Pydantic request/response models | No validation, no OpenAPI schema |

---

## PART 5: OPTIMIZATION ROADMAP

### Quick Wins (< 1 hour each)

| # | Optimization | File | Impact |
|---|-------------|------|--------|
| QW1 | Parallel event handlers (`asyncio.gather`) | `events.py:40-46` | 5-7x faster post-call processing |
| QW2 | Persistent httpx client for webhooks | `webhooks/dispatcher.py:45` | -250-500ms per webhook batch |
| QW3 | Persistent httpx client for embeddings | `knowledge/base.py:84` | -5-10s per document ingestion |
| QW4 | Pre-compile contraction regexes | `pipeline.py:72-103` | -0.5-2ms per TTS sentence |
| QW5 | Use `audioop.rms()` for energy detection | `audio.py:80-84` | ~20x faster per audio packet |
| QW6 | Set httpx base_url + persistent headers | `db/supabase.py:23` | Better connection reuse |
| QW7 | O(1) latency tracer lookup | `latency/tracer.py:36-40` | Removes O(n) scan per trace end |
| QW8 | Check empty text before humanize | `pipeline.py:734-742` | Skip 38 regex subs on empty |

### Medium Effort (1-4 hours each)

| # | Optimization | Impact |
|---|-------------|--------|
| ME1 | Batch DNC lookup — pre-load set at campaign start | -30s per 1000-number campaign |
| ME2 | Campaign status check via in-memory flag instead of DB | -2000 DB queries per 1000 numbers |
| ME3 | Deduplicate pre-call memory + prediction DB queries | -60-100ms call setup time |
| ME4 | Batch billing summary — 3 queries instead of 300 | Admin page: 30s -> 1s |
| ME5 | Server-side contact search with `ilike` filter | Correct results + less bandwidth |
| ME6 | N+1 fix in `list_organizations` | 6 DB calls -> 2 for 5 orgs |
| ME7 | Sarvam TTS chunking for lower perceived latency | -100-300ms first-byte for Indian languages |
| ME8 | Fire-and-forget LLM summary generation | -200-500ms post-call processing |
| ME9 | Batch contact import (N+1 -> bulk upsert) | 1000 contacts: 2000 queries -> ~5 |
| ME10 | Push analytics aggregation to DB (Supabase RPC) | Analytics endpoints 10-100x faster |

### Large Effort (1+ days each)

| # | Optimization | Impact |
|---|-------------|--------|
| LE1 | In-memory caching layer (agents, tenants, DNC, plans) | -50-80% DB round-trips |
| LE2 | Batch knowledge base ingestion (embedding + upsert) | Ingestion: 2min -> 10s |
| LE3 | Shared module-level httpx clients for all providers | -80-90% TCP overhead, -30-50ms per external call |
| LE4 | Decouple LLM streaming from TTS playback (queue-based) | -100-300ms per multi-sentence response |
| LE5 | Redis-backed rate limiting + event bus durability | True horizontal scaling |

### Estimated Combined Impact

| Metric | Improvement |
|--------|------------|
| Voice latency (per turn) | -200-600ms |
| Call setup time | -60-100ms |
| Post-call processing | -450-1000ms |
| Campaign execution (1K numbers) | -60 seconds |
| API endpoint response time | -100-500ms |
| Memory per concurrent call | -40-60% |
| DB queries per call lifecycle | -6-10 queries |
| Admin billing page | 30s -> 1s |

---

## PART 6: LOAD TEST PLAN

### Concurrency Limits (Current)

| Resource | Limit | Location |
|----------|-------|----------|
| Max concurrent calls | 50 | `config.py:63` |
| Outbound call rate | 20/min per tenant | `server.py:101` |
| API key rate limit | 60 RPM per key | `auth.py:179` |
| Supabase connections | 100 (httpx default) | `db/supabase.py:23` |
| Redis socket timeout | 3s | `scaling.py:46-48` |

### Per-Call Resource Footprint

At 50 concurrent calls:
- 50 telephony WebSockets
- 50 Deepgram WebSockets
- 50 Groq HTTP streaming connections
- 50-150 TTS HTTP connections
- 200-300+ total open connections
- ~500MB-2.5GB memory (depending on call duration and browser recording)

### Test Scenarios

1. **REST API CRUD** — 50 VUs, 10min steady, p95 < 500ms target
2. **WebSocket Voice Pipeline** — Ramp 1->10->25->50 concurrent, measure turn gap
3. **Telephony Webhook Burst** — 50 simultaneous inbound, < 200ms response target
4. **Campaign Execution** — 1000 numbers, max_concurrent=5, measure dial rate
5. **Dashboard Analytics Under Load** — 10 VUs polling during active calls
6. **Contact Import Stress** — 100/500/1K/5K contacts, measure timeout behavior
7. **Auth Dependency Stress** — 200 RPM mixed auth methods, measure resolution time

### Tooling

Ready-to-use configs provided for **k6** (WebSocket + HTTP), **Locust** (Python-native), and **Artillery** (YAML-driven).

---

## PART 7: FRONTEND AUDIT

### Performance Issues

| Issue | Impact | Fix Effort |
|-------|--------|-----------|
| 9 unused deps (~400KB): Three.js, GSAP, Mux, hls.js, motion | Bloated install, supply chain risk | 5 min |
| Render-blocking Google Fonts CSS import | -100-300ms FCP | 10 min |
| All `<a>` tags, zero `next/link` | No client-side nav, no prefetch | 20 min |
| 304KB favicon | ~3s on 3G | 5 min |
| All 15 components are `"use client"` | Oversized client JS bundle | 20 min |
| Duplicate `motion` + `framer-motion` deps | Same package listed twice | 2 min |

### Missing Infrastructure

| Missing | Impact | Fix Effort |
|---------|--------|-----------|
| `robots.txt` / `sitemap.xml` | SEO — search engines can't crawl properly | 10 min |
| `error.tsx` / `not-found.tsx` | Raw Next.js error pages shown to users | 10 min |
| OG image in metadata | No social media preview image | 10 min |
| `Instrument Sans` font referenced but never loaded | Silently falls back to system font | 10 min |

### Code Quality

| Issue | Impact |
|-------|--------|
| ~300 lines duplicated between login/signup | Maintenance liability |
| Client-side only auth protection on dashboard | Flash of loading, JS always downloaded |
| FAQ accordion missing ARIA attributes | Screen reader inaccessible |
| Form labels not associated with inputs | Accessibility broken |
| Dead nav links (Blog, Docs = `#`) | User confusion |
| Contact page uses placeholder WhatsApp number | Broken contact channel |
| `unsafe-eval` in CSP | Weakens XSS protection |

---

## PART 8: PRIORITIZED ACTION PLAN

### Phase 1: Critical Fixes (1-2 days)
1. Fix ElevenLabs 16kHz->8kHz resampling (CRIT-1)
2. Add SarvamSTT `flush_pending` method (CRIT-2)
3. Fix SarvamSTT `audioop` import (CRIT-3)
4. Fix billing race conditions with atomic increment (CRIT-4, CRIT-5)
5. Fix OAuth callback session persistence (CRIT-6)
6. Close LLM client in `pipeline.stop()` (CRIT-7)
7. Fix webhook HMAC empty secret (CRIT-8)
8. Add TTL cleanup for `_pending_agent_overrides` (CRIT-9)
9. Bound `_voice_preview_cache` (CRIT-10)
10. Add WebSocket send error handling to providers (H15)

### Phase 2: Quick Wins (1 day)
1. Parallel event handlers with `asyncio.gather` (QW1)
2. Persistent httpx clients for webhooks + embeddings (QW2, QW3)
3. Remove 9 unused frontend deps (H9)
4. Switch to `next/font/google` (H10)
5. Replace `<a>` with `<Link>` (H11)
6. Compress favicon (H12)
7. Add `robots.txt`, `sitemap.xml`, `error.tsx`, `not-found.tsx`
8. Use proper HTTP status codes for API errors (H1)

### Phase 3: High-Value Improvements (3-5 days)
1. Split `server.py` into FastAPI APIRouter modules
2. Use `TenantDB` everywhere (prevent data leaks)
3. Apply API key scope enforcement
4. Add Pydantic request/response models
5. Batch DNC lookup + campaign status caching
6. Batch contact import
7. Push analytics to DB (Supabase RPC)
8. Add STT failover (Deepgram -> Sarvam)
9. Wrap `pipeline.stop()` in try/finally for cleanup
10. Delete nested `website/website/` dead code

### Phase 4: Architecture Evolution (1-2 weeks)
1. In-memory caching layer for hot paths
2. Shared provider httpx clients
3. Redis-backed rate limiting
4. Message queue for durable side effects
5. Structured logging with call_id correlation
6. Unit test infrastructure (target 80% on business logic)
7. LLM/TTS pipeline decoupling (queue-based)
8. Dedup login/signup into shared auth components
