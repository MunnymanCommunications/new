import { create } from 'zustand';
import type { DeviceType, DevicePreset, EditorState } from '@/types';

interface EditorStoreState extends EditorState {
  device: DeviceType;
  devicePresets: DevicePreset[];
  showConsole: boolean;
  consoleLogs: ConsoleLog[];
  fileTreeOpen: boolean;
  activeFile: string | null;

  setSelectedElement: (id: string | null) => void;
  setHoveredElement: (id: string | null) => void;
  toggleVisualEditMode: () => void;
  setVisualEditMode: (enabled: boolean) => void;
  toggleInspector: () => void;
  setDevice: (device: DeviceType) => void;
  toggleConsole: () => void;
  addConsoleLog: (log: ConsoleLog) => void;
  clearConsoleLogs: () => void;
  toggleFileTree: () => void;
  setActiveFile: (path: string | null) => void;
}

export interface ConsoleLog {
  id: string;
  type: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: Date;
}

const DEVICE_PRESETS: DevicePreset[] = [
  { name: 'iPhone SE', type: 'mobile', width: 375, height: 667 },
  { name: 'iPhone 14', type: 'mobile', width: 390, height: 844 },
  { name: 'iPad', type: 'tablet', width: 768, height: 1024 },
  { name: 'iPad Pro', type: 'tablet', width: 1024, height: 1366 },
  { name: 'Laptop', type: 'desktop', width: 1440, height: 900 },
  { name: 'Desktop', type: 'desktop', width: 1920, height: 1080 },
];

export const useEditorStore = create<EditorStoreState>((set) => ({
  selectedElement: null,
  hoveredElement: null,
  isVisualEditMode: false,
  inspectorOpen: false,
  device: 'desktop',
  devicePresets: DEVICE_PRESETS,
  showConsole: false,
  consoleLogs: [],
  fileTreeOpen: false,
  activeFile: 'src/App.tsx',

  setSelectedElement: (id) => set({ selectedElement: id }),
  setHoveredElement: (id) => set({ hoveredElement: id }),

  toggleVisualEditMode: () =>
    set((state) => ({ isVisualEditMode: !state.isVisualEditMode })),

  setVisualEditMode: (enabled) => set({ isVisualEditMode: enabled }),

  toggleInspector: () =>
    set((state) => ({ inspectorOpen: !state.inspectorOpen })),

  setDevice: (device) => set({ device }),

  toggleConsole: () =>
    set((state) => ({ showConsole: !state.showConsole })),

  addConsoleLog: (log) =>
    set((state) => ({
      consoleLogs: [...state.consoleLogs.slice(-99), log],
    })),

  clearConsoleLogs: () => set({ consoleLogs: [] }),

  toggleFileTree: () =>
    set((state) => ({ fileTreeOpen: !state.fileTreeOpen })),

  setActiveFile: (path) => set({ activeFile: path }),
}));
