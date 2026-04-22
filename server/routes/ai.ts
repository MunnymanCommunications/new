import { Router, type Request, type Response } from 'express';
import { verifyAuth } from '../middleware/auth.js';

const router = Router();

interface ProviderConfig {
  name: string;
  apiBase: string;
  models: ModelDef[];
  buildRequest: (model: string, systemPrompt: string, messages: ChatMsg[], apiKey: string) => { url: string; headers: Record<string, string>; body: string };
  parseStream: (line: string) => { type: 'text' | 'done' | 'error' | 'skip'; text?: string; error?: string };
}

interface ModelDef {
  id: string;
  name: string;
  provider: string;
  tier: 'free' | 'pro' | 'business';
  maxTokens: number;
}

interface ChatMsg {
  role: string;
  content: string;
}

const AVAILABLE_MODELS: ModelDef[] = [
  // Anthropic
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', tier: 'free', maxTokens: 8192 },
  { id: 'claude-opus-4-5-20250929', name: 'Claude Opus 4.5', provider: 'anthropic', tier: 'pro', maxTokens: 8192 },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', provider: 'anthropic', tier: 'free', maxTokens: 8192 },
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', tier: 'free', maxTokens: 4096 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', tier: 'free', maxTokens: 4096 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', tier: 'pro', maxTokens: 4096 },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', tier: 'pro', maxTokens: 16384 },
  // Google Gemini
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', tier: 'free', maxTokens: 8192 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', tier: 'pro', maxTokens: 8192 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', tier: 'free', maxTokens: 8192 },
];

const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    name: 'Anthropic',
    apiBase: 'https://api.anthropic.com/v1',
    models: AVAILABLE_MODELS.filter((m) => m.provider === 'anthropic'),
    buildRequest: (model, systemPrompt, messages, apiKey) => ({
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 8192,
        system: systemPrompt,
        stream: true,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      }),
    }),
    parseStream: (line) => {
      if (!line.startsWith('data: ')) return { type: 'skip' };
      const data = line.slice(6).trim();
      if (data === '[DONE]') return { type: 'done' };
      try {
        const parsed = JSON.parse(data);
        if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
          return { type: 'text', text: parsed.delta.text };
        } else if (parsed.type === 'message_stop') {
          return { type: 'done' };
        } else if (parsed.type === 'error') {
          return { type: 'error', error: parsed.error?.message || 'Unknown error' };
        }
      } catch { /* skip */ }
      return { type: 'skip' };
    },
  },
  openai: {
    name: 'OpenAI',
    apiBase: 'https://api.openai.com/v1',
    models: AVAILABLE_MODELS.filter((m) => m.provider === 'openai'),
    buildRequest: (model, systemPrompt, messages, apiKey) => ({
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        stream: true,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    }),
    parseStream: (line) => {
      if (!line.startsWith('data: ')) return { type: 'skip' };
      const data = line.slice(6).trim();
      if (data === '[DONE]') return { type: 'done' };
      try {
        const parsed = JSON.parse(data);
        const delta = parsed.choices?.[0]?.delta?.content;
        if (delta) return { type: 'text', text: delta };
        if (parsed.choices?.[0]?.finish_reason) return { type: 'done' };
      } catch { /* skip */ }
      return { type: 'skip' };
    },
  },
  google: {
    name: 'Google',
    apiBase: 'https://generativelanguage.googleapis.com/v1beta',
    models: AVAILABLE_MODELS.filter((m) => m.provider === 'google'),
    buildRequest: (model, systemPrompt, messages, apiKey) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: 8192 },
      }),
    }),
    parseStream: (line) => {
      if (!line.startsWith('data: ')) return { type: 'skip' };
      const data = line.slice(6).trim();
      try {
        const parsed = JSON.parse(data);
        const text = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) return { type: 'text', text };
        if (parsed.candidates?.[0]?.finishReason) return { type: 'done' };
      } catch { /* skip */ }
      return { type: 'skip' };
    },
  },
};

const SYSTEM_PROMPT = `You are an expert full-stack developer working inside VibeCraft, an AI app builder platform. You build React + TypeScript + Tailwind CSS applications with Supabase backends.

CRITICAL RULES:
1. Always use TypeScript with proper interfaces
2. Components go in src/components/, pages in src/pages/
3. Use Tailwind CSS for all styling (no inline styles or CSS modules)
4. Create responsive, mobile-first layouts
5. Add proper ARIA attributes for accessibility
6. Use React best practices (hooks, composition, error boundaries)

WHEN THE USER NEEDS A DATABASE:
- Generate SQL wrapped in \`\`\`sql blocks
- Include CREATE TABLE statements with proper types
- Always add RLS policies for security
- Generate TypeScript interfaces matching the schema
- Show how to query data using Supabase client
- The SQL will be executed automatically in the project's dedicated schema

RESPONSE FORMAT:
- Use \`\`\`tsx or \`\`\`typescript blocks with the filename on the first line for file changes, like:
  \`\`\`tsx src/components/MyComponent.tsx
  // code here
  \`\`\`
- Use \`\`\`sql blocks for database migrations
- Keep explanations concise
- List all files changed at the end`;

function resolveProvider(modelId: string): { provider: ProviderConfig; model: ModelDef } | null {
  for (const [, provider] of Object.entries(PROVIDERS)) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return { provider, model };
  }
  return null;
}

function getApiKey(provider: string, userKeys: Record<string, string>): string | null {
  if (userKeys[provider]) return userKeys[provider];
  // Fall back to platform-level keys
  switch (provider) {
    case 'anthropic': return process.env.ANTHROPIC_API_KEY || null;
    case 'openai': return process.env.OPENAI_API_KEY || null;
    case 'google': return process.env.GOOGLE_AI_API_KEY || null;
    default: return null;
  }
}

// GET /api/ai/models - List available models
router.get('/models', (_req: Request, res: Response) => {
  const available = AVAILABLE_MODELS.map((m) => ({
    ...m,
    platformKeyAvailable: !!getApiKey(m.provider, {}),
  }));
  res.json({ models: available });
});

// POST /api/ai/chat - Stream AI response
router.post('/chat', verifyAuth, async (req: Request, res: Response) => {
  const { messages, projectContext, mode, modelId, userApiKeys } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  const selectedModel = modelId || 'claude-sonnet-4-5-20250929';
  const resolved = resolveProvider(selectedModel);
  if (!resolved) {
    res.status(400).json({ error: `Unknown model: ${selectedModel}` });
    return;
  }

  const { provider, model } = resolved;
  const apiKey = getApiKey(model.provider, userApiKeys || {});

  if (!apiKey) {
    res.status(400).json({
      error: `No API key configured for ${provider.name}. Add your ${provider.name} API key in Settings, or ask the admin to set the platform key.`,
    });
    return;
  }

  const systemPrompt = mode === 'chat'
    ? 'You are a helpful assistant for discussing web development. Answer questions concisely.'
    : SYSTEM_PROMPT + (projectContext ? `\n\nCURRENT PROJECT FILES:\n${projectContext}` : '');

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const { url, headers, body } = provider.buildRequest(selectedModel, systemPrompt, messages, apiKey);

    const response = await fetch(url, { method: 'POST', headers, body });

    if (!response.ok) {
      const errorText = await response.text();
      res.write(`data: ${JSON.stringify({ type: 'error', error: `${provider.name} API error (${response.status}): ${errorText.slice(0, 500)}` })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No response body' })}\n\n`);
      res.end();
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
        const parsed = provider.parseStream(line);
        if (parsed.type === 'text' && parsed.text) {
          res.write(`data: ${JSON.stringify({ type: 'text', text: parsed.text })}\n\n`);
        } else if (parsed.type === 'done') {
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
          return;
        } else if (parsed.type === 'error') {
          res.write(`data: ${JSON.stringify({ type: 'error', error: parsed.error })}\n\n`);
          res.end();
          return;
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
      res.end();
    } catch { /* already closed */ }
  }
});

export { router as aiRouter };
