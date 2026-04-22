import { Router, type Request, type Response } from 'express';
import { verifyAuth } from '../middleware/auth.js';
import { buildManagedContext } from '../lib/context-manager.js';
import { computeTokenBudget, getModelLimits } from '../lib/token-counter.js';
import { logger } from '../lib/error-logger.js';
import { toolTracker } from '../lib/tool-registry.js';

const router = Router();

interface ProviderConfig {
  name: string;
  apiBase: string;
  models: ModelDef[];
  buildRequest: (model: string, systemPrompt: string, messages: ChatMsg[], apiKey: string, maxTokens: number) => { url: string; headers: Record<string, string>; body: string };
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
  { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic', tier: 'free', maxTokens: 8192 },
  { id: 'claude-opus-4-5-20250929', name: 'Claude Opus 4.5', provider: 'anthropic', tier: 'pro', maxTokens: 8192 },
  { id: 'claude-haiku-3-5-20241022', name: 'Claude Haiku 3.5', provider: 'anthropic', tier: 'free', maxTokens: 8192 },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai', tier: 'free', maxTokens: 4096 },
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai', tier: 'free', maxTokens: 4096 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', tier: 'pro', maxTokens: 4096 },
  { id: 'o3-mini', name: 'o3-mini', provider: 'openai', tier: 'pro', maxTokens: 16384 },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google', tier: 'free', maxTokens: 8192 },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google', tier: 'pro', maxTokens: 8192 },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', provider: 'google', tier: 'free', maxTokens: 8192 },
];

const PROVIDERS: Record<string, ProviderConfig> = {
  anthropic: {
    name: 'Anthropic',
    apiBase: 'https://api.anthropic.com/v1',
    models: AVAILABLE_MODELS.filter((m) => m.provider === 'anthropic'),
    buildRequest: (model, systemPrompt, messages, apiKey, maxTokens) => ({
      url: 'https://api.anthropic.com/v1/messages',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
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
    buildRequest: (model, systemPrompt, messages, apiKey, maxTokens) => ({
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
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
    buildRequest: (model, systemPrompt, messages, apiKey, maxTokens) => ({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((m) => ({
          role: m.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: m.content }],
        })),
        generationConfig: { maxOutputTokens: maxTokens },
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

const SYSTEM_PROMPT_BUILD = `You are an expert full-stack developer working inside VibeCraft, an AI app builder platform. You build React + TypeScript + Tailwind CSS applications with Supabase backends.

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

AVAILABLE TOOLS (auto-executed from your response):
- SQL blocks (\`\`\`sql): Executed in the project's isolated database schema
- File blocks (\`\`\`tsx path/to/file.tsx): Applied to the project's virtual file system
- Supported file types: .tsx, .ts, .jsx, .js, .css, .html, .json

RESPONSE FORMAT:
- Use \`\`\`tsx or \`\`\`typescript blocks with the filename on the first line for file changes, like:
  \`\`\`tsx src/components/MyComponent.tsx
  // code here
  \`\`\`
- Use \`\`\`sql blocks for database migrations
- Keep explanations concise
- List all files changed at the end`;

const SYSTEM_PROMPT_CHAT = 'You are a helpful assistant for discussing web development. Answer questions concisely.';

function resolveProvider(modelId: string): { provider: ProviderConfig; model: ModelDef } | null {
  for (const [, provider] of Object.entries(PROVIDERS)) {
    const model = provider.models.find((m) => m.id === modelId);
    if (model) return { provider, model };
  }
  return null;
}

function getApiKey(provider: string, userKeys: Record<string, string>): string | null {
  if (userKeys[provider]) return userKeys[provider];
  switch (provider) {
    case 'anthropic': return process.env.ANTHROPIC_API_KEY || null;
    case 'openai': return process.env.OPENAI_API_KEY || null;
    case 'google': return process.env.GOOGLE_AI_API_KEY || null;
    default: return null;
  }
}

// GET /api/ai/models
router.get('/models', (_req: Request, res: Response) => {
  const available = AVAILABLE_MODELS.map((m) => {
    const limits = getModelLimits(m.id);
    return {
      ...m,
      platformKeyAvailable: !!getApiKey(m.provider, {}),
      contextWindow: limits.contextWindow,
      inputBudget: limits.inputBudget,
    };
  });
  res.json({ models: available });
});

// POST /api/ai/chat - Stream AI response with context management
router.post('/chat', verifyAuth, async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { messages, projectContext, mode, modelId, userApiKeys, projectFiles } = req.body;
  const requestStartTime = Date.now();

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  const selectedModel = modelId || 'claude-sonnet-4-5-20250929';
  const resolved = resolveProvider(selectedModel);
  if (!resolved) {
    logger.warn('ai_request', `Unknown model requested: ${selectedModel}`, { userId, modelId: selectedModel });
    res.status(400).json({ error: `Unknown model: ${selectedModel}` });
    return;
  }

  const { provider, model } = resolved;
  const apiKey = getApiKey(model.provider, userApiKeys || {});

  if (!apiKey) {
    logger.warn('ai_request', `No API key for ${provider.name}`, { userId, modelId: selectedModel });
    res.status(400).json({
      error: `No API key configured for ${provider.name}. Add your ${provider.name} API key in Settings, or ask the admin to set the platform key.`,
    });
    return;
  }

  // --- Context Window Management ---
  const basePrompt = mode === 'chat' ? SYSTEM_PROMPT_CHAT : SYSTEM_PROMPT_BUILD;

  // If the client sends structured files, use those; otherwise fall back to the flat projectContext string
  const files: Array<{ path: string; content: string }> = projectFiles || [];
  let managedSystemPrompt: string;
  let managedMessages: ChatMsg[];
  let contextMeta: Record<string, unknown> = {};

  if (files.length > 0 && mode === 'build') {
    const managed = buildManagedContext(selectedModel, basePrompt, files, messages, mode);
    managedSystemPrompt = managed.systemPrompt;
    managedMessages = managed.messages;
    contextMeta = {
      filesIncluded: files.length - managed.truncated.filesDropped.length,
      filesDropped: managed.truncated.filesDropped,
      messagesDropped: managed.truncated.messagesDropped,
      contextWasTruncated: managed.truncated.contextWasTruncated,
      tokenBudget: managed.budget,
    };

    if (managed.truncated.contextWasTruncated) {
      logger.info('ai_context', `Context truncated for ${selectedModel}: dropped ${managed.truncated.filesDropped.length} files, ${managed.truncated.messagesDropped} messages`, {
        userId,
        modelId: selectedModel,
        details: contextMeta,
      });
    }
  } else {
    // Legacy path: client already bundled projectContext as a string
    managedSystemPrompt = mode === 'chat'
      ? SYSTEM_PROMPT_CHAT
      : SYSTEM_PROMPT_BUILD + (projectContext ? `\n\nCURRENT PROJECT FILES:\n${projectContext}` : '');
    managedMessages = messages;

    // Still compute the budget for logging/diagnostics
    const budget = computeTokenBudget(selectedModel, managedSystemPrompt, '', messages);
    contextMeta = { tokenBudget: budget, legacyContextPath: true };

    if (budget.overBudget) {
      logger.warn('ai_context', `Context over budget by ~${budget.overageTokens} tokens for ${selectedModel}`, {
        userId,
        modelId: selectedModel,
        details: { budget },
      });
    }
  }

  logger.info('ai_request', `Chat request: model=${selectedModel}, mode=${mode}, messages=${managedMessages.length}`, {
    userId,
    modelId: selectedModel,
    details: contextMeta,
  });

  try {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    // Send context metadata as the first event so the client knows what happened
    res.write(`data: ${JSON.stringify({ type: 'context_meta', ...contextMeta })}\n\n`);

    const limits = getModelLimits(selectedModel);
    const { url, headers, body } = provider.buildRequest(
      selectedModel, managedSystemPrompt, managedMessages, apiKey, limits.maxOutputTokens
    );

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(120_000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const shortError = errorText.slice(0, 500);

      logger.error('ai_stream', `${provider.name} API error (${response.status})`, {
        userId,
        modelId: selectedModel,
        details: {
          status: response.status,
          errorPreview: shortError,
          contextUtilization: (contextMeta as any).tokenBudget?.utilizationPercent,
        },
      });

      // Provide actionable error messages
      let userMessage = `${provider.name} API error (${response.status}): ${shortError}`;
      if (response.status === 429) {
        userMessage = `Rate limited by ${provider.name}. Please wait a moment and try again.`;
      } else if (response.status === 401 || response.status === 403) {
        userMessage = `Invalid API key for ${provider.name}. Check your key in Settings.`;
      } else if (response.status === 400 && shortError.includes('context')) {
        userMessage = `Request too large for ${model.name}'s context window. Try a shorter message or reduce project files.`;
      }

      res.write(`data: ${JSON.stringify({ type: 'error', error: userMessage })}\n\n`);
      res.end();
      return;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      logger.error('ai_stream', 'No response body from provider', { userId, modelId: selectedModel });
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'No response body' })}\n\n`);
      res.end();
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let outputTokenEstimate = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const parsed = provider.parseStream(line);
        if (parsed.type === 'text' && parsed.text) {
          outputTokenEstimate += Math.ceil(parsed.text.length / 3.5);
          res.write(`data: ${JSON.stringify({ type: 'text', text: parsed.text })}\n\n`);
        } else if (parsed.type === 'done') {
          const durationMs = Date.now() - requestStartTime;
          logger.info('ai_stream', `Stream completed: ~${outputTokenEstimate} output tokens in ${durationMs}ms`, {
            userId,
            modelId: selectedModel,
            durationMs,
            details: { outputTokenEstimate },
          });
          res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
          res.end();
          return;
        } else if (parsed.type === 'error') {
          logger.error('ai_stream', `Stream error from ${provider.name}: ${parsed.error}`, {
            userId,
            modelId: selectedModel,
            durationMs: Date.now() - requestStartTime,
          });
          res.write(`data: ${JSON.stringify({ type: 'error', error: parsed.error })}\n\n`);
          res.end();
          return;
        }
      }
    }

    const durationMs = Date.now() - requestStartTime;
    logger.info('ai_stream', `Stream finished (EOF): ~${outputTokenEstimate} output tokens in ${durationMs}ms`, {
      userId,
      modelId: selectedModel,
      durationMs,
    });

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    const durationMs = Date.now() - requestStartTime;
    const message = error instanceof Error ? error.message : 'Unknown error';

    let userMessage = message;
    if (message.includes('timeout') || message.includes('abort')) {
      userMessage = `Request timed out after ${Math.round(durationMs / 1000)}s. The model may be overloaded — try again or switch to a faster model.`;
    } else if (message.includes('fetch failed') || message.includes('ECONNREFUSED')) {
      userMessage = `Could not reach ${provider.name} API. Check your network connection.`;
    }

    logger.error('ai_request', `Chat request failed: ${message}`, {
      userId,
      modelId: selectedModel,
      durationMs,
      error,
    });

    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: userMessage })}\n\n`);
      res.end();
    } catch { /* response already closed */ }
  }
});

// GET /api/ai/tools - List available AI tools and their definitions
router.get('/tools', (_req: Request, res: Response) => {
  const definitions = toolTracker.getAllDefinitions().map(d => ({
    name: d.name,
    description: d.description,
    maxRetries: d.maxRetries,
    timeoutMs: d.timeoutMs,
  }));
  res.json({ tools: definitions });
});

// GET /api/ai/tools/summary - Tool execution summary
router.get('/tools/summary', verifyAuth, (_req: Request, res: Response) => {
  res.json(toolTracker.getSummary());
});

export { router as aiRouter };
