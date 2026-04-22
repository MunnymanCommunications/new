// Smart context window management: prioritizes relevant files, truncates
// conversation history, and ensures requests stay within model limits.

import { estimateTokens, getModelLimits, computeTokenBudget, type TokenBudgetReport } from './token-counter.js';

interface ProjectFile {
  path: string;
  content: string;
}

interface ChatMessage {
  role: string;
  content: string;
}

interface ManagedContext {
  systemPrompt: string;
  projectContext: string;
  messages: ChatMessage[];
  budget: TokenBudgetReport;
  truncated: {
    filesDropped: string[];
    messagesDropped: number;
    contextWasTruncated: boolean;
  };
}

// Files most likely to be relevant when building/editing the app
const FILE_PRIORITY: Record<string, number> = {
  'src/App.tsx': 100,
  'src/main.tsx': 90,
  'src/index.css': 80,
};

function filePriority(path: string): number {
  if (FILE_PRIORITY[path]) return FILE_PRIORITY[path];
  if (path.includes('/pages/')) return 70;
  if (path.includes('/components/')) return 60;
  if (path.includes('/stores/')) return 55;
  if (path.includes('/hooks/')) return 50;
  if (path.includes('/lib/')) return 45;
  if (path.endsWith('.tsx')) return 40;
  if (path.endsWith('.ts')) return 35;
  if (path.endsWith('.css')) return 30;
  return 10;
}

function relevanceToMessage(file: ProjectFile, lastUserMessage: string): number {
  const lower = lastUserMessage.toLowerCase();
  const pathLower = file.path.toLowerCase();

  let score = 0;
  // Filename mentioned directly
  const filename = pathLower.split('/').pop()?.replace(/\.\w+$/, '') || '';
  if (lower.includes(filename)) score += 50;
  // Path segment mentioned
  const segments = pathLower.split('/');
  for (const seg of segments) {
    if (seg.length > 2 && lower.includes(seg.replace(/\.\w+$/, ''))) score += 20;
  }
  // Content keywords overlap (cheap heuristic: check exported identifiers)
  const exports = file.content.match(/export\s+(?:default\s+)?(?:function|const|class|interface|type)\s+(\w+)/g);
  if (exports) {
    for (const exp of exports) {
      const name = exp.split(/\s+/).pop() || '';
      if (name.length > 2 && lower.includes(name.toLowerCase())) score += 30;
    }
  }
  return score;
}

function prioritizeFiles(files: ProjectFile[], lastUserMessage: string): ProjectFile[] {
  return [...files].sort((a, b) => {
    const scoreA = filePriority(a.path) + relevanceToMessage(a, lastUserMessage);
    const scoreB = filePriority(b.path) + relevanceToMessage(b, lastUserMessage);
    return scoreB - scoreA;
  });
}

export function buildManagedContext(
  modelId: string,
  baseSystemPrompt: string,
  files: ProjectFile[],
  messages: ChatMessage[],
  mode: 'build' | 'chat'
): ManagedContext {
  const limits = getModelLimits(modelId);
  const filesDropped: string[] = [];
  let messagesDropped = 0;

  // Reserve space: system prompt + output tokens + safety margin
  const systemTokens = estimateTokens(baseSystemPrompt);
  const reservedForOutput = limits.maxOutputTokens;
  const safetyMargin = 2000;
  let remainingBudget = limits.inputBudget - systemTokens - safetyMargin;

  // --- Step 1: Budget for conversation (most recent messages get priority) ---
  // Start with all messages, trim from the oldest if over budget
  let finalMessages = [...messages];
  // Allocate up to 40% of remaining budget for conversation
  const conversationCeiling = Math.floor(remainingBudget * 0.4);
  let conversationTokens = finalMessages.reduce((s, m) => s + estimateTokens(m.content) + 4, 0);

  while (conversationTokens > conversationCeiling && finalMessages.length > 2) {
    finalMessages.shift();
    messagesDropped++;
    conversationTokens = finalMessages.reduce((s, m) => s + estimateTokens(m.content) + 4, 0);
  }

  // If the latest user message alone exceeds the ceiling, keep it but truncate its content
  if (finalMessages.length === 1 && conversationTokens > conversationCeiling) {
    const maxChars = conversationCeiling * 3.5;
    finalMessages[0] = {
      ...finalMessages[0],
      content: finalMessages[0].content.slice(0, maxChars) + '\n\n[Message truncated due to length]',
    };
    conversationTokens = estimateTokens(finalMessages[0].content) + 4;
  }

  remainingBudget -= conversationTokens;

  // --- Step 2: Budget for project files ---
  let projectContext = '';
  if (mode === 'build' && files.length > 0 && remainingBudget > 1000) {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content || '';
    const sorted = prioritizeFiles(
      files.filter(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts') || f.path.endsWith('.css')),
      lastUserMsg
    );

    const includedParts: string[] = [];
    let fileTokensUsed = 0;

    for (const file of sorted) {
      const fileStr = `--- ${file.path} ---\n${file.content}`;
      const fileTokens = estimateTokens(fileStr);

      if (fileTokensUsed + fileTokens > remainingBudget) {
        // Try including a truncated version of large files
        const availableTokens = remainingBudget - fileTokensUsed;
        if (availableTokens > 500) {
          const maxChars = availableTokens * 3.5;
          const truncated = file.content.slice(0, maxChars);
          includedParts.push(`--- ${file.path} (truncated) ---\n${truncated}\n[...truncated]`);
          fileTokensUsed += estimateTokens(truncated) + 20;
        }
        filesDropped.push(file.path);
        continue;
      }

      includedParts.push(fileStr);
      fileTokensUsed += fileTokens;
    }

    projectContext = includedParts.join('\n\n');
  }

  // --- Step 3: Assemble final system prompt ---
  const systemPrompt = mode === 'chat'
    ? baseSystemPrompt
    : baseSystemPrompt + (projectContext ? `\n\nCURRENT PROJECT FILES:\n${projectContext}` : '');

  const budget = computeTokenBudget(modelId, systemPrompt, '', finalMessages);

  return {
    systemPrompt,
    projectContext,
    messages: finalMessages,
    budget,
    truncated: {
      filesDropped,
      messagesDropped,
      contextWasTruncated: filesDropped.length > 0 || messagesDropped > 0,
    },
  };
}
