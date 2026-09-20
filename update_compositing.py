# Check App.tsx around line 1032
with open('App.tsx', 'r', encoding='utf-8') as f:
    app_code = f.read()

# Let's inspect where editImageWeather is called and ensure applySurgicalComposite is always guaranteed on the output if usedMask was provided:
old_call = """      } else {
        resultUrl = await editImageWeather(sourceBase64!, mimeType, combinedPrompts, 'gemini-3.1-flash-image', usedMask, item.dimensions, sampleBase64);
      }"""

new_call = """      } else {
        resultUrl = await editImageWeather(sourceBase64!, mimeType, combinedPrompts, 'gemini-3.1-flash-image', usedMask, item.dimensions, sampleBase64);
      }
      
      // Mandatory safeguard for manual lasso/mask edits:
      // Guarantee that unmasked areas of the source photo are 100% preserved and never dropped or blacked out
      if (usedMask) {
        try {
          const originalDataUrl = `data:${mimeType};base64,${sourceBase64}`;
          const maskDataUrl = usedMask.startsWith('data:') ? usedMask : `data:image/png;base64,${usedMask}`;
          resultUrl = await applySurgicalComposite(originalDataUrl, resultUrl, maskDataUrl);
        } catch (compErr) {
          console.warn("Client surgical composite pass failed:", compErr);
        }
      }"""

if old_call in app_code:
    app_code = app_code.replace(old_call, new_call)
    with open('App.tsx', 'w', encoding='utf-8') as f:
        f.write(app_code)
    print("Added mandatory surgical composite safeguard in App.tsx!")
else:
    print("Notice: old_call snippet not found, inspecting...")

