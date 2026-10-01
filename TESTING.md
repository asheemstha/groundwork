# Trying Groundwork: a guide for testers

Thanks for trying Groundwork. It's a Mac app for the person who runs client website projects: a checklist from kickoff to 30 days after launch, the client chasing, sign-offs, and tools that check the real site (a launch check, a redirect map, accessibility and speed). Everything stays on your Mac.

What helps most is seeing where it gets in your way on a real project. You don't need to be polite about it.

## Install

Follow [Install (Mac)](README.md#install-mac) in the README. The app isn't signed by Apple yet, so the first time you open it, go to **System Settings, Privacy & Security** and click **Open Anyway**. You'll need Google Chrome (or Microsoft Edge) for scans. Claude Code or Codex is optional: only the heading plan, the SEO plan and a few small helpers use AI.

## Your first hour

1. **Explore the sample project** (5 minutes). On Today, click **Explore a sample project**. Tick a few items, open one, look at the Client tab. Delete it when you're done.
2. **Audit a site you know** (10 minutes). **New project**, then **Audit a site**. Scan it, then run the launch check from the Tools tab. Does what it finds match what you know about the site?
3. **Start a real project** (15 minutes). Pick the checklist that fits, paste the brief or your kickoff notes, and add the websites and dates. If it's a redesign, scan the old site.
4. **Ask the client for something** (5 minutes). In the Client tab, tick what you need, copy the message and send it the way you normally would.

## Your first two weeks

Run one real project in Groundwork from start to finish, or as far as it gets. Along the way, try:

- Today each morning: plan your tasks, start a timer on each, and send the messages it lists.
- The Time page at the end of the week: does it match what you'd have written in a timesheet? Export the CSV.
- The weekly update, or a client status page (the project's ⋯ menu) instead of writing one from scratch.
- Recording a sign-off with the client's approval.
- For a redesign: the content inventory, the redirect map and the redirect test.
- The launch check on staging before launch day, and on the live domain after.

## What to tell us

- **Where you got stuck or confused**, and what you expected to happen instead.
- **Anything ticked wrongly**: an item Groundwork ticked that wasn't really done, or one it didn't tick that was.
- **When you went back to another tool** (a spreadsheet, Slack, your notes app) and why.
- **Errors and crashes**. If a page crashes, click **Report it**.
- **What you'd pay for it**, if anything, and what would make it worth more.

To send it: **Settings, Help and feedback, Send feedback**. You can open it as a GitHub issue (public, needs a free GitHub account) or copy it into an email. It can add app details (versions, macOS, recent errors, never project data), and you see them before they're added.

## What stays private

Projects, client details, messages and files stay in Groundwork's data folder on your Mac. There's no account and no Groundwork server. The AI features send only what they work on, through your own Claude or ChatGPT account; Settings, Data and privacy lists exactly what. Feedback goes only where you send it.

## Known limits

- Mac only, and not signed by Apple yet.
- Codex support is in beta. The app is built and tested on Claude Code.
- Sites behind Cloudflare's bot protection can turn scans away. Scan the staging address instead, or allow Groundwork in Cloudflare (the app shows how).
- One person per copy. There's no sharing between people yet; that decision waits for what testers tell us.
