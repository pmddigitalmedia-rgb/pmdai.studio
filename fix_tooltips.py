with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace tooltip container in Studio tools and 360 tools to pop out cleanly to the left:
# Previous: absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)]
# New: absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2
# Arrow pointing right to the button: absolute -right-1.5 top-1/2 -translate-y-1/2 rotate-45

old_bubble = '''<div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] z-[100] w-64 p-3 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/toolbtn:opacity-100 transition-all duration-150 transform translate-y-1 group-hover/toolbtn:translate-y-0">
                                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5">
                                      <span className="text-xs font-black text-white tracking-wide">{preset.label}</span>
                                      {hasWatermark && (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-sm">
                                          +AI Watermark
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                                      {preset.description}
                                    </p>
                                    <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/20 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2"></div>
                                  </div>'''

new_bubble = '''<div className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-[999] w-64 p-3.5 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/toolbtn:opacity-100 transition-all duration-150 transform translate-x-1 group-hover/toolbtn:translate-x-0">
                                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5">
                                      <span className="text-xs font-black text-white tracking-wide">{preset.label}</span>
                                      {hasWatermark && (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-sm">
                                          +AI Watermark
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                                      {preset.description}
                                    </p>
                                    <div className="w-2.5 h-2.5 bg-slate-950 border-t border-r border-white/20 rotate-45 absolute top-1/2 -translate-y-1/2 -right-1.5"></div>
                                  </div>'''

content = content.replace(old_bubble, new_bubble)

# For visual stager
old_stager_bubble = '''<div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] z-[100] w-64 p-3 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/stagertoolbtn:opacity-100 transition-all duration-150 transform translate-y-1 group-hover/stagertoolbtn:translate-y-0">
                                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5">
                                      <span className="text-xs font-black text-white tracking-wide">{preset.label}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                                      {preset.description}
                                    </p>
                                    <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/20 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2"></div>
                                  </div>'''

new_stager_bubble = '''<div className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-[999] w-64 p-3.5 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/stagertoolbtn:opacity-100 transition-all duration-150 transform translate-x-1 group-hover/stagertoolbtn:translate-x-0">
                                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5">
                                      <span className="text-xs font-black text-white tracking-wide">{preset.label}</span>
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                                      {preset.description}
                                    </p>
                                    <div className="w-2.5 h-2.5 bg-slate-950 border-t border-r border-white/20 rotate-45 absolute top-1/2 -translate-y-1/2 -right-1.5"></div>
                                  </div>'''

content = content.replace(old_stager_bubble, new_stager_bubble)

# For panorama
old_pano_bubble = '''<div className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] z-[100] w-64 p-3 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/panotoolbtn:opacity-100 transition-all duration-150 transform translate-y-1 group-hover/panotoolbtn:translate-y-0">
                                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5">
                                      <span className="text-xs font-black text-white tracking-wide">{preset.label}</span>
                                      {hasWatermark && (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-sm">
                                          +AI Watermark
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                                      {preset.description}
                                    </p>
                                    <div className="w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/20 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2"></div>
                                  </div>'''

new_pano_bubble = '''<div className="pointer-events-none absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 z-[999] w-64 p-3.5 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/panotoolbtn:opacity-100 transition-all duration-150 transform translate-x-1 group-hover/panotoolbtn:translate-x-0">
                                    <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5">
                                      <span className="text-xs font-black text-white tracking-wide">{preset.label}</span>
                                      {hasWatermark && (
                                        <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-sm">
                                          +AI Watermark
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-slate-300 leading-relaxed font-normal">
                                      {preset.description}
                                    </p>
                                    <div className="w-2.5 h-2.5 bg-slate-950 border-t border-r border-white/20 rotate-45 absolute top-1/2 -translate-y-1/2 -right-1.5"></div>
                                  </div>'''

content = content.replace(old_pano_bubble, new_pano_bubble)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print('Updated tooltip positions to pop out left into open canvas!')
