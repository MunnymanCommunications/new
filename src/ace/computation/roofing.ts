// =============================================================================
// Roofing Computation - Pure Math, No AI
// =============================================================================

import { ROOFING, WASTE_FACTOR } from '../constants';
import type { RoofData, MaterialItem } from '../types';

export interface RoofingInput {
  roof: RoofData;
  building_perimeter_ft: number;
  ridge_length_ft: number;
}

export interface RoofingResult {
  shingles: MaterialItem;
  underlayment: MaterialItem;
  drip_edge: MaterialItem;
  ridge_cap: MaterialItem;
  starter_strip: MaterialItem;
  ice_water_shield: MaterialItem;
  roofing_nails: MaterialItem;
}

/**
 * Get the pitch multiplier for converting footprint area to actual roof area.
 */
function getPitchMultiplier(pitch: string): number {
  return ROOFING.PITCH_MULTIPLIERS[pitch] || 1.118; // default to 6/12
}

/**
 * Master roofing calculation function.
 */
export function calculateRoofing(input: RoofingInput): RoofingResult {
  const pitchMultiplier = getPitchMultiplier(input.roof.pitch);
  const actual_roof_sqft = input.roof.total_sqft * pitchMultiplier;
  const squares = actual_roof_sqft / ROOFING.SQUARE_SQFT;
  const bundles = Math.ceil(squares * ROOFING.BUNDLES_PER_SQUARE);

  const steps: string[] = [
    `Roof footprint area: ${input.roof.total_sqft} sqft`,
    `Pitch: ${input.roof.pitch} → multiplier: ${pitchMultiplier}`,
    `Actual roof surface area: ${input.roof.total_sqft} × ${pitchMultiplier} = ${actual_roof_sqft.toFixed(2)} sqft`,
    `Squares: ${actual_roof_sqft.toFixed(2)} / ${ROOFING.SQUARE_SQFT} = ${squares.toFixed(2)}`,
    `Bundles needed: ceil(${squares.toFixed(2)} × ${ROOFING.BUNDLES_PER_SQUARE}) = ${bundles}`,
  ];

  // Underlayment
  const felt_rolls = Math.ceil(actual_roof_sqft / ROOFING.FELT_ROLL_SQFT);

  // Drip edge - runs along entire eave and rake edges
  const drip_edge_ft = input.building_perimeter_ft + (input.ridge_length_ft * 2); // rakes on both sides
  const drip_edge_pieces = Math.ceil(drip_edge_ft / ROOFING.DRIP_EDGE_FT);

  // Ridge cap
  const ridge_cap_bundles = Math.ceil(input.ridge_length_ft / ROOFING.RIDGE_CAP_PER_BUNDLE);

  // Starter strip
  const starter_bundles = Math.ceil(input.building_perimeter_ft / ROOFING.STARTER_STRIP_FT);

  // Ice & water shield (first 3 feet from eave)
  const ice_shield_sqft = input.building_perimeter_ft * 3; // 3ft up from eave
  const ice_shield_rolls = Math.ceil(ice_shield_sqft / ROOFING.ICE_SHIELD_ROLL_SQFT);

  // Roofing nails - approximately 4 nails per shingle, ~29 shingles per bundle
  const nails_needed = bundles * ROOFING.SHINGLES_PER_BUNDLE * 4;

  return {
    shingles: {
      id: 'roofing-shingles',
      name: 'Roofing Shingles (3-Tab or Architectural)',
      description: `Shingle bundles for ${actual_roof_sqft.toFixed(0)} sqft roof area`,
      quantity: bundles,
      unit: 'bundles',
      quantity_with_waste: Math.ceil(bundles * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil((roof_sqft × pitch_multiplier / 100) × 3)',
        inputs: {
          footprint_sqft: input.roof.total_sqft,
          pitch: input.roof.pitch,
          pitch_multiplier: pitchMultiplier,
        },
        steps,
        result: bundles,
      },
    },
    underlayment: {
      id: 'roofing-felt',
      name: 'Roofing Underlayment (15# Felt)',
      description: 'Synthetic or felt underlayment rolls',
      quantity: felt_rolls,
      unit: 'rolls',
      quantity_with_waste: Math.ceil(felt_rolls * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil(actual_roof_sqft / roll_coverage)',
        inputs: { actual_roof_sqft: Number(actual_roof_sqft.toFixed(2)), roll_coverage: ROOFING.FELT_ROLL_SQFT },
        steps: [`ceil(${actual_roof_sqft.toFixed(2)} / ${ROOFING.FELT_ROLL_SQFT}) = ${felt_rolls} rolls`],
        result: felt_rolls,
      },
    },
    drip_edge: {
      id: 'roofing-drip-edge',
      name: 'Drip Edge (10ft pieces)',
      description: 'Metal drip edge for eaves and rakes',
      quantity: drip_edge_pieces,
      unit: 'pieces',
      quantity_with_waste: Math.ceil(drip_edge_pieces * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil((perimeter + ridge × 2) / piece_length)',
        inputs: { perimeter_ft: input.building_perimeter_ft, ridge_ft: input.ridge_length_ft },
        steps: [`Total edge: ${drip_edge_ft.toFixed(1)}ft → ceil(${drip_edge_ft.toFixed(1)} / ${ROOFING.DRIP_EDGE_FT}) = ${drip_edge_pieces} pieces`],
        result: drip_edge_pieces,
      },
    },
    ridge_cap: {
      id: 'roofing-ridge-cap',
      name: 'Ridge Cap Shingles',
      description: 'Ridge cap shingle bundles',
      quantity: ridge_cap_bundles,
      unit: 'bundles',
      quantity_with_waste: Math.ceil(ridge_cap_bundles * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil(ridge_length / coverage_per_bundle)',
        inputs: { ridge_length_ft: input.ridge_length_ft },
        steps: [`ceil(${input.ridge_length_ft} / ${ROOFING.RIDGE_CAP_PER_BUNDLE}) = ${ridge_cap_bundles}`],
        result: ridge_cap_bundles,
      },
    },
    starter_strip: {
      id: 'roofing-starter',
      name: 'Starter Strip Shingles',
      description: 'Starter strip for eave edges',
      quantity: starter_bundles,
      unit: 'bundles',
      quantity_with_waste: Math.ceil(starter_bundles * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil(perimeter / coverage_per_bundle)',
        inputs: { perimeter_ft: input.building_perimeter_ft },
        steps: [`ceil(${input.building_perimeter_ft} / ${ROOFING.STARTER_STRIP_FT}) = ${starter_bundles}`],
        result: starter_bundles,
      },
    },
    ice_water_shield: {
      id: 'roofing-ice-shield',
      name: 'Ice & Water Shield',
      description: 'Self-adhering membrane for eaves (first 3ft)',
      quantity: ice_shield_rolls,
      unit: 'rolls',
      quantity_with_waste: Math.ceil(ice_shield_rolls * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'ceil((perimeter × 3ft) / roll_coverage)',
        inputs: { perimeter_ft: input.building_perimeter_ft },
        steps: [`${input.building_perimeter_ft}ft × 3ft = ${ice_shield_sqft} sqft → ${ice_shield_rolls} rolls`],
        result: ice_shield_rolls,
      },
    },
    roofing_nails: {
      id: 'roofing-nails',
      name: 'Roofing Nails (1-1/4" galvanized)',
      description: 'Coil or loose roofing nails',
      quantity: nails_needed,
      unit: 'each',
      quantity_with_waste: Math.ceil(nails_needed * (1 + WASTE_FACTOR)),
      waste_percentage: WASTE_FACTOR * 100,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'bundles × shingles_per_bundle × 4',
        inputs: { bundles, shingles_per_bundle: ROOFING.SHINGLES_PER_BUNDLE },
        steps: [`${bundles} × ${ROOFING.SHINGLES_PER_BUNDLE} × 4 = ${nails_needed} nails`],
        result: nails_needed,
      },
    },
  };
}
