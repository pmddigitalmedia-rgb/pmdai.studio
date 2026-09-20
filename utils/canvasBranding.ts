import { SocialAssets, PropertyData } from '../types';

export interface BrandingRenderOptions {
  width: number;
  height: number;
  accentColor: string;
  isWide?: boolean;
}

export interface AgentCardData {
  realtor?: string;
  phone?: string;
  email?: string;
  brokerage?: string;
  website?: string;
  headshot?: string | null;
  logo?: string | null;
  realtor2?: string;
  phone2?: string;
  email2?: string;
  brokerage2?: string;
  headshot2?: string | null;
  logo2?: string | null;
}

export interface LowerThirdsData {
  mode?: string; // 'JUST LISTED' | 'JUST SOLD' | 'FOR SALE' | etc.
  price?: string;
  address?: string;
  unit?: string;
  city?: string;
  beds?: string;
  baths?: string;
  sqft?: string;
}

/**
 * Draw rounded rectangle helper supporting standard and fallback CanvasRenderingContext2D
 */
export const drawRoundedRect = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) => {
  const safeR = Math.max(0, Math.min(r, w / 2, h / 2));
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, safeR);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + safeR, y);
    ctx.arcTo(x + w, y, x + w, y + h, safeR);
    ctx.arcTo(x + w, y + h, x, y + h, safeR);
    ctx.arcTo(x, y + h, x, y, safeR);
    ctx.arcTo(x, y, x + w, y, safeR);
    ctx.closePath();
  }
};

/**
 * Ease Out Back animation curve for punchy cards
 */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const p = Math.max(0, Math.min(1, t));
  return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

/**
 * Draw text fitted within maxWidth by adjusting font size down if needed
 */
export const drawTextFit = (
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  initialSize: number,
  weight: string,
  align: CanvasTextAlign,
  color: string,
  shadow = true,
  kineticOffset = 0,
  kineticAlpha = 1
): number => {
  if (!text) return 0;
  const cleanText = String(text);
  ctx.font = `${weight} ${initialSize}px 'Plus Jakarta Sans', sans-serif`;
  ctx.textAlign = align;
  let size = initialSize;
  let textWidth = ctx.measureText(cleanText).width;
  while (textWidth > maxWidth && size > 10) {
    size -= 1;
    ctx.font = `${weight} ${size}px 'Plus Jakarta Sans', sans-serif`;
    textWidth = ctx.measureText(cleanText).width;
  }
  ctx.save();
  ctx.globalAlpha = kineticAlpha;
  ctx.translate(0, kineticOffset);
  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 2;
    ctx.shadowOffsetY = 2;
  }
  ctx.fillStyle = color;
  ctx.fillText(cleanText, x, y);
  ctx.restore();
  return size;
};

/**
 * Smooth odometer counter animation for prices and numbers
 */
export const animateOdometerValue = (rawText: string, progress: number): string => {
  if (!rawText || progress >= 1) return rawText;
  const p = Math.min(1, Math.max(0, progress));
  // Smooth deceleration curve for counter (cubic ease-out)
  const eased = 1 - Math.pow(1 - p, 3);

  return rawText.replace(
    /([$€£¥]?)\s*([\d,]+(?:\.\d+)?)\s*(%|[a-zA-Z]*)/g,
    (match, prefix, numStr, suffix) => {
      const cleanNum = parseFloat(numStr.replace(/,/g, ''));
      if (isNaN(cleanNum)) return match;

      const hasDecimals = numStr.includes('.');
      const decimalPlaces = hasDecimals ? (numStr.split('.')[1] || '').length : 0;

      const currentVal = cleanNum * eased;
      let formatted = hasDecimals
        ? currentVal.toFixed(decimalPlaces)
        : Math.round(currentVal).toLocaleString('en-US');

      const joinedSuffix = suffix
        ? suffix.length > 0 && !suffix.startsWith(' ') && !prefix
          ? ' ' + suffix
          : suffix
        : '';
      return `${prefix || ''}${formatted}${joinedSuffix}`;
    }
  );
};

export interface LoadedBrandingImages {
  headshot: HTMLImageElement | null;
  logo: HTMLImageElement | null;
  headshot2?: HTMLImageElement | null;
  logo2?: HTMLImageElement | null;
}

/**
 * Draw Agent Card Overlay (Full Intro/Outro or Overlay Card)
 * Compatible with both Video Reels and Slideshow Builder
 */
export function drawAgentCardOverlay(
  ctx: CanvasRenderingContext2D,
  arg2: any,
  arg3: any,
  arg4?: any,
  arg5?: any,
  arg6?: any,
  arg7?: any,
  arg8?: any
) {
  let data: AgentCardData;
  let loadedImages: LoadedBrandingImages;
  let width: number;
  let height: number;
  let accentColor: string;
  let progress = 1.0;
  let alpha = 1.0;
  let asCenterCard = true;
  let showDimBackground = true;

  if (typeof arg2 === 'number' && typeof arg3 === 'number') {
    // Positional call signature: (ctx, cw, ch, loadedBranding, agentCardData, progress, brandingColor, mode)
    width = arg2;
    height = arg3;
    loadedImages = arg4 || { headshot: null, logo: null };
    data = arg5 || {};
    progress = typeof arg6 === 'number' ? arg6 : 1.0;
    accentColor = typeof arg7 === 'string' ? arg7 : '#ea580c';
    const mode = arg8 || 'slide';
    asCenterCard = mode !== 'slide';
    showDimBackground = mode === 'intro' || mode === 'outro';
  } else {
    // Options object call signature: (ctx, data, loadedImages, options)
    data = arg2 || {};
    loadedImages = arg3 || { headshot: null, logo: null };
    const opts = arg4 || {};
    width = opts.width || 1080;
    height = opts.height || 1920;
    accentColor = opts.accentColor || '#ea580c';
    progress = opts.progress !== undefined ? opts.progress : 1.0;
    alpha = opts.alpha !== undefined ? opts.alpha : 1.0;
    asCenterCard = opts.asCenterCard !== undefined ? opts.asCenterCard : true;
    showDimBackground = opts.showDimBackground !== undefined ? opts.showDimBackground : true;
  }

  if (alpha <= 0) return;

  const isWide = width > height;
  const cx = width / 2;
  const cy = height / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (showDimBackground) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, width, height);
  }

  const combineVal = (v1?: string, v2?: string, sep = ' | ') => {
    const s1 = (v1 || '').trim();
    const s2 = (v2 || '').trim();
    if (s1 && s2 && s1 !== s2) return `${s1}${sep}${s2}`;
    return s1 || s2 || '';
  };

  const combinedRealtors = combineVal(data.realtor, data.realtor2, ' & ');
  const combinedBrokerage = combineVal(data.brokerage, data.brokerage2, ' | ');
  const combinedPhones = combineVal(data.phone, data.phone2, ' | ');
  const combinedEmails = combineVal(data.email, data.email2, ' | ');
  const website = data.website || '';

  const { headshot, logo, headshot2, logo2 } = loadedImages;
  const hasAnyHeadshot = Boolean(headshot || headshot2);
  const hasAnyLogo = Boolean(logo || logo2);

  const bp = easeOutBack(Math.min(1, Math.max(0, progress)));

  const hsSize = isWide ? height * 0.28 : width * 0.4;
  const logoH = isWide ? height * 0.11 : width * 0.18;
  const titleSize = isWide ? 44 : 54;
  const detailSize = isWide ? 26 : 34;
  const margin = isWide ? 24 : 32;

  let stackH =
    (hasAnyHeadshot ? hsSize + margin : 0) +
    (combinedRealtors ? titleSize + margin / 2 : 0) +
    (combinedBrokerage ? detailSize * 0.85 + margin / 4 : 0) +
    (combinedPhones ? detailSize + margin / 4 : 0) +
    (combinedEmails ? detailSize + margin / 4 : 0) +
    (website ? detailSize + margin : 0) +
    (hasAnyLogo ? logoH : 0);

  const maxStackH = height * 0.82;
  const stackScale = Math.min(1, maxStackH / Math.max(1, stackH));

  ctx.save();
  if (stackScale < 1) {
    ctx.translate(cx, cy);
    ctx.scale(stackScale, stackScale);
    ctx.translate(-cx, -cy);
  }

  const cardW = Math.min(width * 0.9, Math.max(isWide ? 580 : width * 0.82, 420));
  const cardH = stackH + margin * 2;
  const cardX = (width - cardW) / 2;
  const cardY = (height - cardH) / 2;

  if (asCenterCard) {
    // Glass panel card container
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 32;
    ctx.shadowOffsetY = 12;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 36);
    ctx.fill();

    // Border with accent glow
    ctx.lineWidth = 2;
    ctx.strokeStyle = accentColor;
    drawRoundedRect(ctx, cardX, cardY, cardW, cardH, 36);
    ctx.stroke();
    ctx.restore();
  }

  let curY = asCenterCard ? cardY + margin : (height - stackH) / 2;

  // Render Headshots
  if (headshot && headshot2) {
    const hsY = curY + hsSize / 2;
    const hsOffset = hsSize * 0.35;

    // Headshot 1
    ctx.save();
    ctx.translate(cx - hsOffset, hsY);
    ctx.scale(bp, bp);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0, hsSize / 2), 0, Math.PI * 2);
    ctx.clip();
    const s1 = Math.max(hsSize / headshot.width, hsSize / headshot.height);
    ctx.drawImage(
      headshot,
      -(headshot.width * s1) / 2,
      -(headshot.height * s1) / 2,
      headshot.width * s1,
      headshot.height * s1
    );
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx - hsOffset, hsY, Math.max(0, (hsSize / 2) * bp), 0, Math.PI * 2);
    ctx.lineWidth = isWide ? 6 : 10;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    // Headshot 2
    ctx.save();
    ctx.translate(cx + hsOffset, hsY);
    ctx.scale(bp, bp);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0, hsSize / 2), 0, Math.PI * 2);
    ctx.clip();
    const s2 = Math.max(hsSize / headshot2.width, hsSize / headshot2.height);
    ctx.drawImage(
      headshot2,
      -(headshot2.width * s2) / 2,
      -(headshot2.height * s2) / 2,
      headshot2.width * s2,
      headshot2.height * s2
    );
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx + hsOffset, hsY, Math.max(0, (hsSize / 2) * bp), 0, Math.PI * 2);
    ctx.lineWidth = isWide ? 6 : 10;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    curY += hsSize + margin;
  } else if (headshot || headshot2) {
    const activeHs = headshot || headshot2!;
    const hsY = curY + hsSize / 2;

    ctx.save();
    ctx.translate(cx, hsY);
    ctx.scale(bp, bp);
    ctx.beginPath();
    ctx.arc(0, 0, Math.max(0, hsSize / 2), 0, Math.PI * 2);
    ctx.clip();
    const imgScale = Math.max(hsSize / activeHs.width, hsSize / activeHs.height);
    ctx.drawImage(
      activeHs,
      -(activeHs.width * imgScale) / 2,
      -(activeHs.height * imgScale) / 2,
      activeHs.width * imgScale,
      activeHs.height * imgScale
    );
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, hsY, Math.max(0, (hsSize / 2) * bp), 0, Math.PI * 2);
    ctx.lineWidth = isWide ? 6 : 10;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    curY += hsSize + margin;
  }

  // Text Lines
  if (combinedRealtors) {
    drawTextFit(
      ctx,
      combinedRealtors,
      cx,
      curY,
      cardW - 60,
      titleSize,
      '800',
      'center',
      '#ffffff',
      true
    );
    curY += titleSize + margin / 2;
  }

  if (combinedBrokerage) {
    drawTextFit(
      ctx,
      combinedBrokerage,
      cx,
      curY,
      cardW - 80,
      detailSize * 0.85,
      '600',
      'center',
      '#cbd5e1',
      true
    );
    curY += detailSize * 0.85 + margin / 4;
  }

  if (combinedPhones) {
    drawTextFit(
      ctx,
      combinedPhones,
      cx,
      curY,
      cardW - 80,
      detailSize,
      '600',
      'center',
      '#e2e8f0',
      true
    );
    curY += detailSize + margin / 4;
  }

  if (combinedEmails) {
    drawTextFit(
      ctx,
      combinedEmails,
      cx,
      curY,
      cardW - 80,
      detailSize,
      '600',
      'center',
      '#e2e8f0',
      true
    );
    curY += detailSize + margin / 4;
  }

  if (website) {
    drawTextFit(
      ctx,
      website,
      cx,
      curY,
      cardW - 80,
      detailSize,
      'bold',
      'center',
      accentColor,
      true
    );
    curY += detailSize + margin;
  }

  // Logos
  if (logo && logo2) {
    const s1 = logoH / logo.height;
    const lW1 = logo.width * s1;
    const s2 = logoH / logo2.height;
    const lW2 = logo2.width * s2;

    ctx.save();
    ctx.translate(cx - lW1 / 2 - 15, curY + logoH / 2);
    ctx.scale(bp, bp);
    ctx.drawImage(logo, -lW1 / 2, -logoH / 2, lW1, logoH);
    ctx.restore();

    ctx.save();
    ctx.translate(cx + lW2 / 2 + 15, curY + logoH / 2);
    ctx.scale(bp, bp);
    ctx.drawImage(logo2, -lW2 / 2, -logoH / 2, lW2, logoH);
    ctx.restore();
  } else if (logo || logo2) {
    const activeLogo = logo || logo2!;
    const s = logoH / activeLogo.height;
    const lW = activeLogo.width * s;

    ctx.save();
    ctx.translate(cx, curY + logoH / 2);
    ctx.scale(bp, bp);
    ctx.drawImage(activeLogo, -lW / 2, -logoH / 2, lW, logoH);
    ctx.restore();
  }

  ctx.restore(); // stackScale
  ctx.restore(); // main save
};

/**
 * Draw Lower Thirds Overlay with Heading Badge, Price, Address, Specs, and Animated Odometer
 * Matching the exact look and motion of the Video Reels
 */
export function drawLowerThirdsOverlay(
  ctx: CanvasRenderingContext2D,
  arg2: any,
  arg3: any,
  arg4?: any,
  arg5?: any,
  arg6?: any,
  arg7?: any
) {
  let data: LowerThirdsData;
  let width: number;
  let height: number;
  let accentColor: string;
  let progress = 1.0;
  let alpha = 1.0;
  let showHeadingBadge = true;
  let showSpecBadges = true;

  if (typeof arg2 === 'number' && typeof arg3 === 'number') {
    // Positional call signature: (ctx, cw, ch, ltData, progress, brandingColor, aspectRatio)
    width = arg2;
    height = arg3;
    data = arg4 || {};
    progress = typeof arg5 === 'number' ? arg5 : 1.0;
    accentColor = typeof arg6 === 'string' ? arg6 : '#ea580c';
  } else {
    // Options object call signature: (ctx, data, options)
    data = arg2 || {};
    const opts = arg3 || {};
    width = opts.width || 1080;
    height = opts.height || 1920;
    accentColor = opts.accentColor || '#ea580c';
    progress = opts.progress !== undefined ? opts.progress : 1.0;
    alpha = opts.alpha !== undefined ? opts.alpha : 1.0;
    showHeadingBadge = opts.showHeadingBadge !== undefined ? opts.showHeadingBadge : true;
    showSpecBadges = opts.showSpecBadges !== undefined ? opts.showSpecBadges : true;
  }

  if (alpha <= 0) return;

  const isWide = width > height;
  const cx = width / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  // Dark gradient at bottom to ensure high legibility
  const gr = ctx.createLinearGradient(0, height * 0.62, 0, height);
  gr.addColorStop(0, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.85)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, height * 0.6, width, height * 0.4);

  // 1. TOP/CENTER HEADING BADGE (e.g. JUST LISTED, FOR SALE)
  const headingText = (data.mode || 'JUST LISTED').toUpperCase();
  if (showHeadingBadge && headingText) {
    const badgeY = isWide ? 40 : 80;
    const badgeH = isWide ? 60 : 80;
    const headingFontSize = isWide ? 30 : 40;
    const headingFont = `900 ${headingFontSize}px 'Plus Jakarta Sans', sans-serif`;

    ctx.save();
    ctx.font = headingFont;
    const measuredHeading = ctx.measureText(headingText);
    ctx.restore();

    const badgePadding = isWide ? 60 : 80;
    const badgeW = Math.max(isWide ? 320 : width * 0.5, measuredHeading.width + badgePadding);
    const ovalRadius = badgeH / 2;

    const headingOffset = Math.max(0, 1 - progress) * -30;

    ctx.save();
    ctx.translate(0, headingOffset);

    // Oval Background
    ctx.fillStyle = accentColor;
    drawRoundedRect(ctx, cx - badgeW / 2, badgeY, badgeW, badgeH, ovalRadius);
    ctx.fill();

    // Crisp Border
    ctx.lineWidth = isWide ? 2 : 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    drawRoundedRect(ctx, cx - badgeW / 2, badgeY, badgeW, badgeH, ovalRadius);
    ctx.stroke();

    // Centered Title Text
    ctx.fillStyle = '#ffffff';
    ctx.font = headingFont;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetX = 1;
    ctx.shadowOffsetY = 2;
    ctx.fillText(headingText, cx, badgeY + badgeH / 2);
    ctx.restore();
  }

  // 2. LOWER THIRDS INFO BOX (Price, Address, Specs)
  const hPadding = isWide ? 45 : 60;
  const vPadding = isWide ? 30 : 45;
  const lineSpacing = isWide ? 10 : 18;

  const priceFont = `bold ${isWide ? 70 : 96}px 'Plus Jakarta Sans', sans-serif`;
  const addrFont = `bold ${isWide ? 28 : 44}px 'Plus Jakarta Sans', sans-serif`;
  const cityFont = `${isWide ? 22 : 34}px 'Plus Jakarta Sans', sans-serif`;
  const badgeFont = `bold ${isWide ? 24 : 34}px 'Plus Jakarta Sans', sans-serif`;

  // Animate Odometer values based on slide local progress
  const animPrice = data.price ? animateOdometerValue(data.price, progress) : '';
  const displayAddr = data.unit ? `${data.unit} - ${data.address || ''}` : data.address || '';
  const displayCity = data.city || '';

  const vBed = data.beds || '';
  const vBath = data.baths || '';
  const vSqft = data.sqft || '';

  const animBedText = vBed
    ? animateOdometerValue(`${vBed} Bed${vBed !== '1' ? 's' : ''}`, progress)
    : '';
  const animBathText = vBath
    ? animateOdometerValue(`${vBath} Bath${vBath !== '1' ? 's' : ''}`, progress)
    : '';
  const animSqftText = vSqft ? animateOdometerValue(`${vSqft} SqFt`, progress) : '';

  const specBadges: { icon: string; label: string }[] = [];
  if (showSpecBadges) {
    if (vBed) specBadges.push({ icon: '🛏️', label: animBedText });
    if (vBath) specBadges.push({ icon: '🛁', label: animBathText });
    if (vSqft) specBadges.push({ icon: '📐', label: animSqftText });
  }

  let maxWidth = 0;
  let totalHeight = 0;
  const lines: { text: string; font: string; color: string; height: number }[] = [];

  const addLine = (text: string, font: string, color: string, h: number) => {
    if (!text) return;
    const cleanT = String(text);
    ctx.font = font;
    const w = ctx.measureText(cleanT).width;
    if (w > maxWidth) maxWidth = w;
    lines.push({ text: cleanT, font, color, height: h });
    totalHeight += h + lineSpacing;
  };

  addLine(animPrice, priceFont, '#ffffff', isWide ? 70 : 96);
  addLine(displayAddr, addrFont, '#ffffff', isWide ? 28 : 44);
  addLine(displayCity, cityFont, '#e2e8f0', isWide ? 22 : 34);

  // Compute Spec Badges
  const specBadgeH = isWide ? 42 : 56;
  const badgeHPad = isWide ? 18 : 24;
  const badgeGap = isWide ? 10 : 16;
  const badgeRadius = isWide ? 21 : 28;

  let badgeWidths: number[] = [];
  let totalBadgesW = 0;

  if (specBadges.length > 0) {
    ctx.font = badgeFont;
    badgeWidths = specBadges.map(
      (b) => ctx.measureText(`${b.icon} ${b.label}`).width + badgeHPad * 2
    );
    totalBadgesW =
      badgeWidths.reduce((a, b) => a + b, 0) + (specBadges.length - 1) * badgeGap;
    if (totalBadgesW > maxWidth) maxWidth = totalBadgesW;
    totalHeight += specBadgeH + lineSpacing;
  }

  if (lines.length > 0 || specBadges.length > 0) {
    totalHeight -= lineSpacing; // remove trailing spacing
    const boxW = Math.min(
      width * 0.94,
      Math.max(maxWidth + hPadding * 2, isWide ? 460 : width * 0.85)
    );
    const boxH = totalHeight + vPadding * 2;
    const boxX = (width - boxW) / 2;
    const boxY = height - boxH - (isWide ? 40 : 80);

    ctx.save();
    // Backdrop with glass effect & shadow
    ctx.fillStyle = 'rgba(2, 6, 23, 0.76)';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 24;
    ctx.shadowOffsetY = 8;
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 32);
    ctx.fill();

    // Subtle border
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 32);
    ctx.stroke();
    ctx.restore();

    let currentY = boxY + vPadding;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    lines.forEach((line) => {
      drawTextFit(
        ctx,
        line.text,
        cx,
        currentY,
        boxW - hPadding * 2,
        line.height,
        'bold',
        'center',
        line.color,
        true
      );
      currentY += line.height + lineSpacing;
    });

    // Draw spec badges
    if (specBadges.length > 0) {
      const availableBadgeW = boxW - hPadding * 1.5;
      const scaleRatio =
        totalBadgesW > availableBadgeW ? availableBadgeW / totalBadgesW : 1;
      let curBadgeX = cx - (totalBadgesW * scaleRatio) / 2;

      specBadges.forEach((badge, bIdx) => {
        const originalW = badgeWidths[bIdx];
        const bW = originalW * scaleRatio;

        ctx.save();
        // Badge Background
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        drawRoundedRect(ctx, curBadgeX, currentY, bW, specBadgeH, badgeRadius);
        ctx.fill();

        // Accent Border
        ctx.lineWidth = 1.8;
        ctx.strokeStyle = accentColor;
        drawRoundedRect(ctx, curBadgeX, currentY, bW, specBadgeH, badgeRadius);
        ctx.stroke();

        // Text
        ctx.font = badgeFont;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 8;

        const displayText = `${badge.icon}  ${badge.label}`;
        ctx.fillText(displayText, curBadgeX + bW / 2, currentY + specBadgeH / 2);

        ctx.restore();
        curBadgeX += bW + badgeGap * scaleRatio;
      });
    }
  }

  ctx.restore();
};

/**
 * Preload headshots and logos from SocialAssets or AgentCardData into HTMLImageElements
 */
export const loadBrandingImages = async (
  assets: SocialAssets,
  agentData?: AgentCardData
): Promise<LoadedBrandingImages> => {
  const loadImage = (src?: string | null): Promise<HTMLImageElement | null> =>
    new Promise((resolve) => {
      if (!src) return resolve(null);
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => {
        const fallback = new Image();
        fallback.onload = () => resolve(fallback);
        fallback.onerror = () => resolve(null);
        fallback.src = src;
      };
      img.src = src;
    });

  const hs1Src =
    agentData?.headshot ||
    assets.headshot ||
    (assets as any).agentHeadshot ||
    (assets as any).photo;
  const lg1Src =
    agentData?.logo ||
    assets.logo ||
    (assets as any).brokerageLogo ||
    (assets as any).companyLogo;
  const hs2Src =
    agentData?.headshot2 ||
    assets.headshot2 ||
    (assets as any).agent2Headshot;
  const lg2Src =
    agentData?.logo2 ||
    assets.logo2 ||
    (assets as any).agent2Logo;

  const [headshot, logo, headshot2, logo2] = await Promise.all([
    loadImage(hs1Src),
    loadImage(lg1Src),
    loadImage(hs2Src),
    loadImage(lg2Src)
  ]);

  return { headshot, logo, headshot2, logo2 };
};
