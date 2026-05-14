-- =====================================================================
-- COGNIFLOW HOME — V3 MIGRATION
-- Features: Caller Memory, Language Switching, Pre-Call Prediction,
--           Emotional Mirroring, Knowledge Base RAG, Salesforce,
--           Google Calendar, Razorpay, A/B Testing
--
-- Run in Supabase SQL Editor (one-shot, idempotent with IF NOT EXISTS)
-- =====================================================================


-- ─────────────────────────────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS vector;     -- pgvector for RAG embeddings
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram index for fuzzy contact search


-- ─────────────────────────────────────────────────────────────────────
-- 2. CONTACTS TABLE — add caller memory fields
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS total_calls INTEGER DEFAULT 0;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_call_at TIMESTAMPTZ;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS sentiment_avg FLOAT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_intent TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS last_disposition TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS salesforce_id TEXT;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS zoho_id TEXT;

-- Trigram index for fast fuzzy name search
CREATE INDEX IF NOT EXISTS idx_contacts_name_trgm ON contacts USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_company_trgm ON contacts USING gin (company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_contacts_salesforce ON contacts(salesforce_id);


-- ─────────────────────────────────────────────────────────────────────
-- 3. CALLS TABLE — add intent, disposition, language fields
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE calls ADD COLUMN IF NOT EXISTS intent_primary TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS intent_secondary TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS language TEXT DEFAULT 'en';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS language_switches JSONB DEFAULT '[]';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS emotional_states JSONB DEFAULT '[]';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS kb_sources_used JSONB DEFAULT '[]';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS ab_variant TEXT;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS prediction_used BOOLEAN DEFAULT false;
ALTER TABLE calls ADD COLUMN IF NOT EXISTS memory_loaded BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_calls_intent ON calls(intent_primary);
CREATE INDEX IF NOT EXISTS idx_calls_disposition ON calls(disposition);
CREATE INDEX IF NOT EXISTS idx_calls_language ON calls(language);


-- ─────────────────────────────────────────────────────────────────────
-- 4. AGENTS TABLE — add guardrails, knowledge base config
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE agents ADD COLUMN IF NOT EXISTS greeting TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS guardrails JSONB DEFAULT '{}';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS llm_provider TEXT DEFAULT 'groq';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS llm_model TEXT DEFAULT 'llama-3.3-70b-versatile';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tts_provider TEXT DEFAULT 'smallest';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tts_voice_name TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS max_call_duration INTEGER DEFAULT 600;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS enable_memory BOOLEAN DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS enable_prediction BOOLEAN DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS enable_emotion BOOLEAN DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS enable_language_switch BOOLEAN DEFAULT true;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS enable_rag BOOLEAN DEFAULT false;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS temperature FLOAT DEFAULT 0.7;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tools_enabled JSONB DEFAULT '["book_appointment", "transfer_call", "save_contact_info", "send_followup", "send_whatsapp"]';


-- ─────────────────────────────────────────────────────────────────────
-- 5. KNOWLEDGE BASE — pgvector chunks + similarity search
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS knowledge_chunks (
    id TEXT PRIMARY KEY,
    agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    source TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    token_count INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON knowledge_chunks(agent_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_source ON knowledge_chunks(agent_id, source);

-- IVFFlat index for fast vector search (create after ingesting data)
-- CREATE INDEX IF NOT EXISTS idx_knowledge_embedding ON knowledge_chunks
--     USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding vector(1536),
    match_agent_id UUID,
    match_count INT DEFAULT 3,
    match_threshold FLOAT DEFAULT 0.5
)
RETURNS TABLE (id TEXT, content TEXT, source TEXT, similarity FLOAT)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        kc.id,
        kc.content,
        kc.source,
        (1 - (kc.embedding <=> query_embedding))::FLOAT AS similarity
    FROM knowledge_chunks kc
    WHERE kc.agent_id = match_agent_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
    ORDER BY kc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Knowledge sources summary view
CREATE OR REPLACE VIEW knowledge_sources AS
SELECT
    agent_id,
    source,
    COUNT(*) AS chunk_count,
    SUM(token_count) AS total_tokens,
    MIN(created_at) AS ingested_at
FROM knowledge_chunks
GROUP BY agent_id, source;


-- ─────────────────────────────────────────────────────────────────────
-- 6. A/B TESTING
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ab_tests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    name TEXT,
    variants JSONB NOT NULL DEFAULT '[]',
    status TEXT DEFAULT 'active',
    results JSONB DEFAULT '{}',
    winner TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ab_tests_campaign ON ab_tests(campaign_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);


-- ─────────────────────────────────────────────────────────────────────
-- 7. CAMPAIGNS TABLE — add scheduling, retry, A/B config
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS failed_count INTEGER DEFAULT 0;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_max INTEGER DEFAULT 3;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS retry_delay_minutes INTEGER DEFAULT 30;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS call_window_start TIME DEFAULT '09:00';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS call_window_end TIME DEFAULT '18:00';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'Asia/Kolkata';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'twilio';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS ab_test_id UUID REFERENCES ab_tests(id);


-- ─────────────────────────────────────────────────────────────────────
-- 8. INTEGRATIONS TRACKING
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integrations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type TEXT NOT NULL,                -- 'salesforce', 'hubspot', 'zoho', 'google_calendar', 'razorpay', 'webhook'
    name TEXT NOT NULL,
    status TEXT DEFAULT 'disconnected', -- 'connected', 'disconnected', 'error'
    config JSONB DEFAULT '{}',         -- encrypted credentials reference (NOT raw keys)
    last_sync_at TIMESTAMPTZ,
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type);
CREATE INDEX IF NOT EXISTS idx_integrations_status ON integrations(status);


-- ─────────────────────────────────────────────────────────────────────
-- 9. PAYMENT LINKS
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS payment_links (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id TEXT REFERENCES calls(id),
    contact_phone TEXT,
    provider TEXT DEFAULT 'razorpay',    -- 'razorpay', 'stripe'
    provider_link_id TEXT,
    short_url TEXT,
    amount NUMERIC(12,2) NOT NULL,
    currency TEXT DEFAULT 'INR',
    description TEXT,
    status TEXT DEFAULT 'created',       -- 'created', 'paid', 'expired', 'cancelled'
    paid_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_links_call ON payment_links(call_id);
CREATE INDEX IF NOT EXISTS idx_payment_links_status ON payment_links(status);
CREATE INDEX IF NOT EXISTS idx_payment_links_phone ON payment_links(contact_phone);


-- ─────────────────────────────────────────────────────────────────────
-- 10. CALENDAR EVENTS
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id TEXT REFERENCES calls(id),
    contact_phone TEXT,
    provider TEXT DEFAULT 'google',      -- 'google', 'outlook'
    provider_event_id TEXT,
    title TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    attendee_email TEXT,
    description TEXT,
    status TEXT DEFAULT 'confirmed',     -- 'confirmed', 'cancelled', 'rescheduled'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_calendar_events_call ON calendar_events(call_id);
CREATE INDEX IF NOT EXISTS idx_calendar_events_time ON calendar_events(start_time);


-- ─────────────────────────────────────────────────────────────────────
-- 11. CALL EVENTS LOG — granular event tracking per call
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS call_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,            -- 'language_switch', 'emotion_change', 'tool_call', 'barge_in', 'compliance', 'kb_query', 'transfer'
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    data JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_call_events_call ON call_events(call_id);
CREATE INDEX IF NOT EXISTS idx_call_events_type ON call_events(event_type);
CREATE INDEX IF NOT EXISTS idx_call_events_time ON call_events(timestamp DESC);


-- ─────────────────────────────────────────────────────────────────────
-- 12. LATENCY TRACES — per-component latency measurements
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS latency_traces (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    call_id TEXT NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
    turn_index INTEGER NOT NULL,
    stt_ms FLOAT,
    eot_ms FLOAT,
    llm_ttft_ms FLOAT,
    tts_ttfb_ms FLOAT,
    total_ms FLOAT,
    speculative_hit BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_latency_call ON latency_traces(call_id);


-- ─────────────────────────────────────────────────────────────────────
-- 13. DAILY ANALYTICS — materialized view for dashboard
-- ─────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS daily_call_stats AS
SELECT
    DATE(created_at AT TIME ZONE 'Asia/Kolkata') AS day,
    COUNT(*) AS total_calls,
    COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound_calls,
    COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound_calls,
    ROUND(AVG(duration_seconds)::numeric, 1) AS avg_duration,
    ROUND(AVG(sentiment_score)::numeric, 2) AS avg_sentiment,
    ROUND(AVG(quality_score)::numeric, 2) AS avg_quality,
    COUNT(*) FILTER (WHERE disposition = 'interested') AS interested,
    COUNT(*) FILTER (WHERE disposition = 'not_interested') AS not_interested,
    COUNT(*) FILTER (WHERE disposition = 'callback_requested') AS callback_requested,
    COUNT(*) FILTER (WHERE disposition = 'escalated') AS escalated,
    COUNT(DISTINCT caller_number) AS unique_callers,
    COUNT(DISTINCT agent_id) AS agents_used
FROM calls
WHERE status = 'completed'
GROUP BY DATE(created_at AT TIME ZONE 'Asia/Kolkata');

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_stats_day ON daily_call_stats(day);

-- Refresh function (call via cron or manually)
CREATE OR REPLACE FUNCTION refresh_daily_stats()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_call_stats;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- 14. AGENT PERFORMANCE — materialized view for agent comparison
-- ─────────────────────────────────────────────────────────────────────

CREATE MATERIALIZED VIEW IF NOT EXISTS agent_performance AS
SELECT
    a.id AS agent_id,
    a.name AS agent_name,
    COUNT(c.id) AS total_calls,
    ROUND(AVG(c.duration_seconds)::numeric, 1) AS avg_duration,
    ROUND(AVG(c.sentiment_score)::numeric, 2) AS avg_sentiment,
    ROUND(AVG(c.quality_score)::numeric, 2) AS avg_quality,
    COUNT(*) FILTER (WHERE c.disposition = 'interested') AS conversions,
    ROUND(
        (COUNT(*) FILTER (WHERE c.disposition = 'interested'))::numeric /
        NULLIF(COUNT(c.id), 0) * 100, 1
    ) AS conversion_rate
FROM agents a
LEFT JOIN calls c ON c.agent_id = a.id AND c.status = 'completed'
GROUP BY a.id, a.name;

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_perf ON agent_performance(agent_id);


-- ─────────────────────────────────────────────────────────────────────
-- 15. ROW LEVEL SECURITY — new tables
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE knowledge_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE latency_traces ENABLE ROW LEVEL SECURITY;

-- Service role bypass for all new tables
CREATE POLICY "Service role bypass" ON knowledge_chunks FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON ab_tests FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON integrations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON payment_links FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON calendar_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON call_events FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON latency_traces FOR ALL USING (auth.role() = 'service_role');

-- Authenticated user access
CREATE POLICY "Allow all for authenticated" ON knowledge_chunks FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON ab_tests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON integrations FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON payment_links FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON calendar_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON call_events FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON latency_traces FOR ALL USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────
-- 16. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────────────

-- Get caller profile with recent call history (used by caller memory)
CREATE OR REPLACE FUNCTION get_caller_profile(caller_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    profile JSONB;
    recent_calls JSONB;
BEGIN
    SELECT jsonb_build_object(
        'name', c.name,
        'company', c.company,
        'email', c.email,
        'total_calls', c.total_calls,
        'preferences', c.preferences,
        'sentiment_avg', c.sentiment_avg,
        'last_intent', c.last_intent,
        'last_disposition', c.last_disposition,
        'notes', c.notes,
        'tags', c.tags
    ) INTO profile
    FROM contacts c
    WHERE c.phone_number = caller_phone;

    IF profile IS NULL THEN
        RETURN NULL;
    END IF;

    SELECT jsonb_agg(jsonb_build_object(
        'summary', cl.summary,
        'intent', cl.intent_primary,
        'disposition', cl.disposition,
        'sentiment', cl.sentiment_score,
        'duration', cl.duration_seconds,
        'date', cl.created_at
    ) ORDER BY cl.created_at DESC)
    INTO recent_calls
    FROM (
        SELECT * FROM calls
        WHERE caller_number = caller_phone
        AND summary IS NOT NULL
        ORDER BY created_at DESC
        LIMIT 5
    ) cl;

    RETURN profile || jsonb_build_object('recent_calls', COALESCE(recent_calls, '[]'::jsonb));
END;
$$;

-- Update contact stats after each call (can be called from event handler)
CREATE OR REPLACE FUNCTION update_contact_after_call(
    caller_phone TEXT,
    call_sentiment FLOAT DEFAULT NULL,
    call_intent TEXT DEFAULT NULL,
    call_disposition TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE contacts SET
        total_calls = COALESCE(total_calls, 0) + 1,
        last_call_at = NOW(),
        sentiment_avg = CASE
            WHEN call_sentiment IS NOT NULL THEN
                COALESCE((sentiment_avg * total_calls + call_sentiment) / (total_calls + 1), call_sentiment)
            ELSE sentiment_avg
        END,
        last_intent = COALESCE(call_intent, last_intent),
        last_disposition = COALESCE(call_disposition, last_disposition),
        updated_at = NOW()
    WHERE phone_number = caller_phone;
END;
$$;

-- Campaign analytics summary
CREATE OR REPLACE FUNCTION campaign_analytics(p_campaign_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_calls', COUNT(*),
        'avg_duration', ROUND(AVG(duration_seconds)::numeric, 1),
        'avg_sentiment', ROUND(AVG(sentiment_score)::numeric, 2),
        'dispositions', jsonb_build_object(
            'interested', COUNT(*) FILTER (WHERE disposition = 'interested'),
            'not_interested', COUNT(*) FILTER (WHERE disposition = 'not_interested'),
            'callback', COUNT(*) FILTER (WHERE disposition = 'callback_requested'),
            'no_answer', COUNT(*) FILTER (WHERE disposition = 'no_answer'),
            'voicemail', COUNT(*) FILTER (WHERE disposition = 'voicemail')
        ),
        'conversion_rate', ROUND(
            (COUNT(*) FILTER (WHERE disposition = 'interested'))::numeric /
            NULLIF(COUNT(*), 0) * 100, 1
        ),
        'unique_contacts', COUNT(DISTINCT caller_number),
        'languages_used', jsonb_agg(DISTINCT language)
    ) INTO result
    FROM calls
    WHERE campaign_id = p_campaign_id;

    RETURN result;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────
-- DONE. Run refresh_daily_stats() after populating call data.
-- ─────────────────────────────────────────────────────────────────────
