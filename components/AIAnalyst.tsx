import React, { useState, useMemo } from 'react';
import { ImageItem } from '../types';
import { generateLuxuryMarketingCopy, LuxuryMarketingPack } from '../services/geminiService';
import { WEATHER_PRESETS, PANORAMA_PRESETS, VISUAL_STAGER_PRESETS } from '../constants';
import { jsPDF } from 'jspdf';
import { useAuth } from './AuthContext';

interface AIAnalystProps {
  items: ImageItem[];
  persistedResults: LuxuryMarketingPack | null;
  onResultsChange: (results: LuxuryMarketingPack | null) => void;
  onPreAnalyzeSingle?: (id: string) => Promise<void>;
  onApplyPreAnalysisRecommendations?: (id: string) => void;
  onTogglePreAnalysisTool?: (itemId: string, toolId: string) => void;
}

const PLATFORM_LABELS: Record<string, string> = {
  facebook: "Facebook Feed",
  linkedIn: "LinkedIn Professional",
  tiktokStories: "TikTok & Stories (Reels)",
  pinterest: "Pinterest & Design Boards",
  xTwitter: "X (Twitter) Hook"
};

export const AIAnalyst: React.FC<AIAnalystProps> = ({ 
  items, 
  persistedResults, 
  onResultsChange,
  onPreAnalyzeSingle,
  onApplyPreAnalysisRecommendations,
  onTogglePreAnalysisTool
}) => {
  const { isAdmin } = useAuth();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState<'scenes' | 'mls' | 'social' | 'email'>('scenes');

  const analyzedCount = useMemo(() => items.filter(i => i.preAnalysis).length, [items]);

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    setIsGenerating(true);
    try {
      const selectedItems = items.filter(i => selectedIds.has(i.id));
      const images = selectedItems.map(i => ({
        base64: i.base64 || '',
        mimeType: i.file.type || 'image/jpeg'
      })).filter(img => img.base64);

      const pack = await generateLuxuryMarketingCopy(images);
      onResultsChange(pack);
    } catch (e) {
      console.error(e);
      alert("Failed to generate marketing copy. Please check console.");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard!");
  };

  const handleDownloadPDF = () => {
    if (!persistedResults) return;

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    // Set character tracking to zero globally
    doc.setCharSpace(0);

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 25;
    const contentWidth = pageWidth - (margin * 2);
    let y = margin;

    // --- HELPER FUNCTIONS ---
    const addFooter = (pageNum: number) => {
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(150, 150, 150);
      doc.text('PMD DIGITAL MEDIA • LUXURY MARKETING ANALYST', margin, pageHeight - 10, { align: 'left' });
      doc.text(`Page ${pageNum}`, pageWidth - margin - 10, pageHeight - 10, { align: 'left' });
    };

    const addSectionHeader = (title: string, yPos: number) => {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(249, 115, 22); // Branding orange
      doc.text(title.toUpperCase(), margin, yPos, { align: 'left' });
      return yPos + 8;
    };

    // --- COVER PAGE ---
    // Background Band
    doc.setFillColor(15, 23, 42); // Slate-900
    doc.rect(0, 0, pageWidth, 80, 'F');
    
    // Main Title
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text('PROPERTY MARKETING', margin, 40, { align: 'left' });
    doc.setFontSize(24);
    doc.setFont('helvetica', 'light');
    doc.text('STRATEGIC BRIEF', margin, 52, { align: 'left' });

    // Accent line
    doc.setDrawColor(249, 115, 22);
    doc.setLineWidth(1.5);
    doc.line(margin, 62, margin + 40, 62);

    y = 100;
    
    // Identified Selling Points
    y = addSectionHeader('Architectural Highlights', y);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(60, 60, 60);
    const pointsText = persistedResults.uniqueSellingPoints.join('  •  ');
    const pointsLines = doc.splitTextToSize(pointsText, contentWidth);
    doc.text(pointsLines, margin, y, { align: 'left' });
    y += (pointsLines.length * 6) + 15;

    // MLS Narrative
    y = addSectionHeader('MLS Lifestyle Narrative', y);
    doc.setFontSize(10.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(40, 40, 40);
    const mlsLines = doc.splitTextToSize(persistedResults.mlsDescription, contentWidth);
    // Explicitly set to left alignment
    doc.text(mlsLines, margin, y, { align: 'left', lineHeightFactor: 1.5 });
    
    addFooter(1);

    // --- PAGE 2: SOCIAL MEDIA ---
    doc.addPage();
    // Re-ensure tracking on new pages if required (jsPDF state usually persists but good to be safe)
    doc.setCharSpace(0);
    y = margin;
    
    y = addSectionHeader('Social Media Distribution Pack', y);
    y += 5;

    Object.entries(persistedResults.socialMediaPack).forEach(([key, content]) => {
      const platformTitle = PLATFORM_LABELS[key] || key.toUpperCase();
      
      // Check for page break
      const lines = doc.splitTextToSize(content as string, contentWidth - 10);
      const neededHeight = (lines.length * 5) + 20;
      
      if (y + neededHeight > pageHeight - margin) {
        addFooter(doc.internal.pages.length - 1);
        doc.addPage();
        doc.setCharSpace(0);
        y = margin;
      }

      // Block Decoration
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.rect(margin - 5, y - 5, contentWidth + 10, neededHeight - 5, 'F');
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.setLineWidth(0.2);
      doc.rect(margin - 5, y - 5, contentWidth + 10, neededHeight - 5, 'D');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(249, 115, 22);
      doc.text(platformTitle.toUpperCase(), margin, y, { align: 'left' });
      y += 6;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105); // Slate-600
      doc.text(lines, margin, y, { align: 'left', lineHeightFactor: 1.4 });
      y += (lines.length * 5) + 12;
    });

    addFooter(doc.internal.pages.length - 1);

    // --- PAGE 3: EMAIL BLAST ---
    doc.addPage();
    doc.setCharSpace(0);
    y = margin;
    
    y = addSectionHeader('VIP Correspondent Teaser', y);
    y += 5;

    doc.setFontSize(10.5);
    doc.setFont('times', 'normal'); // Serif for email feel
    doc.setTextColor(30, 30, 30);
    const emailLines = doc.splitTextToSize(persistedResults.emailBlast, contentWidth);
    doc.text(emailLines, margin, y, { align: 'left', lineHeightFactor: 1.4 });

    addFooter(doc.internal.pages.length - 1);

    doc.save('PMD-Luxury-Marketing-Brief.pdf');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-fade-in-up">
      <div className="lg:col-span-4 space-y-6">
        <div className="glass-panel p-6 rounded-[2rem] space-y-6 shadow-2xl">
          <div className="space-y-1 border-b border-white/5 pb-4">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Architectural Analysis</h3>
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-tighter">Luxury Copywriter Persona</p>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Select Images (5-10 Recommended)</label>
              <button
                type="button"
                onClick={() => {
                  if (selectedIds.size === items.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(items.map(item => item.id)));
                  }
                }}
                className="text-[9px] font-black text-orange-500 hover:text-orange-400 uppercase tracking-wider transition-colors"
              >
                {selectedIds.size === items.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto pr-2 scrollbar-hide">
              {items.map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${selectedIds.has(item.id) ? 'border-orange-500 scale-95 shadow-lg' : 'border-slate-800'}`}
                >
                  <img src={item.previewUrl} className="w-full h-full object-cover" alt="" />
                  {selectedIds.has(item.id) && (
                    <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="w-5 h-5 text-white">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating || selectedIds.size === 0}
            className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest text-xs shadow-2xl transition-all flex items-center justify-center gap-3
              ${isGenerating || selectedIds.size === 0 ? 'bg-slate-800 text-slate-500' : 'bg-gradient-to-br from-orange-600 to-amber-500 text-white hover:scale-[1.02] shadow-orange-900/40'}`}
          >
            {isGenerating ? (
              <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Analyzing Details...</>
            ) : (
              <><svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.151 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" /></svg> Generate Marketing Copy</>
            )}
          </button>
        </div>

        {persistedResults && (
          <div className="glass-panel p-6 rounded-2xl space-y-4 animate-fade-in-up">
            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Identified Selling Points</h4>
            <div className="flex flex-wrap gap-2">
              {persistedResults.uniqueSellingPoints.map((point, idx) => (
                <span key={idx} className="px-2 py-1 bg-orange-500/10 border border-orange-500/20 rounded-md text-[9px] font-bold text-orange-400 uppercase">
                  {point}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="lg:col-span-8">
        <div className="glass-panel rounded-[2rem] flex flex-col h-full shadow-2xl overflow-hidden min-h-[600px]">
          <div className="flex bg-slate-900/50 p-2 border-b border-white/5 items-center justify-between">
            <div className="flex flex-grow flex-wrap gap-1">
              <button 
                onClick={() => setActiveResultTab('scenes')} 
                className={`flex-1 min-w-[140px] py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeResultTab === 'scenes' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Scene Analysis ({analyzedCount}/{items.length})
              </button>
              <button 
                onClick={() => setActiveResultTab('mls')} 
                className={`flex-1 min-w-[120px] py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeResultTab === 'mls' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                MLS Description
              </button>
              <button 
                onClick={() => setActiveResultTab('social')} 
                className={`flex-1 min-w-[120px] py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeResultTab === 'social' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Social Media
              </button>
              <button 
                onClick={() => setActiveResultTab('email')} 
                className={`flex-1 min-w-[100px] py-4 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeResultTab === 'email' ? 'bg-orange-500 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
              >
                Email Blast
              </button>
            </div>
            {persistedResults && (
              <div className="px-4 border-l border-white/10 ml-2">
                <button 
                  onClick={handleDownloadPDF}
                  className="p-3 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 transition-all shadow-lg flex items-center gap-2 group"
                  title="Download Brief as PDF"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" /></svg>
                  <span className="text-[10px] font-black uppercase tracking-widest hidden md:inline">PDF</span>
                </button>
              </div>
            )}
          </div>

          <div className="flex-grow p-6 overflow-y-auto scrollbar-hide">
            {/* Tab: Scene Analysis */}
            {activeResultTab === 'scenes' && (
              <div className="space-y-6 animate-fade-in-up">
                <div className="flex items-center justify-between pb-2 border-b border-white/5">
                  <div>
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">AI Vision Scene Inspector</h2>
                    <p className="text-xs text-slate-400 mt-0.5">Gemini Vision architectural recognition, clutter detection & recommended tools.</p>
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-wider px-3 py-1 bg-orange-500/10 border border-orange-500/20 text-orange-400 rounded-lg">
                    {analyzedCount} of {items.length} Photos Inspected
                  </span>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-16 text-slate-500 text-xs uppercase font-bold tracking-widest">
                    No photos uploaded in Studio yet
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items.map((item) => (
                      <div 
                        key={item.id} 
                        className="bg-slate-900/60 border border-white/5 rounded-2xl p-4 flex flex-col gap-3 hover:border-orange-500/30 transition-all shadow-md"
                      >
                        <div className="flex gap-3">
                          <div className="relative w-24 h-24 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-slate-950">
                            <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
                            {item.preAnalysis && (
                              <div className="absolute bottom-1 left-1 right-1 bg-black/85 text-orange-400 text-[7px] font-black uppercase text-center py-0.5 px-1 rounded truncate">
                                {item.preAnalysis.roomType}
                              </div>
                            )}
                            {item.isAnalyzing && (
                              <div className="absolute inset-0 bg-slate-950/80 flex items-center justify-center">
                                <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </div>

                          <div className="flex-grow min-w-0 flex flex-col justify-between">
                            <div>
                              <span className="text-[10px] font-bold text-slate-200 truncate block">{item.file.name}</span>
                              {item.preAnalysis ? (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-orange-500/10 text-[7.5px] font-bold text-orange-400 border border-orange-500/20">
                                    {item.preAnalysis.roomType} ({item.preAnalysis.occupancy})
                                  </span>
                                  <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[7.5px] font-bold text-slate-400">
                                    {item.preAnalysis.lightingCondition}
                                  </span>
                                  {item.preAnalysis.clutterLevel !== 'none' && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-[7.5px] font-bold text-amber-300 border border-amber-500/30">
                                      {item.preAnalysis.clutterLevel} clutter
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <p className="text-[8px] text-slate-500 mt-1 italic">Not analyzed yet</p>
                              )}
                            </div>

                            <div className="pt-2 flex items-center gap-2">
                              {onPreAnalyzeSingle && (
                                <button
                                  type="button"
                                  onClick={() => onPreAnalyzeSingle(item.id)}
                                  disabled={item.isAnalyzing}
                                  className="px-2.5 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500 text-orange-300 hover:text-white text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-orange-500/30 cursor-pointer"
                                >
                                  {item.isAnalyzing ? (
                                    <>
                                      <div className="w-2.5 h-2.5 border border-orange-400 border-t-transparent rounded-full animate-spin" />
                                      Scanning...
                                    </>
                                  ) : (
                                    <>
                                      <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/>
                                      </svg>
                                      {item.preAnalysis ? 'Re-Analyze' : 'Analyze Vision'}
                                    </>
                                  )}
                                </button>
                              )}

                              {item.preAnalysis && onApplyPreAnalysisRecommendations && item.preAnalysis.recommendedTools?.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => onApplyPreAnalysisRecommendations(item.id)}
                                  className="px-2 py-1 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white text-[8px] font-black uppercase tracking-wider transition-all flex items-center gap-1 border border-emerald-500/30 cursor-pointer"
                                >
                                  <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5"/></svg>
                                  Apply Edits
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {item.preAnalysis && (
                          <div className="text-[8px] text-slate-300 bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-1.5">
                            <p className="leading-snug">{item.preAnalysis.summary}</p>
                            {item.preAnalysis.detectedFeatures && item.preAnalysis.detectedFeatures.length > 0 && (
                              <div className="flex items-baseline gap-1 text-[7.5px]">
                                <span className="text-slate-500 font-bold uppercase">Features:</span>
                                <span className="text-slate-400">{item.preAnalysis.detectedFeatures.join(', ')}</span>
                              </div>
                            )}
                            {item.preAnalysis.recommendedTools && item.preAnalysis.recommendedTools.length > 0 && (
                              <div className="pt-1 flex items-center gap-1 flex-wrap">
                                <span className="text-slate-500 font-bold uppercase text-[7.5px]">Recommended:</span>
                                {item.preAnalysis.recommendedTools
                                  .filter(t => {
                                    if (!isAdmin && (t.includes('video') || t.startsWith('p360_'))) return false;
                                    return true;
                                  })
                                  .map(t => {
                                  const preset = [...WEATHER_PRESETS, ...PANORAMA_PRESETS, ...VISUAL_STAGER_PRESETS].find(p => p.id === t);
                                  const isAssigned = item.assignedTools.includes(t);
                                  return (
                                    <button
                                      key={t}
                                      type="button"
                                      onClick={() => onTogglePreAnalysisTool?.(item.id, t)}
                                      className={`px-1.5 py-0.5 rounded text-[7px] font-bold uppercase transition-all ${
                                        isAssigned 
                                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' 
                                          : 'bg-slate-800 text-slate-400 border border-white/5 hover:text-orange-300'
                                      }`}
                                    >
                                      {isAssigned ? '✓ ' : '+ '}{preset?.label || t}
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab: MLS Description */}
            {activeResultTab === 'mls' && (
              persistedResults ? (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">MLS Lifestyle Narrative</h2>
                    <button onClick={() => copyToClipboard(persistedResults.mlsDescription)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-500 transition-all border border-white/5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.045 1.124-.045 1.135 0 2.097.845 2.192 1.976.03.373.045.748.045 1.124v1.242m-6.9 8.158h8.85a2.25 2.25 0 0 0 2.25-2.25V9.108a2.25 2.25 0 0 0-2.25-2.25H10.125a2.25 2.25 0 0 0-2.25 2.25V13.5m-3 0h3m-3 0a2.25 2.25 0 0 1 2.25-2.25H13.5m-3 0V6.75" /></svg>
                    </button>
                  </div>
                  <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-wrap text-left">{persistedResults.mlsDescription}</p>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-white/10 rounded-[2.5rem] min-h-[400px]">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Select images and click "Generate Marketing Copy" to create MLS Narrative</span>
                </div>
              )
            )}

            {/* Tab: Social Media Pack */}
            {activeResultTab === 'social' && (
              persistedResults ? (
                <div className="space-y-8 animate-fade-in-up">
                  {Object.entries(persistedResults.socialMediaPack).map(([key, content]) => (
                    <div key={key} className="space-y-3 p-6 bg-slate-900/50 rounded-2xl border border-white/5 relative group">
                      <div className="flex items-center justify-between">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{PLATFORM_LABELS[key]}</span>
                          <span className="text-[8px] text-slate-500 font-bold uppercase tracking-tighter mt-0.5">Recommended Platform Category</span>
                        </div>
                        <button onClick={() => copyToClipboard(content as string)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-orange-500 transition-all">
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
                        </button>
                      </div>
                      <p className="text-slate-300 text-xs italic leading-relaxed text-left">{content as string}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-white/10 rounded-[2.5rem] min-h-[400px]">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Select images and click "Generate Marketing Copy" to create Social Posts</span>
                </div>
              )
            )}

            {/* Tab: Email Blast */}
            {activeResultTab === 'email' && (
              persistedResults ? (
                <div className="space-y-6 animate-fade-in-up">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-black text-white uppercase tracking-tighter">VIP Teaser Blast</h2>
                    <button onClick={() => copyToClipboard(persistedResults.emailBlast)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-orange-500 transition-all border border-white/5">
                      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 7.5V6.108c0-1.135.845-2.098 1.976-2.192.373-.03.748-.045 1.124-.045 1.135 0 2.097.845 2.192 1.976.03.373.045.748.045 1.124v1.242m-6.9 8.158h8.85a2.25 2.25 0 0 0 2.25-2.25V9.108a2.25 2.25 0 0 0-2.25-2.25H10.125a2.25 2.25 0 0 0-2.25 2.25V13.5m-3 0h3m-3 0a2.25 2.25 0 0 1 2.25-2.25H13.5m-3 0V6.75" /></svg>
                    </button>
                  </div>
                  <div className="p-8 bg-white text-slate-900 rounded-2xl shadow-xl font-serif text-left">
                    <p className="whitespace-pre-wrap">{persistedResults.emailBlast}</p>
                  </div>
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-40 border-2 border-dashed border-white/10 rounded-[2.5rem] min-h-[400px]">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">Select images and click "Generate Marketing Copy" to create Email Blast</span>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
