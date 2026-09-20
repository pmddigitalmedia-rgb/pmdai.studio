
const fs = require('fs');
let content = fs.readFileSync('App.tsx', 'utf8');

const oldTool = `{orderedPresets.map((preset) => {
                              const isAssigned = activeItem?.assignedTools.includes(preset.id);
                              return (
                                <button key={preset.id} draggable onDragStart={(e) => handleDragStartTool(e, preset.id)} onClick={() => handleToolToggle(preset.id)} className={\`relative flex flex-col items-center justify-center p-3 rounded-2xl border aspect-square transition-all cursor-grab active:cursor-grabbing \${isAssigned ? \`\${preset.color} scale-105 shadow-xl\` : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800'}\`}>
                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-5 h-5 mb-1"><path strokeLinecap="round" strokeLinejoin="round" d={preset.icon} /></svg>
                                    <span className="text-[7px] text-center font-bold uppercase tracking-tighter">{preset.label}</span>
                                    {preset.isPremium && (
                                      <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-indigo-500 text-[6px] font-black text-white rounded-md uppercase tracking-widest shadow-lg">PREMIUM</div>
                                    )}
                                    {(preset.hasAiWatermark || preset.id === 'style_swapper') && !preset.isPremium && (
                                      <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-amber-500 text-[6px] font-black text-slate-950 rounded-md uppercase tracking-tight shadow-md flex items-center gap-0.5" title="Includes MLS-compliant AI watermark">
                                        <svg className="w-1.5 h-1.5 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>
                                        AI
                                      </div>
                                    )}
                                </button>
                              );
                            })}`;
