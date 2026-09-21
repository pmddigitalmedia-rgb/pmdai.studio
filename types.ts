
export interface WeatherPreset {
  id: string;
  label: string;
  description: string;
  prompt: string;
  icon: string;
  color: string;
  model?: string;
  isPremium?: boolean;
  hasAiWatermark?: boolean;
  costFactor?: 'vision' | 'video' | 'grounding';
}

export interface StudioToolCategory {
  id: string;
  title: string;
  description: string;
  badge?: string;
  toolIds: string[];
}

export type ImageStatus = 'pending' | 'processing' | 'complete' | 'error';

export interface GeneratedAsset {
  url: string;
  type: 'image' | 'video';
  timestamp: number;
  tools?: string[];
}

export interface ImageItemConfig {
  emptyRoomFirst?: boolean;
  stagingRoom?: string;
  stagingStyle?: string;
  stageDescriptor?: string;
  bedWallPlacement?: string; // 'auto' | 'back' | 'left' | 'right' | 'opposite_windows'
  swapStyle?: string;
  swapDescriptor?: string;
  wallColor?: string;
  wallMask?: string; // Data URL of the selective wall mask
  floorSample?: string; // Data URL of the sample texture
  ceilingSample?: string; // Data URL of the sample texture
  customPrompt?: string;
  enhancedPrompt?: string;
  customVideoPrompt?: string;
  enhancedVideoPrompt?: string;
  lassoMask?: string; // Data URL of the binary selection mask
  videoAspectRatio?: '16:9' | '9:16';
  astroLat?: string;
  astroLng?: string;
  astroAddress?: string;
  astroHeading?: string;
  panoYaw?: number;
  panoPitch?: number;
  panoFov?: number;
}

export interface ImagePreAnalysis {
  roomType: string;
  sceneType: 'interior' | 'exterior' | 'aerial' | 'panorama';
  occupancy: 'vacant' | 'sparsely_furnished' | 'fully_furnished' | 'cluttered';
  lightingCondition: string;
  flooringType?: string;
  clutterLevel: 'none' | 'light' | 'moderate' | 'heavy';
  clutterItems?: string[];
  detectedFeatures: string[];
  recommendedTools: string[];
  toolRationale?: Record<string, string>;
  suggestedStagingStyle?: string;
  suggestedStagingRoom?: string;
  suggestedBedWall?: string; // e.g. "back", "left", "right", "opposite_windows"
  skyPercentage?: number; // Estimated percentage of visible open sky (0-100)
  hasWindows?: boolean;   // Whether windows/sliding glass doors with outdoor view are present
  summary: string;
  timestamp: number;
}

export interface ImageItem {
  id: string;
  file: File;
  previewUrl: string;
  base64: string | null;
  history: GeneratedAsset[];
  currentHistoryIndex: number;
  status: ImageStatus;
  error?: any;
  selected?: boolean;
  dimensions?: { width: number; height: number };
  is360?: boolean;
  dateAdded: number;
  selectionOrder?: number;
  autoDuplicate?: boolean;
  // Per-image tool settings
  assignedTools: string[]; // Array of tool IDs
  config: ImageItemConfig;
  cachedMask?: string; // Legacy/Default mask (usually sky)
  cachedMaskSky?: string; // Dedicated sky/trees mask
  cachedMaskSurfaces?: string; // Dedicated interior surfaces mask
  cachedMaskClutter?: string; // Dedicated object decluttering mask
  cachedMaskDepersonalize?: string; // Dedicated personal photos mask
  preAnalysis?: ImagePreAnalysis;
  isAnalyzing?: boolean;
}

export interface SocialAssets {
  headshot: string | null;
  logo: string | null;
  propertyImages: string[];
  propertyMasks?: string[]; // Corresponding masks for propertyImages
  assetLibrary?: Record<string, string>; // Filename -> DataURL map
  customAudio?: { name: string, url: string } | null;
  metadata?: Record<string, { aiCaptions?: string | null, propertyStats?: any | null }>;
  
  // Second Realtor Prompts & Data
  headshot2?: string | null;
  logo2?: string | null;
  agent2Name?: string;
  agent2Brokerage?: string;
  agent2PhoneNumber?: string;
  agent2Email?: string;
}

// Added LibraryItem and ComparisonPair interfaces for the BeforeAfterGenerator component.
export interface LibraryItem {
  id: string;
  url: string;
  name: string;
}

export interface ComparisonPair {
  id: string;
  beforeId: string | null;
  afterId: string | null;
  status: 'idle' | 'rendering' | 'done' | 'error';
  videoUrl: string | null;
  format: 'webm' | 'mp4';
}

// --- NEW TYPES FOR CUSTOM TOOL INTEGRATION ---
export type ViewMode = 'dashboard' | 'editor' | 'preview';

export interface FloorPlanHotspot {
  id: string;
  x: number; // Percentage 0-100 on width
  y: number; // Percentage 0-100 on height
  title: string;
  description?: string;
  targetImageIndex?: number;
  targetImageUrl?: string;
  is360?: boolean;
}

export interface PropertyData {
  id: string;
  unit?: string;
  address?: string;
  city?: string;
  price?: string;
  bed?: string;
  bath?: string;
  sqft?: string;
  email?: string;
  phoneNumber?: string;
  website?: string;
  headshot?: string;
  logo?: string;
  floorPlan?: string;
  floorPlanHotspots?: FloorPlanHotspot[];
  threeDFloorPlan?: string;
  matterportUrl?: string;
  videoUrl?: string;
  drone?: string;
  galleryImages: string[];
  agentName?: string;
  brokerage?: string;
  showMap?: boolean;

  // Second Realtor fields
  agent2Name?: string;
  agent2Brokerage?: string;
  agent2PhoneNumber?: string;
  agent2Email?: string;
  agent2Headshot?: string;
  agent2Logo?: string;
}

export type UserRole = 'admin' | 'client';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  role: UserRole;
  credits: number;
  plan?: 'starter' | 'pro' | 'agency' | 'free';
  createdAt: number;
  updatedAt: number;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  amount: number;
  type: 'usage' | 'purchase' | 'bonus' | 'refund';
  description: string;
  toolId?: string;
  timestamp: number;
}

export interface CreditPack {
  id: string;
  name: string;
  credits: number;
  price: string;
  priceInCents: number;
  currency: string;
  unitPrice: string;
  photoEdits: string;
  popular: boolean;
  description: string;
  features?: string[];
}
