# Contributing to Groundwork

## Run from source

Needs Node.js (LTS).

- `git clone https://github.com/asheemstha/groundwork.git`, then double-click **Start Groundwork.command** (Windows: **Start Groundwork.bat**). It opens http://localhost:4477, pulls the latest code each time it starts, and keeps its data in `groundwork/data`.
- `npm run app` runs the desktop app from source next to the installed one, using the same `groundwork/data` folder. `npm run dist` builds it into `release/`.
- Working on the interface: `node server.js`, then `cd web && npx vite` (it proxies `/api` to the server). `npm run build` writes `web/dist`, which the server serves.

## Publishing an update (maintainer)

Double-click **Publish Update.command**. It asks what changed, builds, bumps the version and pushes a version tag. GitHub Actions then builds the Mac app (about 10 minutes) and publishes it as a Release. Everyone's app offers the update after that.

How updates install:

- Most releases only change the app's code. The updater downloads the code zip from the Release (about 4 MB) into `<userData>/code/<version>/` and restarts. The app in Applications isn't touched, so macOS doesn't ask for permission each time.
- A release that changes the Electron shell (`desktop/`, or Electron itself) must bump `gwShell` in package.json. Apps on an older shell then download the full app, replace it and reopen.
- If a downloaded code update fails to start, the app deletes it and opens the version it shipped with.

## How it fits together

- **Projects** live in `data/projects/<id>/project.json`, with sign-off proof in `files/`, launch check reports in `launch/` and the redirect map in `redirects.json`. Templates are in `data/templates.json`. A project has three sites (`sites.old`, `sites.staging`, `sites.live`); the launch check and the redirect test only tick items on the live domain.
- **Scans and plans** live in `data/runs/<id>/`. Each belongs to a project (`projectId`) and says which of its sites it read (`site`). Scans from before v0.8 are claimed at startup by the project with the same address, and the rest become audit projects.
- **Scan** (no AI): opens each page in headless Chrome, waits for preloaders and page transitions, closes popups, scrolls to load lazy images, then records every heading, heading-styled text and a full-page screenshot.
- **Heading plan**: runs `claude -p` or `codex exec` in the run's folder with the heading skill (`tools/h-tag-planner/` is the built-in one). The AI can only read files and write JSON: no shell, web or connectors. It writes `plan/_site.json`, then one file per page, which drives the progress bar. The app then runs the skill's automatic checks, gives the AI one pass to fix failures, and builds the to-do list and the HTML guide.
- **SEO plan**: reads each page's current title and description, then the AI writes a title, description and slug per page into `seo/plan/`, using the heading plan's keywords when there is one. Checks: titles up to 60 characters, descriptions up to 155, the keyword in the title, unique titles and URLs, clean slugs.
- **Skills**: each AI tool follows a skill. Added skills live in `data/skills/<id>/`; the one in use is remembered in the app's prefs. The SEO plan's built-in rules are `RULES` in `lib/seo.js`.
- **Launch check** (`lib/launch.js`) and **redirect map** (`lib/redirects.js`) use no AI.

## Code

- `desktop/`: the Electron app. `main.js` starts the server inside the app and picks the newest compatible code update; `updater.js` updates it from GitHub Releases.
- `server.js`: local API and job runner, bound to 127.0.0.1.
- `lib/projects.js`: projects, templates, due dates and what each Groundwork tool ticks. `lib/templates-default.js`: the built-in checklists and messages.
- `lib/engines.js`: Claude Code and Codex detection, models, efforts and the runner.
- `lib/crawl.js`: browser scans, screenshots and live checks. On a Mac, Chrome is started with `open` so macOS attributes it to Chrome, not Groundwork.
- `lib/headings.js`, `lib/seo.js`, `lib/skills.js`: the AI plans and their skills.
- `shared/checks.mjs`, `shared/seo.mjs`: checks used by both the server and the app.
- `web/`: the app's interface. React, Vite, Tailwind v4, shadcn/ui on Base UI, Lucide icons and the Geist font. Neutral palette with one orange accent (`web/src/index.css`), no gradients.

## Writing style

The interface and docs use plain, short sentences. No em dashes, and font weights 400 and 500 only.

## Not yet

- Keyword data (for example from Ahrefs) isn't connected, so keywords are marked unverified and have no volumes. To add it: drop `--strict-mcp-config` for Claude runs, which loads the user's connectors, and remove the "Keyword data" paragraph in `planPrompt()`.
- Codex runs are built from Codex's documented CLI and have had far less testing than Claude Code.
