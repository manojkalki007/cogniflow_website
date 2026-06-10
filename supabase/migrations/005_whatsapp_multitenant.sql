-- Multi-tenant hardening for WhatsApp tables
-- 1. RLS policies matching existing tenant_id JWT pattern
-- 2. GIN index on bolna_raw_config for JSONB routing queries
-- 3. RPC function for efficient agent routing (avoids full table scan)

-- whatsapp_messages RLS
DROP POLICY IF EXISTS whatsapp_messages_tenant_isolation ON public.whatsapp_messages;
CREATE POLICY whatsapp_messages_tenant_isolation ON public.whatsapp_messages
  FOR ALL USING (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- whatsapp_conversations RLS
DROP POLICY IF EXISTS whatsapp_conversations_tenant_isolation ON public.whatsapp_conversations;
CREATE POLICY whatsapp_conversations_tenant_isolation ON public.whatsapp_conversations
  FOR ALL USING (
    tenant_id::text = coalesce(auth.jwt() ->> 'tenant_id', '')
  );

-- GIN index for JSONB routing queries
CREATE INDEX IF NOT EXISTS idx_agents_bolna_raw_config_gin
  ON public.agents USING gin (bolna_raw_config);

-- RPC: route WhatsApp messages to agent+tenant by phone_number_id
CREATE OR REPLACE FUNCTION find_agent_by_wa_phone_id(phone_id text)
RETURNS TABLE (agent_id uuid, tenant_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT a.id AS agent_id, a.tenant_id
  FROM public.agents a
  WHERE a.status = 'active'
    AND (a.bolna_raw_config -> 'integration_config' ->> 'whatsapp_phone_number_id') = phone_id
  LIMIT 1;
$$;
