import { useCallback } from 'react';
import { useChatStore } from '@/stores/chat';
import type { FileChange } from '@/types';

export function useChat() {
  const store = useChatStore();

  const send = useCallback(
    async (content: string, onFilesChanged?: (changes: FileChange[]) => void) => {
      await store.sendMessage(content, onFilesChanged);
    },
    [store]
  );

  return {
    messages: store.messages,
    isStreaming: store.isStreaming,
    mode: store.mode,
    credits: store.credits,
    send,
    setMode: store.setMode,
    clearMessages: store.clearMessages,
  };
}
