import { Router, type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { verifyAuth } from '../middleware/auth.js';
import { logger } from '../lib/error-logger.js';
import { toolTracker } from '../lib/tool-registry.js';

const router = Router();

function getServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  return createClient(url, key);
}

// POST /api/db/execute-sql
router.post('/execute-sql', verifyAuth, async (req: Request, res: Response) => {
  const { projectId, sql } = req.body;
  const userId = (req as any).userId;

  if (!projectId || !sql) {
    res.status(400).json({ error: 'projectId and sql are required' });
    return;
  }

  // Validate through tool registry
  const validation = toolTracker.validate('sql_execute', { sql });
  if (!validation.valid) {
    logger.warn('sql_execution', `SQL validation failed: ${validation.error}`, {
      userId,
      projectId,
      details: { sqlPreview: sql.slice(0, 200) },
    });
    res.status(403).json({ error: validation.error });
    return;
  }

  const execution = toolTracker.start('sql_execute', { sql: sql.slice(0, 500) }, { projectId, userId });

  try {
    const supabase = getServiceClient();

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, supabase_schema')
      .eq('id', projectId)
      .eq('user_id', userId)
      .single();

    if (projectError || !project) {
      toolTracker.fail(execution.id, 'Project not found');
      res.status(404).json({ error: 'Project not found' });
      return;
    }

    const { data, error } = await supabase.rpc('execute_project_sql', {
      project_uuid: projectId,
      sql_text: sql,
    });

    if (error) {
      toolTracker.fail(execution.id, error.message);
      logger.error('sql_execution', `SQL execution failed: ${error.message}`, {
        userId,
        projectId,
        details: {
          sqlPreview: sql.slice(0, 300),
          errorCode: (error as any).code,
          errorHint: (error as any).hint,
        },
      });
      res.status(500).json({
        error: error.message,
        hint: (error as any).hint || undefined,
        executionId: execution.id,
      });
      return;
    }

    toolTracker.complete(execution.id, { rowCount: data?.length || 0 });

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

    logger.info('sql_execution', `SQL executed: ${objectType || 'query'} ${objectName || ''}`, {
      userId,
      projectId,
      durationMs: execution.durationMs,
    });

    res.json({ success: true, data, executionId: execution.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const exec = toolTracker.fail(execution.id, message);

    // Retry logic
    if (exec && exec.status === 'retrying') {
      logger.info('sql_execution', 'Retrying SQL execution', { projectId, userId });
      // For SQL, a retry is usually not helpful (same query, same error)
      // Mark as final failure
      toolTracker.fail(execution.id, message);
    }

    logger.error('sql_execution', `SQL execution crashed: ${message}`, {
      userId,
      projectId,
      error,
    });

    res.status(500).json({ error: message, executionId: execution.id });
  }
});

// GET /api/db/tables/:projectId
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
      logger.error('sql_execution', `Failed to list tables: ${error.message}`, { projectId, userId });
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ tables: tables || [], schema: project.supabase_schema });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('sql_execution', `List tables failed: ${message}`, { projectId, userId, error });
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
      logger.error('sql_execution', `Failed to get columns for ${tableName}: ${error.message}`, { projectId, userId });
      res.status(500).json({ error: error.message });
      return;
    }

    res.json({ columns: columns || [] });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/db/objects/:projectId
router.get('/objects/:projectId', verifyAuth, async (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = (req as any).userId;

  try {
    const supabase = getServiceClient();

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
