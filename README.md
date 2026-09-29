# Groundwork

Plan site improvements with your own Claude Code or Codex account. The first tool is **Heading structure**. It plans H1–H6 for every page and turns the plan into a to-do list a developer can tick off.

## Install (Mac)

You need **Google Chrome** and **Claude Code or Codex** signed in to your own plan. The app walks you through installing and signing in to either one (sidebar → Engines & settings).

Open **Terminal** (Applications → Utilities), paste this and press Return:

```bash
curl -fsSL https://raw.githubusercontent.com/asheemstha/groundwork/main/install.sh | bash
```

It downloads the latest version into Applications and opens it. There's no security prompt, because macOS only asks about apps downloaded through a browser. Running it again reinstalls the latest version. [install.sh](install.sh) is short if you want to read it first.

**Or download the .dmg** from the [latest release](https://github.com/asheemstha/groundwork/releases/latest) and drag **Groundwork** into **Applications**. The app isn't signed with an Apple developer certificate, so the first time you open it macOS says it can't check it for malicious software. Click **Done**, go to **System Settings → Privacy & Security**, and click **Open Anyway** next to Groundwork. You only do this once.

Your sites, plans and to-do progress stay on your Mac in `~/Library/Application Support/Groundwork/data` (Help → Show app data in Finder). Nothing is uploaded.

## Updates

- Groundwork checks GitHub for a new version when it opens and every few hours. When there is one, the sidebar shows **Update available**.
- Click **Update now**. It downloads the new version, replaces itself and reopens. Your data isn't touched.
- Updating only works when the app is in Applications (or another folder you can write to).

**Publishing an update (maintainer only):** double-click **Publish Update.command**. It asks what changed, builds, bumps the version, and pushes a version tag. GitHub Actions then builds the Mac app (about 10 minutes) and publishes it as a Release. Everyone's app offers the update after that.

## Run from source (developers)

Needs Node.js (LTS). `git clone https://github.com/asheemstha/groundwork.git`, then double-click **Start Groundwork.command** (Windows: **Start Groundwork.bat**). It opens http://localhost:4477, pulls the latest code each time it starts, and keeps its data in `groundwork/data`. `npm run app` runs the desktop app from source next to the installed one, using the same `groundwork/data` folder. `npm run dist` builds it into `release/`.

## How it works

1. **Scan** (runs on your Mac, no AI). Opens each page in headless Chrome and waits for preloaders and page-transition curtains to finish. It closes popups, scrolls to load lazy images and reveal scroll animations, then records every heading, heading-styled text and a full-page screenshot.
2. **AI plan** (your plan's usage). You pick the pages, country, output, engine, model and effort, and see the time and usage estimate first. It runs `claude -p` or `codex exec` with the `h-tag-planner` skill in `tools/h-tag-planner/`. The AI can only read files and write JSON: no shell, web or connectors. It writes `plan/_site.json` first, then one file per page, which drives the real progress bar and time left. The composer's text box passes extra instructions to the AI. The browser tab shows progress, and you get a desktop notification when it's done.
3. **Checks and guide.** Runs the skill's automatic checks and gives the AI one pass to fix failures. It builds the skill's HTML guide (Export) and the in-app to-do list.
4. **To-do list.** Numbered pins on the screenshot match the list. Hovering or selecting a change scrolls the screenshot to it, and a scroll track shows where every change sits. Keyboard: `j`/`k` move, `x` ticks, `n`/`p` change page.
5. **Check live site** re-reads the live pages and ticks off changes that are really there. **Retake screenshots** (site menu) uses no AI.

## Usage transparency

- The engine picker shows who is signed in, and whether that login bills a subscription or an API key.
- A one-time confirmation before the first plan per engine shows pages, time and usage.
- For Claude Code, the app reads the 5-hour and weekly usage windows from Claude Code's own rate-limit events. They appear in the sidebar, under the plan composer and on the plan card. These windows are shared with anything else using the same Claude account at the same time.

## Code

- `desktop/`: the Electron app. `main.js` starts the server inside the app, `updater.js` updates it from GitHub Releases.
- `server.js`: local API and job runner (binds to 127.0.0.1). Data lives in `data/runs/<id>/`, or the app's data folder.
- `lib/engines.js`: Claude Code / Codex detection, models, efforts and the runner.
- `lib/crawl.js`: browser scan, preloader handling, screenshots and live checks.
- `lib/headings.js`: prompts, turning the AI's plan into to-dos, export and verification.
- `shared/checks.mjs`: automatic checks used by both server and app.
- `web/`: the app. React + Vite + Tailwind v4, shadcn/ui on **Base UI**, Lucide icons, the Geist font. Warm neutral palette with one orange accent (`web/src/index.css`), no gradients.
  - Develop: `node server.js`, then `cd web && npx vite` (it proxies `/api` to the server).
  - Build: `npm run build` (writes `web/dist`, which the server serves).

## Not yet

- **Ahrefs** is off. Keywords are marked "unverified" and have no volumes. To add it: drop `--strict-mcp-config` for Claude runs, which loads the user's connectors, and remove the "Keyword data" paragraph in `planPrompt()`.
- Codex runs are built from Codex's documented CLI but haven't been tested on a machine with Codex installed.
