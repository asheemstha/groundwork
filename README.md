# Groundwork

A Mac app for agencies and freelancers who build websites. Every project follows a checklist from kickoff to launch, and Groundwork's tools check the work for you: a launch check, a redirect map for redesigns, and optional AI plans for headings and SEO.

It was made for Webflow projects, but the checklist and the checks work for any website.

## What it does

- **Projects.** A project copies a checklist template into phases (Discover, Design, Build, Launch, After launch), with due dates spread between your kickoff and launch dates. Each item is yours or the client's. Each phase ends with a sign-off, and you keep the client's approval (an email, a screenshot or a link) with the project.
- **Client tab.** Everything the client owes you in one list: late, due soon and not asked yet. Tick the items you need and Groundwork writes the message from a template, ready to paste into email or Slack. It never sends anything itself.
- **Launch check.** Reads up to 60 pages of the staging or live site and every link on them: noindex and robots.txt, placeholder text and dummy "#" links, broken links, titles and descriptions, H1s, canonicals, legal pages, https and www redirects. Each issue comes with a one-line fix, and items it passes tick themselves on the checklist.
- **Redirect map.** For redesigns: matches every URL on the old site to its page on the new one, exports the 301 redirects for Webflow, and tests them after launch.
- **Same-domain redesigns.** When the new site launches on the old site's address, checks and tests of that address before launch day count as the old site and never tick anything.
- **Heading plan and SEO plan** (optional, use AI). A plan for each page's H1 to H6, and a title, meta description and URL for each page, turned into a to-do list a developer can tick off.
- **Audits.** Scan one site and run the tools on it without a checklist. Start a project for it later and the scans move in.

## What it costs

- The app is free.
- Checklists, scans, the launch check and the redirect map don't use AI and cost nothing to run.
- The heading plan and the SEO plan run through **Claude Code** or **Codex**, signed in to your own paid Claude or ChatGPT subscription. They count toward that subscription's usage limits. Groundwork shows the time and the expected usage before every run. If you sign in with an API key instead, the provider bills per token.
- You don't need AI to use Groundwork. Skip the engine setup and everything else works.

## Your data

- Everything is saved on your Mac, in `~/Library/Application Support/Groundwork/data` (Settings, Data and privacy, Show in Finder). There's no Groundwork account and no Groundwork server.
- Only the heading plan and the SEO plan send anything to an AI provider. They send the pages you chose from a scan (their public text, headings, current titles and descriptions, and a screenshot when a layout is unclear), your notes and the rules the plan follows, to Anthropic (Claude Code) or OpenAI (Codex) through your own account. That provider's privacy terms apply.
- The AI runs in that scan's folder only. Claude Code is confined to it, so it can't open your projects, client details, messages, sign-off files or other scans. Codex (Beta) is pointed at the folder but not confined to it.
- Scans and checks run in a browser on your Mac and only visit the addresses you give them.
- Groundwork connects to GitHub to check for updates.

## Install (Mac)

You need **Google Chrome** (or Microsoft Edge) for scans. For the AI plans, you also need Claude Code or Codex; the app walks you through installing and signing in to either one in Settings.

Open **Terminal** (Applications, Utilities), paste this and press Return:

```bash
curl -fsSL https://raw.githubusercontent.com/asheemstha/groundwork/main/install.sh | bash
```

It downloads the latest version into Applications and opens it. [install.sh](install.sh) is short if you want to read it first.

**Or download the .dmg** from the [latest release](https://github.com/asheemstha/groundwork/releases/latest) and drag **Groundwork** into **Applications**. The app isn't signed with an Apple developer certificate yet, so the first time you open it macOS says it can't check it for malicious software. Click **Done**, go to **System Settings, Privacy & Security**, and click **Open Anyway** next to Groundwork. You only do this once.

## Getting started

1. **New project** (⌘N). Add the client's name and up to three websites: the old site being replaced, the new site on staging, and the live domain it launches on. Pick a template and the dates. If the project is already underway, start it at a later phase.
2. **Checklist.** Work through the current phase. Click an item to open it on the side, with notes, a link and its history. J and K step through items.
3. **Client.** Tick what you need from the client and copy the message. Groundwork records when you asked, picks a reminder once everything ticked was asked before, and shows what's late. Home lists what's late, due this week and time to ask, for every project.
4. **Tools.** Scan the old site at the start of a redesign, build the redirect map once staging has pages, and run the launch check before launch day and again on the live domain.
5. **AI plans** (optional). Sign in to Claude Code or Codex in Settings, then plan headings or SEO from any scan in the Tools tab.

Templates holds your checklists, client messages and emails. The built-in **Website project** checklist has about 50 items, each with a line on what done means; **Full agency process** is a longer one with about 140. Change either, or make your own.

## Updates

Groundwork checks for a new version when it opens and every few hours. When there is one, the sidebar shows **Update available**. Most updates download a few MB and restart the app; your data isn't touched.

## Status

- Groundwork is in active use at one agency and new to everyone else. Expect rough edges, and please open an issue when something's wrong.
- **Codex support is in beta.** The app is built and tested on Claude Code; Codex works but has had much less use.
- The app isn't signed or notarized by Apple yet (see Install).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for running from source, how the pieces fit together, and publishing updates.
