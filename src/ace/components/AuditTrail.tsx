// =============================================================================
// Audit Trail - Shows the complete log of all agent actions and computations
// =============================================================================

import type { AuditEntry } from '../types';

interface AuditTrailProps {
  entries: AuditEntry[];
}

const AGENT_COLORS: Record<string, string> = {
  segmenter: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  vision_ocr: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  architect: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  clarification: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  estimator: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  computation_engine: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export function AuditTrail({ entries }: AuditTrailProps) {
  if (entries.length === 0) return null;

  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color">
      <div className="p-4 border-b border-border-color dark:border-dark-border-color">
        <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
          Audit Trail ({entries.length} entries)
        </h3>
        <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
          Complete log of all agent actions and computation steps
        </p>
      </div>

      <div className="max-h-96 overflow-y-auto">
        <div className="divide-y divide-border-color/50 dark:divide-dark-border-color/50">
          {entries.map((entry, idx) => (
            <div key={entry.id || idx} className="p-3 hover:bg-gray-50 dark:hover:bg-dark-base-light">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 mt-0.5">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${AGENT_COLORS[entry.agent] || AGENT_COLORS.computation_engine}`}>
                    {entry.agent}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-text-tertiary dark:text-dark-text-tertiary">
                      {new Date(entry.timestamp).toLocaleTimeString()}
                    </span>
                    <span className="text-xs font-medium text-text-secondary dark:text-dark-text-secondary">
                      {entry.action}
                    </span>
                    {entry.page_number && (
                      <span className="text-xs text-text-tertiary dark:text-dark-text-tertiary">
                        (Page {entry.page_number})
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary dark:text-dark-text-primary mt-0.5">
                    {entry.details}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
