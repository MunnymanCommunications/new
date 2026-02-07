import type { FileChange, ProjectFile } from '@/types';

export interface ParsedCodeBlock {
  language: string;
  filename?: string;
  content: string;
}

export function parseCodeBlocks(response: string): ParsedCodeBlock[] {
  const blocks: ParsedCodeBlock[] = [];
  const regex = /```(\w+)?(?:\s+(.+?))?\n([\s\S]*?)```/g;
  let match;

  while ((match = regex.exec(response)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      filename: match[2]?.trim(),
      content: match[3].trim(),
    });
  }

  return blocks;
}

export function extractFileChanges(response: string): FileChange[] {
  const changes: FileChange[] = [];
  const filePattern = /(?:created?|modified?|updated?|deleted?|changed?)\s+`([^`]+)`/gi;
  let match;

  while ((match = filePattern.exec(response)) !== null) {
    const path = match[1];
    const action = match[0].toLowerCase().includes('creat')
      ? 'create'
      : match[0].toLowerCase().includes('delet')
      ? 'delete'
      : 'modify';
    changes.push({ path, action });
  }

  return changes;
}

export function applyCodeChanges(
  files: ProjectFile[],
  codeBlocks: ParsedCodeBlock[]
): { files: ProjectFile[]; changes: FileChange[] } {
  const updatedFiles = [...files];
  const changes: FileChange[] = [];

  for (const block of codeBlocks) {
    if (!block.filename) continue;

    const existingIndex = updatedFiles.findIndex((f) => f.path === block.filename);

    if (existingIndex >= 0) {
      updatedFiles[existingIndex] = {
        ...updatedFiles[existingIndex],
        content: block.content,
        lastModified: new Date(),
      };
      changes.push({ path: block.filename, action: 'modify' });
    } else {
      updatedFiles.push({
        path: block.filename,
        content: block.content,
        language: block.language,
        lastModified: new Date(),
      });
      changes.push({ path: block.filename, action: 'create' });
    }
  }

  return { files: updatedFiles, changes };
}
