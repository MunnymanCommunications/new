import { getSessionToken } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface DeployStatus {
  published: boolean;
  subdomain: string | null;
  lastPublished: string | null;
  domain: string;
  deployments: Array<{
    id: string;
    status: string;
    url: string;
    subdomain: string;
    created_at: string;
  }>;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function publishProject(projectId: string, subdomain: string): Promise<{ success: boolean; url?: string; error?: string }> {
  const response = await fetch(`${API_URL}/api/deploy/publish`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ projectId, subdomain }),
  });
  const data = await response.json();
  if (!response.ok) return { success: false, error: data.error };
  return { success: true, url: data.url };
}

export async function unpublishProject(projectId: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/deploy/unpublish/${projectId}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  return response.ok;
}

export async function getDeployStatus(projectId: string): Promise<DeployStatus | null> {
  const response = await fetch(`${API_URL}/api/deploy/status/${projectId}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) return null;
  return response.json();
}

export function getExportUrl(projectId: string): string {
  return `${API_URL}/api/export/${projectId}`;
}
