// =============================================================================
// Measurement Editor - Human-in-the-loop verification of Digital Twin values
// Allows contractor to review and correct extracted measurements
// =============================================================================

import { useState, useCallback } from 'react';
import type { DigitalTwin } from '../types';

interface MeasurementEditorProps {
  twin: DigitalTwin;
  onUpdate: (noteId: string, elementType: string, elementId: string, field: string, original: string, corrected: string) => void;
  onRecompute: () => void;
}

interface EditingCell {
  elementType: string;
  elementId: string;
  field: string;
  original: string;
}

export function MeasurementEditor({ twin, onUpdate, onRecompute }: MeasurementEditorProps) {
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editValue, setEditValue] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const startEdit = useCallback((elementType: string, elementId: string, field: string, currentValue: string) => {
    setEditing({ elementType, elementId, field, original: currentValue });
    setEditValue(currentValue);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editing) return;
    if (editValue !== editing.original) {
      const noteId = `vn-${Date.now()}`;
      onUpdate(noteId, editing.elementType, editing.elementId, editing.field, editing.original, editValue);
      setHasChanges(true);
    }
    setEditing(null);
  }, [editing, editValue, onUpdate]);

  const cancelEdit = useCallback(() => {
    setEditing(null);
  }, []);

  const handleRecompute = useCallback(() => {
    onRecompute();
    setHasChanges(false);
  }, [onRecompute]);

  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color">
      <div className="p-4 border-b border-border-color dark:border-dark-border-color flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
            Verify & Edit Measurements
          </h3>
          <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
            Click any value to edit. Changes will be applied when you recompute materials.
          </p>
        </div>
        {hasChanges && (
          <button
            onClick={handleRecompute}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Recompute Materials
          </button>
        )}
      </div>

      {/* Verification notes */}
      {twin.verification_notes.length > 0 && (
        <div className="px-4 pt-3">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
            <p className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-1">
              {twin.verification_notes.length} correction(s) made
            </p>
            {twin.verification_notes.slice(-5).map(note => (
              <p key={note.id} className="text-xs text-blue-600 dark:text-blue-400">
                {note.element_type} {note.element_id}: {note.field} changed from {note.original_value} to {note.corrected_value}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Walls Table */}
      <div className="p-4">
        <h4 className="font-medium text-text-primary dark:text-dark-text-primary mb-2">Walls</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary dark:text-dark-text-tertiary border-b border-border-color dark:border-dark-border-color">
                <th className="pb-2 pr-4">ID</th>
                <th className="pb-2 pr-4">Length (ft)</th>
                <th className="pb-2 pr-4">Height (ft)</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Exterior</th>
                <th className="pb-2">Load Bearing</th>
              </tr>
            </thead>
            <tbody>
              {twin.building.floors.flatMap(f => f.walls).map(wall => (
                <tr key={wall.id} className="border-b border-border-color/50 dark:border-dark-border-color/50">
                  <td className="py-2 pr-4 text-text-tertiary dark:text-dark-text-tertiary font-mono text-xs">
                    {wall.id}
                  </td>
                  <EditableCell
                    elementType="wall"
                    elementId={wall.id}
                    field="length_ft"
                    value={String(wall.length_ft)}
                    editing={editing}
                    editValue={editValue}
                    onStartEdit={startEdit}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onEditValueChange={setEditValue}
                  />
                  <EditableCell
                    elementType="wall"
                    elementId={wall.id}
                    field="height_ft"
                    value={String(wall.height_ft)}
                    editing={editing}
                    editValue={editValue}
                    onStartEdit={startEdit}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onEditValueChange={setEditValue}
                  />
                  <td className="py-2 pr-4">{wall.wall_type}</td>
                  <td className="py-2 pr-4">{wall.is_exterior ? 'Yes' : 'No'}</td>
                  <td className="py-2">{wall.is_load_bearing === null ? '?' : wall.is_load_bearing ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rooms Table */}
      <div className="p-4 border-t border-border-color dark:border-dark-border-color">
        <h4 className="font-medium text-text-primary dark:text-dark-text-primary mb-2">Rooms</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-text-tertiary dark:text-dark-text-tertiary border-b border-border-color dark:border-dark-border-color">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Type</th>
                <th className="pb-2 pr-4">Area (sqft)</th>
                <th className="pb-2 pr-4">Perimeter (ft)</th>
                <th className="pb-2 pr-4">Height (ft)</th>
                <th className="pb-2">Floor</th>
              </tr>
            </thead>
            <tbody>
              {twin.building.floors.flatMap(f => f.rooms).map(room => (
                <tr key={room.id} className="border-b border-border-color/50 dark:border-dark-border-color/50">
                  <td className="py-2 pr-4 font-medium text-text-primary dark:text-dark-text-primary">{room.name}</td>
                  <td className="py-2 pr-4 text-text-secondary dark:text-dark-text-secondary">{room.room_type}</td>
                  <EditableCell
                    elementType="room"
                    elementId={room.id}
                    field="area_sqft"
                    value={String(room.area_sqft.toFixed(2))}
                    editing={editing}
                    editValue={editValue}
                    onStartEdit={startEdit}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onEditValueChange={setEditValue}
                  />
                  <EditableCell
                    elementType="room"
                    elementId={room.id}
                    field="perimeter_ft"
                    value={String(room.perimeter_ft.toFixed(2))}
                    editing={editing}
                    editValue={editValue}
                    onStartEdit={startEdit}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onEditValueChange={setEditValue}
                  />
                  <EditableCell
                    elementType="room"
                    elementId={room.id}
                    field="ceiling_height_ft"
                    value={String(room.ceiling_height_ft)}
                    editing={editing}
                    editValue={editValue}
                    onStartEdit={startEdit}
                    onSave={saveEdit}
                    onCancel={cancelEdit}
                    onEditValueChange={setEditValue}
                  />
                  <td className="py-2">{room.floor_material}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EditableCell({
  elementType,
  elementId,
  field,
  value,
  editing,
  editValue,
  onStartEdit,
  onSave,
  onCancel,
  onEditValueChange,
}: {
  elementType: string;
  elementId: string;
  field: string;
  value: string;
  editing: EditingCell | null;
  editValue: string;
  onStartEdit: (type: string, id: string, field: string, value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onEditValueChange: (v: string) => void;
}) {
  const isEditing = editing?.elementId === elementId && editing?.field === field;

  if (isEditing) {
    return (
      <td className="py-2 pr-4">
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={editValue}
            onChange={e => onEditValueChange(e.target.value)}
            className="w-24 px-2 py-1 text-sm border border-blue-400 rounded bg-white dark:bg-dark-base-light
              text-text-primary dark:text-dark-text-primary focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Enter') onSave();
              if (e.key === 'Escape') onCancel();
            }}
          />
          <button onClick={onSave} className="text-green-500 hover:text-green-600 text-xs font-bold">
            &#10003;
          </button>
          <button onClick={onCancel} className="text-red-500 hover:text-red-600 text-xs font-bold">
            &#10005;
          </button>
        </div>
      </td>
    );
  }

  return (
    <td
      className="py-2 pr-4 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors text-text-primary dark:text-dark-text-primary"
      onClick={() => onStartEdit(elementType, elementId, field, value)}
      title="Click to edit"
    >
      {value}
    </td>
  );
}
