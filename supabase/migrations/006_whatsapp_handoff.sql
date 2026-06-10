-- Index for efficient escalation status filtering
CREATE INDEX IF NOT EXISTS idx_wa_conversations_status
  ON public.whatsapp_conversations(tenant_id, status);
