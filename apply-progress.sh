#!/usr/bin/env bash
# Entropy Breakers — ensure every module HTML loads the shared eb-* assets.
#
# Usage: bash apply-progress.sh
#
# Idempotent: each tag is inserted only when missing. Safe to re-run.
# Skips index.html (wired by hand).
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

python3 - <<'PY'
import glob, re

HEAD_TAG = '<link rel="stylesheet" href="assets/eb-theme.css">'
# Order matters: eb-config defines window.EB_SUPABASE before eb-sync reads it;
# eb-sync runs after eb-progress so window.EB is available.
BODY_TAGS = [
    '<script src="assets/eb-config.js"></script>',
    '<script src="assets/eb-progress.js" defer></script>',
    '<script src="assets/eb-catalog.js" defer></script>',
    '<script src="assets/eb-sync.js" defer></script>',
    '<script src="assets/eb-speak.js" defer></script>',
]

def src_of(tag):
    return tag.split('"')[1]

changed = 0
for path in sorted(glob.glob('*.html')):
    if path == 'index.html':
        continue
    with open(path, encoding='utf-8') as f:
        html = f.read()
    original = html

    if 'assets/eb-theme.css' not in html:
        html = re.sub(r'(\s*)</head>', '\n  ' + HEAD_TAG + r'\1</head>',
                      html, count=1, flags=re.IGNORECASE)

    missing = [t for t in BODY_TAGS if src_of(t) not in html]
    if missing:
        html = re.sub(r'(\s*)</body>', '\n' + '\n'.join(missing) + r'\1</body>',
                      html, count=1, flags=re.IGNORECASE)

    if html != original:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(html)
        changed += 1

print('Updated %d file(s).' % changed)
PY
