#!/bin/bash
# For the person who maintains Groundwork: publishes a new version of the app.
# It bumps the version, pushes a tag, and GitHub builds the Mac app and attaches it to a Release (about 10 minutes).
# Everyone's app sees the new version the next time it checks and offers "Update now".
cd "$(dirname "$0")"
set -e
if [ -n "$(git status --porcelain)" ]; then git status --short; echo; fi
read -r -p "What changed? (one line, shown in the app) " msg
msg="${msg:-Improvements and fixes}"
echo "Building the web app…"
(cd web && npm install --silent --no-audit --no-fund && npm run build >/dev/null)
v=$(node -e "const f='package.json',j=require('./'+f),v=j.version.split('.').map(Number);v[2]++;j.version=v.join('.');require('fs').writeFileSync(f,JSON.stringify(j,null,2)+'\n');process.stdout.write(j.version)")
npm install --silent --no-audit --no-fund --package-lock-only
git add -A
git commit -q -m "$msg"
git tag "v$v"
if git push -q origin HEAD "v$v"; then
  echo "Published v$v. GitHub is building the app now: https://github.com/asheemstha/groundwork/actions"
  echo "When it's done it appears at https://github.com/asheemstha/groundwork/releases and everyone's app offers the update."
else
  echo "Couldn't push. Check your GitHub access and try again (the version tag v$v was created locally)."
fi
read -n 1 -s -r -p "Press any key to close."
