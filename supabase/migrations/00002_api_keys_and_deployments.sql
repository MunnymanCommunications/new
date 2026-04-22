-- VibeCraft Platform Schema - Migration 2
-- Adds: user API keys (encrypted), deployment subdomain tracking, model preferences

-- ============================================
-- 1. USER API KEYS (encrypted storage)
-- ============================================
CREATE TABLE IF NOT EXISTS user_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('anthropic', 'openai', 'google')),
  encrypted_key TEXT NOT NULL,
  key_hint TEXT NOT NULL,
  is_valid BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, provider)
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own API keys" ON user_api_keys FOR ALL USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_api_keys_user_id ON user_api_keys(user_id);

-- ============================================
-- 2. ADD MODEL PREFERENCE TO PROFILES
-- ============================================
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_provider TEXT DEFAULT 'anthropic'
  CHECK (preferred_provider IN ('anthropic', 'openai', 'google'));
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_model TEXT DEFAULT 'claude-sonnet-4-5-20250929';

-- ============================================
-- 3. ADD SUBDOMAIN TO DEPLOYMENTS + PROJECTS
-- ============================================
ALTER TABLE projects ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS subdomain TEXT;
ALTER TABLE deployments ADD COLUMN IF NOT EXISTS build_path TEXT;

-- ============================================
-- 4. PUBLISHED SITES TABLE (for subdomain serving)
-- ============================================
CREATE TABLE IF NOT EXISTS published_sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL UNIQUE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  subdomain TEXT NOT NULL UNIQUE,
  build_output TEXT NOT NULL DEFAULT '',
  index_html TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  last_published_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE published_sites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own published sites" ON published_sites FOR ALL
  USING (auth.uid() = user_id);
CREATE POLICY "Public can read active published sites" ON published_sites FOR SELECT
  USING (is_active = true);

CREATE INDEX IF NOT EXISTS idx_published_sites_subdomain ON published_sites(subdomain);
CREATE INDEX IF NOT EXISTS idx_published_sites_project_id ON published_sites(project_id);

-- ============================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================
CREATE TRIGGER update_user_api_keys_updated_at BEFORE UPDATE ON user_api_keys FOR EACH ROW EXECUTE FUNCTION update_updated_at();
