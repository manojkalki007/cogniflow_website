-- Cogniflow Home: Callbacks table for scheduling call-back-later requests
-- Run in Supabase SQL Editor. Safe to re-run (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS public.callbacks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES public.tenants(id),
  agent_id uuid REFERENCES public.agents(id),
  call_id text,
  phone_number text NOT NULL,
  callback_time text NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending',
  attempted_at timestamptz,
  completed_at timestamptz,
  notes text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_callbacks_tenant ON public.callbacks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_callbacks_phone ON public.callbacks(phone_number);
CREATE INDEX IF NOT EXISTS idx_callbacks_status ON public.callbacks(status);
