# Research — Full Platform Audit & Fix Plan

## Summary

Audited all 24 known issues from CLAUDE.md. 17 are already resolved from prior iterations. 7 remain.

## Already Resolved (No Action Needed)

### Security
- **PyJWT**: Present in requirements.txt (line 12)
- **Hardcoded models**: Properly externalized to config.py env vars
- **KB embedding API key leak**: Error handlers log status codes only, no key exposure

### Voice Quality (ALL 7 RESOLVED)
- **Audio crossfade**: AudioSmoother in audio.py with 8ms crossfade, DC offset removal
- **Semantic EOT**: SemanticEOTDetector in latency/eot.py with multi-signal scoring
- **Sentence streaming**: _find_sentence_boundary() in groq_llm.py yields sentences before full response
- **LLM pre-warm**: Memory + prediction pre-fetch in pipeline.py:334-365
- **TTS fallback chain**: ProviderChain in failover.py (Sarvam → Smallest → ElevenLabs)
- **Filler audio**: Pre-synthesized in latency/filler.py with emotion-aware categories
- **Humanization prompt**: Full system in emotions/prompt_builder.py (fillers, Hindi, self-corrections)

### Website
- **CountUp**: Working correctly via Framer Motion useInView
- **FAQ accordion**: Working correctly with openIndex state toggle
- **Mobile nav hamburger**: Implemented in Navbar.tsx:123-180

## Remaining Issues (7)

### 1. SOQL Injection (CRITICAL)
- **File**: cogniflow_home/integrations/salesforce.py:67-93
- **Problem**: String concatenation builds SOQL query with phone input
- **Fix**: Proper SOQL escaping (escape single quotes AND backslashes, validate phone format strictly)

### 2. Google Calendar Service Account (HIGH)
- **File**: cogniflow_home/integrations/google_calendar.py:104-138
- **Problem**: Full JSON credentials stored in env var (leaks in error dumps)
- **Fix**: Add warning log if JSON env var used, prefer file path, validate permissions

### 3. Logo PNG Grey Background (MEDIUM)
- **File**: public/cogniflow-logo.png
- **Problem**: 1264×842 PNG with grey background
- **Fix**: Create clean SVG logo with transparent background

### 4. OG Image Missing (MEDIUM)
- **File**: src/app/layout.tsx metadata
- **Problem**: No og:image defined — poor social sharing
- **Fix**: Create 1200×630 OG image, add to metadata

### 5. Resources Nav "#" Links (MEDIUM)
- **File**: src/components/Navbar.tsx:18-25
- **Problem**: Blog and Docs dropdown items link to "#"
- **Fix**: Link to real pages or remove until pages exist

### 6. Sticky Bottom CTA Mobile (MEDIUM)
- **Problem**: No fixed bottom CTA bar on mobile
- **Fix**: Add fixed bottom bar with "Get Started" button, hidden on desktop

### 7. KB Context Pre-loading (MEDIUM)
- **File**: cogniflow_home/pipeline.py:570-577
- **Problem**: KB query runs during response generation, causing turn 2-3 latency spike
- **Fix**: Pre-fetch KB context on call start or on first transcript partial
