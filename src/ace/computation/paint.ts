// =============================================================================
// Paint Computation - Pure Math, No AI
// =============================================================================

import { PAINT, WASTE_FACTOR } from '../constants';
import type { MaterialItem } from '../types';

export interface PaintInput {
  total_wall_sqft: number;   // from drywall calculations
  total_ceiling_sqft: number;
  trim_linear_ft: number;    // door + window trim
}

export interface PaintResult {
  wall_paint: MaterialItem;
  wall_primer: MaterialItem;
  ceiling_paint: MaterialItem;
  trim_paint: MaterialItem;
}

/**
 * Calculate paint quantities.
 * Walls get 2 coats of paint + 1 coat primer.
 * Ceilings get 2 coats.
 * Trim gets 2 coats.
 */
export function calculatePaint(input: PaintInput): PaintResult {
  // Wall paint (2 coats)
  const wall_paint_gallons = (input.total_wall_sqft * PAINT.COATS) / PAINT.COVERAGE_SQFT_PER_GALLON;

  // Wall primer (1 coat)
  const wall_primer_gallons = input.total_wall_sqft / PAINT.PRIMER_COVERAGE_SQFT_PER_GALLON;

  // Ceiling paint (2 coats)
  const ceiling_paint_gallons = (input.total_ceiling_sqft * PAINT.COATS) / PAINT.COVERAGE_SQFT_PER_GALLON;

  // Trim paint (estimate ~1 sqft per linear ft of trim × 2 coats)
  const trim_paint_gallons = (input.trim_linear_ft * PAINT.COATS) / PAINT.COVERAGE_SQFT_PER_GALLON;

  return {
    wall_paint: {
      id: 'paint-walls',
      name: 'Interior Wall Paint',
      description: `Latex interior paint (${PAINT.COATS} coats)`,
      quantity: Math.ceil(wall_paint_gallons),
      unit: 'gallons',
      quantity_with_waste: Math.ceil(wall_paint_gallons * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: '(wall_sqft × coats) / coverage_per_gallon',
        inputs: {
          wall_sqft: Number(input.total_wall_sqft.toFixed(2)),
          coats: PAINT.COATS,
          coverage: PAINT.COVERAGE_SQFT_PER_GALLON,
        },
        steps: [
          `Wall area: ${input.total_wall_sqft.toFixed(2)} sqft`,
          `Coverage: ${PAINT.COVERAGE_SQFT_PER_GALLON} sqft/gallon × ${PAINT.COATS} coats`,
          `Gallons: (${input.total_wall_sqft.toFixed(2)} × ${PAINT.COATS}) / ${PAINT.COVERAGE_SQFT_PER_GALLON} = ${wall_paint_gallons.toFixed(2)}`,
          `Rounded up: ${Math.ceil(wall_paint_gallons)} gallons`,
        ],
        result: Math.ceil(wall_paint_gallons),
      },
    },
    wall_primer: {
      id: 'paint-primer',
      name: 'Wall Primer',
      description: 'Interior latex primer (1 coat)',
      quantity: Math.ceil(wall_primer_gallons),
      unit: 'gallons',
      quantity_with_waste: Math.ceil(wall_primer_gallons * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'wall_sqft / primer_coverage_per_gallon',
        inputs: {
          wall_sqft: Number(input.total_wall_sqft.toFixed(2)),
          coverage: PAINT.PRIMER_COVERAGE_SQFT_PER_GALLON,
        },
        steps: [
          `${input.total_wall_sqft.toFixed(2)} / ${PAINT.PRIMER_COVERAGE_SQFT_PER_GALLON} = ${wall_primer_gallons.toFixed(2)} gallons`,
        ],
        result: Math.ceil(wall_primer_gallons),
      },
    },
    ceiling_paint: {
      id: 'paint-ceiling',
      name: 'Ceiling Paint',
      description: `Flat ceiling paint (${PAINT.COATS} coats)`,
      quantity: Math.ceil(ceiling_paint_gallons),
      unit: 'gallons',
      quantity_with_waste: Math.ceil(ceiling_paint_gallons * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: '(ceiling_sqft × coats) / coverage_per_gallon',
        inputs: {
          ceiling_sqft: Number(input.total_ceiling_sqft.toFixed(2)),
          coats: PAINT.COATS,
        },
        steps: [
          `(${input.total_ceiling_sqft.toFixed(2)} × ${PAINT.COATS}) / ${PAINT.COVERAGE_SQFT_PER_GALLON} = ${ceiling_paint_gallons.toFixed(2)} gallons`,
        ],
        result: Math.ceil(ceiling_paint_gallons),
      },
    },
    trim_paint: {
      id: 'paint-trim',
      name: 'Trim Paint (Semi-Gloss)',
      description: `Semi-gloss paint for door/window trim (${PAINT.COATS} coats)`,
      quantity: Math.ceil(trim_paint_gallons),
      unit: 'gallons',
      quantity_with_waste: Math.ceil(trim_paint_gallons * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: '(trim_linear_ft × coats) / coverage_per_gallon',
        inputs: {
          trim_linear_ft: Number(input.trim_linear_ft.toFixed(2)),
          coats: PAINT.COATS,
        },
        steps: [
          `(${input.trim_linear_ft.toFixed(2)} × ${PAINT.COATS}) / ${PAINT.COVERAGE_SQFT_PER_GALLON} = ${trim_paint_gallons.toFixed(2)} gallons`,
        ],
        result: Math.ceil(trim_paint_gallons),
      },
    },
  };
}
