// =============================================================================
// Processing Pipeline - Shows real-time progress of the multi-agent pipeline
// =============================================================================

import type { PipelineState, ProjectStatus } from '../types';

interface ProcessingPipelineProps {
  state: PipelineState;
  onAbort: () => void;
}

const PHASE_CONFIG: Record<ProjectStatus, { label: string; icon: string; step: number }> = {
  uploading: { label: 'Processing PDF', icon: '1', step: 1 },
  segmenting: { label: 'Classifying Pages', icon: '2', step: 2 },
  analyzing: { label: 'Extracting Elements', icon: '3', step: 3 },
  building_twin: { label: 'Building Digital Twin', icon: '4', step: 4 },
  awaiting_verification: { label: 'Resolving Ambiguities', icon: '5', step: 5 },
  computing_materials: { label: 'Computing Materials', icon: '6', step: 6 },
  verification_check: { label: 'Final Verification', icon: '7', step: 7 },
  complete: { label: 'Complete', icon: '\u2713', step: 8 },
  error: { label: 'Error', icon: '!', step: -1 },
};

const ALL_PHASES: ProjectStatus[] = [
  'uploading', 'segmenting', 'analyzing', 'building_twin',
  'awaiting_verification', 'computing_materials', 'verification_check', 'complete',
];

export function ProcessingPipeline({ state, onAbort }: ProcessingPipelineProps) {
  const currentConfig = PHASE_CONFIG[state.currentPhase];
  const currentStep = currentConfig.step;

  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color p-6">
      {/* Phase Steps */}
      <div className="flex items-center justify-between mb-6 overflow-x-auto pb-2">
        {ALL_PHASES.map((phase, idx) => {
          const config = PHASE_CONFIG[phase];
          const isActive = phase === state.currentPhase;
          const isComplete = config.step < currentStep;
          const isError = state.currentPhase === 'error';

          return (
            <div key={phase} className="flex items-center">
              <div className="flex flex-col items-center min-w-[80px]">
                <div className={`
                  w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  transition-all duration-300
                  ${isComplete ? 'bg-green-500 text-white' : ''}
                  ${isActive && !isError ? 'bg-blue-500 text-white ring-4 ring-blue-200 dark:ring-blue-800' : ''}
                  ${isActive && isError ? 'bg-red-500 text-white ring-4 ring-red-200' : ''}
                  ${!isActive && !isComplete ? 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400' : ''}
                `}>
                  {isComplete ? '\u2713' : config.icon}
                </div>
                <span className={`text-xs mt-1 text-center leading-tight
                  ${isActive ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-text-tertiary dark:text-dark-text-tertiary'}
                `}>
                  {config.label}
                </span>
              </div>
              {idx < ALL_PHASES.length - 1 && (
                <div className={`w-8 h-0.5 mx-1 mt-[-16px]
                  ${isComplete ? 'bg-green-500' : 'bg-gray-200 dark:bg-gray-700'}
                `} />
              )}
            </div>
          );
        })}
      </div>

      {/* Progress bar */}
      {state.currentPhase !== 'complete' && state.currentPhase !== 'error' && (
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-text-secondary dark:text-dark-text-secondary">
              {currentConfig.label}
              {state.currentAgent && ` (${state.currentAgent} agent)`}
            </span>
            <span className="text-text-secondary dark:text-dark-text-secondary">{state.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Messages log */}
      <div className="max-h-48 overflow-y-auto space-y-1 bg-gray-50 dark:bg-dark-base-light rounded-lg p-3">
        {state.messages.slice(-20).map((msg, idx) => (
          <div key={idx} className="flex items-start gap-2 text-sm">
            <span className="flex-shrink-0 mt-0.5">
              {msg.level === 'error' && <span className="text-red-500">&#9679;</span>}
              {msg.level === 'warning' && <span className="text-yellow-500">&#9679;</span>}
              {msg.level === 'success' && <span className="text-green-500">&#9679;</span>}
              {msg.level === 'info' && <span className="text-blue-500">&#9679;</span>}
            </span>
            <span className="text-text-secondary dark:text-dark-text-secondary">
              {msg.agent && <span className="text-text-tertiary dark:text-dark-text-tertiary">[{msg.agent}] </span>}
              {msg.message}
            </span>
          </div>
        ))}
        {state.messages.length === 0 && (
          <p className="text-text-tertiary dark:text-dark-text-tertiary text-sm">Waiting to start...</p>
        )}
      </div>

      {/* Abort button */}
      {state.currentPhase !== 'complete' && state.currentPhase !== 'error' && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={onAbort}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            Cancel Analysis
          </button>
        </div>
      )}
    </div>
  );
}
