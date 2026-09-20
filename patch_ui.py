with open('App.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

start_idx = -1
end_idx = -1
for i, line in enumerate(lines):
    if '{orderedPresets.map((preset) => {' in line and i > 1800:
        start_idx = i
        break

if start_idx != -1:
    for j in range(start_idx, start_idx + 40):
        if '})}' in lines[j]:
            end_idx = j
            break

print(f'orderedPresets range: {start_idx} to {end_idx}')

new_ordered = [
    "                            {orderedPresets.map((preset) => {\n",
    "                              const isAssigned = activeItem?.assignedTools.includes(preset.id);\n",
    "                              const hasWatermark = preset.hasAiWatermark || ['furniture', 'style_swapper', 'p360_vstaging_3d', 'p360_style_swap'].includes(preset.id);\n",
    "                              return (\n",
    "                                <div key={preset.id} className=\"relative group/toolbtn\">\n",
    "                                  <button\n",
    "                                    draggable\n",
    "                                    onDragStart={(e) => handleDragStartTool(e, preset.id)}\n",
    "                                    onClick={() => handleToolToggle(preset.id)}\n",
    "                                    className={`w-full relative flex flex-col items-center justify-center p-3 rounded-2xl border aspect-square transition-all cursor-grab active:cursor-grabbing ${isAssigned ? `${preset.color} scale-105 shadow-xl` : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}\n",
    "                                  >\n",
    "                                      <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" strokeWidth={2.5} stroke=\"currentColor\" className=\"w-5 h-5 mb-1\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" d={preset.icon} /></svg>\n",
    "                                      <span className=\"text-[7px] text-center font-bold uppercase tracking-tighter line-clamp-1\">{preset.label}</span>\n",
    "                                      {preset.isPremium && (\n",
    "                                        <div className=\"absolute top-1 right-1 px-1.5 py-0.5 bg-indigo-500 text-[6px] font-black text-white rounded-md uppercase tracking-widest shadow-lg\">PREMIUM</div>\n",
    "                                      )}\n",
    "                                      {hasWatermark && !preset.isPremium && (\n",
    "                                        <div className=\"absolute top-1 right-1 px-1.5 py-0.5 bg-amber-400 text-[7px] font-black text-slate-950 rounded-md uppercase tracking-wider shadow-md flex items-center gap-0.5 border border-amber-300\" title=\"Includes MLS-compliant AI watermark\">\n",
    "                                          <svg className=\"w-1.5 h-1.5 shrink-0\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z\"/></svg>\n",
    "                                          +AI\n",
    "                                        </div>\n",
    "                                      )}\n",
    "                                  </button>\n",
    "                                  <div className=\"pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] z-[100] w-64 p-3 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/toolbtn:opacity-100 transition-all duration-150 transform translate-y-1 group-hover/toolbtn:translate-y-0\">\n",
    "                                    <div className=\"flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5\">\n",
    "                                      <span className=\"text-xs font-black text-white tracking-wide\">{preset.label}</span>\n",
    "                                      {hasWatermark && (\n",
    "                                        <span className=\"px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-sm\">\n",
    "                                          +AI Watermark\n",
    "                                        </span>\n",
    "                                      )}\n",
    "                                    </div>\n",
    "                                    <p className=\"text-[11px] text-slate-300 leading-relaxed font-normal\">\n",
    "                                      {preset.description}\n",
    "                                    </p>\n",
    "                                    <div className=\"w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/20 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2\"></div>\n",
    "                                  </div>\n",
    "                                </div>\n",
    "                              );\n",
    "                            })}\n"
]

if start_idx != -1 and end_idx != -1:
    lines[start_idx:end_idx+1] = new_ordered

# VISUAL_STAGER_PRESETS
start_stager = -1
end_stager = -1
for i, line in enumerate(lines):
    if '{VISUAL_STAGER_PRESETS.map((preset) => {' in line:
        start_stager = i
        break

if start_stager != -1:
    for j in range(start_stager, start_stager + 30):
        if '})}' in lines[j]:
            end_stager = j
            break

print(f'visual stager range: {start_stager} to {end_stager}')

new_stager = [
    "                            {VISUAL_STAGER_PRESETS.map((preset) => {\n",
    "                              const isAssigned = activeItem?.assignedTools.includes(preset.id);\n",
    "                              return (\n",
    "                                <div key={preset.id} className=\"relative group/stagertoolbtn\">\n",
    "                                  <button draggable onDragStart={(e) => handleDragStartTool(e, preset.id)} onClick={() => handleToolToggle(preset.id)} className={`w-full flex flex-col items-center justify-center p-3 rounded-2xl border aspect-square transition-all cursor-grab active:cursor-grabbing ${isAssigned ? `${preset.color} scale-105 shadow-xl` : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}>\n",
    "                                      <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" strokeWidth={2.5} stroke=\"currentColor\" className=\"w-5 h-5 mb-1\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" d={preset.icon} /></svg>\n",
    "                                      <span className=\"text-[7px] text-center font-bold uppercase tracking-tighter line-clamp-1\">{preset.label}</span>\n",
    "                                  </button>\n",
    "                                  <div className=\"pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] z-[100] w-64 p-3 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/stagertoolbtn:opacity-100 transition-all duration-150 transform translate-y-1 group-hover/stagertoolbtn:translate-y-0\">\n",
    "                                    <div className=\"flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5\">\n",
    "                                      <span className=\"text-xs font-black text-white tracking-wide\">{preset.label}</span>\n",
    "                                    </div>\n",
    "                                    <p className=\"text-[11px] text-slate-300 leading-relaxed font-normal\">\n",
    "                                      {preset.description}\n",
    "                                    </p>\n",
    "                                    <div className=\"w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/20 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2\"></div>\n",
    "                                  </div>\n",
    "                                </div>\n",
    "                              );\n",
    "                            })}\n"
]

if start_stager != -1 and end_stager != -1:
    lines[start_stager:end_stager+1] = new_stager

# PANORAMA_PRESETS
start_pano = -1
end_pano = -1
for i, line in enumerate(lines):
    if '{PANORAMA_PRESETS.map((preset) => {' in line:
        start_pano = i
        break

if start_pano != -1:
    for j in range(start_pano, start_pano + 30):
        if '})}' in lines[j]:
            end_pano = j
            break

print(f'panorama range: {start_pano} to {end_pano}')

new_pano = [
    "                            {PANORAMA_PRESETS.map((preset) => {\n",
    "                              const isAssigned = activeItem?.assignedTools.includes(preset.id);\n",
    "                              const hasWatermark = preset.hasAiWatermark || ['p360_vstaging_3d', 'p360_style_swap'].includes(preset.id);\n",
    "                              return (\n",
    "                                <div key={preset.id} className=\"relative group/panotoolbtn\">\n",
    "                                  <button\n",
    "                                    draggable\n",
    "                                    onDragStart={(e) => handleDragStartTool(e, preset.id)}\n",
    "                                    onClick={() => handleToolToggle(preset.id)}\n",
    "                                    className={`w-full relative flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${isAssigned ? preset.color : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}\n",
    "                                  >\n",
    "                                      <svg xmlns=\"http://www.w3.org/2000/svg\" fill=\"none\" viewBox=\"0 0 24 24\" strokeWidth={2.5} stroke=\"currentColor\" className=\"w-5 h-5 shrink-0\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" d={preset.icon} /></svg>\n",
    "                                      <span className=\"text-[9px] font-black uppercase tracking-widest\">{preset.label}</span>\n",
    "                                      {hasWatermark && (\n",
    "                                        <span className=\"ml-auto px-1.5 py-0.5 bg-amber-400 text-[7px] font-black text-slate-950 rounded uppercase tracking-wider flex items-center gap-0.5 shadow-sm border border-amber-300\" title=\"Includes MLS-compliant AI watermark\">\n",
    "                                          <svg className=\"w-1.5 h-1.5 shrink-0\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z\"/></svg>\n",
    "                                          +AI\n",
    "                                        </span>\n",
    "                                      )}\n",
    "                                  </button>\n",
    "                                  <div className=\"pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] z-[100] w-64 p-3 bg-slate-950/95 backdrop-blur-md rounded-xl border border-white/20 shadow-2xl shadow-black/90 opacity-0 group-hover/panotoolbtn:opacity-100 transition-all duration-150 transform translate-y-1 group-hover/panotoolbtn:translate-y-0\">\n",
    "                                    <div className=\"flex items-center justify-between gap-2 pb-1.5 border-b border-white/10 mb-1.5\">\n",
    "                                      <span className=\"text-xs font-black text-white tracking-wide\">{preset.label}</span>\n",
    "                                      {hasWatermark && (\n",
    "                                        <span className=\"px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-sm\">\n",
    "                                          +AI Watermark\n",
    "                                        </span>\n",
    "                                      )}\n",
    "                                    </div>\n",
    "                                    <p className=\"text-[11px] text-slate-300 leading-relaxed font-normal\">\n",
    "                                      {preset.description}\n",
    "                                    </p>\n",
    "                                    <div className=\"w-2.5 h-2.5 bg-slate-950 border-r border-b border-white/20 rotate-45 absolute -bottom-1.5 left-1/2 -translate-x-1/2\"></div>\n",
    "                                  </div>\n",
    "                                </div>\n",
    "                              );\n",
    "                            })}\n"
]

if start_pano != -1 and end_pano != -1:
    lines[start_pano:end_pano+1] = new_pano

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)

print('Successfully applied patch to App.tsx!')
