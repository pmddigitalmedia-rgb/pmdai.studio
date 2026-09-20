with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Update state type to store the full bounding box of the hovered button:
old_state = "const [hoveredToolTooltip, setHoveredToolTooltip] = useState<{ preset: WeatherPreset; x: number; y: number } | null>(null);"
new_state = "const [hoveredToolTooltip, setHoveredToolTooltip] = useState<{ preset: WeatherPreset; rect: { left: number; right: number; top: number; bottom: number; width: number; height: number } } | null>(null);"

content = content.replace(old_state, new_state)

# 2. Update onMouseEnter handlers for orderedPresets, visual stager, and panorama:
old_mouse_enter = """                                    onMouseEnter={(e) => {
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setHoveredToolTooltip({ preset, x: r.left, y: r.top + r.height / 2 });
                                    }}"""

new_mouse_enter = """                                    onMouseEnter={(e) => {
                                      const r = e.currentTarget.getBoundingClientRect();
                                      setHoveredToolTooltip({ preset, rect: { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width, height: r.height } });
                                    }}"""

content = content.replace(old_mouse_enter, new_mouse_enter)

# 3. Update Portal positioning:
# Put it to the RIGHT of the button (or right of the aside sidebar) so it stays completely out of the way of the tool button!
# If space on right: left = rect.right + 16px.
# If near screen right edge: left = rect.left - 296px.
# Align vertically with the button: top = rect.top + (rect.height / 2) - 40px
old_portal = """      {/* Global Screen-Fixed Uncropped Tooltip Portal */}
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
      )}"""

new_portal = """      {/* Global Screen-Fixed Uncropped Tooltip Portal */}
      {hoveredToolTooltip && (() => {
        const tooltipW = 280;
        const rect = hoveredToolTooltip.rect;
        // Position clearly to the RIGHT of the button/sidebar so the hovered tool remains 100% visible
        const fitsRight = (rect.right + tooltipW + 24) <= window.innerWidth;
        const leftPos = fitsRight ? (rect.right + 14) : Math.max(16, rect.left - tooltipW - 14);
        const topPos = Math.min(window.innerHeight - 180, Math.max(16, rect.top + (rect.height / 2) - 45));

        return (
          <div
            className="fixed pointer-events-none z-[999999] transition-all duration-150 animate-in fade-in zoom-in-95"
            style={{
              left: `${leftPos}px`,
              top: `${topPos}px`,
              width: `${tooltipW}px`
            }}
          >
            <div className="relative p-3.5 bg-slate-950/95 backdrop-blur-xl rounded-2xl border border-white/20 shadow-[0_25px_60px_rgba(0,0,0,0.95)] ring-1 ring-white/10 text-left">
              {/* Pointing notch indicator */}
              <div
                className={`w-2.5 h-2.5 bg-slate-950 border-white/20 rotate-45 absolute top-10 ${fitsRight ? '-left-1.5 border-l border-b' : '-right-1.5 border-r border-t'}`}
              />
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
        );
      })()}"""

content = content.replace(old_portal, new_portal)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Updated tooltip positioning to be completely offset from the hovered tool button!")
