import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import type { ProjectFile } from '@/types';

interface ProjectRow {
  id: string;
  name: string;
  description: string;
  supabase_schema: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface ProjectState {
  projects: ProjectRow[];
  currentProjectId: string | null;
  files: ProjectFile[];
  loading: boolean;

  currentProject: () => ProjectRow | null;
  loadProjects: () => Promise<void>;
  createProject: (name: string, description?: string) => Promise<string | null>;
  deleteProject: (id: string) => Promise<void>;
  setCurrentProject: (id: string) => Promise<void>;
  loadFilesFromDB: (projectId: string) => Promise<void>;
  saveFileToDB: (projectId: string, file: ProjectFile) => Promise<void>;
  updateFile: (projectId: string, path: string, content: string) => void;
  addFile: (projectId: string, file: ProjectFile) => void;
  deleteFile: (projectId: string, path: string) => void;
  getFile: (projectId: string, path: string) => ProjectFile | undefined;
}

const DEFAULT_FILES: ProjectFile[] = [
  {
    path: 'src/App.tsx',
    content: `import React from 'react';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
      <div className="text-center space-y-6 p-8">
        <h1 className="text-5xl font-bold text-gray-900">
          Welcome to Your App
        </h1>
        <p className="text-xl text-gray-600 max-w-md mx-auto">
          Start building by describing what you want in the chat panel.
        </p>
        <div className="flex gap-4 justify-center">
          <button className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium">
            Get Started
          </button>
        </div>
      </div>
    </div>
  );
}`,
    language: 'typescript',
    lastModified: new Date(),
  },
  {
    path: 'src/main.tsx',
    content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,
    language: 'typescript',
    lastModified: new Date(),
  },
  {
    path: 'src/index.css',
    content: `@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
  -webkit-font-smoothing: antialiased;
}`,
    language: 'css',
    lastModified: new Date(),
  },
  {
    path: 'package.json',
    content: JSON.stringify(
      {
        name: 'my-app',
        private: true,
        version: '0.1.0',
        type: 'module',
        dependencies: { react: '^18.3.1', 'react-dom': '^18.3.1' },
        devDependencies: {
          '@vitejs/plugin-react': '^4.3.4',
          tailwindcss: '^3.4.16',
          typescript: '^5.6.3',
          vite: '^6.0.3',
        },
      },
      null,
      2
    ),
    language: 'json',
    lastModified: new Date(),
  },
];

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProjectId: null,
  files: [],
  loading: false,

  currentProject: () => {
    const state = get();
    return state.projects.find((p) => p.id === state.currentProjectId) || null;
  },

  loadProjects: async () => {
    set({ loading: true });
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false });

    if (!error && data) {
      set({ projects: data as ProjectRow[], loading: false });
      if (data.length > 0 && !get().currentProjectId) {
        await get().setCurrentProject(data[0].id);
      }
    } else {
      set({ loading: false });
    }
  },

  createProject: async (name, description = '') => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return null;

    const { data, error } = await supabase
      .from('projects')
      .insert({
        name,
        description,
        user_id: userData.user.id,
        status: 'active',
      })
      .select()
      .single();

    if (error || !data) return null;

    const project = data as ProjectRow;

    // Save default files
    const fileRows = DEFAULT_FILES.map((f) => ({
      project_id: project.id,
      path: f.path,
      content: f.content,
      language: f.language,
    }));

    await supabase.from('project_files').insert(fileRows);

    set((state) => ({
      projects: [project, ...state.projects],
      currentProjectId: project.id,
      files: [...DEFAULT_FILES],
    }));

    return project.id;
  },

  deleteProject: async (id) => {
    await supabase.from('projects').delete().eq('id', id);
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
      currentProjectId:
        state.currentProjectId === id
          ? state.projects.find((p) => p.id !== id)?.id || null
          : state.currentProjectId,
      files: state.currentProjectId === id ? [] : state.files,
    }));
  },

  setCurrentProject: async (id) => {
    set({ currentProjectId: id });
    await get().loadFilesFromDB(id);
  },

  loadFilesFromDB: async (projectId) => {
    const { data, error } = await supabase
      .from('project_files')
      .select('*')
      .eq('project_id', projectId);

    if (!error && data) {
      const files: ProjectFile[] = data.map((row: Record<string, unknown>) => ({
        path: row.path as string,
        content: row.content as string,
        language: row.language as string,
        lastModified: new Date(row.updated_at as string),
      }));
      set({ files });
    }
  },

  saveFileToDB: async (projectId, file) => {
    await supabase.from('project_files').upsert(
      {
        project_id: projectId,
        path: file.path,
        content: file.content,
        language: file.language,
      },
      { onConflict: 'project_id,path' }
    );
  },

  updateFile: (projectId, path, content) => {
    set((state) => ({
      files: state.files.map((f) =>
        f.path === path ? { ...f, content, lastModified: new Date() } : f
      ),
    }));
    // Persist in background
    const file = get().files.find((f) => f.path === path);
    if (file) {
      get().saveFileToDB(projectId, { ...file, content });
    }
  },

  addFile: (projectId, file) => {
    set((state) => ({
      files: [...state.files.filter((f) => f.path !== file.path), file],
    }));
    get().saveFileToDB(projectId, file);
  },

  deleteFile: (projectId, path) => {
    set((state) => ({
      files: state.files.filter((f) => f.path !== path),
    }));
    supabase
      .from('project_files')
      .delete()
      .eq('project_id', projectId)
      .eq('path', path)
      .then(() => {});
  },

  getFile: (_projectId, path) => {
    return get().files.find((f) => f.path === path);
  },
}));
