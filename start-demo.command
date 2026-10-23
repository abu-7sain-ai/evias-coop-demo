#!/bin/bash
# E-VIAS demo launcher for macOS — double-click in Finder.
cd "$(dirname "$0")" || exit 1
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh" >/dev/null 2>&1

pause() { echo; read -n 1 -s -r -p "اضغط أي زر للإغلاق / Press any key to close"; echo; }

if ! command -v node >/dev/null 2>&1; then
  cat scripts/launcher/no-node.txt
  pause; exit 1
fi
if ! node -e 'const [a,b]=process.versions.node.split(".").map(Number); process.exit(a>20||(a===20&&b>=19)?0:1)'; then
  cat scripts/launcher/old-node.txt; echo "($(node -v))"
  pause; exit 1
fi
if [ ! -d node_modules ]; then
  cat scripts/launcher/installing.txt
  npm install --no-audit --no-fund || { pause; exit 1; }
fi
node scripts/demo.mjs || pause
