import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { generateVCard, generateMeCard, downloadVCardFile, VCardData } from '../utils/vCardUtils';

const toHex = (c: number) => {
    const hex = Math.min(255, Math.max(0, Math.round(c))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
};

const normalizeColorToHex = (colorStr: string): string => {
    if (!colorStr) return '#000000';
    const trimmed = colorStr.trim();
    
    // Check #rgb, #rrggbb, #rrggbbaa
    if (/^#([0-9a-fA-F]{3})$/.test(trimmed)) {
        const [, hex] = trimmed.match(/^#([0-9a-fA-F]{3})$/)!;
        return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
    }
    if (/^#([0-9a-fA-F]{6})$/.test(trimmed)) {
        return trimmed;
    }
    if (/^#([0-9a-fA-F]{8})$/.test(trimmed)) {
        return trimmed.substring(0, 7);
    }
    
    // Check rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = trimmed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgbMatch) {
        const r = parseInt(rgbMatch[1], 10);
        const g = parseInt(rgbMatch[2], 10);
        const b = parseInt(rgbMatch[3], 10);
        return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    // Canvas fallback for named colors or other formats
    try {
        if (typeof document !== 'undefined') {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.fillStyle = trimmed;
                const computed = ctx.fillStyle;
                if (computed.startsWith('#')) {
                    return normalizeColorToHex(computed);
                }
                const compRgbMatch = computed.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
                if (compRgbMatch) {
                    const r = parseInt(compRgbMatch[1], 10);
                    const g = parseInt(compRgbMatch[2], 10);
                    const b = parseInt(compRgbMatch[3], 10);
                    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
                }
            }
        }
    } catch (e) {
        // fallback
    }

    return '#000000';
};

interface QrCodeGeneratorProps {
    selectedData: any;
    brandingColor: string;
    logo: string | null;
}

export const QrCodeGenerator: React.FC<QrCodeGeneratorProps> = ({
    selectedData,
    brandingColor,
    logo
}) => {
    const [qrMode, setQrMode] = useState<'vcard' | 'website'>('vcard');
    const [qrText, setQrText] = useState('');
    const [qrColor, setQrColor] = useState('#000000');
    const [useBrandColor, setUseBrandColor] = useState(false);
    const [embedLogo, setEmbedLogo] = useState(true);
    const [copied, setCopied] = useState(false);
    const [copiedVCard, setCopiedVCard] = useState(false);
    const [downloadingVcf, setDownloadingVcf] = useState(false);
    const [formatStyle, setFormatStyle] = useState<'mecard' | 'vcard3'>('mecard');
    
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Helper to safely extract keys with synonyms
    const getField = (keys: string[]) => {
        if (!selectedData) return '';
        for (const k of keys) {
            const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (selectedData[normalized] !== undefined && selectedData[normalized] !== null) return String(selectedData[normalized]).trim();
            if (selectedData[k] !== undefined && selectedData[k] !== null) return String(selectedData[k]).trim();
        }
        return '';
    };

    // vCard contact state
    const [contactForm, setContactForm] = useState<VCardData>({
        formattedName: '',
        organization: '',
        title: 'Licensed Real Estate Professional',
        phone: '',
        email: '',
        website: '',
        street: '',
        city: '',
        state: '',
        zip: '',
        propertyAddress: '',
        note: ''
    });

    // Extract "single property website" from CSV row data
    const getSinglePropertyWebsiteUrl = () => {
        if (!selectedData) return '';
        const directKeys = [
            'single property website',
            'singlepropertywebsite',
            'single_property_website',
            'website',
            'url',
            'property_website',
            'property website',
            'link'
        ];
        for (const key of directKeys) {
            if (selectedData[key]) {
                const val = String(selectedData[key]).trim();
                if (val && (val.startsWith('http://') || val.startsWith('https://') || val.includes('.'))) {
                    return val;
                }
            }
        }
        // Scan all keys
        const keys = Object.keys(selectedData);
        for (const k of keys) {
            const lower = k.toLowerCase();
            if (lower.includes('single') && lower.includes('property') && lower.includes('website')) {
                const val = String(selectedData[k]).trim();
                if (val) return val;
            }
        }
        return '';
    };

    // Initialize/sync URL and Contact Data from selected property
    useEffect(() => {
        const url = getSinglePropertyWebsiteUrl();
        setQrText(url || 'https://www.pmddigitalmedia.com');

        const realtorName = getField(['realtor', 'agent', 'agentname', 'agent_name', 'realtorname', 'representative', 'name']);
        const brokerage = getField(['brokerage', 'company', 'brokeragename', 'brokerage_name', 'agency', 'office']);
        const phone = getField(['phonenumber', 'phone', 'cell', 'mobile', 'agentphone', 'realtorphone', 'agent_phone']);
        const email = getField(['email', 'agentemail', 'agent_email', 'realtoremail']);
        const website = getField(['website', 'agentwebsite', 'url', 'site']) || url;
        const address = getField(['address', 'propertyaddress', 'location']);
        const unit = getField(['unit', 'apt', 'suite']);
        const fullAddr = unit && address ? `${unit} - ${address}` : (address || '');
        const city = getField(['city', 'region', 'neighborhood']);

        setContactForm(prev => ({
            ...prev,
            formattedName: realtorName || prev.formattedName || 'Realtor Associate',
            organization: brokerage || prev.organization || 'Luxury Real Estate',
            phone: phone || prev.phone || '',
            email: email || prev.email || '',
            website: website || prev.website || '',
            propertyAddress: fullAddr || prev.propertyAddress || '',
            city: city || prev.city || '',
            note: fullAddr ? `Listing Associate for ${fullAddr}` : 'Real Estate Professional'
        }));
    }, [selectedData]);

    // Update color when brandingColor changes and useBrandColor is enabled
    useEffect(() => {
        if (useBrandColor) {
            setQrColor(normalizeColorToHex(brandingColor));
        } else {
            setQrColor('#000000');
        }
    }, [useBrandColor, brandingColor]);

    // Calculate string to encode depending on mode
    const encodedPayload = React.useMemo(() => {
        if (qrMode === 'website') {
            return qrText.trim() || 'https://www.pmddigitalmedia.com';
        }
        // Smart Instant vCard mode
        if (formatStyle === 'mecard') {
            return generateMeCard(contactForm);
        }
        return generateVCard(contactForm);
    }, [qrMode, qrText, contactForm, formatStyle]);

    // Draw the QR Code with high resolution and optional brand logo overlay
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        
        const size = 1024;
        canvas.width = size;
        canvas.height = size;

        const targetColor = normalizeColorToHex(qrColor);

        QRCode.toCanvas(
            canvas,
            encodedPayload,
            {
                width: size,
                margin: 4,
                color: {
                    dark: targetColor,
                    light: '#FFFFFF'
                },
                errorCorrectionLevel: 'H' // High error correction to allow logo embedding & phone camera readability
            },
            (error) => {
                if (canvas) {
                    canvas.style.setProperty('width', '100%', 'important');
                    canvas.style.setProperty('height', '100%', 'important');
                    canvas.style.setProperty('max-width', '100%', 'important');
                    canvas.style.setProperty('max-height', '100%', 'important');
                }

                if (error) {
                    console.error('QR Code Generation Error:', error);
                    return;
                }

                // If embedding logo and logo is available, draw it in the center
                if (embedLogo && logo) {
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return;

                    const logoImg = new Image();
                    logoImg.crossOrigin = 'anonymous';
                    logoImg.onload = () => {
                        const maxDimension = size * 0.22; // 22% of QR size
                        let dWidth = maxDimension;
                        let dHeight = maxDimension;

                        // Maintain aspect ratio of the logo image
                        const imgRatio = logoImg.width / logoImg.height;
                        if (imgRatio > 1) {
                            dHeight = maxDimension / imgRatio;
                        } else {
                            dWidth = maxDimension * imgRatio;
                        }

                        const x = (size - dWidth) / 2;
                        const y = (size - dHeight) / 2;

                        // Draw a white protective background circle (with safety padding)
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(size / 2, size / 2, maxDimension / 2 + 15, 0, Math.PI * 2);
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fill();
                        
                        // Circle border matching the brand color
                        ctx.strokeStyle = targetColor;
                        ctx.lineWidth = 6;
                        ctx.stroke();
                        ctx.restore();

                        // Draw logo image centered inside the protective background
                        ctx.save();
                        ctx.drawImage(logoImg, x, y, dWidth, dHeight);
                        ctx.restore();
                    };
                    logoImg.src = logo;
                }
            }
        );
    }, [encodedPayload, qrColor, embedLogo, logo]);

    const handleDownloadPng = () => {
        if (!canvasRef.current) return;
        const link = document.createElement('a');
        const agentOrAddress = qrMode === 'vcard'
            ? (contactForm.formattedName ? contactForm.formattedName.replace(/[^a-z0-9]/gi, '_') : 'Contact')
            : (selectedData?.address ? selectedData.address.replace(/[^a-z0-9]/gi, '_') : 'Property');
        
        const prefix = qrMode === 'vcard' ? 'Contact_vCard_QR' : 'Property_Website_QR';
        link.download = `${prefix}_${agentOrAddress}.png`;
        link.href = canvasRef.current.toDataURL('image/png', 1.0);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const handleDownloadVcf = () => {
        setDownloadingVcf(true);
        try {
            const vCardStr = generateVCard(contactForm);
            const safeName = (contactForm.formattedName || 'Agent').replace(/[^a-z0-9_-]/gi, '_');
            downloadVCardFile(vCardStr, `${safeName}_Contact_Card.vcf`);
        } catch (e) {
            console.error(e);
        } finally {
            setTimeout(() => setDownloadingVcf(false), 800);
        }
    };

    const handleCopyUrl = () => {
        if (!qrText) return;
        navigator.clipboard.writeText(qrText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyVCardText = () => {
        const vcfText = generateVCard(contactForm);
        navigator.clipboard.writeText(vcfText);
        setCopiedVCard(true);
        setTimeout(() => setCopiedVCard(false), 2000);
    };

    const displayAddress = selectedData?.unit 
        ? `${selectedData.unit} - ${selectedData.address || 'Selected Listing'}` 
        : (selectedData?.address || 'Selected Listing');

    return (
        <div className="glass-panel p-6 md:p-8 rounded-[2.5rem] border border-white/10 space-y-8 animate-fade-in-up">
            {/* Header with Mode Switcher */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center shadow-lg shadow-orange-950/40 text-white">
                            {qrMode === 'vcard' ? (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                </svg>
                            ) : (
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 0 0 8.716-6.747M12 21a9.004 9.004 0 0 1-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 0 1 7.843 4.582M12 3a8.997 8.997 0 0 0-7.843 4.582m15.686 0A11.953 11.953 0 0 1 12 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0 1 21 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0 1 12 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 0 1 3 12c0-1.605.42-3.113 1.157-4.418" />
                                </svg>
                            )}
                        </div>
                        <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                            {qrMode === 'vcard' ? 'Smart Instant vCard & Contact Kit' : 'Property Website QR Kit'}
                        </h3>
                    </div>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        {qrMode === 'vcard' 
                            ? 'Instant phone-scannable digital business card and downloadable .vcf contact card' 
                            : 'Generate high-resolution print QR codes directing clients to single property websites'}
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Mode Toggle Switch */}
                    <div className="flex bg-slate-950 p-1 rounded-2xl border border-white/10 shadow-inner">
                        <button
                            onClick={() => setQrMode('vcard')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                qrMode === 'vcard'
                                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-950/40'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                        >
                            <span>📇</span> Smart Instant vCard
                        </button>
                        <button
                            onClick={() => setQrMode('website')}
                            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 cursor-pointer ${
                                qrMode === 'website'
                                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-lg shadow-orange-950/40'
                                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                            }`}
                        >
                            <span>🌐</span> Website URL
                        </button>
                    </div>

                    {displayAddress && (
                        <div className="hidden sm:flex px-4 py-2 bg-slate-900 rounded-xl border border-white/5 flex-col items-end">
                            <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest leading-none">Active Listing</span>
                            <span className="text-xs font-bold text-white mt-1 truncate max-w-[200px]">{displayAddress}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
                {/* QR Code & Direct Actions Column */}
                <div className="md:col-span-5 flex flex-col items-center gap-4">
                    <div className="p-6 bg-white rounded-3xl shadow-2xl w-full max-w-[300px] aspect-square flex items-center justify-center border border-white/10 relative group">
                        <canvas ref={canvasRef} className="w-full h-full object-contain" />
                        
                        <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity rounded-3xl flex flex-col items-center justify-center gap-2.5 p-4">
                            <button 
                                onClick={handleDownloadPng}
                                className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Download QR (PNG)
                            </button>
                            {qrMode === 'vcard' && (
                                <button 
                                    onClick={handleDownloadVcf}
                                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-bold uppercase tracking-widest text-[10px] shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                    </svg>
                                    Instant vCard (.vcf)
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="w-full max-w-[300px] flex flex-col gap-2">
                        {/* Instant vCard File Download Button */}
                        {qrMode === 'vcard' && (
                            <button
                                onClick={handleDownloadVcf}
                                disabled={downloadingVcf}
                                className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-2xl font-black uppercase tracking-wider text-xs shadow-xl shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                {downloadingVcf ? 'Downloading .vcf...' : 'Instant Download vCard (.vcf)'}
                            </button>
                        )}

                        <button
                            onClick={handleDownloadPng}
                            className="w-full py-3 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-2xl font-bold uppercase tracking-wider text-xs border border-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-orange-400">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                            </svg>
                            Download High-Res QR (PNG)
                        </button>
                    </div>

                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest text-center">
                        Crisp 1024 x 1024 Print Resolution • Camera Scannable
                    </span>
                </div>

                {/* Settings & Form Editor Column */}
                <div className="md:col-span-7 space-y-6">
                    {qrMode === 'vcard' ? (
                        /* Smart Instant vCard Configuration Fields */
                        <div className="space-y-4">
                            <div className="flex items-center justify-between pb-2 border-b border-white/5">
                                <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <span>📇</span> Digital Business Card Information
                                </span>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCopyVCardText}
                                        className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border border-white/5 cursor-pointer"
                                    >
                                        {copiedVCard ? 'Copied .vcf ✓' : 'Copy vCard Text'}
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                        Realtor / Agent Name
                                    </label>
                                    <input 
                                        type="text"
                                        value={contactForm.formattedName || ''}
                                        onChange={(e) => setContactForm({ ...contactForm, formattedName: e.target.value })}
                                        placeholder="e.g. Jane Doe"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                        Brokerage / Agency
                                    </label>
                                    <input 
                                        type="text"
                                        value={contactForm.organization || ''}
                                        onChange={(e) => setContactForm({ ...contactForm, organization: e.target.value })}
                                        placeholder="e.g. PMD Luxury Realty"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                        Mobile / Direct Phone
                                    </label>
                                    <input 
                                        type="tel"
                                        value={contactForm.phone || ''}
                                        onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                                        placeholder="e.g. (310) 555-0199"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                        Email Address
                                    </label>
                                    <input 
                                        type="email"
                                        value={contactForm.email || ''}
                                        onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                                        placeholder="e.g. jane@pmdmedia.com"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                                    />
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                        Website / Portfolio URL
                                    </label>
                                    <input 
                                        type="text"
                                        value={contactForm.website || ''}
                                        onChange={(e) => setContactForm({ ...contactForm, website: e.target.value })}
                                        placeholder="e.g. https://www.pmddigitalmedia.com"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                                    />
                                </div>

                                <div className="space-y-1 sm:col-span-2">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                        Property Listing Address / Note (Appears in Contact Card)
                                    </label>
                                    <input 
                                        type="text"
                                        value={contactForm.propertyAddress || ''}
                                        onChange={(e) => setContactForm({ ...contactForm, propertyAddress: e.target.value, note: `Listing Associate for ${e.target.value}` })}
                                        placeholder="e.g. 123 Ocean Boulevard, Malibu, CA"
                                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-orange-500 transition-all"
                                    />
                                </div>
                            </div>

                            {/* Camera QR Optimization Mode */}
                            <div className="p-3.5 bg-slate-950/70 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="space-y-0.5">
                                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">QR Compatibility Format</span>
                                    <p className="text-[8px] text-slate-500">MeCard enables 1-tap save directly on iPhone &amp; Android camera app</p>
                                </div>
                                <div className="flex bg-slate-900 p-0.5 rounded-xl border border-white/5 shrink-0">
                                    <button 
                                        onClick={() => setFormatStyle('mecard')} 
                                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${formatStyle === 'mecard' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Camera MeCard
                                    </button>
                                    <button 
                                        onClick={() => setFormatStyle('vcard3')} 
                                        className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${formatStyle === 'vcard3' ? 'bg-orange-500 text-white shadow' : 'text-slate-400 hover:text-white'}`}
                                    >
                                        Full vCard 3.0
                                    </button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* Destination Website URL Mode */
                        <div className="space-y-2">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
                                Target Single Property Website URL
                            </label>
                            <div className="flex gap-2">
                                <input 
                                    type="text"
                                    value={qrText}
                                    onChange={(e) => setQrText(e.target.value)}
                                    placeholder="e.g. https://123mainst.com"
                                    className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                                />
                                <button
                                    onClick={handleCopyUrl}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border border-white/5 active:scale-95 flex items-center gap-1 cursor-pointer"
                                    title="Copy Website Link"
                                >
                                    {copied ? 'Copied ✓' : 'Copy'}
                                </button>
                            </div>
                            {!getSinglePropertyWebsiteUrl() && (
                                <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                    <p className="text-[8px] text-amber-500 font-bold uppercase tracking-wider leading-relaxed">
                                        ⚠️ "Single Property Website" column not found in selected property, using default. Customize it above!
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* QR Code Styling & Branding Options */}
                    <div className="space-y-4 pt-4 border-t border-white/5">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                            Styling &amp; Luxury Branding
                        </h4>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {/* Color Selector */}
                            <div className="space-y-3 p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Custom Brand Accent
                                    </span>
                                    <input 
                                        type="checkbox"
                                        checked={useBrandColor}
                                        onChange={(e) => setUseBrandColor(e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-orange-500 focus:ring-orange-500 cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    <div 
                                        className="w-8 h-8 rounded-lg border border-white/10" 
                                        style={{ backgroundColor: qrColor }} 
                                    />
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-white uppercase tracking-wider">
                                            {useBrandColor ? 'Branded Accent' : 'Standard High-Contrast'}
                                        </span>
                                        <span className="text-[8px] font-semibold text-slate-500 font-mono">
                                            {qrColor}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Logo Overlay */}
                            <div className="space-y-3 p-4 bg-slate-900/60 rounded-2xl border border-white/5">
                                <div className="flex items-center justify-between">
                                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                                        Embed Brand Shield Logo
                                    </span>
                                    <input 
                                        type="checkbox"
                                        checked={embedLogo}
                                        disabled={!logo}
                                        onChange={(e) => setEmbedLogo(e.target.checked)}
                                        className="w-4 h-4 rounded bg-slate-950 border-slate-800 text-orange-500 focus:ring-orange-500 disabled:opacity-30 cursor-pointer"
                                    />
                                </div>
                                <div className="flex items-center gap-3">
                                    {logo ? (
                                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-white/10 bg-white p-0.5">
                                            <img src={logo} className="w-full h-full object-contain" alt="Brand" />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-lg border border-dashed border-white/10 flex items-center justify-center text-slate-600 text-[8px] font-bold">
                                            None
                                        </div>
                                    )}
                                    <div className="flex flex-col">
                                        <span className="text-[9px] font-black text-white uppercase tracking-wider">
                                            {logo ? 'Logo Shield Embedded' : 'No Logo Uploaded'}
                                        </span>
                                        <span className="text-[8px] font-semibold text-slate-500">
                                            {logo ? 'Error-correction protective shield active' : 'Upload logo in Step 1 to embed'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Dual Action Download Area */}
                    <div className="pt-4 border-t border-white/5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {qrMode === 'vcard' ? (
                            <>
                                <button
                                    onClick={handleDownloadVcf}
                                    disabled={downloadingVcf}
                                    className="py-4 px-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-emerald-950/30 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
                                    </svg>
                                    Instant vCard (.vcf)
                                </button>
                                <button
                                    onClick={handleDownloadPng}
                                    className="py-4 px-4 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-orange-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                    </svg>
                                    Print QR PNG
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleDownloadPng}
                                className="sm:col-span-2 py-4 bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:scale-[1.01] active:scale-95 rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl shadow-orange-950/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                                </svg>
                                Download Print-Ready PNG
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
