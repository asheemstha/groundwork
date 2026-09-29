#!/bin/bash
# Installs (or reinstalls) the latest Groundwork into Applications, then opens it:
#   curl -fsSL https://raw.githubusercontent.com/asheemstha/groundwork/main/install.sh | bash
# Downloading with curl instead of a browser means macOS doesn't flag the app as "downloaded from the internet",
# so there's no "can't check it for malicious software" prompt. The app updates itself after this.
set -euo pipefail
repo=asheemstha/groundwork

if [ -n "${GW_INSTALL_DIR:-}" ]; then dest="$GW_INSTALL_DIR"
elif [ -w /Applications ]; then dest=/Applications
else dest="$HOME/Applications"; fi
mkdir -p "$dest"

url=$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest" | grep -o '"browser_download_url": *"[^"]*-mac\.zip"' | head -1 | sed 's/.*"\(https[^"]*\)"$/\1/')
[ -n "$url" ] || { echo "Couldn't find the latest Groundwork release. Check your internet connection and try again."; exit 1; }

tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
echo "Downloading $(basename "$url")…"
curl -fL --progress-bar "$url" -o "$tmp/groundwork.zip"
ditto -x -k "$tmp/groundwork.zip" "$tmp"
[ -d "$tmp/Groundwork.app" ] || { echo "The download didn't contain the app."; exit 1; }

# Quit a running copy first. Your sites and plans live outside the app and aren't touched.
osascript -e 'if application "Groundwork" is running then tell application "Groundwork" to quit' >/dev/null 2>&1 || true
while pgrep -xq Groundwork; do sleep 0.5; done
rm -rf "$dest/Groundwork.app"
mv "$tmp/Groundwork.app" "$dest/"
echo "Installed in $dest."
[ -n "${GW_NO_OPEN:-}" ] || open "$dest/Groundwork.app"
