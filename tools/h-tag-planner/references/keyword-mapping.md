# Keyword research and the keyword map

Goal: give every main page a clear job and its own keywords, so the headings reinforce that job and no two pages compete for the same search. Both outputs use the map. The Live H-tag map uses it to flag weak H1s and headings that compete. The Optimization plan rewrites headings around it.

## Ground rules

- **Every number comes from Ahrefs, pulled in this run**, for the chosen country. Label volumes as "/mo, <country>, Ahrefs, <month year>". Never estimate or recall volumes.
- **Call the Ahrefs `doc` tool before the first use of each Ahrefs tool** (the server requires it). Request only the columns you need, because every row costs API units.
- **Batch.** `keywords-explorer-overview` takes a comma-separated list. Send 20–40 keywords per call instead of one call per keyword.
- **Low volumes are normal for B2B and local sites.** Choose by intent fit first and volume second. A 40/mo term that matches the page beats a 700/mo consumer term that doesn't (for example "house cleaning" for a commercial cleaning company).
- **When an Ahrefs response says to render its results** (`render_with` or "Display these results with …"), call that render tool before summarising the data.

## Step 1 — Page purpose and intent

For each main page write one line:
- **Purpose**: what the page sells or explains, and to whom. Example: "Sells recurring office cleaning to workplaces in the United States."
- **Intent**: commercial (service or product), informational (guide, FAQ), navigational (brand, contact) or local.
- **Page type**: home, service, product, industry or audience, location, about, contact, blog or legal.

The home page usually owns the brand plus the broadest category term. Service pages own their service term. Industry and location pages own "service + modifier" terms. About, contact and legal pages own brand or navigational terms only; don't spend research on them beyond that.

## Step 2 — Seed keywords per page

Collect 5–15 seeds per commercial page from:
- the page's current H1, URL slug, nav label and main H2s;
- the services, products and industries named in its copy;
- the market's wording (for example "pop" vs "soda", "washroom" vs "restroom"), plus the city or country for local businesses;
- competitor pages found in Step 4.

## Step 3 — Metrics (Ahrefs)

**`keywords-explorer-overview`**
- `country`: two-letter code, lowercase works ("ca", "us").
- `keywords`: comma-separated seeds.
- `select`: `keyword,volume,difficulty,traffic_potential,parent_topic,intents`.

Keep the keyword, volume, KD, traffic potential, parent topic and intent flags. A keyword whose parent topic is unrelated to the business (for example "smart store" → "bell store") is ambiguous. Avoid it as a primary keyword.

**Expanding the list** (after reading each tool's `doc`):
- `keywords-explorer-matching-terms`: phrase variants and **question** keywords for H2/H3 ideas.
- `keywords-explorer-related-terms`: terms the top pages also rank for (secondary keyword candidates).
- `keywords-explorer-search-suggestions`: autocomplete-style variants.

## Step 4 — What already ranks, and who competes

**If the site, or the site it replaces, is live:**
- `site-explorer-organic-keywords` with `target` = the domain, `mode` = "subdomains", `country`, `date` = today (YYYY-MM-DD), and `select` = `keyword,volume,best_position,best_position_url,sum_traffic,serp_target_positions_count`. Sort by `sum_traffic:desc`.
  - This shows which URL currently ranks for what. Keep a page's existing winning keywords on the page that already ranks.
  - **Cannibalization check**: repeat with `where` = `{"field":"serp_target_positions_count","is":["gte",2]}`. These keywords have two or more of the site's URLs ranking. For each one, decide which page should own it and flag the other.
- `site-explorer-top-pages` gives each URL's top keyword and traffic.
- `site-explorer-organic-competitors` finds real search competitors.
- If an Ahrefs project with Google Search Console exists (`management-projects`), prefer `gsc-keywords` / `gsc-pages` for actual queries per page.

**If the site is not live yet:** find competitors with `serp-overview` on 2–3 main service terms.

**`serp-overview`**
- `keyword`, `country`, `top_positions` = 10.
- `select`: `position,url,title,type,top_keyword,traffic`.

Use it for three things:
- **Intent**: are the results service pages, directories, guides or product listings? Target the page type Google rewards for that term.
- **H1 inspiration**: read the top titles to see how winners phrase the topic.
- **SERP overlap** (Step 5).

## Step 5 — Cluster, then assign one owner per cluster

1. **Group by parent topic.** Keywords with the same Ahrefs parent topic can usually share one page.
2. **Check doubtful pairs with SERP overlap.** Pull `serp-overview` for both keywords and count shared URLs in the organic top 10:
   - 4 or more shared → same intent → same page.
   - 2 or fewer shared → different pages.
   - 3 shared → decide by intent and page type.
   (This threshold is an in-house rule of thumb, not an Ahrefs figure.)
3. **Assign each cluster to exactly one page**, the one whose purpose and page type match the intent. That page owns the cluster's **primary keyword**: the term with the best mix of intent fit, traffic potential and relevance. The rest of the cluster becomes that page's **secondary keywords** (2–5).
4. **Separate siblings with modifiers.** Industry, audience and location pages own "service + modifier" terms ("cleaning services for schools", "office cleaning service Chicago"). The bare service term stays on the service page.
5. **Clusters with no good page** go in the guide's content-gaps list as "possible new page or section", but only when there is real volume and intent fit.
6. **Pages with no search demand** (about, contact, legal, thank-you pages) get brand or navigational keywords only. Mark them "brand page".

## Step 6 — Validate the map

The template runs these checks automatically on the Keyword map view. Make sure they pass before publishing:
- No primary keyword is owned by two pages.
- No two pages share an H1.
- Each commercial page has a primary keyword with an Ahrefs volume (0 is allowed; missing data is not).
- Live H-tag map: flag every H1 that doesn't contain its page's primary keyword (or a close variant). Each flag becomes a Suggestion on that page.
- Optimization plan: the proposed H1 contains the primary keyword or a close variant. Secondary keywords appear in at most one H2/H3 each, and never as another page's primary.

## Step 7 — Record it in the template

Per page, set:
- `purpose`: the one-line purpose.
- `keywords.primary`: [keyword, volume].
- `keywords.secondary`: [[keyword, volume], …].
- `keywords.note` (optional): why this page owns them, or what it must not target.

Site level:
- `GAPS`: [{cluster, volume, note}] for unowned clusters worth a page or section.
- `SITE.kwSource`: "Ahrefs Keywords Explorer, <Country>, <Month YYYY>".
