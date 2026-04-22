import { useCallback } from 'react';
import { useProjectStore } from '@/stores/project';
import type { ProjectFile, FileChange } from '@/types';

export function useProject() {
  const store = useProjectStore();
  const currentProject = store.currentProject();
  const { files, currentProjectId } = store;

  const applyFileChanges = useCallback(
    (changes: FileChange[]) => {
      if (!currentProjectId) return;

      for (const change of changes) {
        if (change.action === 'delete') {
          store.deleteFile(currentProjectId, change.path);
        }
      }
    },
    [currentProjectId, store]
  );

  const updateProjectFile = useCallback(
    (path: string, content: string) => {
      if (!currentProjectId) return;
      store.updateFile(currentProjectId, path, content);
    },
    [currentProjectId, store]
  );

  const addProjectFile = useCallback(
    (file: ProjectFile) => {
      if (!currentProjectId) return;
      store.addFile(currentProjectId, file);
    },
    [currentProjectId, store]
  );

  return {
    project: currentProject,
    files,
    applyFileChanges,
    updateProjectFile,
    addProjectFile,
  };
}
