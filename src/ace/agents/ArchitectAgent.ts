// =============================================================================
// Architect Agent - Builds a Digital Twin from extracted page data
// Merges multi-page extractions into a unified building model.
// =============================================================================

import { GoogleGenAI } from '@google/genai';
import type {
  PDFPageData, DigitalTwin, Building, Floor, RoofData,
  FoundationData, ExteriorData, AgentResult, AuditEntry,
  Clarification, ExtractedRoom,
} from '../types';
import { STANDARD_DIMENSIONS } from '../constants';
import { dataUrlToBase64 } from '../pdf/PdfProcessor';

const ARCHITECT_MERGE_PROMPT = `You are a construction architect AI. Given the extracted data from multiple floor plan pages, merge them into a unified building description.

Here is the extracted data from all analyzed pages:
{EXTRACTED_DATA}

Create a unified building model. Rules:
1. Identify how many stories/floors the building has
2. Assign rooms, walls, doors, windows, fixtures to the correct floor
3. Determine which walls are shared between floors (load-bearing)
4. Estimate total building footprint square footage
5. Determine roof type and approximate area from roof plans or estimate from footprint
6. Determine foundation type if visible
7. Identify exterior finish/siding type if mentioned
8. Flag any AMBIGUITIES that need human verification

Respond with ONLY a valid JSON object (no markdown, no code fences):
{
  "building": {
    "name": "<project name if visible>",
    "stories": <number>,
    "total_sqft": <number>,
    "footprint_sqft": <number>,
    "roof": {
      "type": "<gable|hip|flat|shed|mansard|gambrel|unknown>",
      "total_sqft": <number>,
      "pitch": "<e.g. 6/12>",
      "overhang_ft": <number>
    },
    "foundation": {
      "type": "<slab|crawlspace|basement|pier|unknown>",
      "sqft": <number>,
      "depth_ft": <number>
    },
    "exterior": {
      "siding_type": "<vinyl|wood|brick|stucco|stone|fiber_cement|unknown>",
      "total_exterior_wall_sqft": <number>
    },
    "floor_assignments": [
      {
        "level": <0 for ground, 1 for second, -1 for basement>,
        "name": "<floor name>",
        "ceiling_height_ft": <number>,
        "room_ids": ["<room ids from extracted data>"],
        "wall_ids": ["<wall ids>"],
        "door_ids": ["<door ids>"],
        "window_ids": ["<window ids>"],
        "fixture_ids": ["<fixture ids>"],
        "structural_element_ids": ["<element ids>"]
      }
    ]
  },
  "ambiguities": [
    {
      "question": "<what needs clarification>",
      "context": "<why it's ambiguous>",
      "page_number": <number>,
      "element_id": "<related element id or null>",
      "suggested_answer": "<AI's best guess>"
    }
  ],
  "confidence": <0-1>
}`;

/**
 * Build a Digital Twin from analyzed PDF pages.
 */
export async function runArchitectAgent(
  pages: PDFPageData[],
  apiKey: string,
  projectId: string
): Promise<AgentResult<{ twin: DigitalTwin; clarifications: Clarification[] }>> {
  const startTime = Date.now();
  const errors: string[] = [];
  const warnings: string[] = [];
  const auditEntries: AuditEntry[] = [];

  const ai = new GoogleGenAI({ apiKey });

  // Gather all extracted data
  const analyzedPages = pages.filter(p => p.analysisComplete && p.extractedData);

  if (analyzedPages.length === 0) {
    return {
      agent: 'architect',
      success: false,
      data: { twin: createEmptyTwin(projectId), clarifications: [] },
      errors: ['No analyzed pages available to build Digital Twin'],
      warnings: [],
      processing_time_ms: Date.now() - startTime,
      audit_entries: [],
    };
  }

  // Prepare extracted data summary for the AI
  const extractedSummary = analyzedPages.map(p => ({
    page_number: p.pageNumber,
    page_type: p.pageType,
    data: p.extractedData,
  }));

  const prompt = ARCHITECT_MERGE_PROMPT.replace(
    '{EXTRACTED_DATA}',
    JSON.stringify(extractedSummary, null, 2)
  );

  try {
    // Send the floor plan images along with data for visual context
    const imageParts = analyzedPages.slice(0, 5).map(p => ({
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

    // Build the Digital Twin by merging AI assignments with extracted data
    const allExtractedData = analyzedPages.map(p => p.extractedData!);
    const allWalls = allExtractedData.flatMap(d => d.walls);
    const allDoors = allExtractedData.flatMap(d => d.doors);
    const allWindows = allExtractedData.flatMap(d => d.windows);
    const allRooms = allExtractedData.flatMap(d => d.rooms);
    const allFixtures = allExtractedData.flatMap(d => d.fixtures);
    const allStructural = allExtractedData.flatMap(d => d.structural_elements);

    // Build floors from AI assignments
    const floors: Floor[] = (parsed.building?.floor_assignments || []).map((fa: Record<string, unknown>) => {
      const roomIds = (fa.room_ids as string[]) || [];
      const wallIds = (fa.wall_ids as string[]) || [];
      const doorIds = (fa.door_ids as string[]) || [];
      const windowIds = (fa.window_ids as string[]) || [];
      const fixtureIds = (fa.fixture_ids as string[]) || [];
      const structIds = (fa.structural_element_ids as string[]) || [];

      return {
        level: fa.level as number,
        name: fa.name as string,
        ceiling_height_ft: (fa.ceiling_height_ft as number) || STANDARD_DIMENSIONS.CEILING_HEIGHT_FT,
        rooms: roomIds.length > 0
          ? allRooms.filter(r => roomIds.includes(r.id))
          : allRooms, // fallback: assign all rooms to this floor
        walls: wallIds.length > 0
          ? allWalls.filter(w => wallIds.includes(w.id))
          : allWalls,
        doors: doorIds.length > 0
          ? allDoors.filter(d => doorIds.includes(d.id))
          : allDoors,
        windows: windowIds.length > 0
          ? allWindows.filter(w => windowIds.includes(w.id))
          : allWindows,
        fixtures: fixtureIds.length > 0
          ? allFixtures.filter(f => fixtureIds.includes(f.id))
          : allFixtures,
        structural_elements: structIds.length > 0
          ? allStructural.filter(s => structIds.includes(s.id))
          : allStructural,
      };
    });

    // If no floors were created, create a default ground floor with all elements
    if (floors.length === 0) {
      floors.push({
        level: 0,
        name: 'Ground Floor',
        ceiling_height_ft: STANDARD_DIMENSIONS.CEILING_HEIGHT_FT,
        rooms: allRooms,
        walls: allWalls,
        doors: allDoors,
        windows: allWindows,
        fixtures: allFixtures,
        structural_elements: allStructural,
      });
    }

    const bldg = parsed.building || {};

    const roof: RoofData = {
      type: bldg.roof?.type || 'unknown',
      total_sqft: bldg.roof?.total_sqft || bldg.footprint_sqft || calculateFootprintFromRooms(allRooms),
      pitch: bldg.roof?.pitch || '6/12',
      overhang_ft: bldg.roof?.overhang_ft || 1,
    };

    const foundation: FoundationData = {
      type: bldg.foundation?.type || 'unknown',
      sqft: bldg.foundation?.sqft || bldg.footprint_sqft || calculateFootprintFromRooms(allRooms),
      depth_ft: bldg.foundation?.depth_ft || 4,
    };

    const exteriorWallSqft = allWalls
      .filter(w => w.is_exterior)
      .reduce((sum, w) => sum + w.length_ft * (w.height_ft || STANDARD_DIMENSIONS.CEILING_HEIGHT_FT), 0);

    const exterior: ExteriorData = {
      siding_type: bldg.exterior?.siding_type || 'unknown',
      total_exterior_wall_sqft: bldg.exterior?.total_exterior_wall_sqft || exteriorWallSqft,
    };

    const building: Building = {
      name: bldg.name || 'Untitled Project',
      stories: bldg.stories || floors.length,
      total_sqft: bldg.total_sqft || allRooms.reduce((s, r) => s + r.area_sqft, 0),
      footprint_sqft: bldg.footprint_sqft || calculateFootprintFromRooms(allRooms),
      floors,
      roof,
      foundation,
      exterior,
    };

    const twin: DigitalTwin = {
      id: `twin-${Date.now()}`,
      project_id: projectId,
      created_at: new Date().toISOString(),
      verified: false,
      building,
      verification_notes: [],
    };

    // Convert ambiguities to clarifications
    const clarifications: Clarification[] = (parsed.ambiguities || []).map(
      (amb: Record<string, unknown>, idx: number) => ({
        id: `clar-${idx}`,
        level: amb.suggested_answer ? 1 : 2,
        question: amb.question as string,
        context: {
          page_number: amb.page_number as number,
          region: null,
          related_elements: amb.element_id ? [amb.element_id as string] : [],
          description: amb.context as string,
        },
        status: 'pending' as const,
        ai_answer: (amb.suggested_answer as string) || null,
        contractor_answer: null,
        resolved_at: null,
        page_number: amb.page_number as number,
        element_id: (amb.element_id as string) || null,
      })
    );

    auditEntries.push({
      id: 'arch-build',
      timestamp: new Date().toISOString(),
      agent: 'architect',
      action: 'build_twin',
      details: `Built Digital Twin: ${building.stories} stories, ${building.total_sqft} sqft, ${floors.reduce((s, f) => s + f.rooms.length, 0)} rooms, ${clarifications.length} clarifications needed`,
      page_number: null,
      data: {
        stories: building.stories,
        total_sqft: building.total_sqft,
        rooms: floors.reduce((s, f) => s + f.rooms.length, 0),
        walls: floors.reduce((s, f) => s + f.walls.length, 0),
        clarifications: clarifications.length,
      },
    });

    return {
      agent: 'architect',
      success: true,
      data: { twin, clarifications },
      errors,
      warnings,
      processing_time_ms: Date.now() - startTime,
      audit_entries: auditEntries,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Architect agent failed: ${msg}`);

    return {
      agent: 'architect',
      success: false,
      data: { twin: createEmptyTwin(projectId), clarifications: [] },
      errors,
      warnings,
      processing_time_ms: Date.now() - startTime,
      audit_entries: auditEntries,
    };
  }
}

function calculateFootprintFromRooms(rooms: ExtractedRoom[]): number {
  return rooms.reduce((sum, r) => sum + r.area_sqft, 0);
}

function createEmptyTwin(projectId: string): DigitalTwin {
  return {
    id: `twin-${Date.now()}`,
    project_id: projectId,
    created_at: new Date().toISOString(),
    verified: false,
    building: {
      name: 'Untitled',
      stories: 1,
      total_sqft: 0,
      footprint_sqft: 0,
      floors: [],
      roof: { type: 'unknown', total_sqft: 0, pitch: '6/12', overhang_ft: 1 },
      foundation: { type: 'unknown', sqft: 0, depth_ft: 4 },
      exterior: { siding_type: 'unknown', total_exterior_wall_sqft: 0 },
    },
    verification_notes: [],
  };
}
