-- Cogniflow Home: Create all tables for project afchhffhpszwrtnnzzhw
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).

-- ============================================================================
-- 1. Core multi-tenancy
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  email text NOT NULL,
  phone text,
  plan text NOT NULL DEFAULT 'starter',
  status text NOT NULL DEFAULT 'active',
  monthly_minutes_limit integer DEFAULT 500,
  max_agents integer DEFAULT 1,
  max_concurrent_calls integer DEFAULT 5,
  current_month_minutes integer DEFAULT 0,
  current_month_cost_paise integer DEFAULT 0,
  subscription_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tenant_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'viewer',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.plans (
  id text PRIMARY KEY,
  name text NOT NULL,
  monthly_fee_paise integer DEFAULT 0,
  included_minutes integer DEFAULT 500,
  price_per_extra_minute_paise integer DEFAULT 1500,
  max_agents integer DEFAULT 1,
  max_concurrent integer DEFAULT 5,
  features text[] DEFAULT ARRAY[]::text[]
);

INSERT INTO public.plans (id, name, monthly_fee_paise, included_minutes, price_per_extra_minute_paise, max_agents, max_concurrent, features)
VALUES
  ('starter', 'Starter', 299900, 500, 1500, 3, 5, ARRAY['10+ languages', 'basic analytics', 'email support']),
  ('growth', 'Growth', 999900, 2000, 1200, 10, 15, ARRAY['10+ languages', 'advanced analytics', 'priority support', 'CRM integrations', 'custom voices']),
  ('enterprise', 'Enterprise', 0, 99999, 900, 999, 50, ARRAY['everything in growth', 'dedicated support', 'SLA', 'custom deployment', 'white-label'])
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- 2. Agents
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text NOT NULL,
  instructions text,
  greeting text,
  voice_id text,
  language text DEFAULT 'en',
  phone_numbers text[] DEFAULT ARRAY[]::text[],
  is_active boolean DEFAULT true,
  emotion_profile text,
  voice_gender text,
  guardrails jsonb DEFAULT '{}'::jsonb,
  llm_provider text DEFAULT 'groq',
  llm_model text DEFAULT 'llama-3.3-70b-versatile',
  temperature numeric DEFAULT 0.7,
  tts_provider text DEFAULT 'sarvam',
  tts_voice_name text,
  tools_enabled text[] DEFAULT ARRAY[]::text[],
  max_call_duration integer DEFAULT 600,
  enable_memory boolean DEFAULT false,
  enable_prediction boolean DEFAULT false,
  enable_emotion boolean DEFAULT true,
  enable_language_switch boolean DEFAULT true,
  enable_rag boolean DEFAULT false,
  stt_language text DEFAULT 'en',
  endpointing_ms integer DEFAULT 300,
  smart_format boolean DEFAULT true,
  max_tokens integer DEFAULT 80,
  silence_timeout integer DEFAULT 500,
  enable_recording boolean DEFAULT true,
  enable_barge_in boolean DEFAULT true,
  enable_speculative boolean DEFAULT false,
  enable_filler boolean DEFAULT true,
  webhook_url text,
  fallback_message text,
  max_retries integer DEFAULT 2,
  concurrent_call_limit integer DEFAULT 5,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. Calls
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.calls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  agent_id uuid REFERENCES public.agents(id),
  agent_name text,
  direction text DEFAULT 'outbound',
  caller_number text,
  called_number text,
  provider text DEFAULT 'vobiz',
  status text DEFAULT 'active',
  duration_seconds integer,
  transcript jsonb DEFAULT '[]'::jsonb,
  summary text,
  sentiment_score numeric,
  disposition text,
  recording_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  ended_at timestamptz
);

-- ============================================================================
-- 4. Contacts
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  phone_number text,
  name text,
  email text,
  company text,
  notes text,
  tags text[] DEFAULT ARRAY[]::text[],
  total_calls integer DEFAULT 0,
  last_call_at timestamptz,
  language text,
  preferences jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 5. Campaigns
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text NOT NULL,
  agent_id uuid REFERENCES public.agents(id),
  status text DEFAULT 'draft',
  phone_numbers text[] DEFAULT ARRAY[]::text[],
  total_numbers integer DEFAULT 0,
  dialed_count integer DEFAULT 0,
  connected_count integer DEFAULT 0,
  completed_count integer DEFAULT 0,
  max_concurrent integer DEFAULT 1,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 6. API Keys
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text NOT NULL,
  key_hash text NOT NULL,
  key_prefix text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{read}'::text[],
  is_active boolean NOT NULL DEFAULT true,
  rate_limit_rpm integer DEFAULT 60,
  expires_at timestamptz,
  last_used_at timestamptz,
  total_requests integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 7. Usage & Billing
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.usage_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  call_id text NOT NULL,
  duration_seconds integer NOT NULL DEFAULT 0,
  stt_cost_paise integer DEFAULT 0,
  llm_cost_paise integer DEFAULT 0,
  tts_cost_paise integer DEFAULT 0,
  tel_cost_paise integer DEFAULT 0,
  total_cost_paise integer DEFAULT 0,
  language text DEFAULT 'hi',
  provider text DEFAULT 'vobiz',
  recorded_at timestamptz DEFAULT now(),
  billing_month text DEFAULT to_char(now(), 'YYYY-MM')
);

-- ============================================================================
-- 8. Integrations
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  type text NOT NULL,
  name text,
  status text DEFAULT 'disconnected',
  config jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 9. Webhooks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  url text NOT NULL,
  events text[] DEFAULT ARRAY[]::text[],
  secret text,
  is_active boolean DEFAULT true,
  failure_count integer DEFAULT 0,
  last_triggered_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 10. DNC (Do Not Call)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.dnc_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  phone_number text NOT NULL,
  reason text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 11. Knowledge Base (RAG chunks)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id text PRIMARY KEY,
  agent_id uuid REFERENCES public.agents(id) ON DELETE CASCADE,
  source text,
  chunk_index integer,
  content text,
  embedding float8[],
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 12. Appointments
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text,
  date text,
  time text,
  phone text,
  email text,
  notes text,
  call_id uuid REFERENCES public.calls(id),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 13. A/B Tests
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.ab_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  variants jsonb DEFAULT '[]'::jsonb,
  status text DEFAULT 'active',
  results jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 14. Call Metadata (AI SDR context)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.call_metadata (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  call_sid uuid REFERENCES public.calls(id),
  data jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 15. Organizations (multi-org support)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text,
  owner_email text NOT NULL,
  api_key text,
  is_active boolean DEFAULT true,
  plan text DEFAULT 'starter',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.org_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text DEFAULT 'member',
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 16. Benchmarks
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  results jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 17. Call Bookings (public form, no tenant context at insert)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.call_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  name text NOT NULL,
  email text NOT NULL,
  company text,
  phone text,
  cal_booking_uid text,
  cal_event_type text,
  scheduled_at timestamptz,
  status text DEFAULT 'pending',
  source text DEFAULT 'website',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 18. Rate Limits
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 19. Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tenant_users_email ON public.tenant_users(email);
CREATE INDEX IF NOT EXISTS idx_tenant_users_tenant ON public.tenant_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_agents_tenant ON public.agents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_tenant ON public.calls(tenant_id);
CREATE INDEX IF NOT EXISTS idx_calls_agent ON public.calls(agent_id);
CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON public.contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON public.contacts(phone_number);
CREATE INDEX IF NOT EXISTS idx_campaigns_tenant ON public.campaigns(tenant_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_tenant ON public.api_keys(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_tenant ON public.usage_records(tenant_id);
CREATE INDEX IF NOT EXISTS idx_usage_billing_month ON public.usage_records(billing_month);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_tenant ON public.webhook_endpoints(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dnc_tenant ON public.dnc_list(tenant_id);
CREATE INDEX IF NOT EXISTS idx_dnc_phone ON public.dnc_list(phone_number);
CREATE INDEX IF NOT EXISTS idx_knowledge_agent ON public.knowledge_chunks(agent_id);
CREATE INDEX IF NOT EXISTS idx_integrations_tenant ON public.integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants(slug);
CREATE INDEX IF NOT EXISTS idx_rate_limits_key ON public.rate_limits(key);
CREATE INDEX IF NOT EXISTS idx_org_members_org ON public.org_members(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_email ON public.org_members(email);
CREATE INDEX IF NOT EXISTS idx_calls_caller ON public.calls(caller_number);
CREATE INDEX IF NOT EXISTS idx_appointments_call ON public.appointments(call_id);
CREATE INDEX IF NOT EXISTS idx_ab_tests_campaign ON public.ab_tests(campaign_id);
