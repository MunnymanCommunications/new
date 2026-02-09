// =============================================================================
// AI Construction Estimator (ACE) - Module Index
// =============================================================================

// Types
export type * from './types';

// Constants
export * from './constants';

// Computation Engine
export { computeMaterialList, flattenMaterialItems, getTotalLineItems } from './computation';
export { calculateDrywall } from './computation/drywall';
export { calculateFraming } from './computation/framing';
export { calculateInsulation } from './computation/insulation';
export { calculateRoofing } from './computation/roofing';
export { calculateFlooring, calculateBathroomWallTile } from './computation/flooring';
export { calculateFixtures } from './computation/fixtures';
export { calculatePaint } from './computation/paint';

// Agents
export { AgentOrchestrator } from './agents/AgentOrchestrator';
export { runSegmenterAgent } from './agents/SegmenterAgent';
export { runVisionOCRAgent } from './agents/VisionOCRAgent';
export { runArchitectAgent } from './agents/ArchitectAgent';
export { runClarificationAgent, resolveContractorClarification } from './agents/ClarificationAgent';
export { runEstimatorAgent } from './agents/EstimatorAgent';

// PDF Processing
export { processPdf, dataUrlToBase64, getDataUrlMimeType } from './pdf/PdfProcessor';

// Store
export { useACEStore } from './store/useACEStore';
export { saveProjectToSupabase, loadProjectsFromSupabase, deleteProjectFromSupabase } from './store/persistence';

// Page
export { EstimatorPage } from './pages/EstimatorPage';
