import React, { useState } from 'react';
import {
  Type,
  Palette,
  BoxSelect,
  AlignLeft,
  Undo2,
  Redo2,
  Save,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useEditorStore } from '@/stores/editor';
import { cn } from '@/lib/utils';

interface PropertyGroup {
  label: string;
  icon: React.ElementType;
  properties: PropertyItem[];
}

interface PropertyItem {
  name: string;
  type: 'text' | 'color' | 'number' | 'select';
  value: string;
  options?: string[];
}

const MOCK_PROPERTIES: PropertyGroup[] = [
  {
    label: 'Typography',
    icon: Type,
    properties: [
      { name: 'Font Size', type: 'number', value: '16' },
      { name: 'Font Weight', type: 'select', value: 'normal', options: ['light', 'normal', 'medium', 'semibold', 'bold'] },
      { name: 'Color', type: 'color', value: '#ffffff' },
      { name: 'Text Align', type: 'select', value: 'left', options: ['left', 'center', 'right'] },
    ],
  },
  {
    label: 'Colors',
    icon: Palette,
    properties: [
      { name: 'Background', type: 'color', value: '#1e293b' },
      { name: 'Border Color', type: 'color', value: '#334155' },
    ],
  },
  {
    label: 'Layout',
    icon: BoxSelect,
    properties: [
      { name: 'Padding', type: 'number', value: '16' },
      { name: 'Margin', type: 'number', value: '0' },
      { name: 'Border Radius', type: 'number', value: '8' },
    ],
  },
  {
    label: 'Spacing',
    icon: AlignLeft,
    properties: [
      { name: 'Gap', type: 'number', value: '8' },
      { name: 'Width', type: 'text', value: 'auto' },
      { name: 'Height', type: 'text', value: 'auto' },
    ],
  },
];

export function VisualEditor() {
  const { selectedElement, setVisualEditMode, inspectorOpen, toggleInspector } = useEditorStore();
  const [properties, setProperties] = useState(MOCK_PROPERTIES);

  const updateProperty = (groupIndex: number, propIndex: number, value: string) => {
    setProperties((prev) =>
      prev.map((group, gi) =>
        gi === groupIndex
          ? {
              ...group,
              properties: group.properties.map((prop, pi) =>
                pi === propIndex ? { ...prop, value } : prop
              ),
            }
          : group
      )
    );
  };

  return (
    <div className="w-72 border-l border-border bg-background flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-sm font-semibold">Visual Editor</span>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Undo2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6">
            <Redo2 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setVisualEditMode(false)}>
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Element info */}
      <div className="px-3 py-2 border-b border-border bg-secondary/30">
        <div className="text-xs text-muted-foreground">Selected Element</div>
        <div className="text-sm font-mono mt-0.5">
          {selectedElement || '<div className="...">'}
        </div>
      </div>

      {/* Properties */}
      <div className="flex-1 overflow-y-auto">
        {properties.map((group, gi) => (
          <div key={group.label} className="border-b border-border">
            <div className="flex items-center gap-2 px-3 py-2">
              <group.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs font-medium">{group.label}</span>
            </div>
            <div className="px-3 pb-3 space-y-2">
              {group.properties.map((prop, pi) => (
                <div key={prop.name} className="flex items-center gap-2">
                  <label className="text-[11px] text-muted-foreground w-20 shrink-0">
                    {prop.name}
                  </label>
                  {prop.type === 'color' ? (
                    <div className="flex items-center gap-1.5 flex-1">
                      <input
                        type="color"
                        value={prop.value}
                        onChange={(e) => updateProperty(gi, pi, e.target.value)}
                        className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                      />
                      <input
                        type="text"
                        value={prop.value}
                        onChange={(e) => updateProperty(gi, pi, e.target.value)}
                        className="flex-1 h-6 text-xs font-mono bg-secondary/50 border border-border rounded px-1.5"
                      />
                    </div>
                  ) : prop.type === 'select' ? (
                    <select
                      value={prop.value}
                      onChange={(e) => updateProperty(gi, pi, e.target.value)}
                      className="flex-1 h-6 text-xs bg-secondary/50 border border-border rounded px-1.5"
                    >
                      {prop.options?.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : prop.type === 'number' ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={prop.value}
                        onChange={(e) => updateProperty(gi, pi, e.target.value)}
                        className="flex-1 h-1 accent-primary"
                      />
                      <input
                        type="number"
                        value={prop.value}
                        onChange={(e) => updateProperty(gi, pi, e.target.value)}
                        className="w-12 h-6 text-xs text-center font-mono bg-secondary/50 border border-border rounded"
                      />
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={prop.value}
                      onChange={(e) => updateProperty(gi, pi, e.target.value)}
                      className="flex-1 h-6 text-xs font-mono bg-secondary/50 border border-border rounded px-1.5"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Save button */}
      <div className="p-3 border-t border-border">
        <Button className="w-full gap-2" size="sm">
          <Save className="w-3.5 h-3.5" />
          Save Changes
        </Button>
      </div>
    </div>
  );
}
