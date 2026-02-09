// =============================================================================
// PDF Upload Component - Drag & drop or click to upload PDF floor plans
// =============================================================================

import { useState, useRef, useCallback } from 'react';

interface PdfUploaderProps {
  onFileSelected: (file: File) => void;
  isProcessing: boolean;
}

export function PdfUploader({ onFileSelected, isProcessing }: PdfUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const MAX_SIZE_MB = 50;

  const validateFile = useCallback((file: File): boolean => {
    if (file.type !== 'application/pdf') {
      setError('Please upload a PDF file.');
      return false;
    }
    if (file.size > MAX_SIZE_MB * 1024 * 1024) {
      setError(`File too large. Maximum size is ${MAX_SIZE_MB}MB.`);
      return false;
    }
    setError(null);
    return true;
  }, []);

  const handleFile = useCallback((file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  }, [validateFile]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleSubmit = useCallback(() => {
    if (selectedFile) {
      onFileSelected(selectedFile);
    }
  }, [selectedFile, onFileSelected]);

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onClick={handleClick}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={`
          border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragging
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-dark-border-color hover:border-blue-400 hover:bg-gray-50 dark:hover:bg-dark-base-medium'
          }
          ${isProcessing ? 'opacity-50 pointer-events-none' : ''}
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={handleInputChange}
        />

        <div className="flex flex-col items-center gap-3">
          <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>

          <div>
            <p className="text-lg font-medium text-text-primary dark:text-dark-text-primary">
              {isDragging ? 'Drop your PDF here' : 'Upload Floor Plan PDF'}
            </p>
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary mt-1">
              Drag & drop or click to browse. Supports multi-page CAD/architectural PDFs up to {MAX_SIZE_MB}MB.
            </p>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Selected file info */}
      {selectedFile && !error && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <div>
                <p className="font-medium text-text-primary dark:text-dark-text-primary">
                  {selectedFile.name}
                </p>
                <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <button
            onClick={handleSubmit}
            disabled={isProcessing}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-6 rounded-lg
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isProcessing ? 'Processing...' : 'Analyze Floor Plans'}
          </button>
        </div>
      )}
    </div>
  );
}
