---
name: h-tag-planner
description: Plans the H1–H6 heading structure for every main page of a website and publishes it as a click-through HTML guide the developer can follow page by page. Use when asked to "do the H tags", "set the H tags", "establish H tags", "heading audit", "H tag structure", "fix the headings", "one H1 per page", "optimize the H1s", or "optimize headings for SEO" for a site URL, including Webflow staging links (*.webflow.io). Produces a Live H-tag map (tags only, using the content already on the site) and/or an Optimization plan (keyword-driven heading rewrites), both backed by Ahrefs keyword research that gives every page its own keywords so pages never compete.
---

# H-Tag Planner

Two deliverables share one research base:

| Output | When | What changes | Who approves |
|---|---|---|---|
| **Live H-tag map** | Site is built; only the tags need fixing | Tag levels only (H1–H6, heading vs text). Wording stays exactly as on the site. Wording ideas are tagged "Suggestion · later". | Nobody. The developer applies it. |
| **Optimization plan** | Headings should also be rewritten for search | Heading text is rewritten, added or removed so each page targets its own keywords. | The client signs off on H1 changes (and on any copy change). |

Pipeline for both: map the site → extract every heading → define each page's purpose → Ahrefs keyword map (one owner per keyword) → heading plan → HTML guide → verify against the live pages.

Reference files (read when you reach that step):
- `references/heading-rules.md` — the rulebook, with sources. Read before planning headings.
- `references/keyword-mapping.md` — Ahrefs research and keyword-map method, with tool calls.
- `references/crawl-playbook.md` — browser scripts for nav, headings, sections and verification.
- `references/output-spec.md` — how to fill the HTML template for each mode.
- `assets/heading-map-template.html` — the guide's renderer. Replace only its DATA block.

## Step 0 — Ask first

Ask in a single AskUserQuestion call, skipping anything the request already answers:
1. **Output**: Live H-tag map, Optimization plan, or both. Always ask; never assume.
2. **Market**: country for search volumes (suggest one from the domain: .ca → Canada; otherwise United States).
3. **Live domain**: if the URL is a staging or rebuild URL, the production domain that already ranks (so existing rankings can be pulled), or "not live yet".
4. **Who applies it**: the name shown in the guide (the person who makes the changes).

Check the tools before crawling: an Ahrefs connector, a browser (Claude in Chrome or the built-in browser), and ideally the Artifact tool. If Ahrefs is missing, say so and ask the user to connect it. Only continue without it if the user agrees, and then label every keyword "unverified" and show no volumes.

## Step 1 — Map the site

Follow `references/crawl-playbook.md`.
- Webflow staging blocks WebFetch (robots.txt). Do not work around it with curl, Python or other fetchers. Use the browser tools, which load the page as the user.
- Capture the header navigation as the user sees it (mega-menus often differ from the mobile or footer nav), the footer, and every internal link. The guide mirrors this navigation.
- Main pages = home + every page in the header and footer navigation + pages linked from the home page. Check legal pages briefly. Record 404s, links to "#", and nav items that point to the wrong page as site-wide notes.

## Step 2 — Extract every page's headings

Run the audit script from the crawl playbook on every main page. Capture, in DOM order:
- every H1–H6 (level, class, exact text, hidden or not);
- text styled like a heading but not tagged (heading classes, large or bold short text);
- section boundaries, tab and accordion membership, eyebrows, stats and bold lead-ins.

Take a screenshot wherever the visual hierarchy is unclear (for example a big centred title inside the same section as a card grid). Read each page's full text to understand what it is for.

## Step 3 — Keyword research and the keyword map (both outputs)

Follow `references/keyword-mapping.md`. In short:
1. Write each page's purpose in one sentence and name its search intent.
2. Build seed keywords per page from its H1, URL, nav label, body copy and competitor pages.
3. Pull metrics from Ahrefs in the chosen country: volume, difficulty, traffic potential, parent topic and intent. If a production domain exists, pull its current rankings and flag keywords where two URLs rank.
4. Cluster by parent topic and SERP overlap. Assign each cluster to exactly one page. Give every page one primary keyword and 2–5 secondary keywords.
5. Keep sibling pages apart: industry and location pages carry a modifier ("cleaning for clinics"), so they never own the main service page's term.

Every number in the output must come from an Ahrefs call made in this run, labelled with the country. Never estimate volumes.

## Step 4 — Plan the headings

Read `references/heading-rules.md` first, then apply it page by page.

**Live H-tag map** (content stays as is):
- Actions allowed: keep, retag, tag (make heading), none (not a heading). Never change wording.
- Exactly one H1 per page: the page's main visible title, using its current text.
- If the H1 lacks the page's primary keyword, add the better wording as the H1 suggestion (`h1.proposed`, status "client" or "optional"). It shows as "Suggestion · later".
- Other wording, copy, duplicate or broken-link issues go in the page's notes as suggestions.

**Optimization plan** (content can change):
- Actions allowed: all of the above plus rewrite, add and remove.
- H1: contains the primary keyword naturally, reads like the brand, is 70 characters or fewer, and is unique across the site. Every H1 change needs client sign-off.
- H2/H3: put secondary keywords where they name the section truthfully. Use question headings where the section answers a real query found in Ahrefs (question keywords, People Also Ask). Add a heading only where the page covers the topic or should, and note the copy it needs.
- Never let two pages target the same primary keyword, in the H1 or in an H2.
- Keep the brand's voice. Each rewrite gets a short reason naming the keyword it serves.

## Step 5 — Build and publish the guide

Follow `references/output-spec.md`.
- Copy `assets/heading-map-template.html` and replace only the block between `DATA START` and `DATA END`. Set `SITE.mode` to "live" or "optimize". Build one file per requested output.
- Titles: "<Site> H-Tag Map" (live) and "<Site> Heading Plan" (optimize).
- Look once: render one screenshot, fix what it shows, then publish with the Artifact tool (icon "list"). Artifacts start private: tell the user to share the page from its Share menu with whoever applies it.
- If the Artifact tool is not available, wrap the file in a full HTML document (doctype, head, body) and deliver the .html file instead.

## Step 6 — Verify before handing over

- Re-fetch every page. Confirm the current headings recorded in the data match the site exactly and in order (verification script in the crawl playbook).
- Confirm every element marked "tag" exists on the page as non-heading text with that exact wording.
- Open the guide's Overview and confirm its automatic checks all pass: one H1 per page, no skipped levels, no duplicate H1s, every primary keyword owned by one page.

## Final message

Keep it short. Name each guide produced and give its headline counts: pages, retags, new headings, and rewrites for the Optimization plan. Say how many H1 changes need client sign-off and name the biggest site-wide issue. Remind the user to share each guide with whoever applies it. Include a Sources line for the Ahrefs data (country and date).
