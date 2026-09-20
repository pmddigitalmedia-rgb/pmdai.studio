import re

with open('App.tsx', 'r', encoding='utf-8') as f:
    code = f.read()

# Pattern 1: group/toolbtn tooltip div
p1 = r'<div className="pointer-events-none absolute right-\[calc\(100%\+12px\)\][^>]*group-hover/toolbtn:opacity-100.*?<\/div>\s*<\/div>'
code = re.sub(p1, '', code, flags=re.DOTALL)

# Pattern 2: group/stagertoolbtn tooltip div
p2 = r'<div className="pointer-events-none absolute right-\[calc\(100%\+12px\)\][^>]*group-hover/stagertoolbtn:opacity-100.*?<\/div>\s*<\/div>'
code = re.sub(p2, '', code, flags=re.DOTALL)

# Pattern 3: group/panotoolbtn tooltip div
p3 = r'<div className="pointer-events-none absolute right-\[calc\(100%\+12px\)\][^>]*group-hover/panotoolbtn:opacity-100.*?<\/div>\s*<\/div>'
code = re.sub(p3, '', code, flags=re.DOTALL)

with open('App.tsx', 'w', encoding='utf-8') as f:
    f.write(code)

print("Cleaned duplicate relative tooltips in App.tsx!")
