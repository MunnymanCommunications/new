import { create } from 'zustand';
import { generateId } from '@/lib/utils';
import type { Project, ProjectFile, IntegrationStatus } from '@/types';

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
          <button className="px-6 py-3 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium border border-gray-200">
            Learn More
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
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
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
        dependencies: {
          react: '^18.3.1',
          'react-dom': '^18.3.1',
        },
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

interface ProjectState {
  projects: Project[];
  currentProjectId: string | null;
  integrations: IntegrationStatus;

  currentProject: () => Project | null;
  createProject: (name: string, description?: string) => string;
  deleteProject: (id: string) => void;
  setCurrentProject: (id: string) => void;
  updateFile: (projectId: string, path: string, content: string) => void;
  addFile: (projectId: string, file: ProjectFile) => void;
  deleteFile: (projectId: string, path: string) => void;
  getFile: (projectId: string, path: string) => ProjectFile | undefined;

  connectSupabase: (projectId: string, projectName: string) => void;
  disconnectSupabase: () => void;
  connectGitHub: (repoUrl: string, branch?: string) => void;
  disconnectGitHub: () => void;
}

export const useProjectStore = create<ProjectState>((set, get) => {
  const initialProjectId = generateId();

  return {
    projects: [
      {
        id: initialProjectId,
        name: 'My First App',
        description: 'A new project created with VibeCraft',
        createdAt: new Date(),
        updatedAt: new Date(),
        files: DEFAULT_FILES,
        settings: {
          framework: 'react',
          styling: 'tailwind',
          typescript: true,
          supabaseConnected: false,
          githubConnected: false,
          deploymentProvider: null,
        },
        status: 'active',
      },
    ],
    currentProjectId: initialProjectId,
    integrations: {
      supabase: { connected: false },
      github: { connected: false },
      deployment: null,
    },

    currentProject: () => {
      const state = get();
      return state.projects.find((p) => p.id === state.currentProjectId) || null;
    },

    createProject: (name, description = '') => {
      const id = generateId();
      const project: Project = {
        id,
        name,
        description,
        createdAt: new Date(),
        updatedAt: new Date(),
        files: [...DEFAULT_FILES.map((f) => ({ ...f, lastModified: new Date() }))],
        settings: {
          framework: 'react',
          styling: 'tailwind',
          typescript: true,
          supabaseConnected: false,
          githubConnected: false,
          deploymentProvider: null,
        },
        status: 'active',
      };
      set((state) => ({
        projects: [...state.projects, project],
        currentProjectId: id,
      }));
      return id;
    },

    deleteProject: (id) => {
      set((state) => ({
        projects: state.projects.filter((p) => p.id !== id),
        currentProjectId: state.currentProjectId === id ? state.projects[0]?.id || null : state.currentProjectId,
      }));
    },

    setCurrentProject: (id) => {
      set({ currentProjectId: id });
    },

    updateFile: (projectId, path, content) => {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                updatedAt: new Date(),
                files: p.files.map((f) =>
                  f.path === path ? { ...f, content, lastModified: new Date() } : f
                ),
              }
            : p
        ),
      }));
    },

    addFile: (projectId, file) => {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                updatedAt: new Date(),
                files: [...p.files.filter((f) => f.path !== file.path), file],
              }
            : p
        ),
      }));
    },

    deleteFile: (projectId, path) => {
      set((state) => ({
        projects: state.projects.map((p) =>
          p.id === projectId
            ? {
                ...p,
                updatedAt: new Date(),
                files: p.files.filter((f) => f.path !== path),
              }
            : p
        ),
      }));
    },

    getFile: (projectId, path) => {
      const project = get().projects.find((p) => p.id === projectId);
      return project?.files.find((f) => f.path === path);
    },

    connectSupabase: (projectId, projectName) => {
      set((state) => ({
        integrations: {
          ...state.integrations,
          supabase: { connected: true, projectId, projectName },
        },
      }));
    },

    disconnectSupabase: () => {
      set((state) => ({
        integrations: {
          ...state.integrations,
          supabase: { connected: false },
        },
      }));
    },

    connectGitHub: (repoUrl, branch = 'main') => {
      set((state) => ({
        integrations: {
          ...state.integrations,
          github: { connected: true, repoUrl, branch, lastSync: new Date() },
        },
      }));
    },

    disconnectGitHub: () => {
      set((state) => ({
        integrations: {
          ...state.integrations,
          github: { connected: false },
        },
      }));
    },
  };
});
