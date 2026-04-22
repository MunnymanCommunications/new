// Structured error logging with severity levels, categories, and persistent storage.
// Logs are kept in-memory (ring buffer) and optionally persisted to Supabase.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogCategory =
  | 'ai_request'
  | 'ai_stream'
  | 'ai_context'
  | 'tool_execution'
  | 'sql_execution'
  | 'file_operation'
  | 'deploy'
  | 'auth'
  | 'api_key'
  | 'rate_limit'
  | 'system';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  message: string;
  details?: Record<string, unknown>;
  userId?: string;
  projectId?: string;
  modelId?: string;
  durationMs?: number;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

const MAX_BUFFER_SIZE = 500;
const logBuffer: LogEntry[] = [];
let dbClient: SupabaseClient | null = null;
let persistEnabled = false;

let entryCounter = 0;
function generateLogId(): string {
  return `log_${Date.now()}_${++entryCounter}`;
}

export function initLogger(options?: { persist?: boolean }) {
  if (options?.persist) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (url && key) {
      dbClient = createClient(url, key);
      persistEnabled = true;
    }
  }
}

export function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  context?: {
    details?: Record<string, unknown>;
    userId?: string;
    projectId?: string;
    modelId?: string;
    durationMs?: number;
    error?: Error | unknown;
  }
): LogEntry {
  const entry: LogEntry = {
    id: generateLogId(),
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    details: context?.details,
    userId: context?.userId,
    projectId: context?.projectId,
    modelId: context?.modelId,
    durationMs: context?.durationMs,
  };

  if (context?.error) {
    const err = context.error instanceof Error ? context.error : new Error(String(context.error));
    entry.error = {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    };
  }

  // Ring buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift();
  }

  // Console output
  const prefix = `[${entry.timestamp}] [${level.toUpperCase()}] [${category}]`;
  if (level === 'error' || level === 'fatal') {
    console.error(prefix, message, entry.error?.message || '', entry.details || '');
  } else if (level === 'warn') {
    console.warn(prefix, message, entry.details || '');
  } else if (level === 'debug') {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(prefix, message);
    }
  } else {
    console.log(prefix, message);
  }

  // Async persistence (fire and forget, don't block the request)
  if (persistEnabled && dbClient && (level === 'warn' || level === 'error' || level === 'fatal')) {
    dbClient
      .from('error_logs')
      .insert({
        level,
        category,
        message,
        details: entry.details || {},
        user_id: entry.userId,
        project_id: entry.projectId,
        model_id: entry.modelId,
        duration_ms: entry.durationMs,
        error_name: entry.error?.name,
        error_message: entry.error?.message,
        error_stack: entry.error?.stack,
      })
      .then(() => {})
      .catch(() => {});
  }

  return entry;
}

// Convenience wrappers
export const logger = {
  debug: (cat: LogCategory, msg: string, ctx?: Parameters<typeof log>[3]) => log('debug', cat, msg, ctx),
  info:  (cat: LogCategory, msg: string, ctx?: Parameters<typeof log>[3]) => log('info', cat, msg, ctx),
  warn:  (cat: LogCategory, msg: string, ctx?: Parameters<typeof log>[3]) => log('warn', cat, msg, ctx),
  error: (cat: LogCategory, msg: string, ctx?: Parameters<typeof log>[3]) => log('error', cat, msg, ctx),
  fatal: (cat: LogCategory, msg: string, ctx?: Parameters<typeof log>[3]) => log('fatal', cat, msg, ctx),
};

export function getRecentLogs(filter?: { level?: LogLevel; category?: LogCategory; limit?: number }): LogEntry[] {
  let results = [...logBuffer];
  if (filter?.level) results = results.filter(e => e.level === filter.level);
  if (filter?.category) results = results.filter(e => e.category === filter.category);
  results.reverse();
  return results.slice(0, filter?.limit || 50);
}

export function getErrorSummary(): {
  total: number;
  byCategory: Record<string, number>;
  byLevel: Record<string, number>;
  recentErrors: LogEntry[];
} {
  const errors = logBuffer.filter(e => e.level === 'error' || e.level === 'fatal');
  const byCategory: Record<string, number> = {};
  const byLevel: Record<string, number> = {};

  for (const entry of errors) {
    byCategory[entry.category] = (byCategory[entry.category] || 0) + 1;
    byLevel[entry.level] = (byLevel[entry.level] || 0) + 1;
  }

  return {
    total: errors.length,
    byCategory,
    byLevel,
    recentErrors: errors.slice(-10).reverse(),
  };
}
