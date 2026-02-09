// =============================================================================
// Framing Computation - Pure Math, No AI
// =============================================================================

import { FRAMING, WASTE_FACTOR, STANDARD_DIMENSIONS } from '../constants';
import type {
  ExtractedWall, ExtractedDoor, ExtractedWindow,
  MaterialItem,
} from '../types';

export interface FramingInput {
  walls: ExtractedWall[];
  doors: ExtractedDoor[];
  windows: ExtractedWindow[];
  ceiling_height_ft: number;
}

export interface FramingResult {
  wall_studs: MaterialItem;
  top_plates: MaterialItem;
  bottom_plates: MaterialItem;
  headers: MaterialItem;
  king_studs: MaterialItem;
  jack_studs: MaterialItem;
  cripple_studs: MaterialItem;
  blocking: MaterialItem;
}

/**
 * Calculate the number of studs for a wall at 16" OC spacing.
 * Formula: floor(wall_length_inches / spacing) + 1
 */
function calculateStudsForWall(wall_length_ft: number): number {
  const wall_length_in = wall_length_ft * 12;
  return Math.floor(wall_length_in / FRAMING.STUD_SPACING_OC_IN) + 1;
}

/**
 * Calculate headers needed for door/window openings.
 */
function calculateHeaders(
  doors: ExtractedDoor[],
  windows: ExtractedWindow[]
): { count: number; details: string[] } {
  const details: string[] = [];
  let count = 0;

  for (const door of doors) {
    count += 1; // Each opening needs a header
    const width = Math.ceil(door.width_ft);
    const size = FRAMING.HEADER_SIZES[width] || '2x12';
    details.push(`Door ${door.id}: ${door.width_ft}ft opening → ${size} header`);
  }

  for (const win of windows) {
    count += 1;
    const width = Math.ceil(win.width_ft);
    const size = FRAMING.HEADER_SIZES[width] || '2x10';
    details.push(`Window ${win.id}: ${win.width_ft}ft opening → ${size} header`);
  }

  return { count, details };
}

/**
 * Calculate cripple studs (short studs above/below openings).
 */
function calculateCrippleStuds(
  doors: ExtractedDoor[],
  windows: ExtractedWindow[],
  _ceiling_height_ft: number
): { count: number; details: string[] } {
  const details: string[] = [];
  let count = 0;

  // Cripple studs above doors
  for (const door of doors) {
    const opening_width_in = door.width_ft * 12;
    const cripples = Math.floor(opening_width_in / FRAMING.CRIPPLE_SPACING_IN) + 1;
    count += cripples;
    details.push(`Door ${door.id}: ${cripples} cripple studs above opening`);
  }

  // Cripple studs above AND below windows
  for (const win of windows) {
    const opening_width_in = win.width_ft * 12;
    const cripples_per_section = Math.floor(opening_width_in / FRAMING.CRIPPLE_SPACING_IN) + 1;
    // Above window
    count += cripples_per_section;
    // Below window (sill cripples)
    count += cripples_per_section;
    details.push(
      `Window ${win.id}: ${cripples_per_section} cripples above + ${cripples_per_section} below = ${cripples_per_section * 2}`
    );
  }

  return { count, details };
}

/**
 * Master framing calculation function.
 */
export function calculateFraming(input: FramingInput): FramingResult {
  const ceiling_height = input.ceiling_height_ft || STANDARD_DIMENSIONS.CEILING_HEIGHT_FT;
  const stud_length_label = `${ceiling_height}ft (${ceiling_height * 12}" pre-cut)`;

  // --- Wall Studs ---
  const studSteps: string[] = [];
  let total_studs = 0;

  for (const wall of input.walls) {
    const studs = calculateStudsForWall(wall.length_ft);
    total_studs += studs;
    studSteps.push(
      `Wall ${wall.id}: ${wall.length_ft}ft → floor(${(wall.length_ft * 12).toFixed(0)}" / ${FRAMING.STUD_SPACING_OC_IN}") + 1 = ${studs} studs`
    );
  }

  // Add corner studs (3 per corner for proper nailing surface)
  // Estimate corners as number of walls (each wall connection = corner)
  const corner_studs = input.walls.length; // 1 extra per wall for corners
  total_studs += corner_studs;
  studSteps.push(`Corner studs: ${corner_studs} additional (1 per wall intersection)`);
  studSteps.push(`Total wall studs: ${total_studs}`);

  // --- Plates ---
  let total_plate_length_ft = 0;
  const plateSteps: string[] = [];

  for (const wall of input.walls) {
    total_plate_length_ft += wall.length_ft;
  }

  const top_plate_ft = total_plate_length_ft * FRAMING.TOP_PLATES_COUNT;
  const bottom_plate_ft = total_plate_length_ft * FRAMING.BOTTOM_PLATE_COUNT;

  plateSteps.push(`Total wall length: ${total_plate_length_ft.toFixed(2)} ft`);
  plateSteps.push(`Top plates (double): ${total_plate_length_ft.toFixed(2)} × ${FRAMING.TOP_PLATES_COUNT} = ${top_plate_ft.toFixed(2)} linear ft`);
  plateSteps.push(`Bottom plate (single): ${total_plate_length_ft.toFixed(2)} × ${FRAMING.BOTTOM_PLATE_COUNT} = ${bottom_plate_ft.toFixed(2)} linear ft`);

  // --- Headers ---
  const headerResult = calculateHeaders(input.doors, input.windows);

  // --- King & Jack Studs ---
  const total_openings = input.doors.length + input.windows.length;
  const king_studs_total = total_openings * FRAMING.KING_STUDS_PER_OPENING;
  const jack_studs_total = total_openings * FRAMING.JACK_STUDS_PER_OPENING;

  // --- Cripple Studs ---
  const crippleResult = calculateCrippleStuds(input.doors, input.windows, ceiling_height);

  // --- Blocking (fire stops, mid-wall backing) ---
  // Rule of thumb: 1 row of blocking per wall at mid-height for walls > 8ft
  let blocking_ft = 0;
  const blockSteps: string[] = [];
  for (const wall of input.walls) {
    if ((wall.height_ft || ceiling_height) > 8) {
      blocking_ft += wall.length_ft;
      blockSteps.push(`Wall ${wall.id}: ${wall.length_ft}ft blocking (wall > 8ft)`);
    }
  }
  if (blocking_ft === 0) {
    blockSteps.push('No blocking needed (all walls ≤ 8ft)');
  }

  return {
    wall_studs: {
      id: 'framing-studs',
      name: `Wall Studs (${FRAMING.STANDARD_STUD_SIZE} × ${stud_length_label})`,
      description: `Pre-cut studs at ${FRAMING.STUD_SPACING_OC_IN}" on center`,
      quantity: total_studs,
      unit: 'pieces',
      quantity_with_waste: Math.ceil(total_studs * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'sum(floor(wall_length_in / 16) + 1) + corner_studs',
        inputs: { total_walls: input.walls.length, spacing_oc: FRAMING.STUD_SPACING_OC_IN },
        steps: studSteps,
        result: total_studs,
      },
    },
    top_plates: {
      id: 'framing-top-plates',
      name: `Top Plates (${FRAMING.STANDARD_STUD_SIZE} double)`,
      description: 'Double top plate for all walls',
      quantity: Math.ceil(top_plate_ft),
      unit: 'linear_ft',
      quantity_with_waste: Math.ceil(top_plate_ft * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'total_wall_length × 2 (double top plate)',
        inputs: { total_wall_length_ft: Number(total_plate_length_ft.toFixed(2)) },
        steps: plateSteps,
        result: Math.ceil(top_plate_ft),
      },
    },
    bottom_plates: {
      id: 'framing-bottom-plates',
      name: `Bottom Plate (${FRAMING.STANDARD_STUD_SIZE})`,
      description: 'Single bottom plate (sill plate) for all walls',
      quantity: Math.ceil(bottom_plate_ft),
      unit: 'linear_ft',
      quantity_with_waste: Math.ceil(bottom_plate_ft * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'total_wall_length × 1 (single bottom plate)',
        inputs: { total_wall_length_ft: Number(total_plate_length_ft.toFixed(2)) },
        steps: plateSteps,
        result: Math.ceil(bottom_plate_ft),
      },
    },
    headers: {
      id: 'framing-headers',
      name: 'Headers (various sizes)',
      description: 'Load-bearing headers above door and window openings',
      quantity: headerResult.count,
      unit: 'pieces',
      quantity_with_waste: Math.ceil(headerResult.count * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: '1 header per opening',
        inputs: { doors: input.doors.length, windows: input.windows.length },
        steps: headerResult.details,
        result: headerResult.count,
      },
    },
    king_studs: {
      id: 'framing-king-studs',
      name: `King Studs (${FRAMING.STANDARD_STUD_SIZE})`,
      description: 'Full-height studs flanking each opening',
      quantity: king_studs_total,
      unit: 'pieces',
      quantity_with_waste: Math.ceil(king_studs_total * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'total_openings × 2',
        inputs: { total_openings, per_opening: FRAMING.KING_STUDS_PER_OPENING },
        steps: [`${total_openings} openings × ${FRAMING.KING_STUDS_PER_OPENING} = ${king_studs_total}`],
        result: king_studs_total,
      },
    },
    jack_studs: {
      id: 'framing-jack-studs',
      name: `Jack Studs / Trimmers (${FRAMING.STANDARD_STUD_SIZE})`,
      description: 'Shortened studs supporting headers',
      quantity: jack_studs_total,
      unit: 'pieces',
      quantity_with_waste: Math.ceil(jack_studs_total * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'total_openings × 2',
        inputs: { total_openings, per_opening: FRAMING.JACK_STUDS_PER_OPENING },
        steps: [`${total_openings} openings × ${FRAMING.JACK_STUDS_PER_OPENING} = ${jack_studs_total}`],
        result: jack_studs_total,
      },
    },
    cripple_studs: {
      id: 'framing-cripples',
      name: `Cripple Studs (${FRAMING.STANDARD_STUD_SIZE})`,
      description: 'Short studs above/below openings',
      quantity: crippleResult.count,
      unit: 'pieces',
      quantity_with_waste: Math.ceil(crippleResult.count * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'floor(opening_width_in / 16) + 1 per section',
        inputs: { doors: input.doors.length, windows: input.windows.length },
        steps: crippleResult.details,
        result: crippleResult.count,
      },
    },
    blocking: {
      id: 'framing-blocking',
      name: `Blocking (${FRAMING.STANDARD_STUD_SIZE})`,
      description: 'Fire stops and mid-wall blocking',
      quantity: Math.ceil(blocking_ft),
      unit: 'linear_ft',
      quantity_with_waste: Math.ceil(blocking_ft * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'wall_length for walls > 8ft',
        inputs: { walls_over_8ft: blockSteps.length },
        steps: blockSteps,
        result: Math.ceil(blocking_ft),
      },
    },
  };
}
