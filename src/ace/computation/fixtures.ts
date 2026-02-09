// =============================================================================
// Fixtures & Discrete Items Computation - Pure Math, No AI
// =============================================================================

import type {
  ExtractedDoor, ExtractedWindow, ExtractedFixture,
  MaterialItem, FixtureType,
} from '../types';

export interface FixturesInput {
  doors: ExtractedDoor[];
  windows: ExtractedWindow[];
  fixtures: ExtractedFixture[];
}

export interface FixturesResult {
  doors: MaterialItem;
  windows: MaterialItem;
  fixture_items: MaterialItem[];
  door_hardware: MaterialItem;
  window_trim: MaterialItem;
  door_trim: MaterialItem;
}

const FIXTURE_LABELS: Record<FixtureType, string> = {
  toilet: 'Toilet',
  sink: 'Sink',
  bathtub: 'Bathtub',
  shower: 'Shower Enclosure',
  vanity: 'Bathroom Vanity',
  kitchen_sink: 'Kitchen Sink',
  dishwasher: 'Dishwasher',
  range: 'Range / Oven',
  refrigerator: 'Refrigerator',
  washer: 'Washing Machine',
  dryer: 'Dryer',
  water_heater: 'Water Heater',
  furnace: 'Furnace / HVAC Unit',
  ac_unit: 'AC Unit',
  other: 'Other Fixture',
};

/**
 * Count and itemize all discrete fixtures, doors, and windows.
 * These are counted individually (no waste factor applied to discrete items).
 */
export function calculateFixtures(input: FixturesInput): FixturesResult {
  // --- Doors ---
  const doorSteps: string[] = [];
  const doorsByType = new Map<string, number>();
  for (const door of input.doors) {
    const key = `${door.door_type} (${door.is_exterior ? 'exterior' : 'interior'})`;
    doorsByType.set(key, (doorsByType.get(key) || 0) + 1);
  }
  for (const [type, count] of doorsByType) {
    doorSteps.push(`${type}: ${count}`);
  }
  doorSteps.push(`Total doors: ${input.doors.length}`);

  // --- Windows ---
  const windowSteps: string[] = [];
  const windowsByType = new Map<string, number>();
  for (const win of input.windows) {
    const key = win.window_type;
    windowsByType.set(key, (windowsByType.get(key) || 0) + 1);
  }
  for (const [type, count] of windowsByType) {
    windowSteps.push(`${type}: ${count}`);
  }
  windowSteps.push(`Total windows: ${input.windows.length}`);

  // --- Fixtures grouped by type ---
  const fixturesByType = new Map<FixtureType, ExtractedFixture[]>();
  for (const fix of input.fixtures) {
    if (!fixturesByType.has(fix.fixture_type)) {
      fixturesByType.set(fix.fixture_type, []);
    }
    fixturesByType.get(fix.fixture_type)!.push(fix);
  }

  const fixture_items: MaterialItem[] = [];
  for (const [type, fixtures] of fixturesByType) {
    const steps: string[] = [];
    for (const f of fixtures) {
      steps.push(`${FIXTURE_LABELS[type]} at (${f.position.x.toFixed(0)}, ${f.position.y.toFixed(0)}) - ${f.specifications || 'standard'}`);
    }
    steps.push(`Total ${FIXTURE_LABELS[type]}: ${fixtures.length}`);

    fixture_items.push({
      id: `fixture-${type}`,
      name: FIXTURE_LABELS[type],
      description: `${FIXTURE_LABELS[type]} - counted individually from plans`,
      quantity: fixtures.length,
      unit: 'each',
      quantity_with_waste: fixtures.length, // No waste on discrete items
      waste_percentage: 0,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'count(fixtures_of_type)',
        inputs: { fixture_type: type },
        steps,
        result: fixtures.length,
      },
    });
  }

  // --- Door Hardware ---
  const hardware_count = input.doors.length;
  // --- Trim ---
  // Door trim: 2 sides × (2 legs + 1 header) per door, typical casing is ~17 linear ft per door
  const door_trim_ft = input.doors.length * 17;
  // Window trim: 4 pieces per window (2 legs + top + sill), typical ~14 linear ft per window
  const window_trim_ft = input.windows.length * 14;

  return {
    doors: {
      id: 'doors',
      name: 'Doors (Pre-hung)',
      description: 'Pre-hung door units including frame',
      quantity: input.doors.length,
      unit: 'each',
      quantity_with_waste: input.doors.length,
      waste_percentage: 0,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'count(doors)',
        inputs: { total: input.doors.length },
        steps: doorSteps,
        result: input.doors.length,
      },
    },
    windows: {
      id: 'windows',
      name: 'Windows',
      description: 'Window units (various sizes)',
      quantity: input.windows.length,
      unit: 'each',
      quantity_with_waste: input.windows.length,
      waste_percentage: 0,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'count(windows)',
        inputs: { total: input.windows.length },
        steps: windowSteps,
        result: input.windows.length,
      },
    },
    fixture_items,
    door_hardware: {
      id: 'door-hardware',
      name: 'Door Hardware Sets (Knob/Lever + Hinges)',
      description: 'Complete hardware set per door',
      quantity: hardware_count,
      unit: 'each',
      quantity_with_waste: hardware_count,
      waste_percentage: 0,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: '1 set per door',
        inputs: { doors: input.doors.length },
        steps: [`${input.doors.length} doors × 1 hardware set = ${hardware_count}`],
        result: hardware_count,
      },
    },
    door_trim: {
      id: 'door-trim',
      name: 'Door Casing / Trim',
      description: 'Door casing trim (both sides)',
      quantity: Math.ceil(door_trim_ft),
      unit: 'linear_ft',
      quantity_with_waste: Math.ceil(door_trim_ft * 1.15),
      waste_percentage: 15,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'doors × 17 linear ft per door (both sides)',
        inputs: { doors: input.doors.length },
        steps: [`${input.doors.length} doors × 17 ft = ${door_trim_ft} linear ft`],
        result: Math.ceil(door_trim_ft),
      },
    },
    window_trim: {
      id: 'window-trim',
      name: 'Window Casing / Trim',
      description: 'Window casing trim (interior)',
      quantity: Math.ceil(window_trim_ft),
      unit: 'linear_ft',
      quantity_with_waste: Math.ceil(window_trim_ft * 1.15),
      waste_percentage: 15,
      unit_cost: null,
      total_cost: null,
      calculation_audit: {
        formula: 'windows × 14 linear ft per window',
        inputs: { windows: input.windows.length },
        steps: [`${input.windows.length} windows × 14 ft = ${window_trim_ft} linear ft`],
        result: Math.ceil(window_trim_ft),
      },
    },
  };
}
