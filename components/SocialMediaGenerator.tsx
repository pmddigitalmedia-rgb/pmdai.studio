
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import JSZip from 'jszip';
import { 
    parseCSV, 
    extractColorFromImage, 
    getContrastColor, 
    toRgba, 
    darkenColor,
    LISTED_VARIANTS,
    SOLD_VARIANTS,
    BLANK_VARIANTS,
    BED_ICON_SVG,
    BATH_ICON_SVG
} from '../services/socialMediaUtils';
import { SocialAssets } from '../types';
import { GoogleEarthEditor } from './GoogleEarthEditor';
import { QrCodeGenerator } from './QrCodeGenerator';
import { assetStore } from '../utils/persistence';

/**
 * PASTE YOUR DEPLOYED GOOGLE APPS SCRIPT URL HERE
 */
const PERMANENT_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzRFV8hkoi2FOmPgd7kXcs6OJaZAwdYP1RVj2DTPQffK9bNOm8BqngUIBpkLjnWPkNs/exec"; 

const UPDATED_LISTED_VARIANTS = LISTED_VARIANTS.includes('sunny-skies') ? LISTED_VARIANTS : ['sunny-skies', ...LISTED_VARIANTS];

const PROFESSIONAL_AUDIO_LIBRARY = [
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

const drawRoundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
    const safeR = Math.max(0, r);
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

const easeOutBack = (t: number) => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    const p = Math.max(0, Math.min(1, t));
    return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
};

const easeInOutCubic = (t: number) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};

const fastSlowFast = (t: number) => {
    return -(Math.cos(Math.PI * t) - 1) / 2;
};

const cinematicRamp = (t: number) => {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
};

const snapRamp = (t: number) => {
    return Math.sin((t * Math.PI) / 2);
};

const whipRamp = (t: number) => {
    // Starts slow, snaps extremely fast in middle, settles slowly
    return t < 0.5 
        ? Math.pow(t * 2, 4) / 2 
        : 1 - Math.pow((1 - t) * 2, 4) / 2;
};

const elasticRamp = (t: number) => {
    const c4 = (2 * Math.PI) / 3;
    return t === 0 ? 0 : t === 1 ? 1 : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
};

const DragDropUploader: React.FC<{
    label: string;
    onFiles: (files: File[]) => void;
    onRemove?: () => void;
    accept?: string;
    preview?: string | null;
    active?: boolean;
    small?: boolean;
    multiple?: boolean;
    subLabel?: string;
}> = ({ label, onFiles, onRemove, accept, preview, active, small, multiple = false, subLabel }) => {
    const [isDragging, setIsDragging] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const handleDrag = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        if (e.type === "dragenter" || e.type === "dragover") setIsDragging(true);
        else if (e.type === "dragleave") setIsDragging(false);
    };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault(); e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onFiles(Array.from(e.dataTransfer.files));
        }
    };
    return (
        <div className={`relative group border-2 border-dashed rounded-xl transition-all flex flex-col items-center justify-center text-center p-3 cursor-pointer overflow-hidden ${isDragging ? 'border-orange-500 bg-orange-500/10' : 'border-slate-800 hover:border-slate-700 bg-slate-900/50'} ${small ? 'h-32' : 'h-48'}`} onDragEnter={handleDrag} onDragLeave={handleDrag} onDragOver={handleDrag} onDrop={handleDrop} onClick={() => inputRef.current?.click()}>
            <input type="file" ref={inputRef} className="hidden" accept={accept} multiple={multiple} onChange={(e) => e.target.files && onFiles(Array.from(e.target.files))} />
            {preview ? <div className="absolute inset-0 group-hover:opacity-40 transition-opacity"><img src={preview} alt="Preview" className="w-full h-full object-cover" /></div> : null}
            
            {preview && onRemove && (
                <div className="absolute inset-0 bg-red-600/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-20">
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemove(); }}
                        className="p-2 bg-white text-red-600 rounded-full shadow-xl transform scale-75 group-hover:scale-100 transition-all active:scale-90"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>
            )}

            <div className={`relative z-10 flex flex-col items-center gap-2 ${preview ? 'opacity-0 group-hover:opacity-100' : ''}`}><div className={`p-2 rounded-lg ${active ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-500'}`}>{active ? ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg> )}</div><div className="flex flex-col gap-0.5"><span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">{label}</span>{subLabel && <span className="text-[7px] font-black text-slate-600 uppercase tracking-tighter">{subLabel}</span>}</div></div>
        </div>
    );
};

const drawRealEstateTemplate = (ctx: CanvasRenderingContext2D, width: number, height: number, template: string, mode: string, data: any, assets: { propImgs: HTMLImageElement[], headshot: HTMLImageElement | null, logo: HTMLImageElement | null, headshot2?: HTMLImageElement | null, logo2?: HTMLImageElement | null, stats?: any }, primaryColor: string) => {
    const { headshot: headshotImg, logo: logoImg, propImgs } = assets;
    const headshot2Img = (assets as any).headshot2 || (assets as any).agent2Headshot;
    const logo2Img = (assets as any).logo2 || (assets as any).agent2Logo;
    const accent = primaryColor;
    const isBlank = mode.toUpperCase().includes('BLANK');
    const isSold = mode.toUpperCase().includes('SOLD');
    const FOOTER_HEIGHT = 160;
    const HEADING = isBlank ? '' : mode.toUpperCase(); 
    const GAP = 20;
    const RADIUS = 30;
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
    
    // Unified Spec Extraction with Alias Support
    const bedVal = String(data.bed || data.beds || data.bedroom || data.bedrooms || '');
    const bathVal = String(data.bath || data.baths || data.bathroom || data.bathrooms || '');
    const sqftVal = String(data.totallivingareasqft || data.sqft || data.squarefeet || data.sq_ft || '');
    
    const specs = [ 
      bedVal ? `${bedVal} Bed` : '', 
      bathVal ? `${bathVal} Bath` : '', 
      sqftVal ? `${sqftVal} SqFt` : '' 
    ].filter(Boolean).join('  •  ');
    
    const drawTextFit = (text: string, x: number, y: number, maxWidth: number, initialSize: number, weight: string, align: CanvasTextAlign, color: string, shadow = true) => {
        if (!text) return; 
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
        if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; } 
        ctx.fillStyle = color; 
        ctx.fillText(cleanText, x, y); 
        ctx.restore();
    };

    const drawImg = (img: HTMLImageElement | undefined, dx: number, dy: number, dw: number, dh: number, radius = RADIUS) => {
        if (!img) return; let scale = Math.max(dw / img.width, dh / img.height); const ix = (dw - img.width * scale) / 2; const iy = (dh - img.height * scale) / 2;
        ctx.save(); if (radius > 0) { drawRoundedRect(ctx, dx, dy, dw, dh, radius); ctx.clip(); } ctx.drawImage(img, dx + ix, dy + iy, img.width * scale, img.height * scale); ctx.restore();
    };

    const drawIdentityFooter = (bgColor: string, textColor: string, yPos: number, h: number) => {
        ctx.save(); 
        ctx.fillStyle = bgColor; 
        ctx.fillRect(0, yPos, width, h); 
        const padding = 40; 
        const hsSize = 120; 
        const hsY = yPos + h/2; 
        const hsX = width - padding - hsSize/2;
        
        const combineVal = (v1: string, v2: string, sep = ' | ') => {
            const s1 = (v1 || '').trim();
            const s2 = (v2 || '').trim();
            if (s1 && s2 && s1 !== s2) return `${s1}${sep}${s2}`;
            return s1 || s2 || '';
        };

        const realtor = String(data.realtor || data.agent || data.agentname || data.agent_name || data.realtorname || data.realtor_name || data.listingagent || data.agent1 || data.realtor1 || ""); 
        const brokerage = String(data.brokerage || data.company || data.brokeragename || data.brokerage_name || data.office || data.companyname || ""); 
        const email = String(data.email || data.agentemail || data.agent_email || data.realtoremail || data.email1 || data.agent1email || data.agent1_email || ""); 
        const phone = String(data.phonenumber || data.phone || data.agentphone || data.agentphonenumber || data.agent_phone || data.realtorphone || data.phone1 || data.agent1phone || data.agent1_phone || ""); 
        const website = String(data.website || data.url || data.agentwebsite || data.site || "");

        const realtor2 = String(data.agent2 || data.realtor2 || data.agent2name || data.agent2_name || data.realtor2name || data.realtor2_name || data.colistingagent || data.colistingrealtor || data.coagent || data.coagentname || data.coagent_name || data.agent2Name || (assets as any).agent2Name || "");
        const brokerage2 = String(data.agent2brokerage || data.agent2_brokerage || data.brokerage2 || data.brokerage_2 || data.company2 || data.company_2 || data.coagentbrokerage || data.colistingbrokerage || data.agent2Brokerage || (assets as any).agent2Brokerage || "");
        const email2 = String(data.agent2email || data.agent2_email || data.email2 || data.email_2 || data.realtor2email || data.coagentemail || data.colistingemail || data.agent2Email || (assets as any).agent2Email || "");
        const phone2 = String(data.agent2phone || data.agent2phonenumber || data.agent2_phone || data.agent2_phonenumber || data.phone2 || data.phonenumber2 || data.phone_2 || data.realtor2phone || data.coagentphone || data.colistingphone || data.agent2PhoneNumber || (assets as any).agent2PhoneNumber || "");

        const hasAgent2 = Boolean(realtor2 || headshot2Img || phone2 || email2 || logo2Img);

        if (hasAgent2 && headshot2Img && headshotImg) {
            const hs1X = width - padding - hsSize * 0.9;
            const hs2X = width - padding - hsSize * 0.35;
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(hs1X, hsY, Math.max(0, hsSize/2), 0, Math.PI * 2);
            ctx.clip();
            let scale1 = Math.max(hsSize / headshotImg.width, hsSize / headshotImg.height);
            ctx.drawImage(headshotImg, hs1X - (headshotImg.width * scale1)/2, hsY - (headshotImg.height * scale1)/2, headshotImg.width * scale1, headshotImg.height * scale1);
            ctx.restore();

            ctx.beginPath();
            ctx.arc(hs2X, hsY, Math.max(0, hsSize/2 + 2), 0, Math.PI * 2);
            ctx.fillStyle = bgColor;
            ctx.fill();

            ctx.save();
            ctx.beginPath();
            ctx.arc(hs2X, hsY, Math.max(0, hsSize/2), 0, Math.PI * 2);
            ctx.clip();
            let scale2 = Math.max(hsSize / headshot2Img.width, hsSize / headshot2Img.height);
            ctx.drawImage(headshot2Img, hs2X - (headshot2Img.width * scale2)/2, hsY - (headshot2Img.height * scale2)/2, headshot2Img.width * scale2, headshot2Img.height * scale2);
            ctx.restore();
        } else if (headshotImg) { 
            ctx.save(); 
            ctx.beginPath(); 
            ctx.arc(hsX, hsY, Math.max(0, hsSize/2), 0, Math.PI * 2); 
            ctx.clip(); 
            const scale = Math.max(hsSize / headshotImg.width, hsSize / headshotImg.height); 
            ctx.drawImage(headshotImg, hsX - (headshotImg.width * scale)/2, hsY - (headshotImg.height * scale)/2, headshotImg.width * scale, headshotImg.height * scale); 
            ctx.restore(); 
        } else if (headshot2Img) {
            ctx.save(); 
            ctx.beginPath(); 
            ctx.arc(hsX, hsY, Math.max(0, hsSize/2), 0, Math.PI * 2); 
            ctx.clip(); 
            const scale = Math.max(hsSize / headshot2Img.width, hsSize / headshot2Img.height); 
            ctx.drawImage(headshot2Img, hsX - (headshot2Img.width * scale)/2, hsY - (headshot2Img.height * scale)/2, headshot2Img.width * scale, headshot2Img.height * scale); 
            ctx.restore();
        }
        
        let logoW = 0;
        if (logoImg && logo2Img) {
            logoW = 220;
            let logoScale1 = 100 / logoImg.width;
            let logoH1 = Math.min(h - 40, logoImg.height * logoScale1);
            let logoScale2 = 100 / logo2Img.width;
            let logoH2 = Math.min(h - 40, logo2Img.height * logoScale2);
            
            ctx.drawImage(logoImg, padding, yPos + (h - logoH1) / 2, 100, logoH1);
            ctx.drawImage(logo2Img, padding + 110, yPos + (h - logoH2) / 2, 100, logoH2);
        } else if (logoImg || logo2Img) { 
            const activeLogo = logoImg || logo2Img!;
            logoW = 180; 
            let logoScale = logoW / activeLogo.width;
            let logoH = activeLogo.height * logoScale;
            const maxLogoH = h - 40;
            if (logoH > maxLogoH) {
                logoH = maxLogoH;
                logoScale = logoH / activeLogo.height;
                logoW = activeLogo.width * logoScale;
            }
            const logoY = yPos + (h - logoH) / 2;
            ctx.drawImage(activeLogo, padding, logoY, logoW, logoH); 
        }
        
        const reservedLogoW = logoW > 0 ? logoW : 180;
        const totalHsWidth = (hasAgent2 && headshot2Img && headshotImg) ? hsSize * 1.5 : hsSize;
        const contactX = Math.max(220, padding + reservedLogoW + 20); 
        const contactW = width - contactX - totalHsWidth - padding - 15;
        
        const combinedNames = combineVal(realtor, realtor2, ' & ');
        const combinedBrokerage = combineVal(brokerage, brokerage2, ' | ');
        const combinedPhones = combineVal(phone, phone2, ' | ');
        const combinedEmails = combineVal(email, email2, ' | ');

        let textY = yPos + 30;
        if (combinedNames) {
            drawTextFit(combinedNames, contactX, textY, contactW, (realtor2 || headshot2Img) ? 21 : 25, '800', 'left', textColor, false); 
            textY += 25;
        }
        if (combinedBrokerage) {
            drawTextFit(combinedBrokerage, contactX, textY, contactW, 15, '600', 'left', toRgba(textColor, 0.7), false); 
            textY += 22;
        }
        if (combinedPhones) {
            drawTextFit(combinedPhones, contactX, textY, contactW, 15, '500', 'left', textColor, false); 
            textY += 22;
        }
        if (combinedEmails) {
            drawTextFit(combinedEmails, contactX, textY, contactW, 13, '500', 'left', textColor, false); 
            textY += 20;
        }
        if (website) {
            drawTextFit(website, contactX, textY, contactW, 14, 'bold', 'left', accent, false);
        }
        ctx.restore();
    };

    const p1 = propImgs[0]; const p2 = propImgs[1] || propImgs[0]; const p3 = propImgs[2] || propImgs[1] || propImgs[0];
    const displayAddress = data.unit ? `${data.unit} - ${data.address || 'Premium Property'}` : (data.address || 'Premium Property');
    const stateVal = data.state || data.province || '';
    const zipVal = data.zip || data.zipcode || data.postalcode || '';
    const cityStateZip = [data.city, stateVal, zipVal].filter(Boolean).join(', ');
    const fullAddress = `${displayAddress}${cityStateZip ? `, ${cityStateZip}` : ''}`;
    
    if (isSold || isBlank) {
        switch(template) {
            case 'sold-impact':
            case 'blank-gallery-focus':
                ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,width,height); drawImg(p1, GAP, GAP, width - GAP*2, height * 0.55, RADIUS); drawImg(p2, width - 240, height * 0.45, 200, 200, 100); if (!isBlank) { drawTextFit(HEADING, width/2, height * 0.7, width-100, 140, '900', 'center', accent); } drawTextFit(fullAddress, width/2, isBlank ? height * 0.73 : height * 0.8, width-100, isBlank ? 40 : 34, '700', 'center', '#fff', false); drawTextFit(specs, width/2, isBlank ? height * 0.80 : height * 0.84, width-100, isBlank ? 32 : 28, 'bold', 'center', accent, false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-minimal':
            case 'blank-minimalist-duo':
                ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,width,height); const smW = (width - GAP*3)/2; drawImg(p1, GAP, GAP, smW, height * 0.6, RADIUS); drawImg(p2, GAP*2 + smW, GAP, smW, height * 0.6, RADIUS); if (!isBlank) { drawTextFit(HEADING, 60, height * 0.74, width-120, 80, '900', 'left', '#000', false); } drawTextFit(fullAddress, 60, isBlank ? height * 0.74 : height * 0.8, width-120, isBlank ? 38 : 32, '600', 'left', accent, false); drawTextFit(specs, 60, isBlank ? height * 0.80 : height * 0.84, width-120, isBlank ? 30 : 26, 'bold', 'left', '#475569', false); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-elegant':
            case 'blank-architect-trio':
                ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); drawImg(p1, GAP*2, GAP*2, width-GAP*4, height - FOOTER_HEIGHT - GAP*4, RADIUS*2); drawImg(p2, GAP*3, GAP*3, 200, 200, 100); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(width/4, height/4, width/2, height/4); ctx.strokeStyle = accent; ctx.lineWidth = 10; ctx.strokeRect(width/4+15, height/4+15, width/2-30, height/4-30); if (!isBlank) { drawTextFit(HEADING, width/2, height/2-30, width/2-60, 100, '900', 'center', accent, false); } drawTextFit(fullAddress, width/2, isBlank ? height/2 : height/2+30, width/2-60, isBlank ? 38 : 32, '700', 'center', '#1e293b', false); drawTextFit(specs, width/2, isBlank ? height/2+45 : height/2+65, width/2-60, isBlank ? 32 : 28, 'bold', 'center', '#475569', false); drawIdentityFooter('#1e293b', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-bold':
            case 'blank-cinematic-wide':
                ctx.fillStyle = accent; ctx.fillRect(0,0,width,height); drawImg(p1, GAP, GAP, (width-GAP*3)*0.6, height*0.4, RADIUS); drawImg(p2, GAP*2 + (width-GAP*3)*0.6, GAP, (width-GAP*3)*0.4, height*0.4, RADIUS); if (!isBlank) { drawTextFit(HEADING, 60, height*0.6, width-120, 160, '900', 'left', '#fff'); } drawTextFit(fullAddress, 60, isBlank ? height*0.65 : height*0.75, width-120, isBlank ? 46 : 42, '700', 'left', '#fff', false); drawTextFit(specs, 60, isBlank ? height*0.73 : height*0.8, width-120, isBlank ? 36 : 32, 'bold', 'left', '#fff', false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-glass':
            case 'blank-editorial-spread':
                drawImg(p1, 0,0, width, height, 0); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(0,0,width,height); drawImg(p2, width-300, 50, 250, 250, RADIUS); ctx.fillStyle = 'rgba(255,255,255,0.2)'; drawRoundedRect(ctx, 50, height/2-150, width-100, 300, RADIUS); ctx.fill(); if (!isBlank) { drawTextFit(HEADING, width/2, height/2-30, width-200, 180, '900', 'center', '#fff'); } drawTextFit(fullAddress, width/2, isBlank ? height/2-10 : height/2+70, width-200, isBlank ? 44 : 38, '700', 'center', '#fff', false); drawTextFit(specs, width/2, isBlank ? height/2+45 : height/2+110, width-200, isBlank ? 36 : 32, 'bold', 'center', accent); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-ribbon':
            case 'blank-modern-split':
                drawImg(p1, 0,0, width/2, height - FOOTER_HEIGHT, 0); drawImg(p2, width/2, 0, width/2, height - FOOTER_HEIGHT, 0); if (!isBlank) { ctx.save(); ctx.translate(width-200, 150); ctx.rotate(Math.PI/4); ctx.fillStyle = accent; ctx.fillRect(-300,-40, 600, 80); drawTextFit("SOLD", 0, 15, 200, 45, '900', 'center', '#fff', false); ctx.restore(); } drawTextFit(fullAddress, width/2, height*0.8, width-100, 36, '700', 'center', '#fff'); drawTextFit(specs, width/2, height*0.85, width-100, 32, 'bold', 'center', '#fff'); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-badge':
            case 'blank-clean-grid':
                drawImg(p1, GAP, GAP, width-GAP*2, height-FOOTER_HEIGHT-GAP*2, RADIUS); drawImg(p2, GAP*2, height-FOOTER_HEIGHT-220, 200, 200, 100); if (!isBlank) { ctx.beginPath(); ctx.arc(width-180, 180, Math.max(0, 110), 0, Math.PI*2); ctx.fillStyle = accent; ctx.fill(); drawTextFit("SOLD", width-180, 200, 180, 60, '900', 'center', '#fff'); } drawTextFit(fullAddress, GAP*2 + 220, height-FOOTER_HEIGHT-140, width-450, 36, '700', 'left', accent); drawTextFit(specs, GAP*2 + 220, height-FOOTER_HEIGHT-100, width-450, 30, 'bold', 'left', '#fff'); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-outline':
            case 'blank-showcase-hero':
                drawImg(p1, GAP*2, GAP*2, width-GAP*4, height-FOOTER_HEIGHT-GAP*4, RADIUS); ctx.strokeStyle = '#fff'; ctx.lineWidth = 5; ctx.strokeRect(GAP*3, GAP*3, width-GAP*6, height-FOOTER_HEIGHT-GAP*6); if (!isBlank) { drawTextFit(HEADING, width/2, height/2-40, width-200, 120, '900', 'center', '#fff'); } drawTextFit(fullAddress, width/2, isBlank ? height/2-10 : height/2+40, width-200, isBlank ? 40 : 36, '700', 'center', '#fff', false); drawTextFit(specs, width/2, isBlank ? height/2+40 : height/2+80, width-200, isBlank ? 34 : 30, 'bold', 'center', accent); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-photo-focus':
            case 'blank-classic-frame':
                drawImg(p1, GAP, GAP, width-GAP*2, height*0.4, RADIUS); drawImg(p2, GAP, height*0.4+GAP*2, (width-GAP*3)/2, height*0.2, RADIUS); drawImg(p3, width/2+GAP/2, height*0.4+GAP*2, (width-GAP*3)/2, height*0.2, RADIUS); if (!isBlank) { drawTextFit(HEADING, width/2, height*0.68, width-100, 80, '900', 'center', '#000', false); } drawTextFit(fullAddress, width/2, isBlank ? height*0.70 : height*0.75, width-100, isBlank ? 36 : 32, '700', 'center', '#334155', false); drawTextFit(specs, width/2, isBlank ? height*0.76 : height*0.8, width-100, isBlank ? 30 : 28, 'bold', 'center', accent, false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sold-overlay':
            case 'blank-magazine-pure':
                drawImg(p1, 0,0, width, height, 0); drawImg(p2, 50, 50, 250, 250, 125); ctx.fillStyle = toRgba(accent, 0.5); ctx.fillRect(0,0,width,height); if (!isBlank) { drawTextFit(HEADING, width/2, height/2-50, width-200, 160, '900', 'center', '#fff'); } drawTextFit(fullAddress, width/2, isBlank ? height/2 : height/2+70, width-200, isBlank ? 46 : 42, '700', 'center', '#fff', false); drawTextFit(specs, width/2, isBlank ? height/2+60 : height/2+120, width-200, isBlank ? 38 : 36, 'bold', 'center', '#fff'); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            default: drawImg(p1, 0,0, width, height, 0); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,width,height); if (!isBlank) { drawTextFit(HEADING, width/2, height/2-40, width-200, 120, '900', 'center', '#fff'); } drawTextFit(fullAddress, width/2, isBlank ? height/2 : height/2+40, width-200, 40, '700', 'center', '#fff', false); drawTextFit(specs, width/2, isBlank ? height/2+50 : height/2+80, width-200, 32, 'bold', 'center', accent); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT);
        }
    } else {
        switch(template) {
            case 'sunny-skies': const sunnyGrad = ctx.createLinearGradient(0, 0, width, height); sunnyGrad.addColorStop(0, '#e0f2fe'); sunnyGrad.addColorStop(1, '#ffffff'); ctx.fillStyle = sunnyGrad; ctx.fillRect(0,0,width,height); ctx.fillStyle = 'rgba(251, 191, 36, 0.1)'; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(width, 0); ctx.lineTo(0, height*0.4); ctx.fill(); drawImg(p1, GAP*1.5, 140, width-GAP*3, (height-FOOTER_HEIGHT)*0.55, RADIUS); ctx.fillStyle = '#f59e0b'; drawRoundedRect(ctx, width-240, 80, 180, 180, 90); ctx.fill(); drawTextFit("NEW", width-150, 145, 120, 25, '900', 'center', '#fff', false); drawTextFit("LISTING", width-150, 185, 120, 25, '900', 'center', '#fff', false); drawTextFit(HEADING, GAP*2, 90, 450, 50, '900', 'left', '#0369a1', false); drawTextFit(fullAddress, GAP*2, height*0.72, width-GAP*4, 50, '800', 'left', accent, false); drawTextFit(specs, GAP*2, height*0.77, width-GAP*4, 36, 'bold', 'left', '#0369a1', false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'ultra-modern': ctx.fillStyle = '#0f172a'; ctx.fillRect(0,0,width,height); drawImg(p1, width*0.3, GAP, width*0.7-GAP, height*0.6, RADIUS); drawImg(p2, GAP, height*0.4, width*0.25, width*0.25, RADIUS); ctx.fillStyle = accent; ctx.fillRect(GAP, GAP, width*0.25, height*0.35); drawTextFit(HEADING, GAP+20, height*0.2, width*0.25, 60, '900', 'left', '#fff'); drawTextFit(fullAddress, GAP, height*0.75, width-GAP*2, 44, '700', 'left', '#fff', false); drawTextFit(specs, GAP, height*0.8, width-GAP*2, 30, '600', 'left', accent, false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'magazine-luxe': ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); drawImg(p1, GAP, GAP, (width-GAP*3)*0.6, height*0.55, RADIUS); drawImg(p2, (width-GAP*3)*0.6 + GAP*2, GAP, (width-GAP*3)*0.4, height*0.55, RADIUS); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.strokeRect(GAP*0.5, GAP*0.5, width-GAP, height-FOOTER_HEIGHT-GAP); drawTextFit(HEADING, width/2, height*0.68, width-100, 85, '300', 'center', '#000', false); drawTextFit(fullAddress, width/2, height*0.75, width-100, 34, '600', 'center', accent, false); drawTextFit(specs, width/2, height*0.79, width-100, 26, 'bold', 'center', '#64748b', false); drawIdentityFooter('#f8fafc', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'sidebar-neon': ctx.fillStyle = '#000'; ctx.fillRect(0,0,width,height); drawImg(p1, 100, GAP, width-120, (height-FOOTER_HEIGHT-GAP*3)*0.55, RADIUS); drawImg(p2, 100, (height-FOOTER_HEIGHT-GAP*3)*0.55 + GAP*2, width-120, (height-FOOTER_HEIGHT-GAP*3)*0.45, RADIUS); ctx.fillStyle = accent; ctx.fillRect(0,0,80,height-FOOTER_HEIGHT); ctx.save(); ctx.translate(50, (height-FOOTER_HEIGHT)/2); ctx.rotate(-Math.PI/2); drawTextFit(HEADING, 0, 0, height-FOOTER_HEIGHT-100, 50, '900', 'center', '#fff', false); ctx.restore(); drawTextFit(fullAddress, 120, height-FOOTER_HEIGHT-80, width-150, 38, '700', 'left', '#fff', false); drawTextFit(specs, 120, height-FOOTER_HEIGHT-45, width-150, 30, 'bold', 'left', accent, false); drawIdentityFooter('#111', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'diagonal-impact': ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); ctx.save(); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(width, 0); ctx.lineTo(0, height*0.5); ctx.clip(); drawImg(p1, 0,0, width, height*0.5, 0); ctx.restore(); ctx.save(); ctx.beginPath(); ctx.moveTo(width, height*0.5); ctx.lineTo(width, 0); ctx.lineTo(0, height*0.5); ctx.clip(); drawImg(p2, 0,0, width, height*0.5, 0); ctx.restore(); ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(0, height*0.5); ctx.lineTo(width, height*0.4); ctx.lineTo(width, height*0.45); ctx.lineTo(0, height*0.55); ctx.fill(); drawTextFit(HEADING, width/2, height*0.65, width-100, 100, '900', 'center', '#000'); drawTextFit(fullAddress, width/2, height*0.74, width-100, 38, '700', 'center', '#1e293b', false); drawTextFit(specs, width/2, height*0.79, width-100, 32, 'bold', 'center', accent, false); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'floating-card': ctx.fillStyle = '#f1f5f9'; ctx.fillRect(0,0,width,height); drawImg(p1, 60, 60, (width-140)/2, height*0.4, RADIUS); drawImg(p2, 80 + (width-140)/2, 60, (width-140)/2, height*0.4, RADIUS); ctx.save(); ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.fillStyle = '#fff'; drawRoundedRect(ctx, 100, height*0.4, width-200, 280, RADIUS); ctx.fill(); ctx.restore(); drawTextFit(HEADING, width/2, height*0.52, width-240, 65, '900', 'center', accent, false); drawTextFit(fullAddress, width/2, height*0.6, width-240, 32, '600', 'center', '#475569', false); drawTextFit(specs, width/2, height*0.66, width-240, 34, 'bold', 'center', accent, false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'editorial-grid': ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); const egW = (width - GAP*3)/2; drawImg(p1, GAP, GAP, egW, height*0.4, RADIUS); drawImg(p2, GAP*2+egW, GAP, egW, height*0.25, RADIUS); drawImg(p3, GAP*2+egW, GAP*2+height*0.25, egW, height*0.25, RADIUS); drawTextFit(HEADING, GAP, height*0.68, width-GAP*2, 70, '900', 'left', '#000', false); drawTextFit(fullAddress, GAP, height*0.75, width-GAP*2, 38, '700', 'left', '#334155', false); drawTextFit(specs, GAP, height*0.8, width-GAP*2, 30, 'bold', 'left', accent, false); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'minimalist-edge': ctx.fillStyle = '#fff'; ctx.fillRect(0,0,width,height); drawImg(p1, 100, 100, width-200, height*0.3, RADIUS*2); drawImg(p2, 100, height*0.3 + 120, width-200, height*0.2, RADIUS); ctx.strokeStyle = '#eee'; ctx.lineWidth = 1; ctx.strokeRect(50,50,width-100, height-FOOTER_HEIGHT-100); drawTextFit(HEADING, width/2, height*0.62, width-200, 60, '300', 'center', '#666', false); drawTextFit(fullAddress, width/2, height*0.68, width-200, 34, '700', 'center', '#1e293b', false); drawTextFit(specs, width/2, height*0.73, width-200, 28, '600', 'center', accent, false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'bold-typography': ctx.fillStyle = accent; ctx.fillRect(0,0,width,height); drawTextFit(HEADING, width/2, 160, width-100, 160, '900', 'center', '#fff'); drawTextFit(fullAddress, width/2, 220, width-100, 38, '700', 'center', '#fff', false); drawTextFit(specs, width/2, 260, width-100, 30, 'bold', 'center', '#fff', false); drawImg(p1, 100, 320, width-200, 200, RADIUS); drawImg(p2, 100, 540, width-200, 200, RADIUS); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'premium-wrap': ctx.fillStyle = accent; ctx.fillRect(0,0,width,height); drawImg(p1, GAP*2, GAP*2, (width-GAP*6)/2, height-FOOTER_HEIGHT-GAP*4, RADIUS); drawImg(p2, GAP*4 + (width-GAP*6)/2, GAP*2, (width-GAP*6)/2, height-FOOTER_HEIGHT-GAP*4, RADIUS); drawTextFit(HEADING, width/2, height/2-40, width-200, 120, '900', 'center', '#fff'); drawTextFit(fullAddress, width/2, height/2+40, width-200, 40, '700', 'center', '#fff', false); drawTextFit(specs, width/2, height/2+80, width-200, 32, 'bold', 'center', '#fff'); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'gradient-shift': const grad = ctx.createLinearGradient(0,0,width,height); grad.addColorStop(0, accent); grad.addColorStop(1, darkenColor(accent, 40)); ctx.fillStyle = grad; ctx.fillRect(0,0,width,height); drawImg(p1, GAP, GAP, (width-GAP*3)/2, height*0.5, RADIUS); drawImg(p2, GAP*2 + (width-GAP*3)/2, GAP, (width-GAP*3)/2, height*0.5, RADIUS); drawTextFit(HEADING, width/2, height*0.65, width-100, 100, '900', 'center', '#fff'); drawTextFit(fullAddress, width/2, height*0.74, width-100, 42, '700', 'center', '#fff', false); drawTextFit(specs, width/2, height*0.79, width-100, 34, 'bold', 'center', '#fff'); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'glass-footer': drawImg(p1, 0,0, width, height, 0); drawImg(p2, 40, 40, 300, 300, RADIUS); ctx.fillStyle = 'rgba(255,255,255,0.2)'; drawRoundedRect(ctx, 40, height-FOOTER_HEIGHT-180, width-80, 140, RADIUS); ctx.fill(); drawTextFit(HEADING, 80, height-FOOTER_HEIGHT-130, width-160, 60, '900', 'left', '#fff'); drawTextFit(fullAddress, 80, height-FOOTER_HEIGHT-90, width-160, 36, '700', 'left', '#fff', false); drawTextFit(specs, 80, height-FOOTER_HEIGHT-60, width-160, 30, 'bold', 'left', accent); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'architect-view': ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,width,height); drawImg(p1, GAP, GAP, width-GAP*2, height*0.35, RADIUS); drawImg(p2, GAP, height*0.35 + GAP*2, width-GAP*2, height*0.25, RADIUS); ctx.strokeStyle = toRgba(accent, 0.3); ctx.lineWidth = 1; for(let i=0; i<width; i+=50){ ctx.beginPath(); ctx.moveTo(i,0); ctx.lineTo(i,height-FOOTER_HEIGHT); ctx.stroke(); } drawTextFit(HEADING, 40, height*0.68, width-80, 80, '900', 'left', '#000', false); drawTextFit(fullAddress, 40, height*0.75, width-80, 40, '700', 'left', '#334155', false); drawTextFit(specs, 40, height*0.8, width-80, 32, 'bold', 'left', accent, false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'urban-loft': ctx.fillStyle = '#1e293b'; ctx.fillRect(0,0,width,height); drawImg(p1, GAP, GAP, width-GAP*2, height*0.5, RADIUS); drawImg(p2, width-250, height*0.5 + 20, 200, 200, 100); drawTextFit(HEADING, width/2, height*0.68, width-100, 110, '900', 'center', accent); drawTextFit(fullAddress, width/2, height*0.78, width-100, 42, '700', 'center', '#fff', false); drawTextFit(specs, width/2, height*0.83, width-100, 34, 'bold', 'center', '#94a3b8', false); drawIdentityFooter('#0f172a', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'heritage-classic': ctx.fillStyle = '#fdfbf7'; ctx.fillRect(0,0,width,height); drawImg(p1, 100, 100, width-200, height*0.3, RADIUS*2); drawImg(p2, width/2 - 100, height*0.3 + 120, 200, 200, 100); drawTextFit(HEADING, width/2, height*0.65, width-100, 70, '300', 'center', '#1a1a1a', false); drawTextFit(fullAddress, width/2, height*0.72, width-100, 36, '700', 'center', '#1a1a1a', false); drawTextFit(specs, width/2, height*0.77, width-100, 28, '600', 'center', accent, false); drawIdentityFooter('#1a1a1a', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'coast-minimal': ctx.fillStyle = '#f0f9ff'; ctx.fillRect(0,0,width,height); drawImg(p1, GAP, GAP, width-GAP*2, height*0.5, 1000); drawImg(p2, width/2 - 125, height*0.5 - 125, 250, 250, 125); drawTextFit(HEADING, width/2, height*0.72, width-100, 60, '900', 'center', '#0369a1', false); drawTextFit(fullAddress, width/2, height*0.78, width-100, 38, '700', 'center', '#0369a1', false); drawTextFit(specs, width/2, height*0.83, width-100, 30, 'bold', 'center', accent, false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'scandi-clean': ctx.fillStyle = '#fafafa'; ctx.fillRect(0,0,width,height); drawImg(p1, 150, 150, (width-350)/2, width-350, 1000); drawImg(p2, width/2 + 25, 150, (width-350)/2, width-350, 1000); drawTextFit(HEADING, width/2, height*0.68, width-100, 50, '300', 'center', '#333', false); drawTextFit(fullAddress, width/2, height*0.74, width-100, 34, '700', 'center', '#333', false); drawTextFit(specs, width/2, height*0.78, width-100, 26, '600', 'center', accent, false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'noir-luxury': ctx.fillStyle = '#000'; ctx.fillRect(0,0,width,height); drawImg(p1, GAP, GAP, width-GAP*2, height*0.4, RADIUS); drawImg(p2, width-250, 50, 200, 200, RADIUS); drawTextFit(HEADING, width/2, height*0.65, width-100, 120, '900', 'center', '#d4af37'); drawTextFit(fullAddress, width/2, height*0.75, width-100, 42, '700', 'center', '#fff'); drawTextFit(specs, width/2, height*0.8, width-100, 34, 'bold', 'center', '#d4af37'); drawIdentityFooter('#111', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'high-contrast': ctx.fillStyle = '#000'; ctx.fillRect(0,0,width,height); ctx.fillStyle = accent; ctx.fillRect(0, height*0.4, width, height*0.25); drawImg(p1, GAP, GAP, width-GAP*2, height*0.35, RADIUS); drawImg(p2, 50, height*0.4 + 20, 200, 200, RADIUS); drawTextFit(HEADING, width/2, height*0.5, width-100, 100, '900', 'center', '#fff'); drawTextFit(fullAddress, width/2, height*0.57, width-100, 40, '700', 'center', '#000', false); drawTextFit(specs, width/2, height*0.62, width-100, 32, 'bold', 'center', '#fff', false); drawIdentityFooter('#fff', '#000', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            case 'geometric-bold': ctx.fillStyle = '#f8fafc'; ctx.fillRect(0,0,width,height); ctx.save(); ctx.beginPath(); ctx.arc(width/3, height/3, Math.max(0, 250), 0, Math.PI * 2); ctx.clip(); drawImg(p1, width/3-250, height/3-250, 500, 500, 0); ctx.restore(); ctx.save(); ctx.beginPath(); ctx.arc(width*2/3, height/3, Math.max(0, 250), 0, Math.PI * 2); ctx.clip(); drawImg(p2, width*2/3-250, height/3-250, 500, 500, 0); ctx.restore(); drawTextFit(HEADING, width/2, height*0.68, width-100, 90, '900', 'center', accent, false); drawTextFit(fullAddress, width/2, height*0.75, width-100, 42, '700', 'center', '#334155', false); drawTextFit(specs, width/2, height*0.8, width-100, 34, 'bold', 'center', '#1e293b', false); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT); break;
            default: drawImg(p1, 0,0, width, height, 0); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0,0,width,height); drawTextFit(HEADING, width/2, height/2-40, width-200, 120, '900', 'center', '#fff'); drawTextFit(fullAddress, width/2, height/2+40, width-200, 40, '700', 'center', '#fff', false); drawTextFit(specs, width/2, height/2+80, width-200, 32, 'bold', 'center', accent); drawIdentityFooter('#000', '#fff', height - FOOTER_HEIGHT, FOOTER_HEIGHT);
        }
    }
};

type TransitionType = 'fade' | 'zoom' | 'pan' | 'slide' | 'whip' | 'blur';
type RampType = 'linear' | 'cinematic' | 'snap' | 'whip' | 'elastic';

const VideoGenerator: React.FC<any> = ({ images, data, assets, colors, mode, onVideoGenerated }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const progressFillRef = useRef<HTMLDivElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [isBatchRecording, setIsBatchRecording] = useState(false);
    const [lastGeneratedBlob, setLastGeneratedBlob] = useState<{ blob: Blob, ratio: string } | null>(null);
    const requestRef = useRef<number>(0);
    const startTimeRef = useRef<number>(0);
    const previewTimeRef = useRef<number>(0); 
    const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>('9:16');
    const [fadeDuration, setFadeDuration] = useState(0.8);
    const [panIntensity, setPanIntensity] = useState(0.4); 
    const [videoDurationSec, setVideoDurationSec] = useState(15);
    const [customAudio, setCustomAudio] = useState<{name: string, url: string} | null>(null);
    const [audioContext] = useState(() => new (window.AudioContext || (window as any).webkitAudioContext)());
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
    const [currentTrackIdx, setCurrentTrackIdx] = useState(0);
    const [isAudioLoading, setIsAudioLoading] = useState(false);
    const [audioError, setAudioError] = useState<string | null>(null);
    const [isCleanFeed, setIsCleanFeed] = useState(false);

    const analyserRef = useRef<AnalyserNode | null>(null);
    const freqDataRef = useRef<Uint8Array | null>(null);
    const timeDataRef = useRef<Uint8Array | null>(null);
    const [visualizerStyle, setVisualizerStyle] = useState<'bars' | 'waveform' | 'dots'>('bars');
    const [visualizerLuminosity, setVisualizerLuminosity] = useState(1.0);
    const [exportResolution, setExportResolution] = useState<'2k' | '1080p'>('2k');

    const INTRO_DURATION = 1800; const VIDEO_DURATION = videoDurationSec * 1000; const END_CARD_DURATION = 2500; const totalDuration = INTRO_DURATION + VIDEO_DURATION + END_CARD_DURATION; 

    useEffect(() => {
        const restoreReelState = async () => {
            const savedSettings = localStorage.getItem('pmd_reel_settings');
            if (savedSettings) {
                try {
                    const parsed = JSON.parse(savedSettings);
                    if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
                    if (parsed.fadeDuration) setFadeDuration(parsed.fadeDuration);
                    if (parsed.videoDurationSec) setVideoDurationSec(parsed.videoDurationSec);
                    if (parsed.visualizerStyle) setVisualizerStyle(parsed.visualizerStyle);
                    if (parsed.visualizerLuminosity !== undefined) setVisualizerLuminosity(parsed.visualizerLuminosity);
                    if (parsed.isCleanFeed !== undefined) setIsCleanFeed(parsed.isCleanFeed);
                    if (parsed.exportResolution) setExportResolution(parsed.exportResolution);
                } catch (e) { console.error("Failed to restore reel settings", e); }
            }
            try {
                const storedBlob = await assetStore.get('pmd_reel_audio_blob');
                if (storedBlob) {
                    const url = URL.createObjectURL(storedBlob);
                    setCustomAudio({ name: (storedBlob as any).name || 'Cached Audio', url });
                }
            } catch (e) { console.error("Failed to restore reel audio", e); }
        };
        restoreReelState();
    }, []);

    useEffect(() => {
        const settings = { aspectRatio, fadeDuration, videoDurationSec, visualizerStyle, visualizerLuminosity, isCleanFeed, exportResolution };
        localStorage.setItem('pmd_reel_settings', JSON.stringify(settings));
    }, [aspectRatio, fadeDuration, videoDurationSec, visualizerStyle, visualizerLuminosity, isCleanFeed, exportResolution]);

    const getDim = (ratio: '9:16' | '16:9' | '1:1', res: '2k' | '1080p' = exportResolution) => {
        if (res === '2k') {
            switch(ratio) {
                case '16:9': return { w: 2560, h: 1440, class: 'aspect-video max-w-[800px]' };
                case '1:1': return { w: 2048, h: 2048, class: 'aspect-square max-w-[500px]' };
                case '9:16': default: return { w: 1440, h: 2560, class: 'aspect-[9/16] max-w-[340px]' };
            }
        }
        switch(ratio) {
            case '16:9': return { w: 1920, h: 1080, class: 'aspect-video max-w-[800px]' };
            case '1:1': return { w: 1080, h: 1080, class: 'aspect-square max-w-[500px]' };
            case '9:16': default: return { w: 1080, h: 1920, class: 'aspect-[9/16] max-w-[340px]' };
        }
    };
    const dim = useMemo(() => getDim(aspectRatio, exportResolution), [aspectRatio, exportResolution]);
    const [loadedAssets, setLoadedAssets] = useState<{ propImgs: HTMLImageElement[], propMasks: (HTMLImageElement | null)[], headshot: HTMLImageElement | null, logo: HTMLImageElement | null, headshot2: HTMLImageElement | null, logo2: HTMLImageElement | null } | null>(null);

    const sceneSlots = useMemo(() => {
        if (!loadedAssets) return [];
        const imgs = [...loadedAssets.propImgs];
        const masks = [...loadedAssets.propMasks];
        const slots: {img: HTMLImageElement, mask: HTMLImageElement | null}[][] = [];
        let i = 0;
        while (i < imgs.length) {
            const pickTwo = Math.random() > 0.4 && (i + 1 < imgs.length);
            if (pickTwo) { 
                slots.push([
                    {img: imgs[i], mask: masks[i]}, 
                    {img: imgs[i + 1], mask: masks[i + 1]}
                ]); 
                i += 2; 
            } 
            else { 
                slots.push([{img: imgs[i], mask: masks[i]}]); 
                i += 1; 
            }
        }
        return slots;
    }, [loadedAssets]);

    const transitionData = useMemo(() => {
        const transTypes: TransitionType[] = ['fade', 'zoom', 'pan', 'slide', 'blur'];
        const rampTypes: RampType[] = ['linear', 'cinematic'];
        return Array.from({ length: sceneSlots.length }).map(() => ({
            transition: transTypes[Math.floor(Math.random() * transTypes.length)],
            ramp: rampTypes[Math.floor(Math.random() * rampTypes.length)]
        }));
    }, [sceneSlots.length]);

    const activeTrackUrl = customAudio ? customAudio.url : PROFESSIONAL_AUDIO_LIBRARY[currentTrackIdx].url;
    const activeTrackName = customAudio ? customAudio.name : PROFESSIONAL_AUDIO_LIBRARY[currentTrackIdx].name;

    useEffect(() => {
        const load = async () => {
            const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
                if (!src) return resolve(null);
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => {
                    const fallbackImg = new Image();
                    fallbackImg.onload = () => resolve(fallbackImg);
                    fallbackImg.onerror = () => resolve(null);
                    fallbackImg.src = src;
                };
                img.src = src;
            });
            try {
                const propImgsRaw = await Promise.all(images.map(src => loadImage(src)));
                const propImgs = propImgsRaw.filter((img): img is HTMLImageElement => img !== null);
                const propMasks = assets.propertyMasks ? await Promise.all(assets.propertyMasks.map(src => src ? loadImage(src) : Promise.resolve(null))) : [];
                
                const resolveImgSrc = (raw: any): string | null => {
                    if (!raw) return null;
                    const str = String(raw).trim();
                    if (!str) return null;
                    if (str.startsWith('http://') || str.startsWith('https://') || str.startsWith('data:') || str.startsWith('blob:')) {
                        return str;
                    }
                    if (assets.assetLibrary && assets.assetLibrary.length > 0) {
                        const found = assets.assetLibrary.find(a => a.name?.toLowerCase() === str.toLowerCase() || a.url?.includes(str));
                        if (found) return found.url;
                    }
                    return str;
                };

                const hs1Raw = assets.headshot || (assets as any).agentHeadshot || (assets as any).agent1Headshot || (assets as any).photo || data.headshot || data.agentheadshot || data.photo || data.agentphoto || data.agent_photo || data.agent1photo || data.agent1headshot || data.headshot1 || data.photo1;
                const lg1Raw = assets.logo || (assets as any).brokerageLogo || (assets as any).companyLogo || data.logo || data.brokeragelogo || data.agentlogo || data.companylogo || data.brokerage_logo;
                const hs1Src = resolveImgSrc(hs1Raw);
                const lg1Src = resolveImgSrc(lg1Raw);
                const headshot = hs1Src ? await loadImage(hs1Src) : null;
                const logo = lg1Src ? await loadImage(lg1Src) : null;
                const hs2Raw = assets.headshot2 || (assets as any).agent2Headshot || data.agent2Headshot || data.agent2photo || data.photo2 || data.headshot2 || data.agent2_headshot || data.coagentheadshot || data.colistingheadshot;
                const lg2Raw = assets.logo2 || (assets as any).agent2Logo || data.agent2Logo || data.agent2logo || data.logo2 || data.agent2_logo || data.coagentlogo || data.colistinglogo;
                const hs2Src = resolveImgSrc(hs2Raw);
                const lg2Src = resolveImgSrc(lg2Raw);
                const headshot2 = hs2Src ? await loadImage(hs2Src) : null;
                const logo2 = lg2Src ? await loadImage(lg2Src) : null;
                setLoadedAssets({ propImgs, propMasks: propMasks as any, headshot, logo, headshot2, logo2 });
            } catch (e) { console.error("Failed to load video assets", e); }
        };
        load();
    }, [images, assets.headshot, assets.logo, assets.headshot2, assets.logo2, assets.agent2Headshot, assets.agent2Logo, assets.agentHeadshot, assets.photo, assets.assetLibrary, assets.propertyMasks, data]);

    useEffect(() => {
        let active = true; const loadAudio = async () => { 
            setIsAudioLoading(true); setAudioError(null); 
            try { 
                const response = await fetch(activeTrackUrl); if (!response.ok) throw new Error(`HTTP ${response.status}`); const arrayBuffer = await response.arrayBuffer(); if (!active) return; const decoded = await audioContext.decodeAudioData(arrayBuffer); setAudioBuffer(decoded); 
            } catch (e) { if (active) { setAudioError("Audio Unavailable"); setAudioBuffer(null); } } finally { if (active) setIsAudioLoading(false); } 
        }; loadAudio(); return () => { active = false; };
    }, [activeTrackUrl, audioContext]);

    useEffect(() => { 
        if (isPlaying && audioBuffer) { 
            if (audioContext.state === 'suspended') audioContext.resume(); 
            if (activeSourceRef.current) { try { activeSourceRef.current.stop(); } catch(e) {} activeSourceRef.current = null; }
            const analyser = audioContext.createAnalyser(); analyser.fftSize = 256; freqDataRef.current = new Uint8Array(analyser.frequencyBinCount); timeDataRef.current = new Uint8Array(analyser.fftSize); analyserRef.current = analyser;
            const source = audioContext.createBufferSource(); source.buffer = audioBuffer; source.loop = true; source.connect(analyser); analyser.connect(audioContext.destination); const offset = Math.max(0, (previewTimeRef.current / 1000) % audioBuffer.duration); source.start(0, offset); activeSourceRef.current = source; 
            return () => { if (activeSourceRef.current) { try { activeSourceRef.current.stop(); } catch(e) {} activeSourceRef.current = null; } };
        } 
    }, [isPlaying, audioBuffer, audioContext]);

    const handleAudioSelection = (url: string, name: string) => { setCustomAudio({ name, url }); setIsPlaying(false); previewTimeRef.current = 0; if (progressFillRef.current) progressFillRef.current.style.width = '0%'; localStorage.setItem('pmd_reel_last_selected_audio_url', url); };
    const nextTrack = () => { setCustomAudio(null); setCurrentTrackIdx((prev) => (prev + 1) % PROFESSIONAL_AUDIO_LIBRARY.length); setIsPlaying(false); previewTimeRef.current = 0; if (progressFillRef.current) progressFillRef.current.style.width = '0%'; assetStore.save('pmd_reel_audio_blob', ''); };

    const drawSlideImage = (ctx: CanvasRenderingContext2D, imgObj: {img: HTMLImageElement, mask: HTMLImageElement | null}, slideIndex: number, progress: number, x: number, y: number, width: number, height: number, alpha: number, subIndex: number = 0, transitionParams?: { type: TransitionType, progress: number }, beatFactor: number = 0) => {
        const { img, mask } = imgObj;
        if (!img) return; 
        const easedProgress = easeInOutCubic(progress); 
        
        // Base scale to cover the slot viewport completely
        const baseCoverScale = Math.max(width / img.width, height / img.height); 
        const drawW = img.width * baseCoverScale;
        const drawH = img.height * baseCoverScale;
        const drawX = x + (width - drawW) / 2;
        const drawY = y + (height - drawH) / 2;

        // Split-screen logic: images move in opposing directions
        const baseEven = (slideIndex) % 2 === 0;
        const isEven = subIndex === 0 ? baseEven : !baseEven; 
        
        // Desired cinematic pan amount (proportional to intensity)
        const subMotionFactor = subIndex === 0 ? 1 : 1.15;
        const desiredPanX = width * (panIntensity * 0.12 * subMotionFactor);
        const desiredPanY = height * (panIntensity * 0.06 * subMotionFactor);

        // Calculate minimum zoom required so that panning NEVER pulls the image edges past the slot boundary:
        // (drawW * zoom - width) / 2 >= desiredPanX  =>  zoom >= (width + 2 * desiredPanX) / drawW
        const minZoomForX = (width + 2 * desiredPanX) / drawW;
        const minZoomForY = (height + 2 * desiredPanY) / drawH;
        const minSafeZoom = Math.max(1.02, minZoomForX, minZoomForY);

        const zoomHeadroom = 0.12 * (1 + panIntensity * 0.4);
        const startScale = isEven ? minSafeZoom : minSafeZoom + zoomHeadroom; 
        const endScale = isEven ? minSafeZoom + zoomHeadroom : minSafeZoom; 
        let zoom = (startScale + (endScale - startScale) * easedProgress) + (beatFactor * 0.03); 

        let transX = 0;
        let transY = 0;

        if (transitionParams) {
            const tp = transitionParams.progress; 
            const type = transitionParams.type;
            if (type === 'zoom') {
                // Keep zoom strictly >= minSafeZoom to prevent black edges during zoom-in transitions
                zoom = Math.max(minSafeZoom, zoom * (0.96 + (0.04 * tp)));
            }
            else if (type === 'pan') {
                transX = width * 0.05 * (1 - tp);
            }
            else if (type === 'slide') {
                if (aspectRatio === '9:16') transY = height * (1 - tp); 
                else transX = width * (1 - tp); 
            }
            else if (type === 'whip') {
                transX = width * Math.pow(1 - tp, 2) * (isEven ? 1 : -1);
                ctx.filter = `blur(${Math.min(20, Math.abs(transX) * 0.05)}px)`;
            }
            else if (type === 'blur') {
                ctx.filter = `blur(${(1 - tp) * 15}px)`;
            }
        }

        // Clamp maximum allowed pan at current zoom so the image is 100% constrained inside the slot
        const maxPanX = Math.max(0, (drawW * zoom - width) / 2);
        const maxPanY = Math.max(0, (drawH * zoom - height) / 2);

        const panStartX = isEven ? -maxPanX : maxPanX;
        const panEndX = isEven ? maxPanX : -maxPanX;
        let panX = (panStartX + (panEndX - panStartX) * easedProgress) * Math.min(1, panIntensity);

        // Clamp total pan + transition offset (unless it's an explicit full-slide transition coming into view)
        if (transitionParams?.type !== 'slide') {
            panX = Math.max(-maxPanX, Math.min(maxPanX, panX + transX));
            transX = 0;
        }

        ctx.save(); 
        ctx.globalAlpha = alpha; 
        drawRoundedRect(ctx, x, y, width, height, 0); ctx.clip();

        if (mask) {
            // LAYERED PARALLAX: Background (Sky/Environment)
            const bgZoom = zoom * 1.04;
            const maxBgPanX = Math.max(0, (drawW * bgZoom - width) / 2);
            const clampedBgPanX = Math.max(-maxBgPanX, Math.min(maxBgPanX, panX * 1.15));

            ctx.save();
            ctx.translate(x + width/2 + transX, y + height/2 + transY); 
            ctx.scale(bgZoom, bgZoom);
            ctx.translate(clampedBgPanX, 0);
            ctx.translate(-(x + width/2), -(y + height/2)); 
            ctx.filter = 'blur(4px) brightness(0.8)';
            ctx.drawImage(img, drawX, drawY, drawW, drawH);
            ctx.restore();

            // LAYERED PARALLAX: Foreground (Subject)
            ctx.save();
            ctx.translate(x + width/2 + transX, y + height/2 + transY); 
            ctx.scale(zoom, zoom); 
            ctx.translate(panX, 0); 
            ctx.translate(-(x + width/2), -(y + height/2)); 
            
            // Create a temporary canvas to apply the mask
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = drawW;
            tempCanvas.height = drawH;
            const tctx = tempCanvas.getContext('2d');
            if (tctx) {
                tctx.drawImage(img, 0, 0, drawW, drawH);
                tctx.globalCompositeOperation = 'destination-in';
                tctx.drawImage(mask, 0, 0, drawW, drawH);
                ctx.drawImage(tempCanvas, drawX, drawY, drawW, drawH);
            }
            ctx.restore();
        } else {
            // Standard single layer (Cover)
            ctx.save();
            ctx.translate(x + width/2 + transX, y + height/2 + transY); 
            ctx.scale(zoom, zoom); 
            ctx.translate(panX, 0); 
            ctx.translate(-(x + width/2), -(y + height/2)); 
            ctx.drawImage(img, drawX, drawY, drawW, drawH); 
            ctx.restore();
        }
        ctx.restore();
    };

    const drawVisualizer = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
        if (!analyserRef.current || !freqDataRef.current || !timeDataRef.current) return;
        analyserRef.current.getByteFrequencyData(freqDataRef.current);
        analyserRef.current.getByteTimeDomainData(timeDataRef.current);
        
        const color = colors.primary; 
        ctx.save(); 
        ctx.globalAlpha = 1.0; 
        ctx.lineWidth = width * 0.003; 
        ctx.strokeStyle = color; 
        ctx.fillStyle = color;
        
        const brightness = visualizerLuminosity;
        ctx.filter = `brightness(${brightness * 1.5})`; 

        const visH = height * 0.1;
        if (visualizerStyle === 'bars') {
            const barCount = freqDataRef.current.length;
            const barWidth = width / barCount;
            for (let i = 0; i < barCount; i++) {
                const mirroredIdx = i < barCount / 2 ? Math.floor(barCount / 2) - i - 1 : i - Math.floor(barCount / 2);
                const val = freqDataRef.current[mirroredIdx] / 255;
                const barH = val * visH;
                ctx.fillRect(i * barWidth, height - barH, barWidth - 1, barH);
            }
        } else if (visualizerStyle === 'waveform') {
            ctx.beginPath(); const sliceWidth = width / timeDataRef.current.length; let x = 0;
            const visY = height - (visH / 2);
            for (let i = 0; i < timeDataRef.current.length; i++) {
                const v = timeDataRef.current[i] / 128.0; const y = visY + (v * visH / 4) - (visH / 4);
                if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); x += sliceWidth;
            } ctx.stroke();
        } else if (visualizerStyle === 'dots') {
            const dotCount = 60; const step = width / dotCount;
            const visY = height - (visH / 2);
            for (let i = 0; i < dotCount; i++) {
                const mid = Math.floor(dotCount / 2);
                const freqIdx = Math.abs(i - mid) * 2;
                const val = freqDataRef.current[freqIdx] / 255;
                const radius = (val * visH * 0.4) + 1;
                ctx.beginPath(); ctx.arc(i * step + step/2, visY, radius, 0, Math.PI * 2); ctx.fill();
            }
        }
        ctx.restore();
    };

    const drawFrame = useCallback((ctx: CanvasRenderingContext2D, time: number, width: number, height: number, slots: {img: HTMLImageElement, mask: HTMLImageElement | null}[][], headshot: HTMLImageElement | null, logo: HTMLImageElement | null, headshot2?: HTMLImageElement | null, logo2?: HTMLImageElement | null) => {
        ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; ctx.clearRect(0, 0, width, height); ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height); const cx = width / 2; const cy = height / 2; const isWide = width > height;
        
        const combineVal = (v1: string, v2: string, sep = ' | ') => {
            const s1 = (v1 || '').trim();
            const s2 = (v2 || '').trim();
            if (s1 && s2 && s1 !== s2) return `${s1}${sep}${s2}`;
            return s1 || s2 || '';
        };

        const realtor = String(data.realtor || data.agent || data.agentname || data.agent_name || data.realtorname || data.realtor_name || data.listingagent || data.agent1 || data.realtor1 || '');
        const phone = String(data.phonenumber || data.phone || data.agentphone || data.agentphonenumber || data.agent_phone || data.realtorphone || data.phone1 || data.agent1phone || data.agent1_phone || '');
        const email = String(data.email || data.agentemail || data.agent_email || data.realtoremail || data.email1 || data.agent1email || data.agent1_email || '');
        const brokerage = String(data.brokerage || data.company || data.brokeragename || data.brokerage_name || data.office || data.companyname || '');
        const website = String(data.website || data.url || data.agentwebsite || data.site || '');

        const realtor2 = String(data.agent2 || data.realtor2 || data.agent2name || data.agent2_name || data.realtor2name || data.realtor2_name || data.colistingagent || data.colistingrealtor || data.coagent || data.coagentname || data.coagent_name || data.agent2Name || (assets as any).agent2Name || '');
        const phone2 = String(data.agent2phone || data.agent2phonenumber || data.agent2_phone || data.agent2_phonenumber || data.phone2 || data.phonenumber2 || data.phone_2 || data.realtor2phone || data.coagentphone || data.colistingphone || data.agent2PhoneNumber || (assets as any).agent2PhoneNumber || '');
        const email2 = String(data.agent2email || data.agent2_email || data.email2 || data.email_2 || data.realtor2email || data.coagentemail || data.colistingemail || data.agent2Email || (assets as any).agent2Email || '');
        const brokerage2 = String(data.agent2brokerage || data.agent2_brokerage || data.brokerage2 || data.brokerage_2 || data.company2 || data.company_2 || data.coagentbrokerage || data.colistingbrokerage || data.agent2Brokerage || (assets as any).agent2Brokerage || '');
        
        const hasAgent2 = Boolean(realtor2 || headshot2 || phone2 || email2 || logo2);

        const combinedRealtors = combineVal(realtor, realtor2, ' & ');
        const combinedBrokerage = combineVal(brokerage, brokerage2, ' | ');
        const combinedPhones = combineVal(phone, phone2, ' | ');
        const combinedEmails = combineVal(email, email2, ' | ');

        // Audio Beat Detection
        let beatFactor = 0;
        if (analyserRef.current && freqDataRef.current) {
            analyserRef.current.getByteFrequencyData(freqDataRef.current);
            const bassRange = freqDataRef.current.slice(0, 10);
            const avgBass = bassRange.reduce((a, b) => a + b, 0) / bassRange.length;
            beatFactor = Math.max(0, (avgBass - 180) / 75); // Thresholded energy
        }

        const drawTextFitInternal = (text: string, x: number, y: number, maxWidth: number, initialSize: number, weight: string, align: CanvasTextAlign, color: string, shadow = true, kineticOffset = 0, kineticAlpha = 1) => {
            if (!text) return 0; 
            const cleanText = String(text);
            ctx.font = `${weight} ${initialSize}px 'Plus Jakarta Sans', sans-serif`; ctx.textAlign = align; let size = initialSize; let textWidth = ctx.measureText(cleanText).width; while (textWidth > maxWidth && size > 10) { size -= 1; ctx.font = `${weight} ${size}px 'Plus Jakarta Sans', sans-serif`; textWidth = ctx.measureText(cleanText).width; }
            ctx.save(); 
            ctx.globalAlpha = kineticAlpha;
            ctx.translate(0, kineticOffset);
            if (shadow) { ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 10; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; } ctx.fillStyle = color; ctx.fillText(cleanText, x, y); ctx.restore(); return size;
        };

        const slideshowTime = time - INTRO_DURATION;
        if (slideshowTime < 0) {
            // INTRO PHASE: Clean isolated agent card animation
            const firstImg = slots[0]?.[0]?.img; if (firstImg) { const scale = Math.max(width / firstImg.width, height / firstImg.height); ctx.save(); if (!isCleanFeed) ctx.filter = 'blur(40px) brightness(0.4)'; ctx.drawImage(firstImg, (width - firstImg.width * scale) / 2, (height - firstImg.height * scale) / 2, firstImg.width * scale, firstImg.height * scale); ctx.restore(); }
            if (isCleanFeed) return;
            const introProgress = Math.min(1, time / (INTRO_DURATION * 0.8)); const bounceProgress = easeOutBack(introProgress); 
            // Smoothly fade out agent info at the very end of intro before the slideshow stats begin
            const introFadeOut = time > INTRO_DURATION - 200 ? Math.max(0, (INTRO_DURATION - time) / 200) : 1;
            const fadeProgress = Math.min(1, time / 500) * introFadeOut; 
            ctx.globalAlpha = fadeProgress;
            const hsSize = isWide ? height * 0.32 : width * 0.45; const logoH = isWide ? height * 0.12 : width * 0.2; const titleSize = isWide ? 50 : 60; const detailSize = isWide ? 30 : 40; const margin = isWide ? 30 : 40;
            let introStackH = hsSize + margin +
                (combinedRealtors ? titleSize + (margin / 2) : 0) +
                (combinedBrokerage ? detailSize * 0.85 + (margin / 4) : 0) +
                (combinedPhones ? detailSize + (margin / 4) : 0) +
                (combinedEmails ? detailSize + (margin / 4) : 0) +
                (website ? detailSize + margin : 0) + logoH;
            ctx.save(); const stackScale = Math.min(1, (height * 0.85) / Math.max(1, introStackH)); if (stackScale < 1) { ctx.translate(cx, cy); ctx.scale(stackScale, stackScale); ctx.translate(-cx, -cy); }
            let curY = (height - introStackH) / 2;

            if (headshot && headshot2) {
                const hsY = curY + hsSize / 2;
                const hsOffset = hsSize * 0.35;
                ctx.save(); ctx.translate(cx - hsOffset, hsY); ctx.scale(bounceProgress, bounceProgress); ctx.beginPath(); ctx.arc(0, 0, Math.max(0, hsSize/2), 0, Math.PI * 2); ctx.clip(); const imgScale1 = Math.max(hsSize / headshot.width, hsSize / headshot.height); ctx.drawImage(headshot, - (headshot.width * imgScale1)/2, - (headshot.height * imgScale1)/2, headshot.width * imgScale1, headshot.height * imgScale1); ctx.restore(); ctx.beginPath(); ctx.arc(cx - hsOffset, hsY, Math.max(0, (hsSize/2)*bounceProgress), 0, Math.PI * 2); ctx.lineWidth = isWide ? 8 : 12; ctx.strokeStyle = colors.primary; ctx.stroke();
                ctx.save(); ctx.translate(cx + hsOffset, hsY); ctx.scale(bounceProgress, bounceProgress); ctx.beginPath(); ctx.arc(0, 0, Math.max(0, hsSize/2), 0, Math.PI * 2); ctx.clip(); const imgScale2 = Math.max(hsSize / headshot2.width, hsSize / headshot2.height); ctx.drawImage(headshot2, - (headshot2.width * imgScale2)/2, - (headshot2.height * imgScale2)/2, headshot2.width * imgScale2, headshot2.height * imgScale2); ctx.restore(); ctx.beginPath(); ctx.arc(cx + hsOffset, hsY, Math.max(0, (hsSize/2)*bounceProgress), 0, Math.PI * 2); ctx.lineWidth = isWide ? 8 : 12; ctx.strokeStyle = colors.primary; ctx.stroke();
            } else if (headshot || headshot2) { 
                const activeHs = headshot || headshot2!;
                const hsY = curY + hsSize / 2; ctx.save(); ctx.translate(cx, hsY); ctx.scale(bounceProgress, bounceProgress); ctx.beginPath(); ctx.arc(0, 0, Math.max(0, hsSize/2), 0, Math.PI * 2); ctx.clip(); const imgScale = Math.max(hsSize / activeHs.width, hsSize / activeHs.height); ctx.drawImage(activeHs, - (activeHs.width * imgScale)/2, - (activeHs.height * imgScale)/2, activeHs.width * imgScale, activeHs.height * imgScale); ctx.restore(); ctx.beginPath(); ctx.arc(cx, hsY, Math.max(0, (hsSize/2)*bounceProgress), 0, Math.PI * 2); ctx.lineWidth = isWide ? 8 : 12; ctx.strokeStyle = colors.primary; ctx.stroke(); 
            }
            curY += hsSize + margin;

            const textAlpha = Math.min(1, Math.max(0, (time - 400) / 600)) * introFadeOut; ctx.globalAlpha = textAlpha;
            if (combinedRealtors) { drawTextFitInternal(combinedRealtors, cx, curY, width - 100, titleSize, '800', 'center', '#fff', true); curY += titleSize + (margin / 2); }
            if (combinedBrokerage) { drawTextFitInternal(combinedBrokerage, cx, curY, width - 120, detailSize * 0.85, '600', 'center', '#ccc', true); curY += detailSize * 0.85 + (margin / 4); }
            if (combinedPhones) { drawTextFitInternal(combinedPhones, cx, curY, width - 150, detailSize, '600', 'center', '#e0e0e0', true); curY += detailSize + (margin / 4); }
            if (combinedEmails) { drawTextFitInternal(combinedEmails, cx, curY, width - 150, detailSize, '600', 'center', '#e0e0e0', true); curY += detailSize + (margin / 4); }
            if (website) { drawTextFitInternal(website, cx, curY, width - 150, detailSize, 'bold', 'center', colors.primary, true); curY += detailSize + margin; }
            
            if (logo && logo2) {
                const lb = easeOutBack(Math.max(0, (time - 700) / (INTRO_DURATION - 700)));
                const s1 = logoH / logo.height; const lW1 = logo.width * s1;
                const s2 = logoH / logo2.height; const lW2 = logo2.width * s2;
                ctx.save(); ctx.translate(cx - lW1/2 - 15, curY + logoH / 2); ctx.scale(lb, lb); ctx.drawImage(logo, -lW1/2, -logoH/2, lW1, logoH); ctx.restore();
                ctx.save(); ctx.translate(cx + lW2/2 + 15, curY + logoH / 2); ctx.scale(lb, lb); ctx.drawImage(logo2, -lW2/2, -logoH/2, lW2, logoH); ctx.restore();
            } else if (logo || logo2) { 
                const activeLogo = logo || logo2!;
                const lb = easeOutBack(Math.max(0, (time - 700) / (INTRO_DURATION - 700))); const s = logoH / activeLogo.height; const lW = activeLogo.width * s; ctx.save(); ctx.translate(cx, curY + logoH / 2); ctx.scale(lb, lb); ctx.drawImage(activeLogo, -lW/2, -logoH/2, lW, logoH); ctx.restore(); 
            }
            curY += logoH;
            ctx.restore();
            return; // Explicitly finish frame so intro never renders concurrently with property stats / slideshow
        } else if (slideshowTime < VIDEO_DURATION) {
            const slotCount = Math.max(1, slots.length); 
            const slotDuration = VIDEO_DURATION / slotCount; 
            const currentSlotIndex = Math.floor(slideshowTime / slotDuration); 
            const timeInSlot = slideshowTime % slotDuration; 
            const rawProgress = timeInSlot / slotDuration;
            
            const rampType = transitionData[currentSlotIndex]?.ramp || 'linear';
            let rampedProgress = rawProgress;
            if (rampType === 'cinematic') rampedProgress = cinematicRamp(rawProgress);
            else if (rampType === 'snap') rampedProgress = snapRamp(rawProgress);
            else if (rampType === 'whip') rampedProgress = whipRamp(rawProgress);
            else if (rampType === 'elastic') rampedProgress = elasticRamp(rawProgress);
            else rampedProgress = fastSlowFast(rawProgress);

            const renderSlot = (slotIdx: number, progress: number, alpha: number, transitionParams?: { type: TransitionType, progress: number }) => {
                const slot = slots[slotIdx]; if (!slot) return;
                const barSize = 8;
                const barColor = 'rgba(255,255,255,1.0)';

                // Dynamic Split Screen Logic
                const dividerOffset = Math.sin(progress * Math.PI) * (isWide ? width * 0.05 : height * 0.05);

                if (slot.length === 1) drawSlideImage(ctx, slot[0], slotIdx, progress, 0, 0, width, height, alpha, 0, transitionParams, beatFactor);
                else if (slot.length === 2) {
                    if (aspectRatio === '9:16') { 
                        const splitY = height/2 + dividerOffset;
                        drawSlideImage(ctx, slot[0], slotIdx, progress, 0, 0, width, splitY, alpha, 0, transitionParams, beatFactor); 
                        drawSlideImage(ctx, slot[1], slotIdx, progress, 0, splitY, width, height - splitY, alpha, 1, transitionParams, beatFactor); 
                        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = barColor;
                        ctx.fillRect(0, splitY - barSize/2, width, barSize); ctx.restore();
                    }
                    else { 
                        const splitX = width/2 + dividerOffset;
                        drawSlideImage(ctx, slot[0], slotIdx, progress, 0, 0, splitX, height, alpha, 0, transitionParams, beatFactor); 
                        drawSlideImage(ctx, slot[1], slotIdx, progress, splitX, 0, width - splitX, height, alpha, 1, transitionParams, beatFactor); 
                        ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = barColor;
                        ctx.fillRect(splitX - barSize/2, 0, barSize, height); ctx.restore();
                    }
                }
            };

            renderSlot(currentSlotIndex, rampedProgress, 1.0);
            const fadeDurationMs = fadeDuration * 1000; 
            if (timeInSlot > slotDuration - fadeDurationMs && currentSlotIndex < slotCount - 1) { 
                const fp = (timeInSlot - (slotDuration - fadeDurationMs)) / fadeDurationMs; 
                const nextType = transitionData[currentSlotIndex + 1]?.transition || 'fade';
                const nextRampType = transitionData[currentSlotIndex + 1]?.ramp || 'linear';
                
                let nextRampedProgress = 0; 
                if (nextRampType === 'cinematic') nextRampedProgress = cinematicRamp(0);
                
                renderSlot(currentSlotIndex + 1, nextRampedProgress, fp, { type: nextType, progress: fp });
            }

            drawVisualizer(ctx, width, height);
            
            if (isCleanFeed) return;

            const gr = ctx.createLinearGradient(0, height * 0.65, 0, height); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1.0)'); ctx.fillStyle = gr; ctx.fillRect(0, height * 0.6, width, height * 0.4);
            const HEADING = mode.toUpperCase(); 
            const badgeY = 120; 
            const badgeH = isWide ? 75 : 95; 
            const headingFontSize = isWide ? 38 : 48;
            const headingFont = `900 ${headingFontSize}px 'Plus Jakarta Sans', sans-serif`;
            
            // Measure heading text for adaptive oval border sizing
            ctx.save();
            ctx.font = headingFont;
            const measuredHeading = ctx.measureText(HEADING);
            ctx.restore();
            const badgePadding = isWide ? 70 : 100;
            const badgeW = Math.max(isWide ? 380 : width * 0.55, measuredHeading.width + badgePadding);
            const ovalRadius = badgeH / 2;
            
            // Kinetic Typography for Heading
            const headingOffset = Math.max(0, (1 - (slideshowTime / 500))) * -50;
            const headingAlpha = Math.min(1, slideshowTime / 400);

            ctx.save();
            ctx.globalAlpha = headingAlpha;
            ctx.translate(0, headingOffset);

            // Oval Pill Background
            ctx.fillStyle = colors.primary; 
            drawRoundedRect(ctx, cx - badgeW/2, badgeY, badgeW, badgeH, ovalRadius); 
            ctx.fill(); 

            // Crisp Oval Border
            ctx.lineWidth = isWide ? 2 : 3;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
            drawRoundedRect(ctx, cx - badgeW/2, badgeY, badgeW, badgeH, ovalRadius);
            ctx.stroke();

            // Centered Title Text (Exact vertical & horizontal centering)
            ctx.fillStyle = '#ffffff'; 
            ctx.font = headingFont; 
            ctx.textAlign = 'center'; 
            ctx.textBaseline = 'middle';
            ctx.shadowColor = 'rgba(0,0,0,0.6)';
            ctx.shadowBlur = 10;
            ctx.shadowOffsetX = 1;
            ctx.shadowOffsetY = 2;
            ctx.fillText(HEADING, cx, badgeY + badgeH / 2);
            ctx.restore();            // DYNAMIC LOWER THIRDS BOX WITH ANIMATED SPEC BADGES & ODOMETER EFFECT
            const hPadding = isWide ? 50 : 70;
            const vPadding = isWide ? 35 : 55;
            const lineSpacing = isWide ? 12 : 22;
            
            const priceFont = `bold ${isWide ? 80 : 110}px 'Plus Jakarta Sans', sans-serif`;
            const addrFont = `bold ${isWide ? 32 : 50}px 'Plus Jakarta Sans', sans-serif`;
            const cityFont = `${isWide ? 24 : 38}px 'Plus Jakarta Sans', sans-serif`;
            const badgeFont = `bold ${isWide ? 26 : 38}px 'Plus Jakarta Sans', sans-serif`;

            // Helper to interpolate numbers smoothly with an odometer counter effect on slide load
            const animateOdometerValue = (rawText: string, progress: number): string => {
                if (!rawText || progress >= 1) return rawText;
                const p = Math.min(1, Math.max(0, progress));
                // Smooth deceleration curve for counter (cubic ease-out)
                const eased = 1 - Math.pow(1 - p, 3);
                
                return rawText.replace(/([$€£¥]?)\s*([\d,]+(?:\.\d+)?)\s*(%|[a-zA-Z]*)/g, (match, prefix, numStr, suffix) => {
                    const cleanNum = parseFloat(numStr.replace(/,/g, ''));
                    if (isNaN(cleanNum)) return match;
                    
                    const hasDecimals = numStr.includes('.');
                    const decimalPlaces = hasDecimals ? (numStr.split('.')[1] || '').length : 0;
                    
                    const currentVal = cleanNum * eased;
                    let formatted = hasDecimals
                        ? currentVal.toFixed(decimalPlaces)
                        : Math.round(currentVal).toLocaleString('en-US');
                        
                    const joinedSuffix = suffix ? (suffix.length > 0 && !suffix.startsWith(' ') && !prefix ? ' ' + suffix : suffix) : '';
                    return `${prefix || ''}${formatted}${joinedSuffix}`;
                });
            };

            // Calculate odometer progress for the active slide slot
            // Odometer count-up animation only runs twice (on the first 2 slides: index 0 and 1), staying fully displayed on subsequent slides
            const isOdometerActiveSlide = currentSlotIndex < 2;
            const slotOdometerDuration = Math.min(850, Math.max(400, slotDuration * 0.4));
            const slotOdometerProgress = isOdometerActiveSlide
                ? Math.min(1, timeInSlot / slotOdometerDuration)
                : 1.0;

            const displayAddrLine = String(data.unit ? `${data.unit} - ${data.address || ''}` : (data.address || '')); 
            const displayCityLine = String(data.city || '');
            
            const rawPrice = String(data.price || '');
            const animPrice = animateOdometerValue(rawPrice, slotOdometerProgress);

            const vBedCount = String(data.bed || data.beds || data.bedroom || data.bedrooms || '');
            const vBathCount = String(data.bath || data.baths || data.bathroom || data.bathrooms || '');
            const vSqftSize = String(data.totallivingareasqft || data.sqft || data.squarefeet || data.sq_ft || '');

            const animBedText = vBedCount ? animateOdometerValue(`${vBedCount} Bed${vBedCount !== '1' ? 's' : ''}`, slotOdometerProgress) : '';
            const animBathText = vBathCount ? animateOdometerValue(`${vBathCount} Bath${vBathCount !== '1' ? 's' : ''}`, slotOdometerProgress) : '';
            const animSqftText = vSqftSize ? animateOdometerValue(`${vSqftSize} SqFt`, slotOdometerProgress) : '';

            const specBadges: { icon: string, label: string }[] = [];
            if (vBedCount) specBadges.push({ icon: '🛏️', label: animBedText });
            if (vBathCount) specBadges.push({ icon: '🛁', label: animBathText });
            if (vSqftSize) specBadges.push({ icon: '📐', label: animSqftText });

            let maxWidth = 0;
            let totalHeight = 0;
            const lines: {text: string, font: string, color: string, height: number}[] = [];

            const addLine = (text: string, font: string, color: string, h: number) => {
                if (!text) return;
                const cleanT = String(text);
                ctx.font = font;
                const w = ctx.measureText(cleanT).width;
                if (w > maxWidth) maxWidth = w;
                lines.push({text: cleanT, font, color, height: h});
                totalHeight += h + lineSpacing;
            };

            addLine(animPrice, priceFont, '#fff', isWide ? 80 : 110);
            addLine(displayAddrLine, addrFont, '#fff', isWide ? 32 : 50);
            addLine(displayCityLine, cityFont, '#e0e0e0', isWide ? 24 : 38);

            // Compute Badges Layout Dimensions
            const specBadgeH = isWide ? 48 : 64;
            const badgeHPad = isWide ? 20 : 28;
            const badgeGap = isWide ? 12 : 18;
            const badgeRadius = isWide ? 24 : 32;

            let badgeWidths: number[] = [];
            let totalBadgesW = 0;

            if (specBadges.length > 0) {
                ctx.font = badgeFont;
                badgeWidths = specBadges.map(b => ctx.measureText(`${b.icon} ${b.label}`).width + badgeHPad * 2);
                totalBadgesW = badgeWidths.reduce((a, b) => a + b, 0) + (specBadges.length - 1) * badgeGap;
                if (totalBadgesW > maxWidth) maxWidth = totalBadgesW;
                totalHeight += specBadgeH + lineSpacing;
            }

            if (lines.length > 0 || specBadges.length > 0) {
                totalHeight -= lineSpacing; // Remove last spacing
                const boxW = Math.min(width * 0.94, Math.max(maxWidth + hPadding * 2, isWide ? 500 : width * 0.85));
                const boxH = totalHeight + vPadding * 2;
                const boxX = (width - boxW) / 2;
                const boxY = height - boxH - (isWide ? 50 : 110);

                ctx.save();
                // Backdrop with subtle gradient & border
                ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 24;
                ctx.shadowOffsetY = 8;
                drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 40);
                ctx.fill();

                // Subtle glowing border
                ctx.lineWidth = 1.5;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
                drawRoundedRect(ctx, boxX, boxY, boxW, boxH, 40);
                ctx.stroke();
                ctx.restore();
                
                let currentY = boxY + vPadding;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'top';
                
                lines.forEach((line, idx) => {
                    // Kinetic Typography for lines
                    const lineDelay = idx * 90;
                    const lineOffset = Math.max(0, (1 - ((slideshowTime - lineDelay) / 400))) * 25;
                    const lineAlpha = Math.min(1, Math.max(0, (slideshowTime - lineDelay) / 300));

                    drawTextFitInternal(line.text, cx, currentY, boxW - hPadding * 2, line.height, 'bold', 'center', line.color, true, lineOffset, lineAlpha);
                    currentY += line.height + lineSpacing;
                });

                // DRAW ANIMATED SPEC BADGES (PILLS) WITH ODOMETER EFFECT
                if (specBadges.length > 0) {
                    const badgeLineDelay = lines.length * 90;
                    const badgeOffset = Math.max(0, (1 - ((slideshowTime - badgeLineDelay) / 400))) * 25;
                    const badgeAlpha = Math.min(1, Math.max(0, (slideshowTime - badgeLineDelay) / 300));

                    ctx.save();
                    ctx.globalAlpha = badgeAlpha;
                    ctx.translate(0, badgeOffset);

                    // Settle pulse when odometer counter hits 100%
                    const settleFactor = (isOdometerActiveSlide && slotOdometerProgress >= 1 && timeInSlot - slotOdometerDuration < 150)
                        ? 1.0 + Math.sin(((timeInSlot - slotOdometerDuration) / 150) * Math.PI) * 0.04
                        : 1.0;

                    // Ensure badges fit horizontally within box
                    const availableBadgeW = boxW - hPadding * 1.5;
                    const scaleRatio = totalBadgesW > availableBadgeW ? (availableBadgeW / totalBadgesW) : 1;
                    
                    let curBadgeX = cx - (totalBadgesW * scaleRatio) / 2;

                    specBadges.forEach((badge, bIdx) => {
                        const originalW = badgeWidths[bIdx];
                        const bW = originalW * scaleRatio;

                        ctx.save();
                        if (settleFactor !== 1.0) {
                            ctx.translate(curBadgeX + bW / 2, currentY + specBadgeH / 2);
                            ctx.scale(settleFactor, settleFactor);
                            ctx.translate(-(curBadgeX + bW / 2), -(currentY + specBadgeH / 2));
                        }

                        // Badge Pill Background
                        ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
                        drawRoundedRect(ctx, curBadgeX, currentY, bW, specBadgeH, badgeRadius);
                        ctx.fill();

                        // Accent Border
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = colors.primary;
                        drawRoundedRect(ctx, curBadgeX, currentY, bW, specBadgeH, badgeRadius);
                        ctx.stroke();

                        // Badge Text (Icon + Animated Counter Spec)
                        ctx.font = badgeFont;
                        ctx.fillStyle = '#ffffff';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';
                        ctx.shadowColor = 'rgba(0,0,0,0.6)';
                        ctx.shadowBlur = 8;
                        ctx.shadowOffsetX = 1;
                        ctx.shadowOffsetY = 1;

                        const displayText = `${badge.icon}  ${badge.label}`;
                        ctx.fillText(displayText, curBadgeX + bW / 2, currentY + specBadgeH / 2);

                        ctx.restore();
                        curBadgeX += bW + badgeGap * scaleRatio;
                    });

                    ctx.restore();
                }
            }

        } else {
            const endCardTime = slideshowTime - VIDEO_DURATION; 
            const lastImg = slots[slots.length - 1]?.[0]?.img; 
            if (lastImg) { 
                const scale = Math.max(width / lastImg.width, height / lastImg.height); 
                ctx.save(); 
                if (!isCleanFeed) ctx.filter = 'blur(50px) brightness(0.35)'; 
                ctx.drawImage(lastImg, (width - lastImg.width * scale) / 2, (height - lastImg.height * scale) / 2, lastImg.width * scale, lastImg.height * scale); 
                ctx.restore(); 
            }
            if (isCleanFeed) return;

            const hsSize = isWide ? height * 0.3 : width * 0.45; 
            const logoH = isWide ? height * 0.12 : width * 0.2; 
            const nameSize = isWide ? 50 : 65; 
            const contactSize = isWide ? 28 : 38; 
            const webSize = isWide ? 32 : 44; 
            const margin = isWide ? 30 : 50;
            const hasAnyHeadshot = Boolean(headshot || headshot2);
            const hasAnyLogo = Boolean(logo || logo2);

            let outroStackH = (hasAnyHeadshot ? hsSize + margin : 0) +
                (combinedRealtors ? nameSize + (margin / 2) : 0) +
                (combinedBrokerage ? contactSize * 0.85 + (margin / 4) : 0) +
                (combinedPhones ? contactSize + (margin / 4) : 0) +
                (combinedEmails ? contactSize + (margin / 4) : 0) +
                (website ? webSize + margin : 0) + 
                (hasAnyLogo ? logoH : 0);

            ctx.save(); 
            const endFade = Math.min(1, endCardTime / 400);
            ctx.globalAlpha = endFade;

            const outroScale = Math.min(1, (height * 0.85) / Math.max(1, outroStackH)); 
            if (outroScale < 1) { 
                ctx.translate(cx, cy); 
                ctx.scale(outroScale, outroScale); 
                ctx.translate(-cx, -cy); 
            }
            let curY = (height - outroStackH) / 2; 
            const bp = easeOutBack(Math.min(1, endCardTime / 800));

            if (headshot && headshot2) {
                const hsY = curY + hsSize/2;
                const hsOffset = hsSize * 0.35;
                ctx.save(); 
                ctx.translate(cx - hsOffset, hsY); 
                ctx.scale(bp, bp); 
                ctx.beginPath(); 
                ctx.arc(0, 0, Math.max(0, hsSize/2), 0, Math.PI * 2); 
                ctx.clip(); 
                const s1 = Math.max(hsSize / headshot.width, hsSize / headshot.height); 
                ctx.drawImage(headshot, - (headshot.width * s1)/2, - (headshot.height * s1)/2, headshot.width * s1, headshot.height * s1); 
                ctx.restore(); 
                
                ctx.beginPath(); 
                ctx.arc(cx - hsOffset, hsY, Math.max(0, (hsSize/2)*bp), 0, Math.PI * 2); 
                ctx.lineWidth = isWide ? 8 : 12; 
                ctx.strokeStyle = colors.primary; 
                ctx.stroke();

                ctx.save(); 
                ctx.translate(cx + hsOffset, hsY); 
                ctx.scale(bp, bp); 
                ctx.beginPath(); 
                ctx.arc(0, 0, Math.max(0, hsSize/2), 0, Math.PI * 2); 
                ctx.clip(); 
                const s2 = Math.max(hsSize / headshot2.width, hsSize / headshot2.height); 
                ctx.drawImage(headshot2, - (headshot2.width * s2)/2, - (headshot2.height * s2)/2, headshot2.width * s2, headshot2.height * s2); 
                ctx.restore(); 
                
                ctx.beginPath(); 
                ctx.arc(cx + hsOffset, hsY, Math.max(0, (hsSize/2)*bp), 0, Math.PI * 2); 
                ctx.lineWidth = isWide ? 8 : 12; 
                ctx.strokeStyle = colors.primary; 
                ctx.stroke();
                curY += hsSize + margin;
            } else if (headshot || headshot2) { 
                const activeHs = headshot || headshot2!;
                const hsY = curY + hsSize/2; 
                ctx.save(); 
                ctx.translate(cx, hsY); 
                ctx.scale(bp, bp); 
                ctx.beginPath(); 
                ctx.arc(0, 0, Math.max(0, hsSize/2), 0, Math.PI * 2); 
                ctx.clip(); 
                const s = Math.max(hsSize / activeHs.width, hsSize / activeHs.height); 
                ctx.drawImage(activeHs, - (activeHs.width * s)/2, - (activeHs.height * s)/2, activeHs.width * s, activeHs.height * s); 
                ctx.restore(); 
                
                ctx.beginPath(); 
                ctx.arc(cx, hsY, Math.max(0, (hsSize/2)*bp), 0, Math.PI * 2); 
                ctx.lineWidth = isWide ? 8 : 12; 
                ctx.strokeStyle = colors.primary; 
                ctx.stroke(); 
                curY += hsSize + margin;
            }

            const ta = Math.min(1, Math.max(0, (endCardTime - 300) / 600)); 
            ctx.globalAlpha = ta * endFade; 
            ctx.textAlign = 'center';
            if (combinedRealtors) { drawTextFitInternal(combinedRealtors, cx, curY, width - 100, nameSize, 'bold', 'center', '#fff'); curY += nameSize + (margin / 2); }
            if (combinedBrokerage) { drawTextFitInternal(combinedBrokerage, cx, curY, width - 120, contactSize * 0.85, '600', 'center', '#ccc'); curY += contactSize * 0.85 + (margin / 4); }
            if (combinedPhones) { drawTextFitInternal(combinedPhones, cx, curY, width - 120, contactSize, '500', 'center', '#fff'); curY += contactSize + (margin / 4); }
            if (combinedEmails) { drawTextFitInternal(combinedEmails, cx, curY, width - 150, contactSize, '500', 'center', '#fff'); curY += contactSize + (margin / 4); }
            if (website) { drawTextFitInternal(website, cx, curY, width - 120, webSize, 'bold', 'center', colors.primary); curY += webSize + margin; }
            
            if (logo && logo2) {
                const lb = easeOutBack(Math.min(1, Math.max(0, (endCardTime - 500) / 800)));
                const s1 = (logoH / logo.height); const lW1 = logo.width * s1;
                const s2 = (logoH / logo2.height); const lW2 = logo2.width * s2;
                ctx.save(); ctx.translate(cx - lW1/2 - 15, curY + logoH/2); ctx.scale(lb, lb); ctx.drawImage(logo, -lW1/2, -logoH/2, lW1, logoH); ctx.restore();
                ctx.save(); ctx.translate(cx + lW2/2 + 15, curY + logoH/2); ctx.scale(lb, lb); ctx.drawImage(logo2, -lW2/2, -logoH/2, lW2, logoH); ctx.restore();
                curY += logoH;
            } else if (logo || logo2) {
                const activeLogo = logo || logo2!;
                const lb = easeOutBack(Math.min(1, Math.max(0, (endCardTime - 500) / 800))); const s = (logoH / activeLogo.height); const lW = activeLogo.width * s; ctx.save(); ctx.translate(cx, curY + logoH/2); ctx.scale(lb, lb); ctx.drawImage(activeLogo, -lW/2, -logoH/2, lW, logoH); ctx.restore();
                curY += logoH;
            }
            ctx.restore();
        }
        ctx.fillStyle = colors.primary; ctx.fillRect(0, height - 12, width * (time / totalDuration), 12);
    }, [data, colors, mode, VIDEO_DURATION, totalDuration, fadeDuration, panIntensity, aspectRatio, INTRO_DURATION, END_CARD_DURATION, visualizerStyle, visualizerLuminosity, transitionData, sceneSlots, isCleanFeed, assets]);

    const animate = useCallback((time: number) => {
        if (!canvasRef.current || !loadedAssets) return; const elapsed = time - startTimeRef.current; const currentTime = elapsed % totalDuration; previewTimeRef.current = currentTime; if (progressFillRef.current) progressFillRef.current.style.width = `${(currentTime / totalDuration) * 100}%`;
        const ctx = canvasRef.current.getContext('2d'); if (ctx) drawFrame(ctx, currentTime, dim.w, dim.h, sceneSlots, loadedAssets.headshot, loadedAssets.logo, loadedAssets.headshot2, loadedAssets.logo2); if (isPlaying) requestRef.current = requestAnimationFrame(animate);
    }, [isPlaying, loadedAssets, totalDuration, drawFrame, dim, sceneSlots]);

    useEffect(() => { if (isPlaying) { startTimeRef.current = performance.now() - previewTimeRef.current; requestRef.current = requestAnimationFrame(animate); } else { if (requestRef.current) cancelAnimationFrame(requestRef.current); } return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, [isPlaying, animate]);
    useEffect(() => { if (!isPlaying && loadedAssets && canvasRef.current) { const ctx = canvasRef.current.getContext('2d'); if (ctx) drawFrame(ctx, previewTimeRef.current, dim.w, dim.h, sceneSlots, loadedAssets.headshot, loadedAssets.logo, loadedAssets.headshot2, loadedAssets.logo2); } }, [loadedAssets, isPlaying, drawFrame, dim, sceneSlots]);

    const recordRatio = async (ratio: '9:16' | '16:9' | '1:1'): Promise<void> => {
        return new Promise(async (resolve) => {
            setAspectRatio(ratio); await new Promise(r => setTimeout(r, 500)); if (!canvasRef.current || !loadedAssets) return resolve();
            const currentDim = getDim(ratio, exportResolution); const canvas = canvasRef.current; const ctx = canvas.getContext('2d'); if (!ctx) return resolve();
            /* Fix: Removed extra closing parenthesis in AudioContext instantiation */
            let aContext: AudioContext | null = null;
            try {
                aContext = new (window.AudioContext || (window as any).webkitAudioContext)();
            } catch (e) {
                console.error("Failed to create AudioContext", e);
                return resolve();
            }
            const audioDest = aContext.createMediaStreamDestination(); let recordingSource: AudioBufferSourceNode | null = null;
            const recAnalyser = aContext.createAnalyser(); recAnalyser.fftSize = 256; const recFreq = new Uint8Array(recAnalyser.frequencyBinCount); const recTime = new Uint8Array(recAnalyser.fftSize);
            const oldAnalyser = analyserRef.current; const oldFreq = freqDataRef.current; const oldTime = timeDataRef.current;
            analyserRef.current = recAnalyser; freqDataRef.current = recFreq; timeDataRef.current = recTime;
            if (audioBuffer) { recordingSource = aContext.createBufferSource(); recordingSource.buffer = audioBuffer; recordingSource.connect(recAnalyser); recAnalyser.connect(audioDest); recordingSource.loop = true; }
            const stream = canvas.captureStream(30); if (audioBuffer) { const audioTracks = audioDest.stream.getAudioTracks(); if (audioTracks.length > 0) stream.addTrack(audioTracks[0]); }
            const mimeTypeOptions = ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'video/mp4;codecs=h264,aac', 'video/mp4;codecs=h264', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'];
            const selectedMimeType = mimeTypeOptions.find(type => MediaRecorder.isTypeSupported(type)) || 'video/webm';
            const targetBitrate = exportResolution === '2k' ? 22000000 : 8000000;
            const mediaRecorder = new MediaRecorder(stream, { mimeType: selectedMimeType, videoBitsPerSecond: targetBitrate }); 
            const chunks: BlobPart[] = []; mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
            mediaRecorder.onstop = async () => { 
                analyserRef.current = oldAnalyser; freqDataRef.current = oldFreq; timeDataRef.current = oldTime; 
                const blob = new Blob(chunks, { type: selectedMimeType }); 
                const url = URL.createObjectURL(blob); 
                const ext = selectedMimeType.includes('mp4') ? 'mp4' : 'webm'; 
                setLastGeneratedBlob({ blob, ratio });
                if (onVideoGenerated) onVideoGenerated(blob, ratio);
                const a = document.createElement('a'); a.href = url; a.download = `property-reel-${ratio.replace(':', 'x')}.${ext}`; 
                document.body.appendChild(a); a.click(); document.body.removeChild(a); 
                if (recordingSource) { try { recordingSource.stop(); } catch(e) {} } 
                if (aContext) { try { await aContext.close(); } catch(e) {} }
                resolve();
            };
            mediaRecorder.start(); if (recordingSource) recordingSource.start(0);
            const start = performance.now(); const recordLoop = () => {
                const now = performance.now(); const elapsed = now - start; if (elapsed >= totalDuration) { mediaRecorder.stop(); return; }
                if (loadedAssets) drawFrame(ctx, elapsed, currentDim.w, currentDim.h, sceneSlots, loadedAssets.headshot, loadedAssets.logo, loadedAssets.headshot2, loadedAssets.logo2); requestAnimationFrame(recordLoop);
            }; requestAnimationFrame(recordLoop);
        });
    };

    const handleGenerateAllFormats = async () => { if (isRecording || isBatchRecording || !loadedAssets) return; setIsBatchRecording(true); setIsPlaying(false); try { await recordRatio('16:9'); await recordRatio('1:1'); await recordRatio('9:16'); } catch (e) { console.error("Batch recording failed", e); } finally { setIsBatchRecording(false); } };
    const handleGenerateVideo = async () => { if (!canvasRef.current || !loadedAssets || isRecording || isBatchRecording) return; setIsRecording(true); setIsPlaying(false); await recordRatio(aspectRatio); setIsRecording(false); };
    
    const formatTime = (ms: number) => { const totalSec = Math.floor(ms / 1000); const s = totalSec % 60; const m = Math.floor(totalSec / 60); return `${m}:${s.toString().padStart(2, '0')}`; };

    return (
        <div className="flex flex-col xl:flex-row gap-8 items-start">
            <div className="flex-grow w-full xl:w-[60%] flex flex-col gap-4">
                <div className="relative w-full aspect-[16/9] md:aspect-auto md:h-[650px] bg-black/40 rounded-[2.5rem] border border-white/5 shadow-inner overflow-hidden flex items-center justify-center p-8 group">
                    <div className={`relative transition-all duration-500 ease-out shadow-[0_40px_100px_-20px_rgba(0,0,0,0.6)] rounded-lg overflow-hidden ${dim.class}`}>
                        <canvas ref={canvasRef} width={dim.w} height={dim.h} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                            <button onClick={() => { if (audioContext.state === 'suspended') audioContext.resume(); setIsPlaying(!isPlaying); }} className="w-20 h-20 rounded-full bg-white/10 backdrop-blur-2xl flex items-center justify-center hover:bg-white/20 transition-all border border-white/20 scale-90 group-hover:scale-100 duration-300">
                                {isPlaying ? ( <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" className="w-10 h-10"><path d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0a.75.75 0 01.75-.75H16.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" /></svg> ) : ( <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" className="w-10 h-10 ml-1"><path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" /></svg> )}
                            </button>
                        </div>
                    </div>
                    <div className="absolute top-8 left-10 flex items-center gap-4"><div className="px-3 py-1.5 bg-red-600 rounded-lg flex items-center gap-2 animate-pulse"><div className="w-2 h-2 rounded-full bg-white"></div><span className="text-[10px] font-black uppercase tracking-widest text-white">Live Monitor</span></div><div className="px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10"><span className="text-[10px] font-mono text-white tracking-widest">{formatTime(previewTimeRef.current)}</span></div></div>
                </div>
                <div className="px-6 space-y-2"><div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-white/5"><div ref={progressFillRef} className="h-full bg-gradient-to-r from-orange-600 via-amber-500 to-orange-400 transition-all duration-100 ease-linear shadow-[0_0_15px_rgba(249,115,22,0.4)]" style={{ width: '0%' }}></div></div><div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase tracking-widest"><span>0:00</span><span>{formatTime(totalDuration)}</span></div></div>
            </div>
            <div className="w-full xl:w-[40%] flex flex-col gap-6">
                <div className="glass-panel p-6 rounded-[2rem] space-y-5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-white/5 pb-3">Configuration</h3>
                    
                    {/* Clean Feed Toggle */}
                    <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 flex items-center justify-between transition-all hover:bg-slate-900">
                        <div className="flex flex-col">
                            <span className="text-[11px] font-black text-white uppercase tracking-widest">Clean Feed</span>
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-tighter mt-0.5">Remove headshots, text & logos</span>
                        </div>
                        <button 
                            onClick={() => setIsCleanFeed(!isCleanFeed)}
                            className={`w-12 h-6 rounded-full transition-all relative ${isCleanFeed ? 'bg-orange-600' : 'bg-slate-800'}`}
                        >
                            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-all ${isCleanFeed ? 'left-7' : 'left-1'}`}></div>
                        </button>
                    </div>

                    <div className="space-y-4 pt-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">1. Delivery Format</label>
                        <div className="grid grid-cols-3 gap-2">
                            {['9:16', '16:9', '1:1'].map((ratio) => (
                                <button key={ratio} disabled={isBatchRecording || isRecording} onClick={() => setAspectRatio(ratio as any)} className={`py-3 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all flex flex-col items-center gap-1 ${aspectRatio === ratio ? 'bg-orange-500 text-white shadow-xl shadow-orange-900/20' : 'bg-slate-800/50 text-slate-500 border border-white/5 hover:bg-slate-800 hover:text-slate-300'} disabled:opacity-30`}>{ratio}<span className="text-[7px] opacity-60">{ratio === '9:16' ? 'Stories' : ratio === '16:9' ? 'Landscape' : 'Square'}</span></button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-3 pt-2 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Export Resolution</label>
                            <span className="text-[8px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 uppercase tracking-wider">Free ($0 extra)</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                disabled={isBatchRecording || isRecording}
                                onClick={() => setExportResolution('2k')}
                                className={`py-2.5 px-3 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer disabled:opacity-30 ${
                                    exportResolution === '2k'
                                        ? 'bg-orange-500/15 border-orange-500 text-white shadow-lg'
                                        : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 animate-pulse"></span>
                                    2K Master Quad HD
                                </span>
                                <span className="text-[8px] text-slate-400">
                                    {aspectRatio === '9:16' ? '1440 × 2560' : aspectRatio === '16:9' ? '2560 × 1440' : '2048 × 2048'} • 22 Mbps
                                </span>
                            </button>
                            <button
                                type="button"
                                disabled={isBatchRecording || isRecording}
                                onClick={() => setExportResolution('1080p')}
                                className={`py-2.5 px-3 rounded-xl border text-left flex flex-col gap-0.5 transition-all cursor-pointer disabled:opacity-30 ${
                                    exportResolution === '1080p'
                                        ? 'bg-orange-500/15 border-orange-500 text-white shadow-lg'
                                        : 'bg-slate-900/50 border-white/5 text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                                    1080p Full HD
                                </span>
                                <span className="text-[8px] text-slate-500">
                                    {aspectRatio === '9:16' ? '1080 × 1920' : aspectRatio === '16:9' ? '1920 × 1080' : '1080 × 1080'} • 8 Mbps
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] space-y-5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-white/5 pb-3">2. Cinematics</h3>
                    <div className="space-y-6">
                        <div className="space-y-3"><div className="flex justify-between items-end"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Transition Fade</label><span className="text-xs font-mono text-orange-500 font-bold">{fadeDuration.toFixed(1)}s</span></div><input type="range" min="0" max="2.0" step="0.1" value={fadeDuration} onChange={(e) => setFadeDuration(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-orange-500" /></div>
                        <div className="space-y-3"><div className="flex justify-between items-end"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Motion Speed</label><span className="text-xs font-mono text-orange-500 font-bold">{videoDurationSec}s</span></div><input type="range" min="5" max="30" step="1" value={videoDurationSec} onChange={(e) => setVideoDurationSec(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-orange-500" /></div>
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] space-y-5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-white/5 pb-3">3. Soundtrack</h3>
                    <div className="space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="flex-grow flex items-center gap-3 px-4 py-3 bg-slate-900 rounded-xl border border-white/5 truncate group hover:border-orange-500/30 transition-colors">{isAudioLoading ? ( <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div> ) : ( <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4 text-orange-500"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 1.11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 1.11-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" /></svg> )}<span className="text-[11px] font-bold text-slate-300 truncate">{activeTrackName}</span></div>
                            <button onClick={nextTrack} className="p-3.5 bg-slate-800 hover:bg-slate-700 border border-white/5 rounded-xl text-slate-400 transition-all hover:scale-105 active:scale-95 shadow-lg" title="Shuffled Preset"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg></button>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 block">Professional Audio Library</label>
                           <div className="relative group">
                              <select 
                                onChange={(e) => {
                                  const selected = PROFESSIONAL_AUDIO_LIBRARY.find(t => t.url === e.target.value);
                                  if (selected) handleAudioSelection(selected.url, selected.name);
                                }}
                                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3.5 text-[11px] font-bold text-slate-300 outline-none focus:ring-1 focus:ring-orange-500 appearance-none cursor-pointer hover:border-orange-500/30 transition-all"
                                value={customAudio?.url || ""}
                              >
                                <option value="" disabled>Choose a high-end track...</option>
                                {PROFESSIONAL_AUDIO_LIBRARY.map(track => (
                                  <option key={track.url} value={track.url}>{track.name}</option>
                                ))}
                              </select>
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-orange-500 transition-colors">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                              </div>
                           </div>
                        </div>
                    </div>
                </div>
                <div className="glass-panel p-6 rounded-[2rem] space-y-5">
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-white/5 pb-3">4. Visualizer</h3>
                    <div className="space-y-6">
                        <div className="grid grid-cols-3 gap-2">
                            {(['bars', 'waveform', 'dots'] as const).map((style) => (
                                <button key={style} onClick={() => setVisualizerStyle(style)} className={`py-2 rounded-lg text-[9px] font-black uppercase transition-all ${visualizerStyle === style ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-500 hover:text-slate-300'}`}>{style}</button>
                            ))}
                        </div>
                        <div className="space-y-3">
                            <div className="flex justify-between items-end"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Luminosity</label><span className="text-xs font-mono text-orange-500 font-bold">{Math.round(visualizerLuminosity * 100)}%</span></div>
                            <input type="range" min="0" max="1" step="0.05" value={visualizerLuminosity} onChange={(e) => setVisualizerLuminosity(Number(e.target.value))} className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-orange-500" />
                        </div>
                    </div>
                </div>
                <div className="space-y-3 pt-2">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">5. Export</h3>
                    <button onClick={handleGenerateVideo} disabled={isRecording || isBatchRecording || !loadedAssets} className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl transition-all flex items-center justify-center gap-3 ${isRecording || isBatchRecording ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-br from-orange-600 via-orange-500 to-amber-500 text-white hover:scale-[1.02] active:scale-95 shadow-orange-900/40'}`}>{isRecording ? ( <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Rendering...</> ) : isBatchRecording ? ( 'Queue Active...' ) : ( <><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm.53 5.47a.75.75 0 00-1.06 0l-3 3a.75.75 0 101.06 1.06l1.72-1.72v5.69a.75.75 0 001.5 0v-5.69l1.72 1.72a.75.75 0 101.06-1.06l-3-3z" clipRule="evenodd" /></svg>Export {aspectRatio} Reel</> )}</button>
                    <button onClick={handleGenerateAllFormats} disabled={isRecording || isBatchRecording || !loadedAssets} className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] border-2 border-white/5 text-slate-400 hover:bg-white/5 transition-all flex items-center justify-center gap-3 ${isRecording || isBatchRecording ? 'opacity-30' : ''}`}>{isBatchRecording ? 'Processing All Formats...' : 'Generate all ratios (MP4)'}</button>
                    <p className="text-[9px] text-slate-600 text-center uppercase tracking-widest font-bold">Recommended for TikTok, Instagram & Facebook</p>
                </div>
            </div>
        </div>
    );
};

interface GeneratedCanvasProps {
    index: number;
    id: string;
    template: string;
    mode: string;
    data: any;
    assets: SocialAssets;
    images: string[];
    colors: { primary: string };
    width: number;
    height: number;
    registerCanvas: (id: string, canvas: HTMLCanvasElement, filename: string) => void;
    onAssetDrop?: (files: FileList | File[], key: string) => void;
}

const GeneratedCanvas: React.FC<GeneratedCanvasProps> = ({ 
    index, id, template, mode, data, assets, images, colors, width, height, registerCanvas, onAssetDrop 
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [loadedAssets, setLoadedAssets] = useState<{ propImgs: HTMLImageElement[], headshot: HTMLImageElement | null, logo: HTMLImageElement | null, headshot2?: HTMLImageElement | null, logo2?: HTMLImageElement | null } | null>(null);

    // Lazy Loading: Only observe visibility
    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsVisible(true);
                observer.disconnect();
            }
        }, { threshold: 0.1, rootMargin: '200px' });
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        if (!isVisible) return;
        const load = async () => {
            const loadImage = (src: string) => new Promise<HTMLImageElement | null>((resolve) => {
                if (!src) return resolve(null);
                const img = new Image();
                img.crossOrigin = "anonymous";
                img.onload = () => resolve(img);
                img.onerror = () => {
                    const fallbackImg = new Image();
                    fallbackImg.onload = () => resolve(fallbackImg);
                    fallbackImg.onerror = () => resolve(null);
                    fallbackImg.src = src;
                };
                img.src = src;
            });
            try {
                const propImgsRaw = await Promise.all(images.map((src: string) => loadImage(src)));
                const propImgs = propImgsRaw.filter((img): img is HTMLImageElement => img !== null);
                const headshot = assets.headshot ? await loadImage(assets.headshot) : null;
                const logo = assets.logo ? await loadImage(assets.logo) : null;
                const hs2Src = assets.headshot2 || (assets as any).agent2Headshot || data.agent2Headshot || data.agent2_headshot;
                const lg2Src = assets.logo2 || (assets as any).agent2Logo || data.agent2Logo || data.agent2_logo;
                const headshot2 = hs2Src ? await loadImage(hs2Src) : null;
                const logo2 = lg2Src ? await loadImage(lg2Src) : null;
                setLoadedAssets({ propImgs, headshot, logo, headshot2, logo2 });
            } catch (e) { console.error("Failed to load static assets", e); }
        }; load();
    }, [images, assets.headshot, assets.logo, assets.headshot2, assets.logo2, (assets as any).agent2Headshot, (assets as any).agent2Logo, assets.assetLibrary, data, isVisible]);

    useEffect(() => {
        if (canvasRef.current && loadedAssets && isVisible) {
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                // Staggered Redraw: Add a delay based on index to spread the load
                const delay = Math.min(index * 100, 2000); // Max 2s delay
                const timeoutId = setTimeout(() => {
                    drawRealEstateTemplate(ctx, width, height, template, mode, data, loadedAssets, colors.primary);
                    const filename = `${mode.replace(' ', '_')}_${template}.jpg`;
                    registerCanvas(id, canvasRef.current!, filename);
                }, delay);
                return () => clearTimeout(timeoutId);
            }
        }
    }, [width, height, template, mode, data, loadedAssets, colors.primary, id, registerCanvas, isVisible, index]);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            onAssetDrop?.(e.dataTransfer.files, 'logo');
        }
    };

    return (
        <div 
            ref={containerRef} 
            className={`flex flex-col gap-2 group min-h-[300px] transition-all duration-300 ${isDragging ? 'scale-[1.02]' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            <div className={`relative aspect-square w-full bg-slate-900 rounded-2xl overflow-hidden border transition-all duration-500 shadow-xl ${isDragging ? 'border-orange-500 ring-4 ring-orange-500/20' : 'border-white/5 group-hover:border-orange-500/30 group-hover:scale-[1.01]'}`}>
                {isVisible ? (
                    <>
                        <canvas ref={canvasRef} width={width} height={height} className="w-full h-full object-contain" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                            <button onClick={() => { if (!canvasRef.current) return; const link = document.createElement('a'); link.download = `${mode.replace(' ', '_')}_${template}.jpg`; link.href = canvasRef.current.toDataURL('image/jpeg', 1.0); link.click(); }} className="p-3 rounded-xl bg-white text-slate-950 shadow-2xl hover:scale-110 active:scale-95 transition-all"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg></button>
                        </div>
                        {isDragging && (
                            <div className="absolute inset-0 bg-orange-500/20 backdrop-blur-sm flex items-center justify-center border-4 border-dashed border-orange-500 rounded-2xl z-20">
                                <div className="bg-slate-950/90 px-6 py-4 rounded-2xl border border-orange-500/30 shadow-2xl flex flex-col items-center gap-2 animate-bounce">
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-8 h-8 text-orange-500"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                                    <span className="text-xs font-black text-white uppercase tracking-widest">Drop to Override Logo</span>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <div className="w-8 h-8 border-2 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                    </div>
                )}
            </div>
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">{template.replace(/-/g, ' ')}</span>
        </div>
    );
};


export const SocialMediaGenerator: React.FC<{
    assets: SocialAssets;
    setAssets: React.Dispatch<React.SetStateAction<SocialAssets>>;
    brandingColor: string;
    setBrandingColor: (color: string) => void;
    onRowSelected?: (data: any) => void;
}> = ({ assets, setAssets, brandingColor, setBrandingColor, onRowSelected }) => {
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'static' | 'video' | 'google-earth' | 'qr-code'>('static');
  const [staticRatio, setStaticRatio] = useState<'1:1' | '9:16' | '16:9'>('1:1');
  const [staticTab, setStaticTab] = useState<'listed' | 'sold' | 'blank'>('listed');
  const [isExportingAll, setIsExportingAll] = useState(false);
  const [generatedVideos, setGeneratedVideos] = useState<{[key: string]: Blob}>({});
  const [selectedImageIndices, setSelectedImageIndices] = useState<number[]>([]);
  const [selectedForSocialKit, setSelectedForSocialKit] = useState<Set<number>>(new Set());

  useEffect(() => {
    setSelectedForSocialKit(prev => {
      const next = new Set(prev);
      // If we have new images and nothing was selected, or if we want to auto-select new ones
      if (next.size === 0 && assets.propertyImages.length > 0) {
        assets.propertyImages.forEach((_, i) => next.add(i));
      }
      // Clean up out of bounds
      Array.from(next).forEach(idx => {
        if (idx >= assets.propertyImages.length) next.delete(idx);
      });
      return next;
    });
  }, [assets.propertyImages.length]);

  const toggleImageSelection = (idx: number) => {
    setSelectedForSocialKit(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const removePropertyImage = (idx: number) => {
    setAssets(prev => {
        const next = [...prev.propertyImages];
        next.splice(idx, 1);
        return { ...prev, propertyImages: next };
    });
    setSelectedForSocialKit(prev => {
        const next = new Set<number>();
        prev.forEach(id => {
            if (id < idx) next.add(id);
            else if (id > idx) next.add(id - 1);
        });
        return next;
    });
  };

  const [showWebhookHelp, setShowWebhookHelp] = useState(false);
  
  const [webhookUrl, setWebhookUrl] = useState<string>(() => {
    const saved = localStorage.getItem('pmd_sheets_webhook');
    return saved && saved.startsWith('http') ? saved : PERMANENT_WEBHOOK_URL;
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'sheets' | 'local'>(() => {
    return (localStorage.getItem('pmd_data_source') as 'sheets' | 'local') || 'sheets';
  });

  const [agentColors, setAgentColors] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('pmd_agent_color_memory');
    return saved ? JSON.parse(saved) : {};
  });

  const realtorColIdx = useMemo(() => { const idx = csvHeaders.findIndex(h => h.toLowerCase().includes('realtor')); if (idx !== -1) return idx; return csvHeaders.findIndex(h => h.toLowerCase().includes('agent')); }, [csvHeaders]);
  const addressColIdx = useMemo(() => csvHeaders.findIndex(h => h.toLowerCase().includes('address')), [csvHeaders]);
  const statusColIdx = useMemo(() => csvHeaders.findIndex(h => h.toLowerCase().includes('status')), [csvHeaders]);
  const unitColIdx = useMemo(() => { return csvHeaders.findIndex(h => { const l = h.toLowerCase(); return l.includes('unit') || l.includes('apt') || l.includes('suite'); }); }, [csvHeaders]);
  
  const reversedIndices = useMemo(() => { 
    return Array.from({ length: csvData.length }, (_, i) => i).filter(idx => { 
        const row = csvData[idx]; 
        if (!row) return false;
        const hasContent = row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '');
        return hasContent;
    }).reverse(); 
  }, [csvData]);
  
    const selectedData = useMemo(() => { 
    if (csvData.length === 0 || selectedRowIndex < 0 || selectedRowIndex >= csvData.length) return {}; 
    const row = csvData[selectedRowIndex]; 
    if (!row) return {};
    const obj: any = {}; 
    csvHeaders.forEach((h, i) => { 
      obj[h] = row[i]; 
      const key = h.toLowerCase().replace(/[^a-z0-9]/g, ''); 
      if (!obj[key]) obj[key] = row[i]; 
    }); 
    // Explicitly map column AI (index 34) and column AJ (index 35)
    if (row[34]) {
      obj['col34'] = row[34];
      obj['ai'] = row[34];
    }
    if (row[35]) {
      obj['col35'] = row[35];
      obj['aj'] = row[35];
    }
    const findVal = (keys: string[]) => {
      for (const k of keys) {
        if (obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== '') return String(obj[k]);
        const clean = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (obj[clean] !== undefined && obj[clean] !== null && String(obj[clean]).trim() !== '') return String(obj[clean]);
      }
      return '';
    };

    if (!obj.realtor && obj.agent) obj.realtor = obj.agent; 

    const agent2NameVal = findVal(['agent2', 'realtor2', 'coagent', 'colistingagent', 'agent2name', 'realtor2name', 'colistingagentname', 'coagentname', 'secondagent', 'secondrealtor', 'secondagentname', 'secondrealtorname', 'colistingrepresentative', 'co_agent', 'co_realtor', 'agent2_name', 'realtor2_name']);
    const agent2PhoneVal = findVal(['agent2phone', 'agent2phonenumber', 'phone2', 'phonenumber2', 'realtor2phone', 'coagentphone', 'colistingphone', 'colistingagentphone', 'secondagentphone', 'secondrealtorphone', 'agent2_phone', 'agent2_phonenumber', 'co_phone']);
    const agent2EmailVal = findVal(['agent2email', 'agent2emailaddress', 'email2', 'realtor2email', 'coagentemail', 'colistingemail', 'colistingagentemail', 'secondagentemail', 'secondrealtoremail', 'agent2_email', 'co_email']);
    const agent2BrokerageVal = findVal(['agent2brokerage', 'brokerage2', 'coagentbrokerage', 'colistingbrokerage', 'colistingagentbrokerage', 'secondagentbrokerage', 'secondrealtorbrokerage', 'company2', 'agent2_brokerage', 'co_brokerage']);

    if (agent2NameVal) {
      obj.agent2 = agent2NameVal;
      obj.realtor2 = agent2NameVal;
      obj.agent2Name = agent2NameVal;
      obj.agent2name = agent2NameVal;
    }
    if (agent2PhoneVal) {
      obj.agent2phone = agent2PhoneVal;
      obj.phone2 = agent2PhoneVal;
      obj.agent2PhoneNumber = agent2PhoneVal;
      obj.agent2phonenumber = agent2PhoneVal;
    }
    if (agent2EmailVal) {
      obj.agent2email = agent2EmailVal;
      obj.email2 = agent2EmailVal;
      obj.agent2Email = agent2EmailVal;
    }
    if (agent2BrokerageVal) {
      obj.agent2brokerage = agent2BrokerageVal;
      obj.brokerage2 = agent2BrokerageVal;
      obj.agent2Brokerage = agent2BrokerageVal;
    }
    if (!obj.address) obj.address = obj.propertyaddress || obj.location || obj.street || '';
    if (!obj.city) obj.city = obj.region || obj.neighborhood || obj.town || '';
    if (!obj.state) obj.state = obj.province || '';
    if (!obj.zip) obj.zip = obj.zipcode || obj.postalcode || '';
    if (!obj.unit) { 
      if (obj.apt) obj.unit = obj.apt; 
      else if (obj.suite) obj.unit = obj.suite; 
    } 
    return obj; 
  }, [csvData, csvHeaders, selectedRowIndex]);

  useEffect(() => {
    const agent = selectedData.realtor;
    if (agent && agentColors[agent] && agentColors[agent] !== brandingColor) {
        setBrandingColor(agentColors[agent]);
    }
  }, [selectedData.realtor, agentColors, setBrandingColor]);

  const handleSaveAgentColor = () => {
    const agent = selectedData.realtor;
    if (!agent) return;
    const newMap = { ...agentColors, [agent]: brandingColor };
    setAgentColors(newMap);
    localStorage.setItem('pmd_agent_color_memory', JSON.stringify(newMap));
    alert(`Branding color remembered for ${agent}`);
  };

  // Row-based asset auto-matching
  const lastMatchedRow = useRef<number>(-1);
  const lastMatchedHeadshot = useRef<string | null>(null);
  const lastMatchedLogo = useRef<string | null>(null);
  const lastMatchedHeadshot2 = useRef<string | null>(null);
  const lastMatchedLogo2 = useRef<string | null>(null);
  
  useEffect(() => {
    if (!selectedData || Object.keys(selectedData).length === 0) return;
    
    // Only reset state cache if the row has explicitly changed
    const rowChanged = lastMatchedRow.current !== selectedRowIndex;
    if (rowChanged) {
        lastMatchedHeadshot.current = null;
        lastMatchedLogo.current = null;
        lastMatchedHeadshot2.current = null;
        lastMatchedLogo2.current = null;
        lastMatchedRow.current = selectedRowIndex;
    }

    const findAsset = (refName?: string) => {
        if (!refName || typeof refName !== 'string') return null;
        const val = String(refName).trim();
        if (!val) return null;
        if (val.startsWith('http') || val.startsWith('data:') || val.startsWith('blob:')) return val;
        if (assets.assetLibrary) {
            const cleanRef = val.toLowerCase().split('.')[0];
            const matchKey = Object.keys(assets.assetLibrary).find(k => k.toLowerCase().split('.')[0] === cleanRef);
            return matchKey ? assets.assetLibrary[matchKey] : null;
        }
        return null;
    };
    
    const getVal = (keys: string[]) => {
        for (const k of keys) {
            const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (selectedData[k]) return selectedData[k];
            if (selectedData[normalized]) return selectedData[normalized];
        }
        return null;
    };
    
    const csvHeadshotVal = getVal(['headshot', 'ai', 'col34', '@Headshot', 'agent_headshot', 'agent_photo', 'photo', 'agent_url', 'headshot_url', 'profile_image', 'profile_photo', 'agent_image', 'agent_pic', 'agent_portrait', 'r_headshot', 'remote_headshot', 'r']);
    const csvLogoVal = getVal(['logo', 'aj', 'col35', '@Logo', 'brand_asset', 'brand_asset_url', 'logo_url', 'brokerage_logo_url', 'company_logo', 'branding_logo', 'brand_image', 'brand_url', 'logo_image', 'brokerage_image', 'brokerage_logo', 'brand_logo', 'brand', 'broker_logo', 'r_logo', 'remote_logo']);
    const csvHeadshot2Val = getVal(['headshot2', 'agent2headshot', 'agent2photo', 'realtor2headshot', 'col36', 'agent2_headshot', 'agent2_photo', 'photo2', 'headshot_2', 'headshot_url2', 'coagentheadshot', 'colistingheadshot']);
    const csvLogo2Val = getVal(['logo2', 'agent2logo', 'realtor2logo', 'brokerage2logo', 'col37', 'agent2_logo', 'logo_2', 'logo_url2', 'coagentlogo', 'colistinglogo']);
    
    const matchedHeadshot = findAsset(csvHeadshotVal);
    const matchedLogo = findAsset(csvLogoVal);
    const matchedHeadshot2 = findAsset(csvHeadshot2Val);
    const matchedLogo2 = findAsset(csvLogo2Val);
    
    const updates: Partial<SocialAssets> = {};
    let hasChanges = false;
    
    // Auto-fill if we have a match and it differs from lastMatched cache
    if (matchedHeadshot && matchedHeadshot !== lastMatchedHeadshot.current) { 
        if (matchedHeadshot !== assets.headshot) {
            updates.headshot = matchedHeadshot; 
            hasChanges = true; 
        }
        lastMatchedHeadshot.current = matchedHeadshot;
    }
    
    if (matchedLogo && matchedLogo !== lastMatchedLogo.current) { 
        if (matchedLogo !== assets.logo) {
            updates.logo = matchedLogo; 
            hasChanges = true; 
            extractColorFromImage(matchedLogo).then(color => { 
                setBrandingColor(color); 
                localStorage.setItem('pmd_branding_color', color); 
            }).catch(e => console.warn("Failed to extract color:", e));
        }
        lastMatchedLogo.current = matchedLogo;
    }

    if (matchedHeadshot2 && matchedHeadshot2 !== lastMatchedHeadshot2.current) { 
        if (matchedHeadshot2 !== assets.headshot2) {
            updates.headshot2 = matchedHeadshot2; 
            hasChanges = true; 
        }
        lastMatchedHeadshot2.current = matchedHeadshot2;
    }
    
    if (matchedLogo2 && matchedLogo2 !== lastMatchedLogo2.current) { 
        if (matchedLogo2 !== assets.logo2) {
            updates.logo2 = matchedLogo2; 
            hasChanges = true; 
        }
        lastMatchedLogo2.current = matchedLogo2;
    }
    
    if (hasChanges) { 
        setAssets(prev => ({ ...prev, ...updates })); 
    }
  }, [selectedRowIndex, assets.assetLibrary, selectedData, setAssets, setBrandingColor]);

  useEffect(() => { if (onRowSelected && Object.keys(selectedData).length > 0) { onRowSelected(selectedData); } }, [selectedRowIndex, selectedData, onRowSelected]);
  useEffect(() => { if (csvData.length > 0 && statusColIdx !== -1) { const rowStatus = (csvData[selectedRowIndex][statusColIdx] || '').toLowerCase(); if (rowStatus.includes('sold') || rowStatus.includes('closed')) { setStaticTab('sold'); } else { setStaticTab('listed'); } } }, [selectedRowIndex, csvData, statusColIdx]);
  
  const shuffleImages = useCallback((forceShuffle = false) => {
    const selectedIndices = Array.from(selectedForSocialKit);
    if (selectedIndices.length > 0) {
      let pool = [...selectedIndices];
      if (forceShuffle) {
        for (let i = pool.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [pool[i], pool[j]] = [pool[j], pool[i]];
        }
      }
      let finalIndices = [];
      if (pool.length === 1) {
        finalIndices = [pool[0], pool[0]];
      } else {
        const countToPick = Math.max(2, Math.min(pool.length, 3));
        finalIndices = pool.slice(0, countToPick);
      }
      setSelectedImageIndices(finalIndices);
    } else {
      setSelectedImageIndices([]);
    }
  }, [assets.propertyImages.length, selectedForSocialKit]);

  useEffect(() => { 
    shuffleImages(false);
  }, [assets.propertyImages.length, selectedRowIndex, shuffleImages]);

  const selectedForSocialKitImages = useMemo(() => {
    return Array.from(selectedForSocialKit).map((idx: number) => assets.propertyImages[idx]).filter(Boolean);
  }, [assets.propertyImages, selectedForSocialKit]);

  const randomizedImagesForStatic = useMemo(() => { return selectedImageIndices.map((idx: number) => assets.propertyImages[idx]).filter(Boolean); }, [selectedImageIndices, assets.propertyImages]);
  
  useEffect(() => { 
    const savedData = localStorage.getItem('pmd_csv_data'); 
    const savedHeaders = localStorage.getItem('pmd_csv_headers'); 
    const savedIndex = localStorage.getItem('pmd_selected_row_index'); 
    const savedColor = localStorage.getItem('pmd_branding_color');
    const savedSource = localStorage.getItem('pmd_data_source');
    if (savedColor) { setBrandingColor(savedColor); }
    if (savedSource) { setDataSource(savedSource as 'sheets' | 'local'); }
    if (savedData && savedHeaders) { 
      try { 
        const parsedData = JSON.parse(savedData); 
        const parsedHeaders = JSON.parse(savedHeaders); 
        if (parsedData.length > 0) { 
          setCsvHeaders(parsedHeaders); 
          setCsvData(parsedData); 
          if (savedIndex !== null) { 
            const restoredIdx = parseInt(savedIndex); 
            if (restoredIdx >= 0 && restoredIdx < parsedData.length) { setSelectedRowIndex(restoredIdx); } 
            else { setSelectedRowIndex(parsedData.length - 1); } 
          } else { setSelectedRowIndex(parsedData.length - 1); } 
        } 
      } catch (e) { console.error("Failed to load saved CSV", e); } 
    } 
  }, []);

  useEffect(() => { if (csvData.length > 0) { localStorage.setItem('pmd_selected_row_index', selectedRowIndex.toString()); } }, [selectedRowIndex, csvData.length]);
  useEffect(() => { localStorage.setItem('pmd_branding_color', brandingColor); }, [brandingColor]);
  useEffect(() => { localStorage.setItem('pmd_sheets_webhook', webhookUrl); }, [webhookUrl]);
  useEffect(() => { localStorage.setItem('pmd_data_source', dataSource); }, [dataSource]);

  const canvasRegistry = useRef<{[key: string]: {canvas: HTMLCanvasElement, filename: string}}>({});
  const registerCanvas = useCallback((id: string, canvas: HTMLCanvasElement, filename: string) => { canvasRegistry.current[id] = { canvas, filename }; }, []);
  
  const handleFiles = (files: FileList | File[] | null, key: string) => {
    if (!files || (files instanceof FileList && files.length === 0) || (Array.isArray(files) && files.length === 0)) return;
    const fileArray = files instanceof FileList ? Array.from(files) : files;
    if (key === 'csv') { const file = fileArray[0]; const reader = new FileReader(); reader.onload = (event) => { const text = event.target?.result as string; const rows = parseCSV(text); if (rows.length > 0) { const headers = rows[0]; const data = rows.slice(1).filter(row => row.some(cell => cell.trim() !== '')); setCsvHeaders(headers); setCsvData(data); setDataSource('local'); const freshIdx = data.length - 1; setSelectedRowIndex(freshIdx); localStorage.setItem('pmd_csv_headers', JSON.stringify(headers)); localStorage.setItem('pmd_csv_data', JSON.stringify(data)); localStorage.setItem('pmd_selected_row_index', freshIdx.toString()); localStorage.setItem('pmd_data_source', 'local'); } }; reader.readAsText(file); }
    else if (key === 'headshot' || key === 'logo' || key === 'headshot2' || key === 'logo2' || key === 'library') { 
      Promise.all(fileArray.map(f => new Promise<{name: string, data: string}>((res) => { 
        const r = new FileReader(); 
        r.onload = (e) => res({ name: f.name, data: e.target?.result as string }); 
        r.readAsDataURL(f); 
      }))).then(results => { 
        const newMap = { ...(assets.assetLibrary || {}) }; 
        results.forEach(r => { newMap[r.name] = r.data; }); 
        const singleUpdate: any = { assetLibrary: newMap }; 
        if (key !== 'library' && results.length > 0) { 
          singleUpdate[key] = results[0].data; 
        }
        setAssets(prev => ({ ...prev, ...singleUpdate })); 
        if ((key === 'logo' || key === 'logo2') && results.length > 0) { 
          extractColorFromImage(results[0].data).then(color => { 
            setBrandingColor(color); 
          }); 
        } 
      }); 
    }
    else if (key === 'property') { Promise.all(fileArray.map(f => new Promise<string>((res) => { const r = new FileReader(); r.onload = (e) => res(e.target?.result as string); r.readAsDataURL(f); }))).then(urls => setAssets(prev => ({ ...prev, propertyImages: [...prev.propertyImages, ...urls] }))); }
  };

  const removeLibraryAsset = (name: string) => {
    setAssets(prev => {
        const newMap = { ...prev.assetLibrary };
        delete newMap[name];
        return { ...prev, assetLibrary: newMap };
    });
  };

  const handleFetchFromSheets = useCallback(async () => {
    const trimmedUrl = webhookUrl.trim();
    if (!trimmedUrl || !trimmedUrl.startsWith('http')) {
        alert("Please provide a valid Google Sheets script URL.");
        return;
    }
    
    if (trimmedUrl.includes("PASTE_YOUR_ID_HERE")) {
        alert("You are using the placeholder URL. Please follow the instructions in the (?) help icon to create your own Google Sheets link.");
        return;
    }

    setIsFetching(true);
    setSyncStatus('idle');
    setSyncNotice(null);
    
    try {
        console.log("Fetching live data via sync proxy:", trimmedUrl);
        
        let rawData: any = null;
        let fallbackUsed = false;

        // 1. First attempt: Server-side sync proxy (handles CORS, redirects, Google Docs URLs, and automatic fallback)
        try {
            const proxyResp = await fetch(`/api/sheets-sync?url=${encodeURIComponent(trimmedUrl)}`);
            if (proxyResp.ok) {
                const json = await proxyResp.json();
                if (json && json.success && Array.isArray(json.data) && json.data.length > 0) {
                    rawData = json.data;
                    fallbackUsed = Boolean(json.fallbackUsed);
                }
            } else if (proxyResp.status === 404) {
                // If proxy route was 404 or target was 404, attempt with default
                const defaultResp = await fetch(`/api/sheets-sync?url=${encodeURIComponent(PERMANENT_WEBHOOK_URL)}`);
                if (defaultResp.ok) {
                    const defaultJson = await defaultResp.json();
                    if (defaultJson && defaultJson.success && Array.isArray(defaultJson.data)) {
                        rawData = defaultJson.data;
                        fallbackUsed = true;
                    }
                }
            }
        } catch (proxyErr) {
            console.warn("Proxy fetch error, attempting direct fetch:", proxyErr);
        }

        // 2. Direct fetch fallback if proxy did not return data
        if (!rawData) {
            try {
                const cacheBuster = `t=${Date.now()}`;
                const finalUrl = trimmedUrl.includes('?') ? `${trimmedUrl}&${cacheBuster}` : `${trimmedUrl}?${cacheBuster}`;
                const response = await fetch(finalUrl);
                if (response.ok) {
                    rawData = await response.json();
                } else if (response.status === 404 && trimmedUrl !== PERMANENT_WEBHOOK_URL) {
                    // Try permanent webhook as fallback
                    const defaultResp = await fetch(PERMANENT_WEBHOOK_URL);
                    if (defaultResp.ok) {
                        rawData = await defaultResp.json();
                        fallbackUsed = true;
                    }
                }
            } catch (directErr) {
                console.warn("Direct fetch also failed:", directErr);
            }
        }

        if (rawData && Array.isArray(rawData) && rawData.length > 0) {
            const cleanData = rawData.filter(row => 
                Array.isArray(row) && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')
            );

            if (cleanData.length < 1) { 
                alert("Connected successfully, but the sheet appears to be empty.");
                setSyncStatus('error');
                return; 
            }

            const headers = cleanData[0].map((h: any) => String(h));
            const rows = cleanData.slice(1).map((row: any[]) => row.map(cell => cell === null || cell === undefined ? "" : String(cell)));
            
            setCsvHeaders(headers);
            setCsvData(rows);
            setDataSource('sheets');
            
            const lastIdx = rows.length - 1;
            setSelectedRowIndex(lastIdx >= 0 ? lastIdx : 0);
            
            localStorage.setItem('pmd_csv_headers', JSON.stringify(headers));
            localStorage.setItem('pmd_csv_data', JSON.stringify(rows));
            localStorage.setItem('pmd_selected_row_index', (lastIdx >= 0 ? lastIdx : 0).toString());
            localStorage.setItem('pmd_data_source', 'sheets');
            
            if (fallbackUsed) {
                setSyncNotice("Your custom URL was unreachable (404/Error). We automatically loaded the default PMD bookings sheet for you.");
            }
            
            setSyncStatus('success');
            setTimeout(() => setSyncStatus('idle'), 3500);
        } else if (rawData && rawData.error) {
            throw new Error(rawData.error);
        } else {
            throw new Error("Unable to parse rows from Google Sheets response");
        }
    } catch (e) {
        console.error("Fetch from Sheets failed", e);
        setSyncStatus('error');
        const msg = e instanceof Error ? e.message : 'Unknown error';
        
        if (msg.toLowerCase().includes('failed to fetch')) {
            alert(`Connection Failed: "Failed to fetch".\n\nThis usually means:\n1. The URL is incorrect.\n2. The Apps Script is NOT deployed with "Access: Anyone".\n3. Your browser is blocking the request (CORS).\n\nACTION: Re-deploy your script and ensure "Who has access" is set to "Anyone". You can also click "Reset to Default URL" to use the official bookings sheet.`);
        } else if (msg.includes('bookings')) {
            alert(`Tab Error: ${msg}\n\nACTION: Please update your Apps Script code using the (?) help guide. The new version automatically falls back to your first tab if 'bookings' is missing.`);
        } else {
            alert(`Connection Error: ${msg}.\n\nREQUIRED: Ensure your Apps Script is deployed as a Web App with 'Execute as: Me' and 'Who has access: Anyone'. You can also click "Reset to Default" to restore the working PMD bookings sheet.`);
        }
    } finally {
        setIsFetching(false);
    }
  }, [webhookUrl]);

  useEffect(() => {
    if (webhookUrl && webhookUrl.startsWith('http') && !webhookUrl.includes("PASTE_YOUR_ID_HERE") && csvData.length === 0 && dataSource === 'sheets') {
        handleFetchFromSheets();
    }
  }, []);

  const handleVideoGenerated = (blob: Blob, ratio: string) => { setGeneratedVideos(prev => ({ ...prev, [ratio]: blob })); };
  
  const handleDownloadFullKit = async () => {
    if (!assets.propertyImages.length) { alert("Please provide property images first."); return; }
    setIsExportingAll(true);
    try {
        const zip = new JSZip(); const loadImg = (src: string | null) => new Promise<HTMLImageElement | null>((resolve) => { if (!src) return resolve(null); const img = new Image(); img.crossOrigin = "anonymous"; img.src = src; img.onload = () => resolve(img); img.onerror = () => resolve(null); });
        const findAsset = (refName?: string) => { 
            if (!refName || typeof refName !== 'string') return null; 
            const val = String(refName).trim();
            if (!val) return null;
            if (val.startsWith('http') || val.startsWith('data:') || val.startsWith('blob:')) return val;
            if (!assets.assetLibrary) return null;
            const cleanRef = val.toLowerCase().split('.')[0]; 
            const matchKey = Object.keys(assets.assetLibrary).find(k => k.toLowerCase().split('.')[0] === cleanRef); 
            return matchKey ? assets.assetLibrary[matchKey] : null; 
        };
        const getVal = (keys: string[]) => {
            for (const k of keys) {
                const normalized = k.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (selectedData[k]) return selectedData[k];
                if (selectedData[normalized]) return selectedData[normalized];
            }
            return null;
        };
        const csvHeadshotUrl = findAsset(getVal(['headshot', 'ai', 'col34', '@Headshot', 'agent_headshot', 'agent_photo', 'photo', 'agent_url', 'headshot_url', 'profile_image', 'profile_photo', 'agent_image', 'agent_pic', 'agent_portrait', 'r_headshot', 'remote_headshot', 'r'])); 
        const csvLogoUrl = findAsset(getVal(['logo', 'aj', 'col35', '@Logo', 'brand_asset', 'brand_asset_url', 'logo_url', 'brokerage_logo_url', 'company_logo', 'branding_logo', 'brand_image', 'brand_url', 'logo_image', 'brokerage_image', 'brokerage_logo', 'brand_logo', 'brand', 'broker_logo', 'r_logo', 'remote_logo']));
        const csvHeadshot2Url = findAsset(getVal(['headshot2', 'agent2headshot', 'agent2photo', 'realtor2headshot', 'col36', 'agent2_headshot', 'agent2_photo', 'photo2', 'headshot_2', 'headshot_url2', 'coagentheadshot', 'colistingheadshot']));
        const csvLogo2Url = findAsset(getVal(['logo2', 'agent2logo', 'realtor2logo', 'brokerage2logo', 'col37', 'agent2_logo', 'logo_2', 'logo_url2', 'coagentlogo', 'colistinglogo']));

        const [headshotImg, logoImg, headshot2Img, logo2Img] = await Promise.all([ 
            loadImg(csvHeadshotUrl || assets.headshot), 
            loadImg(csvLogoUrl || assets.logo),
            loadImg(csvHeadshot2Url || assets.headshot2 || (assets as any).agent2Headshot),
            loadImg(csvLogo2Url || assets.logo2 || (assets as any).agent2Logo)
        ]);
        const staticPropImgsRaw = await Promise.all(randomizedImagesForStatic.map(src => loadImg(src))); const staticPropImgs = staticPropImgsRaw.filter(img => img !== null) as HTMLImageElement[];
        const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d')!; const ratios = [{ name: '1x1_Instagram_Square', w: 1080, h: 1080 }, { name: '9x16_Stories_Reels', w: 1080, h: 1920 }, { name: '16x9_Facebook_Wide', w: 1920, h: 1080 }];
        for (const ratio of ratios) {
            const folderListed = zip.folder(`Static_Posts/JUST_LISTED/${ratio.name}`); 
            const folderSold = zip.folder(`Static_Posts/JUST_SOLD/${ratio.name}`); 
            const folderBlank = zip.folder(`Static_Posts/Blank/${ratio.name}`);
            canvas.width = ratio.w; 
            canvas.height = ratio.h;
            for (const template of UPDATED_LISTED_VARIANTS) { drawRealEstateTemplate(ctx, ratio.w, ratio.h, template, "JUST LISTED", selectedData, { propImgs: staticPropImgs, headshot: headshotImg, logo: logoImg, headshot2: headshot2Img, logo2: logo2Img }, brandingColor); const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 1.0)); folderListed?.file(`${template}.jpg`, blob); }
            for (const template of SOLD_VARIANTS) { drawRealEstateTemplate(ctx, ratio.w, ratio.h, template, "JUST SOLD", selectedData, { propImgs: staticPropImgs, headshot: headshotImg, logo: logoImg, headshot2: headshot2Img, logo2: logo2Img }, brandingColor); const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 1.0)); folderSold?.file(`${template}.jpg`, blob); }
            for (const template of BLANK_VARIANTS) { drawRealEstateTemplate(ctx, ratio.w, ratio.h, template, "BLANK", selectedData, { propImgs: staticPropImgs, headshot: headshotImg, logo: logoImg, headshot2: headshot2Img, logo2: logo2Img }, brandingColor); const blob = await new Promise<Blob>((res) => canvas.toBlob(b => res(b!), 'image/jpeg', 1.0)); folderBlank?.file(`${template}.jpg`, blob); }
        }
        const videoFolder = zip.folder(`Video_Reels`); (Object.entries(generatedVideos) as [string, Blob][]).forEach(([ratio, blob]) => { const ext = blob.type.includes('mp4') ? 'mp4' : 'webm'; videoFolder?.file(`property-reel-${ratio.replace(':', 'x')}.${ext}`, blob); });
        const content = await zip.generateAsync({ type: 'blob' }); const url = URL.createObjectURL(content); const a = document.createElement('a'); const addressName = selectedData.address ? selectedData.address.replace(/[^a-z0-9]/gi, '_') : 'property'; a.href = url; a.download = `Marketing_Kit_${addressName}.zip`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch (e) { console.error("Failed to generate zip kit", e); alert("Export failed. Please try again."); } finally { setIsExportingAll(false); }
  };
  const assetCount = useMemo(() => Object.keys(assets.assetLibrary || {}).length, [assets.assetLibrary]);

  const webhookScript = `function doGet(e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheets = ss.getSheets();
    var sheet = null;
    
    // Improved Global Search: Case-insensitive, space-tolerant search for a tab matching "bookings"
    for (var i = 0; i < sheets.length; i++) {
      var name = sheets[i].getName().toLowerCase().trim().replace(/\s+/g, '');
      if (name === "bookings") {
        sheet = sheets[i];
        break;
      }
    }
    
    // Fallback: If "bookings" not found, use the first sheet instead of erroring
    if (!sheet && sheets.length > 0) {
      sheet = sheets[0];
    }

    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({
        error: "No sheets found in your spreadsheet."
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var values = sheet.getDataRange().getValues();
    
    // Filter out rows that are entirely empty to find the real header
    var cleanValues = values.filter(function(row) {
      return row.some(function(cell) {
        return cell !== null && cell !== "" && cell !== undefined;
      });
    });

    return ContentService.createTextOutput(JSON.stringify(cleanValues))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      error: "Apps Script Internal Error: " + err.message
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {showWebhookHelp && (
            <div className="fixed inset-0 z-[200] bg-slate-950/90 backdrop-blur-xl flex items-center justify-center p-6" onClick={() => setShowWebhookHelp(false)}>
                <div className="max-w-2xl w-full glass-panel p-8 rounded-[2.5rem] border border-white/10 shadow-2xl space-y-6" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between">
                        <h3 className="text-xl font-black text-white uppercase tracking-tighter">Google Sheets Setup Guide</h3>
                        <button onClick={() => setShowWebhookHelp(false)} className="p-2 text-slate-500 hover:text-white transition-colors"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-6 h-6"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg></button>
                    </div>
                    <div className="space-y-4">
                        <p className="text-slate-400 text-xs leading-relaxed font-medium">1. Ensure you have a tab named <b>bookings</b> in your Google Sheet (or the script will use your first tab). <br/> 2. Go to <b>Extensions &gt; Apps Script</b>. <br/> 3. Delete existing code and paste the snippet below. <br/> 4. Click <b>Deploy &gt; New Deployment</b> (Web App, Execute as 'Me', Access 'Anyone'). <br/> 5. Copy the URL into the field below.</p>
                        <div className="relative group">
                            <pre className="bg-black/60 rounded-2xl p-6 text-[10px] text-orange-400 font-mono overflow-x-auto border border-white/5 whitespace-pre-wrap">{webhookScript}</pre>
                            <button onClick={() => { navigator.clipboard.writeText(webhookScript); alert("Script copied!"); }} className="absolute top-4 right-4 px-3 py-1.5 bg-slate-800 rounded-lg text-[9px] font-black text-white uppercase hover:bg-white hover:text-slate-950 transition-all">Copy Script</button>
                        </div>
                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                           <p className="text-[10px] text-orange-400 font-bold uppercase tracking-widest">Crucial Security Check</p>
                           <p className="text-[9px] text-slate-400 mt-1">When deploying as a Web App, you MUST select <b>"Who has access: Anyone"</b>. Selecting "Only me" will block the browser from refreshing your data.</p>
                        </div>
                    </div>
                </div>
            </div>
        )}

        <div className="lg:col-span-4 space-y-6">
            <div className="glass-panel p-6 rounded-2xl space-y-6">
                <div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">1. Data & Branding</h3></div>
                <div className="space-y-4">
                    <DragDropUploader label="Property Data (CSV)" active={csvData.length > 0} onFiles={(f: any) => handleFiles(f, 'csv')} accept=".csv" small />
                </div>
                
                <div className="space-y-3">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Primary Agent Branding</label>
                    <div className="grid grid-cols-2 gap-4">
                        <DragDropUploader 
                            label="Agent 1 Photo" 
                            subLabel="Headshot" 
                            preview={assets.headshot} 
                            onFiles={(f: any) => handleFiles(f, 'headshot')} 
                            onRemove={() => setAssets(prev => ({ ...prev, headshot: null }))}
                            accept="image/*" 
                            small 
                            multiple 
                            active={assetCount > 0} 
                        />
                        <DragDropUploader 
                            label="Brokerage Logo" 
                            subLabel="Logo 1" 
                            preview={assets.logo} 
                            onFiles={(f: any) => handleFiles(f, 'logo')} 
                            onRemove={() => setAssets(prev => ({ ...prev, logo: null }))}
                            accept="image/*" 
                            small 
                            multiple 
                            active={assetCount > 0} 
                        />
                    </div>
                </div>

                <div className="space-y-3 pt-1 border-t border-white/5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Co-Agent / Second Agent Branding</label>
                    <div className="grid grid-cols-2 gap-4">
                        <DragDropUploader 
                            label="Agent 2 Photo" 
                            subLabel="Headshot 2" 
                            preview={assets.headshot2} 
                            onFiles={(f: any) => handleFiles(f, 'headshot2')} 
                            onRemove={() => setAssets(prev => ({ ...prev, headshot2: null }))}
                            accept="image/*" 
                            small 
                            multiple 
                            active={assetCount > 0} 
                        />
                        <DragDropUploader 
                            label="Logo 2" 
                            subLabel="Brokerage 2" 
                            preview={assets.logo2} 
                            onFiles={(f: any) => handleFiles(f, 'logo2')} 
                            onRemove={() => setAssets(prev => ({ ...prev, logo2: null }))}
                            accept="image/*" 
                            small 
                            multiple 
                            active={assetCount > 0} 
                        />
                    </div>
                </div>
                
                <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block px-1">Asset Library</label>
                    <DragDropUploader 
                        label="Drop to add to Library" 
                        subLabel={`${assetCount} files loaded`}
                        onFiles={(f: any) => handleFiles(f, 'library')} 
                        accept="image/*" 
                        small 
                        multiple 
                        active={assetCount > 0} 
                    />
                    
                    {assetCount > 0 && (
                        <div className="space-y-3">
                            <div className="grid grid-cols-4 gap-2 pt-2 max-h-32 overflow-y-auto pr-1 custom-scrollbar">
                                {Object.entries(assets.assetLibrary || {}).map(([name, data]) => (
                                    <div key={name} className="relative aspect-square rounded-lg overflow-hidden group border border-white/5 bg-slate-900/50">
                                        <img src={data} alt={name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                        <button 
                                            onClick={() => removeLibraryAsset(name)}
                                            className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                                            title={`Delete ${name}`}
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-2.5 h-2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                        </button>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => {
                                    if(window.confirm("Clear all brand assets (library, headshot, logo)?")) {
                                        setAssets({
                                            headshot: null,
                                            logo: null,
                                            assetLibrary: {},
                                            propertyImages: assets.propertyImages,
                                            propertyMasks: assets.propertyMasks
                                        });
                                    }
                                }}
                                className="w-full py-2 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white border border-red-500/20 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all"
                            >
                                Reset All Brand Assets
                            </button>
                        </div>
                    )}
                </div>
                
                {assets.propertyImages.length > 0 && (
                    <div className="pt-4 border-t border-white/5 space-y-3">
                        <div className="flex items-center justify-between px-1">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Selected for Social Kit</label>
                            <span className="text-[9px] font-bold text-orange-500">{selectedForSocialKit.size} / {assets.propertyImages.length}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-2 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
                            {assets.propertyImages.map((url, idx) => (
                                <div 
                                    key={idx} 
                                    onClick={() => toggleImageSelection(idx)}
                                    className={`relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 group transition-all ${selectedForSocialKit.has(idx) ? 'border-orange-500 ring-2 ring-orange-500/20' : 'border-transparent opacity-40 grayscale hover:opacity-70 hover:grayscale-0'}`}
                                >
                                    <img src={url} className="w-full h-full object-cover" alt={`Prop ${idx}`} referrerPolicy="no-referrer" />
                                    {selectedForSocialKit.has(idx) && (
                                        <div className="absolute top-1 right-1 bg-orange-500 rounded-full p-0.5 shadow-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-2 h-2 text-white"><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" /></svg>
                                        </div>
                                    )}
                                    <button 
                                        onClick={(e) => { e.stopPropagation(); removePropertyImage(idx); }}
                                        className="absolute bottom-1 right-1 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                        title="Remove from project"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-2 h-2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="pt-4 border-t border-white/5 space-y-4">
                    <div className="space-y-2">
                        <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Google Sheets Live URL</label>
                                {dataSource === 'local' ? (
                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-orange-500/10 rounded-md border border-orange-500/20">
                                        <div className="w-1 h-1 rounded-full bg-orange-500"></div>
                                        <span className="text-[7px] font-black text-orange-500 uppercase">Local Override</span>
                                    </div>
                                ) : webhookUrl && webhookUrl.startsWith('http') && !webhookUrl.includes("PASTE_YOUR_ID_HERE") && (
                                    <div className="flex items-center gap-1.5 px-1.5 py-0.5 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                                        <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse"></div>
                                        <span className="text-[7px] font-black text-emerald-500 uppercase">Synchronized</span>
                                    </div>
                                )}
                            </div>
                            <button onClick={() => setShowWebhookHelp(true)} className="p-1 text-slate-600 hover:text-orange-500 transition-colors" title="Setup Guide"><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" /></svg></button>
                        </div>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={webhookUrl} 
                                onChange={(e) => setWebhookUrl(e.target.value)} 
                                placeholder="https://script.google.com/macros/s/..." 
                                className="flex-grow bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-slate-300 outline-none focus:ring-1 focus:ring-orange-500 transition-all font-mono"
                            />
                            <button 
                                onClick={handleFetchFromSheets}
                                disabled={isFetching}
                                className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 hover:text-orange-500 transition-all border border-white/5 active:scale-90"
                                title="Refresh 'bookings' Tab"
                            >
                                {isFetching ? (
                                    <div className="w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={4} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
                                )}
                            </button>
                        </div>
                        {webhookUrl !== PERMANENT_WEBHOOK_URL && (
                            <div className="flex items-center justify-between pt-1">
                                <span className="text-[10px] text-slate-500">Custom sheets link in use</span>
                                <button
                                    onClick={() => {
                                        setWebhookUrl(PERMANENT_WEBHOOK_URL);
                                        localStorage.setItem('pmd_sheets_webhook', PERMANENT_WEBHOOK_URL);
                                        setSyncNotice(null);
                                    }}
                                    className="text-[10px] text-orange-400 hover:text-orange-300 underline font-medium cursor-pointer"
                                >
                                    Reset to Default PMD Sheet
                                </button>
                            </div>
                        )}
                        {syncNotice && (
                            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[10px] text-amber-300 flex items-start justify-between gap-2 mt-2">
                                <span>{syncNotice}</span>
                                <button 
                                    onClick={() => setSyncNotice(null)} 
                                    className="text-amber-400 hover:text-white font-bold text-xs"
                                >
                                    ✕
                                </button>
                            </div>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <button 
                            onClick={handleFetchFromSheets}
                            disabled={isFetching}
                            className={`w-full py-3.5 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all flex items-center justify-center gap-2 
                                ${syncStatus === 'success' ? 'bg-emerald-600 text-white shadow-[0_10px_20px_rgba(16,185,129,0.3)] scale-[1.02]' : 
                                    syncStatus === 'error' ? 'bg-red-600 text-white' : 
                                    dataSource === 'local' ? 'bg-orange-500/10 text-orange-500 border border-orange-500/20 hover:bg-orange-500/20' :
                                    'bg-slate-800 text-orange-500 hover:bg-slate-700 border border-orange-500/20'}`}
                        >
                            {isFetching ? (
                                <><div className="w-3 h-3 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div> Connecting...</>
                            ) : syncStatus === 'success' ? (
                                <>Pull Complete ✓</>
                            ) : syncStatus === 'error' ? (
                                <>Pull Failed</>
                            ) : dataSource === 'local' ? (
                                <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" /></svg> Revert to Sheets</>
                            ) : (
                                <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5"><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 13.5 12 21m0 0-7.5-7.5M12 21V3" /></svg> Pull Live Data</>
                            )}
                        </button>
                    </div>
                </div>

                <div className="pt-2 border-t border-white/5 space-y-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Global Branding Color</label>
                    <div className="flex gap-2">
                        <input type="color" value={brandingColor} onChange={(e) => { setBrandingColor(e.target.value); localStorage.setItem('pmd_branding_color', e.target.value); }} className="w-10 h-10 rounded-lg bg-transparent border-none cursor-pointer" />
                        <input type="text" value={brandingColor} onChange={(e) => { setBrandingColor(e.target.value); localStorage.setItem('pmd_branding_color', e.target.value); }} className="flex-grow bg-slate-800 border border-slate-700 rounded-lg px-3 text-xs font-mono" />
                    </div>
                    
                    {selectedData.realtor && (
                        <div className="p-3 bg-slate-900/80 rounded-xl border border-white/5 space-y-2 animate-fade-in-up shadow-inner">
                            <div className="flex items-center justify-between">
                                <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Memory Bank</span>
                                {agentColors[selectedData.realtor] && (
                                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all duration-500 ${viewMode === 'static' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-emerald-600 border-emerald-500/30 text-white shadow-xl shadow-emerald-900/40 ring-1 ring-white/10'}`}>
                                        <div className={`w-1 h-1 rounded-full ${viewMode === 'static' ? 'bg-emerald-500' : 'bg-white'} animate-pulse`}></div>
                                        <span className="text-[7px] font-black uppercase tracking-widest">Assigned</span>
                                    </div>
                                )}
                            </div>
                            <button 
                                onClick={handleSaveAgentColor}
                                className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-black text-slate-300 uppercase tracking-widest transition-all border border-white/5 flex items-center justify-center gap-2 group"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3 h-3 text-orange-500 group-hover:scale-110 transition-transform"><path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z" /></svg>
                                Lock color for Agent
                            </button>
                        </div>
                    )}
                </div>
            </div>
            <div className="glass-panel p-6 rounded-2xl space-y-6"><div className="flex items-center justify-between"><h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest">2. Select Property</h3></div>
                {csvData.length > 0 ? ( <div className="space-y-2"><label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Select Property</label><select className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer transition-all hover:border-orange-500/30" value={selectedRowIndex} onChange={(e) => setSelectedRowIndex(parseInt(e.target.value))}>{reversedIndices.map((idx) => { const row = csvData[idx]; const raIdx = csvHeaders.findIndex(h => h.toLowerCase().includes('realtor')); const agIdx = csvHeaders.findIndex(h => h.toLowerCase().includes('agent')); const eAgIdx = raIdx !== -1 ? raIdx : agIdx; const realtor = (eAgIdx !== -1 && row[eAgIdx]) ? row[eAgIdx].trim() : ''; const address = (addressColIdx !== -1 && row[addressColIdx]) ? row[addressColIdx].trim() : `Listing #${idx + 1}`; const unit = (unitColIdx !== -1 && row[unitColIdx]) ? row[unitColIdx].trim() : ''; const addressWithUnit = unit ? `${unit} - ${address}` : address; const label = realtor ? `${realtor} - ${addressWithUnit}` : addressWithUnit; return <option key={idx} value={idx}>{label}</option>; })}</select></div> ) : <p className="text-xs text-slate-500 italic">No data loaded. Pull from 'bookings' tab to start.</p>}
            </div>
            <button onClick={handleDownloadFullKit} disabled={isExportingAll || assets.propertyImages.length === 0} className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-xs shadow-xl transition-all flex items-center justify-center gap-3 ${isExportingAll || assets.propertyImages.length === 0 ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:scale-[1.02] shadow-emerald-900/20'}`}>{isExportingAll ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Generating ZIP...</> : <><svg xmlns="http://www.w3.org/2000/xml" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>Download Marketing ZIP</>}</button>
        </div>
        <div className="lg:col-span-8 space-y-8"><div className="flex flex-col md:flex-row md:items-center justify-between gap-4"><div className="inline-flex bg-slate-900/80 backdrop-blur-xl p-1 rounded-xl border border-white/5 shadow-xl">
                    <button onClick={() => setViewMode('static')} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'static' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Static Posts</button>
                    <button onClick={() => setViewMode('video')} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'video' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Video Reels</button>
                    <button onClick={() => setViewMode('google-earth')} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'google-earth' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>Google Earth</button>
                    <button onClick={() => setViewMode('qr-code')} className={`px-6 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${viewMode === 'qr-code' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}>QR Code</button>
                </div>
                {viewMode === 'static' && ( 
                    <div className="flex items-center gap-4">
                        <div className="flex bg-slate-900 p-1 rounded-lg border border-white/5">
                            <button onClick={() => setStaticTab('listed')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${staticTab === 'listed' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>JUST LISTED ({UPDATED_LISTED_VARIANTS.length})</button>
                            <button onClick={() => setStaticTab('sold')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${staticTab === 'sold' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>JUST SOLD ({SOLD_VARIANTS.length})</button>
                            <button onClick={() => setStaticTab('blank')} className={`px-4 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all ${staticTab === 'blank' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}`}>BLANK ({BLANK_VARIANTS.length})</button>
                        </div>
                        <div className="h-6 w-px bg-white/10 hidden md:block"></div>
                        <button 
                            onClick={() => shuffleImages(true)}
                            className="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest bg-slate-800 border border-orange-500/30 text-orange-500 hover:bg-orange-500 hover:text-white transition-all flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-3.5 h-3.5">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
                            </svg>
                            Shuffle Images
                        </button>
                        <div className="h-6 w-px bg-white/10 hidden md:block"></div>
                        <div className="flex gap-2">
                            {['1:1', '9:16', '16:9'].map(r => ( 
                                <button key={r} onClick={() => setStaticRatio(r as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${staticRatio === r ? 'bg-slate-700 border-slate-600 text-white' : 'bg-transparent border-slate-800 text-slate-500'}`}>{r}</button> 
                            ))}
                        </div>
                    </div> 
                )}
            </div>
            {viewMode === 'static' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {(staticTab === 'listed' ? UPDATED_LISTED_VARIANTS : staticTab === 'sold' ? SOLD_VARIANTS : BLANK_VARIANTS).map((variant, index) => (
                  <GeneratedCanvas 
                    key={variant} 
                    index={index}
                    id={variant} 
                    template={variant} 
                    mode={staticTab === 'listed' ? "JUST LISTED" : staticTab === 'sold' ? "JUST SOLD" : "BLANK"} 
                    data={selectedData} 
                    assets={assets} 
                    images={randomizedImagesForStatic} 
                    colors={{ primary: brandingColor }} 
                    registerCanvas={registerCanvas} 
                    onAssetDrop={handleFiles}
                    width={staticRatio === '1:1' ? 1080 : staticRatio === '9:16' ? 1080 : 1920} 
                    height={staticRatio === '1:1' ? 1080 : staticRatio === '9:16' ? 1920 : 1080} 
                  />
                ))}
              </div>
            )}
            {viewMode === 'video' && ( 
                <VideoGenerator 
                    images={selectedForSocialKitImages} 
                    data={selectedData} 
                    assets={assets} 
                    colors={{ primary: brandingColor }} 
                    mode={staticTab === 'listed' ? "JUST LISTED" : staticTab === 'sold' ? "JUST SOLD" : "BLANK"} 
                    onVideoGenerated={handleVideoGenerated} 
                /> 
            )}
            {viewMode === 'google-earth' && ( <GoogleEarthEditor assets={assets} brandingColor={brandingColor} selectedData={selectedData} mode={staticTab === 'listed' ? "JUST LISTED" : staticTab === 'sold' ? "JUST SOLD" : "BLANK"} /> )}
            {viewMode === 'qr-code' && ( <QrCodeGenerator selectedData={selectedData} brandingColor={brandingColor} logo={assets.logo} /> )}
        </div>
    </div>
  );
};
