// =============================================================================
// Agent Orchestrator - Coordinates the multi-agent pipeline
// Manages the flow: PDF → Segment → Vision/OCR → Architect → Clarify → Compute → Verify
// =============================================================================

import type {
  PDFPageData, DigitalTwin, MaterialList,
  Clarification, AuditEntry, PipelineState, PipelineMessage,
  ProjectStatus,
} from '../types';
import { processPdf } from '../pdf/PdfProcessor';
import { runSegmenterAgent } from './SegmenterAgent';
import { runVisionOCRAgent } from './VisionOCRAgent';
import { runArchitectAgent } from './ArchitectAgent';
import { runClarificationAgent } from './ClarificationAgent';
import { runEstimatorAgent, VerificationIssue } from './EstimatorAgent';
import { computeMaterialList } from '../computation';

export interface OrchestratorCallbacks {
  onPhaseChange: (phase: ProjectStatus) => void;
  onProgress: (state: PipelineState) => void;
  onPagesReady: (pages: PDFPageData[]) => void;
  onTwinReady: (twin: DigitalTwin) => void;
  onClarificationsReady: (clarifications: Clarification[]) => void;
  onMaterialListReady: (list: MaterialList) => void;
  onVerificationComplete: (passed: boolean, issues: VerificationIssue[], summary: string) => void;
  onError: (error: string) => void;
  onAuditEntry: (entry: AuditEntry) => void;
}

export class AgentOrchestrator {
  private apiKey: string;
  private projectId: string;
  private callbacks: OrchestratorCallbacks;
  private pipelineState: PipelineState;
  private aborted: boolean = false;

  constructor(apiKey: string, projectId: string, callbacks: OrchestratorCallbacks) {
    this.apiKey = apiKey;
    this.projectId = projectId;
    this.callbacks = callbacks;
    this.pipelineState = {
      currentPhase: 'uploading',
      progress: 0,
      currentAgent: null,
      currentPage: null,
      totalPages: 0,
      messages: [],
    };
  }

  abort() {
    this.aborted = true;
  }

  private addMessage(level: PipelineMessage['level'], message: string, agent?: string) {
    this.pipelineState.messages.push({
      timestamp: new Date().toISOString(),
      level,
      message,
      agent: agent as PipelineMessage['agent'],
    });
    this.callbacks.onProgress({ ...this.pipelineState });
  }

  private setPhase(phase: ProjectStatus, progress: number = 0) {
    this.pipelineState.currentPhase = phase;
    this.pipelineState.progress = progress;
    this.callbacks.onPhaseChange(phase);
    this.callbacks.onProgress({ ...this.pipelineState });
  }

  private addAudit(entry: AuditEntry) {
    this.callbacks.onAuditEntry(entry);
  }

  /**
   * Run the complete analysis pipeline on a PDF file.
   */
  async runFullPipeline(file: File): Promise<{
    pages: PDFPageData[];
    twin: DigitalTwin | null;
    materialList: MaterialList | null;
    clarifications: Clarification[];
    auditTrail: AuditEntry[];
  }> {
    const auditTrail: AuditEntry[] = [];
    let pages: PDFPageData[] = [];
    let twin: DigitalTwin | null = null;
    let materialList: MaterialList | null = null;
    let clarifications: Clarification[] = [];

    try {
      // === PHASE 1: PDF Processing ===
      this.setPhase('uploading', 0);
      this.addMessage('info', `Processing PDF: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      pages = await processPdf(file, (page, total) => {
        this.pipelineState.currentPage = page;
        this.pipelineState.totalPages = total;
        this.pipelineState.progress = Math.round((page / total) * 100);
        this.callbacks.onProgress({ ...this.pipelineState });
      });

      this.addMessage('success', `Extracted ${pages.length} pages from PDF`);
      this.callbacks.onPagesReady([...pages]);

      if (this.aborted) return { pages, twin, materialList, clarifications, auditTrail };

      // === PHASE 2: Page Segmentation ===
      this.setPhase('segmenting', 0);
      this.pipelineState.currentAgent = 'segmenter';
      this.addMessage('info', 'Classifying page types...', 'segmenter');

      const segResult = await runSegmenterAgent(pages, this.apiKey, (page, total) => {
        this.pipelineState.progress = Math.round((page / total) * 100);
        this.callbacks.onProgress({ ...this.pipelineState });
      });

      pages = segResult.data;
      segResult.audit_entries.forEach(e => { auditTrail.push(e); this.addAudit(e); });

      const floorPlanCount = pages.filter(p => p.pageType === 'architectural_floor_plan').length;
      this.addMessage(
        segResult.success ? 'success' : 'warning',
        `Classification complete: ${floorPlanCount} floor plans, ${pages.filter(p => p.pageType === 'structural').length} structural, ${pages.filter(p => p.pageType === 'roof_plan').length} roof plans`,
        'segmenter'
      );

      if (segResult.errors.length > 0) {
        segResult.errors.forEach(e => this.addMessage('error', e, 'segmenter'));
      }

      this.callbacks.onPagesReady([...pages]);

      if (this.aborted) return { pages, twin, materialList, clarifications, auditTrail };

      // === PHASE 3: Vision-OCR Analysis ===
      this.setPhase('analyzing', 0);
      this.pipelineState.currentAgent = 'vision_ocr';
      this.addMessage('info', 'Extracting dimensions, walls, rooms, and fixtures...', 'vision_ocr');

      const visionResult = await runVisionOCRAgent(pages, this.apiKey, (page, total, status) => {
        this.pipelineState.progress = Math.round((page / total) * 100);
        this.pipelineState.currentPage = page;
        this.addMessage('info', status, 'vision_ocr');
        this.callbacks.onProgress({ ...this.pipelineState });
      });

      pages = visionResult.data;
      visionResult.audit_entries.forEach(e => { auditTrail.push(e); this.addAudit(e); });

      const totalElements = pages.reduce((sum, p) => {
        if (!p.extractedData) return sum;
        return sum + p.extractedData.walls.length + p.extractedData.doors.length +
          p.extractedData.windows.length + p.extractedData.rooms.length + p.extractedData.fixtures.length;
      }, 0);

      this.addMessage(
        visionResult.success ? 'success' : 'warning',
        `Extraction complete: ${totalElements} total elements identified`,
        'vision_ocr'
      );

      if (visionResult.warnings.length > 0) {
        visionResult.warnings.forEach(w => this.addMessage('warning', w, 'vision_ocr'));
      }

      this.callbacks.onPagesReady([...pages]);

      if (this.aborted) return { pages, twin, materialList, clarifications, auditTrail };

      // === PHASE 4: Build Digital Twin ===
      this.setPhase('building_twin', 0);
      this.pipelineState.currentAgent = 'architect';
      this.addMessage('info', 'Building Digital Twin from extracted data...', 'architect');

      const archResult = await runArchitectAgent(pages, this.apiKey, this.projectId);

      twin = archResult.data.twin;
      clarifications = archResult.data.clarifications;
      archResult.audit_entries.forEach(e => { auditTrail.push(e); this.addAudit(e); });

      this.addMessage(
        archResult.success ? 'success' : 'warning',
        `Digital Twin built: ${twin.building.stories} stories, ${twin.building.total_sqft.toFixed(0)} sqft, ${twin.building.floors.reduce((s, f) => s + f.rooms.length, 0)} rooms`,
        'architect'
      );

      this.callbacks.onTwinReady(twin);

      if (this.aborted) return { pages, twin, materialList, clarifications, auditTrail };

      // === PHASE 5: Clarification ===
      if (clarifications.length > 0) {
        this.setPhase('awaiting_verification', 0);
        this.pipelineState.currentAgent = 'clarification';
        this.addMessage('info', `Resolving ${clarifications.length} ambiguities...`, 'clarification');

        const clarResult = await runClarificationAgent(clarifications, twin, this.apiKey);
        clarifications = clarResult.data;
        clarResult.audit_entries.forEach(e => { auditTrail.push(e); this.addAudit(e); });

        const l1Resolved = clarifications.filter(c => c.status === 'ai_resolved').length;
        const l2Pending = clarifications.filter(c => c.status === 'awaiting_contractor').length;

        this.addMessage(
          'success',
          `Clarification complete: ${l1Resolved} resolved by AI, ${l2Pending} need contractor input`,
          'clarification'
        );

        this.callbacks.onClarificationsReady([...clarifications]);

        // If Level 2 questions exist, pause here for contractor input
        if (l2Pending > 0) {
          this.addMessage('warning', `Pausing for ${l2Pending} contractor question(s). Computation will proceed with best estimates.`, 'clarification');
        }
      }

      if (this.aborted) return { pages, twin, materialList, clarifications, auditTrail };

      // === PHASE 6: Material Computation ===
      this.setPhase('computing_materials', 0);
      this.pipelineState.currentAgent = null;
      this.addMessage('info', 'Computing material quantities (code-based math, no AI)...');

      const { materialList: ml, auditEntries: compAudit } = computeMaterialList(twin);
      materialList = ml;
      compAudit.forEach(e => { auditTrail.push(e); this.addAudit(e); });

      const totalItems = materialList.categories.reduce(
        (sum, c) => sum + c.subcategories.reduce((s, sc) => s + sc.items.length, 0), 0
      );

      this.addMessage('success', `Material list generated: ${totalItems} line items across ${materialList.categories.length} categories`);
      this.callbacks.onMaterialListReady(materialList);

      if (this.aborted) return { pages, twin, materialList, clarifications, auditTrail };

      // === PHASE 7: Verification ===
      this.setPhase('verification_check', 0);
      this.pipelineState.currentAgent = 'estimator';
      this.addMessage('info', 'Running verification pass...', 'estimator');

      const estResult = await runEstimatorAgent(pages, twin, materialList, this.apiKey);
      estResult.audit_entries.forEach(e => { auditTrail.push(e); this.addAudit(e); });

      const { verification_passed, issues, summary } = estResult.data;

      this.addMessage(
        verification_passed ? 'success' : 'warning',
        `Verification ${verification_passed ? 'PASSED' : 'NEEDS REVIEW'}: ${issues.length} issues found`,
        'estimator'
      );

      if (issues.length > 0) {
        issues.forEach(issue => {
          this.addMessage(
            issue.severity === 'critical' ? 'error' : 'warning',
            `[${issue.severity.toUpperCase()}] ${issue.description}`,
            'estimator'
          );
        });
      }

      this.callbacks.onVerificationComplete(verification_passed, issues, summary);

      // === COMPLETE ===
      this.setPhase('complete', 100);
      this.addMessage('success', 'Pipeline complete! Material list is ready for review.');

    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.addMessage('error', `Pipeline error: ${msg}`);
      this.callbacks.onError(msg);
      this.setPhase('error', 0);
    }

    return { pages, twin, materialList, clarifications, auditTrail };
  }
}
