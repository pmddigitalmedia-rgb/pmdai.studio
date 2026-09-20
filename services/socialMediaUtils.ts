
/**
 * Simple CSV Parser
 */
export const parseCSV = (text: string) => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = '';
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentField += '"';
        i++; 
      } else {
        insideQuotes = !insideQuotes;
      }
    } else if (char === ',' && !insideQuotes) {
      currentRow.push(currentField.trim());
      currentField = '';
    } else if ((char === '\n' || char === '\r') && !insideQuotes) {
      if (currentField || currentRow.length > 0) {
        currentRow.push(currentField.trim());
        rows.push(currentRow);
      }
      currentRow = [];
      currentField = '';
      if (char === '\r' && nextChar === '\n') i++;
    } else {
      currentField += char;
    }
  }
  if (currentField || currentRow.length > 0) {
    currentRow.push(currentField.trim());
    rows.push(currentRow);
  }
  return rows;
};

/**
 * Extract dominant color
 */
export const extractColorFromImage = (imageSrc: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { resolve('#1e40af'); return; }
      
      canvas.width = 100;
      canvas.height = 100;
      ctx.drawImage(img, 0, 0, 100, 100);
      
      const imageData = ctx.getImageData(0, 0, 100, 100).data;
      let r = 0, g = 0, b = 0, count = 0;

      for (let i = 0; i < imageData.length; i += 4) {
        if (imageData[i + 3] > 128) { 
          r += imageData[i];
          g += imageData[i + 1];
          b += imageData[i + 2];
          count++;
        }
      }

      if (count === 0) resolve('#000000');

      r = Math.floor(r / count);
      g = Math.floor(g / count);
      b = Math.floor(b / count);

      resolve(`rgb(${r},${g},${b})`);
    };
    img.onerror = () => resolve('#1e40af'); // Default blue
  });
};

/**
 * Get contrast color
 */
export const getContrastColor = (hexOrRgb: string) => {
    let r, g, b;
    if (hexOrRgb.startsWith('#')) {
        const hex = hexOrRgb.replace('#', '');
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
    } else if (hexOrRgb.startsWith('rgb')) {
        const rgb = hexOrRgb.match(/\d+/g);
        r = parseInt(rgb?.[0] || '0');
        g = parseInt(rgb?.[1] || '0');
        b = parseInt(rgb?.[2] || '0');
    } else {
        return '#000000';
    }
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? '#000000' : '#ffffff';
};

/**
 * Convert Hex/RGB to RGBA
 */
export const toRgba = (color: string, alpha: number) => {
    let r = 0, g = 0, b = 0;
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        if (hex.length === 3) {
             r = parseInt(hex[0]+hex[0], 16);
             g = parseInt(hex[1]+hex[1], 16);
             b = parseInt(hex[2]+hex[2], 16);
        } else {
             r = parseInt(hex.substring(0, 2), 16);
             g = parseInt(hex.substring(2, 4), 16);
             b = parseInt(hex.substring(4, 6), 16);
        }
    } else if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g);
        r = parseInt(rgb?.[0] || '0');
        g = parseInt(rgb?.[1] || '0');
        b = parseInt(rgb?.[2] || '0');
    }
    return `rgba(${r},${g},${b},${alpha})`;
};

/**
 * Darken a color
 */
export const darkenColor = (color: string, percent = 20) => {
    let r = 0, g = 0, b = 0;
    if (color.startsWith('#')) {
        const hex = color.replace('#', '');
        if (hex.length === 3) {
             r = parseInt(hex[0]+hex[0], 16);
             g = parseInt(hex[1]+hex[1], 16);
             b = parseInt(hex[2]+hex[2], 16);
        } else {
             r = parseInt(hex.substring(0, 2), 16);
             g = parseInt(hex.substring(2, 4), 16);
             b = parseInt(hex.substring(4, 6), 16);
        }
    } else if (color.startsWith('rgb')) {
        const rgb = color.match(/\d+/g);
        r = parseInt(rgb?.[0] || '0');
        g = parseInt(rgb?.[1] || '0');
        b = parseInt(rgb?.[2] || '0');
    }
    
    r = Math.max(0, Math.min(255, r - (256 * (percent / 100))));
    g = Math.max(0, Math.min(255, g - (256 * (percent / 100))));
    b = Math.max(0, Math.min(255, b - (256 * (percent / 100))));

    return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

// 20 High-impact Unique Variants for "Just Listed"
export const LISTED_VARIANTS = [
  'sunny-skies',
  'ultra-modern',    
  'magazine-luxe',   
  'sidebar-neon',    
  'diagonal-impact', 
  'floating-card',   
  'editorial-grid',  
  'minimalist-edge', 
  'bold-typography', 
  'premium-wrap',    
  'gradient-shift',  
  'glass-footer',    
  'architect-view',
  'urban-loft',
  'heritage-classic',
  'coast-minimal',
  'scandi-clean',
  'noir-luxury',
  'high-contrast',
  'soft-focus',
  'geometric-bold'
];

// 10 High-impact Unique Variants for "Just Sold"
export const SOLD_VARIANTS = [
    'sold-impact',
    'sold-minimal',
    'sold-elegant',
    'sold-bold',
    'sold-glass',
    'sold-ribbon',
    'sold-badge',
    'sold-outline',
    'sold-photo-focus',
    'sold-overlay'
];

// High-impact Unbranded/Blank Architecture Variants
export const BLANK_VARIANTS = [
    'blank-gallery-focus',
    'blank-minimalist-duo',
    'blank-architect-trio',
    'blank-cinematic-wide',
    'blank-editorial-spread',
    'blank-modern-split',
    'blank-clean-grid',
    'blank-showcase-hero',
    'blank-classic-frame',
    'blank-magazine-pure'
];

// ICON SVGs (White Stroke - we will tint this)
export const BED_ICON_SVG = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8"/><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4"/><path d="M12 4v6"/><path d="M2 18h20"/></svg>`);
export const BATH_ICON_SVG = "data:image/svg+xml," + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-2.1 2.1L7 8"/><path d="M15 6l2.5-2.5a1.5 1.5 0 0 1 2.1 2.1L17 8"/><path d="M2 12h20"/><path d="M7 19v-7"/><path d="M17 19v-7"/></svg>`);
