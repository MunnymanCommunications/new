// =============================================================================
// Clarification Panel - Shows Level 1 (AI-resolved) and Level 2 (contractor) questions
// =============================================================================

import { useState, useCallback } from 'react';
import type { Clarification } from '../types';

interface ClarificationPanelProps {
  clarifications: Clarification[];
  onAnswer: (clarificationId: string, answer: string) => void;
}

export function ClarificationPanel({ clarifications, onAnswer }: ClarificationPanelProps) {
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const l1Resolved = clarifications.filter(c => c.status === 'ai_resolved');
  const l2Pending = clarifications.filter(c => c.status === 'awaiting_contractor');
  const l2Resolved = clarifications.filter(c => c.status === 'resolved' && c.contractor_answer);

  const handleSubmit = useCallback((id: string) => {
    const answer = answers[id];
    if (answer?.trim()) {
      onAnswer(id, answer.trim());
      setAnswers(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  }, [answers, onAnswer]);

  if (clarifications.length === 0) return null;

  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color">
      <div className="p-4 border-b border-border-color dark:border-dark-border-color">
        <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
          Clarifications ({clarifications.length})
        </h3>
        <div className="flex gap-4 mt-1 text-sm">
          <span className="text-green-600">{l1Resolved.length} AI-resolved</span>
          <span className="text-yellow-600">{l2Pending.length} need your input</span>
          <span className="text-blue-600">{l2Resolved.length} contractor-resolved</span>
        </div>
      </div>

      <div className="divide-y divide-border-color dark:divide-dark-border-color">
        {/* Level 2 pending - need contractor input (shown first) */}
        {l2Pending.map(c => (
          <div key={c.id} className="p-4 bg-yellow-50/50 dark:bg-yellow-900/10">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-yellow-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                L2
              </span>
              <div className="flex-1">
                <p className="font-medium text-text-primary dark:text-dark-text-primary text-sm">
                  {c.question}
                </p>
                <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary mt-1">
                  Page {c.page_number} {c.context.description && `- ${c.context.description}`}
                </p>
                {c.ai_answer && (
                  <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-2">
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">AI suggestion (low confidence):</p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">{c.ai_answer}</p>
                  </div>
                )}

                {/* Contractor input */}
                <div className="mt-3 flex gap-2">
                  <input
                    type="text"
                    placeholder="Enter your answer..."
                    value={answers[c.id] || ''}
                    onChange={e => setAnswers(prev => ({ ...prev, [c.id]: e.target.value }))}
                    className="flex-1 px-3 py-2 text-sm border border-border-color dark:border-dark-border-color rounded-lg
                      bg-white dark:bg-dark-base-light text-text-primary dark:text-dark-text-primary
                      focus:outline-none focus:ring-2 focus:ring-blue-500"
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleSubmit(c.id);
                    }}
                  />
                  <button
                    onClick={() => handleSubmit(c.id)}
                    disabled={!answers[c.id]?.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg
                      transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Submit
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Level 1 resolved by AI */}
        {l1Resolved.map(c => (
          <div key={c.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                L1
              </span>
              <div className="flex-1">
                <p className="font-medium text-text-primary dark:text-dark-text-primary text-sm">
                  {c.question}
                </p>
                <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary mt-1">
                  Page {c.page_number}
                </p>
                {c.ai_answer && (
                  <div className="mt-2 bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                    <p className="text-xs text-green-700 dark:text-green-300 font-medium">AI resolved:</p>
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">{c.ai_answer}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}

        {/* Level 2 resolved by contractor */}
        {l2Resolved.map(c => (
          <div key={c.id} className="p-4">
            <div className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">
                &#10003;
              </span>
              <div className="flex-1">
                <p className="font-medium text-text-primary dark:text-dark-text-primary text-sm">
                  {c.question}
                </p>
                <div className="mt-2 bg-gray-50 dark:bg-dark-base-light rounded-lg p-2">
                  <p className="text-xs text-text-secondary dark:text-dark-text-secondary font-medium">Contractor answer:</p>
                  <p className="text-xs text-text-primary dark:text-dark-text-primary mt-1">{c.contractor_answer}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
