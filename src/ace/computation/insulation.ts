// =============================================================================
// Insulation Computation - Pure Math, No AI
// =============================================================================

import { INSULATION, WASTE_FACTOR, STANDARD_DIMENSIONS } from '../constants';
import type { ExtractedWall, ExtractedRoom, MaterialItem } from '../types';

export interface InsulationInput {
  walls: ExtractedWall[];
  rooms: ExtractedRoom[];
  ceiling_height_ft: number;
  ceiling_sqft: number; // total ceiling area for attic insulation
}

export interface InsulationResult {
  exterior_wall_batts: MaterialItem;
  interior_wall_batts: MaterialItem;
  ceiling_insulation: MaterialItem;
}

/**
 * Calculate insulation for exterior walls (R-19 for 2x6, R-13 for 2x4).
 */
export function calculateInsulation(input: InsulationInput): InsulationResult {
  const ceiling_height = input.ceiling_height_ft || STANDARD_DIMENSIONS.CEILING_HEIGHT_FT;

  // --- Exterior Wall Insulation ---
  let exterior_wall_sqft = 0;
  const extSteps: string[] = [];

  const exteriorWalls = input.walls.filter(w => w.is_exterior);
  for (const wall of exteriorWalls) {
    const area = wall.length_ft * (wall.height_ft || ceiling_height);
    exterior_wall_sqft += area;
    extSteps.push(`Exterior wall ${wall.id}: ${wall.length_ft}ft × ${wall.height_ft || ceiling_height}ft = ${area.toFixed(2)} sqft`);
  }
  extSteps.push(`Total exterior wall insulation area: ${exterior_wall_sqft.toFixed(2)} sqft`);

  // --- Interior Wall Insulation (sound insulation for bathrooms, bedrooms) ---
  let interior_wall_sqft = 0;
  const intSteps: string[] = [];
  // Find walls that border insulated room types
  const interiorWalls = input.walls.filter(w => !w.is_exterior);
  // For simplicity, estimate ~30% of interior walls get sound insulation
  for (const wall of interiorWalls) {
    const area = wall.length_ft * (wall.height_ft || ceiling_height);
    interior_wall_sqft += area;
  }
  // Apply 30% factor for sound insulation walls
  const sound_insulation_sqft = interior_wall_sqft * 0.3;
  intSteps.push(`Total interior wall area: ${interior_wall_sqft.toFixed(2)} sqft`);
  intSteps.push(`Estimated sound insulation (30% of interior walls): ${sound_insulation_sqft.toFixed(2)} sqft`);

  // --- Ceiling / Attic Insulation ---
  const ceiling_sqft = input.ceiling_sqft;
  const ceilSteps: string[] = [];
  ceilSteps.push(`Total ceiling insulation area: ${ceiling_sqft.toFixed(2)} sqft`);
  ceilSteps.push(`R-value: R-${INSULATION.R_VALUES.ceiling}`);

  return {
    exterior_wall_batts: {
      id: 'insulation-exterior',
      name: `Exterior Wall Insulation (R-${INSULATION.R_VALUES['2x6_wall']})`,
      description: 'Fiberglass batt insulation for exterior walls (2x6 framing)',
      quantity: Math.ceil(exterior_wall_sqft),
      unit: 'sqft',
      quantity_with_waste: Math.ceil(exterior_wall_sqft * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'sum(exterior_wall_length × wall_height)',
        inputs: { exterior_walls: exteriorWalls.length, ceiling_height },
        steps: extSteps,
        result: Math.ceil(exterior_wall_sqft),
      },
    },
    interior_wall_batts: {
      id: 'insulation-interior',
      name: `Interior Wall Sound Insulation (R-${INSULATION.R_VALUES['2x4_wall']})`,
      description: 'Sound deadening insulation for select interior walls',
      quantity: Math.ceil(sound_insulation_sqft),
      unit: 'sqft',
      quantity_with_waste: Math.ceil(sound_insulation_sqft * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'sum(interior_wall_area) × 0.30',
        inputs: { interior_walls: interiorWalls.length },
        steps: intSteps,
        result: Math.ceil(sound_insulation_sqft),
      },
    },
    ceiling_insulation: {
      id: 'insulation-ceiling',
      name: `Ceiling / Attic Insulation (R-${INSULATION.R_VALUES.ceiling})`,
      description: 'Blown-in or batt insulation for ceiling/attic',
      quantity: Math.ceil(ceiling_sqft),
      unit: 'sqft',
      quantity_with_waste: Math.ceil(ceiling_sqft * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'total_ceiling_sqft',
        inputs: { ceiling_sqft },
        steps: ceilSteps,
        result: Math.ceil(ceiling_sqft),
      },
    },
  };
}
