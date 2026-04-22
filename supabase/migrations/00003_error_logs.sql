-- Error logging table for persistent diagnostics
CREATE TABLE IF NOT EXISTS error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  level text NOT NULL CHECK (level IN ('debug', 'info', 'warn', 'error', 'fatal')),
  category text NOT NULL,
  message text NOT NULL,
  details jsonb DEFAULT '{}',
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  model_id text,
  duration_ms integer,
  error_name text,
  error_message text,
  error_stack text
);

-- Index for querying recent errors
CREATE INDEX IF NOT EXISTS idx_error_logs_created ON error_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_error_logs_level ON error_logs (level) WHERE level IN ('error', 'fatal');
CREATE INDEX IF NOT EXISTS idx_error_logs_category ON error_logs (category);
CREATE INDEX IF NOT EXISTS idx_error_logs_project ON error_logs (project_id) WHERE project_id IS NOT NULL;

-- Auto-cleanup: delete logs older than 30 days (run via pg_cron or manual)
-- SELECT cron.schedule('cleanup-error-logs', '0 3 * * *', $$DELETE FROM error_logs WHERE created_at < now() - interval '30 days'$$);

-- RLS: only service role can read/write error_logs (no user access)
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- Tool execution audit trail
CREATE TABLE IF NOT EXISTS tool_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  tool_name text NOT NULL,
  status text NOT NULL CHECK (status IN ('success', 'error', 'retrying')),
  params jsonb DEFAULT '{}',
  result jsonb,
  error_message text,
  attempts integer DEFAULT 1,
  duration_ms integer,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  model_id text
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_project ON tool_executions (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON tool_executions (status) WHERE status = 'error';

ALTER TABLE tool_executions ENABLE ROW LEVEL SECURITY;
