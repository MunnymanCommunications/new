import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '@/stores/project';
import { generatePreviewHTML } from '@/lib/file-system';

export function usePreview() {
  const { currentProjectId, projects } = useProjectStore();
  const currentProject = projects.find((p) => p.id === currentProjectId);
  const [previewHTML, setPreviewHTML] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const lastGeneratedRef = useRef<string>('');

  const generatePreview = useCallback(() => {
    if (!currentProject) return;

    const html = generatePreviewHTML(currentProject.files);

    // Only update if content changed
    if (html !== lastGeneratedRef.current) {
      setIsLoading(true);
      lastGeneratedRef.current = html;
      setPreviewHTML(html);
      // Simulate brief loading
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [currentProject]);

  useEffect(() => {
    generatePreview();
  }, [generatePreview]);

  const refreshPreview = useCallback(() => {
    lastGeneratedRef.current = '';
    generatePreview();
  }, [generatePreview]);

  return {
    previewHTML,
    isLoading,
    refreshPreview,
  };
}
