import { Router, type Request, type Response } from 'express';
import { verifyAuth } from '../middleware/auth.js';

const router = Router();

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929';

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

// POST /api/ai/chat - Stream AI response
router.post('/chat', verifyAuth, async (req: Request, res: Response) => {
  if (!ANTHROPIC_API_KEY) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
    return;
  }

  const { messages, projectContext, mode } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  const systemPrompt = mode === 'chat'
    ? 'You are a helpful assistant for discussing web development. Answer questions concisely.'
    : SYSTEM_PROMPT + (projectContext ? `\n\nCURRENT PROJECT FILES:\n${projectContext}` : '');

  try {
    // Set up SSE headers for streaming
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 8192,
        system: systemPrompt,
        stream: true,
        messages: messages.map((m: { role: string; content: string }) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.write(`data: ${JSON.stringify({ type: 'error', error: errorText })}\n\n`);
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
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);

            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
              res.write(`data: ${JSON.stringify({ type: 'text', text: parsed.delta.text })}\n\n`);
            } else if (parsed.type === 'message_stop') {
              res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
            } else if (parsed.type === 'error') {
              res.write(`data: ${JSON.stringify({ type: 'error', error: parsed.error?.message || 'Unknown error' })}\n\n`);
            }
          } catch {
            // Skip unparseable lines
          }
        }
      }
    }

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    res.write(`data: ${JSON.stringify({ type: 'error', error: message })}\n\n`);
    res.end();
  }
});

export { router as aiRouter };
