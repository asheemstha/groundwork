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
- **Heading plan**: runs `claude -p` or `codex exec` in the run's folder with the heading skill (`tools/h-tag-planner/` is the built-in one). The AI can only read files and write JSON: no shell, web or connectors. When the installed Claude Code has `--restricted` (checked once with `claude --help`), plans run with it, which confines the file tools to the run's folder; everything a plan needs (page text, screenshots, the skill) is copied there first. It writes `plan/_site.json`, then one file per page, which drives the progress bar. The app then runs the skill's automatic checks, gives the AI one pass to fix failures, and builds the to-do list and the HTML guide.
- **SEO plan**: reads each page's current title and description, then the AI writes a title, description and slug per page into `seo/plan/`, using the heading plan's keywords when there is one. Checks: titles up to 60 characters, descriptions up to 155, the keyword in the title, unique titles and URLs, clean slugs.
- **Skills**: each AI tool follows a skill. Added skills live in `data/skills/<id>/`; the one in use is remembered in the app's prefs. The SEO plan's built-in rules are `RULES` in `lib/seo.js`.
- **Launch check** (`lib/launch.js`) and **redirect map** (`lib/redirects.js`) use no AI. The launch check runs axe-core (`node_modules/axe-core/axe.min.js`, evaluated in each page) and the speed test in `lib/speed.js` (CDP throttling like Lighthouse's mobile preset, measured with PerformanceObserver). axe-core ships in the code-only update zip too, so the release workflow copies it next to playwright-core.
- **After-launch watch**: `watchTick()` in `lib/projects.js`, called by server.js two minutes after start and every 30 minutes. It runs the launch check (and the redirect test when there's a map) on the live domain at days 3, 7 and 30, once each, within two weeks of the day.
- **Content inventory** (`lib/inventory.js`): rule suggestions from the old-site scan, optional AI suggestions through `assist.ask`, stored in `projects/<id>/inventory.json`.

## Code

- `desktop/`: the Electron app. `main.js` starts the server inside the app and picks the newest compatible code update; `updater.js` updates it from GitHub Releases.
- `server.js`: local API and job runner, bound to 127.0.0.1.
- `lib/projects.js`: projects, templates, due dates and what each Groundwork tool ticks, plus Today (`home()`: the week and the messages to send), payments, reminders (`remindDue`) and the calendar feed (`calendar()`, served at `/api/calendar.ics`).
- `lib/time.js`: the work log (`data/time.json`), the one running timer (`data/timer.json`) and the day's tasks (`data/tasks.json`). Every entry has `who` (your name from Settings), so studio logs can be put together later. `tick()` runs every minute from server.js with the Mac's idle time (Electron's `powerMonitor`) and notices time away: no input for 15 minutes, or a gap while the Mac slept or the app was closed. A project's time reaches its view through `timeOf` in `lib/projects.js`, and a project export carries its entries in `time.json`.
- `lib/tracking.js`: the launch check's tracking test. `watch(ctx)` records each page's tag requests and blocks the data they send (`crawl.newContext` blocks it for every scan too); `consent()` loads the home page with no choice, after Reject and after Accept (then a few more pages); `clickIds()` tests that redirects keep gclid and UTM tags; `analyze()` turns it into issues.
- `lib/handoff-doc.js`: the handoff document's HTML (the site, accounts from `p.accounts`, what's installed from the latest live launch check, redirects, renewals), made into a PDF like the status page. Accounts are set with `setAccounts()` in `lib/projects.js`.
- `lib/traffic.js`: reads CSV exports from Search Console, GA4 and Google Ads (`parse`). Imports live in `projects/<id>/traffic.json`; `clicksByPath()` feeds the redirect map's Clicks column.
- Care plans: `careTick()` in `lib/projects.js` runs one launch check a month for each repeating project with a live site (from server.js's half-hourly watch). `upCheck()` loads each launched site's home page hourly (`projects/<id>/uptime.json`). `lib/care-report.js` renders the month's report from those, the checklist (snapshotted per month in `nextCycle`), the time log and traffic imports.
- `lib/renewals.js`: SSL expiry from the site's certificate and domain expiry from RDAP (rdap.org, with Groundwork's own user agent). `renewalsDue()` and `checkRenewals()` in `lib/projects.js`, run hourly by server.js for projects not checked in the last 20 hours.
- Money: `moneyOf()` (paid, waiting, ready to invoice), extra requests (`setExtra()`, time entries carry `extraId`, invoices of kind `extra`), a deposit as the payment keyed `deposit`, and `invoiceRows()` for `/api/invoices.csv`, all in `lib/projects.js`. The Money tab is `web/src/components/project/Money.tsx`.
- Files from the client: `lib/requests.js` lists a folder's file names (`list`) and ticks requests whose match words fit one (`match`). `setRequests()`, `scanRequests()` and `requestsTick()` in `lib/projects.js` keep them in `p.requests`; server.js looks every two minutes and opens the folder picker. Checklist items with `tool: 'requests'` and `check: 'brand'` or `'content'` tick when their kind is all in. The section is `web/src/components/project/Files.tsx`.
- `lib/google.js`: Search Console and GA4 with the user's own Desktop app OAuth client. Sign-in is loopback OAuth with PKCE to `/oauth/google` on the app's own port; the refresh token goes in the macOS Keychain through `/usr/bin/security` (a file in a dev copy). Pulls are saved like CSV imports (`addTraffic()` in `lib/projects.js`, with `via: 'google'`, `kind`, `from` and `to`); `googleDue()` and server.js's hourly tick make the automatic ones. To test without a Google account, run a dev copy with `GW_DEV_DATA` and `GW_GOOGLE_FAKE=<a local stand-in>`; the stand-in is ignored otherwise.
- A project's tabs: Overview (`web/src/components/project/Overview.tsx`, with `standLine()`, the one sentence on where things stand), Checklist and Client (in `ProjectPage.tsx`), Site (`SiteTab.tsx`: problems first from the site's latest launch check, a timeline of its scans and checks, and "Moving from the old site" on redesigns) and Money. `#/project/<id>/tools` links still open the Site tab.
- Launch day: `launched(p)` in `lib/projects.js` is `!!p.launched`, set by `markLaunched()` (which keeps the planned date in `launchPlanned` and sets `launch` to the real day). `lookLive()` reads the live home page's HTML and runs `lib/stack.js` on it to compare platforms. A one-time migration (`data/migrations.json`) marked projects whose date had already passed before v0.25 as launched `by: 'date'`. `p.closed` takes a project out of Today, the calendar and every automatic check.
- First run: `web/src/components/shell/FirstRun.tsx`, shown on Today while there are no projects. It saves `who`, `services` and `weeklyUpdates: false` in prefs; `web/src/lib/services.ts` maps each service to the checklists that come first in the New project picker. `home({ updates })` leaves out weekly-update reminders when that pref is off (missing means on, for people from before).
- `lib/plain.js`: error messages in plain words (`plain()`), used by scans, AI runs, launch checks, redirect jobs and any request that fails. `lib/check-report.js`: a site check's verdict and the problems worst first (`verdict()`), as the client PDF at `/api/projects/<id>/check-report?format=pdf`. Private feedback goes to `feedbackEmail` in package.json when it's set; until then the dialog copies the text to send.
- Sidebar (`web/src/components/shell/AppShell.tsx`): the workspace row, Favorites from `prefs.favorites`, folded sections remembered in local storage (`sidebarFolded`), and a ⋯ menu per project. Help in the corner is `HelpButton.tsx`.
- Items you add (`addItem()`, `renameItem()`, `removeItem()` in `lib/projects.js`) carry `custom: true`; the template diff skips them. The Projects page is `web/src/pages/ProjectsPage.tsx` (`#/projects`, `#/projects/board`), built from the project summaries.
- Project colours are `p.color`, one of `COLORS` in `lib/projects.js` (new projects take the least used; `migrateColors()` fills in older ones). The web side draws them from the `--p-<colour>` and `--p-<colour>-tint` tokens in `web/src/index.css`, through `SiteIcon`, `Favicon` and `Cover` in `components/common/bits.tsx`; the menu is `components/common/ProjectColor.tsx`.
- `lib/connectors.js`: reads `claude mcp list` (run only when asked, from `/api/connectors/check`) to see which of Google's and Meta's official connectors Claude Code has. The setup steps are `web/src/components/settings/Connectors.tsx`, and the per-project questions `web/src/components/project/AskClaude.tsx`.
- `lib/stack.js`: what a site runs on, from the script, frame and stylesheet addresses and generator tags the launch check reads on each page (`detect`), and the DNS host from its name servers (`dnsHost`). `rows()` lays it out for the handoff document and the care report.
- `lib/invoice.js`: reads amounts typed by hand (`parseMoney`), and renders an invoice as HTML for the PDF. Drafts, saving and paid live in `lib/projects.js` (`invoiceDraft`, `saveInvoice`); hours on an invoice are marked in the time log (`markInvoiced`) so they aren't billed twice.
- `lib/templates-gallery.js`: the gallery checklists (websites, and other client work with `website: false`), written from the public guidance they credit in `basedOn`. `lib/templates-default.js`: the full agency checklist and the messages. Bump `SEED` when a built-in checklist changes, so untouched copies update; new built-ins arrive once (`data/templates-seen.json`).
- `shared/platforms.json`: each platform's staging addresses and redirect formats, read by `lib/platforms.js` (server) and `web/src/lib/platforms.ts` (the app, which also writes the redirect files).
- `lib/engines.js`: Claude Code and Codex detection, models, efforts and the runner.
- `lib/status-page.js`: the client status page's HTML. server.js turns it into a PDF with the app's own Chromium (`printToPDF`), or with the scan browser when running from source.
- Feedback: `/api/diagnostics` builds the app details for a report (versions, macOS, browser, AI tools without the account, counts, recent errors from `friendly()` and main.log, emails redacted). The app only sends it where the person chooses.
- `lib/assist.js`: short AI jobs outside the plans (a project from a brief, a message rewritten in your voice). Each runs in an empty temp folder with only its text in the prompt, and the brief has a plain, no-AI reader for addresses and dates.
- `lib/crawl.js`: browser scans, screenshots and live checks. On a Mac, Chrome is started with `open` so macOS attributes it to Chrome, not Groundwork.
- `lib/headings.js`, `lib/seo.js`, `lib/skills.js`: the AI plans and their skills.
- `shared/checks.mjs`, `shared/seo.mjs`: checks used by both the server and the app.
- `web/`: the app's interface. React, Vite, Tailwind v4, shadcn/ui on Base UI, Lucide icons and the Geist font. Neutral palette with one orange accent (`web/src/index.css`), no gradients.

## Notarizing the Mac app

The app is ad-hoc signed today, so macOS asks people to allow it in Privacy & Security the first time. Signing it with a Developer ID and notarizing it removes that step. It needs an Apple Developer account ($99 a year). Then:

1. Create a "Developer ID Application" certificate, export it as a .p12 with a password, and add it to the repository's Actions secrets as `CSC_LINK` (base64 of the file) and `CSC_KEY_PASSWORD`.
2. Create an app-specific password for the Apple ID, and add `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD` and `APPLE_TEAM_ID` as secrets.
3. In `package.json`, under `build.mac`, set `identity` to the certificate's name, add `"hardenedRuntime": true` and `"notarize": true`, and add an entitlements file that allows JIT (`com.apple.security.cs.allow-jit`) and unsigned executable memory, which Electron needs.
4. In the release workflow, pass the five secrets to the electron-builder step and remove `CSC_IDENTITY_AUTO_DISCOVERY: "false"`. Drop the ad-hoc signing in `desktop/after-sign.js`.
5. Bump `gwShell`, because this changes the app itself, not only its code.

## Writing style

The interface and docs use plain, short sentences. No em dashes, and font weights 400 and 500 only.

## Not yet

- Keyword data (for example from Ahrefs) isn't connected, so keywords are marked unverified and have no volumes. To add it: drop `--strict-mcp-config` for Claude runs, which loads the user's connectors, and remove the "Keyword data" paragraph in `planPrompt()`.
- Codex runs are built from Codex's documented CLI and have had far less testing than Claude Code.
