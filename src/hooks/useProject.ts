import { useCallback } from 'react';
import { useProjectStore } from '@/stores/project';
import type { ProjectFile, FileChange } from '@/types';

export function useProject() {
  const store = useProjectStore();
  const currentProject = store.currentProject();

  const applyFileChanges = useCallback(
    (changes: FileChange[]) => {
      if (!currentProject) return;

      for (const change of changes) {
        if (change.action === 'delete') {
          store.deleteFile(currentProject.id, change.path);
        }
      }
    },
    [currentProject, store]
  );

  const updateProjectFile = useCallback(
    (path: string, content: string) => {
      if (!currentProject) return;
      store.updateFile(currentProject.id, path, content);
    },
    [currentProject, store]
  );

  const addProjectFile = useCallback(
    (file: ProjectFile) => {
      if (!currentProject) return;
      store.addFile(currentProject.id, file);
    },
    [currentProject, store]
  );

  return {
    project: currentProject,
    files: currentProject?.files || [],
    applyFileChanges,
    updateProjectFile,
    addProjectFile,
  };
}
