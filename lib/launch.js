// Launch check: reads a site the way Google and a visitor would, and reports what isn't ready to go live.
// No AI: it fetches robots.txt, the sitemap and the https/www redirects, opens up to MAX_PAGES pages in the
// headless browser, and tests every internal link. Each check id matches checklist items that the check ticks.
const crawl = require('./crawl');

const MAX_PAGES = 60;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Groundwork-LaunchCheck';

// These block automated requests, so their links can't be checked this way.
const SOCIAL = /(^|\.)(facebook|instagram|linkedin|twitter|x|tiktok|pinterest|youtube|threads)\.com$/i;

const CHECKS = {
  indexing: 'Google can index the site',
  placeholders: 'No placeholder text or dummy links',
  links: 'Links work',
  seo: 'Titles, descriptions, H1s, alt text, OG images, favicon',
  canonicals: 'Canonicals point to the live domain',
  legal: 'Legal pages linked',
  https: 'SSL and redirects',
};

// Which check an item belongs to, for items made before checks were named in the template.
function inferCheck(title) {
  const t = String(title || '').toLowerCase();
  if (/noindex|robots|index the site|staging password/.test(t)) return 'indexing';
  if (/placeholder|dummy|lorem/.test(t)) return 'placeholders';
  if (/canonical/.test(t)) return 'canonicals';
  if (/legal|privacy/.test(t)) return 'legal';
  if (/ssl|https|www/.test(t)) return 'https';
  if (/links and buttons|broken link|links work/.test(t)) return 'links';
  if (/title|meta description|alt text|og image|favicon|one h1/.test(t)) return 'seo';
  return null;
}

const PLACEHOLDER_TEXT = [
  [/lorem ipsum|dolor sit amet/i, 'Lorem ipsum text'],
  [/this is some text inside of a div block/i, 'Webflow’s default “This is some text inside of a div block”'],
  [/^(heading|text link|button text|enter your text here|your text here|add your text here)$/im, 'Default element text'],
  [/\b(TODO|XXX)\b/, 'A TODO note left in the copy'],
  [/\bTBD\b/, '“TBD” in the copy', true],
];
// A few words either side of a match, so it's clear where it is.
const around = (text, m) => {
  const a = Math.max(0, m.index - 40), b = Math.min(text.length, m.index + m[0].length + 40);
  return ((a ? '…' : '') + text.slice(a, b) + (b < text.length ? '…' : '')).replace(/\s+/g, ' ').trim();
};

// One line on how to fix each kind of issue, matched on the issue's text.
const FIXES = [
  [/robots\.txt blocks/, 'Remove “Disallow: /” from robots.txt (in Webflow: Site settings, SEO).'],
  [/asks for a password|password page/, 'Turn off the site password before launch.'],
  [/X-Robots-Tag/, 'The server adds it. Check the hosting or CDN settings.'],
  [/noindex tag/, 'Remove the noindex tag from the page’s settings or custom code.'],
  [/Lorem ipsum|Default element text|div block/, 'Replace it with the final copy.'],
  [/TODO|TBD/, 'Replace the note with the final copy, or confirm it’s meant to be there.'],
  [/placeholder image/, 'Swap in the final image.'],
  [/privacy policy link goes nowhere|terms link goes nowhere/, 'Point the link at the legal page.'],
  [/going nowhere/, 'Point it at the right page, or remove it.'],
  [/Broken link/, 'Fix the link, or redirect the missing page.'],
  [/returns 200 instead of 404/, 'Make missing pages return a real 404.'],
  [/Couldn’t open the page|Returns HTTP/, 'Check the page loads, or remove the links to it.'],
  [/No page title/, 'Add a title in the page’s SEO settings.'],
  [/Title is longer/, 'Shorten it to about 60 characters. The SEO plan can write one.'],
  [/Same title/, 'Give each page its own title.'],
  [/No meta description/, 'Add one in the page’s SEO settings.'],
  [/Meta description is longer/, 'Shorten it to about 155 characters.'],
  [/Same meta description/, 'Give each page its own description.'],
  [/No H1/, 'Tag the page’s main heading as H1.'],
  [/More than one H1/, 'Keep one H1 and make the others H2.'],
  [/alt attribute/, 'Add alt text to each image, or mark decorative ones as decorative.'],
  [/og:image/, 'Add an Open Graph image in the page’s settings, or one for the whole site.'],
  [/No favicon/, 'Upload a favicon in the site settings.'],
  [/No canonical tag/, 'Set the global canonical URL (in Webflow: Site settings, SEO).'],
  [/Canonical points to|Canonical tag isn’t/, 'Point canonicals at the live domain.'],
  [/No link to a privacy policy/, 'Link the privacy policy from the footer.'],
  [/No link to terms/, 'Add terms if the site sells, collects data or needs them.'],
  [/didn’t load over https/, 'Check the SSL certificate is issued and the domain points at the host.'],
  [/doesn’t redirect to https/, 'Turn on the HTTP to HTTPS redirect.'],
  [/exists twice/, 'Set a default domain so the other one redirects to it.'],
];
const fixFor = text => (FIXES.find(([re]) => re.test(text)) || [])[1] || '';

async function get(url, opts = {}) {
  try {
    const r = await fetch(url, { redirect: 'follow', ...opts, headers: { 'user-agent': UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(opts.timeout || 12000) });
    return r;
  } catch (e) { return { ok: false, status: 0, error: e.cause ? e.cause.code || e.cause.message : e.message, headers: new Headers(), text: async () => '', url }; }
}

// Status of a link: HEAD first, then GET for servers that don't answer HEAD.
async function linkStatus(url) {
  let r = await get(url, { method: 'HEAD', timeout: 10000 });
  if (!r.status || [403, 405, 429, 501].includes(r.status)) r = await get(url, { method: 'GET', timeout: 12000 });
  return r.status || 0;
}

async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

// What we read from each page, inside the browser.
const PAGE_JS = () => {
  const vis = el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length) && getComputedStyle(el).visibility !== 'hidden';
  const q = s => document.querySelector(s);
  const meta = n => (q(`meta[name="${n}" i]`) || {}).content ?? null;
  const prop = n => (q(`meta[property="${n}" i]`) || {}).content ?? null;
  const text = (document.body && document.body.innerText) || '';
  const links = [...document.querySelectorAll('a[href]')].filter(vis).map(a => ({
    href: a.getAttribute('href') || '', abs: a.href, text: (a.innerText || a.getAttribute('aria-label') || a.title || (a.querySelector('img[alt]') || {}).alt || (a.querySelector('svg title') || {}).textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
    cls: typeof a.className === 'string' ? a.className : '', footer: !!a.closest('footer, [class*=footer i]'),
    // A "#" link that a script or a Webflow interaction uses (to open a modal, switch a tab) isn't a dummy link.
    // Those carry data-* attributes (Webflow adds data-w-id), ARIA wiring, or trigger-style class names.
    ix: [...a.attributes].some(x => x.name.startsWith('data-')) || a.hasAttribute('aria-controls') || a.hasAttribute('aria-expanded') || a.getAttribute('role') === 'button'
      || !!(a.parentElement && a.parentElement.hasAttribute('data-w-id')) || /trigger|toggle|modal|popup|close|open|menu|tab|accordion|filter/i.test(typeof a.className === 'string' ? a.className : ''),
  }));
  const imgs = [...document.images].filter(i => vis(i) && (i.naturalWidth > 1 || i.width > 1)).map(i => ({ src: i.currentSrc || i.src, alt: i.getAttribute('alt') }));
  return {
    title: document.title || '', description: meta('description'), robots: meta('robots'), canonical: (q('link[rel="canonical" i]') || {}).href || null,
    ogImage: prop('og:image'), ogTitle: prop('og:title'), h1: [...document.querySelectorAll('h1')].filter(vis).map(h => h.innerText.replace(/\s+/g, ' ').trim()),
    icons: [...document.querySelectorAll('link[rel~="icon" i]')].map(l => l.href), links, imgs, text: text.slice(0, 150000),
    forms: [...document.forms].filter(vis).length, telLinks: links.filter(l => /^tel:/i.test(l.href)).length,
    password: !!q('input[type=password]') && /password|protected/i.test(document.title + ' ' + text.slice(0, 600)),
    mixed: [...document.querySelectorAll('img[src^="http:"], script[src^="http:"], link[rel=stylesheet][href^="http:"], iframe[src^="http:"]')].length,
  };
};

/**
 * Run a launch check. `url` is the site to check (live or staging), `liveHost` the domain canonicals should use.
 * `onProgress(state)` is called as it goes; the returned report is also the final state.
 */
async function run({ url, liveHost, signal = {} }, onProgress = () => {}) {
  // signal.aborted stops the check between steps and pages; it throws "Stopped".
  const stop = () => { if (signal.aborted) throw new Error('Stopped'); };
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  // Follow redirects first (brandvm.com -> www.brandvm.com), so every check uses the address the site really lives at.
  const first = await get(url);
  const start = new URL(first.status && first.url ? first.url : url);
  const origin = start.origin, host = start.hostname.replace(/^www\./, '');
  // A project whose only address is its .webflow.io one doesn't have a live domain yet.
  const knownLive = liveHost && !/\.webflow\.io$/i.test(liveHost) ? liveHost.replace(/^www\./, '') : null;
  const live = knownLive || host;
  // Webflow's .webflow.io address is always staging, even when we don't know the live domain yet.
  const staging = host !== live || /\.webflow\.io$/.test(host);
  const st = { step: 'site', done: 0, total: 0, started: Date.now(), stepAt: Date.now(), times: {} };
  const tick = () => onProgress({ ...st, times: { ...st.times } });
  const step = name => { st.times[st.step] = Date.now() - st.stepAt; st.step = name; st.stepAt = Date.now(); stop(); };
  const checks = Object.fromEntries(Object.entries(CHECKS).map(([id, name]) => [id, { id, name, ok: true, issues: [] }]));
  // The same problem on many pages (usually the nav or footer) becomes one issue listing those pages.
  const found = Object.fromEntries(Object.keys(CHECKS).map(id => [id, new Map()]));
  const issue = (id, text, page, soft = false) => {
    const m = found[id]; if (!m.has(text)) m.set(text, { text, pages: [], soft });
    for (const pg of [].concat(page || [])) if (!m.get(text).pages.includes(pg)) m.get(text).pages.push(pg);
  };
  const info = { staging, sitemap: null, robots: null, copyright: null, phones: [], forms: [], external: { checked: 0, broken: [], social: 0 }, mixed: [] };
  const isInternal = u => { try { const h = new URL(u).hostname.replace(/^www\./, ''); return h === host || h === live; } catch { return false; } };
  const pathOf = u => { try { const x = new URL(u); return x.pathname + (x.search || ''); } catch { return u; } };
  tick();

  // ---------- site-level: robots.txt, sitemap, https and www, 404 ----------
  const robots = await get(origin + '/robots.txt');
  let sitemapUrls = [];
  if (robots.status === 200) {
    const txt = await robots.text();
    let star = false, blocksAll = false;
    for (const raw of txt.split('\n')) {
      const line = raw.replace(/#.*/, '').trim(); if (!line) continue;
      const [k, ...v] = line.split(':'); const val = v.join(':').trim(), key = k.trim().toLowerCase();
      if (key === 'user-agent') star = val === '*';
      else if (key === 'disallow' && star && val === '/') blocksAll = true;
      else if (key === 'sitemap') sitemapUrls.push(val);
    }
    info.robots = { found: true, blocksAll };
    if (blocksAll) issue('indexing', 'robots.txt blocks every page (Disallow: /)');
  } else info.robots = { found: false, blocksAll: false };

  if (!sitemapUrls.length) sitemapUrls = [origin + '/sitemap.xml'];
  let pagesFromSitemap = [];
  for (const sm of sitemapUrls.slice(0, 3)) {
    const r = await get(sm);
    if (r.status !== 200) continue;
    const xml = await r.text();
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1].replace(/&amp;/g, '&'));
    pagesFromSitemap.push(...locs.filter(u => !/\.xml(\?|$)/i.test(u)));
    info.sitemap = { found: true, url: sm, urls: locs.length };
  }
  if (!info.sitemap) info.sitemap = { found: false };

  const home = await get(origin + '/');
  if (!home.status) issue('https', `The site didn’t load over https (${home.error || 'no response'})`);
  else if (home.status === 401 || home.status === 403) issue('indexing', `The site asks for a password (HTTP ${home.status})`);
  const xrt = home.headers && home.headers.get && home.headers.get('x-robots-tag');
  if (xrt && /noindex/i.test(xrt)) issue('indexing', 'The server sends “X-Robots-Tag: noindex”');
  const http = await get('http://' + start.host + '/', { redirect: 'manual' });
  if (http.status && !(http.status >= 300 && http.status < 400 && /^https:/i.test(http.headers.get('location') || ''))) issue('https', `http:// doesn’t redirect to https:// (HTTP ${http.status})`);
  if (!staging || !/\.webflow\.io$/.test(host)) {
    const other = start.hostname.startsWith('www.') ? start.hostname.slice(4) : 'www.' + start.hostname;
    const alt = await get('https://' + other + '/', { redirect: 'manual' });
    if (alt.status && alt.status >= 200 && alt.status < 300) issue('https', `${other} shows the site without redirecting to ${start.hostname}, so it exists twice`);
  }
  const missing = await get(origin + '/groundwork-launch-check-' + Date.now().toString(36));
  if (missing.status === 200) issue('links', 'A page that doesn’t exist returns 200 instead of 404, so Google may index errors');

  // ---------- pages ----------
  const seen = new Set(), queue = [], pages = [];
  const norm = u => { try { const x = new URL(u, origin); x.hash = ''; return x.origin + x.pathname.replace(/\/$/, '') + x.search; } catch { return null; } };
  const enqueue = u => {
    const n = norm(u); if (!n || !isInternal(n) || seen.has(n) || seen.size >= MAX_PAGES) return;
    const p = new URL(n); if (/\.(pdf|jpe?g|png|gif|svg|webp|avif|zip|mp4|mp3|docx?|xlsx?|pptx?|csv|txt|xml|json)$/i.test(p.pathname) || p.search) return;
    seen.add(n); queue.push(n);
  };
  enqueue(origin + '/');
  // Sitemap URLs may use the live domain while we check staging: map them onto the host we're checking.
  pagesFromSitemap.forEach(u => { try { const x = new URL(u); enqueue(origin + x.pathname); } catch {} });
  step('pages'); st.total = queue.length; tick();

  const ctx = await crawl.newContext();
  const allLinks = new Map(); // abs url -> [{page, text}]
  try {
    let active = 0;
    await new Promise(resolve => {
      const next = () => {
        if (!queue.length && !active) return resolve();
        if (signal.aborted) { queue.length = 0; if (!active) return resolve(); }
        while (active < 4 && queue.length) {
          const url = queue.shift(); active++;
          (async () => {
            const page = await ctx.newPage();
            const rec = { url, path: pathOf(url), status: 0 };
            try {
              const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
              rec.status = r ? r.status() : 0;
              const hdr = r ? r.headers()['x-robots-tag'] : null;
              await page.waitForLoadState('load', { timeout: 8000 }).catch(() => {});
              await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => {});
              const d = await page.evaluate(PAGE_JS);
              Object.assign(rec, d, { xRobots: hdr || null, text: undefined });
              rec.body = d.text;
              for (const l of d.links) {
                if (/^(mailto:|tel:|javascript:|sms:)/i.test(l.href)) continue;
                const abs = norm(l.abs); if (!abs) continue;
                if (!allLinks.has(abs)) allLinks.set(abs, []);
                allLinks.get(abs).push({ page: rec.path, text: l.text });
                enqueue(l.abs);
              }
            } catch (e) { rec.error = String(e.message || e).split('\n')[0]; }
            finally { await page.close().catch(() => {}); }
            pages.push(rec);
            st.done = pages.length; st.total = seen.size; tick();
            active--; next();
          })();
        }
      };
      next();
    });
  } finally { await ctx.close().catch(() => {}); }

  // ---------- per-page checks ----------
  const titles = new Map(), descs = new Map();
  let favicon = false, legal = { privacy: null, terms: null };
  for (const pg of pages.sort((a, b) => a.path.localeCompare(b.path))) {
    const where = pg.path;
    if (pg.error) { issue('links', `Couldn’t open the page (${pg.error})`, where); continue; }
    if (pg.status >= 400) { issue('links', `Returns HTTP ${pg.status}`, where); continue; }
    if (pg.password) issue('indexing', 'Shows a password page', where);
    if ((pg.robots && /noindex/i.test(pg.robots)) || (pg.xRobots && /noindex/i.test(pg.xRobots))) issue('indexing', 'Has a noindex tag', where);
    // placeholders
    for (const [re, label, soft] of PLACEHOLDER_TEXT) { const m = pg.body && pg.body.match(re); if (m) issue('placeholders', `${label}: “${around(pg.body, m)}”`, where, !!soft); }
    for (const img of pg.imgs) if (/placeholder|image-placeholder/i.test(img.src)) { issue('placeholders', 'A placeholder image is still on the page', where); break; }
    const dummy = pg.links.filter(l => /^(#|#!|javascript:void\(0\);?)?$/i.test(l.href.trim()) && !l.ix && !/w-(lightbox|tab-link|dropdown|nav|slider|commerce)/.test(l.cls));
    for (const l of dummy) issue('placeholders', `Link going nowhere (“#”): ${l.text ? `“${l.text}”` : 'an icon or image link with no label'}`, where);
    // SEO basics
    const t = (pg.title || '').trim();
    if (!t) issue('seo', 'No page title', where);
    else { if (t.length > 65) issue('seo', 'Title is longer than about 60 characters, so Google cuts it off', where); titles.set(t, [...(titles.get(t) || []), where]); }
    const ds = (pg.description || '').trim();
    if (!ds) issue('seo', 'No meta description', where);
    else { if (ds.length > 165) issue('seo', 'Meta description is longer than about 155 characters, so Google cuts it off', where); descs.set(ds, [...(descs.get(ds) || []), where]); }
    if (pg.h1.length !== 1) issue('seo', pg.h1.length ? 'More than one H1 on the page' : 'No H1 on the page', where);
    const noAlt = pg.imgs.filter(i => i.alt === null);
    if (noAlt.length) issue('seo', 'Images with no alt attribute', where);
    if (!pg.ogImage) issue('seo', 'No social share image (og:image)', where);
    if (pg.icons.length) favicon = true;
    // canonicals
    if (!pg.canonical) issue('canonicals', 'No canonical tag', where);
    else { try { const c = new URL(pg.canonical).hostname.replace(/^www\./, ''); if (c !== live && knownLive) issue('canonicals', `Canonical points to ${c}`, where); } catch { issue('canonicals', 'Canonical tag isn’t a valid URL', where); } }
    // legal links, copyright, phones, forms, mixed content
    // A legal link that goes to "#" doesn't count (it's reported with the dummy links too).
    for (const l of pg.links) {
      const real = !/^(#|#!|javascript:void\(0\);?)?$/i.test(l.href.trim());
      if (/privacy/i.test(l.href + ' ' + l.text)) { if (real) legal.privacy = legal.privacy || l.abs; else issue('legal', 'The privacy policy link goes nowhere (“#”)', where); }
      if (/terms|conditions|legal|t&c/i.test(l.href + ' ' + l.text)) { if (real) legal.terms = legal.terms || l.abs; else issue('legal', 'The terms link goes nowhere (“#”)', where); }
    }
    const years = [...(pg.body || '').matchAll(/(?:©|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map(m => +m[1]);
    if (years.length) info.copyright = Math.max(info.copyright || 0, ...years);
    const phones = (pg.body || '').match(/(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}/g);
    if (phones && !pg.telLinks) info.phones.push({ page: where, number: phones[0] });
    if (pg.forms) info.forms.push({ page: where, count: pg.forms });
    if (pg.mixed) info.mixed.push({ page: where, count: pg.mixed });
  }
  for (const [t, where] of titles) if (where.length > 1) issue('seo', `Same title on ${where.length} pages: “${t.slice(0, 60)}”`, where);
  for (const [, where] of descs) if (where.length > 1) issue('seo', `Same meta description on ${where.length} pages`, where);
  if (!favicon) { const f = await get(origin + '/favicon.ico', { method: 'HEAD' }); if (f.status !== 200) issue('seo', 'No favicon'); }
  if (!legal.privacy && !found.legal.has('The privacy policy link goes nowhere (“#”)')) issue('legal', 'No link to a privacy policy found');
  if (!legal.terms && !found.legal.has('The terms link goes nowhere (“#”)')) issue('legal', 'No link to terms found. Fine if the site doesn’t need them.', null, true);

  // ---------- links ----------
  const internal = [...allLinks.keys()].filter(isInternal);
  const outside = [...allLinks.keys()].filter(u => !isInternal(u) && /^https?:/i.test(u));
  const external = outside.filter(u => !SOCIAL.test(new URL(u).hostname)).slice(0, 120);
  info.external.social = outside.length - outside.filter(u => !SOCIAL.test(new URL(u).hostname)).length;
  step('links'); st.done = 0; st.total = internal.length + external.length; tick();
  const checkedPages = new Map(pages.map(p => [norm(p.url), p.status]));
  await pool(internal, 8, async u => {
    if (signal.aborted) return;
    const known = checkedPages.get(u);
    const s = known != null && known !== 0 ? known : await linkStatus(u);
    if (s >= 400 || s === 0) { const from = allLinks.get(u); issue('links', `Broken link to ${pathOf(u)} (${s ? 'HTTP ' + s : 'no response'})${from[0].text ? `, “${from[0].text}”` : ''}`, [...new Set(from.map(f => f.page))]); }
    st.done++; if (st.done % 5 === 0) tick();
  });
  stop();
  await pool(external, 8, async u => {
    if (signal.aborted) return;
    const s = await linkStatus(u);
    info.external.checked++;
    // Some sites refuse robots (401, 403, 429, 999); those aren't counted as broken.
    if ((s >= 400 && ![401, 403, 429, 999].includes(s)) || s === 0) info.external.broken.push({ url: u, status: s, page: allLinks.get(u)[0].page });
    st.done++; if (st.done % 5 === 0) tick();
  });

  stop();
  if (staging) {
    checks.canonicals.note = knownLive ? `Checked against ${live}, the live domain.` : 'Add the live domain to the project to check where canonicals point.';
    checks.indexing.note = 'Staging is usually hidden from Google on purpose. Run the check on the live domain after launch.';
    checks.https.note = 'Redirects only matter on the live domain. Run the check there after launch.';
  }
  for (const c of Object.values(checks)) {
    c.issues = [...found[c.id].values()].sort((a, b) => (a.soft - b.soft) || (b.pages.length - a.pages.length)).map(i => ({ ...i, fix: fixFor(i.text) }));
    c.ok = !c.issues.some(i => !i.soft);
  }
  return {
    url: origin + '/', host, liveHost: live, staging, pagesChecked: pages.length, linksChecked: internal.length + external.length,
    checks: Object.values(checks), info,
    pages: pages.map(p => ({ path: p.path, status: p.status, title: p.title || '', error: p.error || null })),
  };
}

module.exports = { run, CHECKS, inferCheck };
