// =============================================================================
// AI Construction Estimator (ACE) - Main Page
// Orchestrates the full workflow: Upload → Analyze → Verify → Compute → Output
// =============================================================================

import { useState, useCallback } from 'react';
import { useACEStore } from '../store/useACEStore';
import { PdfUploader } from '../components/PdfUploader';
import { ProcessingPipeline } from '../components/ProcessingPipeline';
import { PageAnalysisView } from '../components/PageAnalysisView';
import { DigitalTwinViewer } from '../components/DigitalTwinViewer';
import { MeasurementEditor } from '../components/MeasurementEditor';
import { ClarificationPanel } from '../components/ClarificationPanel';
import { MaterialListView } from '../components/MaterialListView';
import { AuditTrail } from '../components/AuditTrail';
import { ProjectHistory } from '../components/ProjectHistory';

type Tab = 'overview' | 'pages' | 'twin' | 'measurements' | 'clarifications' | 'materials' | 'audit';

export function EstimatorPage() {
  const store = useACEStore();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [apiKey, setApiKey] = useState(process.env.API_KEY || '');
  const [projectName, setProjectName] = useState('');
  const [showApiInput, setShowApiInput] = useState(!process.env.API_KEY);

  const handleFileSelected = useCallback((file: File) => {
    const key = apiKey.trim();
    if (!key) {
      setShowApiInput(true);
      return;
    }
    store.startPipeline(file, key, projectName || undefined);
    setActiveTab('overview');
  }, [apiKey, projectName, store]);

  const hasProject = !!store.project;
  const hasPages = (store.project?.pdf_pages?.length || 0) > 0;
  const hasTwin = !!store.project?.digital_twin;
  const hasMaterials = !!store.project?.material_list;
  const hasClarifications = (store.project?.clarifications?.length || 0) > 0;
  const hasAudit = (store.project?.audit_trail?.length || 0) > 0;

  const TABS: { key: Tab; label: string; enabled: boolean; badge?: number }[] = [
    { key: 'overview', label: 'Overview', enabled: true },
    { key: 'pages', label: 'Pages', enabled: hasPages, badge: store.project?.pdf_pages?.length },
    { key: 'twin', label: 'Digital Twin', enabled: hasTwin },
    { key: 'measurements', label: 'Verify', enabled: hasTwin },
    { key: 'clarifications', label: 'Questions', enabled: hasClarifications,
      badge: store.project?.clarifications?.filter(c => c.status === 'awaiting_contractor').length },
    { key: 'materials', label: 'Materials', enabled: hasMaterials },
    { key: 'audit', label: 'Audit Trail', enabled: hasAudit, badge: store.project?.audit_trail?.length },
  ];

  return (
    <div className="min-h-screen bg-base-light dark:bg-dark-base-light">
      {/* Header */}
      <div className="bg-white dark:bg-dark-base-medium border-b border-border-color dark:border-dark-border-color">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="#/"
                className="p-2 text-text-tertiary dark:text-dark-text-tertiary hover:text-text-primary dark:hover:text-dark-text-primary hover:bg-gray-100 dark:hover:bg-dark-base-light rounded-lg transition-colors"
                title="Back to Dashboard"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </a>
              <div>
                <h1 className="text-2xl font-bold text-text-primary dark:text-dark-text-primary">
                  AI Construction Estimator
                </h1>
                <p className="text-sm text-text-secondary dark:text-dark-text-secondary">
                  Upload floor plans &middot; AI-powered analysis &middot; Precise material estimation
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {hasProject && store.isSaving && (
                <span className="text-xs text-blue-500 animate-pulse">Saving...</span>
              )}
              {hasProject && !store.isProcessing && (
                <button
                  onClick={store.saveProject}
                  disabled={store.isSaving}
                  className="px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 rounded-lg transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              )}
              {hasProject && (
                <span className="text-sm text-text-tertiary dark:text-dark-text-tertiary">
                  {store.project?.name}
                </span>
              )}
              {hasProject && (
                <button
                  onClick={store.resetProject}
                  className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                >
                  New Project
                </button>
              )}
            </div>
          </div>

          {/* Tabs */}
          {hasProject && (
            <div className="flex gap-1 mt-4 -mb-px overflow-x-auto">
              {TABS.map(tab => (
                <button
                  key={tab.key}
                  onClick={() => tab.enabled && setActiveTab(tab.key)}
                  disabled={!tab.enabled}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap
                    ${activeTab === tab.key
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-900/10'
                      : tab.enabled
                        ? 'border-transparent text-text-secondary dark:text-dark-text-secondary hover:text-text-primary dark:hover:text-dark-text-primary hover:border-gray-300'
                        : 'border-transparent text-text-tertiary dark:text-dark-text-tertiary cursor-not-allowed opacity-50'
                    }
                  `}
                >
                  {tab.label}
                  {tab.badge != null && tab.badge > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 rounded-full">
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Upload section (shown when no project) */}
        {!hasProject && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold text-text-primary dark:text-dark-text-primary mb-3">
                Estimate Materials from Floor Plans
              </h2>
              <p className="text-text-secondary dark:text-dark-text-secondary max-w-lg mx-auto">
                Upload your CAD or architectural PDF and our multi-agent AI system will extract
                dimensions, build a digital twin, and compute a detailed material list with
                15% waste factor applied.
              </p>
            </div>

            {/* API Key input */}
            {showApiInput && (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                <label className="block text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                  Gemini API Key Required
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={e => setApiKey(e.target.value)}
                  placeholder="Enter your Gemini API key..."
                  className="w-full px-3 py-2 border border-yellow-300 dark:border-yellow-700 rounded-lg
                    bg-white dark:bg-dark-base-light text-text-primary dark:text-dark-text-primary
                    focus:outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                />
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  Used for AI vision analysis. Your key stays in your browser.
                </p>
              </div>
            )}

            {/* Project name */}
            <div>
              <label className="block text-sm font-medium text-text-secondary dark:text-dark-text-secondary mb-1">
                Project Name (optional)
              </label>
              <input
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                placeholder="e.g., Johnson Residence, 123 Main St Renovation..."
                className="w-full px-3 py-2 border border-border-color dark:border-dark-border-color rounded-lg
                  bg-white dark:bg-dark-base-light text-text-primary dark:text-dark-text-primary
                  focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>

            <PdfUploader onFileSelected={handleFileSelected} isProcessing={store.isProcessing} />

            {/* Feature highlights */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              <FeatureCard
                title="Multi-Agent Analysis"
                description="5 specialized AI agents classify pages, extract elements, build a digital twin, resolve ambiguities, and verify results."
              />
              <FeatureCard
                title="Code-Based Math"
                description="All material calculations use deterministic formulas. 16&quot; OC framing, both-side drywall, 15% waste factor."
              />
              <FeatureCard
                title="Contractor Verification"
                description="Review and correct measurements before computing. Level 1 AI and Level 2 contractor clarification system."
              />
            </div>

            {/* Saved project history */}
            <ProjectHistory
              projects={store.savedProjects}
              isLoading={store.isLoadingHistory}
              onLoad={store.loadSavedProjects}
              onSelect={store.loadProject}
              onDelete={store.deleteProject}
            />
          </div>
        )}

        {/* Processing pipeline (shown during analysis) */}
        {store.isProcessing && (
          <ProcessingPipeline state={store.pipelineState} onAbort={store.abortPipeline} />
        )}

        {/* Tab content */}
        {hasProject && activeTab === 'overview' && (
          <OverviewTab
            store={store}
            onTabChange={setActiveTab}
          />
        )}

        {hasProject && activeTab === 'pages' && store.project?.pdf_pages && (
          <PageAnalysisView pages={store.project.pdf_pages} />
        )}

        {hasProject && activeTab === 'twin' && store.project?.digital_twin && (
          <DigitalTwinViewer twin={store.project.digital_twin} />
        )}

        {hasProject && activeTab === 'measurements' && store.project?.digital_twin && (
          <MeasurementEditor
            twin={store.project.digital_twin}
            onUpdate={store.updateTwinMeasurement}
            onRecompute={store.recomputeMaterials}
          />
        )}

        {hasProject && activeTab === 'clarifications' && store.project?.clarifications && (
          <ClarificationPanel
            clarifications={store.project.clarifications}
            onAnswer={store.answerClarification}
          />
        )}

        {hasProject && activeTab === 'materials' && store.project?.material_list && (
          <MaterialListView materialList={store.project.material_list} />
        )}

        {hasProject && activeTab === 'audit' && store.project?.audit_trail && (
          <AuditTrail entries={store.project.audit_trail} />
        )}
      </div>
    </div>
  );
}

function OverviewTab({ store, onTabChange }: { store: ReturnType<typeof useACEStore>; onTabChange: (tab: Tab) => void }) {
  const project = store.project;
  if (!project) return null;

  const totalWalls = project.digital_twin?.building.floors.reduce((s, f) => s + f.walls.length, 0) || 0;
  const totalRooms = project.digital_twin?.building.floors.reduce((s, f) => s + f.rooms.length, 0) || 0;
  const totalDoors = project.digital_twin?.building.floors.reduce((s, f) => s + f.doors.length, 0) || 0;
  const totalWindows = project.digital_twin?.building.floors.reduce((s, f) => s + f.windows.length, 0) || 0;
  const totalFixtures = project.digital_twin?.building.floors.reduce((s, f) => s + f.fixtures.length, 0) || 0;
  const materialItems = project.material_list?.categories.reduce(
    (sum, c) => sum + c.subcategories.reduce((s, sc) => s + sc.items.length, 0), 0
  ) || 0;

  const pendingClarifications = project.clarifications.filter(c => c.status === 'awaiting_contractor').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <SummaryCard label="Pages" value={project.pdf_pages.length} onClick={() => onTabChange('pages')} />
        <SummaryCard label="Rooms" value={totalRooms} onClick={() => onTabChange('twin')} />
        <SummaryCard label="Walls" value={totalWalls} onClick={() => onTabChange('twin')} />
        <SummaryCard label="Doors" value={totalDoors} />
        <SummaryCard label="Windows" value={totalWindows} />
        <SummaryCard label="Fixtures" value={totalFixtures} />
        <SummaryCard label="Materials" value={materialItems} onClick={() => onTabChange('materials')} highlight />
      </div>

      {/* Verification status */}
      {store.verificationResult && (
        <div className={`rounded-xl p-4 border ${
          store.verificationResult.passed
            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
            : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
        }`}>
          <h4 className={`font-medium ${
            store.verificationResult.passed
              ? 'text-green-700 dark:text-green-300'
              : 'text-yellow-700 dark:text-yellow-300'
          }`}>
            Verification: {store.verificationResult.passed ? 'Passed' : 'Needs Review'}
          </h4>
          <p className="text-sm text-text-secondary dark:text-dark-text-secondary mt-1">
            {store.verificationResult.summary}
          </p>
          {store.verificationResult.issues.length > 0 && (
            <ul className="mt-2 space-y-1">
              {store.verificationResult.issues.map((issue, i) => (
                <li key={i} className="text-sm flex items-start gap-2">
                  <span className={`flex-shrink-0 ${
                    issue.severity === 'critical' ? 'text-red-500' :
                    issue.severity === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                  }`}>&#9679;</span>
                  <span className="text-text-secondary dark:text-dark-text-secondary">{issue.description}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Pending contractor questions */}
      {pendingClarifications > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium text-yellow-700 dark:text-yellow-300">
                {pendingClarifications} Question(s) Need Your Input
              </h4>
              <p className="text-sm text-yellow-600 dark:text-yellow-400">
                The AI system needs your expertise to resolve some ambiguities.
              </p>
            </div>
            <button
              onClick={() => onTabChange('clarifications')}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Answer Questions
            </button>
          </div>
        </div>
      )}

      {/* Quick actions */}
      {project.digital_twin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => onTabChange('measurements')}
            className="p-4 bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color
              hover:border-blue-400 hover:shadow-md transition-all text-left"
          >
            <h4 className="font-medium text-text-primary dark:text-dark-text-primary">Verify Measurements</h4>
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary mt-1">
              Review and correct extracted dimensions before computing final materials.
            </p>
          </button>
          {project.material_list && (
            <button
              onClick={() => onTabChange('materials')}
              className="p-4 bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color
                hover:border-green-400 hover:shadow-md transition-all text-left"
            >
              <h4 className="font-medium text-text-primary dark:text-dark-text-primary">View Material List</h4>
              <p className="text-sm text-text-secondary dark:text-dark-text-secondary mt-1">
                {materialItems} line items with full calculation audit trail. Export to CSV.
              </p>
            </button>
          )}
          <button
            onClick={() => onTabChange('audit')}
            className="p-4 bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color
              hover:border-purple-400 hover:shadow-md transition-all text-left"
          >
            <h4 className="font-medium text-text-primary dark:text-dark-text-primary">Audit Trail</h4>
            <p className="text-sm text-text-secondary dark:text-dark-text-secondary mt-1">
              {project.audit_trail.length} entries showing how every number was derived.
            </p>
          </button>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, onClick, highlight }: { label: string; value: number; onClick?: () => void; highlight?: boolean }) {
  return (
    <div
      onClick={onClick}
      className={`rounded-xl p-4 text-center border transition-all
        ${onClick ? 'cursor-pointer hover:shadow-md' : ''}
        ${highlight
          ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          : 'bg-white dark:bg-dark-base-medium border-border-color dark:border-dark-border-color'
        }
      `}
    >
      <p className={`text-2xl font-bold ${highlight ? 'text-blue-600 dark:text-blue-400' : 'text-text-primary dark:text-dark-text-primary'}`}>
        {value}
      </p>
      <p className="text-xs text-text-tertiary dark:text-dark-text-tertiary mt-1">{label}</p>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-dark-base-medium rounded-xl border border-border-color dark:border-dark-border-color p-4">
      <h4 className="font-medium text-text-primary dark:text-dark-text-primary mb-1">{title}</h4>
      <p className="text-sm text-text-secondary dark:text-dark-text-secondary">{description}</p>
    </div>
  );
}
