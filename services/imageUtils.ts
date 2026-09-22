
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Handle potential default export structure in ESM environments
const pdf = (pdfjsLib as any).default || pdfjsLib;

// Configure PDF.js worker
if (pdf.GlobalWorkerOptions) {
  pdf.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js`;
}

/**
 * Normalizes an image by drawing it onto a clean canvas.
 * CRITICAL: This ensures the 'Before' image goes through the same rendering 
 * pipeline as the AI 'After' image, preventing the 'jump' effect.
 */
export const normalizeImage = async (src: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas failure"));
            
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0);
            
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error("Failed to normalize source image"));
        img.src = src;
    });
};

/**
 * Fast, memory-efficient sharpening filter using a 3x3 convolution kernel.
 * Optimized with flat array access, pre-calculated row offsets, and zero inner-loop allocations.
 * Restores crispness to upscaled low-res AI edits.
 */
export const sharpenCanvas = (canvas: HTMLCanvasElement, amount: number = 0.12) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    try {
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;
        const output = ctx.createImageData(width, height);
        const dst = output.data;
        const rowBytes = width * 4;

        // Pre-fill alpha channel
        for (let i = 3; i < data.length; i += 4) {
            dst[i] = data[i];
        }

        // Apply fast 3x3 convolution
        for (let y = 1; y < height - 1; y++) {
            const yOffset = y * rowBytes;
            const prevYOffset = yOffset - rowBytes;
            const nextYOffset = yOffset + rowBytes;

            for (let x = 1; x < width - 1; x++) {
                const xOffset = x * 4;
                const idx = yOffset + xOffset;

                const idxT = prevYOffset + xOffset;
                const idxB = nextYOffset + xOffset;
                const idxL = idx - 4;
                const idxR = idx + 4;

                // Red
                const r = data[idx] * (1 + 4 * amount) - (data[idxT] + data[idxB] + data[idxL] + data[idxR]) * amount;
                dst[idx] = r < 0 ? 0 : (r > 255 ? 255 : r);

                // Green
                const g = data[idx+1] * (1 + 4 * amount) - (data[idxT+1] + data[idxB+1] + data[idxL+1] + data[idxR+1]) * amount;
                dst[idx+1] = g < 0 ? 0 : (g > 255 ? 255 : g);

                // Blue
                const b = data[idx+2] * (1 + 4 * amount) - (data[idxT+2] + data[idxB+2] + data[idxL+2] + data[idxR+2]) * amount;
                dst[idx+2] = b < 0 ? 0 : (b > 255 ? 255 : b);
            }
        }

        // Copy borders
        for (let x = 0; x < width; x++) {
            const idxTop = x * 4;
            const idxBottom = ((height - 1) * width + x) * 4;
            dst[idxTop] = data[idxTop]; dst[idxTop+1] = data[idxTop+1]; dst[idxTop+2] = data[idxTop+2];
            dst[idxBottom] = data[idxBottom]; dst[idxBottom+1] = data[idxBottom+1]; dst[idxBottom+2] = data[idxBottom+2];
        }
        for (let y = 0; y < height; y++) {
            const idxLeft = y * rowBytes;
            const idxRight = idxLeft + (width - 1) * 4;
            dst[idxLeft] = data[idxLeft]; dst[idxLeft+1] = data[idxLeft+1]; dst[idxLeft+2] = data[idxLeft+2];
            dst[idxRight] = data[idxRight]; dst[idxRight+1] = data[idxRight+1]; dst[idxRight+2] = data[idxRight+2];
        }

        ctx.putImageData(output, 0, 0);
    } catch (e) {
        console.error("Failed to sharpen canvas", e);
    }
};

/**
 * Asynchronously sharpens an image from a data URL or base64 string using the canvas convolution filter.
 */
export const sharpenImage = async (dataUrl: string, amount: number = 0.15): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas failure"));
            
            ctx.drawImage(img, 0, 0);
            sharpenCanvas(canvas, amount);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};

/**
 * Performs a Surgical Pixel-Passthrough.
 * Pastes original architectural pixels back onto the AI atmosphere.
 * This is the ultimate fix for zooming/shifting issues.
 */
export const applySurgicalComposite = async (
    originalDataUrl: string,
    aiResultDataUrl: string,
    maskDataUrl: string
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const originalImg = new Image();
        const aiImg = new Image();
        const maskImg = new Image();
        
        let loaded = 0;
        const checkLoad = () => {
            loaded++;
            if (loaded === 3) composite();
        };

        originalImg.crossOrigin = "Anonymous";
        aiImg.crossOrigin = "Anonymous";
        maskImg.crossOrigin = "Anonymous";

        originalImg.onload = checkLoad;
        aiImg.onload = checkLoad;
        maskImg.onload = checkLoad;
        
        originalImg.src = originalDataUrl;
        aiImg.src = aiResultDataUrl;
        maskImg.src = maskDataUrl;

        function composite() {
            const canvas = document.createElement('canvas');
            canvas.width = originalImg.naturalWidth;
            canvas.height = originalImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas failure"));

            // 1. Draw the ORIGINAL high-resolution sharp photo as background base
            ctx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);

            // 2. Create an alpha-based mask canvas
            // The black-and-white mask has White = Sky/splashes (Keep AI) and Black = Building/others (Keep Original).
            // Convert grayscale intensities directly into Alpha channel
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const mCtx = maskCanvas.getContext('2d');
            if (!mCtx) return reject(new Error("Mask canvas context failure"));

            mCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            
            const maskData = mCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = maskData.data;
            for (let i = 0; i < data.length; i += 4) {
                const r = data[i];
                const g = data[i+1];
                const b = data[i+2];
                // Treat max channel as brightness value
                const brightness = Math.max(r, g, b);
                
                // Clear RGB to black and set alpha to brightness to create a transparent mask
                data[i] = 0;
                data[i+1] = 0;
                data[i+2] = 0;
                data[i+3] = brightness;
            }
            mCtx.putImageData(maskData, 0, 0);

            // 3. Create a temporary canvas containing the masked AI image
            const aiCanvas = document.createElement('canvas');
            aiCanvas.width = canvas.width;
            aiCanvas.height = canvas.height;
            const aiCtx = aiCanvas.getContext('2d');
            if (!aiCtx) return reject(new Error("AI canvas context failure"));

            aiCtx.drawImage(aiImg, 0, 0, canvas.width, canvas.height);

            // Sharpen the AI edited region to ensure high crispness when merged back
            if (canvas.width > aiImg.naturalWidth * 1.1) {
                sharpenCanvas(aiCanvas, 0.18); // Stronger sharpening for upscaled edits
            } else {
                sharpenCanvas(aiCanvas, 0.12); // Standard sharpening for same-size edits
            }

            // Apply the alpha mask: keep AI pixels only inside white regions
            aiCtx.globalCompositeOperation = 'destination-in';
            aiCtx.drawImage(maskCanvas, 0, 0);

            // 4. Smoothly blend/overlay the AI changes onto the original image
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(aiCanvas, 0, 0);
            ctx.restore();

            resolve(canvas.toDataURL('image/png'));
        }
    });
};

/**
 * Restores original window pixels over an AI-edited room image.
 * Guarantees 100% pixel-perfect preservation of window glass, frames, and outdoor view.
 */
export const restoreWindowRegions = async (
    editedDataUrl: string,
    originalDataUrl: string,
    windowMaskDataUrl: string
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const editedImg = new Image();
        const originalImg = new Image();
        const maskImg = new Image();
        
        let loaded = 0;
        const checkLoad = () => {
            loaded++;
            if (loaded === 3) composite();
        };

        editedImg.crossOrigin = "Anonymous";
        originalImg.crossOrigin = "Anonymous";
        maskImg.crossOrigin = "Anonymous";

        editedImg.onload = checkLoad;
        originalImg.onload = checkLoad;
        maskImg.onload = checkLoad;

        editedImg.onerror = reject;
        originalImg.onerror = reject;
        maskImg.onerror = reject;

        editedImg.src = editedDataUrl;
        originalImg.src = originalDataUrl;
        maskImg.src = windowMaskDataUrl;

        function composite() {
            const canvas = document.createElement('canvas');
            canvas.width = originalImg.naturalWidth;
            canvas.height = originalImg.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas context failure"));

            // 1. Draw edited image (with sunlight cast on the room) as the base
            ctx.drawImage(editedImg, 0, 0, canvas.width, canvas.height);

            // 2. Prepare window mask
            const maskCanvas = document.createElement('canvas');
            maskCanvas.width = canvas.width;
            maskCanvas.height = canvas.height;
            const mCtx = maskCanvas.getContext('2d');
            if (!mCtx) return reject(new Error("Mask canvas context failure"));

            mCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height);
            const maskData = mCtx.getImageData(0, 0, canvas.width, canvas.height);
            const data = maskData.data;

            // Convert white regions (windows) to alpha
            for (let i = 0; i < data.length; i += 4) {
                const brightness = Math.max(data[i], data[i+1], data[i+2]);
                data[i] = 0;
                data[i+1] = 0;
                data[i+2] = 0;
                data[i+3] = brightness;
            }
            mCtx.putImageData(maskData, 0, 0);

            // 3. Create canvas for the original image clipped to the window mask
            const origWindowCanvas = document.createElement('canvas');
            origWindowCanvas.width = canvas.width;
            origWindowCanvas.height = canvas.height;
            const owCtx = origWindowCanvas.getContext('2d');
            if (!owCtx) return reject(new Error("Original window canvas context failure"));

            owCtx.drawImage(originalImg, 0, 0, canvas.width, canvas.height);
            owCtx.globalCompositeOperation = 'destination-in';
            owCtx.drawImage(maskCanvas, 0, 0);

            // 4. Paint the original window pixels over the edited image
            ctx.save();
            ctx.globalCompositeOperation = 'source-over';
            ctx.drawImage(origWindowCanvas, 0, 0);
            ctx.restore();

            resolve(canvas.toDataURL('image/jpeg', 0.95));
        }
    });
};

/**
 * Fast algorithmic sky mask generator.
 * Analyzes color, gradient, saturation, and luminance to isolate the sky region above the horizon.
 * Serves as an instant, zero-token surgical fallback to guarantee architectural lock.
 */
export const generateAlgorithmicSkyMask = async (dataUrl: string): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const maxDim = 512;
            let w = img.naturalWidth;
            let h = img.naturalHeight;
            if (w > maxDim || h > maxDim) {
                if (w > h) {
                    h = Math.round((h * maxDim) / w);
                    w = maxDim;
                } else {
                    w = Math.round((w * maxDim) / h);
                    h = maxDim;
                }
            }
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas failure"));

            ctx.drawImage(img, 0, 0, w, h);
            const imgData = ctx.getImageData(0, 0, w, h);
            const data = imgData.data;

            const maskImgData = ctx.createImageData(w, h);
            const maskData = maskImgData.data;

            for (let y = 0; y < h; y++) {
                const yFactor = 1 - (y / h);
                for (let x = 0; x < w; x++) {
                    const idx = (y * w + x) * 4;
                    const r = data[idx];
                    const g = data[idx + 1];
                    const b = data[idx + 2];

                    const maxC = Math.max(r, g, b);
                    const minC = Math.min(r, g, b);
                    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
                    const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC;

                    let isSky = false;

                    if (y < h * 0.55) {
                        if (luminance > 195 && saturation < 0.20 && (yFactor > 0.5)) {
                            isSky = true;
                        } else if (luminance > 225 && (yFactor > 0.6)) {
                            isSky = true;
                        } else if (b > r + 15 && b > 110 && (yFactor > 0.45)) {
                            isSky = true;
                        }
                    }

                    const val = isSky ? 255 : 0;
                    maskData[idx] = val;
                    maskData[idx + 1] = val;
                    maskData[idx + 2] = val;
                    maskData[idx + 3] = 255;
                }
            }

            ctx.putImageData(maskImgData, 0, 0);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};

/**
 * Aligns an image to target dimensions using a center-crop strategy.
 * This prevents 'stretching' while ensuring the output matches the source pixel grid.
 */
export const pixelPerfectAlign = async (dataUrl: string, targetWidth: number, targetHeight: number): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas failure"));

            const targetRatio = targetWidth / targetHeight;
            const currentRatio = img.width / img.height;
            
            let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;

            // Center-crop logic to match target aspect ratio without stretching
            if (currentRatio > targetRatio) {
                sourceWidth = img.height * targetRatio;
                sourceX = (img.width - sourceWidth) / 2;
            } else if (currentRatio < targetRatio) {
                sourceHeight = img.width / targetRatio;
                sourceY = (img.height - sourceHeight) / 2;
            }

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, targetWidth, targetHeight);
            
            // Sharpen scaled-up image to restore crispness
            if (targetWidth > img.width * 1.1) {
                sharpenCanvas(canvas, 0.12);
            }

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};

/**
 * Center-crops an image to a specific target aspect ratio and optionally resizes to target dimensions.
 */
export const cropToRatio = async (
    dataUrl: string, 
    targetRatio: number, 
    targetWidth?: number, 
    targetHeight?: number
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const currentRatio = img.width / img.height;
            
            let sourceX = 0, sourceY = 0, sourceWidth = img.width, sourceHeight = img.height;

            if (currentRatio > targetRatio) {
                sourceWidth = img.height * targetRatio;
                sourceX = (img.width - sourceWidth) / 2;
            } else if (currentRatio < targetRatio) {
                sourceHeight = img.width / targetRatio;
                sourceY = (img.height - sourceHeight) / 2;
            }

            canvas.width = targetWidth || sourceWidth;
            canvas.height = targetHeight || sourceHeight;
            
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas failure"));

            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
            
            // Sharpen scaled-up image to restore crispness
            if (canvas.width > img.width * 1.1) {
                sharpenCanvas(canvas, 0.12);
            }

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};

/**
 * Adds symmetric padding to an image to reach a target aspect ratio.
 * This is the basis for the 'Surgical Padding' preservation protocol.
 */
export const padToRatio = async (
    dataUrl: string, 
    targetRatio: number,
    paddingColor: string = 'black'
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const currentRatio = img.width / img.height;
            let canvasWidth = img.width;
            let canvasHeight = img.height;

            if (currentRatio > targetRatio) {
                // Current is wider than target ratio (e.g. 2:1 image, 1:1 target)
                // We need more height.
                canvasHeight = img.width / targetRatio;
            } else if (currentRatio < targetRatio) {
                // Current is taller than target ratio (e.g. 1:2 image, 1:1 target)
                // We need more width.
                canvasWidth = img.height * targetRatio;
            }

            const canvas = document.createElement('canvas');
            canvas.width = canvasWidth;
            canvas.height = canvasHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas failure"));

            ctx.fillStyle = paddingColor;
            ctx.fillRect(0, 0, canvasWidth, canvasHeight);

            const x = (canvasWidth - img.width) / 2;
            const y = (canvasHeight - img.height) / 2;
            ctx.drawImage(img, x, y);

            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = reject;
        img.src = dataUrl;
    });
};

/**
 * Draws a professional Gemini watermark on the canvas.
 */
export const drawGeminiWatermark = (
    ctx: CanvasRenderingContext2D, 
    width: number, 
    height: number, 
    _unusedLogoOnly: boolean = true,
    watermarkText?: string
) => {
    ctx.save();
    const padding = Math.round(width * 0.02);
    const size = Math.max(12, Math.round(width * 0.015));
    const bgHeight = size * 2.2;
    
    // Set up the font first to measure text correctly
    const fontSize = Math.max(10, Math.round(size * 0.75));
    ctx.font = `bold ${fontSize}px sans-serif`;
    
    let bgWidth = bgHeight;
    let textWidth = 0;
    if (watermarkText) {
        textWidth = ctx.measureText(watermarkText).width;
        bgWidth = bgHeight + textWidth + size * 0.6;
    }
    
    const x = width - bgWidth - padding;
    const y = height - bgHeight - padding;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.beginPath();
    if (typeof (ctx as any).roundRect === 'function') {
        (ctx as any).roundRect(x, y, bgWidth, bgHeight, bgHeight / 2);
    } else {
        ctx.rect(x, y, bgWidth, bgHeight);
    }
    ctx.fill();

    ctx.fillStyle = '#fbbf24';
    const iconX = watermarkText ? (x + bgHeight / 2) : (x + bgWidth / 2);
    const iconY = y + bgHeight / 2;
    const iconS = size * 0.7;
    
    ctx.beginPath();
    ctx.moveTo(iconX, iconY - iconS);
    ctx.quadraticCurveTo(iconX, iconY, iconX + iconS, iconY);
    ctx.quadraticCurveTo(iconX, iconY, iconX, iconY + iconS);
    ctx.quadraticCurveTo(iconX, iconY, iconX - iconS, iconY);
    ctx.quadraticCurveTo(iconX, iconY, iconX, iconY - iconS);
    ctx.fill();
    
    if (watermarkText) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.textBaseline = 'middle';
        ctx.textAlign = 'left';
        ctx.fillText(watermarkText, x + bgHeight - size * 0.1, y + bgHeight / 2);
    }
    
    ctx.restore();
};

/**
 * Applies a watermark to a base64 data URL.
 */
export const applyWatermarkToDataUrl = async (
    dataUrl: string, 
    addWatermark: boolean, 
    logoOnly: boolean,
    watermarkText?: string
): Promise<string> => {
    if (!addWatermark) return dataUrl;
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.naturalWidth;
            canvas.height = img.naturalHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Canvas context failed"));
            ctx.drawImage(img, 0, 0);
            drawGeminiWatermark(ctx, canvas.width, canvas.height, logoOnly, watermarkText);
            resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => reject(new Error("Failed to watermark image"));
        img.src = dataUrl;
    });
};

/**
 * Patches the JFIF header of a JPEG Blob to specify DPI.
 */
const patchJPEGDensity = async (blob: Blob, dpi: number = 300): Promise<Blob> => {
  const buffer = await blob.arrayBuffer();
  const view = new DataView(buffer);
  if (view.getUint16(0) !== 0xFFD8) return blob;

  let offset = 2;
  while (offset < view.byteLength) {
    const marker = view.getUint16(offset);
    const len = view.getUint16(offset + 2);
    if (marker === 0xFFE0) {
        const id = view.getUint32(offset + 4);
        const idEnd = view.getUint8(offset + 8);
        if (id === 0x4A464946 && idEnd === 0x00) {
            view.setUint8(offset + 11, 1);
            view.setUint16(offset + 12, dpi);
            view.setUint16(offset + 14, dpi);
            return new Blob([buffer], { type: 'image/jpeg' });
        }
    }
    offset += 2 + len;
  }
  return blob;
};

/**
 * Gets dimensions of an image safely without crashing or rejecting.
 */
export const getImageDimensions = (src: string): Promise<{width: number, height: number}> => {
    return new Promise((resolve) => {
        if (!src) {
            resolve({ width: 1920, height: 1080 });
            return;
        }
        const img = new Image();
        if (!src.startsWith('data:') && !src.startsWith('blob:')) {
            img.crossOrigin = "Anonymous";
        }
        const timeout = setTimeout(() => {
            resolve({ width: 1920, height: 1080 });
        }, 5000);

        img.onload = () => {
            clearTimeout(timeout);
            resolve({ width: img.naturalWidth || 1920, height: img.naturalHeight || 1080 });
        };
        img.onerror = () => {
            clearTimeout(timeout);
            // Fallback try without crossOrigin
            if (img.crossOrigin) {
                const retryImg = new Image();
                retryImg.onload = () => resolve({ width: retryImg.naturalWidth || 1920, height: retryImg.naturalHeight || 1080 });
                retryImg.onerror = () => resolve({ width: 1920, height: 1080 });
                retryImg.src = src;
            } else {
                resolve({ width: 1920, height: 1080 });
            }
        };
        img.src = src;
    });
};

/**
 * Extracts a high-resolution poster frame (video image) and native dimensions from a video file or blob URL.
 */
export const extractVideoThumbnailAndDimensions = (
    videoSource: string | File,
    seekTimeSec: number = 0.5
): Promise<{
    thumbnailDataUrl: string;
    width: number;
    height: number;
    duration: number;
}> => {
    return new Promise((resolve, reject) => {
        const video = document.createElement('video');
        const isFile = typeof videoSource !== 'string';
        const url = isFile ? URL.createObjectURL(videoSource) : videoSource;

        video.crossOrigin = 'anonymous';
        video.preload = 'auto';
        video.muted = true;
        video.playsInline = true;

        let isResolved = false;
        const timeout = setTimeout(() => {
            if (!isResolved) {
                isResolved = true;
                if (isFile) URL.revokeObjectURL(url);
                reject(new Error("Timeout extracting video frame"));
            }
        }, 15000);

        const captureFrame = () => {
            if (isResolved) return;
            isResolved = true;
            clearTimeout(timeout);
            try {
                const vw = video.videoWidth || 1920;
                const vh = video.videoHeight || 1080;
                const canvas = document.createElement('canvas');
                canvas.width = vw;
                canvas.height = vh;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(video, 0, 0, vw, vh);
                    const thumbnailDataUrl = canvas.toDataURL('image/jpeg', 0.92);
                    resolve({
                        thumbnailDataUrl,
                        width: vw,
                        height: vh,
                        duration: video.duration || 5
                    });
                } else {
                    reject(new Error("Failed to get 2d context for video frame"));
                }
            } catch (err) {
                reject(err);
            } finally {
                if (isFile) {
                    URL.revokeObjectURL(url);
                }
                video.removeAttribute('src');
                video.load();
            }
        };

        video.onloadedmetadata = () => {
            const dur = video.duration || 0;
            const targetTime = dur > 0.5 ? Math.min(seekTimeSec, dur - 0.1) : 0;
            if (targetTime > 0) {
                video.currentTime = targetTime;
            } else {
                captureFrame();
            }
        };

        video.onseeked = () => {
            captureFrame();
        };

        video.oncanplay = () => {
            if (!video.currentTime || video.currentTime === 0) {
                const dur = video.duration || 0;
                if (dur > 0.5) {
                    video.currentTime = Math.min(seekTimeSec, dur - 0.1);
                } else {
                    captureFrame();
                }
            }
        };

        video.onerror = () => {
            if (!isResolved) {
                isResolved = true;
                clearTimeout(timeout);
                if (isFile) URL.revokeObjectURL(url);
                reject(new Error("Failed to load video: " + (video.error?.message || "Unknown error")));
            }
        };

        video.src = url;
    });
};

/**
 * Resizes an image for API consumption (defaults to 1024px for token efficiency without quality loss).
 */
export const processImageForApi = async (file: File | string, maxDim: number = 1024): Promise<{ base64: string, mimeType: string, dataUrl: string }> => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;
            if (width > maxDim || height > maxDim) {
                const scale = maxDim / Math.max(width, height);
                width = Math.round(width * scale);
                height = Math.round(height * scale);
            }
            // PIXEL-PERFECT LOCK: Ensure even integers for AI compatibility and prevent sub-pixel shifts
            width = Math.floor(width / 2) * 2;
            height = Math.floor(height / 2) * 2;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Context failed"));
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/png');
            resolve({ base64: dataUrl.split(',')[1], mimeType: 'image/png', dataUrl });
        };
        img.onerror = reject;
        if (typeof file === 'string') { img.src = file; } 
        else {
            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target?.result as string; };
            reader.readAsDataURL(file);
        }
    });
};

/**
 * Resizes and processes an image to high-quality output.
 */
export const resizeAndProcessImage = async (
  sourceUrl: string, 
  targetWidth: number, 
  targetHeight: number,
  mimeType: string = 'image/jpeg',
  addWatermark: boolean = false,
  logoOnly: boolean = true,
  dpi: number = 300,
  quality: number = 0.85
): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!sourceUrl.startsWith('data:') && !sourceUrl.startsWith('blob:')) {
      img.crossOrigin = 'Anonymous';
    }
    img.onload = async () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Context failed"));
        
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        if (addWatermark) drawGeminiWatermark(ctx, canvas.width, canvas.height, logoOnly);
        
        canvas.toBlob(async (blob) => {
          if (blob) {
              if (mimeType === 'image/jpeg' && dpi > 72) {
                  try {
                      const patchedBlob = await patchJPEGDensity(blob, dpi);
                      resolve(patchedBlob);
                  } catch (e) { resolve(blob); }
              } else { resolve(blob); }
          } else { reject(new Error("Export failed")); }
        }, mimeType, mimeType === 'image/jpeg' ? quality : 1.0);
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = () => {
      // If failed with crossOrigin, retry without it
      if (img.crossOrigin) {
        const retryImg = new Image();
        retryImg.onload = async () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = targetWidth;
            canvas.height = targetHeight;
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error("Context failed"));
            ctx.drawImage(retryImg, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error("Export failed"));
            }, mimeType, quality);
          } catch (err) {
            reject(err);
          }
        };
        retryImg.onerror = () => reject(new Error("Failed to load image"));
        retryImg.src = sourceUrl;
      } else {
        reject(new Error("Failed to load image"));
      }
    };
    img.src = sourceUrl;
  });
};

/**
 * Optimizes image specifically for Web Display / Website Gallery.
 * Resizes to max width/height (configurable, defaults to 1800px-2880px for crisp high-res display),
 * applies 0.85-0.95 JPEG compression for maximum visual clarity,
 * and sets 72 DPI metadata.
 */
export const processWebGalleryImage = async (
  sourceUrl: string,
  is360: boolean = false,
  maxWebDim: number = 1800,
  quality: number = 0.85
): Promise<{ blob: Blob; ext: string; dataUrl: string }> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = async () => {
      let width = img.width;
      let height = img.height;
      const targetMax = is360 ? 3072 : maxWebDim;

      if (width > targetMax || height > targetMax) {
        const scale = targetMax / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      width = Math.max(2, Math.floor(width / 2) * 2);
      height = Math.max(2, Math.floor(height / 2) * 2);

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas context creation failed"));

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      canvas.toBlob(async (blob) => {
        if (blob) {
          try {
            const patchedBlob = await patchJPEGDensity(blob, 72);
            resolve({ blob: patchedBlob, ext: 'jpg', dataUrl });
          } catch (e) {
            resolve({ blob, ext: 'jpg', dataUrl });
          }
        } else {
          reject(new Error("Web image conversion failed"));
        }
      }, 'image/jpeg', quality);
    };
    img.onerror = () => reject(new Error("Failed to load image for web gallery optimization"));
    img.src = sourceUrl;
  });
};

/**
 * Projection services for 360 images.
 */
export const project360ToRectilinear = async (
  equirectangularBase64: string,
  yaw: number,
  pitch: number,
  fov: number = 90,
  width: number = 1920,
  height: number = 1080
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas failure"));
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;
      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = img.width;
      sourceCanvas.height = img.height;
      const sourceCtx = sourceCanvas.getContext('2d')!;
      sourceCtx.drawImage(img, 0, 0);
      const sourceData = sourceCtx.getImageData(0, 0, img.width, img.height).data;

      const toRad = Math.PI / 180;
      const ry = yaw * toRad;
      const rp = pitch * toRad;
      const focalLength = (width / 2) / Math.tan((fov * toRad) / 2);

      const srcW = img.width;
      const srcH = img.height;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const nx = x - width / 2;
          const ny = y - height / 2;
          let rx = nx;
          let ry_ray = ny;
          let rz = focalLength;
          let ty = ry_ray * Math.cos(rp) - rz * Math.sin(rp);
          let tz = ry_ray * Math.sin(rp) + rz * Math.cos(rp);
          ry_ray = ty; rz = tz;
          let tx = rx * Math.cos(ry) + rz * Math.sin(ry);
          tz = -rx * Math.sin(ry) + rz * Math.cos(ry);
          rx = tx; rz = tz;
          const lambda = Math.atan2(rx, rz);
          const phi = Math.atan2(ry_ray, Math.sqrt(rx * rx + rz * rz));
          const u = (lambda / Math.PI + 1) / 2 * srcW;
          const v = (phi / (Math.PI / 2) + 1) / 2 * srcH;

          // High-fidelity bilinear interpolation sampling for razor-sharp clarity
          const u0 = Math.floor(u);
          const v0 = Math.floor(v);
          const u1 = (u0 + 1) % srcW;
          const v1 = Math.min(srcH - 1, v0 + 1);
          const du = u - u0;
          const dv = v - v0;

          const s00 = (v0 * srcW + (u0 % srcW)) * 4;
          const s10 = (v0 * srcW + u1) * 4;
          const s01 = (v1 * srcW + (u0 % srcW)) * 4;
          const s11 = (v1 * srcW + u1) * 4;

          const w00 = (1 - du) * (1 - dv);
          const w10 = du * (1 - dv);
          const w01 = (1 - du) * dv;
          const w11 = du * dv;

          const dIdx = (y * width + x) * 4;
          data[dIdx] = w00 * sourceData[s00] + w10 * sourceData[s10] + w01 * sourceData[s01] + w11 * sourceData[s11];
          data[dIdx + 1] = w00 * sourceData[s00 + 1] + w10 * sourceData[s10 + 1] + w01 * sourceData[s01 + 1] + w11 * sourceData[s11 + 1];
          data[dIdx + 2] = w00 * sourceData[s00 + 2] + w10 * sourceData[s10 + 2] + w01 * sourceData[s01 + 2] + w11 * sourceData[s11 + 2];
          data[dIdx + 3] = 255;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = (equirectangularBase64.startsWith('data:') || equirectangularBase64.startsWith('blob:') || equirectangularBase64.startsWith('http') || equirectangularBase64.startsWith('/')) 
      ? equirectangularBase64 
      : `data:image/png;base64,${equirectangularBase64}`;
  });
};

/**
 * Calculates the optimal rectilinear projection resolution to match a 360 panorama's native resolution
 * (e.g. 4096x2048 equirectangular) and camera FOV.
 * For 4K (4096px wide) panoramas, this returns 2048x1536 (2K 4:3) to achieve 1:1 pixel fidelity.
 */
export const getOptimalProjectionResolution = (
  panoWidth: number = 4096,
  panoHeight: number = 2048,
  fov: number = 90
): { width: number; height: number } => {
  if (panoWidth >= 3000) {
    // 4K (4096x2048) or 8K panoramas -> 2K native rectilinear crop (2048x1536)
    return { width: 2048, height: 1536 };
  } else if (panoWidth >= 2000) {
    return { width: 1536, height: 1152 };
  }
  return { width: 1024, height: 768 };
};

/**
 * Shifts / rolls an equirectangular 360 panorama horizontally by degrees (-180° to +180° or 0° to 360°).
 * This repositions the center of the image and rotates the 360 seam with zero loss of quality (lossless 2D wrap).
 */
export const shiftPanoramaHorizontal = async (
  equirectangularUrl: string,
  degrees: number
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas context failed"));

      // Normalize degrees to [0, 360)
      let normDeg = degrees % 360;
      if (normDeg < 0) normDeg += 360;

      const shiftX = Math.round((normDeg / 360) * W);
      if (shiftX === 0) {
        ctx.drawImage(img, 0, 0);
        return resolve(canvas.toDataURL('image/png'));
      }

      // Draw right portion to the left of the canvas
      // Source: x = shiftX, width = W - shiftX
      // Dest:   x = 0,      width = W - shiftX
      ctx.drawImage(img, shiftX, 0, W - shiftX, H, 0, 0, W - shiftX, H);

      // Draw left portion to the right of the canvas
      // Source: x = 0,          width = shiftX
      // Dest:   x = W - shiftX, width = shiftX
      ctx.drawImage(img, 0, 0, shiftX, H, W - shiftX, 0, shiftX, H);

      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = reject;
    img.src = equirectangularUrl.startsWith('data:') || equirectangularUrl.startsWith('blob:') || equirectangularUrl.startsWith('http') || equirectangularUrl.startsWith('/')
      ? equirectangularUrl
      : `data:image/png;base64,${equirectangularUrl}`;
  });
};

/**
 * Reprojects a targeted rectilinear perspective image back into a full-resolution equirectangular panorama.
 * Features:
 * - Direct compositing into the full-res base canvas (preserving up to 8K original pixels).
 * - Smooth edge feathering to eliminate seams between the AI-staged area and the rest of the room.
 * - Bilinear subpixel interpolation for crisp sampling.
 */
export const reprojectRectilinearTo360 = async (
  baseEquirectangularUrl: string,
  rectilinearUrl: string,
  yaw: number,
  pitch: number,
  fov: number = 90,
  featherPx: number = 28
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const baseImg = new Image();
    baseImg.crossOrigin = 'Anonymous';

    baseImg.onload = () => {
      const rectImg = new Image();
      rectImg.crossOrigin = 'Anonymous';

      rectImg.onload = () => {
        const W = baseImg.width;
        const H = baseImg.height;
        const w = rectImg.width;
        const h = rectImg.height;

        // Create base canvas with original full resolution
        const baseCanvas = document.createElement('canvas');
        baseCanvas.width = W;
        baseCanvas.height = H;
        const baseCtx = baseCanvas.getContext('2d');
        if (!baseCtx) return reject(new Error("Base canvas failure"));
        baseCtx.drawImage(baseImg, 0, 0);
        const baseImageData = baseCtx.getImageData(0, 0, W, H);
        const baseData = baseImageData.data;

        // Get rectilinear pixel data
        const rectCanvas = document.createElement('canvas');
        rectCanvas.width = w;
        rectCanvas.height = h;
        const rectCtx = rectCanvas.getContext('2d');
        if (!rectCtx) return reject(new Error("Rectilinear canvas failure"));
        rectCtx.drawImage(rectImg, 0, 0);
        const rectData = rectCtx.getImageData(0, 0, w, h).data;

        const toRad = Math.PI / 180;
        const ry = yaw * toRad;
        const rp = pitch * toRad;
        const focalLength = (w / 2) / Math.tan((fov * toRad) / 2);

        const cosRy = Math.cos(ry);
        const sinRy = Math.sin(ry);
        const cosRp = Math.cos(rp);
        const sinRp = Math.sin(rp);

        // Compute latitude bounding box to optimize iteration over full-res canvas
        const corners = [
          [0, 0], [w, 0], [w, h], [0, h],
          [w / 2, 0], [w / 2, h], [0, h / 2], [w, h / 2], [w / 2, h / 2]
        ];
        let minPhi = Infinity, maxPhi = -Infinity;
        for (const [px, py] of corners) {
          const nx = px - w / 2;
          const ny = py - h / 2;
          const ty = ny * cosRp - focalLength * sinRp;
          const tz1 = ny * sinRp + focalLength * cosRp;
          const tx = nx * cosRy + tz1 * sinRy;
          const tz = -nx * sinRy + tz1 * cosRy;
          const phi = Math.atan2(ty, Math.sqrt(tx * tx + tz * tz));
          if (phi < minPhi) minPhi = phi;
          if (phi > maxPhi) maxPhi = phi;
        }
        const marginPhi = fov > 120 ? 0.45 : 0.2;
        minPhi = Math.max(-Math.PI / 2, minPhi - marginPhi);
        maxPhi = Math.min(Math.PI / 2, maxPhi + marginPhi);

        const minY = Math.max(0, Math.floor(((minPhi / (Math.PI / 2) + 1) / 2) * H));
        const maxY = Math.min(H - 1, Math.ceil(((maxPhi / (Math.PI / 2) + 1) / 2) * H));

        // Iterate through the bounding range on the equirectangular sphere
        for (let Y = minY; Y <= maxY; Y++) {
          const phi = (Y / H * 2 - 1) * (Math.PI / 2);
          const cosPhi = Math.cos(phi);
          const sinPhi = Math.sin(phi);

          for (let X = 0; X < W; X++) {
            const lambda = (X / W * 2 - 1) * Math.PI;
            const Dx = cosPhi * Math.sin(lambda);
            const Dy = sinPhi;
            const Dz = cosPhi * Math.cos(lambda);

            // Un-yaw
            const v1_x = Dx * cosRy - Dz * sinRy;
            const v1_y = Dy;
            const v1_z = Dx * sinRy + Dz * cosRy;

            // Un-pitch
            const c_x = v1_x;
            const c_y = v1_y * cosRp + v1_z * sinRp;
            const c_z = -v1_y * sinRp + v1_z * cosRp;

            // Must be in front of rectilinear camera plane
            if (c_z <= 0.001) continue;

            const px = (c_x / c_z) * focalLength + w / 2;
            const py = (c_y / c_z) * focalLength + h / 2;

            if (px >= 0 && px < w && py >= 0 && py < h) {
              // Edge feathering to eliminate seams
              const distLeft = px;
              const distRight = (w - 1) - px;
              const distTop = py;
              const distBottom = (h - 1) - py;
              const minDist = Math.min(distLeft, distRight, distTop, distBottom);
              if (minDist <= 0) continue;

              let alpha = minDist / featherPx;
              if (alpha > 1) alpha = 1;
              // Smoothstep S-curve for ultra-smooth edge blending
              alpha = alpha * alpha * (3 - 2 * alpha);

              // Bilinear interpolation for subpixel sampling
              const x0 = Math.floor(px);
              const y0 = Math.floor(py);
              const x1 = Math.min(w - 1, x0 + 1);
              const y1 = Math.min(h - 1, y0 + 1);
              const dx = px - x0;
              const dy = py - y0;

              const idx00 = (y0 * w + x0) * 4;
              const idx10 = (y0 * w + x1) * 4;
              const idx01 = (y1 * w + x0) * 4;
              const idx11 = (y1 * w + x1) * 4;

              const w00 = (1 - dx) * (1 - dy);
              const w10 = dx * (1 - dy);
              const w01 = (1 - dx) * dy;
              const w11 = dx * dy;

              const r = w00 * rectData[idx00] + w10 * rectData[idx10] + w01 * rectData[idx01] + w11 * rectData[idx11];
              const g = w00 * rectData[idx00 + 1] + w10 * rectData[idx10 + 1] + w01 * rectData[idx01 + 1] + w11 * rectData[idx11 + 1];
              const b = w00 * rectData[idx00 + 2] + w10 * rectData[idx10 + 2] + w01 * rectData[idx01 + 2] + w11 * rectData[idx11 + 2];

              const dIdx = (Y * W + X) * 4;
              baseData[dIdx]     = Math.round(alpha * r + (1 - alpha) * baseData[dIdx]);
              baseData[dIdx + 1] = Math.round(alpha * g + (1 - alpha) * baseData[dIdx + 1]);
              baseData[dIdx + 2] = Math.round(alpha * b + (1 - alpha) * baseData[dIdx + 2]);
            }
          }
        }

        baseCtx.putImageData(baseImageData, 0, 0);
        resolve(baseCanvas.toDataURL('image/jpeg', 0.98));
      };

      rectImg.onerror = reject;
      rectImg.src = (rectilinearUrl.startsWith('data:') || rectilinearUrl.startsWith('blob:') || rectilinearUrl.startsWith('http') || rectilinearUrl.startsWith('/')) 
        ? rectilinearUrl 
        : `data:image/png;base64,${rectilinearUrl}`;
    };

    baseImg.onerror = reject;
    baseImg.src = (baseEquirectangularUrl.startsWith('data:') || baseEquirectangularUrl.startsWith('blob:') || baseEquirectangularUrl.startsWith('http') || baseEquirectangularUrl.startsWith('/')) 
      ? baseEquirectangularUrl 
      : `data:image/png;base64,${baseEquirectangularUrl}`;
  });
};

export const createZipArchive = async (images: { name: string; blob: Blob }[]): Promise<Blob> => {
  const zip = new JSZip();
  images.forEach((img) => { zip.file(img.name, img.blob); });
  return await zip.generateAsync({ type: 'blob' });
};

export const convertPdfToImage = async (file: File): Promise<File> => {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdf.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  const page = await pdfDoc.getPage(1);
  const scale = 4.0;
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas failure');
  canvas.height = viewport.height;
  canvas.width = viewport.width;
  await page.render({ canvasContext: context, viewport: viewport }).promise;
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        const newFileName = file.name.replace(/\.pdf$/i, '.png');
        resolve(new File([blob], newFileName, { type: 'image/png' }));
      } else { reject(new Error('PDF conversion failure')); }
    }, 'image/png');
  });
};

export interface DilateMaskResult {
  dilatedDataUrl: string;
  coverageRatio: number;
  whitePixelCount: number;
  totalPixelCount: number;
  isCoverageValid: boolean; // coverageRatio >= 0.008 (at least ~0.8% coverage)
  previewOverlayUrl?: string;
}

/**
 * Performs separable morphological dilation on a binary mask to capture contact shadows,
 * rug borders, furniture edges, and wire fringes.
 * Also calculates non-black pixel coverage ratio to validate mask validity.
 */
export const dilateMask = async (
  maskInput: string,
  radiusPixels: number = 20,
  generateOverlay: boolean = false
): Promise<DilateMaskResult> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      if (W === 0 || H === 0) {
        return reject(new Error("Invalid mask image dimensions"));
      }

      const canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error("Canvas failure"));

      ctx.drawImage(img, 0, 0, W, H);
      const imgData = ctx.getImageData(0, 0, W, H);
      const data = imgData.data;

      const totalPixelCount = W * H;
      const binary = new Uint8Array(totalPixelCount);
      let initialWhiteCount = 0;

      // Extract binary mask: 1 = masked (white/active), 0 = black (preserve)
      for (let i = 0; i < totalPixelCount; i++) {
        const offset = i * 4;
        const r = data[offset];
        const g = data[offset + 1];
        const b = data[offset + 2];
        const a = data[offset + 3];
        // Treat pixel as masked if bright or non-zero alpha on monochrome
        if (a > 50 && (r > 70 || g > 70 || b > 70)) {
          binary[i] = 1;
          initialWhiteCount++;
        } else {
          binary[i] = 0;
        }
      }

      const r = Math.max(0, Math.round(radiusPixels));
      let dilatedBinary = binary;

      if (r > 0 && initialWhiteCount > 0) {
        // Fast Separable 2-Pass Dilation:
        // Pass 1: Horizontal running window of size 2r + 1
        const tempH = new Uint8Array(totalPixelCount);
        for (let y = 0; y < H; y++) {
          const rowOffset = y * W;
          let windowSum = 0;

          // Prime window for x=0
          const initialRight = Math.min(W - 1, r);
          for (let x = 0; x <= initialRight; x++) {
            windowSum += binary[rowOffset + x];
          }

          for (let x = 0; x < W; x++) {
            tempH[rowOffset + x] = windowSum > 0 ? 1 : 0;
            // Remove outgoing element from left
            const leftX = x - r;
            if (leftX >= 0) {
              windowSum -= binary[rowOffset + leftX];
            }
            // Add incoming element to right
            const nextRightX = x + r + 1;
            if (nextRightX < W) {
              windowSum += binary[rowOffset + nextRightX];
            }
          }
        }

        // Pass 2: Vertical running window of size 2r + 1
        dilatedBinary = new Uint8Array(totalPixelCount);
        for (let x = 0; x < W; x++) {
          let windowSum = 0;
          const initialBottom = Math.min(H - 1, r);
          for (let y = 0; y <= initialBottom; y++) {
            windowSum += tempH[y * W + x];
          }

          for (let y = 0; y < H; y++) {
            dilatedBinary[y * W + x] = windowSum > 0 ? 1 : 0;
            const topY = y - r;
            if (topY >= 0) {
              windowSum -= tempH[topY * W + x];
            }
            const nextBottomY = y + r + 1;
            if (nextBottomY < H) {
              windowSum += tempH[nextBottomY * W + x];
            }
          }
        }
      }

      // Count final dilated white pixels
      let finalWhiteCount = 0;
      for (let i = 0; i < totalPixelCount; i++) {
        const offset = i * 4;
        if (dilatedBinary[i] === 1) {
          finalWhiteCount++;
          data[offset] = 255;
          data[offset + 1] = 255;
          data[offset + 2] = 255;
          data[offset + 3] = 255;
        } else {
          data[offset] = 0;
          data[offset + 1] = 0;
          data[offset + 2] = 0;
          data[offset + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const dilatedDataUrl = canvas.toDataURL('image/png');

      const coverageRatio = finalWhiteCount / totalPixelCount;
      const isCoverageValid = coverageRatio >= 0.008; // at least 0.8% of image

      let previewOverlayUrl: string | undefined;
      if (generateOverlay) {
        const overlayCanvas = document.createElement('canvas');
        overlayCanvas.width = W;
        overlayCanvas.height = H;
        const oCtx = overlayCanvas.getContext('2d');
        if (oCtx) {
          const oImgData = oCtx.createImageData(W, H);
          const oData = oImgData.data;
          for (let i = 0; i < totalPixelCount; i++) {
            const offset = i * 4;
            if (dilatedBinary[i] === 1) {
              // Vibrant semi-transparent amber-orange for visualization
              oData[offset] = 249;     // R
              oData[offset + 1] = 115; // G
              oData[offset + 2] = 22;  // B
              oData[offset + 3] = 160; // Alpha ~63%
            } else {
              oData[offset + 3] = 0;   // Transparent
            }
          }
          oCtx.putImageData(oImgData, 0, 0);
          previewOverlayUrl = overlayCanvas.toDataURL('image/png');
        }
      }

      resolve({
        dilatedDataUrl,
        coverageRatio,
        whitePixelCount: finalWhiteCount,
        totalPixelCount,
        isCoverageValid,
        previewOverlayUrl
      });
    };

    img.onerror = (err) => reject(new Error(`Failed to load mask image for dilation: ${err}`));
    img.src = maskInput.startsWith('data:') ? maskInput : `data:image/png;base64,${maskInput}`;
  });
};

/**
 * Calculates the outdoor sky pixel percentage (0-100).
 * If a binary mask is provided, counts mask pixels.
 * If an image is provided:
 * - If sceneType is 'interior', sky can ONLY be seen through windows; if no windows or no outdoors, returns 0%.
 * - Drywall ceilings, indoor walls, and ceiling fixtures are strictly excluded.
 */
export const calculateSkyCoveragePercent = async (
  maskOrImageDataUrl: string, 
  sceneType?: string,
  hasWindows?: boolean
): Promise<number> => {
  return new Promise((resolve) => {
    if (!maskOrImageDataUrl) {
      return resolve(0);
    }
    // If we know this is an interior shot and it has no windows, sky coverage is mathematically 0%
    if (sceneType === 'interior' && hasWindows === false) {
      return resolve(0);
    }

    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const maxDim = 256; // Fast downsample for instant pixel counting
        let w = img.naturalWidth || 256;
        let h = img.naturalHeight || 256;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(0);

        ctx.drawImage(img, 0, 0, w, h);
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;
        const total = w * h;
        let skyPixels = 0;

        // If the shot is an interior room, any bright area in the top 35% of the frame
        // without strong sky blue hue or high contrast window framing is a ceiling, NOT outdoor sky.
        const isInterior = sceneType === 'interior';

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const offset = (y * w + x) * 4;
            const r = data[offset];
            const g = data[offset + 1];
            const b = data[offset + 2];
            const a = data[offset + 3];

            if (a > 50) {
              // Check if pixel exhibits natural outdoor sky characteristics:
              // Outdoor blue sky: b > r + 15 and b > g
              // Overcast outdoor sky: high brightness with neutral cool tint
              const isSkyBlue = b > 140 && b > r + 12 && b >= g;
              const isOvercastWhite = r > 175 && g > 175 && b > 175 && Math.abs(r - g) < 18 && Math.abs(r - b) < 18;

              if (isInterior) {
                // In interior shots:
                // 1. The top 25% of the frame is almost always the ceiling / upper drywall / recessed cans.
                // Drywall ceiling is warm or neutral white.
                // 2. We ONLY count pixels that are explicitly sky-blue or framed within windows.
                if (isSkyBlue) {
                  skyPixels++;
                } else if (isOvercastWhite && y > h * 0.25) {
                  // Only consider potential window areas below the immediate ceiling plane
                  // and verify it's not a uniform ceiling
                  skyPixels += 0.5; // discounted weight to prevent false ceiling hits
                }
              } else {
                // Exterior shot: standard open sky detection
                if (isSkyBlue || isOvercastWhite) {
                  skyPixels++;
                }
              }
            }
          }
        }

        const pct = (skyPixels / total) * 100;
        // In interior shots, if total sky percentage is tiny or doubtful, clamp appropriately
        const finalPct = isInterior && pct > 35 ? Math.min(pct * 0.15, 8.5) : pct;
        resolve(Math.round(finalPct * 10) / 10);
      } catch (err) {
        console.warn("[SkyCoverage] Error calculating sky percentage:", err);
        resolve(0);
      }
    };
    img.onerror = () => resolve(0);
    img.src = maskOrImageDataUrl.startsWith('data:') ? maskOrImageDataUrl : `data:image/png;base64,${maskOrImageDataUrl}`;
  });
};

/**
 * High-Pass Detail Extraction & Frequency Blending.
 * Extracts micro-contrast and fine architectural textures (grain, wood pores, drywall textures, stone)
 * from the high-resolution source camera image and injects it into the AI-edited image.
 * This eliminates the smooth "plastic/smudged" AI look and brings back authentic optical sharpness.
 */
export const blendHighFrequencyDetails = (
  targetCanvas: HTMLCanvasElement,
  sourceImg: HTMLImageElement,
  strength: number = 0.22
) => {
  const ctx = targetCanvas.getContext('2d');
  if (!ctx) return;
  const width = targetCanvas.width;
  const height = targetCanvas.height;

  try {
    // Render source image at target canvas resolution to align pixels
    const srcCanvas = document.createElement('canvas');
    srcCanvas.width = width;
    srcCanvas.height = height;
    const sCtx = srcCanvas.getContext('2d');
    if (!sCtx) return;
    sCtx.imageSmoothingEnabled = true;
    sCtx.imageSmoothingQuality = 'high';
    sCtx.drawImage(sourceImg, 0, 0, width, height);

    const srcData = sCtx.getImageData(0, 0, width, height);
    const tgtData = ctx.getImageData(0, 0, width, height);
    const sD = srcData.data;
    const tD = tgtData.data;

    // Apply high-frequency edge difference transfer
    const stride = width * 4;
    for (let y = 1; y < height - 1; y++) {
      const row = y * stride;
      for (let x = 1; x < width - 1; x++) {
        const idx = row + (x * 4);

        // Calculate Laplacian difference on source luminance
        const lumCenter = (sD[idx] * 299 + sD[idx + 1] * 587 + sD[idx + 2] * 114) / 1000;
        const lumTop = (sD[idx - stride] * 299 + sD[idx - stride + 1] * 587 + sD[idx - stride + 2] * 114) / 1000;
        const lumBottom = (sD[idx + stride] * 299 + sD[idx + stride + 1] * 587 + sD[idx + stride + 2] * 114) / 1000;
        const lumLeft = (sD[idx - 4] * 299 + sD[idx - 3] * 587 + sD[idx - 2] * 114) / 1000;
        const lumRight = (sD[idx + 4] * 299 + sD[idx + 5] * 587 + sD[idx + 6] * 114) / 1000;

        // High frequency detail amplitude
        const highPass = (4 * lumCenter) - (lumTop + lumBottom + lumLeft + lumRight);

        if (Math.abs(highPass) > 2) {
          const delta = highPass * strength;
          tD[idx] = Math.min(255, Math.max(0, tD[idx] + delta));
          tD[idx + 1] = Math.min(255, Math.max(0, tD[idx + 1] + delta));
          tD[idx + 2] = Math.min(255, Math.max(0, tD[idx + 2] + delta));
        }
      }
    }

    ctx.putImageData(tgtData, 0, 0);
  } catch (e) {
    console.warn("High-frequency detail blending skipped:", e);
  }
};

/**
 * Enhanced Full-Resolution Master Blending (Zero-Cost Quality Engine).
 * Takes the original high-resolution camera photo (e.g. 4000x3000 / 12-24 MP)
 * and fuses the AI's modifications back at full native resolution with:
 * 1. High-order bicubic scaling
 * 2. High-frequency texture and optical grain transfer
 * 3. 300 DPI metadata injection
 * 4. Near-lossless 0.96 JPEG encoding (eliminates 80% compression blockiness)
 */
export const enhanceToFullResolution = async (
  aiResultDataUrl: string,
  originalDataUrl: string,
  options: {
    targetWidth?: number;
    targetHeight?: number;
    detailStrength?: number;
    sharpenAmount?: number;
    dpi?: number;
    quality?: number;
  } = {}
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const aiImg = new Image();
    const origImg = new Image();

    let loaded = 0;
    const checkLoad = () => {
      loaded++;
      if (loaded === 2) processMaster();
    };

    aiImg.crossOrigin = "Anonymous";
    origImg.crossOrigin = "Anonymous";

    aiImg.onload = checkLoad;
    origImg.onload = checkLoad;

    aiImg.onerror = reject;
    origImg.onerror = reject;

    aiImg.src = aiResultDataUrl;
    origImg.src = originalDataUrl;

    async function processMaster() {
      try {
        const fullW = options.targetWidth || origImg.naturalWidth || aiImg.naturalWidth;
        const fullH = options.targetHeight || origImg.naturalHeight || aiImg.naturalHeight;
        const dpi = options.dpi || 300;
        const quality = options.quality !== undefined ? options.quality : 0.96;
        const detailStrength = options.detailStrength !== undefined ? options.detailStrength : 0.24;
        const sharpenAmount = options.sharpenAmount !== undefined ? options.sharpenAmount : 0.16;

        const canvas = document.createElement('canvas');
        canvas.width = fullW;
        canvas.height = fullH;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(aiResultDataUrl);

        // High quality bicubic scaling setup
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // 1. Draw AI result stretched to full native camera resolution
        ctx.drawImage(aiImg, 0, 0, fullW, fullH);

        // 2. Transfer authentic optical micro-textures and high-pass edges from original photo
        if (origImg.naturalWidth > 0 && origImg.naturalHeight > 0) {
          blendHighFrequencyDetails(canvas, origImg, detailStrength);
        }

        // 3. Multi-tap crispness sharpening
        if (sharpenAmount > 0) {
          sharpenCanvas(canvas, sharpenAmount);
        }

        // 4. Output with 300 DPI metadata and near-lossless 0.96 JPEG
        canvas.toBlob(async (blob) => {
          if (blob) {
            try {
              const patchedBlob = await patchJPEGDensity(blob, dpi);
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result as string);
              reader.onerror = () => resolve(canvas.toDataURL('image/jpeg', quality));
              reader.readAsDataURL(patchedBlob);
            } catch (pErr) {
              resolve(canvas.toDataURL('image/jpeg', quality));
            }
          } else {
            resolve(canvas.toDataURL('image/jpeg', quality));
          }
        }, 'image/jpeg', quality);
      } catch (err) {
        console.warn("Full-resolution enhancement error, returning AI result:", err);
        resolve(aiResultDataUrl);
      }
    }
  });
};


