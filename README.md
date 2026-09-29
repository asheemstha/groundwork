# Groundwork

Plan site improvements with your own Claude Code or Codex account. The first tool is **Heading structure**. It plans H1–H6 for every page and turns the plan into a to-do list a developer can tick off.

## Install (once)

You need **Node.js** (nodejs.org, LTS), **Google Chrome**, and **Claude Code or Codex** signed in to your own plan. Then open Terminal and paste:

```bash
cd ~/Documents && git clone https://github.com/asheemstha/groundwork.git
```

Double-click **Start Groundwork.command** in the new `groundwork` folder (Windows: **Start Groundwork.bat**). It opens http://localhost:4477. Keep its window open while you use the app.

## Updates

- Every time you start Groundwork it downloads the latest version first.
- While it's open, it checks every few hours. When there's a new version, the sidebar shows **Update available**. Click **Update now** and it restarts on the new version.
- Your sites, plans and to-do progress are in `groundwork/data` and are never touched by updates or uploaded anywhere.

**Publishing an update (maintainer only):** double-click **Publish Update.command**. It builds the app, bumps the version, asks what changed and pushes to GitHub. Everyone else gets it the next time they open Groundwork or click Update now.

The app walks you through installing and signing in to Claude Code or Codex (sidebar → Engines & settings).

## How it works

1. **Free scan** (no AI). Opens each page in headless Chrome and waits for preloaders and page-transition curtains to finish. It closes popups, scrolls to load lazy images and reveal scroll animations, then records every heading, heading-styled text and a full-page screenshot.
2. **AI plan** (your plan's usage). You pick the pages, country, output, engine, model and effort, and see the time and usage estimate first. It runs `claude -p` or `codex exec` with the `h-tag-planner` skill in `tools/h-tag-planner/`. The AI can only read files and write JSON: no shell, web or connectors. It writes `plan/_site.json` first, then one file per page, which drives the real progress bar and time left. The composer's text box passes extra instructions to the AI. The browser tab shows progress, and you get a desktop notification when it's done.
3. **Checks and guide.** Runs the skill's automatic checks and gives the AI one pass to fix failures. It builds the skill's HTML guide (Export) and the in-app to-do list.
4. **To-do list.** Numbered pins on the screenshot match the list. Hovering or selecting a change scrolls the screenshot to it, and a scroll track shows where every change sits. Keyboard: `j`/`k` move, `x` ticks, `n`/`p` change page.
5. **Check live site** re-reads the live pages and ticks off changes that are really there. **Retake screenshots** (site menu) is free.

## Usage transparency

- The engine picker shows who is signed in, and whether that login bills a subscription or an API key.
- A one-time confirmation before the first plan per engine shows pages, time and usage.
- For Claude Code, the app reads the 5-hour and weekly usage windows from Claude Code's own rate-limit events. They appear in the sidebar, under the plan composer and on the plan card. These windows are shared with anything else using the same Claude account at the same time.

## Code

- `server.js`: local API and job runner (binds to 127.0.0.1). Data lives in `data/runs/<id>/`.
- `lib/engines.js`: Claude Code / Codex detection, models, efforts and the runner.
- `lib/crawl.js`: browser scan, preloader handling, screenshots and live checks.
- `lib/headings.js`: prompts, turning the AI's plan into to-dos, export and verification.
- `shared/checks.mjs`: automatic checks used by both server and app.
- `web/`: the app. React + Vite + Tailwind v4, shadcn/ui on **Base UI**, Lucide icons, Geist fonts. Warm neutral palette with one orange accent (`web/src/index.css`), no gradients.
  - Develop: `node server.js`, then `cd web && npx vite` (it proxies `/api` to the server).
  - Build: `npm run build` (writes `web/dist`, which the server serves).

## Not yet

- **Ahrefs** is off. Keywords are marked "unverified" and have no volumes. To add it: drop `--strict-mcp-config` for Claude runs, which loads the user's connectors, and remove the "Keyword data" paragraph in `planPrompt()`.
- Codex runs are built from Codex's documented CLI but haven't been tested on a machine with Codex installed.
