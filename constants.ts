
import { WeatherPreset, PropertyData, StudioToolCategory, CreditPack } from './types';

// --- TOKEN ESTIMATION ---
export const TOOL_TOKEN_ESTIMATES: Record<string, { standard: number; eco: number }> = {
  sunny_skies: { standard: 2400, eco: 1200 },
  sun_drenched: { standard: 2400, eco: 1200 },
  window_splash: { standard: 2400, eco: 1200 },
  auto_declutter: { standard: 3000, eco: 1500 },
  declutter_direct: { standard: 3000, eco: 1500 },
  furniture: { standard: 3500, eco: 1800 },
  seasonal_change: { standard: 2800, eco: 1400 },
  style_swapper: { standard: 3500, eco: 1800 },
  virtual_depersonalize: { standard: 3000, eco: 1500 },
  white_balance: { standard: 1500, eco: 800 },
  object_removal: { standard: 2500, eco: 1200 },
  lush_lawn: { standard: 2000, eco: 1000 },
  sunset: { standard: 2800, eco: 1400 },
  snow_removal: { standard: 2500, eco: 1200 },
  empty_room: { standard: 3000, eco: 1500 },
  custom_edit: { standard: 2500, eco: 1200 },
  sunny_skies_video: { standard: 8000, eco: 4000 },
  dawn_to_dusk_video: { standard: 9000, eco: 4500 },
  custom_video: { standard: 8500, eco: 4250 },
  furniture_build_video: { standard: 9000, eco: 4500 },
  cable_remover: { standard: 1500, eco: 800 },
  wall_unifier: { standard: 2000, eco: 1000 },
  floor_replacer: { standard: 3000, eco: 1500 },
  ceiling_replacer: { standard: 3000, eco: 1500 },
  p360_sunny_skies: { standard: 4000, eco: 2000 },
  p360_auto_declutter: { standard: 5000, eco: 2500 },
  p360_vstaging_3d: { standard: 6000, eco: 3000 },
  p360_style_swap: { standard: 6000, eco: 3000 },
  p360_hdr_recovery: { standard: 3500, eco: 1800 },
};

// --- ACTUAL ENGINE RUN COSTS ---
export interface ToolEngineCostInfo {
  engine: string;
  cost: number;
  costString: string;
  centsString: string;
  credits: number;
  pipeline?: string;
  category: 'image-diffusion' | 'inpaint-fill' | 'video-generation';
}

export const TOOL_ENGINE_COSTS: Record<string, ToolEngineCostInfo> = {
  // FLUX.1 Pro Kontext Tools ($0.040 - $0.050/run, avg $0.045 = 4.5¢, 30 Credits)
  furniture: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  style_swapper: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  sunset: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  sunny_skies: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  sun_drenched: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  window_splash: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  seasonal_change: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  snow_removal: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  white_balance: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  empty_room: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  lush_lawn: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  custom_edit: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  wall_unifier: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  floor_replacer: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  ceiling_replacer: {
    engine: 'FLUX.1 Pro Kontext',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 30,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },

  // Surgical Declutter & Depersonalize Tools (SAM-2/3 + FLUX.1 Fill / Pro Kontext)
  declutter_direct: {
    engine: 'SAM-3 + FLUX.1 Fill',
    cost: 0.035,
    costString: '$0.035',
    centsString: '3.5¢',
    credits: 30,
    pipeline: 'fal-ai/sam-3 + fal-ai/flux-fill/dev',
    category: 'inpaint-fill'
  },
  auto_declutter: {
    engine: 'SAM-3 + FLUX.1 Fill',
    cost: 0.035,
    costString: '$0.035',
    centsString: '3.5¢',
    credits: 30,
    pipeline: 'fal-ai/sam-3 + fal-ai/flux-fill/dev',
    category: 'inpaint-fill'
  },
  cable_remover: {
    engine: 'SAM-3 + FLUX.1 Fill',
    cost: 0.035,
    costString: '$0.035',
    centsString: '3.5¢',
    credits: 30,
    pipeline: 'fal-ai/sam-3 + fal-ai/flux-fill/dev',
    category: 'inpaint-fill'
  },
  virtual_depersonalize: {
    engine: 'Gemini Flash + FLUX Kontext',
    cost: 0.046,
    costString: '$0.046',
    centsString: '4.6¢',
    credits: 30,
    pipeline: 'gemini-2.5-flash + fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  object_removal: {
    engine: 'FLUX.1 [dev] Fill',
    cost: 0.030,
    costString: '$0.030',
    centsString: '3.0¢',
    credits: 30,
    pipeline: 'fal-ai/flux-lora-fill',
    category: 'inpaint-fill'
  },

  // 360 Panorama Tools (90 Credits consumed)
  p360_sunny_skies: {
    engine: 'FLUX.1 Pro Kontext 360',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 90,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  p360_sunny_splash: {
    engine: 'FLUX.1 Pro Kontext 360',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 90,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  p360_auto_declutter: {
    engine: 'SAM-2 + FLUX.1 Pro Fill',
    cost: 0.055,
    costString: '$0.055',
    centsString: '5.5¢',
    credits: 90,
    pipeline: 'fal-ai/evf-sam + fal-ai/flux-pro/v1/fill',
    category: 'inpaint-fill'
  },
  p360_vstaging_3d: {
    engine: 'FLUX.1 Pro Kontext 360',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 90,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  p360_style_swap: {
    engine: 'FLUX.1 Pro Kontext 360',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 90,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },
  p360_hdr_recovery: {
    engine: 'FLUX.1 Pro Kontext 360',
    cost: 0.045,
    costString: '$0.045',
    centsString: '4.5¢',
    credits: 90,
    pipeline: 'fal-ai/flux-pro/kontext',
    category: 'image-diffusion'
  },

  // Video Generation Tools (MiniMax H3 / Wan i2v: ~$0.10 = 10.0¢, 90 Credits consumed)
  sunny_skies_video: {
    engine: 'MiniMax H3 Max Video',
    cost: 0.100,
    costString: '$0.100',
    centsString: '10.0¢',
    credits: 90,
    pipeline: 'minimax/h3/image-to-video',
    category: 'video-generation'
  },
  dawn_to_dusk_video: {
    engine: 'MiniMax H3 Max Video',
    cost: 0.100,
    costString: '$0.100',
    centsString: '10.0¢',
    credits: 90,
    pipeline: 'minimax/h3/image-to-video',
    category: 'video-generation'
  },
  custom_video: {
    engine: 'MiniMax H3 Max Video',
    cost: 0.100,
    costString: '$0.100',
    centsString: '10.0¢',
    credits: 90,
    pipeline: 'minimax/h3/image-to-video',
    category: 'video-generation'
  },
  furniture_build_video: {
    engine: 'MiniMax H3 Max Video',
    cost: 0.100,
    costString: '$0.100',
    centsString: '10.0¢',
    credits: 90,
    pipeline: 'minimax/h3/image-to-video',
    category: 'video-generation'
  }
};

// Exported constants for file validation and processing
export const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-m4v',
  'video/ogg',
  'video/mpeg'
];

export const MAX_FILE_SIZE_MB = 150;

// Exported furniture styles for virtual staging and style swapping
export const FURNITURE_STYLES = [
  'Modern',
  'Contemporary',
  'Industrial',
  'Luxury',
  'Scandinavian',
  'Minimalist',
  'Mid-Century Modern',
  'Traditional'
];

export const STAGING_ROOMS = [
  'living room',
  'living room and dining room',
  'Bedroom',
  'Kitchen',
  'Dining room',
  'Den',
  'Office',
  'Rec room',
  'Patio Furniture',
  'Media Room'
];

export const BED_WALL_OPTIONS = [
  { id: 'auto', label: 'Auto (Best Solid Wall - Zero Windows)' },
  { id: 'back', label: 'Back / Center Solid Wall' },
  { id: 'left', label: 'Left Solid Wall' },
  { id: 'right', label: 'Right Solid Wall' },
  { id: 'opposite_windows', label: 'Opposite Windows (Preserve Views)' },
] as const;

export type BedWallOption = typeof BED_WALL_OPTIONS[number]['id'];

export const getBedPlacementPromptDirective = (roomType?: string, wallPlacement?: string): string => {
  const isBedroom = (roomType || '').toLowerCase().includes('bed');
  if (!isBedroom) return '';

  let directive = ' [BED_PLACEMENT_AND_WINDOW_PROTECTION_PROTOCOL]: (1) SOLID WALL ANCHOR: The bed and headboard MUST be anchored against the primary solid, uninterrupted wall that has NO windows or glass openings. (2) STRICT WINDOW & NATURAL LIGHT PRESERVATION: Absolutely NEVER place the bed, headboard, or nightstands in front of, overlapping, or partially obstructing ANY window, sliding glass door, or architectural opening. All windows, window frames, glass panes, outdoor views, and natural incoming light must remain 100% clear and completely unobstructed. (3) SYMMETRY & CLEARANCES: Center the bed symmetrically along the chosen solid wall with flanking nightstands and bedside lamps, maintaining clear walking pathways to all doorways and closets.';

  if (wallPlacement === 'back') {
    directive += ' [BED_WALL_SELECTION]: SPECIFIC WALL MANDATE: Position the headboard of the bed centered firmly against the BACK / REAR solid wall, keeping all windows completely unobstructed.';
  } else if (wallPlacement === 'left') {
    directive += ' [BED_WALL_SELECTION]: SPECIFIC WALL MANDATE: Position the headboard of the bed centered firmly against the LEFT solid wall, keeping all windows completely unobstructed.';
  } else if (wallPlacement === 'right') {
    directive += ' [BED_WALL_SELECTION]: SPECIFIC WALL MANDATE: Position the headboard of the bed centered firmly against the RIGHT solid wall, keeping all windows completely unobstructed.';
  } else if (wallPlacement === 'opposite_windows') {
    directive += ' [BED_WALL_SELECTION]: SPECIFIC WALL MANDATE: Position the headboard of the bed centered against the solid wall directly OPPOSITE the room windows, preserving maximum natural light flow and exterior views.';
  } else {
    directive += ' [BED_WALL_SELECTION]: Automatically place the bed against the single longest uninterrupted solid wall that has zero windows.';
  }

  return directive;
};

export const WEATHER_PRESETS: WeatherPreset[] = [
  {
    id: 'sunny_skies',
    label: 'Outdoor Sunny Skies',
    description: 'Replace grey or overcast outdoor skies with vibrant blue sunny skies and cast natural sunlight onto the house and grounds while strictly locking all architecture and foliage. Only use if there is sky in the image.',
    prompt: 'OUTDOOR SUNNY SKIES & NATURAL SUNLIGHT PROTOCOL: [USAGE_REQUIREMENT]: Only use if there is sky in the image. [TASK]: (1) Replace grey, overcast, or blown-out outdoor sky exclusively with vibrant, deep blue sunny skies with natural, soft high-altitude clouds, and (2) Cast realistic, natural warm directional sunlight, crisp architectural sun-and-shade contrast, and realistic sunlit highlights across the building exterior, roof, walls, and grounds consistent with a clear sunny day. [WINDOWS_OF_HOUSE_RULE]: Strictly do NOT put sky, clouds, or blue sky graphics into the windows, window panes, window glass, or window reflections of the house or building. Windows are physical architectural elements and must remain authentic architectural glass reflecting the environment naturally, NEVER replaced with sky decals. [ZERO_STRUCTURAL_MODIFICATION_RULE]: Zero modifications to buildings, structures, walls, rooflines, chimneys, gutters, architectural details, windows, window frames, mullions, fencing, or powerlines. Keep building structure 100% identical. [ZERO_BOTANICAL_MODIFICATION_RULE]: Zero modifications or removal of trees, tree trunks, branches, fine twig silhouettes, leaves, bushes, landscaping, grass, or foliage. Maintain every existing tree and leaf silhouette exactly in place against the new sky. [SUNLIGHT_RELIGHTING]: Sculpt clean directional sunlight luminance, natural warm daylight illumination, and realistic sun-and-shade contrast across exterior walls, roof, pavers, driveway, and landscaping while preserving authentic material textures.',
    icon: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
    color: 'bg-blue-50 text-blue-600 border-blue-200'
  },
  {
    id: 'sun_drenched',
    label: 'Outdoor Sun Casting',
    description: 'Floods outdoor photos with direct sunlight highlights and crisp architectural sun shadows while strictly preserving the exact original color temperature. To be used when there is no sky to be seen but you want sun on the ground.',
    prompt: 'OUTDOOR SUN CASTING & RELIGHTING PROTOCOL: [USAGE_INSTRUCTION]: To be used when there is no sky to be seen but you want sun on the ground. [TASK]: Add high-contrast, directional direct sunlight highlights and crisp architectural sun-and-shade contrast to the outdoor scene and ground without altering color temperature. [NO_SKY_DEPENDENCY]: Do NOT look for, require, or modify any sky. Designed specifically for outdoor spaces (patios, courtyards, landscaped areas, facades, covered porches, side yards, gardens, outdoor kitchens, dining terraces) with little or no visible sky. [COLOR_TEMPERATURE_LOCK]: Strictly do NOT shift, warm, or change the color temperature, white balance, or hue of the image. Do NOT apply warm/golden hour casts, yellow filters, or orange tinting. Maintain the exact native chromatic balance and authentic material colors of the original photo. [LUMINANCE_&_CONTRAST_TRANSFORMATION]: Transform flat, overcast, or shaded ambient lighting by sculpting clean directional direct sunlight luminance and dynamic range across exterior walls, ground pavers, concrete, decking, lawn/turf, outdoor furniture, and textures while keeping color temperature unchanged. [SHADOW_SCULPTING]: Generate realistic, clean directional shadows, dappled foliage shade patterns from trees/canopies, and natural sunlit highlights. [STRUCTURAL_INTEGRITY]: Strictly preserve all architectural structures, building materials, vegetation species, outdoor furniture, and fixtures. Do not alter dimensions or add unrelated objects.',
    icon: 'M12 3v1.5m6.364 1.136l-1.06 1.06M21 12h-1.5m-1.136 6.364l-1.06-1.06M12 21v-1.5m-6.364-1.136l1.06-1.06M3 12h1.5m1.136-6.364l1.06 1.06M9 12a3 3 0 116 0 3 3 0 01-6 0z',
    color: 'bg-amber-500 text-white border-amber-400'
  },
  {
    id: 'window_splash',
    label: 'Indoor Sun',
    description: 'Casts realistic natural sunlight and soft architectural window shadows into interior rooms across floors, rugs, and surfaces while strictly preserving room architecture, furniture, and original color temperature.',
    prompt: 'INDOOR SUN & EXTERIOR WINDOW RELIGHTING PROTOCOL: [STRICT_OBJECT_IDENTITY_LOCK]: 100% PRESERVE AND KEEP ALL EXISTING OBJECTS, TREES, BRANCHES, LEAVES, FOLIAGE, LAWN, PATIO, BUILDINGS, AND LANDSCAPING COMPLETELY UNCHANGED. DO NOT REPLACE, REGENERATE, ALTER, SHIFT, OR INTRODUCE ANY NEW OBJECTS OR GEOMETRY. [COLOR_TEMPERATURE_LOCK]: Strictly do NOT shift, warm, or change the color temperature, white balance, or hue of the image. Maintain the exact same original color temperature and authentic material colors of the original photo. Do NOT apply yellow tinting, orange color casts, or heavy warming filters. [LIGHTING_ENHANCEMENT]: ONLY cast clean direct sunlight highlights and natural directional daylight exposure onto the surfaces of the existing trees, leaves, and exterior grounds seen through the window glass, preserving original color temperature identically. Keep window frames, mullions, glass reflections, and indoor room 100% identical.',
    icon: 'M12 3v1.5m6.364 1.136l-1.06 1.06M21 12h-1.5m-1.136 6.364l-1.06-1.06M12 21v-1.5m-6.364-1.136l1.06-1.06M3 12h1.5m1.136-6.364l1.06 1.06M9 12a3 3 0 116 0 3 3 0 01-6 0z',
    color: 'bg-orange-50 text-orange-600 border-orange-200'
  },
  {
    id: 'declutter_direct',
    label: 'De Clutter',
    description: 'Deeply declutters all non-furniture items, piles, and surface mess directly in-place. Includes MLS-compliant AI watermark.',
    prompt: 'DEEP TOTAL DECLUTTER PROTOCOL: [TASK]: Surgically and completely eliminate all clutter, mess, and non-permanent items from the room. Remove all items from all tables, countertops, desks, islands, nightstands, and shelves. Remove all floor clutter including clothes, shoes, bags, boxes, storage bins, laundry baskets, pet accessories, workout equipment, toys, and cords. Remove all loose cables, wires, charging cords, trash, papers, mail, dishes, glassware, cups, bottles, containers, toiletries, cleaning supplies, and loose countertop clutter. [SURFACE RESTORATION]: Clean, clear, empty, model-home ready surfaces and open, spotless floors matching surrounding materials with photographic precision. [STRICT_FLOOR_LOCK]: ABSOLUTELY DO NOT change, replace, bleach, restain, re-tile, or mutate ANY existing flooring material. Hardwood grain, plank width, plank direction, wood stain color, tile pattern, carpet texture, and grout MUST remain 100% identical and unchanged to the source photo. The uncovered floor where clutter was lifted MUST seamlessly match the surrounding floor material with photorealistic precision. NEVER change hardwood to carpet, carpet to hardwood, or alter tile or wood tones. [STRICT_WALL_COLOR_AND_TRIM_LOCK]: ABSOLUTELY DO NOT change, repaint, tint, lighten, darken, or shift ANY wall color, wall paint, wallpaper, accent walls, moldings, baseboards, door trims, or ceilings. All walls, trims, and paint finishes must remain 100% strictly identical in color and texture to the original photo. [STRICT_ROOM_STRUCTURE_PRESERVATION]: Absolutely zero architectural changes. Keep all room boundaries, walls, doorways, door frames, windows, window panes, ceiling height, pillars, and built-ins 100% structurally identical. Keep all primary large furniture (sofas, beds, dining tables, kitchen cabinetry) completely in place.',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09-3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0 3.09-3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    color: 'bg-teal-600 text-white border-teal-400',
    hasAiWatermark: true
  },
  {
    id: 'furniture',
    label: 'Modern Stage',
    description: 'Adds modern furniture to empty or sparsely furnished rooms while strictly preserving all existing walls, windows, doors, and architecture.',
    prompt: 'VIRTUAL STAGING PROTOCOL: [TASK]: Virtually stage the empty {room} with {style} furniture. [STRICT_STRUCTURAL_PRESERVATION]: Zero architectural alterations. Absolutely DO NOT add, move, shift, or remove any walls, partition walls, half walls, archways, columns, posts, or room boundaries. Do NOT add new drywall or alter existing doorways, windows, beams, moldings, baseboards, or ceiling lines. Keep the exact physical room geometry and wall locations 100% identical. [STRICT_WALL_COLOR_LOCK]: Absolutely DO NOT alter, repaint, or change existing wall paint colors, accent walls, or wall textures. Keep all walls 100% identical in color and finish to the source photo. Only place freestanding furniture, area rugs, lighting, and decor onto existing open floor space and surfaces. [SCALE_DEPTH]: Prioritize architectural realism and correct 3D scale. All furniture pieces must be sized proportionally to the physical room dimensions. [FRAME_FREEDOM]: Allow furniture to be partially cut off by the frame edges if its realistic size requires it; never shrink items unnaturally to force them fully into view. [INTEGRITY]: KEEP original walls, floors, and windows exactly as they are.',
    icon: 'M15.75 6a2.25 2.25 0 0 0-2.25 2.25v1.5a2.25 2.25 0 0 0 2.25 2.25h1.5a2.25 2.25 0 0 0 2.25-2.25v-1.5A2.25 2.25 0 0 0 15.75 6ZM3 15.75A2.25 2.25 0 0 1 5.25 13.5h13.5A2.25 2.25 0 0 1 21 15.75V18a2.25 2.25 0 0 1-2.244 2.077H5.25A2.25 2.25 0 0 1 3 18v-2.25Z',
    color: 'bg-rose-500 text-white border-rose-400',
    hasAiWatermark: true
  },
  {
    id: 'seasonal_change',
    label: 'Season Shift',
    description: 'Converts dormant winter or autumn vegetation into lush, vibrant Spring/Summer foliage. Includes MLS-compliant AI watermark.',
    prompt: '[TASK]: Global seasonal botanical transformation. [ACTION]: Convert all dormant or brown vegetation to lush, vibrant green Spring foliage. Add high-fidelity leaves to bare tree branches. [ATMOSPHERE]: Shift global atmosphere to a warm, clear day with high-visibility. [INTEGRITY]: Man-made structures, windows, and furniture must remain 100% untouched. No changes to the building\'s architecture or color.',
    icon: 'M12 2.25c4.97 0 9 4.03 9 9 0 4.14-3.36 7.5-7.5 7.5H4.5v-7.5c0-4.97 4.03-9 9-9z',
    color: 'bg-emerald-700 text-white border-emerald-500',
    hasAiWatermark: true
  },
  {
    id: 'style_swapper',
    label: 'Style Swap',
    description: 'Replaces existing furniture with a new consistent style while locking all floors, walls, floorplans, and architecture 100% unchanged. Includes MLS-compliant AI watermark.',
    prompt: 'STYLE SWAP PROTOCOL: [TASK]: Identify all existing furniture and decor. [ACTION]: Surgically replace all identified items with new furniture in the style of {style}. [STRICT_FLOOR_MATERIAL_AND_FINISH_LOCK]: ABSOLUTELY DO NOT change, replace, bleach, restain, re-tile, or mutate ANY existing flooring material. Hardwood grain, plank direction, plank width, wood stain color, tile pattern, carpet texture, and grout MUST remain 100% identical and unchanged to the source photo. Any uncovered floor area where previous furniture or rugs were lifted MUST seamlessly match the surrounding floor material with photorealistic precision. [STRICT_STRUCTURAL_PRESERVATION]: Zero structural modifications. Absolutely DO NOT add new walls, partition walls, pony walls, archways, columns, or room dividers. Do NOT move, resize, shift, or eliminate existing walls, doors, windows, structural posts, or room layout. Keep the exact floorplan geometry and architectural surfaces 100% identical. [STRICT_WALL_COLOR_LOCK]: Absolutely DO NOT change, repaint, or tint any wall colors or wall paint finishes. Keep all existing wall paint colors and textures 100% identical to the source image. Only replace freestanding furniture, rugs, art, and decor. [SCALE_DEPTH]: Ensure new items match the physical scale and perspective of the original space. If a large item (like a sofa) needs to extend beyond the frame to maintain realism, allow it to be truncated. [INTEGRITY]: Keep the original room layout, floor plan, and fixed architectural elements 100% identical.',
    icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99',
    color: 'bg-fuchsia-600 text-white border-fuchsia-400',
    hasAiWatermark: true
  },
  {
    id: 'virtual_depersonalize',
    label: 'Depersonalize',
    description: 'Surgically replaces personal photos and family portraits with neutral artwork while strictly locking 100% of furniture and wall colors unchanged.',
    prompt: 'SURGICAL DEPERSONALIZATION PROTOCOL: [STRICT_MANDATORY_RULE: ONLY PERSONALIZED IMAGES / FAMILY PHOTOS TO BE CHANGED]. [PRIMARY_TARGET]: Identify personal framed portraits, family photos, personal photographs, diplomas, and personalized name art hanging on walls or displayed on tables/shelves. [SURGICAL_ACTION]: Replace ONLY the image content inside those photo frames with neutral, generic non-personal artwork (such as serene landscape photography, architectural sketches, or minimalist botanical art) within the exact same frame. [ZERO_FURNITURE_MODIFICATION_STRICT_RULE]: Absolutely DO NOT change, swap, add, move, recolor, or modify ANY furniture whatsoever. All sofas, chairs, tables, desks, beds, rugs, lamps, and cabinets must remain 100% strictly identical and untouched. [ZERO_WALL_COLOR_MODIFICATION_STRICT_RULE]: Absolutely DO NOT change, repaint, tint, recolor, lighten, or darken ANY wall color or wall paint. Keep all wall colors, wall paint finishes, trims, moldings, and wall textures 100% strictly identical to the original photo. [PRESERVATION]: Keep all flooring, ceilings, doors, windows, lighting, and room architecture 100% untouched.',
    icon: 'M15.75 6a2.25 2.25 0 0 0-2.25 2.25v1.5a2.25 2.25 0 0 0 2.25 2.25h1.5a2.25 2.25 0 0 0 2.25-2.25v-1.5A2.25 2.25 0 0 0 15.75 6ZM3 15.75A2.25 2.25 0 0 1 5.25 13.5h13.5A2.25 2.25 0 0 1 21 15.75V18a2.25 2.25 0 0 1-2.244 2.077H5.25A2.25 2.25 0 0 1 3 18v-2.25Z',
    color: 'bg-indigo-700 text-white border-indigo-600'
  },
  {
    id: 'white_balance',
    label: 'Neutralizer',
    description: 'Eliminates artificial color casts to achieve a crisp, neutral 5500K gallery standard.',
    prompt: 'WHITE BALANCE NEUTRALIZATION PROTOCOL: [TASK]: Identify and eliminate artificial color casts. [ACTION]: Neutralize yellowing from warm interior bulbs and blueing from deep shadows. [TARGET]: Calibrate global illumination to a crisp, neutral 5500K gallery standard. [INTEGRITY]: Preserve original architectural textures and geometric lines. Do not alter furniture or decor.',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09-3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    color: 'bg-zinc-100 text-zinc-900 border-zinc-300'
  },
  {
    id: 'object_removal',
    label: 'Magic Eraser',
    description: 'Surgically removes objects you highlight and inpaints the background to match perfectly.',
    prompt: 'Surgically remove the objects highlighted in the mask and seamlessly inpaint the background to match the surroundings. Maintain consistent textures, lighting, and architectural lines.',
    icon: 'M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0',
    color: 'bg-red-600 text-white border-red-400'
  },
  {
    id: 'lush_lawn',
    label: 'Lush Greenery',
    description: 'Replaces brown or patchy grass with a healthy, vibrant green professional lawn. Includes MLS-compliant AI watermark.',
    prompt: 'Replace patchy or brown grass with a lush, healthy green lawn. Maintain all edges and architectural boundaries.',
    icon: 'M8.25 21v-4.875c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125V21m0 0h4.5V3.545M12.75 21h7.5V10.75M2.25 21h1.5m18 0h-18M2.25 9l4.5-1.636M18.75 3l-1.5.545m0 6.205 1.5-.545m-1.5.545v-6.205',
    color: 'bg-emerald-500 text-white border-emerald-400',
    hasAiWatermark: true
  },
  {
    id: 'sunset',
    label: 'Day to Dusk',
    description: 'Transforms daylight scenes into a vibrant golden-hour sunset with warm skies, bright ambient illumination, and soft window glows. Includes MLS-compliant AI watermark.',
    prompt: 'GOLDEN HOUR SUNSET REAL ESTATE PROTOCOL: [TASK]: Transform the daytime scene into a stunning, bright golden-hour sunset architectural photo. [ATMOSPHERIC LIGHTING & EXPOSURE]: Fill the sky with dramatic, vivid golden-hour sunset clouds featuring rich amber, warm gold, and soft pink/apricot tones. CRITICAL: Maintain bright ambient exposure and clear visibility across the entire property facade, roof, lawn, and driveway. STRICTLY FORBIDDEN: DO NOT render nighttime, dark blue hour, pitch black skies, or underexposed shadows. This is a bright golden-hour sunset shot with full daytime clarity and warm sunset warmth. [CRITICAL INTERIOR WINDOW ILLUMINATION]: Make sure most to all windows across the entire house facade, upper floors, lower floors, and side facades have warm interior lights turned ON inside, giving every window glass a luminous, cozy, welcoming 2700K-3000K golden amber ambient glow visible from the outside. Also turn on exterior entry coach lights, porch lights, sconces, and landscape pathway lights with a warm matching glow. [STRUCTURAL PRESERVATION]: Keep the house facade, materials, walls, windows, rooflines, trim, doors, and surroundings 100% identical and intact.',
    icon: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
    color: 'bg-orange-50 text-white border-orange-400',
    hasAiWatermark: true
  },
  {
    id: 'snow_removal',
    label: 'Snow Removal',
    description: 'Clears snow from driveways, roofs, and lawns, replacing it with asphalt, shingles, or grass. Includes MLS-compliant AI watermark.',
    prompt: '[TASK]: Surgical snow and ice removal. [ACTION]: Identify all snow-covered surfaces including driveways, walkways, lawns, and roof planes. Replace snow with clean, dry textures: dark asphalt for driveways, lush green grass for lawns, and original shingle textures for roofs. [INTEGRITY]: Maintain absolute sharp geometric boundaries of the building and hardscaping. [LIGHTING]: Maintain a crisp, clear atmosphere at 5500K.',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09-3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    hasAiWatermark: true
  },
  {
    id: 'empty_room',
    label: 'Empty Room',
    description: 'Surgically removes all furniture, decor, and rugs to reveal the architectural blank canvas.',
    prompt: 'ARCHITECTURAL EMPTY ROOM PROTOCOL: [TASK]: Surgically and completely remove all furniture, sofas, chairs, tables, desks, beds, nightstands, dressers, area rugs, wall art, and loose decor to display an entirely vacant, empty space. [STRICT FLOOR LOCK]: ABSOLUTELY DO NOT change, replace, restain, bleach, or alter ANY existing flooring material. Hardwood grain, plank width, plank direction, wood stain color, tile pattern, and carpet texture MUST remain 100% identical and unchanged. Any uncovered floor area where furniture or rugs were removed MUST seamlessly match the surrounding original floor with photorealistic precision. [STRICT WALL COLOR & TRIM LOCK]: ABSOLUTELY DO NOT change, repaint, tint, or alter any wall colors, accent walls, wallpaper, moldings, baseboards, door trims, or ceilings. Keep all existing wall paint colors and textures 100% identical. [STRICT WINDOW & SKY IMMUTABILITY LOCK]: ABSOLUTELY DO NOT alter, repaint, or touch any windows, window frames, glass panes, or the outdoor scenery and sky visible through the windows. The outdoor sky, trees, and exterior scenery visible through windows MUST remain 100% FROZEN, UNTOUCHED, AND IDENTICAL to the source photo. [STRICT ARCHITECTURAL STRUCTURE LOCK]: Zero architectural changes. Keep all room boundaries, walls, doors, doorways, windows, and ceiling height 100% structurally identical.',
    icon: 'M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9',
    color: 'bg-slate-200 text-slate-800 border-slate-300'
  },
  {
    id: 'custom_edit',
    label: 'Custom Tool',
    description: 'Enter specific instructions for complex modifications not covered by standard tools.',
    prompt: '',
    icon: 'M16.862 4.487l1.687-1.688a1.875 1.151 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10',
    color: 'bg-slate-700 text-white border-slate-600'
  },
  {
    id: 'sunny_skies_video',
    label: 'Sun Morph',
    isPremium: true,
    costFactor: 'video',
    description: 'Generates a high-end cinematic 4K time-lapse showing clouds pulling apart to reveal a vibrant sunny afternoon using MiniMax H3 Max.',
    prompt: 'A cinematic time-lapse transition from a cloudy daytime scene to a vibrant sunny afternoon. The overcast sky pulls apart to reveal deep blue skies. Warm sunlight and sharp shadows sweep across the property. Architectural 4K style.',
    icon: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
    color: 'bg-yellow-500 text-white border-yellow-400'
  },
  {
    id: 'dawn_to_dusk_video',
    label: 'Dawn to Dusk',
    isPremium: true,
    costFactor: 'video',
    description: 'Generates a cinematic 2K/4K time-lapse video with a very slow daylight-to-sunset transition using MiniMax H3 Max, concluding with warm glowing dusk and twilight at the end.',
    prompt: 'A cinematic high-end architectural time-lapse video with an ultra-slow, gradual sunset progression across the entire duration. TIMELINE PACING: The video starts and remains in bright, crisp golden-hour daytime for the first 60% of the clip. Mid-way through the clip, the sun slowly sinks as warm amber, orange, and purple hues gradually paint the sky. Architectural interior and exterior lights gently click on and softly illuminate the windows and porch. Deep dusk, twilight colors, and evening ambience ONLY appear in the final seconds at the very end of the video. The camera performs an ultra-smooth, slow cinematic forward dolly towards the house facade. Photorealistic 4K architectural cinematography with slow, seamless lighting transition.',
    icon: 'M6 20.25h12m-7.5-3v3m3-3v3m-10.125-3h17.25c.621 0 1.125-.504 1.125-1.125V4.875c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125z',
    color: 'bg-indigo-600 text-white border-indigo-400'
  },
  {
    id: 'custom_video',
    label: 'Custom Video',
    isPremium: true,
    costFactor: 'video',
    description: 'Generates custom cinematic architectural video, camera motion, or animation using MiniMax H3 Max (minimax/h3-max/image-to-video) via Fal.ai.',
    prompt: '',
    icon: 'M15.75 10.5l4.72-4.72a.75.75 0 011.28.53v11.38a.75.75 0 01-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 002.25-2.25v-9a2.25 2.25 0 00-2.25-2.25h-9A2.25 2.25 0 002.25 7.5v9a2.25 2.25 0 002.25 2.25z',
    color: 'bg-rose-600 text-white border-rose-400'
  },
  {
    id: 'furniture_build_video',
    label: 'Furniture Build',
    isPremium: true,
    costFactor: 'video',
    description: 'Generates a cinematic architectural time-lapse video showing designer furniture assembling piece-by-piece using MiniMax H3 Max while keeping all walls, windows, and architecture 100% locked.',
    prompt: 'A high-end cinematic architectural time-lapse video showing modern designer furniture smoothly assembling and being built into the room. Sofas, armchairs, wooden tables, elegant rugs, and warm accent lighting assemble piece-by-piece in seamless stop-motion architectural staging into a fully furnished room. STRICT ARCHITECTURAL IMMUTABILITY: All original room walls, doorways, window openings, ceiling height, and structural dimensions remain 100% untouched and unchanged throughout the entire video. Photorealistic interior design, smooth camera motion.',
    icon: 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
    color: 'bg-violet-600 text-white border-violet-400'
  },
  {
    id: 'cable_remover',
    label: 'Remove Cables',
    description: 'Surgically removes exposed power cords, cables, and wires while preserving all other room elements.',
    prompt: 'CABLE & WIRE REMOVAL PROTOCOL: [TASK]: Identify and surgically remove all exposed power cables, extension cords, charging wires, and loose electrical wiring from the scene. [INPAINT_PROTOCOL]: Fill removed areas with perfectly matched textures of the underlying floor, wall, or surface. [INTEGRITY_LOCK]: Do not remove any other objects, furniture, or decor. Strictly focus only on cables and cords.',
    icon: 'M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622a4.5 4.5 0 0 1-1.242-7.244l4.5-4.5a4.5 4.5 0 0 1 6.364 6.364l-1.757 1.757m-13.35.622c-.31.31-.632.609-.961.896m5.893-5.56c.33-.287.65-.585.96-.895m-5.893 5.56a10.023 10.023 0 0 1-2.343-2.343m7.441-3.952a9.965 9.965 0 0 1 2.343 2.343',
    color: 'bg-slate-600 text-white border-slate-400'
  }
];

export const VISUAL_STAGER_PRESETS: WeatherPreset[] = [
  {
    id: 'wall_unifier',
    label: 'Wall Unifier',
    description: 'Re-paints wall surfaces to a uniform target color while preserving realistic shadows and texture.',
    prompt: 'WALL UNIFICATION PROTOCOL: [TASK]: Unify the room by sampling the wall color: {color}. [ACTION]: Identify all wall surfaces currently sharing a similar base hue or patchiness and repaint them uniformly with this specific target color. [INTEGRITY]: Maintain all original lighting conditions, realistic shadows, ambient occlusion, and architectural textures. Ensure the paint looks photorealistic and is applied only to wall surfaces. [LOCK]: Do not change furniture, windows, ceilings, or floor materials.',
    icon: 'M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1-1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42',
    color: 'bg-teal-600 text-white border-teal-400'
  },
  {
    id: 'floor_replacer',
    label: 'Floor Replacer',
    description: 'Replaces existing floor materials with a texture from your uploaded sample.',
    prompt: 'FLOOR REPLACEMENT PROTOCOL: [TASK]: Identify all floor surfaces in the room. [ACTION]: Surgically replace the existing floor material with the texture provided in the sample image. [INTEGRITY]: Maintain realistic perspective, lighting, shadows, and architectural boundaries. Ensure the new floor integrates seamlessly with baseboards and furniture.',
    icon: 'M3 8.25V18a2.25 2.25 0 0 0 2.25 2.25h13.5A2.25 2.25 0 0 0 21 18V8.25m-18 0V6a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 6v2.25m-18 0h18M5.25 6h.008v.008H5.25V6ZM7.5 6h.008v.008H7.5V6Zm2.25 0h.008v.008H9.75V6Z',
    color: 'bg-amber-600 text-white border-amber-400'
  },
  {
    id: 'ceiling_replacer',
    label: 'Ceiling Replacer',
    description: 'Replaces existing ceiling materials with a texture from your uploaded sample.',
    prompt: 'CEILING REPLACEMENT PROTOCOL: [TASK]: Identify all ceiling surfaces in the room. [ACTION]: Surgically replace the existing ceiling material with the texture provided in the sample image. [INTEGRITY]: Maintain realistic perspective, lighting, and integration with light fixtures and crown molding.',
    icon: 'M12 3L2 12h3v8h6v-6h2v6h6v-8h3L12 3z',
    color: 'bg-sky-600 text-white border-sky-400'
  }
];

export const STUDIO_TOOL_CATEGORIES: StudioToolCategory[] = [
  {
    id: 'virtual_staging',
    title: 'Virtual Staging',
    description: 'Modern furniture staging, style swapping, and room emptying',
    badge: 'Interiors',
    toolIds: ['furniture', 'style_swapper', 'empty_room']
  },
  {
    id: 'lighting_sun',
    title: 'Lighting & Sun',
    description: 'Sky replacement, direct sunlight, dawn to dusk, and color balance',
    badge: 'Atmosphere',
    toolIds: ['sunny_skies', 'sun_drenched', 'window_splash', 'sunset', 'white_balance']
  },
  {
    id: 'declutter_cleanup',
    title: 'Declutter & Cleanup',
    description: 'Direct in-place decluttering, magic eraser, cable removal, and depersonalization',
    badge: 'Removal',
    toolIds: ['declutter_direct', 'object_removal', 'cable_remover', 'virtual_depersonalize']
  },
  {
    id: 'architectural_finishes',
    title: 'Architectural Finishes',
    description: 'Wall repainting, selective accent walls, and floor/ceiling replacement',
    badge: 'Surfaces',
    toolIds: ['wall_unifier', 'floor_replacer', 'ceiling_replacer']
  },
  {
    id: 'landscaping_grounds',
    title: 'Landscaping & Grounds',
    description: 'Lawn greening, seasonal transitions, and snow removal',
    badge: 'Exteriors',
    toolIds: ['lush_lawn', 'seasonal_change', 'snow_removal']
  },
  {
    id: '360_panorama',
    title: '360 Panorama Tools',
    description: 'Equirectangular sky replacement, 360 sunlight, decluttering & 3D staging',
    badge: '360 VR',
    toolIds: ['p360_sunny_skies', 'p360_sunny_splash', 'p360_auto_declutter', 'p360_vstaging_3d', 'p360_style_swap', 'p360_hdr_recovery']
  },
  {
    id: 'cinematic_video',
    title: 'Cinematic Motion & Video',
    description: 'High-end architectural time-lapses, sun progression, and camera motion',
    badge: 'MiniMax AI',
    toolIds: ['sunny_skies_video', 'dawn_to_dusk_video', 'furniture_build_video', 'custom_video']
  },
  {
    id: 'custom_precision',
    title: 'Custom & Precision',
    description: 'Tailored prompt instructions and surgical lasso area selections',
    badge: 'Prompt / Lasso',
    toolIds: ['custom_edit']
  }
];

export const PANORAMA_PRESETS: WeatherPreset[] = [
  {
    id: 'p360_sunny_skies',
    label: '360 Outdoor Sun',
    description: 'Replace grey skies with blue sunny skies in 360 panoramas and cast natural daylight while locking all architecture and foliage.',
    prompt: 'OUTDOOR SUN 360 SURGICAL REPLACEMENT: [TASK]: (1) Perform high-fidelity equirectangular sky replacement with vibrant, deep blue sunny skies, and (2) Cast natural sunny daylight illumination across the scene. [WINDOWS_RULE]: Strictly do NOT put sky or clouds into windows, window panes, or window reflections of the house. Windows must remain authentic architectural glass. [ZERO_STRUCTURAL_MODIFICATION_RULE]: Zero modifications to buildings, structures, walls, rooflines, chimneys, architectural details, or window frames. [ZERO_BOTANICAL_MODIFICATION_RULE]: Zero modifications or removal of trees, tree trunks, branches, twig silhouettes, leaves, or landscaping. [HORIZON_BOUNDARY_LOCK]: Only replace the outdoor sky pixels above the horizon. All physical structures and landscaping below the horizon remain strictly locked. [GEOMETRY]: Strictly maintain equirectangular projection integrity with seamless 360 wrap-around.',
    icon: 'M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z',
    color: 'bg-blue-50 text-blue-700 border-blue-200'
  },
  {
    id: 'p360_sunny_splash',
    label: '360 Sunny Splash',
    description: 'Casts natural sunlight onto 360 interior floors while strictly ignoring and preserving the window view, glass, and outdoor scene 100% untouched.',
    prompt: 'INDOOR SUNNY SPLASH 360 PROTOCOL: [TASK]: Cast realistic sunlight splashes onto interior floors, rugs, and surfaces matching 360 window positions. [GEOMETRY]: Strictly maintain equirectangular projection integrity. [STRICT_WINDOW_AND_OUTDOOR_SCENERY_LOCK]: ABSOLUTELY DO NOT TOUCH, MODIFY, REPAINT, OR ALTER THE WINDOW, WINDOW GLASS, WINDOW SILL, WINDOW FRAMES, OR ANY OUTDOOR SCENERY VISIBLE THROUGH WINDOWS. The entire outdoor landscape, trees, neighboring structures, and original scenery seen through the window glass must remain 100% IDENTICAL, UNTOUCHED, AND FROZEN. Do not replace, repaint, or draw any sky or clouds into windows. Strictly ignore the window area and preserve the original window scene completely. [STRUCTURAL_INTEGRITY]: Strictly preserve all interior walls, furnishings, decor, and room architecture untouched.',
    icon: 'M12 3v1.5m6.364 1.136l-1.06 1.06M21 12h-1.5m-1.136 6.364l-1.06-1.06M12 21v-1.5m-6.364-1.136l1.06-1.06M3 12h1.5m1.136-6.364l1.06 1.06M9 12a3 3 0 116 0 3 3 0 01-6 0z',
    color: 'bg-amber-50 text-amber-700 border-amber-200'
  },
  {
    id: 'p360_auto_declutter',
    label: '360 Declutter',
    description: 'Deletes all clutter and furniture in 360 view for an empty architectural state. Includes MLS-compliant AI watermark.',
    prompt: 'ARCHITECTURAL 360 DECLUTTER PROTOCOL: [TASK]: Surgically and completely remove all furniture, clutter, tables, chairs, desks, beds, rugs, carpets, decorations, electronics, wires, and personal items. [STRICT_FLOOR_LOCK]: ABSOLUTELY DO NOT change, replace, restain, bleach, or alter ANY existing flooring material, wood planks, wood grain, stain color, tile pattern, carpet texture, or grout. The floor where clutter or furniture was removed MUST seamlessly match the existing flooring 100% identically. NEVER change hardwood to carpet, carpet to hardwood, or alter tile/wood tones. [STRICT_WALL_COLOR_AND_TRIM_LOCK]: ABSOLUTELY DO NOT change, repaint, tint, lighten, darken, or shift ANY wall colors, accent walls, wallpaper, moldings, baseboards, door trims, or ceilings. All wall paint colors and textures must remain 100% strictly identical to the source photo. [STRICT_ROOM_STRUCTURE_PRESERVATION]: Absolutely zero architectural changes. Keep all room boundaries, walls, doorways, door frames, windows, window panes, columns, and ceiling height 100% structurally identical. [ZERO_WEATHER_ALTERATION]: Do NOT add snow, ice, or white ground covering. Seamlessly reveal and inpaint clean, pristine architectural floor and wall textures matching the surroundings with photorealistic precision. Preserve spherical geometry.',
    icon: 'M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09-3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    hasAiWatermark: true
  },
  {
    id: 'p360_vstaging_3d',
    label: '360 Virtual Stage',
    description: 'Add 3D furniture to empty 360 panoramic rooms while strictly preserving all existing walls and architecture.',
    prompt: 'VIRTUAL STAGING 360 PROTOCOL: [TASK]: Virtually stage the empty panoramic {room} with {style} furniture. [STRICT_STRUCTURAL_PRESERVATION]: Absolutely zero architectural changes. Do NOT add new walls, partition walls, archways, columns, or room dividers. Do NOT move, resize, shift, or eliminate existing walls, doors, windows, columns, or room boundaries. Keep the exact spherical room geometry and wall layout 100% identical. [STRICT_WALL_COLOR_LOCK]: Absolutely DO NOT change, repaint, or tint any wall colors or wall paint finishes. Keep all existing wall paint colors and textures 100% identical to the source photo. Only add freestanding 3D furniture, area rugs, and decor onto existing open floor space. [GEOMETRY]: Strictly maintain equirectangular projection integrity for a seamless wrap-around. [PROPORTIONAL_SCALE]: Ensure furniture matches the spherical depth and distance of the room boundaries. Use realistic physical proportions based on the room size. [LIGHTING]: Match global 360 illumination.',
    icon: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7V5m0 14v-2M5 12H3m18 0h-2',
    color: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    hasAiWatermark: true
  },
  {
    id: 'p360_style_swap',
    label: '360 Style Swap',
    description: 'Replace existing furniture in a 360 panorama while locking all room architecture, floors, and walls. Includes MLS-compliant AI watermark.',
    prompt: 'STYLE SWAP 360 PROTOCOL: [TASK]: Replace all furniture in this 360 panoramic view with {style} furniture. [STRICT_FLOOR_LOCK]: ABSOLUTELY DO NOT change, replace, restain, or alter ANY existing flooring material, wood planks, wood grain, stain color, tile, carpet, or grout. The original floor must remain 100% identical to the source image. [STRICT_STRUCTURAL_PRESERVATION]: Absolutely zero architectural changes. Do NOT add, move, or remove walls, doors, windows, columns, or room boundaries. Maintain exact room geometry and only replace furniture and decor. [STRICT_WALL_COLOR_LOCK]: Absolutely DO NOT alter, repaint, or change existing wall paint colors. Keep all wall colors 100% identical to the source image. [SCALE_DEPTH]: Maintain perfect spatial scale and spherical perspective consistency. [GEOMETRY]: Preserve equirectangular projection integrity.',
    icon: 'M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182',
    color: 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200',
    hasAiWatermark: true
  },
  {
    id: 'p360_hdr_recovery',
    label: '360 HDR Pro',
    description: 'Comprehensive HDR editing for spherical imagery.',
    prompt: 'SURGICAL HDR ARCHITECTURAL RECOVERY: Perform a full dynamic range expansion simulating professional flambient photography. Recover details from deep shadows without introducing digital noise. Compress highlights in blown-out areas, specifically \'pulling\' detail from window views to reveal the exterior. Apply a neutral 5500K white balance across the entire sphere. Enhance textural clarity of architectural materials while strictly maintaining geometric integrity for equirectangular wrap-around consistency.',
    icon: 'M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z',
    color: 'bg-cyan-50 text-cyan-700 border-cyan-200'
  }
];

// --- NEW SAMPLES FOR CUSTOM TOOL ---
export const SAMPLE_PROPERTIES: PropertyData[] = [
  {
    id: 'sample-villa-malibu',
    unit: 'Villa 1',
    address: '22108 Pacific Coast Highway',
    city: 'Malibu, CA',
    price: '$18,500,000',
    bed: '6',
    bath: '8',
    sqft: '7,200',
    email: 'agent@luxuryestates.com',
    phoneNumber: '(310) 555-0192',
    website: 'www.luxuryestatesmalibu.com',
    agentName: 'Elena Rostova',
    brokerage: 'Elite Estates Malibu',
    galleryImages: [
      'https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=2880&q=95',
      'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2400&q=90',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2400&q=90',
      'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=2400&q=90'
    ],
    floorPlan: 'https://images.unsplash.com/photo-1600585152220-90363fe7e115?auto=format&fit=crop&w=1200&q=80',
    floorPlanHotspots: [
      {
        id: 'hs-1',
        x: 32,
        y: 45,
        title: 'Grand Living Salon',
        description: 'Double-height glass walls framing panoramic Pacific Ocean sunset views',
        targetImageIndex: 0
      },
      {
        id: 'hs-2',
        x: 68,
        y: 30,
        title: "Chef's Culinary Kitchen",
        description: 'Custom marble waterfall islands with Gaggenau suites & wine cellars',
        targetImageIndex: 1
      },
      {
        id: 'hs-3',
        x: 52,
        y: 72,
        title: 'Primary Oceanfront Suite',
        description: 'Private terrace with fire pit & dual en-suite spa sanctuaries',
        targetImageIndex: 2
      }
    ],
    showMap: true
  }
];

export interface AudioTrack {
  name: string;
  url: string;
}

export const PROFESSIONAL_AUDIO_LIBRARY: AudioTrack[] = [
  { name: "Closing Day Bounce (remix)", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Closing%20Day%20Bounce%20(remix).mp3" },
  { name: "Closing Day Bounce", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Closing%20Day%20Bounce.mp3" },
  { name: "Keys To The City (Remix)", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Keys%20To%20The%20City%20(Remix).mp3" },
  { name: "Keys To The City (remix2)", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Keys%20To%20The%20City%20(remix2).mp3" },
  { name: "Keys To The City", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Keys%20To%20The%20City.mp3" },
  { name: "Skyline Push (remix)", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Skyline%20Push%20(remix).mp3" },
  { name: "Skyline Push", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Skyline%20Push.mp3" },
  { name: "Snap Back Summer", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Snap%20Back%20Summer.mp3" },
  { name: "Snapshots in Motion (remix)", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Snapshots%20in%20Motion%20(remix).mp3" },
  { name: "Keys In The Sky", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Keys%20In%20The%20Sky.mp3" },
  { name: "Keys In The Sky (2)", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Keys%20In%20The%20Sky(2).mp3" },
  { name: "Keys To This Place", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Keys%20To%20This%20Place.mp3" },
  { name: "Keys To The Dream", url: "https://cmyixvfqicuycuhgqjnv.supabase.co/storage/v1/object/public/audio/Keys%20To%20The%20Dream.mp3" }
];

export const CREDIT_PACKS: CreditPack[] = [
  {
    id: 'pack_starter',
    name: 'Starter Pack',
    credits: 5400,
    price: 'CA$25',
    priceInCents: 2500,
    currency: 'cad',
    unitPrice: 'CA$0.0046 / credit',
    photoEdits: '~180 Photo Edits',
    popular: false,
    description: 'Perfect for single property listings, rapid sunny skies, and quick touchups.',
    features: [
      '5,400 AI Credits (~180 Photo Edits)',
      'Virtual Staging & Style Swapper (30-60 credits)',
      'Sunny Skies & De Clutter (30 credits)',
      '360 Panorama Restyling (90 credits)',
      'Credits never expire'
    ]
  },
  {
    id: 'pack_pro',
    name: 'Pro Agent Pack',
    credits: 17500,
    price: 'CA$77',
    priceInCents: 7700,
    currency: 'cad',
    unitPrice: 'CA$0.0044 / credit',
    photoEdits: '~583 Photo Edits',
    popular: true,
    description: 'Most popular for active producing agents and listing marketing coordinators.',
    features: [
      '17,500 AI Credits (~583 Photo Edits)',
      'All Starter Pack features included',
      'AI Video Reels & Transformations (90 credits)',
      'Floor & Ceiling Material Replacer (30 credits)',
      'Priority GPU Generation Queue',
      'Instant Stripe activation'
    ]
  },
  {
    id: 'pack_agency',
    name: 'Brokerage / Media Pack',
    credits: 44000,
    price: 'CA$175',
    priceInCents: 17500,
    currency: 'cad',
    unitPrice: 'CA$0.0039 / credit',
    photoEdits: '~1,466 Photo Edits',
    popular: false,
    description: 'High volume pack with priority queueing and lowest cost per edit.',
    features: [
      '44,000 AI Credits (~1,466 Photo Edits)',
      'Lowest unit cost (CA$0.0039 / credit)',
      'Full suite of 3D 360 virtual staging & video',
      'Architectural lock & MLS-compliant AI disclosures',
      'Highest priority processing throughput',
      'Multi-team listing workflows'
    ]
  }
];

