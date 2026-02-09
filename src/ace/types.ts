// =============================================================================
// AI Construction Estimator (ACE) - Type Definitions
// =============================================================================

// --- Project & Session ---

export interface ACEProject {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
  updated_at: string;
  status: ProjectStatus;
  pdf_pages: PDFPageData[];
  digital_twin: DigitalTwin | null;
  material_list: MaterialList | null;
  clarifications: Clarification[];
  audit_trail: AuditEntry[];
}

export type ProjectStatus =
  | 'uploading'
  | 'segmenting'
  | 'analyzing'
  | 'building_twin'
  | 'awaiting_verification'
  | 'computing_materials'
  | 'verification_check'
  | 'complete'
  | 'error';

// --- PDF Processing ---

export interface PDFPageData {
  pageNumber: number;
  imageDataUrl: string; // base64 data URL of rendered page
  pageType: PageType | null;
  width: number; // pixels
  height: number;
  analysisComplete: boolean;
  extractedData: PageExtractedData | null;
}

export type PageType =
  | 'architectural_floor_plan'
  | 'architectural_elevation'
  | 'architectural_section'
  | 'structural'
  | 'electrical'
  | 'plumbing'
  | 'mechanical_hvac'
  | 'site_plan'
  | 'roof_plan'
  | 'foundation'
  | 'detail_sheet'
  | 'cover_sheet'
  | 'schedule'
  | 'unknown';

export interface PageExtractedData {
  scale: ScaleInfo | null;
  walls: ExtractedWall[];
  doors: ExtractedDoor[];
  windows: ExtractedWindow[];
  rooms: ExtractedRoom[];
  fixtures: ExtractedFixture[];
  dimensions: ExtractedDimension[];
  structural_elements: ExtractedStructuralElement[];
  notes: string[];
  raw_ocr_text: string;
  confidence: number; // 0-1
}

export interface ScaleInfo {
  text: string; // e.g., "1/4\" = 1'-0\""
  pixels_per_foot: number;
  confidence: number;
}

// --- Extracted Elements ---

export interface ExtractedWall {
  id: string;
  start: Point2D;
  end: Point2D;
  length_ft: number;
  height_ft: number;
  thickness_in: number;
  wall_type: WallType;
  is_load_bearing: boolean | null; // null = unknown
  is_exterior: boolean;
  connected_walls: string[]; // IDs
  page_number: number;
}

export type WallType = 'standard' | 'partition' | 'shear' | 'curtain' | 'foundation';

export interface ExtractedDoor {
  id: string;
  position: Point2D;
  width_ft: number;
  height_ft: number;
  door_type: DoorType;
  wall_id: string | null;
  swing_direction: 'left' | 'right' | 'double' | 'sliding' | 'unknown';
  is_exterior: boolean;
  page_number: number;
}

export type DoorType = 'single' | 'double' | 'sliding' | 'pocket' | 'bifold' | 'french' | 'garage' | 'unknown';

export interface ExtractedWindow {
  id: string;
  position: Point2D;
  width_ft: number;
  height_ft: number;
  window_type: WindowType;
  wall_id: string | null;
  page_number: number;
}

export type WindowType = 'single_hung' | 'double_hung' | 'casement' | 'sliding' | 'fixed' | 'bay' | 'skylight' | 'unknown';

export interface ExtractedRoom {
  id: string;
  name: string;
  room_type: RoomType;
  vertices: Point2D[]; // polygon defining room boundary
  area_sqft: number;
  perimeter_ft: number;
  ceiling_height_ft: number;
  floor_material: FloorMaterial;
  wall_material: WallMaterial;
  page_number: number;
}

export type RoomType =
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'living_room'
  | 'dining_room'
  | 'hallway'
  | 'closet'
  | 'laundry'
  | 'garage'
  | 'utility'
  | 'office'
  | 'foyer'
  | 'pantry'
  | 'mudroom'
  | 'basement'
  | 'attic'
  | 'other';

export type FloorMaterial = 'hardwood' | 'tile' | 'carpet' | 'vinyl' | 'concrete' | 'laminate' | 'unknown';
export type WallMaterial = 'drywall' | 'plaster' | 'tile' | 'paneling' | 'concrete' | 'unknown';

export interface ExtractedFixture {
  id: string;
  fixture_type: FixtureType;
  position: Point2D;
  room_id: string | null;
  specifications: string;
  page_number: number;
}

export type FixtureType =
  | 'toilet'
  | 'sink'
  | 'bathtub'
  | 'shower'
  | 'vanity'
  | 'kitchen_sink'
  | 'dishwasher'
  | 'range'
  | 'refrigerator'
  | 'washer'
  | 'dryer'
  | 'water_heater'
  | 'furnace'
  | 'ac_unit'
  | 'other';

export interface ExtractedDimension {
  id: string;
  text: string;
  value_ft: number;
  start: Point2D;
  end: Point2D;
  page_number: number;
}

export interface ExtractedStructuralElement {
  id: string;
  element_type: 'beam' | 'column' | 'footing' | 'header' | 'joist' | 'rafter' | 'truss';
  position: Point2D;
  length_ft: number;
  size: string; // e.g., "2x10", "LVL 1-3/4x11-7/8"
  spacing_in: number;
  page_number: number;
}

export interface Point2D {
  x: number;
  y: number;
}

// --- Digital Twin ---

export interface DigitalTwin {
  id: string;
  project_id: string;
  created_at: string;
  verified: boolean;
  building: Building;
  verification_notes: VerificationNote[];
}

export interface Building {
  name: string;
  stories: number;
  total_sqft: number;
  footprint_sqft: number;
  floors: Floor[];
  roof: RoofData;
  foundation: FoundationData;
  exterior: ExteriorData;
}

export interface Floor {
  level: number; // 0 = ground, 1 = second, -1 = basement
  name: string;
  ceiling_height_ft: number;
  rooms: ExtractedRoom[];
  walls: ExtractedWall[];
  doors: ExtractedDoor[];
  windows: ExtractedWindow[];
  fixtures: ExtractedFixture[];
  structural_elements: ExtractedStructuralElement[];
}

export interface RoofData {
  type: 'gable' | 'hip' | 'flat' | 'shed' | 'mansard' | 'gambrel' | 'unknown';
  total_sqft: number;
  pitch: string; // e.g., "6/12"
  overhang_ft: number;
}

export interface FoundationData {
  type: 'slab' | 'crawlspace' | 'basement' | 'pier' | 'unknown';
  sqft: number;
  depth_ft: number;
}

export interface ExteriorData {
  siding_type: 'vinyl' | 'wood' | 'brick' | 'stucco' | 'stone' | 'fiber_cement' | 'unknown';
  total_exterior_wall_sqft: number;
}

export interface VerificationNote {
  id: string;
  element_type: string;
  element_id: string;
  field: string;
  original_value: string;
  corrected_value: string | null;
  verified: boolean;
  timestamp: string;
}

// --- Material List ---

export interface MaterialList {
  id: string;
  project_id: string;
  generated_at: string;
  categories: MaterialCategory[];
  total_estimated_cost: number | null; // null if no pricing loaded
  waste_factor: number; // e.g., 0.15
}

export interface MaterialCategory {
  name: string;
  subcategories: MaterialSubcategory[];
}

export interface MaterialSubcategory {
  name: string;
  items: MaterialItem[];
}

export interface MaterialItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: MaterialUnit;
  quantity_with_waste: number;
  waste_percentage: number;
  unit_cost: number | null;
  total_cost: number | null;
  calculation_audit: CalculationAudit;
}

export type MaterialUnit =
  | 'sheets'     // drywall, plywood
  | 'pieces'     // studs, joists
  | 'linear_ft'  // plates, trim
  | 'sqft'       // flooring, roofing, insulation
  | 'cubic_ft'   // concrete
  | 'rolls'      // insulation batts
  | 'bags'       // concrete mix, mortar
  | 'boxes'      // nails, screws, tile
  | 'gallons'    // paint, primer
  | 'each'       // fixtures, doors, windows
  | 'bundles'    // shingles
  | 'yards';     // carpet

export interface CalculationAudit {
  formula: string;
  inputs: Record<string, number | string>;
  steps: string[];
  result: number;
}

// --- Clarification System ---

export interface Clarification {
  id: string;
  level: 1 | 2; // Level 1 = AI resolves, Level 2 = contractor needed
  question: string;
  context: ClarificationContext;
  status: 'pending' | 'ai_resolved' | 'awaiting_contractor' | 'resolved';
  ai_answer: string | null;
  contractor_answer: string | null;
  resolved_at: string | null;
  page_number: number;
  element_id: string | null;
}

export interface ClarificationContext {
  page_number: number;
  region: { x: number; y: number; width: number; height: number } | null;
  related_elements: string[];
  description: string;
}

// --- Audit Trail ---

export interface AuditEntry {
  id: string;
  timestamp: string;
  agent: string;
  action: string;
  details: string;
  page_number: number | null;
  data: Record<string, unknown> | null;
}

// --- Agent System ---

export type AgentType = 'segmenter' | 'vision_ocr' | 'architect' | 'clarification' | 'estimator';

export interface AgentResult<T = unknown> {
  agent: AgentType;
  success: boolean;
  data: T;
  errors: string[];
  warnings: string[];
  processing_time_ms: number;
  audit_entries: AuditEntry[];
}

// --- Pipeline ---

export interface PipelineState {
  currentPhase: ProjectStatus;
  progress: number; // 0-100
  currentAgent: AgentType | null;
  currentPage: number | null;
  totalPages: number;
  messages: PipelineMessage[];
}

export interface PipelineMessage {
  timestamp: string;
  level: 'info' | 'warning' | 'error' | 'success';
  message: string;
  agent: AgentType | null;
}
