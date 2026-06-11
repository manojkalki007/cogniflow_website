-- Lead scoring column for campaign analytics
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS lead_score text DEFAULT 'unknown';
CREATE INDEX IF NOT EXISTS idx_calls_campaign_lead ON public.calls(campaign_id, lead_score);
