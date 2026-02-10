import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../middleware/auth.js';

const router = Router();

// Service role client for privileged DB operations
function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(url, key);
}

// POST /api/db/execute-sql - Execute SQL in a project's schema
router.post('/execute-sql', verifyAuth, async (req: Request, res: Response) => {
  const { projectId, sql } = req.body;
  const userId = (req as any).userId;

  if (!projectId || !sql) {
    res.status(400).json({ error: 'projectId and sql are required' });
    return;
  }

  // Basic SQL safety: block dangerous operations
  const upperSql = sql.toUpperCase().trim();
  const forbidden = ['DROP DATABASE', 'DROP SCHEMA public', 'TRUNCATE profiles', 'DELETE FROM profiles',
    'DROP TABLE profiles', 'DROP TABLE projects', 'DROP TABLE project_files',
    'DROP TABLE chat_messages', 'ALTER TABLE profiles', 'ALTER TABLE projects'];
  for (const f of forbidden) {
    if (upperSql.includes(f)) {
      res.status(403).json({ error: `Operation not allowed: ${f}` });
      return;
    }
  }

  try {
    const supabase = getServiceClient();

    // Verify the user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, supabase_schema')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    // Execute the SQL in the project's schema
    const { data, error } = await supabase.rpc('execute_project_sql', {
      project_uuid: projectId,
      sql_text: sql,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    // Record the SQL in project_db_objects
    const objectType = detectObjectType(sql);
    const objectName = extractObjectName(sql);
    if (objectType && objectName) {
      await supabase.from('project_db_objects').upsert({
        project_id: projectId,
        object_type: objectType,
        object_name: objectName,
        schema_name: data?.schema || project.supabase_schema || '',
        sql_definition: sql,
      }, { onConflict: 'project_id,object_type,object_name' });
    }

    res.json({ success: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/db/tables/:projectId - List tables in a project's schema
router.get('/tables/:projectId', verifyAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = (req as any).userId;

  try {
    const supabase = getServiceClient();

    const { data: project } = await supabase
      .from('projects')
      .select('supabase_schema')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (!project?.supabase_schema) {
      res.json({ tables: [] });
      return;
    }

    const { data: tables, error } = await supabase.rpc('list_project_tables', {
      schema: project.supabase_schema,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ tables: tables || [], schema: project.supabase_schema });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/db/columns/:projectId/:tableName
router.get('/columns/:projectId/:tableName', verifyAuth, async (req: Request, res: Response) => {
  const { projectId, tableName } = req.params;
  const userId = (req as any).userId;

  try {
    const supabase = getServiceClient();

    const { data: project } = await supabase
      .from('projects')
      .select('supabase_schema')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (!project?.supabase_schema) {
      res.status(404).json({ error: 'No schema found' });
      return;
    }

    const { data: columns, error } = await supabase.rpc('get_table_columns', {
      p_schema: project.supabase_schema,
      p_table: tableName,
    });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ columns: columns || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/db/objects/:projectId - List all DB objects for a project
router.get('/objects/:projectId', verifyAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = (req as any).userId;

  try {
    const supabase = getServiceClient();

    // Verify ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (!project) {
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const { data: objects, error } = await supabase
      .from('project_db_objects')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ objects: objects || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

function detectObjectType(sql: string): string | null {
  const upper = sql.toUpperCase().trim();
  if (upper.startsWith('CREATE TABLE') || upper.startsWith('CREATE OR REPLACE TABLE')) return 'table';
  if (upper.startsWith('CREATE VIEW') || upper.startsWith('CREATE OR REPLACE VIEW')) return 'view';
  if (upper.startsWith('CREATE FUNCTION') || upper.startsWith('CREATE OR REPLACE FUNCTION')) return 'function';
  if (upper.startsWith('CREATE POLICY') || upper.includes('ENABLE ROW LEVEL SECURITY')) return 'policy';
  if (upper.startsWith('CREATE INDEX') || upper.startsWith('CREATE UNIQUE INDEX')) return 'index';
  if (upper.startsWith('CREATE TYPE')) return 'type';
  return null;
}

function extractObjectName(sql: string): string | null {
  const match = sql.match(/(?:CREATE\s+(?:OR\s+REPLACE\s+)?(?:TABLE|VIEW|FUNCTION|INDEX|TYPE|POLICY)\s+(?:IF\s+NOT\s+EXISTS\s+)?)(\w+)/i);
  return match?.[1] || null;
}

export { router as databaseRouter };
