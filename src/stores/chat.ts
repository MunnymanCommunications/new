import { create } from 'zustand';
import { generateId } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  streamAIChat,
  buildProjectContext,
  extractSQLBlocks,
  extractFileBlocks,
  type ContextMeta,
} from '@/lib/ai-service';
import { executeProjectSQL } from '@/lib/database-manager';
import type { ChatMessage, FileChange } from '@/types';
import type { ProjectFile } from '@/types';

interface ToolExecution {
  id: string;
  tool: 'sql' | 'file';
  status: 'running' | 'success' | 'error' | 'retrying';
  label: string;
  error?: string;
  attempt: number;
}

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  mode: 'build' | 'chat';
  contextMeta: ContextMeta | null;
  activeTools: ToolExecution[];

  loadMessages: (projectId: string) => Promise<void>;
  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  clearMessages: () => void;
  setMode: (mode: 'build' | 'chat') => void;
  setStreaming: (streaming: boolean) => void;

  sendMessage: (
    content: string,
    projectId: string,
    files: ProjectFile[],
    onFilesChanged?: (changes: FileChange[]) => void
  ) => Promise<void>;
}

const MAX_SQL_RETRIES = 1;

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome to **VibeCraft**! I'm your AI coding assistant. I can help you build full-stack web applications with React, TypeScript, Tailwind CSS, and Supabase.

Here are some things you can ask me:
- "Build a todo app with drag and drop"
- "Create a dashboard with charts and stats"
- "Add a users table with email and role columns"
- "Create an API endpoint for fetching products"

I can also **create and manage database tables** for your project automatically. Just describe the data you need!

What would you like to build today?`,
      timestamp: new Date(),
      mode: 'build',
    },
  ],
  isStreaming: false,
  mode: 'build',
  contextMeta: null,
  activeTools: [],

  loadMessages: async (projectId) => {
    const { data } = await supabase
      .from('chat_messages')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: true });

    if (data && data.length > 0) {
      const messages: ChatMessage[] = data.map((row: Record<string, unknown>) => ({
        id: row.id as string,
        role: row.role as ChatMessage['role'],
        content: row.content as string,
        timestamp: new Date(row.created_at as string),
        mode: (row.mode as ChatMessage['mode']) || 'build',
      }));
      set({ messages });
    } else {
      set({
        messages: [
          {
            id: 'welcome',
            role: 'assistant',
            content: `Welcome to **VibeCraft**! I'm your AI coding assistant. Describe what you want to build and I'll generate the code and database tables for you.`,
            timestamp: new Date(),
            mode: 'build',
          },
        ],
      });
    }
  },

  addMessage: (message) => {
    const id = generateId();
    set((state) => ({
      messages: [...state.messages, { ...message, id, timestamp: new Date() }],
    }));
    return id;
  },

  updateMessage: (id, updates) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, ...updates } : m
      ),
    }));
  },

  clearMessages: () => {
    set({
      messages: [
        {
          id: 'welcome',
          role: 'assistant',
          content: `Chat cleared. What would you like to build?`,
          timestamp: new Date(),
          mode: 'build',
        },
      ],
      contextMeta: null,
      activeTools: [],
    });
  },

  setMode: (mode) => set({ mode }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),

  sendMessage: async (content, projectId, files, onFilesChanged) => {
    const state = get();

    get().addMessage({
      role: 'user',
      content,
      mode: state.mode,
    });

    set({ isStreaming: true, contextMeta: null, activeTools: [] });

    // Save user message to DB
    supabase
      .from('chat_messages')
      .insert({
        project_id: projectId,
        role: 'user',
        content,
        mode: state.mode,
      })
      .then(() => {});

    const assistantId = get().addMessage({
      role: 'assistant',
      content: '',
      mode: state.mode,
      isStreaming: true,
    });

    // Build conversation history
    const recentMessages = get()
      .messages.filter((m) => m.id !== assistantId && m.id !== 'welcome')
      .slice(-10)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const projectContext = buildProjectContext(files);

    // Send structured files so the server can do smart context management
    const structuredFiles = files
      .filter(f => f.path.endsWith('.tsx') || f.path.endsWith('.ts') || f.path.endsWith('.css'))
      .map(f => ({ path: f.path, content: f.content }));

    let fullContent = '';
    const preferredModel = (window as any).__vibecraft_preferred_model;

    await streamAIChat(recentMessages, projectContext, state.mode, {
      onText: (text) => {
        fullContent += text;
        get().updateMessage(assistantId, { content: fullContent });
      },
      onContextMeta: (meta) => {
        set({ contextMeta: meta });

        if (meta.contextWasTruncated) {
          const dropInfo: string[] = [];
          if (meta.filesDropped && meta.filesDropped.length > 0) {
            dropInfo.push(`${meta.filesDropped.length} file(s) excluded from context`);
          }
          if (meta.messagesDropped && meta.messagesDropped > 0) {
            dropInfo.push(`${meta.messagesDropped} older message(s) trimmed`);
          }
          console.warn('[VibeCraft] Context was truncated:', dropInfo.join(', '), meta);
        }

        if (meta.tokenBudget?.overBudget) {
          console.warn('[VibeCraft] Context over budget by', meta.tokenBudget.overageTokens, 'tokens');
        }
      },
      onDone: async () => {
        const sqlBlocks = extractSQLBlocks(fullContent);
        const fileBlocks = extractFileBlocks(fullContent);
        const fileChanges: FileChange[] = [];

        // Execute SQL blocks with retry
        for (let i = 0; i < sqlBlocks.length; i++) {
          const sql = sqlBlocks[i];
          const toolId = `sql_${i}_${Date.now()}`;

          set((s) => ({
            activeTools: [...s.activeTools, {
              id: toolId,
              tool: 'sql',
              status: 'running',
              label: sql.slice(0, 80).replace(/\n/g, ' '),
              attempt: 1,
            }],
          }));

          let success = false;
          let lastError = '';

          for (let attempt = 0; attempt <= MAX_SQL_RETRIES; attempt++) {
            if (attempt > 0) {
              set((s) => ({
                activeTools: s.activeTools.map((t) =>
                  t.id === toolId ? { ...t, status: 'retrying' as const, attempt: attempt + 1 } : t
                ),
              }));
              await new Promise((r) => setTimeout(r, 1000 * attempt));
            }

            const result = await executeProjectSQL(projectId, sql);
            if (result.success) {
              success = true;
              fullContent += `\n\n> **SQL executed successfully.**`;
              set((s) => ({
                activeTools: s.activeTools.map((t) =>
                  t.id === toolId ? { ...t, status: 'success' as const } : t
                ),
              }));
              break;
            } else {
              lastError = result.error || 'Unknown SQL error';
            }
          }

          if (!success) {
            fullContent += `\n\n> **SQL Error:** ${lastError}`;
            set((s) => ({
              activeTools: s.activeTools.map((t) =>
                t.id === toolId ? { ...t, status: 'error' as const, error: lastError } : t
              ),
            }));
            console.error('[VibeCraft] SQL execution failed after retries:', lastError, sql.slice(0, 200));
          }

          get().updateMessage(assistantId, { content: fullContent });
        }

        // Process file blocks
        for (const block of fileBlocks) {
          fileChanges.push({
            path: block.path,
            action: 'create',
          });
        }

        get().updateMessage(assistantId, {
          content: fullContent,
          isStreaming: false,
          filesChanged: fileChanges.length > 0 ? fileChanges : undefined,
        });
        set({ isStreaming: false });

        // Save assistant message to DB
        supabase
          .from('chat_messages')
          .insert({
            project_id: projectId,
            role: 'assistant',
            content: fullContent,
            mode: state.mode,
          })
          .then(() => {});

        if (onFilesChanged && fileChanges.length > 0) {
          onFilesChanged(fileChanges);
        }
      },
      onError: (err) => {
        console.error('[VibeCraft] AI stream error:', err);
        get().updateMessage(assistantId, {
          content: `Sorry, an error occurred: ${err}`,
          isStreaming: false,
        });
        set({ isStreaming: false });
      },
    }, preferredModel, structuredFiles);
  },
}));
