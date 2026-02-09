// =============================================================================
// Drywall Computation - Pure Math, No AI
// =============================================================================

import { DRYWALL, WASTE_FACTOR, STANDARD_DIMENSIONS } from '../constants';
import type {
  ExtractedWall, ExtractedRoom, MaterialItem, CalculationAudit,
} from '../types';

export interface DrywallInput {
  walls: ExtractedWall[];
  rooms: ExtractedRoom[];
  ceiling_height_ft: number;
}

export interface DrywallResult {
  wall_sheets: MaterialItem;
  ceiling_sheets: MaterialItem;
  moisture_resistant_sheets: MaterialItem;
  drywall_screws: MaterialItem;
  joint_tape: MaterialItem;
  joint_compound: MaterialItem;
  total_wall_sqft: number;
  total_ceiling_sqft: number;
}

/**
 * Calculate total wall surface area needing drywall.
 * Interior walls get BOTH sides. Exterior walls get interior side only.
 * Window/door openings are NOT subtracted (per spec: count as wall sqft for estimation).
 */
function calculateWallDrywallSqft(
  walls: ExtractedWall[],
  ceiling_height_ft: number
): { total_sqft: number; audit: CalculationAudit } {
  const steps: string[] = [];
  let total_sqft = 0;

  const inputs: Record<string, number | string> = {
    total_walls: walls.length,
    ceiling_height_ft,
    interior_sides: DRYWALL.INTERIOR_WALL_SIDES,
    exterior_sides: DRYWALL.EXTERIOR_WALL_SIDES,
  };

  for (const wall of walls) {
    const wall_area = wall.length_ft * (wall.height_ft || ceiling_height_ft);
    const sides = wall.is_exterior ? DRYWALL.EXTERIOR_WALL_SIDES : DRYWALL.INTERIOR_WALL_SIDES;
    const wall_total = wall_area * sides;
    total_sqft += wall_total;
    steps.push(
      `Wall ${wall.id}: ${wall.length_ft}ft x ${wall.height_ft || ceiling_height_ft}ft x ${sides} side(s) = ${wall_total.toFixed(2)} sqft`
    );
  }

  steps.push(`Total wall drywall area: ${total_sqft.toFixed(2)} sqft`);

  return {
    total_sqft,
    audit: {
      formula: 'sum(wall_length × wall_height × sides_count)',
      inputs,
      steps,
      result: total_sqft,
    },
  };
}

/**
 * Calculate ceiling drywall area from rooms.
 */
function calculateCeilingDrywallSqft(
  rooms: ExtractedRoom[]
): { total_sqft: number; audit: CalculationAudit } {
  const steps: string[] = [];
  let total_sqft = 0;

  for (const room of rooms) {
    // Garages typically don't get finished ceilings unless specified
    if (room.room_type === 'garage') {
      steps.push(`Room "${room.name}" (garage): skipped for ceiling drywall`);
      continue;
    }
    total_sqft += room.area_sqft;
    steps.push(`Room "${room.name}": ${room.area_sqft.toFixed(2)} sqft ceiling area`);
  }

  steps.push(`Total ceiling drywall area: ${total_sqft.toFixed(2)} sqft`);

  return {
    total_sqft,
    audit: {
      formula: 'sum(room_area_sqft) excluding garages',
      inputs: { total_rooms: rooms.length },
      steps,
      result: total_sqft,
    },
  };
}

/**
 * Calculate moisture-resistant drywall for wet areas (bathrooms, kitchens, laundry).
 */
function calculateMoistureResistantSqft(
  _walls: ExtractedWall[],
  rooms: ExtractedRoom[],
  ceiling_height_ft: number
): { total_sqft: number; audit: CalculationAudit } {
  const steps: string[] = [];
  let total_sqft = 0;
  const WET_TYPES = ['bathroom', 'kitchen', 'laundry'];

  const wetRooms = rooms.filter(r => WET_TYPES.includes(r.room_type));
  steps.push(`Found ${wetRooms.length} wet rooms requiring moisture-resistant drywall`);

  for (const room of wetRooms) {
    // Wall area for wet rooms (perimeter × height)
    const wall_area = room.perimeter_ft * (room.ceiling_height_ft || ceiling_height_ft);
    total_sqft += wall_area;
    steps.push(
      `Room "${room.name}" (${room.room_type}): ${room.perimeter_ft}ft perimeter × ${room.ceiling_height_ft || ceiling_height_ft}ft = ${wall_area.toFixed(2)} sqft`
    );
  }

  steps.push(`Total moisture-resistant area: ${total_sqft.toFixed(2)} sqft`);
  steps.push(`Note: This amount is INCLUDED in the total wall drywall count, not additional`);

  return {
    total_sqft,
    audit: {
      formula: 'sum(wet_room_perimeter × ceiling_height)',
      inputs: { wet_rooms: wetRooms.length },
      steps,
      result: total_sqft,
    },
  };
}

/**
 * Master drywall calculation function.
 */
export function calculateDrywall(input: DrywallInput): DrywallResult {
  const ceiling_height = input.ceiling_height_ft || STANDARD_DIMENSIONS.CEILING_HEIGHT_FT;

  const wallResult = calculateWallDrywallSqft(input.walls, ceiling_height);
  const ceilingResult = calculateCeilingDrywallSqft(input.rooms);
  const moistureResult = calculateMoistureResistantSqft(input.walls, input.rooms, ceiling_height);

  // Standard drywall sheets (total wall area minus moisture-resistant areas)
  const standard_wall_sqft = wallResult.total_sqft - moistureResult.total_sqft;
  const standard_wall_sheets_raw = standard_wall_sqft / DRYWALL.SHEET_SQFT;
  const standard_wall_sheets = Math.ceil(standard_wall_sheets_raw);

  // Ceiling sheets (5/8" fire-rated)
  const ceiling_sheets_raw = ceilingResult.total_sqft / DRYWALL.SHEET_SQFT;
  const ceiling_sheets = Math.ceil(ceiling_sheets_raw);

  // Moisture-resistant sheets
  const moisture_sheets_raw = moistureResult.total_sqft / DRYWALL.SHEET_SQFT;
  const moisture_sheets = Math.ceil(moisture_sheets_raw);

  const total_sheets = standard_wall_sheets + ceiling_sheets + moisture_sheets;
  const total_sqft = wallResult.total_sqft + ceilingResult.total_sqft;

  // Ancillary materials
  const screws_needed = total_sheets * DRYWALL.SCREWS_PER_SHEET;
  const tape_ft = total_sheets * DRYWALL.JOINT_TAPE_FT_PER_SHEET;
  const mud_gallons = (total_sqft / 1000) * DRYWALL.MUD_GALLONS_PER_1000_SQFT;

  return {
    wall_sheets: {
      id: 'drywall-standard-wall',
      name: 'Drywall Sheets (1/2" Standard)',
      description: `4×8 ft sheets for interior walls (both sides of interior, one side of exterior)`,
      quantity: standard_wall_sheets,
      unit: 'sheets',
      quantity_with_waste: Math.ceil(standard_wall_sheets * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil(standard_wall_sqft / sheet_sqft)',
        inputs: {
          standard_wall_sqft: Number(standard_wall_sqft.toFixed(2)),
          sheet_sqft: DRYWALL.SHEET_SQFT,
        },
        steps: [
          ...wallResult.audit.steps,
          `Standard wall sqft (excluding wet areas): ${standard_wall_sqft.toFixed(2)}`,
          `Sheets needed: ceil(${standard_wall_sqft.toFixed(2)} / ${DRYWALL.SHEET_SQFT}) = ${standard_wall_sheets}`,
          `With ${WASTE_FACTOR * 100}% waste: ${Math.ceil(standard_wall_sheets * (1 + WASTE_FACTOR))}`,
        ],
        result: standard_wall_sheets,
      },
    },
    ceiling_sheets: {
      id: 'drywall-ceiling',
      name: 'Drywall Sheets (5/8" Fire-Rated Ceiling)',
      description: '4×8 ft sheets for ceilings',
      quantity: ceiling_sheets,
      unit: 'sheets',
      quantity_with_waste: Math.ceil(ceiling_sheets * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil(ceiling_sqft / sheet_sqft)',
        inputs: {
          ceiling_sqft: Number(ceilingResult.total_sqft.toFixed(2)),
          sheet_sqft: DRYWALL.SHEET_SQFT,
        },
        steps: [
          ...ceilingResult.audit.steps,
          `Sheets needed: ceil(${ceilingResult.total_sqft.toFixed(2)} / ${DRYWALL.SHEET_SQFT}) = ${ceiling_sheets}`,
          `With ${WASTE_FACTOR * 100}% waste: ${Math.ceil(ceiling_sheets * (1 + WASTE_FACTOR))}`,
        ],
        result: ceiling_sheets,
      },
    },
    moisture_resistant_sheets: {
      id: 'drywall-moisture',
      name: 'Drywall Sheets (5/8" Moisture Resistant)',
      description: 'Green board for bathrooms, kitchens, laundry areas',
      quantity: moisture_sheets,
      unit: 'sheets',
      quantity_with_waste: Math.ceil(moisture_sheets * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil(moisture_sqft / sheet_sqft)',
        inputs: {
          moisture_sqft: Number(moistureResult.total_sqft.toFixed(2)),
          sheet_sqft: DRYWALL.SHEET_SQFT,
        },
        steps: [
          ...moistureResult.audit.steps,
          `Sheets needed: ceil(${moistureResult.total_sqft.toFixed(2)} / ${DRYWALL.SHEET_SQFT}) = ${moisture_sheets}`,
        ],
        result: moisture_sheets,
      },
    },
    drywall_screws: {
      id: 'drywall-screws',
      name: 'Drywall Screws (#6 1-5/8")',
      description: 'Coarse thread drywall screws',
      quantity: screws_needed,
      unit: 'each',
      quantity_with_waste: Math.ceil(screws_needed * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'total_sheets × screws_per_sheet',
        inputs: { total_sheets, screws_per_sheet: DRYWALL.SCREWS_PER_SHEET },
        steps: [`${total_sheets} sheets × ${DRYWALL.SCREWS_PER_SHEET} screws = ${screws_needed}`],
        result: screws_needed,
      },
    },
    joint_tape: {
      id: 'drywall-tape',
      name: 'Joint Tape',
      description: 'Paper joint tape for drywall seams',
      quantity: Math.ceil(tape_ft),
      unit: 'linear_ft',
      quantity_with_waste: Math.ceil(tape_ft * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'total_sheets × tape_per_sheet',
        inputs: { total_sheets, tape_per_sheet: DRYWALL.JOINT_TAPE_FT_PER_SHEET },
        steps: [`${total_sheets} sheets × ${DRYWALL.JOINT_TAPE_FT_PER_SHEET} ft = ${tape_ft.toFixed(0)} ft`],
        result: Math.ceil(tape_ft),
      },
    },
    joint_compound: {
      id: 'drywall-mud',
      name: 'Joint Compound (All Purpose)',
      description: 'Pre-mixed all-purpose joint compound',
      quantity: Math.ceil(mud_gallons),
      unit: 'gallons',
      quantity_with_waste: Math.ceil(mud_gallons * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: '(total_sqft / 1000) × gallons_per_1000sqft',
        inputs: { total_sqft: Number(total_sqft.toFixed(2)), gallons_per_1000: DRYWALL.MUD_GALLONS_PER_1000_SQFT },
        steps: [`(${total_sqft.toFixed(2)} / 1000) × ${DRYWALL.MUD_GALLONS_PER_1000_SQFT} = ${mud_gallons.toFixed(2)} gallons`],
        result: Math.ceil(mud_gallons),
      },
    },
    total_wall_sqft: wallResult.total_sqft,
    total_ceiling_sqft: ceilingResult.total_sqft,
  };
}
