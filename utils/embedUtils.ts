/**
 * Utilities for extracting, sanitizing, and normalizing 3D models, 
 * virtual tours, Kuula 360 walkthroughs, Matterport walkthroughs, 3D floor plans, and video embed URLs.
 */

export const isKuulaUrl = (raw: string | undefined | null): boolean => {
  if (!raw) return false;
  return /kuula\.co/i.test(raw);
};

export const optimizeKuulaUrl = (raw: string): string => {
  try {
    let urlStr = raw.trim();
    if (!/^https?:\/\//i.test(urlStr)) {
      urlStr = `https://${urlStr}`;
    }
    const parsed = new URL(urlStr);
    
    // 1. Convert /post/XXXX to /share/XXXX for valid iframe embedding
    if (parsed.pathname.startsWith('/post/')) {
      parsed.pathname = parsed.pathname.replace('/post/', '/share/');
    }

    // 2. Configure query parameters for full mobile & desktop label and navigation visibility
    // &nav=1 : Forces top navigation & room menu to show on mobile & touchscreens
    // &info=1 : Displays room title / tour heading
    // &thumbs=1 : Displays interactive bottom thumbnails with room names/labels
    // &fs=1 : Fullscreen toggle
    // &vr=1 : VR button toggle
    // &sd=1 : Spatial sound toggle if tour has audio
    // &chromeless=0 : Ensures UI and room labels are NOT stripped on mobile
    if (!parsed.searchParams.has('nav')) {
      parsed.searchParams.set('nav', '1');
    }
    if (!parsed.searchParams.has('info')) {
      parsed.searchParams.set('info', '1');
    }
    if (!parsed.searchParams.has('thumbs')) {
      parsed.searchParams.set('thumbs', '1');
    }
    if (!parsed.searchParams.has('fs')) {
      parsed.searchParams.set('fs', '1');
    }
    if (!parsed.searchParams.has('vr')) {
      parsed.searchParams.set('vr', '1');
    }
    if (!parsed.searchParams.has('sd')) {
      parsed.searchParams.set('sd', '1');
    }

    // If chromeless was turned on, disable it so mobile labels are displayed
    if (parsed.searchParams.get('chromeless') === '1') {
      parsed.searchParams.set('chromeless', '0');
    }

    return parsed.toString();
  } catch {
    return raw;
  }
};

export const cleanEmbedUrl = (raw: string | undefined | null): string | null => {
  if (!raw) return null;
  let text = String(raw).trim();
  if (!text) return null;

  // 1. Decode HTML entities (e.g. &amp;, &quot;, &#39;, &lt;, &gt;, &apos;)
  text = text
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'");

  // 2. If it contains an <iframe> tag, extract the `src` attribute value
  if (text.toLowerCase().includes('<iframe') || text.toLowerCase().includes('src=')) {
    // Match src="...", src='...', or src=... with possible spaces around '='
    const srcMatch = text.match(/src\s*=\s*["']?([^"'\s>]+)["']?/i);
    if (srcMatch && srcMatch[1]) {
      text = srcMatch[1];
    } else {
      // Fallback: extract any URL starting with http://, https://, or //
      const urlMatch = text.match(/(?:https?:)?\/\/[^\s"'<>]+/i);
      if (urlMatch && urlMatch[0]) {
        text = urlMatch[0];
      }
    }
  }

  // 3. Strip any wrapper quotes, tags, or brackets
  text = text.replace(/^["'<>]+|["'<>]+$/g, '').trim();

  // 4. Protocol-relative URLs (e.g. "//my.matterport.com/...")
  if (text.startsWith('//')) {
    text = `https:${text}`;
  }

  // 5. Add https:// if protocol is missing
  if (!/^https?:\/\//i.test(text) && !text.startsWith('data:') && !text.startsWith('blob:')) {
    if (text.includes('.') && !text.includes(' ') && !text.includes('<') && !text.includes('>')) {
      text = `https://${text}`;
    } else {
      return null;
    }
  }

  // 6. Kuula Virtual Tour transformation & mobile optimization
  if (/kuula\.co/i.test(text)) {
    return optimizeKuulaUrl(text);
  }

  // 7. YouTube video transformation
  const ytMatch = text.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
  if (ytMatch && ytMatch[1]) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // 8. Vimeo video transformation
  const vimeoMatch = text.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/i);
  if (vimeoMatch && vimeoMatch[1]) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  // 9. Sketchfab 3D Model transformation (convert model page to embed URL)
  const sketchfabMatch = text.match(/sketchfab\.com\/3d-models\/[^\s/]+-([a-f0-9]{32})/i);
  if (sketchfabMatch && sketchfabMatch[1] && !text.includes('/embed')) {
    return `https://sketchfab.com/models/${sketchfabMatch[1]}/embed`;
  }

  // 10. Final validation: ensure valid URL
  try {
    const parsed = new URL(text);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
};
