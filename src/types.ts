export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  files: ProjectFile[];
  settings: ProjectSettings;
  status: 'active' | 'archived' | 'deploying';
}

export interface ProjectFile {
  path: string;
  content: string;
  language: string;
  lastModified: Date;
}

export interface ProjectSettings {
  framework: 'react' | 'next' | 'vue';
  styling: 'tailwind' | 'css-modules' | 'styled-components';
  typescript: boolean;
  supabaseConnected: boolean;
  githubConnected: boolean;
  deploymentProvider: 'vercel' | 'netlify' | null;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  mode: 'build' | 'chat';
  creditCost?: number;
  filesChanged?: FileChange[];
  isStreaming?: boolean;
  thinkingContent?: string;
}

export interface FileChange {
  path: string;
  action: 'create' | 'modify' | 'delete';
  diff?: string;
}

export interface CreditInfo {
  remaining: number;
  total: number;
  plan: 'free' | 'pro' | 'business';
  resetDate: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  credits: CreditInfo;
  plan: 'free' | 'pro' | 'business';
}

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DevicePreset {
  name: string;
  type: DeviceType;
  width: number;
  height: number;
}

export interface EditorState {
  selectedElement: string | null;
  hoveredElement: string | null;
  isVisualEditMode: boolean;
  inspectorOpen: boolean;
}

export interface DeploymentConfig {
  provider: 'vercel' | 'netlify' | 'custom';
  customDomain?: string;
  envVars: Record<string, string>;
  buildCommand: string;
  outputDirectory: string;
  status: 'idle' | 'building' | 'deploying' | 'live' | 'error';
  url?: string;
}

export interface IntegrationStatus {
  supabase: {
    connected: boolean;
    projectId?: string;
    projectName?: string;
  };
  github: {
    connected: boolean;
    repoUrl?: string;
    branch?: string;
    lastSync?: Date;
  };
  deployment: DeploymentConfig | null;
}
