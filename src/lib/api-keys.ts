import { getSessionToken } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface SavedKey {
  provider: string;
  key_hint: string;
  is_valid: boolean;
  updated_at: string;
}

export interface AIModel {
  id: string;
  name: string;
  provider: string;
  tier: 'free' | 'pro' | 'business';
  maxTokens: number;
  platformKeyAvailable: boolean;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getSessionToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function listApiKeys(): Promise<SavedKey[]> {
  const response = await fetch(`${API_URL}/api/keys/list`, {
    headers: await authHeaders(),
  });
  if (!response.ok) return [];
  const data = await response.json();
  return data.keys || [];
}

export async function saveApiKey(provider: string, apiKey: string): Promise<{ success: boolean; error?: string; hint?: string }> {
  const response = await fetch(`${API_URL}/api/keys/save`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ provider, apiKey }),
  });
  const data = await response.json();
  if (!response.ok) return { success: false, error: data.error };
  return { success: true, hint: data.hint };
}

export async function deleteApiKey(provider: string): Promise<boolean> {
  const response = await fetch(`${API_URL}/api/keys/${provider}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  return response.ok;
}

export async function listModels(): Promise<AIModel[]> {
  const response = await fetch(`${API_URL}/api/ai/models`);
  if (!response.ok) return [];
  const data = await response.json();
  return data.models || [];
}
