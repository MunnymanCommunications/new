import { getSessionToken } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface ProjectTable {
  table_name: string;
  column_count: number;
  row_estimate: number;
}

export interface TableColumn {
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
}

export interface DBObject {
  id: string;
  project_id: string;
  object_type: string;
  object_name: string;
  schema_name: string;
  sql_definition: string;
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function executeProjectSQL(
  projectId: string,
  sql: string
): Promise<{ success: boolean; error?: string; data?: unknown }> {
  const response = await fetch(`${API_URL}/api/db/execute-sql`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ projectId, sql }),
  });

  const result = await response.json();
  if (!response.ok) {
    return { success: false, error: result.error || 'Failed to execute SQL' };
  }
  return { success: true, data: result.data };
}

export async function listProjectTables(
  projectId: string
): Promise<{ tables: ProjectTable[]; schema?: string }> {
  const response = await fetch(`${API_URL}/api/db/tables/${projectId}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) return { tables: [] };
  return response.json();
}

export async function getTableColumns(
  projectId: string,
  tableName: string
): Promise<TableColumn[]> {
  const response = await fetch(
    `${API_URL}/api/db/columns/${projectId}/${tableName}`,
    { headers: await authHeaders() }
  );
  if (!response.ok) return [];
  const data = await response.json();
  return data.columns || [];
}

export async function listDBObjects(projectId: string): Promise<DBObject[]> {
  const response = await fetch(`${API_URL}/api/db/objects/${projectId}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.objects || [];
}
