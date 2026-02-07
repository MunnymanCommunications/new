import React from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useProjectStore } from '@/stores/project';
import { useEditorStore } from '@/stores/editor';
import { getFileLanguage } from '@/lib/file-system';

export function CodeEditor() {
  const { currentProjectId, projects } = useProjectStore();
  const { activeFile } = useEditorStore();
  const [copied, setCopied] = React.useState(false);

  const currentProject = projects.find((p) => p.id === currentProjectId);
  const file = currentProject?.files.find((f) => f.path === activeFile);

  if (!file) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
        Select a file to view its contents
      </div>
    );
  }

  const language = getFileLanguage(file.path);

  const copyCode = () => {
    navigator.clipboard.writeText(file.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{file.path}</span>
        </div>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copyCode}>
          {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <SyntaxHighlighter
          language={language}
          style={oneDark}
          showLineNumbers
          customStyle={{
            margin: 0,
            borderRadius: 0,
            fontSize: '0.8125rem',
            minHeight: '100%',
            background: 'transparent',
          }}
          lineNumberStyle={{
            minWidth: '3em',
            paddingRight: '1em',
            color: 'hsl(var(--muted-foreground) / 0.3)',
          }}
        >
          {file.content}
        </SyntaxHighlighter>
      </ScrollArea>
    </div>
  );
}
