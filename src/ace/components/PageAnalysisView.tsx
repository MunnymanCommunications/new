// =============================================================================
// Page Analysis View - Shows extracted pages with their classification & data
// =============================================================================

import { useState } from 'react';
import type { PDFPageData } from '../types';
import { PAGE_TYPE_LABELS } from '../constants';

interface PageAnalysisViewProps {
  pages: PDFPageData[];
}

export function PageAnalysisView({ pages }: PageAnalysisViewProps) {
  const [selectedPage, setSelectedPage] = useState<number>(0);
  const [showExtracted, setShowExtracted] = useState(false);

  if (pages.length === 0) return null;

  const page = pages[selectedPage];
  const data = page?.extractedData;

  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color">
      <div className="p-4 border-b border-border-color dark:border-dark-border-color">
        <h3 className="text-lg font-semibold text-text-primary dark:text-dark-text-primary">
          PDF Pages ({pages.length})
        </h3>
      </div>

      <div className="flex">
        {/* Page thumbnails */}
        <div className="w-48 border-r border-border-color dark:border-dark-border-color overflow-y-auto max-h-[600px]">
          {pages.map((p, idx) => (
            <button
              key={p.pageNumber}
              onClick={() => setSelectedPage(idx)}
              className={`w-full p-2 text-left border-b border-border-color dark:border-dark-border-color
                transition-colors
                ${idx === selectedPage
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500'
                  : 'hover:bg-gray-50 dark:hover:bg-dark-base-light'
                }
              `}
            >
              <div className="aspect-[3/4] bg-gray-100 dark:bg-gray-800 rounded overflow-hidden mb-1">
                <img
                  src={p.imageDataUrl}
                  alt={`Page ${p.pageNumber}`}
                  className="w-full h-full object-contain"
                />
              </div>
              <p className="text-xs font-medium text-text-primary dark:text-dark-text-primary">
                Page {p.pageNumber}
              </p>
              <p className={`text-xs ${p.pageType ? 'text-blue-600 dark:text-blue-400' : 'text-text-tertiary dark:text-dark-text-tertiary'}`}>
                {p.pageType ? PAGE_TYPE_LABELS[p.pageType] || p.pageType : 'Not classified'}
              </p>
              {p.analysisComplete && (
                <span className="inline-block mt-1 px-1.5 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded">
                  Analyzed
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Selected page detail */}
        <div className="flex-1 p-4">
          {page && (
            <div className="space-y-4">
              {/* Page image */}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden max-h-[400px]">
                <img
                  src={page.imageDataUrl}
                  alt={`Page ${page.pageNumber}`}
                  className="w-full h-full object-contain"
                />
              </div>

              {/* Page info */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-gray-50 dark:bg-dark-base-light rounded-lg p-3">
                  <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">Type</p>
                  <p className="font-medium text-text-primary dark:text-dark-text-primary text-sm">
                    {page.pageType ? PAGE_TYPE_LABELS[page.pageType] : 'Unknown'}
                  </p>
                </div>
                {data && (
                  <>
                    <div className="bg-gray-50 dark:bg-dark-base-light rounded-lg p-3">
                      <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">Walls</p>
                      <p className="font-medium text-text-primary dark:text-dark-text-primary text-sm">{data.walls.length}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-dark-base-light rounded-lg p-3">
                      <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">Rooms</p>
                      <p className="font-medium text-text-primary dark:text-dark-text-primary text-sm">{data.rooms.length}</p>
                    </div>
                    <div className="bg-gray-50 dark:bg-dark-base-light rounded-lg p-3">
                      <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary">Confidence</p>
                      <p className={`font-medium text-sm ${
                        data.confidence >= 0.8 ? 'text-green-600' :
                        data.confidence >= 0.6 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {(data.confidence * 100).toFixed(0)}%
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Extracted data toggle */}
              {data && (
                <div>
                  <button
                    onClick={() => setShowExtracted(!showExtracted)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    {showExtracted ? 'Hide' : 'Show'} extracted data
                  </button>

                  {showExtracted && (
                    <div className="mt-2 space-y-3">
                      {/* Scale */}
                      {data.scale && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                            Scale: {data.scale.text} ({data.scale.confidence >= 0.99 ? 'High confidence' : 'Needs verification'})
                          </p>
                        </div>
                      )}

                      {/* Rooms */}
                      {data.rooms.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-text-primary dark:text-dark-text-primary mb-1">
                            Rooms ({data.rooms.length})
                          </h4>
                          <div className="space-y-1">
                            {data.rooms.map(r => (
                              <div key={r.id} className="text-sm bg-gray-50 dark:bg-dark-base-light rounded px-3 py-1.5 flex justify-between">
                                <span>{r.name} ({r.room_type})</span>
                                <span className="text-text-tertiary dark:text-dark-text-tertiary">{r.area_sqft.toFixed(0)} sqft</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Doors & Windows */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <h4 className="text-sm font-medium text-text-primary dark:text-dark-text-primary mb-1">
                            Doors ({data.doors.length})
                          </h4>
                          {data.doors.map(d => (
                            <div key={d.id} className="text-xs bg-gray-50 dark:bg-dark-base-light rounded px-2 py-1 mb-1">
                              {d.door_type} ({d.width_ft}' x {d.height_ft}') {d.is_exterior ? 'EXT' : 'INT'}
                            </div>
                          ))}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-text-primary dark:text-dark-text-primary mb-1">
                            Windows ({data.windows.length})
                          </h4>
                          {data.windows.map(w => (
                            <div key={w.id} className="text-xs bg-gray-50 dark:bg-dark-base-light rounded px-2 py-1 mb-1">
                              {w.window_type} ({w.width_ft}' x {w.height_ft}')
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Fixtures */}
                      {data.fixtures.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-text-primary dark:text-dark-text-primary mb-1">
                            Fixtures ({data.fixtures.length})
                          </h4>
                          {data.fixtures.map(f => (
                            <div key={f.id} className="text-xs bg-gray-50 dark:bg-dark-base-light rounded px-2 py-1 mb-1">
                              {f.fixture_type} - {f.specifications || 'standard'}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Notes */}
                      {data.notes.length > 0 && (
                        <div>
                          <h4 className="text-sm font-medium text-text-primary dark:text-dark-text-primary mb-1">Notes</h4>
                          {data.notes.map((n, i) => (
                            <p key={i} className="text-xs text-text-secondary dark:text-dark-text-secondary">{n}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
