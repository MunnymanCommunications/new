import { useCallback } from 'react';
import { useChatStore } from '@/stores/chat';
import { useProjectStore } from '@/stores/project';
import type { FileChange } from '@/types';

export function useChat() {
  const store = useChatStore();
  const { currentProjectId, files } = useProjectStore();

  const send = useCallback(
    async (content: string, onFilesChanged?: (changes: FileChange[]) => void) => {
      if (!currentProjectId) return;
      await store.sendMessage(content, currentProjectId, files, onFilesChanged);
    },
    [store, currentProjectId, files]
  );

  return {
    messages: store.messages,
    isStreaming: store.isStreaming,
    mode: store.mode,
    send,
    setMode: store.setMode,
    clearMessages: store.clearMessages,
  };
}
