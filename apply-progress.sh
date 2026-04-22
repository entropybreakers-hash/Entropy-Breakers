#!/usr/bin/env bash
# Entropy Breakers — Inject eb-progress.js + eb-catalog.js + eb-theme.css
# into every module HTML. Safe to re-run (idempotent).
#
# Usage: cd ujdizajn && bash apply-progress.sh
#
# Skips: index.html (already wired by hand), any file that already
# contains "assets/eb-progress.js".
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

CSS_LINK='<link rel="stylesheet" href="assets/eb-theme.css">'
JS_TAGS='<script src="assets/eb-progress.js" defer></script>
<script src="assets/eb-catalog.js" defer></script>'

injected=0
skipped=0
for f in *.html; do
  [[ "$f" == "index.html" ]] && continue
  if grep -q 'assets/eb-progress.js' "$f"; then
    skipped=$((skipped+1)); continue
  fi
  tmp="$(mktemp)"
  python3 - "$f" "$tmp" "$CSS_LINK" "$JS_TAGS" <<'PY'
import sys, re
src_path, dst_path, css, js = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
with open(src_path, 'r', encoding='utf-8') as f: html = f.read()
if 'assets/eb-theme.css' not in html:
    html = re.sub(r'(\s*)</head>', '\n  ' + css + r'\1</head>', html, count=1, flags=re.IGNORECASE)
html = re.sub(r'(\s*)</body>', '\n' + js + r'\1</body>', html, count=1, flags=re.IGNORECASE)
with open(dst_path, 'w', encoding='utf-8') as f: f.write(html)
PY
  mv "$tmp" "$f"
  injected=$((injected+1))
done
echo "Injected: $injected file(s)."
echo "Skipped (already done): $skipped file(s)."
