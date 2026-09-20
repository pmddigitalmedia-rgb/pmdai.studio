with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Add state near other state definitions in App.tsx
state_anchor = "const [selectedTools, setSelectedTools] = useState<string[]>([]);"
state_insert = """const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [hoveredToolTooltip, setHoveredToolTooltip] = useState<{ preset: WeatherPreset; x: number; y: number } | null>(null);"""

if state_anchor in content and "hoveredToolTooltip" not in content:
    content = content.replace(state_anchor, state_insert)

# 2. Add handlers to tool buttons:
# onMouseEnter={(e) => { const r = e.currentTarget.getBoundingClientRect(); setHoveredToolTooltip({ preset, x: r.left, y: r.top + r.height / 2 }); }}
# onMouseLeave={() => setHoveredToolTooltip(null)}

# Studio Tools:
old_btn = '''                                  <button
                                    draggable
                                    onDragStart={(e) => handleDragStartTool(e, preset.id)}
                                    onClick={() => handleToolToggle(preset.id)}
                                    className={`w-full relative flex flex-col items-center justify-center p-3 rounded-2xl border aspect-square transition-all cursor-grab active:cursor-grabbing ${isAssigned ? `${preset.color} scale-105 shadow-xl` : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}
                                  >'''

new_btn = '''                                  <button
                                    draggable
                                    onDragStart={(e) => handleDragStartTool(e, preset.id)}
                                    onClick={() => handleToolToggle(preset.id)}
                                    onMouseEnter={(e) => {
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setHoveredToolTooltip({ preset, x: r.left, y: r.top + r.height / 2 });
                                    }}
                                    onMouseLeave={() => setHoveredToolTooltip(null)}
                                    className={`w-full relative flex flex-col items-center justify-center p-3 rounded-2xl border aspect-square transition-all cursor-grab active:cursor-grabbing ${isAssigned ? `${preset.color} scale-105 shadow-xl` : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}
                                  >'''

content = content.replace(old_btn, new_btn)

# Visual Stager:
old_stager_btn = '''                                  <button draggable onDragStart={(e) => handleDragStartTool(e, preset.id)} onClick={() => handleToolToggle(preset.id)} className={`w-full flex flex-col items-center justify-center p-3 rounded-2xl border aspect-square transition-all cursor-grab active:cursor-grabbing ${isAssigned ? `${preset.color} scale-105 shadow-xl` : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}>'''

new_stager_btn = '''                                  <button
                                    draggable
                                    onDragStart={(e) => handleDragStartTool(e, preset.id)}
                                    onClick={() => handleToolToggle(preset.id)}
                                    onMouseEnter={(e) => {
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setHoveredToolTooltip({ preset, x: r.left, y: r.top + r.height / 2 });
                                    }}
                                    onMouseLeave={() => setHoveredToolTooltip(null)}
                                    className={`w-full flex flex-col items-center justify-center p-3 rounded-2xl border aspect-square transition-all cursor-grab active:cursor-grabbing ${isAssigned ? `${preset.color} scale-105 shadow-xl` : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}
                                  >'''

content = content.replace(old_stager_btn, new_stager_btn)

# 360 Panoramas:
old_pano_btn = '''                                  <button
                                    draggable
                                    onDragStart={(e) => handleDragStartTool(e, preset.id)}
                                    onClick={() => handleToolToggle(preset.id)}
                                    className={`w-full relative flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${isAssigned ? preset.color : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}
                                  >'''

new_pano_btn = '''                                  <button
                                    draggable
                                    onDragStart={(e) => handleDragStartTool(e, preset.id)}
                                    onClick={() => handleToolToggle(preset.id)}
                                    onMouseEnter={(e) => {
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setHoveredToolTooltip({ preset, x: r.left, y: r.top + r.height / 2 });
                                    }}
                                    onMouseLeave={() => setHoveredToolTooltip(null)}
                                    className={`w-full relative flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-grab active:cursor-grabbing ${isAssigned ? preset.color : 'bg-slate-900/50 border-slate-800 text-slate-500 hover:bg-slate-800 hover:border-slate-700'}`}
                                  >'''

content = content.replace(old_pano_btn, new_pano_btn)

# 3. Add the Fixed Tooltip Portal right before the closing </div> of App component
closing_tag = "{/* Floating Action Center / Bottom Processing Bar */}"
portal_code = """{/* Global Screen-Fixed Uncropped Tooltip Portal */}
      {hoveredToolTooltip && (
        <div
          className="fixed pointer-events-none z-[999999] transition-all duration-150 animate-in fade-in zoom-in-95"
          style={{
            left: `${Math.max(16, hoveredToolTooltip.x - 290)}px`,
            top: `${Math.min(window.innerHeight - 150, Math.max(20, hoveredToolTooltip.y - 45))}px`,
            width: '270px'
          }}
        >
          <div className="p-3.5 bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-[0_20px_50px_rgba(0,0,0,0.9)] ring-1 ring-white/10 text-left">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-white/10 mb-2">
              <span className="text-xs font-black text-white tracking-wide">{hoveredToolTooltip.preset.label}</span>
              {(hoveredToolTooltip.preset.hasAiWatermark || ['furniture', 'style_swapper', 'p360_vstaging_3d', 'p360_style_swap'].includes(hoveredToolTooltip.preset.id)) && (
                <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 border border-amber-300 flex items-center gap-1 shadow-sm">
                  <svg className="w-2 h-2 shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"/></svg>
                  +AI Watermark
                </span>
              )}
            </div>
            <p className="text-[11.5px] text-slate-300 leading-relaxed font-normal">
              {hoveredToolTooltip.preset.description}
            </p>
          </div>
        </div>
      )}

      {/* Floating Action Center / Bottom Processing Bar */}"""

content = content.replace(closing_tag, portal_code)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Infallible screen-fixed tooltip portal applied!")
