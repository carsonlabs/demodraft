-- DemoDraft Production Enhancements Migration
-- Adds tables for caching, usage analytics, and improves error tracking

-- 1. LLM Response Cache Table
CREATE TABLE IF NOT EXISTS llm_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_hash TEXT NOT NULL UNIQUE,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  
  CONSTRAINT valid_expiration CHECK (expires_at > created_at)
);

-- Index for efficient cache lookups
CREATE INDEX IF NOT EXISTS idx_llm_cache_prompt_hash ON llm_cache(prompt_hash);
CREATE INDEX IF NOT EXISTS idx_llm_cache_expires_at ON llm_cache(expires_at);

-- Enable RLS
ALTER TABLE llm_cache ENABLE ROW LEVEL SECURITY;

-- Only service role can access cache
CREATE POLICY "Service role has full access to llm_cache"
  ON llm_cache
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role')
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- 2. Usage Analytics Table
CREATE TABLE IF NOT EXISTS usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL CHECK (event_type IN ('api_call', 'pdf_generated', 'email_sent', 'scan_completed', 'error')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
  prospect_id UUID REFERENCES prospects(id) ON DELETE SET NULL,
  metadata JSONB,
  duration_ms INTEGER,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_usage_events_user_id ON usage_events(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_event_type ON usage_events(event_type);
CREATE INDEX IF NOT EXISTS idx_usage_events_timestamp ON usage_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_events_campaign_id ON usage_events(campaign_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_user_timestamp ON usage_events(user_id, timestamp DESC);

-- Enable RLS
ALTER TABLE usage_events ENABLE ROW LEVEL SECURITY;

-- Users can only read their own events
CREATE POLICY "Users can view their own usage events"
  ON usage_events
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    auth.jwt()->>'role' = 'service_role'
  );

-- Service role can insert all events
CREATE POLICY "Service role can insert usage events"
  ON usage_events
  FOR INSERT
  WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- 3. Add indexes to existing tables for better performance
CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status);
CREATE INDEX IF NOT EXISTS idx_prospects_campaign_id ON prospects(campaign_id);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON drafts(status);
CREATE INDEX IF NOT EXISTS idx_drafts_user_id ON drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_drafts_campaign_id ON drafts(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_user_id ON campaigns(user_id);

-- 4. Create function to clean up expired cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM llm_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant execute to service role
GRANT EXECUTE ON FUNCTION cleanup_expired_cache() TO service_role;

-- 5. Add comments for documentation
COMMENT ON TABLE llm_cache IS 'Caches LLM API responses to reduce costs and improve latency';
COMMENT ON TABLE usage_events IS 'Tracks API usage, performance metrics, and user behavior';
COMMENT ON COLUMN llm_cache.prompt_hash IS 'SHA-256 hash of the prompt for cache key lookup';
COMMENT ON COLUMN llm_cache.expires_at IS 'Cache entry expiration timestamp';
COMMENT ON COLUMN usage_events.duration_ms IS 'Operation duration in milliseconds for performance tracking';
