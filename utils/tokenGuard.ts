import { TOOL_TOKEN_ESTIMATES, WEATHER_PRESETS, PANORAMA_PRESETS, VISUAL_STAGER_PRESETS } from '../constants';
import { ImageItem } from '../types';

export interface TokenUsageRecord {
  id: string;
  timestamp: number;
  toolId: string;
  toolLabel: string;
  tokens: number;
  estimatedCost: number;
  imageId?: string;
}

export interface TokenGuardSettings {
  enabled: boolean;
  dailyLimit: number; // in tokens, e.g. 100,000 (~$8.00)
  usedToday: number; // tokens accumulated today
  lastActiveDate: string; // YYYY-MM-DD
  overriddenToday: boolean; // if true, busy day override is active
  costPerToken: number; // default: 0.000008 (~$8.00 per 1M tokens)
  history: TokenUsageRecord[];
}

const STORAGE_KEY = 'pmd_token_guard_settings';

export const DEFAULT_TOKEN_GUARD_SETTINGS: TokenGuardSettings = {
  enabled: true,
  dailyLimit: 125000, // ~$10.00 standard safety cap
  usedToday: 0,
  lastActiveDate: getTodayDateString(),
  overriddenToday: false,
  costPerToken: 0.000008,
  history: []
};

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function tokenToDollar(tokens: number, costPerToken: number = 0.000008): number {
  return Number((tokens * costPerToken).toFixed(4));
}

export function tokenToDollarString(tokens: number, costPerToken: number = 0.000008): string {
  const cost = tokenToDollar(tokens, costPerToken);
  return `CA$${cost.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  return tokens.toLocaleString();
}

/**
 * Loads token guard settings from localStorage.
 * Automatically handles daily rollover (resets usedToday & overriddenToday if date changed).
 */
export function loadTokenGuardSettings(): TokenGuardSettings {
  const today = getTodayDateString();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const initial = { ...DEFAULT_TOKEN_GUARD_SETTINGS, lastActiveDate: today };
      saveTokenGuardSettings(initial);
      return initial;
    }

    const parsed: TokenGuardSettings = JSON.parse(raw);

    // Check if new day
    if (parsed.lastActiveDate !== today) {
      const rolledOver: TokenGuardSettings = {
        ...parsed,
        lastActiveDate: today,
        usedToday: 0,
        overriddenToday: false,
        // Keep last 30 history entries to avoid unbounded growth
        history: (parsed.history || []).slice(-30)
      };
      saveTokenGuardSettings(rolledOver);
      return rolledOver;
    }

    return {
      ...DEFAULT_TOKEN_GUARD_SETTINGS,
      ...parsed,
      history: parsed.history || []
    };
  } catch (e) {
    console.error('Failed to load token guard settings:', e);
    return { ...DEFAULT_TOKEN_GUARD_SETTINGS, lastActiveDate: today };
  }
}

/**
 * Persists token guard settings to localStorage.
 */
export function saveTokenGuardSettings(settings: TokenGuardSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {
    console.error('Failed to save token guard settings:', e);
  }
}

/**
 * Calculates estimated tokens for an array of tool IDs applied to a single image.
 * Since tools are combined into ONE single Gemini API call prompt, the token cost is
 * the base generation cost of the primary/heaviest tool + a slight text prompt increment (+50 tokens/extra tool),
 * rather than summing full separate generation charges for each tool!
 */
export function calculateTokensForTools(toolIds: string[]): number {
  if (!toolIds || toolIds.length === 0) return 0;

  // Video generation tools run separate video API requests
  const videoTool = toolIds.find(tid => tid.endsWith('_video'));
  if (videoTool) {
    return TOOL_TOKEN_ESTIMATES[videoTool]?.standard ?? 10000;
  }

  // Find the max base token cost among the combined tools
  let maxBaseCost = 0;
  for (const tid of toolIds) {
    const estimate = TOOL_TOKEN_ESTIMATES[tid]?.standard ?? 2500;
    if (estimate > maxBaseCost) {
      maxBaseCost = estimate;
    }
  }

  // Single combined API call = base generation cost + 50 tokens for each additional instruction
  const extraTools = Math.max(0, toolIds.length - 1);
  return maxBaseCost + (extraTools * 50);
}

/**
 * Calculates the total estimated tokens for a batch of ImageItems ready to process.
 * Accounts for 2-step sequences like (Sunny + Dusk) or (Empty + Staging) vs combined single-call items.
 */
export function calculateBatchEstimatedTokens(items: ImageItem[]): number {
  let total = 0;
  const queuedItems = items.filter(i => i.assignedTools && i.assignedTools.length > 0);

  for (const item of queuedItems) {
    const tools = item.assignedTools;
    const hasSunny = tools.includes('sunny_skies');
    const hasDusk = tools.includes('sunset');
    const stagingTools = ['furniture', 'p360_vstaging_3d', 'style_swapper', 'p360_style_swap'];
    const hasEmpty = tools.includes('empty_room');
    const activeStaging = tools.find(t => stagingTools.includes(t));

    if (hasSunny && hasDusk) {
      // Runs Sunny + Sunset sequentially (2 separate API calls)
      total += (TOOL_TOKEN_ESTIMATES['sunny_skies']?.standard ?? 2400);
      total += (TOOL_TOKEN_ESTIMATES['sunset']?.standard ?? 2800);
    } else if (hasEmpty && activeStaging) {
      // Runs Empty Room + Staging sequentially (2 separate API calls)
      total += (TOOL_TOKEN_ESTIMATES['empty_room']?.standard ?? 3000);
      total += (TOOL_TOKEN_ESTIMATES[activeStaging]?.standard ?? 3500);
    } else {
      // Single combined API call
      total += calculateTokensForTools(tools);
    }
  }

  return total;
}

/**
 * Records token consumption for a completed tool execution or combined batch pass.
 */
export function recordTokensUsed(
  toolId: string,
  tokens?: number,
  imageId?: string,
  customLabel?: string
): TokenGuardSettings {
  const current = loadTokenGuardSettings();
  const actualTokens = tokens ?? (TOOL_TOKEN_ESTIMATES[toolId]?.standard ?? 2500);
  const cost = tokenToDollar(actualTokens, current.costPerToken);
  
  const allPresets = [...WEATHER_PRESETS, ...PANORAMA_PRESETS, ...VISUAL_STAGER_PRESETS];
  const preset = allPresets.find(p => p.id === toolId);
  const toolLabel = customLabel || preset?.label || toolId.replace(/_/g, ' ').toUpperCase();

  const record: TokenUsageRecord = {
    id: Math.random().toString(36).substring(7),
    timestamp: Date.now(),
    toolId,
    toolLabel,
    tokens: actualTokens,
    estimatedCost: cost,
    imageId
  };

  const updated: TokenGuardSettings = {
    ...current,
    usedToday: (current.usedToday || 0) + actualTokens,
    history: [...(current.history || []).slice(-49), record]
  };

  saveTokenGuardSettings(updated);
  return updated;
}

