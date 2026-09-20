# 1. Update constants.ts prompt for window_splash:
with open('constants.ts', 'r', encoding='utf-8') as f:
    constants_code = f.read()

old_ws_prompt = """    id: 'window_splash',
    label: 'Window Splash',
    description: 'Project vivid sunlight onto exterior objects (trees, lawn, patio) visible through windows. Best used with the Lasso.',
    prompt: 'EXTERIOR WINDOW SUNBURST: [TASK]: Cast realistic, vibrant sunlight splashes only onto the actual objects visible through the window panes (e.g. tree leaves, grass, patio stone). [ACTION]: Target specific exterior elements seen through glass and enhance with localized highlights. [FORBID]: Do not brighten window frames, mullions, or the glass surface itself. Maintain the indoor room exposure exactly as is. [LOCK]: Use the provided mask to define window glass areas if available.',"""

new_ws_prompt = """    id: 'window_splash',
    label: 'Window Splash',
    description: 'Project vivid sunlight onto exterior objects (trees, lawn, patio) visible through windows. Best used with the Lasso.',
    prompt: 'EXTERIOR WINDOW RELIGHTING PROTOCOL: [STRICT_OBJECT_IDENTITY_LOCK]: 100% PRESERVE AND KEEP ALL EXISTING OBJECTS, TREES, BRANCHES, LEAVES, FOLIAGE, LAWN, PATIO, BUILDINGS, AND LANDSCAPING COMPLETELY UNCHANGED. DO NOT REPLACE, REGENERATE, ALTER, SHIFT, OR INTRODUCE ANY NEW OBJECTS OR GEOMETRY. [LIGHTING_ENHANCEMENT]: ONLY cast vibrant, direct warm sunlight highlights and increase sunlight exposure onto the surfaces of the existing trees, leaves, and exterior grounds seen through the window glass, as if bright golden-hour / clear midday sun is striking them. Keep window frames, mullions, glass reflections, and indoor room 100% identical.',"""

if old_ws_prompt in constants_code:
    constants_code = constants_code.replace(old_ws_prompt, new_ws_prompt)
    with open('constants.ts', 'w', encoding='utf-8') as f:
        f.write(constants_code)
    print("Updated constants.ts window_splash prompt!")
else:
    print("Warning: old_ws_prompt pattern not found in constants.ts")

# 2. Update server.ts to handle Window Splash specifically in FLUX inpainting or Gemini
with open('server.ts', 'r', encoding='utf-8') as f:
    server_code = f.read()

old_inpaint_ws = """                        if (upperPrompt.includes('WINDOW SPLASH') || upperPrompt.includes('WINDOW SUNBURST') || upperPrompt.includes('EXTERIOR WINDOW')) {
                            inpaintPrompt = "Vibrant natural sunlight highlights on trees, grass, and patio visible through window panes. Keep interior room, window frames, and glass untouched.";"""

new_inpaint_ws = """                        if (upperPrompt.includes('WINDOW SPLASH') || upperPrompt.includes('WINDOW SUNBURST') || upperPrompt.includes('EXTERIOR WINDOW')) {
                            inpaintPrompt = "Strictly preserve exact existing trees, branches, foliage, lawn, and patio. Cast bright natural golden sunlight highlights and warm direct sun rays onto the existing vegetation and exterior ground seen through the window panes. Zero changes to tree shapes, structures, or window frames.";"""

if old_inpaint_ws in server_code:
    server_code = server_code.replace(old_inpaint_ws, new_inpaint_ws)
    print("Updated server.ts inpaint prompt for window splash!")

# Also add special directive in server.ts Gemini parts:
old_prompt_directive = """        if (maskBase64) {
            parts.push({ text: `[TASK_COMMAND]: ${prompt}\\n[STRICT_MASK_ADHERENCE]: Execute modifications ONLY within the WHITE regions. Black regions are 100% immutable original physical architecture and landscaping.` });
        } else {"""

new_prompt_directive = """        if (maskBase64) {
            const isWindowRelight = upperPrompt.includes('WINDOW SPLASH') || upperPrompt.includes('WINDOW SUNBURST') || upperPrompt.includes('WINDOW RELIGHTING');
            if (isWindowRelight) {
                parts.push({
                    text: `[SURGICAL_WINDOW_RELIGHT_DIRECTIVE]:
- STRICT IDENTITY & OBJECT PRESERVATION: Absolutely do NOT replace, mutate, or hallucinate different trees, plants, buildings, or outdoor features. Keep every single branch, leaf, trunk, and grass blade in its exact existing position and structure.
- LIGHTING MODULATION ONLY: Only increase the illumination and add natural warm sunlit highlights, sun flecks, and bright direct sunlight exposure to the existing outdoor elements.
- PRESERVE UNMASKED SURFACES: Black regions in the mask are 100% immutable original interior room and architecture.`
                });
            }
            parts.push({ text: `[TASK_COMMAND]: ${prompt}\\n[STRICT_MASK_ADHERENCE]: Execute modifications ONLY within the WHITE regions. Black regions are 100% immutable original physical architecture and landscaping.` });
        } else {"""

if old_prompt_directive in server_code:
    server_code = server_code.replace(old_prompt_directive, new_prompt_directive)
    print("Added surgical window relight directive to Gemini parts in server.ts!")

with open('server.ts', 'w', encoding='utf-8') as f:
    f.write(server_code)

