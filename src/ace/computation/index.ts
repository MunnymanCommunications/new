// =============================================================================
// Master Material Computation Orchestrator - Pure Math, No AI
// Aggregates all computation modules into a single material list.
// =============================================================================

import { calculateDrywall } from './drywall';
import { calculateFraming } from './framing';
import { calculateInsulation } from './insulation';
import { calculateRoofing } from './roofing';
import { calculateFlooring, calculateBathroomWallTile } from './flooring';
import { calculateFixtures } from './fixtures';
import { calculatePaint } from './paint';
import { WASTE_FACTOR, STANDARD_DIMENSIONS } from '../constants';
import type {
  DigitalTwin, MaterialList, MaterialCategory, MaterialItem, AuditEntry,
} from '../types';

/**
 * Generate a complete material list from a verified Digital Twin.
 * ALL math is performed here in code - no AI inference for calculations.
 */
export function computeMaterialList(twin: DigitalTwin): {
  materialList: MaterialList;
  auditEntries: AuditEntry[];
} {
  const auditEntries: AuditEntry[] = [];
  const now = new Date().toISOString();

  const addAudit = (action: string, details: string, data?: Record<string, unknown>) => {
    auditEntries.push({
      id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      agent: 'computation_engine',
      action,
      details,
      page_number: null,
      data: data || null,
    });
  };

  addAudit('computation_start', 'Starting material computation from Digital Twin');

  // Gather all elements across all floors
  const allWalls = twin.building.floors.flatMap(f => f.walls);
  const allDoors = twin.building.floors.flatMap(f => f.doors);
  const allWindows = twin.building.floors.flatMap(f => f.windows);
  const allRooms = twin.building.floors.flatMap(f => f.rooms);
  const allFixtures = twin.building.floors.flatMap(f => f.fixtures);

  const ceiling_height = twin.building.floors[0]?.ceiling_height_ft || STANDARD_DIMENSIONS.CEILING_HEIGHT_FT;

  addAudit('elements_gathered', `Found ${allWalls.length} walls, ${allDoors.length} doors, ${allWindows.length} windows, ${allRooms.length} rooms, ${allFixtures.length} fixtures`);

  // === DRYWALL ===
  const drywallResult = calculateDrywall({
    walls: allWalls,
    rooms: allRooms,
    ceiling_height_ft: ceiling_height,
  });
  addAudit('drywall_computed', `Wall: ${drywallResult.wall_sheets.quantity} sheets, Ceiling: ${drywallResult.ceiling_sheets.quantity} sheets, Moisture: ${drywallResult.moisture_resistant_sheets.quantity} sheets`);

  // === FRAMING ===
  const framingResult = calculateFraming({
    walls: allWalls,
    doors: allDoors,
    windows: allWindows,
    ceiling_height_ft: ceiling_height,
  });
  addAudit('framing_computed', `Studs: ${framingResult.wall_studs.quantity}, Headers: ${framingResult.headers.quantity}`);

  // === INSULATION ===
  const insulationResult = calculateInsulation({
    walls: allWalls,
    rooms: allRooms,
    ceiling_height_ft: ceiling_height,
    ceiling_sqft: drywallResult.total_ceiling_sqft,
  });
  addAudit('insulation_computed', `Exterior: ${insulationResult.exterior_wall_batts.quantity} sqft, Ceiling: ${insulationResult.ceiling_insulation.quantity} sqft`);

  // === ROOFING ===
  // Estimate building perimeter from exterior walls
  const exteriorWalls = allWalls.filter(w => w.is_exterior);
  const building_perimeter = exteriorWalls.reduce((sum, w) => sum + w.length_ft, 0);
  // Estimate ridge length as ~half the longest dimension
  const ridge_length = building_perimeter / 4; // rough estimate

  const roofingResult = calculateRoofing({
    roof: twin.building.roof,
    building_perimeter_ft: building_perimeter,
    ridge_length_ft: ridge_length,
  });
  addAudit('roofing_computed', `Shingles: ${roofingResult.shingles.quantity} bundles, Roof area: ${twin.building.roof.total_sqft} sqft`);

  // === FLOORING ===
  const flooringResult = calculateFlooring({ rooms: allRooms });
  const bathroomTile = calculateBathroomWallTile(allRooms, ceiling_height);
  addAudit('flooring_computed', `${flooringResult.items.length} flooring items, ${bathroomTile.length} bathroom tile items`);

  // === FIXTURES ===
  const fixturesResult = calculateFixtures({
    doors: allDoors,
    windows: allWindows,
    fixtures: allFixtures,
  });
  addAudit('fixtures_computed', `Doors: ${fixturesResult.doors.quantity}, Windows: ${fixturesResult.windows.quantity}, Fixtures: ${fixturesResult.fixture_items.length} types`);

  // === PAINT ===
  const total_trim_ft = (fixturesResult.door_trim.quantity || 0) + (fixturesResult.window_trim.quantity || 0);
  const paintResult = calculatePaint({
    total_wall_sqft: drywallResult.total_wall_sqft,
    total_ceiling_sqft: drywallResult.total_ceiling_sqft,
    trim_linear_ft: total_trim_ft,
  });
  addAudit('paint_computed', `Wall paint: ${paintResult.wall_paint.quantity} gal, Ceiling: ${paintResult.ceiling_paint.quantity} gal`);

  // === ASSEMBLE CATEGORIES ===
  const categories: MaterialCategory[] = [
    {
      name: 'Lumber & Framing',
      subcategories: [
        {
          name: 'Wall Framing',
          items: [
            framingResult.wall_studs,
            framingResult.top_plates,
            framingResult.bottom_plates,
            framingResult.king_studs,
            framingResult.jack_studs,
            framingResult.cripple_studs,
            framingResult.blocking,
          ],
        },
        {
          name: 'Headers & Beams',
          items: [framingResult.headers],
        },
      ],
    },
    {
      name: 'Drywall & Finishing',
      subcategories: [
        {
          name: 'Drywall Sheets',
          items: [
            drywallResult.wall_sheets,
            drywallResult.ceiling_sheets,
            drywallResult.moisture_resistant_sheets,
          ],
        },
        {
          name: 'Drywall Accessories',
          items: [
            drywallResult.drywall_screws,
            drywallResult.joint_tape,
            drywallResult.joint_compound,
          ],
        },
      ],
    },
    {
      name: 'Insulation',
      subcategories: [
        {
          name: 'Wall & Ceiling Insulation',
          items: [
            insulationResult.exterior_wall_batts,
            insulationResult.interior_wall_batts,
            insulationResult.ceiling_insulation,
          ],
        },
      ],
    },
    {
      name: 'Roofing',
      subcategories: [
        {
          name: 'Shingles & Underlayment',
          items: [
            roofingResult.shingles,
            roofingResult.underlayment,
            roofingResult.ice_water_shield,
          ],
        },
        {
          name: 'Roofing Accessories',
          items: [
            roofingResult.drip_edge,
            roofingResult.ridge_cap,
            roofingResult.starter_strip,
            roofingResult.roofing_nails,
          ],
        },
      ],
    },
    {
      name: 'Flooring',
      subcategories: [
        {
          name: 'Floor Materials',
          items: flooringResult.items,
        },
        ...(bathroomTile.length > 0
          ? [{
              name: 'Bathroom Wall Tile',
              items: bathroomTile,
            }]
          : []),
      ],
    },
    {
      name: 'Paint & Finishes',
      subcategories: [
        {
          name: 'Paint',
          items: [
            paintResult.wall_paint,
            paintResult.wall_primer,
            paintResult.ceiling_paint,
            paintResult.trim_paint,
          ],
        },
      ],
    },
    {
      name: 'Doors, Windows & Hardware',
      subcategories: [
        {
          name: 'Doors',
          items: [fixturesResult.doors, fixturesResult.door_hardware, fixturesResult.door_trim],
        },
        {
          name: 'Windows',
          items: [fixturesResult.windows, fixturesResult.window_trim],
        },
      ],
    },
    {
      name: 'Fixtures & Equipment',
      subcategories: [
        {
          name: 'Plumbing Fixtures',
          items: fixturesResult.fixture_items.filter(f =>
            ['toilet', 'sink', 'bathtub', 'shower', 'vanity', 'kitchen_sink'].some(t => f.id.includes(t))
          ),
        },
        {
          name: 'Appliances',
          items: fixturesResult.fixture_items.filter(f =>
            ['dishwasher', 'range', 'refrigerator', 'washer', 'dryer'].some(t => f.id.includes(t))
          ),
        },
        {
          name: 'HVAC & Mechanical',
          items: fixturesResult.fixture_items.filter(f =>
            ['water_heater', 'furnace', 'ac_unit'].some(t => f.id.includes(t))
          ),
        },
      ].filter(s => s.items.length > 0),
    },
  ];

  // Filter out empty subcategories
  const filteredCategories = categories
    .map(cat => ({
      ...cat,
      subcategories: cat.subcategories.filter(sub => sub.items.length > 0),
    }))
    .filter(cat => cat.subcategories.length > 0);

  addAudit('computation_complete', `Generated ${filteredCategories.length} categories with ${filteredCategories.reduce((sum, c) => sum + c.subcategories.reduce((s, sc) => s + sc.items.length, 0), 0)} line items`);

  const materialList: MaterialList = {
    id: `ml-${Date.now()}`,
    project_id: twin.project_id,
    generated_at: now,
    categories: filteredCategories,
    total_estimated_cost: null,
    waste_factor: WASTE_FACTOR,
  };

  return { materialList, auditEntries };
}

/**
 * Utility: Flatten all material items from a MaterialList.
 */
export function flattenMaterialItems(list: MaterialList): MaterialItem[] {
  return list.categories.flatMap(cat =>
    cat.subcategories.flatMap(sub => sub.items)
  );
}

/**
 * Utility: Get total item count across all categories.
 */
export function getTotalLineItems(list: MaterialList): number {
  return list.categories.reduce(
    (sum, cat) => sum + cat.subcategories.reduce(
      (s, sub) => s + sub.items.length, 0
    ), 0
  );
}
