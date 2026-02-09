// =============================================================================
// ACE State Management - React hooks-based store for project state
// =============================================================================

import { useState, useCallback, useRef } from 'react';
import type {
  ACEProject, PDFPageData, DigitalTwin, MaterialList,
  Clarification, AuditEntry, PipelineState, ProjectStatus,
  VerificationNote,
} from '../types';
import { AgentOrchestrator, OrchestratorCallbacks } from '../agents/AgentOrchestrator';
import { VerificationIssue } from '../agents/EstimatorAgent';
import { computeMaterialList } from '../computation';
import { resolveContractorClarification } from '../agents/ClarificationAgent';

export interface ACEStore {
  // Project state
  project: ACEProject | null;
  pipelineState: PipelineState;
  isProcessing: boolean;
  verificationResult: { passed: boolean; issues: VerificationIssue[]; summary: string } | null;

  // Actions
  startPipeline: (file: File, apiKey: string, projectName?: string) => Promise<void>;
  abortPipeline: () => void;
  updateTwinMeasurement: (noteId: string, elementType: string, elementId: string, field: string, originalValue: string, correctedValue: string) => void;
  answerClarification: (clarificationId: string, answer: string) => void;
  recomputeMaterials: () => void;
  resetProject: () => void;
}

const INITIAL_PIPELINE_STATE: PipelineState = {
  currentPhase: 'uploading',
  progress: 0,
  currentAgent: null,
  currentPage: null,
  totalPages: 0,
  messages: [],
};

export function useACEStore(): ACEStore {
  const [project, setProject] = useState<ACEProject | null>(null);
  const [pipelineState, setPipelineState] = useState<PipelineState>(INITIAL_PIPELINE_STATE);
  const [isProcessing, setIsProcessing] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    passed: boolean;
    issues: VerificationIssue[];
    summary: string;
  } | null>(null);

  const orchestratorRef = useRef<AgentOrchestrator | null>(null);

  const startPipeline = useCallback(async (file: File, apiKey: string, projectName?: string) => {
    setIsProcessing(true);
    setVerificationResult(null);

    const projectId = `proj-${Date.now()}`;
    const newProject: ACEProject = {
      id: projectId,
      user_id: '',
      name: projectName || file.name.replace(/\.pdf$/i, ''),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      status: 'uploading',
      pdf_pages: [],
      digital_twin: null,
      material_list: null,
      clarifications: [],
      audit_trail: [],
    };

    setProject(newProject);

    const callbacks: OrchestratorCallbacks = {
      onPhaseChange: (phase: ProjectStatus) => {
        setProject(prev => prev ? { ...prev, status: phase, updated_at: new Date().toISOString() } : prev);
      },
      onProgress: (state: PipelineState) => {
        setPipelineState({ ...state });
      },
      onPagesReady: (pages: PDFPageData[]) => {
        setProject(prev => prev ? { ...prev, pdf_pages: pages } : prev);
      },
      onTwinReady: (twin: DigitalTwin) => {
        setProject(prev => prev ? { ...prev, digital_twin: twin } : prev);
      },
      onClarificationsReady: (clarifications: Clarification[]) => {
        setProject(prev => prev ? { ...prev, clarifications } : prev);
      },
      onMaterialListReady: (list: MaterialList) => {
        setProject(prev => prev ? { ...prev, material_list: list } : prev);
      },
      onVerificationComplete: (passed: boolean, issues: VerificationIssue[], summary: string) => {
        setVerificationResult({ passed, issues, summary });
      },
      onError: (error: string) => {
        console.error('Pipeline error:', error);
      },
      onAuditEntry: (entry: AuditEntry) => {
        setProject(prev => prev ? {
          ...prev,
          audit_trail: [...prev.audit_trail, entry],
        } : prev);
      },
    };

    const orchestrator = new AgentOrchestrator(apiKey, projectId, callbacks);
    orchestratorRef.current = orchestrator;

    try {
      await orchestrator.runFullPipeline(file);
    } finally {
      setIsProcessing(false);
      orchestratorRef.current = null;
    }
  }, []);

  const abortPipeline = useCallback(() => {
    orchestratorRef.current?.abort();
  }, []);

  const updateTwinMeasurement = useCallback((
    noteId: string,
    elementType: string,
    elementId: string,
    field: string,
    originalValue: string,
    correctedValue: string
  ) => {
    setProject(prev => {
      if (!prev || !prev.digital_twin) return prev;

      const note: VerificationNote = {
        id: noteId,
        element_type: elementType,
        element_id: elementId,
        field,
        original_value: originalValue,
        corrected_value: correctedValue,
        verified: true,
        timestamp: new Date().toISOString(),
      };

      const updatedTwin: DigitalTwin = {
        ...prev.digital_twin,
        verification_notes: [...prev.digital_twin.verification_notes, note],
      };

      // Apply correction to the actual building data
      // Find and update the element in the digital twin
      const building = { ...updatedTwin.building };
      building.floors = building.floors.map(floor => {
        if (elementType === 'wall') {
          return {
            ...floor,
            walls: floor.walls.map(w => {
              if (w.id === elementId) {
                return { ...w, [field]: parseFloat(correctedValue) || correctedValue };
              }
              return w;
            }),
          };
        }
        if (elementType === 'room') {
          return {
            ...floor,
            rooms: floor.rooms.map(r => {
              if (r.id === elementId) {
                return { ...r, [field]: parseFloat(correctedValue) || correctedValue };
              }
              return r;
            }),
          };
        }
        if (elementType === 'door') {
          return {
            ...floor,
            doors: floor.doors.map(d => {
              if (d.id === elementId) {
                return { ...d, [field]: parseFloat(correctedValue) || correctedValue };
              }
              return d;
            }),
          };
        }
        if (elementType === 'window') {
          return {
            ...floor,
            windows: floor.windows.map(w => {
              if (w.id === elementId) {
                return { ...w, [field]: parseFloat(correctedValue) || correctedValue };
              }
              return w;
            }),
          };
        }
        return floor;
      });

      updatedTwin.building = building;

      return {
        ...prev,
        digital_twin: updatedTwin,
        updated_at: new Date().toISOString(),
      };
    });
  }, []);

  const answerClarification = useCallback((clarificationId: string, answer: string) => {
    setProject(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        clarifications: prev.clarifications.map(c => {
          if (c.id === clarificationId) {
            return resolveContractorClarification(c, answer);
          }
          return c;
        }),
        updated_at: new Date().toISOString(),
      };
    });
  }, []);

  const recomputeMaterials = useCallback(() => {
    setProject(prev => {
      if (!prev || !prev.digital_twin) return prev;

      const { materialList, auditEntries } = computeMaterialList(prev.digital_twin);
      return {
        ...prev,
        material_list: materialList,
        audit_trail: [...prev.audit_trail, ...auditEntries],
        updated_at: new Date().toISOString(),
      };
    });
  }, []);

  const resetProject = useCallback(() => {
    orchestratorRef.current?.abort();
    setProject(null);
    setPipelineState(INITIAL_PIPELINE_STATE);
    setIsProcessing(false);
    setVerificationResult(null);
  }, []);

  return {
    project,
    pipelineState,
    isProcessing,
    verificationResult,
    startPipeline,
    abortPipeline,
    updateTwinMeasurement,
    answerClarification,
    recomputeMaterials,
    resetProject,
  };
}
