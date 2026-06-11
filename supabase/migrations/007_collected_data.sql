-- Add collected_data JSONB column to calls and whatsapp_conversations
-- for storing structured data collected by the collect_info tool

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS collected_data jsonb DEFAULT '{}'::jsonb;

ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS collected_data jsonb DEFAULT '{}'::jsonb;
