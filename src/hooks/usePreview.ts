import { useState, useEffect, useCallback, useRef } from 'react';
import { useProjectStore } from '@/stores/project';
import { generatePreviewHTML } from '@/lib/file-system';

export function usePreview() {
  const { currentProjectId, files } = useProjectStore();
  const [previewHTML, setPreviewHTML] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const lastGeneratedRef = useRef<string>('');

  const generatePreview = useCallback(() => {
    if (!currentProjectId || files.length === 0) return;

    const html = generatePreviewHTML(files);

    // Only update if content changed
    if (html !== lastGeneratedRef.current) {
      setIsLoading(true);
      lastGeneratedRef.current = html;
      setPreviewHTML(html);
      // Simulate brief loading
      setTimeout(() => setIsLoading(false), 100);
    }
  }, [currentProjectId, files]);

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
