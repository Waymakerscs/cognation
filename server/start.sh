#!/usr/bin/env bash
# Start the COGNATION session service (foreground).
set -euo pipefail
cd "$(dirname "$0")"
if [[ ! -d node_modules/express ]]; then
  echo "Installing dependencies…"
  npm install --omit=dev
fi
exec node server.js
