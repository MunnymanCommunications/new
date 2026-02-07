import type { ProjectFile } from '@/types';

export function getFileLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase();
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    css: 'css',
    html: 'html',
    json: 'json',
    md: 'markdown',
    sql: 'sql',
    py: 'python',
    env: 'bash',
  };
  return langMap[ext || ''] || 'text';
}

export function buildFileTree(files: ProjectFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const isFile = i === parts.length - 1;
      const existing = current.find((n) => n.name === name);

      if (existing) {
        if (!isFile && existing.children) {
          current = existing.children;
        }
      } else {
        const node: FileTreeNode = {
          name,
          path: parts.slice(0, i + 1).join('/'),
          type: isFile ? 'file' : 'directory',
          children: isFile ? undefined : [],
          language: isFile ? getFileLanguage(file.path) : undefined,
        };
        current.push(node);
        if (!isFile && node.children) {
          current = node.children;
        }
      }
    }
  }

  return sortFileTree(root);
}

function sortFileTree(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes
    .map((node) => ({
      ...node,
      children: node.children ? sortFileTree(node.children) : undefined,
    }))
    .sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1;
      if (a.type === 'file' && b.type === 'directory') return 1;
      return a.name.localeCompare(b.name);
    });
}

export interface FileTreeNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileTreeNode[];
  language?: string;
}

export function generatePreviewHTML(files: ProjectFile[]): string {
  const appFile = files.find((f) => f.path === 'src/App.tsx');
  const cssFile = files.find((f) => f.path === 'src/index.css');

  const appCode = appFile?.content || '';
  const cssCode = cssFile?.content || '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Preview</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script src="https://unpkg.com/react@18/umd/react.production.min.js"><\/script>
  <script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"><\/script>
  <script src="https://unpkg.com/@babel/standalone/babel.min.js"><\/script>
  <style>${cssCode.replace(/@tailwind\s+\w+;/g, '').replace(/@layer\s+base\s*\{[^}]*\}/g, '')}</style>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="text/babel" data-type="module">
    ${transformCode(appCode)}

    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(React.createElement(App));
  <\/script>
  <script>
    // Error handling
    window.onerror = function(msg, url, line, col, error) {
      window.parent.postMessage({
        type: 'preview-error',
        error: { message: msg, line: line, column: col }
      }, '*');
    };

    // Console capture
    const origLog = console.log;
    const origWarn = console.warn;
    const origError = console.error;

    console.log = function(...args) {
      window.parent.postMessage({ type: 'console-log', level: 'log', args: args.map(String) }, '*');
      origLog.apply(console, args);
    };
    console.warn = function(...args) {
      window.parent.postMessage({ type: 'console-log', level: 'warn', args: args.map(String) }, '*');
      origWarn.apply(console, args);
    };
    console.error = function(...args) {
      window.parent.postMessage({ type: 'console-log', level: 'error', args: args.map(String) }, '*');
      origError.apply(console, args);
    };
  <\/script>
</body>
</html>`;
}

function transformCode(code: string): string {
  // Remove import statements (we load via CDN)
  let transformed = code
    .replace(/^import\s+.*?from\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^import\s+['"].*?['"];?\s*$/gm, '')
    .replace(/^export\s+default\s+/gm, 'var App = ')
    .replace(/^export\s+/gm, 'var ');

  // Handle function component declarations
  transformed = transformed.replace(
    /var\s+App\s*=\s*function\s+App/g,
    'function App'
  );

  // If no App assignment, try to detect default function
  if (!transformed.includes('function App') && !transformed.includes('var App')) {
    transformed = transformed.replace(
      /function\s+(\w+)\s*\(/,
      'function App('
    );
  }

  return transformed;
}
