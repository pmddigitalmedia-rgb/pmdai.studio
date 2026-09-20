with open('services/geminiService.ts', 'r') as f:
    code = f.read()

# Check where applySurgicalComposite is called:
for line in code.split('\n'):
    if 'applySurgicalComposite' in line:
        print(line)
