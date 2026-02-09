// =============================================================================
// Vision-OCR Hybrid Agent - Extracts dimensions and elements from floor plans
// Uses AI vision for spatial reasoning + element identification.
// ALL measurements are extracted as data; math is NOT done here.
// =============================================================================

import { GoogleGenAI } from '@google/genai';
import type {
  PDFPageData, PageExtractedData, AgentResult, AuditEntry,
  ExtractedWall, ExtractedDoor, ExtractedWindow, ExtractedRoom,
  ExtractedFixture, ExtractedDimension, ExtractedStructuralElement,
} from '../types';
import { dataUrlToBase64 } from '../pdf/PdfProcessor';

const VISION_OCR_PROMPT = `You are an expert construction blueprint analyzer. Analyze this floor plan image with extreme precision.

CRITICAL RULES:
1. Extract ALL dimensions visible in the drawing
2. Identify the drawing scale (look for scale bars or text like "1/4" = 1'-0"")
3. Identify ALL walls, their approximate lengths, and whether they are exterior or interior
4. Identify ALL doors (look for arc swings, door symbols) and their types
5. Identify ALL windows (look for parallel lines in walls, window symbols)
6. Identify ALL rooms with their names (look for room labels)
7. Identify ALL fixtures (toilets, sinks, tubs, appliances)
8. Window and door openings should NOT be subtracted from wall lengths - count them as part of the wall
9. Note any structural elements (beams, columns, headers)

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "scale": {
    "text": "<scale text or null>",
    "pixels_per_foot": <estimated number or 0 if unknown>,
    "confidence": <0-1>
  },
  "walls": [
    {
      "id": "w1",
      "start": {"x": <num>, "y": <num>},
      "end": {"x": <num>, "y": <num>},
      "length_ft": <number>,
      "height_ft": <number or 8 as default>,
      "thickness_in": <number>,
      "wall_type": "<standard|partition|shear|curtain|foundation>",
      "is_load_bearing": <true|false|null>,
      "is_exterior": <true|false>,
      "connected_walls": ["<wall_ids>"]
    }
  ],
  "doors": [
    {
      "id": "d1",
      "position": {"x": <num>, "y": <num>},
      "width_ft": <number>,
      "height_ft": <number or 6.67>,
      "door_type": "<single|double|sliding|pocket|bifold|french|garage|unknown>",
      "wall_id": "<wall_id or null>",
      "swing_direction": "<left|right|double|sliding|unknown>",
      "is_exterior": <true|false>
    }
  ],
  "windows": [
    {
      "id": "win1",
      "position": {"x": <num>, "y": <num>},
      "width_ft": <number>,
      "height_ft": <number or 4>,
      "window_type": "<single_hung|double_hung|casement|sliding|fixed|bay|skylight|unknown>",
      "wall_id": "<wall_id or null>"
    }
  ],
  "rooms": [
    {
      "id": "r1",
      "name": "<room name from plan>",
      "room_type": "<bedroom|bathroom|kitchen|living_room|dining_room|hallway|closet|laundry|garage|utility|office|foyer|pantry|mudroom|basement|attic|other>",
      "vertices": [{"x": <num>, "y": <num>}],
      "area_sqft": <number>,
      "perimeter_ft": <number>,
      "ceiling_height_ft": <number or 8>,
      "floor_material": "<hardwood|tile|carpet|vinyl|concrete|laminate|unknown>",
      "wall_material": "<drywall|plaster|tile|paneling|concrete|unknown>"
    }
  ],
  "fixtures": [
    {
      "id": "f1",
      "fixture_type": "<toilet|sink|bathtub|shower|vanity|kitchen_sink|dishwasher|range|refrigerator|washer|dryer|water_heater|furnace|ac_unit|other>",
      "position": {"x": <num>, "y": <num>},
      "room_id": "<room_id or null>",
      "specifications": "<any visible specs>"
    }
  ],
  "dimensions": [
    {
      "id": "dim1",
      "text": "<original dimension text>",
      "value_ft": <number in feet>,
      "start": {"x": <num>, "y": <num>},
      "end": {"x": <num>, "y": <num>}
    }
  ],
  "structural_elements": [
    {
      "id": "se1",
      "element_type": "<beam|column|footing|header|joist|rafter|truss>",
      "position": {"x": <num>, "y": <num>},
      "length_ft": <number>,
      "size": "<e.g. 2x10, LVL>",
      "spacing_in": <number or 16>
    }
  ],
  "notes": ["<any construction notes visible>"],
  "raw_ocr_text": "<all visible text on the page>",
  "confidence": <0-1 overall confidence>
}

If you cannot determine a measurement with certainty, provide your best estimate and lower the confidence score. Use standard construction defaults (8ft ceiling, 2x4 interior walls at 4.5", 2x6 exterior walls at 6") when exact values aren't visible.`;

function generateId(prefix: string, index: number, page: number): string {
  return `${prefix}-p${page}-${index}`;
}

export async function runVisionOCRAgent(
  pages: PDFPageData[],
  apiKey: string,
  onProgress?: (page: number, total: number, status: string) => void
): Promise<AgentResult<PDFPageData[]>> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const auditEntries: AuditEntry[] = [];
  const results: PDFPageData[] = [];

  const ai = new GoogleGenAI({ apiKey });

  // Only analyze floor plans, structural, roof plans, and foundation pages
  const analyzableTypes = [
    'architectural_floor_plan',
    'structural',
    'roof_plan',
    'foundation',
    'plumbing',
    'electrical',
  ];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if (!page.pageType || !analyzableTypes.includes(page.pageType)) {
      results.push(page);
      continue;
    }

    onProgress?.(i + 1, pages.length, `Analyzing ${page.pageType} (page ${page.pageNumber})`);

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
            { text: VISION_OCR_PROMPT },
          ],
        }],
      });

      const text = response.text?.trim() || '';
      const jsonStr = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

      try {
        const parsed = JSON.parse(jsonStr);
        const pageNum = page.pageNumber;

        // Map parsed data to our typed structures with proper IDs
        const walls: ExtractedWall[] = (parsed.walls || []).map((w: Record<string, unknown>, idx: number) => ({
          ...w,
          id: generateId('w', idx, pageNum),
          page_number: pageNum,
          connected_walls: w.connected_walls || [],
        }));

        const doors: ExtractedDoor[] = (parsed.doors || []).map((d: Record<string, unknown>, idx: number) => ({
          ...d,
          id: generateId('d', idx, pageNum),
          page_number: pageNum,
        }));

        const windows: ExtractedWindow[] = (parsed.windows || []).map((w: Record<string, unknown>, idx: number) => ({
          ...w,
          id: generateId('win', idx, pageNum),
          page_number: pageNum,
        }));

        const rooms: ExtractedRoom[] = (parsed.rooms || []).map((r: Record<string, unknown>, idx: number) => ({
          ...r,
          id: generateId('r', idx, pageNum),
          page_number: pageNum,
        }));

        const fixtures: ExtractedFixture[] = (parsed.fixtures || []).map((f: Record<string, unknown>, idx: number) => ({
          ...f,
          id: generateId('f', idx, pageNum),
          page_number: pageNum,
        }));

        const dimensions: ExtractedDimension[] = (parsed.dimensions || []).map((d: Record<string, unknown>, idx: number) => ({
          ...d,
          id: generateId('dim', idx, pageNum),
          page_number: pageNum,
        }));

        const structural_elements: ExtractedStructuralElement[] = (parsed.structural_elements || []).map((s: Record<string, unknown>, idx: number) => ({
          ...s,
          id: generateId('se', idx, pageNum),
          page_number: pageNum,
        }));

        const extractedData: PageExtractedData = {
          scale: parsed.scale || null,
          walls,
          doors,
          windows,
          rooms,
          fixtures,
          dimensions,
          structural_elements,
          notes: parsed.notes || [],
          raw_ocr_text: parsed.raw_ocr_text || '',
          confidence: parsed.confidence || 0,
        };

        results.push({
          ...page,
          analysisComplete: true,
          extractedData,
        });

        auditEntries.push({
          id: `vocr-${i}`,
          timestamp: new Date().toISOString(),
          agent: 'vision_ocr',
          action: 'extract_elements',
          details: `Page ${pageNum}: ${walls.length} walls, ${doors.length} doors, ${windows.length} windows, ${rooms.length} rooms, ${fixtures.length} fixtures (confidence: ${parsed.confidence})`,
          page_number: pageNum,
          data: {
            wall_count: walls.length,
            door_count: doors.length,
            window_count: windows.length,
            room_count: rooms.length,
            fixture_count: fixtures.length,
            confidence: parsed.confidence,
          },
        });

        // Flag low-confidence results
        if ((parsed.confidence || 0) < 0.7) {
          warnings.push(`Page ${pageNum}: Low confidence extraction (${parsed.confidence}). Manual verification recommended.`);
        }
      } catch {
        warnings.push(`Page ${page.pageNumber}: Could not parse extraction response`);
        results.push(page);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Page ${page.pageNumber}: ${msg}`);
      results.push(page);
    }
  }

  return {
    agent: 'vision_ocr',
    success: errors.length === 0,
    data: results,
    errors,
    warnings,
    processing_time_ms: Date.now() - startTime,
    audit_entries: auditEntries,
  };
}
