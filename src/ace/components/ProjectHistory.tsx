// =============================================================================
// Project History - List, resume, and delete saved estimator projects
// =============================================================================

import { useEffect } from 'react';
import type { ACEProject } from '../types';

interface ProjectHistoryProps {
  projects: ACEProject[];
  isLoading: boolean;
  onLoad: () => Promise<void>;
  onSelect: (project: ACEProject) => void;
  onDelete: (projectId: string) => Promise<void>;
}

export function ProjectHistory({ projects, isLoading, onLoad, onSelect, onDelete }: ProjectHistoryProps) {
  useEffect(() => {
    onLoad();
  }, [onLoad]);

  if (isLoading) {
    return (
      <div className="text-center py-6 text-text-secondary dark:text-dark-text-secondary text-sm">
        Loading saved projects...
      </div>
    );
  }

  if (projects.length === 0) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color">
      <div className="p-4 border-b border-border-color dark:border-dark-border-color">
        <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
          Previous Projects
        </h3>
        <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
          Resume a saved estimation or start fresh above
        </p>
      </div>

      <div className="divide-y divide-border-color dark:divide-dark-border-color">
        {projects.map(project => (
          <ProjectRow
            key={project.id}
            project={project}
            onSelect={() => onSelect(project)}
            onDelete={() => onDelete(project.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  onSelect,
  onDelete,
}: {
  project: ACEProject;
  onSelect: () => void;
  onDelete: () => void;
}) {
  const totalRooms = project.digital_twin?.building.floors.reduce((s, f) => s + f.rooms.length, 0) || 0;
  const totalSqft = project.digital_twin?.building.total_sqft || 0;
  const materialCount = project.material_list?.categories.reduce(
    (sum, c) => sum + c.subcategories.reduce((s, sc) => s + sc.items.length, 0), 0
  ) || 0;

  const statusColors: Record<string, string> = {
    complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    error: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    awaiting_verification: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  };

  return (
    <div className="p-4 hover:bg-gray-50 dark:hover:bg-dark-base-light transition-colors">
      <div className="flex items-center justify-between">
        <button onClick={onSelect} className="flex-1 text-left">
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-text-primary dark:text-dark-text-primary">
                  {project.name}
                </p>
                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${statusColors[project.status] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
                  {project.status.replace(/_/g, ' ')}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-text-tertiary dark:text-dark-text-tertiary">
                <span>{new Date(project.updated_at).toLocaleDateString()} at {new Date(project.updated_at).toLocaleTimeString()}</span>
                {totalSqft > 0 && <span>{totalSqft.toLocaleString()} sqft</span>}
                {totalRooms > 0 && <span>{totalRooms} rooms</span>}
                {materialCount > 0 && <span>{materialCount} materials</span>}
              </div>
            </div>
          </div>
        </button>

        <div className="flex items-center gap-2 ml-4">
          <button
            onClick={onSelect}
            className="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
          >
            Open
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (window.confirm(`Delete "${project.name}"? This cannot be undone.`)) {
                onDelete();
              }
            }}
            className="px-3 py-1.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
