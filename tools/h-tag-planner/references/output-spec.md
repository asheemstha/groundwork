# Output spec: filling the HTML template

`assets/heading-map-template.html` is a complete, tested page. Copy it, then replace **only** the code between `DATA START` and `DATA END`. Don't edit the CSS or the renderer. It already handles both modes, the navigation, the keyword map, the automatic checks and the copy buttons.

Build one file per requested output:
- Live H-tag map → `SITE.mode = "live"`. Change the `<title>` on line 1 to "<Site> H-Tag Map".
- Optimization plan → `SITE.mode = "optimize"`. Change the `<title>` to "<Site> Heading Plan".

Both files share the same `keywords`, `purpose`, `NAV` and crawl facts. Only `rows`, `h1` and `notes` differ.

## SITE

```js
const SITE = {
  name: "Example Co",                      // client or brand name
  url: "https://example-co.webflow.io",    // the site that was crawled (links in the guide open here)
  liveDomain: "example.com",               // production domain used for rankings, or ""
  platform: "Webflow",                     // Webflow | WordPress | Shopify | Wix | Other (picks the how-to steps)
  mode: "live",                            // "live" or "optimize"
  checked: "28 September 2026",            // date of the crawl
  market: "United States",
  kwSource: "Ahrefs Keywords Explorer, United States, September 2026",
  appliedBy: "Alex",
  sharedHeadings: ["Ready for a cleaner workplace?", "Trusted By Leading Teams"]
};
```

`sharedHeadings` lists H2s that repeat across pages on purpose (footer CTA, logo band, shared card grids). The cross-page duplicate check ignores them.

## NAV (mirror the site's own navigation)

```js
const NAV = [
  {label:"Site navigation", items:[
    {id:"home"},
    {group:"Services", items:["office-cleaning","floor-care"]},      // dropdown → group
    {id:"about"},                                                     // top-level link
    {group:"Contact Us", items:["contact"]}
  ]}
];
```

Every `id` must exist in `PAGES`. Use the site's labels and order. The guide adds Overview, Keyword map and Later automatically.

## PAGES

```js
{ id:"office-cleaning", name:"Office Cleaning", path:"/services/office-cleaning", group:"Services",
  purpose:"Sells recurring office cleaning to workplaces in the United States.",
  keywords:{ primary:["office cleaning services",500], secondary:[["janitorial services",150],["office deep cleaning",150]], note:"" },
  h1:{ cur:"Clean, re-engineered", status:"client", proposed:"Office cleaning, re-engineered", why:"…" },
  rows:[ … ],
  notes:[ "…" ] }
```

- `keywords.primary` is `[keyword, monthly volume]`, using Ahrefs numbers only. Brand, contact and legal pages can omit `keywords` (they show as "Brand page").
- `h1.cur` is the exact current H1 text.
- Live mode: `h1.proposed` is the suggested wording (shown as "Suggestion · later"). Set it only when the H1 misses the primary keyword or doesn't say what the page is. `status` is "client" (recommended), "optional" or "keep". Put the reason and volumes in `why`.
- Optimize mode: the H1 row in `rows` is the source of truth. The template derives `h1.proposed` from that row's `to` text. Still fill `why`.

### rows: every heading and heading-like element, in page order

Helpers: `S("Section name")` starts a group. `R(cur, text, rec, act, note, to)` adds a row. `keepH("H3", [...])` adds several rows that keep their H3 tag.

| act | Mode | cur | rec | text / to | Meaning |
|---|---|---|---|---|---|
| keep | both | H1–H6 | same | text | Already right |
| retag | both | H1–H6 | new level, or "—" for text | text | Wrong level. Use rec "—" to turn a heading into text. |
| tag | both | div/p/span/strong | H1–H6 | text | Text that should be a heading. The note says which class to keep. |
| none | both | div/p/span/a/strong | "—" | description | Looks heading-ish but isn't (eyebrow, stat, tab label, checklist). Listed so nobody tags it. |
| rewrite | optimize | H1–H6 or div/p | H1–H6 (can differ from cur) | text = old, to = new | New wording, optionally a new level too |
| add | optimize | "—" | H1–H6 | text "", to = new heading | A heading that doesn't exist yet. The note says where it goes and what copy it needs. |
| remove | optimize | H1–H6 | "—" | text | Heading becomes text or is deleted. The note says which. |

Rules:
- **Record `text` exactly as on the site**, including punctuation and casing. The verification script compares it character for character.
- **Include every current H1–H6 on the page, including any in the nav or footer**, so verification matches. Put nav or footer headings under `S("Site header (shared)")` or `S("Footer (shared)")`, usually with `retag` to "—".
- Group rows with `S()` by visible section. Name sections the way someone scrolling the page would ("Hero", "FAQ (#faqs)", "Benefits block").
- Notes are short and actionable. For tag rows, say "Swap for a Heading element set to H3 with class d4". For rewrites, name the keyword served.
- **Live mode never uses rewrite, add or remove.** Wording ideas go in `notes` or `h1.proposed`.

### notes
Plain strings.
- Live mode: they show as "Suggestion · later": copy fixes, duplicates, broken links, casing, optional heading wording, content gaps.
- Optimize mode: they show as "Idea": content changes beyond the headings.

## SITEWIDE and GAPS

```js
const SITEWIDE = [
  ["keep", "Every page has exactly one H1. Nav and footer carry no headings."],      // shown as Good
  ["retag", "The Benefits block on all four solution pages is one level too deep."], // shown as Re-tag
  ["content", "SEO titles are just page names and no page has a meta description."]  // shown as a suggestion
];
const GAPS = [ {cluster:"carpet cleaning", volume:400, note:"No page targets it. Could be a section on Floor Care."} ];
```

## Automatic checks (read them before publishing)

The Overview and each page show Pass/Fix checks:
- exactly one H1, the H1 is the first heading, no skipped levels going down, no duplicate headings on a page;
- every page has its own H1, every primary keyword has one owner page, no H2 repeats across pages outside `sharedHeadings`;
- the H1 contains the primary keyword (close variants match; plurals are ignored). This is a hard check in Optimize mode and informational in Live mode.

Fix the data (or the plan) until every check passes. The one exception is a Live-mode check that reflects the site as it is, where the fix is a suggestion.

## Look once, then publish

1. Render one screenshot of a busy page. With Playwright in the sandbox, wrap the file in `<!doctype html><html><head><meta charset="utf-8"></head><body>…</body></html>` first. Fix what it shows.
2. Publish with the Artifact tool: `file_path` = the filled template (no doctype of its own), `icon` = "list", plus a one-sentence `description`.
3. Tell the user the page is private and that they share it from the page's Share menu with whoever applies it.
4. **No Artifact tool** (for example in claude.ai chat): write a full HTML document (doctype, head with charset and viewport, body wrapping the template), save it as `<site>-h-tag-map.html` or `<site>-heading-plan.html`, and deliver the file. It opens in any browser.

## Verification list (Step 6)

Build `EXP` for the crawl playbook's verification script from the data. For each page, list every row whose `cur` is H1–H6 as `"Hn|text"`, in row order, keyed by `path`. Every page must report OK.
