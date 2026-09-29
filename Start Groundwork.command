#!/bin/bash
# Double-click to start Groundwork. Keep this window open while you use it.
# It updates itself from GitHub every time it starts, and when you click "Update now" in the app.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Groundwork needs Node.js. Install it from https://nodejs.org (the LTS version), then double-click this again."
  read -n 1 -s -r -p "Press any key to close."; exit 1
fi
update() {
  if [ -d .git ] && command -v git >/dev/null 2>&1; then
    echo "Checking for updates…"
    git pull --ff-only --quiet && echo "Groundwork is up to date." || echo "Couldn't check for updates (offline?). Starting the version you have."
  fi
  npm install --silent --no-audit --no-fund >/dev/null 2>&1 || npm install
}
update
if [ ! -f web/dist/index.html ]; then
  echo "Building the app (first run only)…"
  (cd web && npm install --silent && npm run build >/dev/null) || { echo "Build failed."; read -n 1 -s -r; exit 1; }
fi
(sleep 1.5; open "http://localhost:4477") &
export GW_LAUNCHER=1
while true; do
  node server.js
  [ $? -eq 75 ] || break   # 75 = the app asked to update and restart
  echo "Updating Groundwork…"
  update
  export GW_RESTARTED=1
done
