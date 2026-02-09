// =============================================================================
// Flooring & Tile Computation - Pure Math, No AI
// =============================================================================

import { FLOORING, WASTE_FACTOR } from '../constants';
import { TILE_ROOMS } from '../constants';
import type { ExtractedRoom, MaterialItem, FloorMaterial } from '../types';

export interface FlooringInput {
  rooms: ExtractedRoom[];
}

export interface FlooringResult {
  items: MaterialItem[];
  summary: Record<string, number>; // material type -> total sqft
}

/**
 * Group rooms by floor material and calculate material needs.
 */
export function calculateFlooring(input: FlooringInput): FlooringResult {
  const materialGroups = new Map<FloorMaterial, { rooms: ExtractedRoom[]; total_sqft: number }>();

  for (const room of input.rooms) {
    const mat = room.floor_material || 'unknown';
    if (!materialGroups.has(mat)) {
      materialGroups.set(mat, { rooms: [], total_sqft: 0 });
    }
    const group = materialGroups.get(mat)!;
    group.rooms.push(room);
    group.total_sqft += room.area_sqft;
  }

  const items: MaterialItem[] = [];
  const summary: Record<string, number> = {};

  for (const [material, group] of materialGroups) {
    summary[material] = group.total_sqft;
    const steps: string[] = [];

    for (const room of group.rooms) {
      steps.push(`${room.name} (${room.room_type}): ${room.area_sqft.toFixed(2)} sqft`);
    }
    steps.push(`Total ${material}: ${group.total_sqft.toFixed(2)} sqft`);

    switch (material) {
      case 'hardwood': {
        const boxes = Math.ceil(group.total_sqft / FLOORING.HARDWOOD_SQFT_PER_BOX);
        items.push({
          id: `flooring-hardwood`,
          name: 'Hardwood Flooring',
          description: `Engineered or solid hardwood planks`,
          quantity: boxes,
          unit: 'boxes',
          quantity_with_waste: Math.ceil(boxes * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'ceil(total_sqft / sqft_per_box)',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)), sqft_per_box: FLOORING.HARDWOOD_SQFT_PER_BOX },
            steps: [...steps, `Boxes: ceil(${group.total_sqft.toFixed(2)} / ${FLOORING.HARDWOOD_SQFT_PER_BOX}) = ${boxes}`],
            result: boxes,
          },
        });
        // Underlayment for hardwood
        const underlayment_rolls = Math.ceil(group.total_sqft / FLOORING.UNDERLAYMENT_SQFT_PER_ROLL);
        items.push({
          id: 'flooring-hardwood-underlayment',
          name: 'Hardwood Underlayment',
          description: 'Foam or cork underlayment',
          quantity: underlayment_rolls,
          unit: 'rolls',
          quantity_with_waste: Math.ceil(underlayment_rolls * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'ceil(total_sqft / sqft_per_roll)',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)) },
            steps: [`ceil(${group.total_sqft.toFixed(2)} / ${FLOORING.UNDERLAYMENT_SQFT_PER_ROLL}) = ${underlayment_rolls}`],
            result: underlayment_rolls,
          },
        });
        break;
      }

      case 'tile': {
        const tile_boxes = Math.ceil(group.total_sqft / FLOORING.TILE_SQFT_PER_BOX);
        items.push({
          id: 'flooring-tile',
          name: 'Floor Tile',
          description: 'Ceramic or porcelain floor tile',
          quantity: tile_boxes,
          unit: 'boxes',
          quantity_with_waste: Math.ceil(tile_boxes * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'ceil(total_sqft / sqft_per_box)',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)), sqft_per_box: FLOORING.TILE_SQFT_PER_BOX },
            steps: [...steps, `Boxes: ceil(${group.total_sqft.toFixed(2)} / ${FLOORING.TILE_SQFT_PER_BOX}) = ${tile_boxes}`],
            result: tile_boxes,
          },
        });
        // Thinset mortar
        const thinset_bags = Math.ceil(group.total_sqft / FLOORING.THINSET_COVERAGE_SQFT);
        items.push({
          id: 'flooring-thinset',
          name: 'Thinset Mortar',
          description: 'Modified thinset for tile installation',
          quantity: thinset_bags,
          unit: 'bags',
          quantity_with_waste: Math.ceil(thinset_bags * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'ceil(total_sqft / coverage_per_bag)',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)) },
            steps: [`ceil(${group.total_sqft.toFixed(2)} / ${FLOORING.THINSET_COVERAGE_SQFT}) = ${thinset_bags}`],
            result: thinset_bags,
          },
        });
        // Grout
        const grout_bags = Math.ceil(group.total_sqft / FLOORING.GROUT_COVERAGE_SQFT);
        items.push({
          id: 'flooring-grout',
          name: 'Tile Grout',
          description: 'Sanded or unsanded grout',
          quantity: grout_bags,
          unit: 'bags',
          quantity_with_waste: Math.ceil(grout_bags * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'ceil(total_sqft / coverage_per_bag)',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)) },
            steps: [`ceil(${group.total_sqft.toFixed(2)} / ${FLOORING.GROUT_COVERAGE_SQFT}) = ${grout_bags}`],
            result: grout_bags,
          },
        });
        break;
      }

      case 'carpet': {
        const sqft = group.total_sqft;
        items.push({
          id: 'flooring-carpet',
          name: 'Carpet',
          description: 'Carpet with pad',
          quantity: Math.ceil(sqft),
          unit: 'sqft',
          quantity_with_waste: Math.ceil(sqft * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'total_room_sqft',
            inputs: { total_sqft: Number(sqft.toFixed(2)) },
            steps: [...steps],
            result: Math.ceil(sqft),
          },
        });
        // Carpet pad
        items.push({
          id: 'flooring-carpet-pad',
          name: 'Carpet Pad',
          description: 'Rebond carpet padding',
          quantity: Math.ceil(sqft),
          unit: 'sqft',
          quantity_with_waste: Math.ceil(sqft * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'same as carpet sqft',
            inputs: { total_sqft: Number(sqft.toFixed(2)) },
            steps: [`Pad area matches carpet area: ${sqft.toFixed(2)} sqft`],
            result: Math.ceil(sqft),
          },
        });
        break;
      }

      case 'vinyl': {
        items.push({
          id: 'flooring-vinyl',
          name: 'Vinyl Flooring (LVP/LVT)',
          description: 'Luxury vinyl plank or tile',
          quantity: Math.ceil(group.total_sqft),
          unit: 'sqft',
          quantity_with_waste: Math.ceil(group.total_sqft * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'total_room_sqft',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)) },
            steps: [...steps],
            result: Math.ceil(group.total_sqft),
          },
        });
        break;
      }

      case 'laminate': {
        const lam_boxes = Math.ceil(group.total_sqft / FLOORING.LAMINATE_SQFT_PER_BOX);
        items.push({
          id: 'flooring-laminate',
          name: 'Laminate Flooring',
          description: 'Click-lock laminate planks',
          quantity: lam_boxes,
          unit: 'boxes',
          quantity_with_waste: Math.ceil(lam_boxes * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'ceil(total_sqft / sqft_per_box)',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)), sqft_per_box: FLOORING.LAMINATE_SQFT_PER_BOX },
            steps: [...steps, `Boxes: ceil(${group.total_sqft.toFixed(2)} / ${FLOORING.LAMINATE_SQFT_PER_BOX}) = ${lam_boxes}`],
            result: lam_boxes,
          },
        });
        // Underlayment
        const underlayment = Math.ceil(group.total_sqft / FLOORING.UNDERLAYMENT_SQFT_PER_ROLL);
        items.push({
          id: 'flooring-laminate-underlayment',
          name: 'Laminate Underlayment',
          description: 'Foam underlayment for laminate',
          quantity: underlayment,
          unit: 'rolls',
          quantity_with_waste: Math.ceil(underlayment * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'ceil(total_sqft / sqft_per_roll)',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)) },
            steps: [`ceil(${group.total_sqft.toFixed(2)} / ${FLOORING.UNDERLAYMENT_SQFT_PER_ROLL}) = ${underlayment}`],
            result: underlayment,
          },
        });
        break;
      }

      case 'concrete':
      case 'unknown':
      default:
        // Concrete floors or unknown - just track sqft
        items.push({
          id: `flooring-${material}`,
          name: `Flooring (${material})`,
          description: `${material} flooring material`,
          quantity: Math.ceil(group.total_sqft),
          unit: 'sqft',
          quantity_with_waste: Math.ceil(group.total_sqft * (1 + WASTE_FACTOR)),
          waste_percentage: WASTE_FACTOR * 100,
          unit_cost: null,
          total_cost: null,
          calculation_audit: {
            formula: 'total_room_sqft',
            inputs: { total_sqft: Number(group.total_sqft.toFixed(2)) },
            steps,
            result: Math.ceil(group.total_sqft),
          },
        });
        break;
    }
  }

  return { items, summary };
}

/**
 * Calculate bathroom wall tile (separate from floor tile).
 * Bathrooms get tile on walls up to typical shower height (8ft) on wet walls.
 */
export function calculateBathroomWallTile(
  rooms: ExtractedRoom[],
  ceiling_height_ft: number
): MaterialItem[] {
  const bathrooms = rooms.filter(r => TILE_ROOMS.includes(r.room_type));
  if (bathrooms.length === 0) return [];

  const items: MaterialItem[] = [];
  let total_tile_sqft = 0;
  const steps: string[] = [];

  for (const bath of bathrooms) {
    // Tile walls to ceiling height (wet wall coverage)
    const wall_tile_sqft = bath.perimeter_ft * (bath.ceiling_height_ft || ceiling_height_ft);
    total_tile_sqft += wall_tile_sqft;
    steps.push(
      `${bath.name}: ${bath.perimeter_ft}ft perimeter × ${bath.ceiling_height_ft || ceiling_height_ft}ft = ${wall_tile_sqft.toFixed(2)} sqft wall tile`
    );
  }

  const tile_boxes = Math.ceil(total_tile_sqft / FLOORING.TILE_SQFT_PER_BOX);
  const thinset_bags = Math.ceil(total_tile_sqft / FLOORING.THINSET_COVERAGE_SQFT);
  const grout_bags = Math.ceil(total_tile_sqft / FLOORING.GROUT_COVERAGE_SQFT);

  items.push({
    id: 'bathroom-wall-tile',
    name: 'Bathroom Wall Tile',
    description: 'Ceramic or porcelain wall tile for bathrooms',
    quantity: tile_boxes,
    unit: 'boxes',
    quantity_with_waste: Math.ceil(tile_boxes * (1 + WASTE_FACTOR)),
    waste_percentage: WASTE_FACTOR * 100,
    unit_cost: null,
    total_cost: null,
    calculation_audit: {
      formula: 'ceil(total_wall_tile_sqft / sqft_per_box)',
      inputs: { total_sqft: Number(total_tile_sqft.toFixed(2)), sqft_per_box: FLOORING.TILE_SQFT_PER_BOX },
      steps: [...steps, `Total: ${total_tile_sqft.toFixed(2)} sqft → ${tile_boxes} boxes`],
      result: tile_boxes,
    },
  });

  items.push({
    id: 'bathroom-wall-thinset',
    name: 'Wall Tile Thinset Mortar',
    description: 'Modified thinset for wall tile',
    quantity: thinset_bags,
    unit: 'bags',
    quantity_with_waste: Math.ceil(thinset_bags * (1 + WASTE_FACTOR)),
    waste_percentage: WASTE_FACTOR * 100,
    unit_cost: null,
    total_cost: null,
    calculation_audit: {
      formula: 'ceil(total_sqft / coverage_per_bag)',
      inputs: { total_sqft: Number(total_tile_sqft.toFixed(2)) },
      steps: [`ceil(${total_tile_sqft.toFixed(2)} / ${FLOORING.THINSET_COVERAGE_SQFT}) = ${thinset_bags}`],
      result: thinset_bags,
    },
  });

  items.push({
    id: 'bathroom-wall-grout',
    name: 'Wall Tile Grout',
    description: 'Sanded grout for wall tile',
    quantity: grout_bags,
    unit: 'bags',
    quantity_with_waste: Math.ceil(grout_bags * (1 + WASTE_FACTOR)),
    waste_percentage: WASTE_FACTOR * 100,
    unit_cost: null,
    total_cost: null,
    calculation_audit: {
      formula: 'ceil(total_sqft / coverage_per_bag)',
      inputs: { total_sqft: Number(total_tile_sqft.toFixed(2)) },
      steps: [`ceil(${total_tile_sqft.toFixed(2)} / ${FLOORING.GROUT_COVERAGE_SQFT}) = ${grout_bags}`],
      result: grout_bags,
    },
  });

  return items;
}
