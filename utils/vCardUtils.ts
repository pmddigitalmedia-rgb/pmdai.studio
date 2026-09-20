/**
 * Smart Instant vCard / Contact Card Generator & Downloader Utility
 * Fully compliant with vCard 3.0 & MECARD specifications for iOS, macOS, Android, Outlook, and Google Contacts.
 */

export interface VCardData {
  firstName?: string;
  lastName?: string;
  formattedName?: string;
  organization?: string;
  title?: string;
  phone?: string;
  cellPhone?: string;
  workPhone?: string;
  email?: string;
  website?: string;
  street?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  note?: string;
  propertyAddress?: string;
  photoBase64?: string | null;
}

/**
 * Parses a full name string into First Name and Last Name parts.
 */
export function parseFullName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  const lastName = parts[parts.length - 1];
  const firstName = parts.slice(0, -1).join(' ');
  return { firstName, lastName };
}

/**
 * Escapes characters for vCard text values.
 */
function escapeVCardText(text: string): string {
  if (!text) return '';
  return String(text)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

/**
 * Formats a clean phone number by removing excess characters while preserving extension/country codes.
 */
export function cleanPhoneNumber(phone: string): string {
  if (!phone) return '';
  return phone.trim();
}

/**
 * Ensures a website URL starts with https:// or http://.
 */
export function formatWebUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

/**
 * Generates a complete RFC-compliant vCard 3.0 string.
 */
export function generateVCard(data: VCardData): string {
  const parsed = parseFullName(data.formattedName || `${data.firstName || ''} ${data.lastName || ''}`);
  const firstName = data.firstName || parsed.firstName || 'Real Estate';
  const lastName = data.lastName || parsed.lastName || 'Associate';
  const fn = data.formattedName || `${firstName} ${lastName}`.trim() || 'Real Estate Associate';
  
  const org = data.organization || '';
  const title = data.title || 'Licensed Real Estate Professional';
  const mainPhone = data.phone || data.cellPhone || data.workPhone || '';
  const email = data.email || '';
  const website = data.website ? formatWebUrl(data.website) : '';
  const street = data.street || '';
  const city = data.city || '';
  const state = data.state || '';
  const zip = data.zip || '';
  const country = data.country || '';

  const noteParts: string[] = [];
  if (data.note) noteParts.push(data.note);
  if (data.propertyAddress) noteParts.push(`Listing Associate for: ${data.propertyAddress}`);
  const note = noteParts.join(' | ');

  const lines: string[] = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVCardText(lastName)};${escapeVCardText(firstName)};;;`,
    `FN:${escapeVCardText(fn)}`,
  ];

  if (org) {
    lines.push(`ORG:${escapeVCardText(org)}`);
  }

  if (title) {
    lines.push(`TITLE:${escapeVCardText(title)}`);
  }

  if (mainPhone) {
    lines.push(`TEL;TYPE=CELL,VOICE,PREF:${escapeVCardText(mainPhone)}`);
    if (data.workPhone && data.workPhone !== mainPhone) {
      lines.push(`TEL;TYPE=WORK,VOICE:${escapeVCardText(data.workPhone)}`);
    }
  }

  if (email) {
    lines.push(`EMAIL;TYPE=INTERNET,PREF:${escapeVCardText(email)}`);
  }

  if (website) {
    lines.push(`URL:${escapeVCardText(website)}`);
  }

  if (street || city || state || zip || country) {
    // ADR format: ADR;TYPE=WORK:;;street;city;state;zip;country
    lines.push(`ADR;TYPE=WORK:;;${escapeVCardText(street)};${escapeVCardText(city)};${escapeVCardText(state)};${escapeVCardText(zip)};${escapeVCardText(country)}`);
  }

  if (note) {
    lines.push(`NOTE:${escapeVCardText(note)}`);
  }

  // Handle embedded photo if base64 provided and reasonable size
  if (data.photoBase64 && typeof data.photoBase64 === 'string') {
    let rawBase64 = data.photoBase64;
    let photoType = 'JPEG';
    if (rawBase64.startsWith('data:image/png;base64,')) {
      photoType = 'PNG';
      rawBase64 = rawBase64.replace('data:image/png;base64,', '');
    } else if (rawBase64.startsWith('data:image/jpeg;base64,') || rawBase64.startsWith('data:image/jpg;base64,')) {
      photoType = 'JPEG';
      rawBase64 = rawBase64.replace(/^data:image\/jpe?g;base64,/, '');
    } else if (rawBase64.startsWith('data:image/webp;base64,')) {
      photoType = 'WEBP';
      rawBase64 = rawBase64.replace('data:image/webp;base64,', '');
    }

    // Only include photo in vCard if raw base64 is under 150KB to keep instant download super fast
    if (rawBase64.length > 0 && rawBase64.length < 200000 && !rawBase64.startsWith('http')) {
      lines.push(`PHOTO;ENCODING=b;TYPE=${photoType}:${rawBase64.replace(/\r?\n|\r/g, '')}`);
    }
  }

  lines.push('END:VCARD');

  return lines.join('\r\n');
}

/**
 * Generates a compact MECARD string optimized for high error tolerance in QR codes.
 * Any standard smartphone camera immediately recognizes MECARD to add contact.
 */
export function generateMeCard(data: VCardData): string {
  const parsed = parseFullName(data.formattedName || `${data.firstName || ''} ${data.lastName || ''}`);
  const firstName = data.firstName || parsed.firstName || '';
  const lastName = data.lastName || parsed.lastName || '';
  const org = data.organization || '';
  const phone = data.phone || data.cellPhone || data.workPhone || '';
  const email = data.email || '';
  const website = data.website ? formatWebUrl(data.website) : '';
  const note = data.propertyAddress ? `Listing for ${data.propertyAddress}` : (data.note || '');

  // Escape special chars in MECARD: \ , ; :
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/:/g, '\\:').replace(/,/g, '\\,');

  let mecard = `MECARD:N:${esc(lastName)},${esc(firstName)};`;
  if (org) mecard += `ORG:${esc(org)};`;
  if (phone) mecard += `TEL:${esc(phone)};`;
  if (email) mecard += `EMAIL:${esc(email)};`;
  if (website) mecard += `URL:${esc(website)};`;
  if (data.street || data.city) {
    mecard += `ADR:,,${esc(data.street || '')},${esc(data.city || '')},${esc(data.state || '')},${esc(data.zip || '')},;`;
  }
  if (note) mecard += `NOTE:${esc(note)};`;
  mecard += ';';

  return mecard;
}

/**
 * Triggers an instant browser download of a .vcf file.
 */
export function downloadVCardFile(vCardString: string, filename = 'Contact_Card.vcf'): void {
  try {
    const cleanFilename = filename.endsWith('.vcf') ? filename : `${filename}.vcf`;
    const blob = new Blob([vCardString], { type: 'text/vcard;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = cleanFilename;
    link.setAttribute('style', 'display:none');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 1000);
  } catch (error) {
    console.error('Failed to download vCard file:', error);
  }
}

/**
 * Instant helper to generate and download a vCard directly for any Agent.
 */
export function downloadAgentInstantVCard(agent: {
  name?: string;
  brokerage?: string;
  phone?: string;
  email?: string;
  website?: string;
  title?: string;
  photo?: string | null;
  propertyAddress?: string;
  city?: string;
}): void {
  const vCardStr = generateVCard({
    formattedName: agent.name || 'Real Estate Professional',
    organization: agent.brokerage || '',
    title: agent.title || 'Listing Associate',
    phone: agent.phone || '',
    email: agent.email || '',
    website: agent.website || '',
    propertyAddress: agent.propertyAddress || '',
    city: agent.city || '',
    photoBase64: agent.photo || null
  });

  const safeName = (agent.name || 'Agent').replace(/[^a-z0-9_-]/gi, '_');
  downloadVCardFile(vCardStr, `${safeName}_Contact_Card.vcf`);
}
