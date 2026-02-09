// =============================================================================
// Estimator Agent - Final verification pass
// Compares generated material list against original PDF data to ensure
// no pages were missed and calculations are consistent.
// =============================================================================

import { GoogleGenAI } from '@google/genai';
import type {
  PDFPageData, MaterialList, DigitalTwin,
  AgentResult, AuditEntry, MaterialItem,
} from '../types';
import { flattenMaterialItems } from '../computation';
import { dataUrlToBase64 } from '../pdf/PdfProcessor';

const VERIFICATION_PROMPT = `You are a senior construction estimator performing a final quality check on a material estimation.

You are given:
1. The original floor plan images
2. The Digital Twin summary (what was extracted)
3. The generated material list

Your job is to verify:
1. Were ALL pages of the PDF analyzed? (check page count)
2. Does the material list seem reasonable for the building size?
3. Are there any obvious omissions (e.g., a bathroom was identified but no toilet counted)?
4. Do the quantities make sense proportionally?
5. Are there any red flags that would concern a contractor?

Building Summary:
{BUILDING_SUMMARY}

Material List Summary:
{MATERIAL_SUMMARY}

Pages analyzed: {PAGES_ANALYZED} of {TOTAL_PAGES}

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "verification_passed": <true|false>,
  "confidence": <0-1>,
  "issues": [
    {
      "severity": "<critical|warning|info>",
      "category": "<missing_items|quantity_mismatch|page_missed|proportion_error|other>",
      "description": "<detailed description>",
      "recommendation": "<what should be done>"
    }
  ],
  "summary": "<overall assessment paragraph>"
}`;

export async function runEstimatorAgent(
  pages: PDFPageData[],
  twin: DigitalTwin,
  materialList: MaterialList,
  apiKey: string
): Promise<AgentResult<{
  verification_passed: boolean;
  issues: VerificationIssue[];
  summary: string;
}>> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const auditEntries: AuditEntry[] = [];

  const ai = new GoogleGenAI({ apiKey });

  // Build summaries
  const buildingSummary = {
    name: twin.building.name,
    stories: twin.building.stories,
    total_sqft: twin.building.total_sqft,
    footprint_sqft: twin.building.footprint_sqft,
    roof: twin.building.roof,
    foundation: twin.building.foundation,
    floors: twin.building.floors.map(f => ({
      level: f.level,
      name: f.name,
      rooms: f.rooms.map(r => ({ name: r.name, type: r.room_type, sqft: r.area_sqft })),
      wall_count: f.walls.length,
      door_count: f.doors.length,
      window_count: f.windows.length,
      fixture_count: f.fixtures.length,
    })),
  };

  const allItems = flattenMaterialItems(materialList);
  const materialSummary = materialList.categories.map(cat => ({
    category: cat.name,
    items: cat.subcategories.flatMap(sub =>
      sub.items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        with_waste: item.quantity_with_waste,
        unit: item.unit,
      }))
    ),
  }));

  const analyzedCount = pages.filter(p => p.analysisComplete).length;

  const prompt = VERIFICATION_PROMPT
    .replace('{BUILDING_SUMMARY}', JSON.stringify(buildingSummary, null, 2))
    .replace('{MATERIAL_SUMMARY}', JSON.stringify(materialSummary, null, 2))
    .replace('{PAGES_ANALYZED}', String(analyzedCount))
    .replace('{TOTAL_PAGES}', String(pages.length));

  try {
    // Include up to 3 floor plan images for visual cross-reference
    const floorPlanPages = pages
      .filter(p => p.pageType === 'architectural_floor_plan')
      .slice(0, 3);

    const imageParts = floorPlanPages.map(p => ({
      inlineData: {
        mimeType: 'image/png' as const,
        data: dataUrlToBase64(p.imageDataUrl),
      },
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{
        role: 'user',
        parts: [
          ...imageParts,
          { text: prompt },
        ],
      }],
    });

    const text = response.text?.trim() || '';
    const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const parsed = JSON.parse(jsonStr);

    const issues: VerificationIssue[] = (parsed.issues || []).map((issue: Record<string, unknown>) => ({
      severity: issue.severity as string,
      category: issue.category as string,
      description: issue.description as string,
      recommendation: issue.recommendation as string,
    }));

    auditEntries.push({
      id: 'est-verify',
      timestamp: new Date().toISOString(),
      agent: 'estimator',
      action: 'verification_complete',
      details: `Verification ${parsed.verification_passed ? 'PASSED' : 'FAILED'}: ${issues.length} issues found (${issues.filter((i: VerificationIssue) => i.severity === 'critical').length} critical)`,
      page_number: null,
      data: {
        passed: parsed.verification_passed,
        confidence: parsed.confidence,
        issue_count: issues.length,
        critical_count: issues.filter((i: VerificationIssue) => i.severity === 'critical').length,
      },
    });

    // Also perform our own code-based checks
    const codeChecks = performCodeBasedChecks(pages, twin, materialList, allItems);
    issues.push(...codeChecks);

    if (codeChecks.some(c => c.severity === 'critical')) {
      auditEntries.push({
        id: 'est-code-check',
        timestamp: new Date().toISOString(),
        agent: 'estimator',
        action: 'code_verification_issues',
        details: `Code-based checks found ${codeChecks.length} additional issues`,
        page_number: null,
        data: { issues: codeChecks },
      });
    }

    return {
      agent: 'estimator',
      success: true,
      data: {
        verification_passed: parsed.verification_passed && !codeChecks.some(c => c.severity === 'critical'),
        issues,
        summary: parsed.summary || 'Verification complete.',
      },
      errors,
      warnings,
      processing_time_ms: Date.now() - startTime,
      audit_entries: auditEntries,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Estimator verification failed: ${msg}`);

    return {
      agent: 'estimator',
      success: false,
      data: {
        verification_passed: false,
        issues: [{
          severity: 'critical',
          category: 'other',
          description: `Verification agent encountered an error: ${msg}`,
          recommendation: 'Review material list manually',
        }],
        summary: 'Verification could not be completed due to an error.',
      },
      errors,
      warnings,
      processing_time_ms: Date.now() - startTime,
      audit_entries: auditEntries,
    };
  }
}

export interface VerificationIssue {
  severity: string;
  category: string;
  description: string;
  recommendation: string;
}

/**
 * Code-based verification checks (no AI needed).
 * These are deterministic sanity checks.
 */
function performCodeBasedChecks(
  pages: PDFPageData[],
  twin: DigitalTwin,
  _materialList: MaterialList,
  allItems: MaterialItem[]
): VerificationIssue[] {
  const issues: VerificationIssue[] = [];

  // Check 1: Were all pages processed?
  const unanalyzed = pages.filter(p =>
    !p.analysisComplete &&
    p.pageType &&
    ['architectural_floor_plan', 'structural', 'roof_plan', 'foundation'].includes(p.pageType)
  );
  if (unanalyzed.length > 0) {
    issues.push({
      severity: 'critical',
      category: 'page_missed',
      description: `${unanalyzed.length} analyzable page(s) were not processed: pages ${unanalyzed.map(p => p.pageNumber).join(', ')}`,
      recommendation: 'Re-run analysis to process missed pages',
    });
  }

  // Check 2: Does building have rooms?
  const totalRooms = twin.building.floors.reduce((s, f) => s + f.rooms.length, 0);
  if (totalRooms === 0) {
    issues.push({
      severity: 'critical',
      category: 'missing_items',
      description: 'No rooms were identified in the building',
      recommendation: 'Verify PDF quality and re-run analysis or manually add room data',
    });
  }

  // Check 3: Does building have walls?
  const totalWalls = twin.building.floors.reduce((s, f) => s + f.walls.length, 0);
  if (totalWalls === 0) {
    issues.push({
      severity: 'critical',
      category: 'missing_items',
      description: 'No walls were identified in the building',
      recommendation: 'Verify PDF quality and re-run analysis',
    });
  }

  // Check 4: Bathroom sanity check - bathrooms should have at least a toilet
  const bathrooms = twin.building.floors.flatMap(f =>
    f.rooms.filter(r => r.room_type === 'bathroom')
  );
  const toilets = twin.building.floors.flatMap(f =>
    f.fixtures.filter(fix => fix.fixture_type === 'toilet')
  );
  if (bathrooms.length > 0 && toilets.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'missing_items',
      description: `${bathrooms.length} bathroom(s) found but no toilets identified`,
      recommendation: 'Verify fixture identification or manually add missing fixtures',
    });
  }

  // Check 5: Kitchen should have a sink
  const kitchens = twin.building.floors.flatMap(f =>
    f.rooms.filter(r => r.room_type === 'kitchen')
  );
  const kitchenSinks = twin.building.floors.flatMap(f =>
    f.fixtures.filter(fix => fix.fixture_type === 'kitchen_sink')
  );
  if (kitchens.length > 0 && kitchenSinks.length === 0) {
    issues.push({
      severity: 'warning',
      category: 'missing_items',
      description: `Kitchen found but no kitchen sink identified`,
      recommendation: 'Verify fixture identification',
    });
  }

  // Check 6: Material list should not be empty
  if (allItems.length === 0) {
    issues.push({
      severity: 'critical',
      category: 'missing_items',
      description: 'Material list is empty - no items were calculated',
      recommendation: 'Check Digital Twin data and re-run computation',
    });
  }

  // Check 7: Zero-quantity items
  const zeroItems = allItems.filter(i => i.quantity <= 0);
  if (zeroItems.length > 0) {
    issues.push({
      severity: 'warning',
      category: 'quantity_mismatch',
      description: `${zeroItems.length} item(s) have zero quantity: ${zeroItems.map(i => i.name).join(', ')}`,
      recommendation: 'Review whether these items are needed or if input data is missing',
    });
  }

  return issues;
}
