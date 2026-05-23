-- Stores encrypted API keys and config per tenant per integration
-- Each tenant can have their own WhatsApp, Email, CRM, Calendar keys
CREATE TABLE IF NOT EXISTS tenant_integrations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL,

    -- Integration type identifier
    -- whatsapp, email, crm_leadrat, crm_hubspot, crm_salesforce,
    -- calendar_calcom, calendar_google, razorpay, telephony_vobiz, telephony_twilio
    integration     TEXT NOT NULL,

    -- Status: disconnected, configuring, testing, connected, error, pending_setup
    status          TEXT DEFAULT 'disconnected',

    -- Credentials (encrypted sensitive fields via AES-256-GCM, prefixed with "enc:")
    credentials     JSONB DEFAULT '{}',

    -- Non-secret config (template IDs, preferences, etc.)
    config          JSONB DEFAULT '{}',

    -- Health tracking
    last_tested_at  TIMESTAMPTZ,
    last_error      TEXT DEFAULT '',

    -- Setup mode: 'self' (client setup) or 'managed' (Cogniflow team setup)
    setup_mode      TEXT DEFAULT 'self',

    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(tenant_id, integration)
);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_tenant
    ON tenant_integrations(tenant_id);

CREATE INDEX IF NOT EXISTS idx_tenant_integrations_status
    ON tenant_integrations(tenant_id, status);

-- Enable RLS
ALTER TABLE tenant_integrations ENABLE ROW LEVEL SECURITY;

-- Tenants can only see their own integrations
CREATE POLICY tenant_integrations_tenant_policy ON tenant_integrations
    USING (tenant_id::text = current_setting('request.jwt.claims', true)::json->>'tenant_id');
