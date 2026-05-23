-- Cogniflow Row-Level Security (RLS) Policies
-- Purpose: Defense-in-depth for multi-tenant isolation.
-- Even if application code forgets to filter by tenant_id, RLS will block cross-tenant reads.
--
-- To apply:
--   supabase db push
-- Or paste this into the Supabase SQL editor in your project.
--
-- NOTE: These policies assume the JWT contains a 'tenant_id' claim (custom claim).
-- The backend's _resolve_jwt() auto-provisions tenants; you may need a Postgres
-- function or Supabase Edge Function to inject tenant_id into the JWT claims.
-- For now, the backend uses the service_role key which bypasses RLS — these
-- policies kick in for any direct frontend Supabase access or when you switch
-- to user JWT for backend operations.

-- ============================================================================
-- Tenant-scoped tables
-- ============================================================================

-- agents
alter table public.agents enable row level security;
drop policy if exists agents_tenant_isolation on public.agents;
create policy agents_tenant_isolation on public.agents
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- calls
alter table public.calls enable row level security;
drop policy if exists calls_tenant_isolation on public.calls;
create policy calls_tenant_isolation on public.calls
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- contacts
alter table public.contacts enable row level security;
drop policy if exists contacts_tenant_isolation on public.contacts;
create policy contacts_tenant_isolation on public.contacts
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- campaigns
alter table public.campaigns enable row level security;
drop policy if exists campaigns_tenant_isolation on public.campaigns;
create policy campaigns_tenant_isolation on public.campaigns
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- integrations
alter table public.integrations enable row level security;
drop policy if exists integrations_tenant_isolation on public.integrations;
create policy integrations_tenant_isolation on public.integrations
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- api_keys
alter table public.api_keys enable row level security;
drop policy if exists api_keys_tenant_isolation on public.api_keys;
create policy api_keys_tenant_isolation on public.api_keys
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- usage_records
alter table public.usage_records enable row level security;
drop policy if exists usage_records_tenant_isolation on public.usage_records;
create policy usage_records_tenant_isolation on public.usage_records
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- webhook_endpoints
alter table public.webhook_endpoints enable row level security;
drop policy if exists webhook_endpoints_tenant_isolation on public.webhook_endpoints;
create policy webhook_endpoints_tenant_isolation on public.webhook_endpoints
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- dnc_list
alter table public.dnc_list enable row level security;
drop policy if exists dnc_list_tenant_isolation on public.dnc_list;
create policy dnc_list_tenant_isolation on public.dnc_list
  for all using (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- ============================================================================
-- Public form-submission tables (insert from anonymous users, no tenant filter)
-- ============================================================================

-- call_bookings — public booking form (no tenant context at insert)
-- Reads should be restricted to the owning tenant or admin only.
alter table public.call_bookings enable row level security;
drop policy if exists call_bookings_insert_anon on public.call_bookings;
create policy call_bookings_insert_anon on public.call_bookings
  for insert with check (true);
drop policy if exists call_bookings_read_tenant on public.call_bookings;
create policy call_bookings_read_tenant on public.call_bookings
  for select using (
    tenant_id is null
    or tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- ============================================================================
-- Service-role bypass note
-- ============================================================================
-- The Cogniflow backend uses the service_role key for DB access, which
-- bypasses RLS by design. RLS is the second line of defense for:
--   1. Direct frontend Supabase usage (e.g., src/lib/supabase-browser.ts)
--   2. Future migration to per-user JWT auth on backend
--   3. Edge functions / RPCs called from the client
