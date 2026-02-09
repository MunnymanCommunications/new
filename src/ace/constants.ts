// =============================================================================
// AI Construction Estimator (ACE) - Constants & Building Code Standards
// =============================================================================

// --- Framing Standards ---

export const FRAMING = {
  STUD_SPACING_OC_IN: 16,        // 16 inches on center (standard)
  STUD_SPACING_OC_IN_ALT: 24,    // 24 inches on center (alternate)
  STANDARD_STUD_HEIGHT_FT: 8,     // 8 foot walls
  STANDARD_STUD_SIZE: '2x4',
  EXTERIOR_STUD_SIZE: '2x6',
  TOP_PLATES_COUNT: 2,            // Double top plate
  BOTTOM_PLATE_COUNT: 1,          // Single bottom plate
  HEADER_SIZES: {
    // Door/window opening width -> header size
    3: '2x6',
    4: '2x8',
    5: '2x10',
    6: '2x12',
    8: '2x12',   // May need LVL for wider
    10: 'LVL',
  } as Record<number, string>,
  KING_STUDS_PER_OPENING: 2,
  JACK_STUDS_PER_OPENING: 2,
  CRIPPLE_SPACING_IN: 16,
} as const;

// --- Drywall Standards ---

export const DRYWALL = {
  SHEET_WIDTH_FT: 4,
  SHEET_HEIGHT_FT: 8,
  SHEET_SQFT: 32,                  // 4x8 = 32 sqft
  INTERIOR_WALL_SIDES: 2,         // Both sides of interior walls
  EXTERIOR_WALL_SIDES: 1,         // Interior side only (exterior has sheathing)
  THICKNESS_STANDARD_IN: 0.5,     // 1/2" standard
  THICKNESS_CEILING_IN: 0.625,    // 5/8" for ceilings (fire code)
  THICKNESS_MOISTURE_IN: 0.625,   // 5/8" moisture resistant for bathrooms
  SCREWS_PER_SHEET: 32,
  JOINT_TAPE_FT_PER_SHEET: 12,
  MUD_GALLONS_PER_1000_SQFT: 3.5,
} as const;

// --- Insulation Standards ---

export const INSULATION = {
  R_VALUES: {
    '2x4_wall': 13,     // R-13 for 2x4 walls
    '2x6_wall': 19,     // R-19 for 2x6 walls
    'ceiling': 38,       // R-38 minimum for ceilings
    'floor': 19,         // R-19 for floors over unconditioned space
  },
  BATT_WIDTHS: {
    '2x4': 15,           // 15" wide for 16" OC framing
    '2x6': 15,
  },
  BATT_COVERAGE_SQFT: {
    'R13_15in': 40,      // per bag/roll
    'R19_15in': 48.96,
    'R38_ceiling': 32,
  },
} as const;

// --- Roofing Standards ---

export const ROOFING = {
  SHINGLES_PER_BUNDLE: 29,       // 3-tab shingles
  BUNDLES_PER_SQUARE: 3,          // 1 square = 100 sqft
  SQUARE_SQFT: 100,
  FELT_ROLL_SQFT: 400,            // 15# felt per roll
  ICE_SHIELD_ROLL_SQFT: 75,
  DRIP_EDGE_FT: 10,               // per piece
  RIDGE_CAP_PER_BUNDLE: 25,       // linear feet
  STARTER_STRIP_FT: 100,          // per bundle
  PITCH_MULTIPLIERS: {
    '2/12': 1.014,
    '3/12': 1.031,
    '4/12': 1.054,
    '5/12': 1.083,
    '6/12': 1.118,
    '7/12': 1.158,
    '8/12': 1.202,
    '9/12': 1.250,
    '10/12': 1.302,
    '12/12': 1.414,
  } as Record<string, number>,
} as const;

// --- Flooring ---

export const FLOORING = {
  HARDWOOD_SQFT_PER_BOX: 20,
  TILE_SQFT_PER_BOX: 10,
  CARPET_SQYD_PER_ROLL: 12,       // 12ft wide rolls
  VINYL_SQFT_PER_ROLL: 180,
  LAMINATE_SQFT_PER_BOX: 20,
  THINSET_COVERAGE_SQFT: 50,      // per bag
  GROUT_COVERAGE_SQFT: 25,        // per bag (varies by tile size)
  UNDERLAYMENT_SQFT_PER_ROLL: 100,
} as const;

// --- Paint ---

export const PAINT = {
  COVERAGE_SQFT_PER_GALLON: 350,
  COATS: 2,
  PRIMER_COVERAGE_SQFT_PER_GALLON: 300,
} as const;

// --- Concrete ---

export const CONCRETE = {
  LBS_PER_BAG: 80,
  BAGS_PER_CUBIC_YARD: 45,        // 80lb bags
  CUBIC_FT_PER_CUBIC_YARD: 27,
} as const;

// --- Waste / Excess Factor ---

export const WASTE_FACTOR = 0.15; // 15% material excess

// --- Standard Dimensions ---

export const STANDARD_DIMENSIONS = {
  CEILING_HEIGHT_FT: 8,
  EXTERIOR_WALL_THICKNESS_IN: 6,  // 2x6 framing
  INTERIOR_WALL_THICKNESS_IN: 4.5, // 2x4 framing + drywall
  STANDARD_DOOR_WIDTH_FT: 3,
  STANDARD_DOOR_HEIGHT_FT: 6.67,  // 6'8"
  STANDARD_WINDOW_WIDTH_FT: 3,
  STANDARD_WINDOW_HEIGHT_FT: 4,
  WINDOW_SILL_HEIGHT_FT: 3,
} as const;

// --- Fasteners ---

export const FASTENERS = {
  FRAMING_NAILS_PER_STUD: 12,     // 16d nails
  NAILS_PER_BOX: 50,              // lbs
  DRYWALL_SCREWS_PER_BOX: 200,    // #6 1-5/8"
  DECK_SCREWS_PER_BOX: 100,
} as const;

// --- Material Unit Mappings ---

export const MATERIAL_UNITS = {
  drywall: 'sheets',
  studs: 'pieces',
  plates: 'linear_ft',
  insulation: 'sqft',
  shingles: 'bundles',
  flooring: 'sqft',
  tile: 'sqft',
  paint: 'gallons',
  concrete: 'cubic_ft',
  fixtures: 'each',
  doors: 'each',
  windows: 'each',
} as const;

// --- Page Type Labels ---

export const PAGE_TYPE_LABELS: Record<string, string> = {
  architectural_floor_plan: 'Architectural Floor Plan',
  architectural_elevation: 'Elevation View',
  architectural_section: 'Section View',
  structural: 'Structural Plan',
  electrical: 'Electrical Plan',
  plumbing: 'Plumbing Plan',
  mechanical_hvac: 'Mechanical / HVAC',
  site_plan: 'Site Plan',
  roof_plan: 'Roof Plan',
  foundation: 'Foundation Plan',
  detail_sheet: 'Detail Sheet',
  cover_sheet: 'Cover Sheet',
  schedule: 'Schedule',
  unknown: 'Unknown',
};

// --- Room Type Labels ---

export const ROOM_TYPE_LABELS: Record<string, string> = {
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  dining_room: 'Dining Room',
  hallway: 'Hallway',
  closet: 'Closet',
  laundry: 'Laundry',
  garage: 'Garage',
  utility: 'Utility Room',
  office: 'Office',
  foyer: 'Foyer',
  pantry: 'Pantry',
  mudroom: 'Mudroom',
  basement: 'Basement',
  attic: 'Attic',
  other: 'Other',
};

// --- Rooms requiring special materials ---

export const WET_ROOMS: string[] = ['bathroom', 'kitchen', 'laundry'];
export const TILE_ROOMS: string[] = ['bathroom'];
