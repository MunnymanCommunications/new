// =============================================================================
// Segmenter Agent - Classifies PDF pages by type
// Uses AI vision to identify what each page represents.
// =============================================================================

import { GoogleGenAI } from '@google/genai';
import type { PDFPageData, PageType, AgentResult, AuditEntry } from '../types';
import { dataUrlToBase64 } from '../pdf/PdfProcessor';

const SEGMENTER_PROMPT = `You are a construction document classifier. Analyze this blueprint/CAD page image and classify it.

Respond with ONLY a JSON object (no markdown, no code fences):
{
  "page_type": "<one of: architectural_floor_plan, architectural_elevation, architectural_section, structural, electrical, plumbing, mechanical_hvac, site_plan, roof_plan, foundation, detail_sheet, cover_sheet, schedule, unknown>",
  "confidence": <number 0-1>,
  "description": "<brief description of what this page shows>",
  "contains_dimensions": <true/false>,
  "contains_rooms": <true/false>,
  "scale_text": "<scale text if visible, e.g. '1/4\\\" = 1'-0\\\"', or null>"
}

Classification guide:
- architectural_floor_plan: Shows room layouts, walls, doors, windows from above
- architectural_elevation: Shows building exterior from side view
- architectural_section: Cross-section cut through building
- structural: Shows beams, columns, foundations, load paths
- electrical: Shows outlets, switches, panels, circuits
- plumbing: Shows pipes, fixtures, drains
- mechanical_hvac: Shows ductwork, equipment, vents
- site_plan: Shows property boundaries, landscaping, parking
- roof_plan: Shows roof from above with slopes, ridges
- foundation: Shows footings, slabs, piers
- detail_sheet: Zoomed-in construction details
- cover_sheet: Title page with project info
- schedule: Tables of doors, windows, finishes`;

export async function runSegmenterAgent(
  pages: PDFPageData[],
  apiKey: string,
  onProgress?: (page: number, total: number) => void
): Promise<AgentResult<PDFPageData[]>> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const auditEntries: AuditEntry[] = [];
  const results: PDFPageData[] = [];

  const ai = new GoogleGenAI({ apiKey });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    onProgress?.(i + 1, pages.length);

    try {
      const base64 = dataUrlToBase64(page.imageDataUrl);

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [{
          role: 'user',
          parts: [
            {
              inlineData: {
                mimeType: 'image/png',
                data: base64,
              },
            },
            { text: SEGMENTER_PROMPT },
          ],
        }],
      });

      const text = response.text?.trim() || '';
      // Strip markdown code fences if present
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      try {
        const parsed = JSON.parse(jsonStr);
        results.push({
          ...page,
          pageType: parsed.page_type as PageType,
          analysisComplete: false,
        });

        auditEntries.push({
          id: `seg-${i}`,
          timestamp: new Date().toISOString(),
          agent: 'segmenter',
          action: 'classify_page',
          details: `Page ${page.pageNumber}: ${parsed.page_type} (confidence: ${parsed.confidence})`,
          page_number: page.pageNumber,
          data: parsed,
        });
      } catch {
        warnings.push(`Page ${page.pageNumber}: Could not parse classification response`);
        results.push({ ...page, pageType: 'unknown' });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Page ${page.pageNumber}: ${msg}`);
      results.push({ ...page, pageType: 'unknown' });
    }
  }

  return {
    agent: 'segmenter',
    success: errors.length === 0,
    data: results,
    errors,
    warnings,
    processing_time_ms: Date.now() - startTime,
    audit_entries: auditEntries,
  };
}
