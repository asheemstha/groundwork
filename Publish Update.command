#!/bin/bash
# For the person who maintains Groundwork: builds the app and publishes it to GitHub.
# Everyone else gets it the next time they open Groundwork (or with "Update now" in the app).
cd "$(dirname "$0")"
set -e
echo "Building the app…"
(cd web && npm install --silent --no-audit --no-fund && npm run build >/dev/null)
node -e "const f='package.json',j=require('./'+f),v=j.version.split('.').map(Number);v[2]++;j.version=v.join('.');require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n');console.log('Version '+j.version)"
git add -A
read -r -p "What changed? (one line) " msg
git commit -q -m "${msg:-Update Groundwork}"
git push -q && echo "Published. Your colleagues get it the next time they open Groundwork." || echo "Couldn't push. Check your GitHub sign-in and try again."
read -n 1 -s -r -p "Press any key to close."
