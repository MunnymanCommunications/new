// =============================================================================
// Clarification Agent - Handles Level 1 (AI) and Level 2 (Contractor) questions
// Level 1: AI attempts to resolve ambiguities from structural/architectural context
// Level 2: Flags questions for the contractor when AI confidence is insufficient
// =============================================================================

import { GoogleGenAI } from '@google/genai';
import type { Clarification, AgentResult, AuditEntry, DigitalTwin } from '../types';

const CLARIFICATION_PROMPT = `You are a senior construction expert AI. You are reviewing a building's Digital Twin and need to resolve ambiguities found during the analysis.

Building information:
{BUILDING_INFO}

The following questions need to be resolved:
{QUESTIONS}

For EACH question, provide your expert assessment. You must be honest about your confidence level.

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "answers": [
    {
      "clarification_id": "<id>",
      "answer": "<your expert answer>",
      "confidence": <0-1>,
      "reasoning": "<how you arrived at this answer>",
      "can_resolve": <true if confidence >= 0.8, false otherwise>
    }
  ]
}

IMPORTANT RULES:
- Only mark can_resolve=true if you are 80%+ confident
- For structural questions (load-bearing, foundation type), be conservative
- If the scale cannot be determined with 99% confidence, set can_resolve=false
- Reference specific architectural conventions and building codes in your reasoning
- If in doubt, always recommend the contractor verify`;

/**
 * Run Level 1 clarification: AI tries to answer ambiguities.
 * Questions it cannot answer (confidence < 80%) get escalated to Level 2 (contractor).
 */
export async function runClarificationAgent(
  clarifications: Clarification[],
  twin: DigitalTwin,
  apiKey: string
): Promise<AgentResult<Clarification[]>> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const auditEntries: AuditEntry[] = [];

  if (clarifications.length === 0) {
    return {
      agent: 'clarification',
      success: true,
      data: [],
      errors: [],
      warnings: [],
      processing_time_ms: 0,
      audit_entries: [],
    };
  }

  const ai = new GoogleGenAI({ apiKey });

  const buildingInfo = JSON.stringify({
    name: twin.building.name,
    stories: twin.building.stories,
    total_sqft: twin.building.total_sqft,
    footprint_sqft: twin.building.footprint_sqft,
    roof: twin.building.roof,
    foundation: twin.building.foundation,
    exterior: twin.building.exterior,
    floors: twin.building.floors.map(f => ({
      level: f.level,
      name: f.name,
      rooms: f.rooms.length,
      walls: f.walls.length,
      ceiling_height: f.ceiling_height_ft,
    })),
  }, null, 2);

  const questions = clarifications.map(c => ({
    id: c.id,
    question: c.question,
    context: c.context.description,
    page_number: c.page_number,
    element_id: c.element_id,
  }));

  const prompt = CLARIFICATION_PROMPT
    .replace('{BUILDING_INFO}', buildingInfo)
    .replace('{QUESTIONS}', JSON.stringify(questions, null, 2));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim() || '';
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const answerMap = new Map<string, {
      answer: string;
      confidence: number;
      reasoning: string;
      can_resolve: boolean;
    }>();

    for (const ans of parsed.answers || []) {
      answerMap.set(ans.clarification_id, ans);
    }

    const updatedClarifications: Clarification[] = clarifications.map(c => {
      const answer = answerMap.get(c.id);

      if (answer && answer.can_resolve) {
        // Level 1 resolved
        auditEntries.push({
          id: `clar-l1-${c.id}`,
          timestamp: new Date().toISOString(),
          agent: 'clarification',
          action: 'level_1_resolved',
          details: `Resolved: "${c.question}" → "${answer.answer}" (confidence: ${answer.confidence})`,
          page_number: c.page_number,
          data: answer,
        });

        return {
          ...c,
          level: 1 as const,
          status: 'ai_resolved' as const,
          ai_answer: `${answer.answer}\n\nReasoning: ${answer.reasoning}`,
          resolved_at: new Date().toISOString(),
        };
      } else {
        // Escalate to Level 2
        auditEntries.push({
          id: `clar-l2-${c.id}`,
          timestamp: new Date().toISOString(),
          agent: 'clarification',
          action: 'level_2_escalated',
          details: `Escalated to contractor: "${c.question}" (AI confidence: ${answer?.confidence || 'N/A'})`,
          page_number: c.page_number,
          data: answer || null,
        });

        return {
          ...c,
          level: 2 as const,
          status: 'awaiting_contractor' as const,
          ai_answer: answer
            ? `AI suggestion (low confidence ${answer.confidence}): ${answer.answer}\n\nReasoning: ${answer.reasoning}`
            : null,
        };
      }
    });

    const resolved = updatedClarifications.filter(c => c.status === 'ai_resolved').length;
    const escalated = updatedClarifications.filter(c => c.status === 'awaiting_contractor').length;

    auditEntries.push({
      id: 'clar-summary',
      timestamp: new Date().toISOString(),
      agent: 'clarification',
      action: 'clarification_summary',
      details: `Level 1 resolved: ${resolved}, Level 2 escalated: ${escalated}`,
      page_number: null,
      data: { resolved, escalated, total: clarifications.length },
    });

    return {
      agent: 'clarification',
      success: true,
      data: updatedClarifications,
      errors,
      warnings,
      processing_time_ms: Date.now() - startTime,
      audit_entries: auditEntries,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Clarification agent failed: ${msg}`);

    // On failure, escalate everything to Level 2
    return {
      agent: 'clarification',
      success: false,
      data: clarifications.map(c => ({
        ...c,
        level: 2 as const,
        status: 'awaiting_contractor' as const,
      })),
      errors,
      warnings,
      processing_time_ms: Date.now() - startTime,
      audit_entries: auditEntries,
    };
  }
}

/**
 * Apply contractor answers to clarifications.
 */
export function resolveContractorClarification(
  clarification: Clarification,
  answer: string
): Clarification {
  return {
    ...clarification,
    status: 'resolved',
    contractor_answer: answer,
    resolved_at: new Date().toISOString(),
  };
}
