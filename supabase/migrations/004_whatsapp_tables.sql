-- WhatsApp message history and conversation tracking

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  phone_number text NOT NULL,
  direction text NOT NULL DEFAULT 'inbound',
  message_type text DEFAULT 'text',
  content text,
  wa_message_id text,
  status text DEFAULT 'delivered',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL,
  agent_id uuid NOT NULL,
  phone_number text NOT NULL,
  status text DEFAULT 'active',
  last_message_at timestamptz DEFAULT now(),
  message_count integer DEFAULT 0,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone ON public.whatsapp_messages(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_messages_agent ON public.whatsapp_messages(agent_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_tenant ON public.whatsapp_messages(tenant_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_created ON public.whatsapp_messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_phone ON public.whatsapp_conversations(phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_tenant ON public.whatsapp_conversations(tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_conversations_unique ON public.whatsapp_conversations(tenant_id, agent_id, phone_number);

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
