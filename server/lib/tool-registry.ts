// Tool/action registry: defines what AI-triggered actions exist, validates them,
// tracks execution history, and provides retry + error recovery.

import { logger } from './error-logger.js';

export type ToolName = 'sql_execute' | 'file_create' | 'file_modify' | 'file_delete' | 'deploy_publish';

export type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'retrying';

export interface ToolDefinition {
  name: ToolName;
  description: string;
  maxRetries: number;
  timeoutMs: number;
  validate: (params: Record<string, unknown>) => { valid: boolean; error?: string };
}

export interface ToolExecution {
  id: string;
  tool: ToolName;
  status: ToolStatus;
  params: Record<string, unknown>;
  result?: unknown;
  error?: string;
  attempts: number;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  projectId?: string;
  userId?: string;
}

const TOOL_DEFINITIONS: Record<ToolName, ToolDefinition> = {
  sql_execute: {
    name: 'sql_execute',
    description: 'Execute SQL in a project database schema',
    maxRetries: 1,
    timeoutMs: 30000,
    validate: (params) => {
      const sql = params.sql as string;
      if (!sql || typeof sql !== 'string') return { valid: false, error: 'SQL string is required' };
      if (sql.trim().length === 0) return { valid: false, error: 'SQL cannot be empty' };
      if (sql.length > 50000) return { valid: false, error: 'SQL exceeds maximum length (50KB)' };

      const upper = sql.toUpperCase();
      const dangerous = ['DROP DATABASE', 'DROP SCHEMA public', 'TRUNCATE profiles',
        'DELETE FROM profiles', 'DROP TABLE profiles', 'DROP TABLE projects',
        'DROP TABLE project_files', 'DROP TABLE chat_messages',
        'ALTER TABLE profiles', 'ALTER TABLE projects'];
      for (const d of dangerous) {
        if (upper.includes(d)) return { valid: false, error: `Blocked dangerous operation: ${d}` };
      }
      return { valid: true };
    },
  },
  file_create: {
    name: 'file_create',
    description: 'Create a new file in the project',
    maxRetries: 0,
    timeoutMs: 5000,
    validate: (params) => {
      const path = params.path as string;
      if (!path || typeof path !== 'string') return { valid: false, error: 'File path is required' };
      if (path.includes('..')) return { valid: false, error: 'Path traversal not allowed' };
      if (!path.startsWith('src/') && path !== 'package.json' && path !== 'tsconfig.json') {
        return { valid: false, error: 'Files must be under src/ directory' };
      }
      const content = params.content as string;
      if (typeof content !== 'string') return { valid: false, error: 'File content is required' };
      if (content.length > 500000) return { valid: false, error: 'File content exceeds 500KB limit' };
      return { valid: true };
    },
  },
  file_modify: {
    name: 'file_modify',
    description: 'Modify an existing file in the project',
    maxRetries: 0,
    timeoutMs: 5000,
    validate: (params) => {
      const path = params.path as string;
      if (!path || typeof path !== 'string') return { valid: false, error: 'File path is required' };
      if (path.includes('..')) return { valid: false, error: 'Path traversal not allowed' };
      return { valid: true };
    },
  },
  file_delete: {
    name: 'file_delete',
    description: 'Delete a file from the project',
    maxRetries: 0,
    timeoutMs: 5000,
    validate: (params) => {
      const path = params.path as string;
      if (!path || typeof path !== 'string') return { valid: false, error: 'File path is required' };
      if (path.includes('..')) return { valid: false, error: 'Path traversal not allowed' };
      const protectedFiles = ['src/App.tsx', 'src/main.tsx', 'src/index.css', 'package.json'];
      if (protectedFiles.includes(path)) return { valid: false, error: `Cannot delete protected file: ${path}` };
      return { valid: true };
    },
  },
  deploy_publish: {
    name: 'deploy_publish',
    description: 'Publish a project to a subdomain',
    maxRetries: 2,
    timeoutMs: 60000,
    validate: (params) => {
      const projectId = params.projectId as string;
      if (!projectId) return { valid: false, error: 'Project ID is required' };
      const subdomain = params.subdomain as string;
      if (!subdomain || subdomain.length < 3) return { valid: false, error: 'Subdomain must be at least 3 characters' };
      return { valid: true };
    },
  },
};

let executionCounter = 0;

export class ToolExecutionTracker {
  private executions: Map<string, ToolExecution> = new Map();
  private history: ToolExecution[] = [];
  private maxHistory = 200;

  getDefinition(name: ToolName): ToolDefinition | undefined {
    return TOOL_DEFINITIONS[name];
  }

  getAllDefinitions(): ToolDefinition[] {
    return Object.values(TOOL_DEFINITIONS);
  }

  validate(toolName: ToolName, params: Record<string, unknown>): { valid: boolean; error?: string } {
    const def = TOOL_DEFINITIONS[toolName];
    if (!def) return { valid: false, error: `Unknown tool: ${toolName}` };
    return def.validate(params);
  }

  start(toolName: ToolName, params: Record<string, unknown>, context?: { projectId?: string; userId?: string }): ToolExecution {
    const id = `exec_${Date.now()}_${++executionCounter}`;
    const execution: ToolExecution = {
      id,
      tool: toolName,
      status: 'running',
      params,
      attempts: 1,
      startedAt: new Date().toISOString(),
      projectId: context?.projectId,
      userId: context?.userId,
    };

    this.executions.set(id, execution);

    logger.info('tool_execution', `Tool ${toolName} started`, {
      details: { executionId: id, params: sanitizeParams(params) },
      projectId: context?.projectId,
      userId: context?.userId,
    });

    return execution;
  }

  complete(id: string, result?: unknown): ToolExecution | null {
    const execution = this.executions.get(id);
    if (!execution) return null;

    const now = new Date();
    execution.status = 'success';
    execution.result = result;
    execution.completedAt = now.toISOString();
    execution.durationMs = now.getTime() - new Date(execution.startedAt).getTime();

    this.archive(execution);

    logger.info('tool_execution', `Tool ${execution.tool} completed`, {
      details: { executionId: id },
      durationMs: execution.durationMs,
      projectId: execution.projectId,
      userId: execution.userId,
    });

    return execution;
  }

  fail(id: string, error: string): ToolExecution | null {
    const execution = this.executions.get(id);
    if (!execution) return null;

    const def = TOOL_DEFINITIONS[execution.tool];
    const now = new Date();
    execution.error = error;
    execution.completedAt = now.toISOString();
    execution.durationMs = now.getTime() - new Date(execution.startedAt).getTime();

    if (execution.attempts <= (def?.maxRetries || 0)) {
      execution.status = 'retrying';
      execution.attempts++;

      logger.warn('tool_execution', `Tool ${execution.tool} failed, retrying (attempt ${execution.attempts})`, {
        details: { executionId: id, error, attempt: execution.attempts },
        projectId: execution.projectId,
        userId: execution.userId,
      });

      return execution;
    }

    execution.status = 'error';
    this.archive(execution);

    logger.error('tool_execution', `Tool ${execution.tool} failed permanently`, {
      details: { executionId: id, error, attempts: execution.attempts },
      projectId: execution.projectId,
      userId: execution.userId,
    });

    return execution;
  }

  getExecution(id: string): ToolExecution | undefined {
    return this.executions.get(id) || this.history.find(e => e.id === id);
  }

  getActiveExecutions(): ToolExecution[] {
    return [...this.executions.values()].filter(e => e.status === 'running' || e.status === 'retrying');
  }

  getProjectHistory(projectId: string, limit = 20): ToolExecution[] {
    return this.history
      .filter(e => e.projectId === projectId)
      .slice(-limit);
  }

  getSummary(): {
    active: number;
    totalExecuted: number;
    successRate: number;
    byTool: Record<string, { total: number; errors: number }>;
  } {
    const byTool: Record<string, { total: number; errors: number }> = {};
    let totalSuccess = 0;

    for (const exec of this.history) {
      if (!byTool[exec.tool]) byTool[exec.tool] = { total: 0, errors: 0 };
      byTool[exec.tool].total++;
      if (exec.status === 'error') byTool[exec.tool].errors++;
      if (exec.status === 'success') totalSuccess++;
    }

    return {
      active: this.getActiveExecutions().length,
      totalExecuted: this.history.length,
      successRate: this.history.length > 0 ? Math.round((totalSuccess / this.history.length) * 100) : 100,
      byTool,
    };
  }

  private archive(execution: ToolExecution) {
    this.executions.delete(execution.id);
    this.history.push(execution);
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }
}

function sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string' && value.length > 200) {
      sanitized[key] = value.slice(0, 200) + `...[${value.length} chars]`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const toolTracker = new ToolExecutionTracker();
