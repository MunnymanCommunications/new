import { create } from 'zustand';
import { generateId } from '@/lib/utils';
import type { ChatMessage, CreditInfo, FileChange } from '@/types';

interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  mode: 'build' | 'chat';
  credits: CreditInfo;

  addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => string;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  deleteMessage: (id: string) => void;
  clearMessages: () => void;
  setMode: (mode: 'build' | 'chat') => void;
  setStreaming: (streaming: boolean) => void;
  deductCredits: (amount: number) => void;

  sendMessage: (content: string, onFilesChanged?: (changes: FileChange[]) => void) => Promise<void>;
}

function calculateCreditCost(mode: 'build' | 'chat', content: string): number {
  if (mode === 'chat') return 1;
  const length = content.length;
  if (length < 50) return 1;
  if (length < 200) return 2;
  if (length < 500) return 3;
  return 5;
}

const SAMPLE_RESPONSES: Record<string, { content: string; files: FileChange[] }> = {
  todo: {
    content: `I'll create a beautiful todo app for you. Here's what I've built:

- A clean, modern todo list with add/remove functionality
- Smooth animations for adding and completing tasks
- Local storage persistence
- Filter options for all/active/completed tasks

**Files changed:**
- \`src/App.tsx\` - Main app with todo logic
- \`src/components/TodoItem.tsx\` - Individual todo component`,
    files: [
      { path: 'src/App.tsx', action: 'modify' },
      { path: 'src/components/TodoItem.tsx', action: 'create' },
    ],
  },
  dashboard: {
    content: `I've created a comprehensive dashboard layout for you:

- Responsive sidebar navigation with collapsible menu
- Header with search, notifications, and user profile
- Main content area with stat cards and charts
- Activity feed with recent actions
- Clean card-based layout with proper spacing

**Files changed:**
- \`src/App.tsx\` - Dashboard layout
- \`src/components/Sidebar.tsx\` - Navigation sidebar
- \`src/components/StatCard.tsx\` - Statistics card component
- \`src/components/ActivityFeed.tsx\` - Activity feed component`,
    files: [
      { path: 'src/App.tsx', action: 'modify' },
      { path: 'src/components/Sidebar.tsx', action: 'create' },
      { path: 'src/components/StatCard.tsx', action: 'create' },
      { path: 'src/components/ActivityFeed.tsx', action: 'create' },
    ],
  },
  default: {
    content: `I've made the requested changes to your application. The updates include:

- Component structure updates
- Styling improvements with Tailwind CSS
- Responsive design adjustments
- Proper TypeScript typing

The preview should update automatically with the new changes.`,
    files: [{ path: 'src/App.tsx', action: 'modify' }],
  },
};

function getSimulatedResponse(content: string): { content: string; files: FileChange[] } {
  const lower = content.toLowerCase();
  if (lower.includes('todo') || lower.includes('task')) return SAMPLE_RESPONSES.todo;
  if (lower.includes('dashboard') || lower.includes('admin') || lower.includes('analytics')) return SAMPLE_RESPONSES.dashboard;
  return SAMPLE_RESPONSES.default;
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [
    {
      id: 'welcome',
      role: 'assistant',
      content: `Welcome to **VibeCraft**! I'm your AI coding assistant. I can help you build full-stack web applications using React, TypeScript, Tailwind CSS, and Supabase.

Here are some things you can ask me:
- "Build a todo app with drag and drop"
- "Create a dashboard with charts and stats"
- "Add user authentication with Supabase"
- "Create a responsive landing page"

What would you like to build today?`,
      timestamp: new Date(),
      mode: 'build',
    },
  ],
  isStreaming: false,
  mode: 'build',
  credits: {
    remaining: 95,
    total: 100,
    plan: 'pro',
    resetDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },

  addMessage: (message) => {
    const id = generateId();
    set((state) => ({
      messages: [
        ...state.messages,
        { ...message, id, timestamp: new Date() },
      ],
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

  deleteMessage: (id) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.id !== id),
    }));
  },

  clearMessages: () => {
    set({ messages: [] });
  },

  setMode: (mode) => {
    set({ mode });
  },

  setStreaming: (streaming) => {
    set({ isStreaming: streaming });
  },

  deductCredits: (amount) => {
    set((state) => ({
      credits: {
        ...state.credits,
        remaining: Math.max(0, state.credits.remaining - amount),
      },
    }));
  },

  sendMessage: async (content, onFilesChanged) => {
    const state = get();
    const creditCost = calculateCreditCost(state.mode, content);

    // Add user message
    get().addMessage({
      role: 'user',
      content,
      mode: state.mode,
      creditCost,
    });

    // Deduct credits
    get().deductCredits(creditCost);
    set({ isStreaming: true });

    // Add placeholder assistant message
    const assistantId = get().addMessage({
      role: 'assistant',
      content: '',
      mode: state.mode,
      isStreaming: true,
    });

    // Simulate streaming response
    const response = getSimulatedResponse(content);
    const words = response.content.split(' ');
    let accumulated = '';

    for (let i = 0; i < words.length; i++) {
      accumulated += (i === 0 ? '' : ' ') + words[i];
      get().updateMessage(assistantId, { content: accumulated });
      await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30));
    }

    // Finalize message
    get().updateMessage(assistantId, {
      content: response.content,
      isStreaming: false,
      filesChanged: response.files,
      creditCost: creditCost,
    });

    set({ isStreaming: false });

    if (onFilesChanged && response.files.length > 0) {
      onFilesChanged(response.files);
    }
  },
}));
