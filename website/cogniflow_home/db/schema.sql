-- Cogniflow Home Database Schema
-- Run this in your Supabase SQL editor to create all tables.

-- === CALLS ===
CREATE TABLE IF NOT EXISTS calls (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    direction TEXT NOT NULL,
    caller_number TEXT,
    called_number TEXT,
    agent_name TEXT,
    agent_id UUID,                          -- future: multi-agent support
    campaign_id UUID,                       -- future: campaign tracking
    provider TEXT DEFAULT 'twilio',
    status TEXT DEFAULT 'active',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER,
    transcript JSONB DEFAULT '[]',
    summary TEXT,
    sentiment TEXT,                          -- future: positive/negative/neutral
    sentiment_score FLOAT,                  -- future: -1.0 to 1.0
    quality_score FLOAT,                    -- future: 0.0 to 1.0
    action_items JSONB DEFAULT '[]',        -- future: extracted action items
    disposition TEXT,                        -- future: interested/not_interested/callback/etc
    recording_url TEXT,
    metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_calls_caller ON calls(caller_number);
CREATE INDEX IF NOT EXISTS idx_calls_status ON calls(status);
CREATE INDEX IF NOT EXISTS idx_calls_started ON calls(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_calls_agent ON calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_calls_campaign ON calls(campaign_id);

-- === CONTACTS ===
CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    name TEXT,
    email TEXT,
    company TEXT,
    language TEXT DEFAULT 'en',             -- future: multi-language support
    notes TEXT,
    tags JSONB DEFAULT '[]',                -- future: tagging system
    total_calls INTEGER DEFAULT 0,
    last_call_at TIMESTAMPTZ,
    hubspot_id TEXT,                         -- CRM sync
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_contacts_hubspot ON contacts(hubspot_id);

-- === AGENTS ===
-- Future: multi-agent support (different agents for different numbers/campaigns)
CREATE TABLE IF NOT EXISTS agents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    instructions TEXT NOT NULL,
    voice_id TEXT,
    language TEXT DEFAULT 'en',
    phone_numbers JSONB DEFAULT '[]',       -- which numbers this agent handles
    is_active BOOLEAN DEFAULT true,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === CAMPAIGNS ===
-- Future: batch outbound dialing
CREATE TABLE IF NOT EXISTS campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    agent_id UUID REFERENCES agents(id),
    status TEXT DEFAULT 'draft',            -- draft/active/paused/completed
    phone_numbers JSONB DEFAULT '[]',       -- numbers to dial
    total_numbers INTEGER DEFAULT 0,
    dialed_count INTEGER DEFAULT 0,
    connected_count INTEGER DEFAULT 0,
    completed_count INTEGER DEFAULT 0,
    max_concurrent INTEGER DEFAULT 1,
    schedule JSONB DEFAULT '{}',            -- future: time-of-day scheduling
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- === WEBHOOKS ===
CREATE TABLE IF NOT EXISTS webhook_endpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url TEXT NOT NULL,
    events JSONB DEFAULT '["call.completed"]',
    secret TEXT,
    is_active BOOLEAN DEFAULT true,
    failure_count INTEGER DEFAULT 0,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === DNC (Do Not Call) LIST ===
CREATE TABLE IF NOT EXISTS dnc_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone_number TEXT UNIQUE NOT NULL,
    reason TEXT DEFAULT 'manual',        -- manual, caller_requested, complaint
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dnc_phone ON dnc_list(phone_number);

-- === APPOINTMENTS ===
CREATE TABLE IF NOT EXISTS appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    call_id UUID REFERENCES calls(id),
    contact_phone TEXT,
    name TEXT,
    date TEXT,
    time TEXT,
    notes TEXT,
    status TEXT DEFAULT 'pending',       -- pending, confirmed, cancelled
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- === ANALYTICS (materialized view — future) ===
-- CREATE MATERIALIZED VIEW IF NOT EXISTS daily_call_stats AS
-- SELECT
--     DATE(started_at) as day,
--     COUNT(*) as total_calls,
--     COUNT(*) FILTER (WHERE direction = 'inbound') as inbound_calls,
--     COUNT(*) FILTER (WHERE direction = 'outbound') as outbound_calls,
--     AVG(duration_seconds) as avg_duration,
--     AVG(sentiment_score) as avg_sentiment,
--     AVG(quality_score) as avg_quality
-- FROM calls
-- WHERE status = 'completed'
-- GROUP BY DATE(started_at);

-- === ROW LEVEL SECURITY ===
ALTER TABLE calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE dnc_list ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (single-tenant for now)
CREATE POLICY "Allow all for authenticated" ON calls FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON contacts FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON agents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON campaigns FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON webhook_endpoints FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON dnc_list FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow all for authenticated" ON appointments FOR ALL USING (auth.role() = 'authenticated');

-- Service role bypass for backend API calls
CREATE POLICY "Service role bypass" ON calls FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON contacts FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON agents FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON campaigns FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON webhook_endpoints FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON dnc_list FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role bypass" ON appointments FOR ALL USING (auth.role() = 'service_role');
