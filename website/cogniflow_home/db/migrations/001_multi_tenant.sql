-- Multi-tenant migration
-- Adds organization support: each tenant gets isolated data.

-- === ORGANIZATIONS ===
CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    owner_email TEXT NOT NULL,
    api_key TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
    plan TEXT DEFAULT 'starter',              -- starter, growth, enterprise
    settings JSONB DEFAULT '{}',              -- smtp config, branding, etc.
    max_agents INTEGER DEFAULT 3,
    max_concurrent_calls INTEGER DEFAULT 5,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_org_slug ON organizations(slug);
CREATE INDEX IF NOT EXISTS idx_org_api_key ON organizations(api_key);

-- === ADD tenant_id TO EXISTING TABLES ===

-- Calls
ALTER TABLE calls ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_calls_tenant ON calls(tenant_id);

-- Contacts
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);

-- Agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON agents(tenant_id);

-- Campaigns
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON campaigns(tenant_id);

-- Webhook Endpoints
ALTER TABLE webhook_endpoints ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_webhooks_tenant ON webhook_endpoints(tenant_id);

-- DNC List
ALTER TABLE dnc_list ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_dnc_tenant ON dnc_list(tenant_id);

-- Appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant ON appointments(tenant_id);

-- Benchmarks (if exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'benchmarks') THEN
        ALTER TABLE benchmarks ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES organizations(id);
        CREATE INDEX IF NOT EXISTS idx_benchmarks_tenant ON benchmarks(tenant_id);
    END IF;
END $$;

-- === TENANT MEMBERS ===
CREATE TABLE IF NOT EXISTS org_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role TEXT DEFAULT 'member',               -- owner, admin, member, viewer
    invited_by UUID,
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(org_id, email)
);

CREATE INDEX IF NOT EXISTS idx_org_members_email ON org_members(email);

-- === ROW LEVEL SECURITY (per-tenant) ===

-- Drop old single-tenant policies
DO $$
DECLARE
    tbl TEXT;
BEGIN
    FOR tbl IN SELECT unnest(ARRAY['calls','contacts','agents','campaigns','webhook_endpoints','dnc_list','appointments']) LOOP
        EXECUTE format('DROP POLICY IF EXISTS "Allow all for authenticated" ON %I', tbl);
    END LOOP;
END $$;

-- New tenant-scoped policies
CREATE POLICY "Tenant isolation" ON calls FOR ALL
    USING (tenant_id IN (
        SELECT org_id FROM org_members WHERE email = auth.jwt()->>'email'
    ));

CREATE POLICY "Tenant isolation" ON contacts FOR ALL
    USING (tenant_id IN (
        SELECT org_id FROM org_members WHERE email = auth.jwt()->>'email'
    ));

CREATE POLICY "Tenant isolation" ON agents FOR ALL
    USING (tenant_id IN (
        SELECT org_id FROM org_members WHERE email = auth.jwt()->>'email'
    ));

CREATE POLICY "Tenant isolation" ON campaigns FOR ALL
    USING (tenant_id IN (
        SELECT org_id FROM org_members WHERE email = auth.jwt()->>'email'
    ));

CREATE POLICY "Tenant isolation" ON webhook_endpoints FOR ALL
    USING (tenant_id IN (
        SELECT org_id FROM org_members WHERE email = auth.jwt()->>'email'
    ));

CREATE POLICY "Tenant isolation" ON dnc_list FOR ALL
    USING (tenant_id IN (
        SELECT org_id FROM org_members WHERE email = auth.jwt()->>'email'
    ));

CREATE POLICY "Tenant isolation" ON appointments FOR ALL
    USING (tenant_id IN (
        SELECT org_id FROM org_members WHERE email = auth.jwt()->>'email'
    ));

-- Service role still bypasses everything
-- (policies from original schema still apply)
