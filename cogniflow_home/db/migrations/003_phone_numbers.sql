-- Phone numbers management table
-- Each row = one phone number connected to the platform via a telephony provider

CREATE TABLE IF NOT EXISTS phone_numbers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,
    provider        TEXT NOT NULL CHECK (provider IN ('vobiz','twilio','exotel','mcube','sip')),
    number          TEXT NOT NULL,
    display_name    TEXT DEFAULT '',
    status          TEXT DEFAULT 'active' CHECK (status IN ('active','pending_manual','provisioning','error','removed')),
    agent_id        UUID,
    credentials     TEXT,
    metadata        JSONB DEFAULT '{}',
    concurrency     INTEGER DEFAULT 5,
    last_tested_at  TIMESTAMPTZ,
    last_call_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(tenant_id, number)
);

CREATE INDEX IF NOT EXISTS idx_phone_numbers_tenant ON phone_numbers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_agent ON phone_numbers(agent_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_number ON phone_numbers(number);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_status ON phone_numbers(tenant_id, status);
