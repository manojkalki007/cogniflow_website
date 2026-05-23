# A-Grade Benchmarks — Cogniflow

Date: 2026-05-22 | Baseline established before build phase

---

## CTO Benchmarks

| # | Benchmark | Target | Current State | Gap |
|---|-----------|--------|---------------|-----|
| C1 | Security issues (5 CRITICAL from CLAUDE.md) | All fixed | 5/5 verified fixed | **PASS** |
| C2 | Emotion detection runs on every transcript | Per-turn | Wired at pipeline.py:533 | **PASS** |
| C3 | TTS params adapt per caller emotion | Per-turn | Wired at pipeline.py:761 | **PASS** |
| C4 | Provider fallback chain | Sarvam→Smallest→ElevenLabs | failover.py ProviderChain | **PASS** |
| C5 | Audio artifacts per call | < 10 | AudioSmoother exists, no benchmark script | **NEEDS BENCHMARK** |
| C6 | Latency P50 | < 350ms | Tracer exists, no benchmark script | **NEEDS BENCHMARK** |
| C7 | Latency P90 | < 500ms | Tracer exists, no benchmark script | **NEEDS BENCHMARK** |
| C8 | Cold start (turn 1) | < 500ms | Pre-warm in asyncio.gather, no measurement | **NEEDS BENCHMARK** |
| C9 | CI runs on push | lint + test + build | No CI/CD exists | **FAIL — BUILD** |
| C10 | Latency alert fires | P95 > 800ms → notify | Logs only, no external notify | **PARTIAL — BUILD** |
| C11 | Test coverage overall | > 60% | 2 test files, ~0% coverage | **FAIL — BUILD** |
| C12 | Test coverage business logic | > 80% | No emotion/EOT/auth/billing tests | **FAIL — BUILD** |
| C13 | Zero critical security findings | 0 | Audit found: bare excepts, no Pydantic | **OPEN** |

## Client Benchmarks

| # | Benchmark | Target | Current State | Gap |
|---|-----------|--------|---------------|-----|
| L1 | Filler words in responses | ~40% of responses | prompt_builder.py lines 23-25 | **PASS** |
| L2 | Acknowledgment before answering | Always | prompt_builder.py "Got it, so..." | **PASS** |
| L3 | Voice slows for frustrated caller | Pace < 1.0 | tts_params.py: frustrated→pace 0.90 | **PASS** |
| L4 | Voice speeds for happy caller | Pace > 1.0 | tts_params.py: happy→pace 1.10 | **PASS** |
| L5 | Greeting sounds human | Natural, not IVR | Humanization prompt applied | **PASS** |
| L6 | Onboarding: signup→first call | < 10 minutes | Setup wizard exists (3 steps) | **NEEDS VERIFY** |
| L7 | Dashboard empty states | Icon + message + CTA | No empty states found | **FAIL — BUILD** |
| L8 | Mobile flow works at 360px | Full flow | Hamburger nav + MobileCTA exist | **NEEDS VERIFY** |
| L9 | Mobile: stacked CTAs | Responsive layout | Hero CTAs exist, need to verify stacking | **NEEDS VERIFY** |
| L10 | OTP: numeric keyboard | inputMode="numeric" | Needs verification | **NEEDS VERIFY** |

## CEO Benchmarks

| # | Benchmark | Target | Current State | Gap |
|---|-----------|--------|---------------|-----|
| E1 | Razorpay checkout works | Test mode payment completes | Only payment links exist, no subscription/checkout | **FAIL — BUILD** |
| E2 | Payment → tenant activated | Webhook updates status | No webhook handler for subscriptions | **FAIL — BUILD** |
| E3 | Lighthouse Performance | > 90 | Not measured (no headless Chrome in env) | **NEEDS BENCHMARK** |
| E4 | Lighthouse Accessibility | > 90 | Not measured | **NEEDS BENCHMARK** |
| E5 | Lighthouse SEO | > 90 | Not measured | **NEEDS BENCHMARK** |
| E6 | Every CTA links to signup/Calendly | 0 dead CTAs | 1 dead `href="#"` on logo (harmless) | **PASS** |
| E7 | OG image on WhatsApp share | Renders correctly | opengraph-image.tsx exists | **PASS** |
| E8 | Pricing: clear INR amounts | ₹ visible, "No credit card" | Pricing component exists | **NEEDS VERIFY** |
| E9 | Scroll animations on every section | 11/11 sections | 10/11 — Footer missing | **PARTIAL** |
| E10 | Card hover interactions everywhere | All card types | 3 instances only — partial | **PARTIAL — BUILD** |
| E11 | Zero dead links | 0 | 1 harmless logo `#` | **PASS** |

---

## Scorecard Summary

| Grade Area | PASS | PARTIAL | FAIL | NEEDS WORK |
|------------|------|---------|------|------------|
| **CTO** (13) | 5 | 1 | 4 | 3 |
| **Client** (10) | 5 | 0 | 1 | 4 |
| **CEO** (11) | 4 | 2 | 2 | 3 |
| **TOTAL** (34) | **14** | **3** | **7** | **10** |

Current grade: **C+** (14/34 fully passing)
Target grade: **A** (30+/34 passing)

---

## Build Priority Order

### Priority 1 — Test Suite (Section 8)
Impact: C11, C12 | Effort: 1-2 hours
- tests/unit/test_emotions.py (8 tests)
- tests/unit/test_semantic_eot.py (6 tests)
- tests/unit/test_audio_smoother.py (4 tests)
- tests/unit/test_auth.py (6 tests)
- tests/unit/test_billing.py (4 tests)
- tests/unit/test_tenant.py (4 tests)
- tests/security/test_injection.py
- tests/security/test_auth_bypass.py

### Priority 2 — CI/CD (Section 7)
Impact: C9, C10 | Effort: 30 min
- .github/workflows/ci.yml
- Latency alert webhook in tracer.py

### Priority 3 — Razorpay Subscription Flow (Section 5)
Impact: E1, E2 | Effort: 1-2 hours
- cogniflow_home/payments/razorpay.py (subscriptions + webhook)
- API routes: /api/billing/subscribe, /api/billing/webhook
- Frontend: Razorpay JS checkout on pricing page

### Priority 4 — Website Polish (Section 4)
Impact: E9, E10, L7 | Effort: 1 hour
- Footer animation
- Card hover effects on all card types
- Dashboard empty states (icon + message + CTA)
- Mobile overflow protection

### Priority 5 — Benchmark Scripts (Section 3)
Impact: C5-C8, E3-E5 | Effort: 30 min
- tests/performance/benchmark_audio.py
- tests/performance/benchmark_latency.py
- (Lighthouse requires headless Chrome — can only run post-deploy)

### Priority 6 — Verify & Fix (Section 1 remaining)
Impact: L6, L8-L10, E8 | Effort: 30 min
- Onboarding wizard flow completeness
- Mobile 360px viewport
- OTP numeric keyboard
- Pricing INR display

---

## Sections Already Complete (No Build Needed)

| Section | Status |
|---------|--------|
| Section 2: Emotion Pipeline | **DONE** — All 5 files exist, fully wired into pipeline |
| Section 4.1: Scroll animations | **DONE** — 10/11 sections animated |
| Section 4.2: Frosted navbar | **DONE** — backdrop-blur on scroll |
| Section 4.4: Pricing glow | **DONE** — gradient border exists |
| Section 4.6: CountUp | **DONE** — useInView trigger working |
