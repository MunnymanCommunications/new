import { getSessionToken } from '@/integrations/supabase/client';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ContextMeta {
  filesIncluded?: number;
  filesDropped?: string[];
  messagesDropped?: number;
  contextWasTruncated?: boolean;
  legacyContextPath?: boolean;
  tokenBudget?: {
    systemPromptTokens: number;
    projectContextTokens: number;
    conversationTokens: number;
    totalInputTokens: number;
    inputBudget: number;
    maxOutputTokens: number;
    overBudget: boolean;
    overageTokens: number;
    utilizationPercent: number;
  };
}

export interface StreamCallbacks {
  onText: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
  onContextMeta?: (meta: ContextMeta) => void;
}

export async function streamAIChat(
  messages: AIMessage[],
  projectContext: string,
  mode: 'build' | 'chat',
  callbacks: StreamCallbacks,
  modelId?: string,
  projectFiles?: Array<{ path: string; content: string }>
): Promise<void> {
  const token = await getSessionToken();

  try {
    const response = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        messages,
        projectContext,
        mode,
        modelId,
        projectFiles,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      callbacks.onError(`API error: ${response.status} - ${errText}`);
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      callbacks.onError('No response stream');
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            if (data.type === 'text') {
              callbacks.onText(data.text);
            } else if (data.type === 'done') {
              callbacks.onDone();
              return;
            } else if (data.type === 'error') {
              callbacks.onError(data.error);
              return;
            } else if (data.type === 'context_meta') {
              callbacks.onContextMeta?.(data as ContextMeta);
            }
          } catch {
            // skip malformed lines
          }
        }
      }
    }

    callbacks.onDone();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Network error';
    callbacks.onError(message);
  }
}

export function buildProjectContext(
  files: Array<{ path: string; content: string }>
): string {
  return files
    .filter((f) => f.path.endsWith('.tsx') || f.path.endsWith('.ts') || f.path.endsWith('.css'))
    .map((f) => `--- ${f.path} ---\n${f.content}`)
    .join('\n\n');
}

export function extractSQLBlocks(content: string): string[] {
  const blocks: string[] = [];
  const regex = /```sql\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push(match[1].trim());
  }
  return blocks;
}

export function extractFileBlocks(
  content: string
): Array<{ path: string; content: string; language: string }> {
  const blocks: Array<{ path: string; content: string; language: string }> = [];
  const regex = /```(tsx?|jsx?|css|html|json)\s+([\w/.:-]+)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    blocks.push({
      language: match[1],
      path: match[2].trim(),
      content: match[3].trim(),
    });
  }
  return blocks;
}
