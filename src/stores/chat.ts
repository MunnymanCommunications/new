import { create } from 'zustand';
import { generateId } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  streamAIChat,
  buildProjectContext,
  extractSQLBlocks,
  extractFileBlocks,
} from '@/lib/ai-service';
import { executeProjectSQL } from '@/lib/database-manager';
import type { ChatMessage, FileChange } from '@/types';
import type { ProjectFile } from '@/types';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  mode: 'build' | 'chat';

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
      // Reset to welcome message for new projects
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
    });
  },

  setMode: (mode) => set({ mode }),
  setStreaming: (streaming) => set({ isStreaming: streaming }),

  sendMessage: async (content, projectId, files, onFilesChanged) => {
    const state = get();

    // Add user message
    get().addMessage({
      role: 'user',
      content,
      mode: state.mode,
    });

    set({ isStreaming: true });

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

    // Add placeholder assistant message
    const assistantId = get().addMessage({
      role: 'assistant',
      content: '',
      mode: state.mode,
      isStreaming: true,
    });

    // Build conversation history for AI
    const recentMessages = get()
      .messages.filter((m) => m.id !== assistantId && m.id !== 'welcome')
      .slice(-10)
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }));

    const projectContext = buildProjectContext(files);

    let fullContent = '';

    await streamAIChat(recentMessages, projectContext, state.mode, {
      onText: (text) => {
        fullContent += text;
        get().updateMessage(assistantId, { content: fullContent });
      },
      onDone: async () => {
        // Parse SQL blocks and auto-execute
        const sqlBlocks = extractSQLBlocks(fullContent);
        const fileBlocks = extractFileBlocks(fullContent);
        const fileChanges: FileChange[] = [];

        for (const sql of sqlBlocks) {
          const result = await executeProjectSQL(projectId, sql);
          if (!result.success) {
            fullContent += `\n\n> **SQL Error:** ${result.error}`;
          } else {
            fullContent += `\n\n> **SQL executed successfully.**`;
          }
          get().updateMessage(assistantId, { content: fullContent });
        }

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
      onError: (error) => {
        get().updateMessage(assistantId, {
          content: `Sorry, an error occurred: ${error}`,
          isStreaming: false,
        });
        set({ isStreaming: false });
      },
    });
  },
}));
