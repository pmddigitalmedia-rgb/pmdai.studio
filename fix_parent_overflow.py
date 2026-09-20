with open('App.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Let's check where the right sidebar scroll container is in App.tsx:
# Look for inspector / tools container overflow classes around line 1880-1920
import re

# In App.tsx, the tools list is inside the inspector sidebar.
# If any ancestor has overflow-hidden or overflow-y-auto on the immediate grid, let's make sure overflow is visible or the tooltip can escape.
# Also let's ensure the sidebar panel itself allows tooltip visibility, or we can use fixed positioning on mouse enter if needed.
print('Checking sidebar container...')
