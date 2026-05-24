import re

with open(r'c:\Users\Саян\myfirstapp\WeaveMiniApp\WeaveApp\mockups\profile_ornament_preview.html', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Boost CSS opacity on vine to 1 (let SVG control the look)
content = content.replace(
    '.hook-card[data-card-style="vine"] .card-vine {\r\n    display: block;\r\n    position: absolute;\r\n    left: 4px; top: 0; width: 14px; height: 100%;\r\n    pointer-events: none; z-index: 1;\r\n    filter: url(#inkBleedSmall);\r\n    opacity: 0.7;\r\n  }',
    '.hook-card[data-card-style="vine"] .card-vine {\r\n    display: block;\r\n    position: absolute;\r\n    left: 4px; top: 0; width: 14px; height: 100%;\r\n    pointer-events: none; z-index: 1;\r\n    filter: url(#inkBleedSmall);\r\n    opacity: 1;\r\n  }'
)

# 2. Inside vine SVGs: boost path opacity from 0.45 to 0.8, circles from 0.3 to 0.7, stroke-width from 1.2 to 1.6
# The vine SVGs contain: stroke-width="1.2" opacity="0.45" and circles with opacity="0.3"
content = content.replace(
    'stroke-width="1.2" fill="none" opacity="0.45"',
    'stroke-width="1.8" fill="none" opacity="0.85"'
)

# Fix vine ::before bar opacity too
content = content.replace(
    "background: #2A1810;\r\n    opacity: 0.4;",
    "background: #2A1810;\r\n    opacity: 0.7;"
)

# Boost circle opacities inside vine SVGs - they have r="2" and opacity="0.3"
# These are the vine dots
content = re.sub(
    r'(<circle cx="7" cy="\d+" r="2" fill="#2A1810") opacity="0.3"',
    r'\1 opacity="0.7"',
    content
)

with open(r'c:\Users\Саян\myfirstapp\WeaveMiniApp\WeaveApp\mockups\profile_ornament_preview.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done! Vine is now dark ink.")
