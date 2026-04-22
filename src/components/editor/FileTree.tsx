import React, { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  FolderOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { buildFileTree, type FileTreeNode } from '@/lib/file-system';
import { useProjectStore } from '@/stores/project';
import { useEditorStore } from '@/stores/editor';

export function FileTree() {
  const { files } = useProjectStore();
  const tree = buildFileTree(files);

  return (
    <div className="text-sm">
      <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        Files
      </div>
      <div className="px-1">
        {tree.map((node) => (
          <TreeNode key={node.path} node={node} depth={0} />
        ))}
      </div>
    </div>
  );
}

function TreeNode({ node, depth }: { node: FileTreeNode; depth: number }) {
  const [isOpen, setIsOpen] = useState(depth < 2);
  const { activeFile, setActiveFile } = useEditorStore();
  const isActive = node.path === activeFile;

  const getFileIcon = (name: string) => {
    const ext = name.split('.').pop();
    const iconColors: Record<string, string> = {
      tsx: 'text-blue-400',
      ts: 'text-blue-400',
      jsx: 'text-yellow-400',
      js: 'text-yellow-400',
      css: 'text-purple-400',
      html: 'text-orange-400',
      json: 'text-yellow-300',
      md: 'text-gray-400',
    };
    return iconColors[ext || ''] || 'text-gray-400';
  };

  if (node.type === 'directory') {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 w-full px-2 py-1 rounded hover:bg-accent text-left"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isOpen ? (
            <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted-foreground" />
          )}
          {isOpen ? (
            <FolderOpen className="w-4 h-4 shrink-0 text-yellow-500" />
          ) : (
            <Folder className="w-4 h-4 shrink-0 text-yellow-500" />
          )}
          <span className="truncate text-xs">{node.name}</span>
        </button>
        {isOpen && node.children && (
          <div>
            {node.children.map((child) => (
              <TreeNode key={child.path} node={child} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={() => setActiveFile(node.path)}
      className={cn(
        'flex items-center gap-1 w-full px-2 py-1 rounded text-left',
        isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
      )}
      style={{ paddingLeft: `${depth * 12 + 8 + 18}px` }}
    >
      <File className={cn('w-4 h-4 shrink-0', getFileIcon(node.name))} />
      <span className="truncate text-xs">{node.name}</span>
    </button>
  );
}
