// Approximate token counting without a full tokenizer dependency.
// Uses the ~4 chars per token heuristic, refined per content type.
// This is intentionally conservative (overestimates) to prevent context overflows.

export interface ModelContextLimits {
  contextWindow: number;
  maxOutputTokens: number;
  inputBudget: number; // contextWindow - maxOutputTokens - safety margin
}

const MODEL_LIMITS: Record<string, ModelContextLimits> = {
  // Anthropic
  'claude-sonnet-4-5-20250929': { contextWindow: 200000, maxOutputTokens: 8192, inputBudget: 180000 },
  'claude-opus-4-5-20250929':   { contextWindow: 200000, maxOutputTokens: 8192, inputBudget: 180000 },
  'claude-haiku-3-5-20241022':  { contextWindow: 200000, maxOutputTokens: 8192, inputBudget: 180000 },
  // OpenAI
  'gpt-4o':       { contextWindow: 128000, maxOutputTokens: 4096,  inputBudget: 115000 },
  'gpt-4o-mini':  { contextWindow: 128000, maxOutputTokens: 4096,  inputBudget: 115000 },
  'gpt-4-turbo':  { contextWindow: 128000, maxOutputTokens: 4096,  inputBudget: 115000 },
  'o3-mini':      { contextWindow: 200000, maxOutputTokens: 16384, inputBudget: 170000 },
  // Google Gemini
  'gemini-2.5-flash': { contextWindow: 1048576, maxOutputTokens: 8192, inputBudget: 900000 },
  'gemini-2.5-pro':   { contextWindow: 1048576, maxOutputTokens: 8192, inputBudget: 900000 },
  'gemini-2.0-flash':  { contextWindow: 1048576, maxOutputTokens: 8192, inputBudget: 900000 },
};

const DEFAULT_LIMITS: ModelContextLimits = {
  contextWindow: 100000,
  maxOutputTokens: 4096,
  inputBudget: 85000,
};

export function getModelLimits(modelId: string): ModelContextLimits {
  return MODEL_LIMITS[modelId] || DEFAULT_LIMITS;
}

export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Heuristic: ~1 token per 3.5 characters for code, ~1 per 4 for English prose.
  // We lean conservative (higher estimate) to prevent overflows.
  const codeWeight = (text.match(/[{}()\[\];=<>]/g)?.length || 0) / Math.max(text.length, 1);
  const charsPerToken = codeWeight > 0.03 ? 3.2 : 3.8;
  return Math.ceil(text.length / charsPerToken);
}

export interface TokenBudgetReport {
  systemPromptTokens: number;
  projectContextTokens: number;
  conversationTokens: number;
  totalInputTokens: number;
  inputBudget: number;
  maxOutputTokens: number;
  overBudget: boolean;
  overageTokens: number;
  utilizationPercent: number;
}

export function computeTokenBudget(
  modelId: string,
  systemPrompt: string,
  projectContext: string,
  messages: Array<{ role: string; content: string }>
): TokenBudgetReport {
  const limits = getModelLimits(modelId);
  const systemPromptTokens = estimateTokens(systemPrompt);
  const projectContextTokens = estimateTokens(projectContext);
  const conversationTokens = messages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0); // +4 per message for role/formatting overhead

  const totalInputTokens = systemPromptTokens + projectContextTokens + conversationTokens;
  const overageTokens = Math.max(0, totalInputTokens - limits.inputBudget);

  return {
    systemPromptTokens,
    projectContextTokens,
    conversationTokens,
    totalInputTokens,
    inputBudget: limits.inputBudget,
    maxOutputTokens: limits.maxOutputTokens,
    overBudget: overageTokens > 0,
    overageTokens,
    utilizationPercent: Math.round((totalInputTokens / limits.inputBudget) * 100),
  };
}
