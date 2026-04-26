#!/usr/bin/env python3
"""
Run this from your project root:
  python3 cleanup.py

It will:
1. Remove emojis next to words in all .html and .js files in public/
2. Replace Playfair Display and DM Sans with Inter everywhere
"""

import re, os, sys

EMOJI_RE = re.compile(
    '['
    '\U0001F000-\U0001FFFF'   # All supplementary emoji blocks
    '\u2600-\u26FF'            # Misc symbols
    '\u2700-\u27BF'            # Dingbats
    '\u2B50\u2B55'
    '\u00A9\u00AE\u2122\u2139'
    '\u231A-\u231B\u23CF\u23E9-\u23F3\u23F8-\u23FA'
    '\u24C2'
    '\u25AA-\u25AB\u25B6\u25C0\u25FB-\u25FE'
    '\u2702\u2705\u2708-\u270D\u270F\u2712\u2714\u2716\u271D\u2728'
    '\u2733\u2734\u2744\u2747\u274C\u274E\u2753-\u2757\u2763\u2764'
    '\u2795-\u2797\u27A1\u27B0\u27BF'
    '\u2934-\u2935'
    '\u3030\u303D\u3297\u3299'
    ']'
)

# Match: optional space + emoji(s) + optional space, only when adjacent to word chars or punctuation
# This removes emojis that appear next to text, but not standalone decorative ones
EMOJI_WITH_ADJACENT_TEXT = re.compile(
    r'(?<=[A-Za-z0-9\s"\'>])' + EMOJI_RE.pattern + r'+\s*'  # emoji after text
    r'|'
    r'\s*' + EMOJI_RE.pattern + r'+(?=[A-Za-z0-9\s"\'<])'   # emoji before text
)

def clean_file(path):
    with open(path, 'r', encoding='utf-8', errors='replace') as f:
        content = f.read()

    original = content

    # Remove emojis adjacent to text
    content = EMOJI_WITH_ADJACENT_TEXT.sub('', content)

    # Also remove any remaining emojis (catches edge cases)
    content = EMOJI_RE.sub('', content)

    # Fix fonts
    content = content.replace("'Playfair Display', serif", "'Inter', sans-serif")
    content = content.replace("'Playfair Display',serif", "'Inter',sans-serif")
    content = content.replace("'DM Sans', sans-serif", "'Inter', sans-serif")
    content = content.replace("'DM Sans',sans-serif", "'Inter',sans-serif")
    content = content.replace('"Playfair Display"', '"Inter"')
    content = content.replace('"DM Sans"', '"Inter"')
    content = content.replace("'Playfair Display'", "'Inter'")
    content = content.replace("'DM Sans'", "'Inter'")
    content = content.replace(
        "Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600",
        "Inter:wght@300;400;500;600;700;800;900"
    )

    # Fix Google Fonts import URL in <link> tags
    content = re.sub(
        r'https://fonts\.googleapis\.com/css2\?family=Playfair[^"\']+',
        'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap',
        content
    )

    # Clean up double spaces left by emoji removal
    content = re.sub(r'  +', ' ', content)
    # Clean up " > text" where space before > is left
    content = re.sub(r'\s+>', '>', content)

    if content != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  Fixed: {os.path.basename(path)}')
    else:
        print(f'  No change: {os.path.basename(path)}')

def main():
    public_dir = os.path.join(os.path.dirname(__file__), 'public')
    if not os.path.isdir(public_dir):
        print(f'ERROR: public/ directory not found at {public_dir}')
        sys.exit(1)

    print(f'Cleaning files in: {public_dir}\n')
    for fname in sorted(os.listdir(public_dir)):
        if fname.endswith('.html') or fname.endswith('.js') or fname.endswith('.css'):
            clean_file(os.path.join(public_dir, fname))

    print('\nDone! All files cleaned.')

if __name__ == '__main__':
    main()
