# Groundwork

A Mac app for agencies and freelancers who build websites. Every project follows a checklist from kickoff to launch, and Groundwork's tools check the work for you: a launch check, a redirect map for redesigns, and optional AI plans for headings and SEO.

It works with sites built on Webflow, WordPress, Shopify, Framer, Squarespace, Wix or custom code.

## What it does

- **Checklists for the common jobs.** Website redesign, new website, online store, landing page or campaign, SEO site migration, accessibility pass and a monthly care plan. Each is written from public guidance (Google Search Central, W3C, Shopify, WordPress) and says which, and every item says what "done" means.
- **Projects.** A project copies a checklist into phases, with due dates stretched to fit between its two dates. Each item is yours or the client's. Each phase ends with a sign-off, and you keep the client's approval (an email, a screenshot or a link) with the project.
- **Client tab.** Everything the client owes you in one list: late, due soon and not asked yet. Tick the items you need and Groundwork writes the message from a template, ready to paste into email or Slack. It never sends anything itself.
- **Messages to send.** Home lists what to send today across every project: requests, reminders on a schedule you pick per project, a weekly update written from the checklist (done, up next, waiting on you), invoices once a phase is signed off, and payment reminders two weeks after invoicing.
- **Payments.** Add the payment that falls due with each sign-off, then mark it invoiced and paid.
- **Reminders and calendar.** An optional Mac notification each morning with what's due, and a calendar feed of launches, sign-offs and due dates to subscribe to in Calendar.
- **Launch check.** Reads up to 60 pages of the staging or live site and every link on them: noindex and robots.txt, placeholder text and dummy "#" links, broken links, titles and descriptions, H1s, canonicals, legal pages, https and www redirects. Each issue comes with a one-line fix, and items it passes tick themselves on the checklist.
- **Accessibility and speed.** The launch check also runs axe (the engine Lighthouse uses) against WCAG 2.2 A and AA on every page, and a speed test of three key pages set up like Lighthouse's mobile test, against Google's Core Web Vitals targets. Both run on your Mac.
- **After launch.** While the app is open, Groundwork checks the live site again 3, 7 and 30 days after launch, with the redirect test when there's a map, and Home lists anything new it finds.
- **Redirect map.** For redesigns: matches every URL on the old site to its page on the new one, exports the 301 redirects in your platform's format (Webflow, Shopify, WordPress, Squarespace, Framer, Wix, Netlify, Vercel, Apache or nginx), and tests them after launch. Paste a list of old URLs from Search Console or analytics to see where each one ends up, and compare the old site's titles, descriptions and H1s with the new site's.
- **Content inventory.** Every page on the old site with a keep, rewrite, merge or remove call, suggested by rules (or by AI, optionally) and decided by you. Merged pages can go straight into the redirect map.
- **Same-domain redesigns.** When the new site launches on the old site's address, checks and tests of that address before launch day count as the old site and never tick anything.
- **Heading plan and SEO plan** (optional, use AI). A plan for each page's H1 to H6, and a title, meta description and URL for each page, turned into a to-do list a developer can tick off.
- **Audits.** Scan one site and run the tools on it without a checklist. Start a project for it later and the scans move in.

## What it costs

- The app is free.
- Checklists, scans, the launch check (with its accessibility and speed tests), the redirect map and the content inventory don't use AI and cost nothing to run.
- The heading plan and the SEO plan, and a few small optional helpers (filling in a new project from a brief, rewriting a client message in your voice, and suggesting the content inventory's calls), run through **Claude Code** or **Codex**, signed in to your own paid Claude or ChatGPT subscription. They count toward that subscription's usage limits. Groundwork shows the time and the expected usage before every plan. If you sign in with an API key instead, the provider bills per token.
- You don't need AI to use Groundwork. Skip the engine setup and everything else works.

## Your data

- Everything is saved on your Mac, in `~/Library/Application Support/Groundwork/data` (Settings, Data and privacy, Show in Finder). There's no Groundwork account and no Groundwork server.
- The heading plan and the SEO plan send the pages you chose from a scan (their public text, headings, current titles and descriptions, and a screenshot when a layout is unclear), your notes and the rules the plan follows, to Anthropic (Claude Code) or OpenAI (Codex) through your own account. That provider's privacy terms apply.
- The optional helpers send only the text they work on: the brief you paste in, the message being rewritten, or the old site's page list (addresses, titles, H1s, word counts and each page's first lines) for the inventory. They run in an empty folder. Without AI, a pasted brief is read on your Mac for web addresses and dates only.
- The AI plans run in that scan's folder only. Claude Code is confined to it, so it can't open your projects, client details, messages, sign-off files or other scans. Codex (Beta) is pointed at the folder but not confined to it.
- Scans and checks run in a browser on your Mac and only visit the addresses you give them.
- Groundwork connects to GitHub to check for updates.
- **Back up now** (Settings, Data and privacy) saves everything as one zip in Documents, Groundwork Backups. **Export project** (the project's ⋯ menu) saves one project with its scans, and **Import a project file** (New project) brings it into Groundwork on another Mac.

## Install (Mac)

You need **Google Chrome** (or Microsoft Edge) for scans. For the AI plans, you also need Claude Code or Codex; the app walks you through installing and signing in to either one in Settings.

Open **Terminal** (Applications, Utilities), paste this and press Return:

```bash
curl -fsSL https://raw.githubusercontent.com/asheemstha/groundwork/main/install.sh | bash
```

It downloads the latest version into Applications and opens it. [install.sh](install.sh) is short if you want to read it first.

**Or download the .dmg** from the [latest release](https://github.com/asheemstha/groundwork/releases/latest) and drag **Groundwork** into **Applications**. The app isn't signed with an Apple developer certificate yet, so the first time you open it macOS says it can't check it for malicious software. Click **Done**, go to **System Settings, Privacy & Security**, and click **Open Anyway** next to Groundwork. You only do this once.

## Getting started

1. **New project** (⌘N). Pick what you're starting, then add the client's name, up to three websites (the old site being replaced, the new site on staging, the live domain) and the dates, or paste the brief and let Groundwork fill them in. If the project is already underway, start it at a later phase. Not ready for a real project? **Explore a sample project** on the Home page.
2. **Checklist.** Work through the current phase. Click an item to open it on the side, with notes, a link and its history. J and K step through items.
3. **Client.** Tick what you need from the client and copy the message. Groundwork records when you asked, picks a reminder once everything ticked was asked before, and shows what's late. Switch to **Weekly update** for a status email written from the checklist. Home lists the messages to send today, then what's late and due this week, for every project.
4. **Tools.** Scan the old site at the start of a redesign and make the content inventory, build the redirect map once staging has pages, and run the launch check before launch day and again on the live domain. After launch, Groundwork re-checks the live site on its own.
5. **AI plans** (optional). Sign in to Claude Code or Codex in Settings, then plan headings or SEO from any scan in the Tools tab.

Templates holds your checklists, client messages and emails. Change any of them, duplicate them, or make your own; a template can mark an item as only for one platform.

## Updates

Groundwork checks for a new version when it opens and every few hours. When there is one, the sidebar shows **Update available**. Most updates download a few MB and restart the app; your data isn't touched.

## Status

- Groundwork is in active use at one agency and new to everyone else. Expect rough edges, and please open an issue when something's wrong.
- **Codex support is in beta.** The app is built and tested on Claude Code; Codex works but has had much less use.
- The app isn't signed or notarized by Apple yet (see Install).
- **Sites behind Cloudflare's bot protection** can turn scans and launch checks away. Groundwork doesn't try to get around it: it names itself ("Groundwork" in its user agent), and the app shows how to allow it in Cloudflare. Staging addresses usually aren't affected.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for running from source, how the pieces fit together, and publishing updates.
