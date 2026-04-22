-- VibeCraft Platform Schema
-- Run this against your Supabase instance (SQL Editor or migration)

-- ============================================
-- 1. USER PROFILES
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  avatar_url TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'business')),
  credits_remaining INTEGER DEFAULT 30,
  credits_total INTEGER DEFAULT 30,
  credits_reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. PROJECTS
-- ============================================
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  settings JSONB DEFAULT '{
    "framework": "react",
    "styling": "tailwind",
    "typescript": true
  }'::jsonb,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'deploying')),
  github_repo TEXT,
  github_branch TEXT DEFAULT 'main',
  deploy_url TEXT,
  deploy_provider TEXT,
  supabase_schema TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can CRUD own projects" ON projects FOR ALL USING (auth.uid() = user_id);

-- ============================================
-- 3. PROJECT FILES (virtual file system)
-- ============================================
CREATE TABLE IF NOT EXISTS project_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  path TEXT NOT NULL,
  content TEXT DEFAULT '',
  language TEXT DEFAULT 'text',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, path)
);

ALTER TABLE project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own project files" ON project_files FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_files.project_id AND projects.user_id = auth.uid()));

-- ============================================
-- 4. CHAT MESSAGES
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  mode TEXT DEFAULT 'build' CHECK (mode IN ('build', 'chat')),
  credit_cost NUMERIC DEFAULT 0,
  files_changed JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own chat messages" ON chat_messages FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = chat_messages.project_id AND projects.user_id = auth.uid()));

-- ============================================
-- 5. PROJECT DATABASE OBJECTS (AI-created tables)
-- ============================================
CREATE TABLE IF NOT EXISTS project_db_objects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  object_type TEXT NOT NULL CHECK (object_type IN ('table', 'view', 'function', 'policy', 'index', 'type')),
  object_name TEXT NOT NULL,
  schema_name TEXT NOT NULL,
  sql_definition TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, object_type, object_name)
);

ALTER TABLE project_db_objects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own db objects" ON project_db_objects FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_db_objects.project_id AND projects.user_id = auth.uid()));

-- ============================================
-- 6. DEPLOYMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  provider TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'building', 'deploying', 'live', 'failed')),
  url TEXT,
  commit_sha TEXT,
  logs TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

ALTER TABLE deployments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access own deployments" ON deployments FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = deployments.project_id AND projects.user_id = auth.uid()));

-- ============================================
-- 7. HELPER FUNCTIONS
-- ============================================

-- Function to create a schema for a project's database objects
CREATE OR REPLACE FUNCTION create_project_schema(project_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  schema_name TEXT;
BEGIN
  schema_name := 'proj_' || replace(project_uuid::text, '-', '_');
  EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', schema_name);
  -- Update the project with its schema name
  UPDATE projects SET supabase_schema = schema_name WHERE id = project_uuid;
  RETURN schema_name;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to execute SQL within a project's schema (called by server with service role)
CREATE OR REPLACE FUNCTION execute_project_sql(project_uuid UUID, sql_text TEXT)
RETURNS JSONB AS $$
DECLARE
  schema_name TEXT;
  result JSONB;
BEGIN
  -- Get or create the project schema
  SELECT p.supabase_schema INTO schema_name FROM projects p WHERE p.id = project_uuid;
  IF schema_name IS NULL THEN
    schema_name := create_project_schema(project_uuid);
  END IF;

  -- Set search path to project schema
  EXECUTE format('SET search_path TO %I, public', schema_name);

  -- Execute the SQL
  EXECUTE sql_text;

  -- Reset search path
  SET search_path TO public;

  RETURN jsonb_build_object('success', true, 'schema', schema_name);
EXCEPTION WHEN OTHERS THEN
  SET search_path TO public;
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to list tables in a project schema
CREATE OR REPLACE FUNCTION list_project_tables(schema TEXT)
RETURNS TABLE(table_name TEXT, column_count BIGINT, row_estimate BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.table_name::TEXT,
    (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = schema AND c.table_name = t.table_name),
    (SELECT reltuples::BIGINT FROM pg_class WHERE relname = t.table_name AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = schema))
  FROM information_schema.tables t
  WHERE t.table_schema = schema AND t.table_type = 'BASE TABLE';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get columns for a table in a project schema
CREATE OR REPLACE FUNCTION get_table_columns(p_schema TEXT, p_table TEXT)
RETURNS TABLE(column_name TEXT, data_type TEXT, is_nullable TEXT, column_default TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.column_name::TEXT,
    c.data_type::TEXT,
    c.is_nullable::TEXT,
    c.column_default::TEXT
  FROM information_schema.columns c
  WHERE c.table_schema = p_schema AND c.table_name = p_table
  ORDER BY c.ordinal_position;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 8. INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_project_files_project_id ON project_files(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_project_id ON chat_messages(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_project_db_objects_project_id ON project_db_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_deployments_project_id ON deployments(project_id);

-- ============================================
-- 9. UPDATED_AT TRIGGER
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER update_project_files_updated_at BEFORE UPDATE ON project_files FOR EACH ROW EXECUTE FUNCTION update_updated_at();
