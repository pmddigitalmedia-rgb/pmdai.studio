/**
 * Utility to convert hex colors (e.g. #1e3a8a, #f1f1f1) into natural, rich architectural 
 * paint descriptors that AI diffusion models (FLUX, Gemini) understand with high fidelity.
 */

interface HSL {
  h: number; // 0 to 360
  s: number; // 0 to 100
  l: number; // 0 to 100
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const cleanHex = hex.replace('#', '').trim();
  if (cleanHex.length === 3) {
    const r = parseInt(cleanHex[0] + cleanHex[0], 16);
    const g = parseInt(cleanHex[1] + cleanHex[1], 16);
    const b = parseInt(cleanHex[2] + cleanHex[2], 16);
    return { r, g, b };
  }
  if (cleanHex.length === 6) {
    const r = parseInt(cleanHex.substring(0, 2), 16);
    const g = parseInt(cleanHex.substring(2, 4), 16);
    const b = parseInt(cleanHex.substring(4, 6), 16);
    return { r, g, b };
  }
  return null;
}

function rgbToHsl(r: number, g: number, b: number): HSL {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

export function hexToColorDescription(hexOrName: string): string {
  if (!hexOrName) return 'ultra-clean off-white';

  const trimmed = hexOrName.trim();

  // If already a named descriptive color without leading hash, return cleanly
  if (!trimmed.startsWith('#') && !/^[0-9A-Fa-f]{6}$/.test(trimmed)) {
    return trimmed;
  }

  const rgb = hexToRgb(trimmed);
  if (!rgb) return 'ultra-clean off-white';

  const { h, s, l } = rgbToHsl(rgb.r, rgb.g, rgb.b);

  // 1. Check for near-neutral shades (Whites, Grays, Blacks, Off-whites)
  if (l >= 94) {
    if (s < 10) return 'pure crisp off-white';
    if (h >= 30 && h <= 55) return 'warm antique white linen';
    if (h >= 180 && h <= 230) return 'cool polar white';
    return 'soft warm white';
  }

  if (l >= 84 && s <= 15) {
    if (h >= 30 && h <= 55) return 'warm linen beige';
    if (h >= 56 && h <= 90) return 'light natural greige';
    return 'light soft pearl gray';
  }

  if (l <= 12) {
    if (s < 15) return 'deep jet black';
    if (h >= 200 && h <= 245) return 'dark midnight navy black';
    if (h >= 140 && h <= 175) return 'deep dark forest black';
    return 'deep charcoal black';
  }

  if (s <= 12) {
    if (l >= 70) return 'soft light gray';
    if (l >= 45) return 'neutral medium gray';
    if (l >= 25) return 'sophisticated dark slate gray';
    return 'deep charcoal';
  }

  // 2. Identify saturation tone
  let tonePrefix = '';
  if (s <= 25) {
    tonePrefix = 'muted neutral ';
  } else if (s <= 55) {
    tonePrefix = 'soft ';
  } else if (s >= 80) {
    tonePrefix = 'rich vibrant ';
  } else {
    tonePrefix = 'classic ';
  }

  // 3. Identify lightness shade
  let shadeWord = '';
  if (l >= 75) {
    shadeWord = 'light pastel ';
  } else if (l >= 55) {
    shadeWord = '';
  } else if (l >= 35) {
    shadeWord = 'medium ';
  } else {
    shadeWord = 'deep dark ';
  }

  // 4. Identify Color Family by Hue
  let colorFamily = '';
  if (h >= 350 || h < 12) {
    colorFamily = l < 35 ? 'burgundy wine red' : (s < 35 ? 'terracotta rose' : 'crimson red');
  } else if (h >= 12 && h < 38) {
    colorFamily = l < 40 ? 'warm burnt terracotta' : (s < 35 ? 'warm taupe beige' : 'warm sunset terracotta');
  } else if (h >= 38 && h < 65) {
    if (l > 70 && s < 45) {
      colorFamily = 'warm cream linen';
    } else if (l < 45 && s < 40) {
      colorFamily = 'warm olive taupe';
    } else {
      colorFamily = 'warm golden ochre';
    }
  } else if (h >= 65 && h < 110) {
    colorFamily = l < 40 ? 'dark olive green' : (s < 40 ? 'muted earthy sage green' : 'olive moss green');
  } else if (h >= 110 && h < 160) {
    colorFamily = l < 35 ? 'deep hunter forest green' : (s < 40 ? 'soft eucalyptus sage green' : 'emerald green');
  } else if (h >= 160 && h < 195) {
    colorFamily = l < 35 ? 'dark ocean teal' : (s < 40 ? 'coastal seafoam teal' : 'vibrant teal');
  } else if (h >= 195 && h < 225) {
    colorFamily = l < 35 ? 'deep prussian blue' : (l > 70 ? 'soft powder blue' : 'classic slate blue');
  } else if (h >= 225 && h < 260) {
    colorFamily = l < 35 ? 'deep rich navy blue' : (l > 70 ? 'soft baby blue' : 'royal sapphire blue');
  } else if (h >= 260 && h < 300) {
    colorFamily = l < 35 ? 'dark royal indigo purple' : (l > 70 ? 'soft lavender' : 'medium violet purple');
  } else if (h >= 300 && h < 340) {
    colorFamily = l < 35 ? 'deep plum purple' : (l > 70 ? 'soft lilac pink' : 'magenta rose');
  } else {
    colorFamily = l < 35 ? 'deep wine red' : 'blush rose';
  }

  const combined = `${shadeWord}${tonePrefix}${colorFamily}`.replace(/\s+/g, ' ').trim();
  return combined;
}
