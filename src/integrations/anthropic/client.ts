// Anthropic Claude API integration
// In production, API calls would be proxied through a backend for security

export interface AnthropicConfig {
  apiKey: string;
  model?: string;
}

export interface StreamMessage {
  type: 'content_block_delta' | 'message_start' | 'message_stop';
  delta?: {
    text: string;
  };
}

export interface MessageRequest {
  model: string;
  max_tokens: number;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
  system?: string;
}

// System prompt for code generation
export const SYSTEM_PROMPT = `You are an expert full-stack developer specializing in:
- React with TypeScript
- Vite build system
- Tailwind CSS and shadcn/ui components
- Supabase backend (PostgreSQL, Auth, Edge Functions)
- Modern web best practices

CRITICAL RULES:
1. Always use TypeScript with proper interfaces
2. Components in /components, pages in /pages
3. Use shadcn/ui components when available
4. Follow React best practices (hooks, composition)
5. Implement error boundaries
6. Add loading states
7. Use Tailwind for ALL styling (no inline styles)
8. Create responsive layouts (mobile-first)
9. Add proper ARIA attributes for accessibility
10. Generate Supabase RLS policies for security

RESPONSE FORMAT:
- Keep explanations concise
- Use code blocks with filenames for file changes
- List files changed at the end
- Highlight important notes`;

export class AnthropicClient {
  private apiKey: string;
  private model: string;

  constructor(config: AnthropicConfig) {
    this.apiKey = config.apiKey;
    this.model = config.model || 'claude-sonnet-4-5-20250929';
  }

  async *streamMessage(request: MessageRequest): AsyncGenerator<string> {
    // In production, this would call the Anthropic API
    // For demo, we simulate streaming
    const words = 'This is a simulated AI response. In production, this would stream from the Claude API.'.split(' ');
    for (const word of words) {
      yield word + ' ';
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async sendMessage(request: MessageRequest): Promise<string> {
    // Collect all streamed content
    let fullResponse = '';
    for await (const chunk of this.streamMessage(request)) {
      fullResponse += chunk;
    }
    return fullResponse;
  }
}

// Create client instance
export function createAnthropicClient(): AnthropicClient | null {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY;
  if (!apiKey) return null;
  return new AnthropicClient({ apiKey });
}
