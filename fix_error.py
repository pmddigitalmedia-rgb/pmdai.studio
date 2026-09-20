with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Declare hoveredToolTooltip state inside App() component:
# Find: function App() {
# Add state right after:
target_func = "function App() {"
replacement_func = """function App() {
  const [hoveredToolTooltip, setHoveredToolTooltip] = useState<{ preset: WeatherPreset; x: number; y: number } | null>(null);"""

if target_func in content:
    content = content.replace(target_func, replacement_func, 1)
    print("Added hoveredToolTooltip state declaration!")

# 2. Add the Portal rendering right before the closing </div> of App component:
target_end = "      {/* TOKEN GUARD INTERCEPTION MODAL (SAFETY CAP TRIGGERED) */}"
portal_code = """      {/* Global Screen-Fixed Uncropped Tooltip Portal */}
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

      {/* TOKEN GUARD INTERCEPTION MODAL (SAFETY CAP TRIGGERED) */}"""

if target_end in content:
    content = content.replace(target_end, portal_code, 1)
    print("Added portal render in App.tsx!")

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
