// Tracking check: which analytics and ad tags a site loads, seen from outside the way a visitor's browser sees them.
// Every request a tag makes to send data (a page view, an event) is recorded and then blocked, so a check never
// reaches the client's accounts. It can tell what a page tries to send, never whether an account received it.

// Each tag: the script that loads it (`lib`), the request that sends data (`hit`), and where its ID and event name are.
const TAGS = [
  { tag: 'ga4', name: 'Google Analytics 4', lib: /googletagmanager\.com\/gtag\/js\?(?:[^#]*&)?id=(G-[A-Z0-9]+)/i, hit: /(?:google-analytics\.com|analytics\.google\.com)\/(?:[a-z]\/)?g\/collect/i, id: 'tid', ev: 'en', google: true },
  { tag: 'gtm', name: 'Google Tag Manager', lib: /googletagmanager\.com\/gtm\.js\?(?:[^#]*&)?id=(GTM-[A-Z0-9]+)/i },
  { tag: 'ads', name: 'Google Ads', lib: /googletagmanager\.com\/gtag\/js\?(?:[^#]*&)?id=(AW-\d+)/i, hit: /(?:googleadservices\.com\/pagead\/conversion|googleads\.g\.doubleclick\.net\/pagead\/(?:viewthrough)?conversion|google\.com\/pagead\/1p-(?:user-list|conversion))\/(\d+)/i, google: true, marketing: true },
  { tag: 'meta', name: 'Meta Pixel', lib: /connect\.facebook\.net\/[^/]+\/fbevents\.js/i, hit: /facebook\.com\/tr\/?\?/i, id: 'id', ev: 'ev', marketing: true },
  { tag: 'linkedin', name: 'LinkedIn Insight Tag', lib: /snap\.licdn\.com\/li\.lms-analytics/i, hit: /px\.ads\.linkedin\.com\/(?:collect|wa)/i, id: 'pid', marketing: true },
  { tag: 'tiktok', name: 'TikTok Pixel', lib: /analytics\.tiktok\.com\/i18n\/pixel\/events\.js/i, hit: /analytics\.tiktok\.com\/api\/v2\/pixel/i, marketing: true },
  { tag: 'pinterest', name: 'Pinterest Tag', lib: /s\.pinimg\.com\/ct\/core\.js/i, hit: /ct\.pinterest\.com\/v3/i, id: 'tid', marketing: true },
  { tag: 'clarity', name: 'Microsoft Clarity', lib: /clarity\.ms\/tag\/([a-z0-9]+)/i, hit: /[a-z]\.clarity\.ms\/collect/i },
  { tag: 'hotjar', name: 'Hotjar', lib: /static\.hotjar\.com\/c\/hotjar-(\d+)/i, hit: /(?:in|vc|content)\.hotjar\.(?:com|io)/i },
  { tag: 'plausible', name: 'Plausible', lib: /plausible\.io\/js\//i, hit: /plausible\.io\/api\/event/i, cookieless: true },
  { tag: 'fathom', name: 'Fathom', lib: /cdn\.usefathom\.com\/script\.js/i, hit: /cdn\.usefathom\.com\/\?/i, cookieless: true },
  { tag: 'matomo', name: 'Matomo', lib: /\/(?:matomo|piwik)\.js/i, hit: /\/(?:matomo|piwik)\.php\?/i },
  { tag: 'ua', name: 'Universal Analytics', lib: /google-analytics\.com\/(?:analytics|ga)\.js/i, hit: /google-analytics\.com\/(?:r\/|j\/)?collect\?(?=.*tid=UA-)/i, id: 'tid' },
];
const NAME = Object.fromEntries(TAGS.map(t => [t.tag, t.name]));
const HIT = new RegExp(TAGS.filter(t => t.hit).map(t => t.hit.source).join('|'), 'i');
// The same requests as browser block patterns. Blocking this way keeps the browser cache on (routing would turn it off).
const BLOCK = ['*google-analytics.com/g/collect*', '*analytics.google.com/g/collect*', '*google-analytics.com/collect*', '*google-analytics.com/r/collect*', '*google-analytics.com/j/collect*',
  '*googleadservices.com/pagead/conversion*', '*googleads.g.doubleclick.net/pagead/*conversion*', '*google.com/pagead/1p-*', '*facebook.com/tr?*', '*facebook.com/tr/?*',
  '*px.ads.linkedin.com/*', '*analytics.tiktok.com/api/v2/pixel*', '*ct.pinterest.com/v3*', '*.clarity.ms/collect*', '*in.hotjar.com/*', '*vc.hotjar.io/*', '*content.hotjar.io/*',
  '*plausible.io/api/event*', '*cdn.usefathom.com/?*', '*/matomo.php?*', '*/piwik.php?*'];
/** Stops a page sending tag data, before it loads anything. */
async function block(ctx, page) {
  try { const s = await ctx.newCDPSession(page); await s.send('Network.enable'); await s.send('Network.setBlockedURLs', { urls: BLOCK }); } catch {}
}

// Cookie banners, by the script that runs them.
const CMPS = [
  ['Cookiebot', /cookiebot\.(?:com|eu)/i], ['OneTrust', /cookielaw\.org|onetrust/i], ['CookieYes', /cookieyes/i], ['Osano', /osano\.com/i],
  ['Termly', /termly\.io/i], ['iubenda', /iubenda\.com/i], ['Usercentrics', /usercentrics/i], ['Complianz', /complianz/i],
  ['Finsweet Cookie Consent', /finsweet[^"']*cookie|cookie-consent@/i], ['CookieScript', /cookie-script\.com/i], ['Didomi', /privacy-center\.org|didomi/i],
  ['Axeptio', /axept\.io/i], ['Klaro', /klaro/i], ['TrustArc', /trustarc|truste\.com/i], ['Quantcast Choice', /quantcast\.mgr\.consensu|cmp\.quantcast/i],
  ['Borlabs Cookie', /borlabs-cookie/i], ['Silktide', /silktide/i], ['Shopify’s cookie banner', /consent-tracking-api|customer-privacy/i],
];

/** A request as a tag sees it: which tag, whether it loads the tag or sends data, the ID, the events, consent. */
function classify(url, body = '') {
  for (const t of TAGS) {
    if (t.hit && t.hit.test(url)) {
      let q; try { q = new URL(url).searchParams; } catch { q = new URLSearchParams(); }
      const m = url.match(t.hit);
      // GA4 sends several events in one request; the extra ones are lines in the body.
      const events = [q.get(t.ev || 'en'), ...String(body || '').split('\n').map(l => (l.match(/(?:^|&)en=([^&]+)/) || [])[1])].filter(Boolean).map(decodeURIComponent);
      // Google's consent mode: gcs "G1" + ad storage + analytics storage (1 granted, 0 denied); gcd is its newer form.
      const gcs = q.get('gcs'), gcd = q.get('gcd');
      const denied = gcs ? (t.tag === 'ads' ? gcs[2] === '0' : gcs[3] === '0') : false;
      return { tag: t.tag, kind: 'hit', id: (t.id && q.get(t.id)) || (t.tag === 'ads' && m && m[1] ? 'AW-' + m[1] : null), events, consentMode: !!(gcs || gcd), denied, cookieless: !!t.cookieless };
    }
    if (t.lib.test(url)) { const m = url.match(t.lib); return { tag: t.tag, kind: 'lib', id: m && m[1] ? m[1] : null }; }
  }
  return null;
}
/** Hits that track a visitor: everything except Google's cookieless pings after a "deny", and cookieless tools. */
const tracks = x => x.kind === 'hit' && !x.denied && !x.cookieless;

/**
 * Hooks a browser context: the data tags send is blocked, and every tag request is recorded against its page.
 * `of(page)` returns what a page loaded and tried to send.
 */
async function watch(ctx) {
  const log = new WeakMap();
  ctx.on('request', req => {
    let body = ''; try { body = req.postData() || ''; } catch {}
    const c = classify(req.url(), body); if (!c) return;
    let page; try { page = req.frame().page(); } catch { return; }
    if (!log.has(page)) log.set(page, []);
    log.get(page).push({ ...c, t: Date.now() });
  });
  return { of: page => (log.get(page) || []).slice() };
}

// Finds the cookie banner's Accept or Reject button (looking inside shadow roots too), and clicks it.
const CHOOSE_JS = ([kind, click]) => {
  const ACCEPT = /^(accept|accept all|accept all cookies|accept cookies|allow|allow all|allow all cookies|allow cookies|i accept|i agree|agree|agree and close|agree & close|got it|ok|okay|yes)\b/i;
  const REJECT = /^(reject|reject all|reject cookies|decline|decline all|deny|deny all|refuse|refuse all|only necessary|necessary only|only essential|essential only|use necessary cookies only|accept necessary|accept only necessary|accept only essential|continue without accepting|no,? thanks)\b/i;
  const els = [];
  const walk = root => { for (const el of root.querySelectorAll('button, a, [role=button], input[type=button], input[type=submit]')) els.push(el); for (const el of root.querySelectorAll('*')) if (el.shadowRoot) walk(el.shadowRoot); };
  walk(document);
  const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0; };
  const text = el => (el.innerText || el.value || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim();
  // A cookie choice sits in a box that talks about cookies or consent.
  const near = el => { let p = el; for (let i = 0; i < 8 && p; i++) { p = p.parentElement || (p.getRootNode && p.getRootNode().host) || null; if (p && /cookie|consent|privacy|gdpr|tracking/i.test(p.innerText || p.textContent || '')) return true; } return false; };
  const fits = el => { const t = text(el); if (!t || t.length > 45) return false; if (kind === 'reject') return REJECT.test(t); return ACCEPT.test(t) && !/necessary|essential|only|reject|decline/i.test(t); };
  const hit = els.find(el => vis(el) && fits(el) && near(el));
  if (!hit) return null;
  if (click) hit.click();
  return text(hit);
};

/**
 * The home page three ways, each in a fresh browser: on a first visit (no choice made), after rejecting cookies, and
 * after accepting them. After accepting, it also opens `paths` (a few other pages), so tags that wait for consent can
 * be checked page by page too. `newContext` makes a clean browser session.
 */
async function consent(newContext, url, signal = {}, paths = []) {
  const visit = async choice => {
    const ctx = await newContext();
    try {
      const w = await watch(ctx), reqs = [];
      const page = await ctx.newPage();
      page.on('request', r => reqs.push(r.url()));
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
      // Banners and tags often wait a moment after the page loads.
      await page.waitForTimeout(3500);
      const before = w.of(page);
      const buttons = { accept: await page.evaluate(CHOOSE_JS, ['accept', false]).catch(() => null), reject: await page.evaluate(CHOOSE_JS, ['reject', false]).catch(() => null) };
      let clicked = null, after = [];
      if (choice && !signal.aborted) {
        clicked = await page.evaluate(CHOOSE_JS, [choice, true]).catch(() => null);
        if (clicked) {
          const t = Date.now();
          await page.waitForTimeout(2500);
          // A second page view: tags that wait for consent usually start here.
          await page.reload({ waitUntil: 'load', timeout: 30000 }).catch(() => {});
          await page.waitForTimeout(3000);
          after = w.of(page).filter(x => x.t >= t);
          if (choice === 'accept') {
            pagesAfter.push({ path: '/', tags: after });
            for (const pth of paths) {
              if (signal.aborted) break;
              const t0 = Date.now();
              const ok = await page.goto(new URL(pth, url).href, { waitUntil: 'load', timeout: 30000 }).then(() => true).catch(() => false);
              if (!ok) continue;
              await page.waitForTimeout(2500);
              pagesAfter.push({ path: pth, tags: w.of(page).filter(x => x.t >= t0) });
            }
          }
        }
      }
      const cmp = (CMPS.find(([, re]) => reqs.some(u => re.test(u))) || [])[0] || null;
      return { before, after, clicked, buttons, cmp };
    } finally { await ctx.close().catch(() => {}); }
  };
  const pagesAfter = [];
  const rej = await visit('reject');
  if (signal.aborted) return null;
  const acc = await visit('accept');
  return { first: rej.before, afterReject: rej.clicked ? rej.after : null, afterAccept: acc.clicked ? acc.after : null, acceptedPages: acc.clicked ? pagesAfter : [], buttons: rej.buttons, banner: rej.cmp || acc.cmp || (rej.buttons.accept || rej.buttons.reject ? 'A cookie banner' : null) };
}

/**
 * Whether redirects keep the query string, so ad clicks (gclid) and campaign tags (UTM) survive: http to https, the
 * other www version, and a page with and without its trailing slash.
 */
async function clickIds(origin, pages, get) {
  const q = 'gclid=groundwork-test&utm_source=groundwork&utm_medium=test';
  const u = new URL(origin), other = u.hostname.startsWith('www.') ? u.hostname.slice(4) : 'www.' + u.hostname;
  const page = pages.find(p => p.path !== '/' && p.status && p.status < 400 && !p.error);
  const tries = [`http://${u.host}/?${q}`, `https://${other}/?${q}`];
  if (page) { const pth = page.path.split('?')[0]; tries.push(`${origin}${pth.endsWith('/') ? pth.slice(0, -1) : pth + '/'}?${q}`); }
  const out = [];
  for (const t of tries) {
    const r = await get(t);
    if (!r.status || !r.url || r.url === t) continue; // no redirect, nothing to keep
    out.push({ from: t.split('?')[0], to: r.url.split('?')[0], kept: /gclid=groundwork-test/.test(r.url) && /utm_source=groundwork/.test(r.url) });
  }
  return out;
}

/**
 * The tracking check's findings, as launch check issues and a summary. `pages` are the launch check's pages, each
 * with `tags` from `watch`; `consentRun` from `consent`; `redirects` from `clickIds`.
 */
function analyze({ pages, consentRun, redirects, staging }) {
  const issues = [];
  const add = (text, where, soft, fix, examples) => issues.push({ text, pages: [].concat(where || []), soft: !!soft, fix, ...(examples ? { examples } : {}) });
  const crawled = pages.filter(p => p.status && p.status < 400 && !p.error && p.tags);
  // Page by page, the pages as they are once cookies are accepted, when there's a banner to accept; otherwise as the
  // check found them. Tags that wait for consent only show up the first way.
  const c = consentRun;
  const ok = c && c.acceptedPages && c.acceptedPages.length > 1 ? c.acceptedPages : crawled;
  const found = new Map();
  for (const p of ok) for (const x of p.tags) {
    const f = found.get(x.tag) || { tag: x.tag, name: NAME[x.tag], ids: new Set(), pages: new Set() };
    if (x.id) f.ids.add(x.id); f.pages.add(p.path); found.set(x.tag, f);
  }
  const tags = [...found.values()].map(f => ({ tag: f.tag, name: f.name, ids: [...f.ids], pages: f.pages.size, of: ok.length }));
  const names = list => [...new Set(list.filter(tracks).map(x => NAME[x.tag]))];

  // On every page: a tag that loads on most pages but not some, the rest probably missing it by mistake.
  for (const f of found.values()) {
    if (['ads', 'ua'].includes(f.tag) || ok.length < 2) continue;
    const missing = ok.filter(p => !f.pages.has(p.path)).map(p => p.path);
    if (missing.length && f.pages.size >= ok.length / 2) add(`${f.name} doesn’t load on ${missing.length} of ${ok.length} pages`, missing, false, 'Add the tag to the site-wide head code or the template these pages use, so every page is counted.');
  }
  // Counted twice: more than one page view per page for the same ID (often the tag added by hand and by Tag Manager).
  const twice = new Map();
  for (const p of ok) {
    const n = new Map();
    for (const x of p.tags.filter(y => y.kind === 'hit' && (y.tag === 'ga4' || y.tag === 'meta'))) {
      const views = x.events.filter(e => /^page_?view$/i.test(e)).length;
      if (views) n.set(x.tag + ' ' + (x.id || ''), (n.get(x.tag + ' ' + (x.id || '')) || 0) + views);
    }
    for (const [k, c] of n) if (c > 1) twice.set(k, [...(twice.get(k) || []), p.path]);
  }
  for (const [k, where] of twice) { const [tag, id] = k.split(' '); add(`${NAME[tag]}${id ? ` (${id})` : ''} counts each page view twice`, where, false, 'The tag is installed twice, often once by hand and once in Tag Manager. Keep one.'); }
  const ga = found.get('ga4');
  if (ga && ga.ids.size > 1) add(`Pages send data to ${ga.ids.size} GA4 properties: ${[...ga.ids].join(', ')}`, null, true, 'Fine if that’s on purpose. If one is left over from an old setup, remove it.');
  if (found.has('ua')) add(`An old Universal Analytics tag${found.get('ua').ids.size ? ` (${[...found.get('ua').ids].join(', ')})` : ''} is still on the site`, [...found.get('ua').pages], true, 'Google stopped collecting data with Universal Analytics in 2023. Remove the code that loads it.');
  const everywhere = new Set([...crawled, ...ok].flatMap(p => p.tags.map(x => x.tag)));
  const analytics = ['ga4', 'gtm', 'clarity', 'plausible', 'fathom', 'matomo', 'hotjar'].some(t => everywhere.has(t));
  if (!analytics && !staging) add('No analytics found on the pages checked', null, true, 'If the client wants to know how many people visit and what they do, add GA4 or the analytics they use before launch.');
  const sent = crawled.flatMap(p => p.tags.filter(tracks));
  if (staging && sent.length) add(`Staging sends visits to ${names(sent).join(', ')}${[...new Set(sent.map(x => x.id).filter(Boolean))].length ? ` (${[...new Set(sent.map(x => x.id).filter(Boolean))].join(', ')})` : ''}`, null, true, 'Unless these are test properties, load the tags on the live domain only, or test visits end up in the client’s reports.');

  // Cookie consent, from the three visits to the home page.
  if (c) {
    const first = names(c.first), rejected = c.afterReject ? names(c.afterReject) : [], accepted = c.afterAccept ? names(c.afterAccept) : null;
    if (c.banner) {
      if (first.length) add(`${first.join(', ')} ${first.length === 1 ? 'tracks' : 'track'} visitors before they make a cookie choice`, '/', false, 'Load these tags only after the visitor accepts, through the cookie banner’s settings or Google’s consent mode.');
      if (rejected.length) add(`${rejected.join(', ')} still ${rejected.length === 1 ? 'tracks' : 'track'} visitors after they reject cookies`, '/', false, 'Connect the tags to the cookie banner, so a “Reject” stops them.');
      if (!c.buttons.reject && c.buttons.accept) add('The cookie banner has no Reject button on its first screen', '/', true, 'In the EU and the UK, regulators expect rejecting to be as easy as accepting. Add a Reject button next to Accept.');
      const google = [...found.keys()].some(t => TAGS.find(x => x.tag === t && x.google));
      const googleHits = [...c.first, ...(c.afterReject || []), ...(c.afterAccept || [])].filter(x => x.kind === 'hit' && TAGS.find(t => t.tag === x.tag && t.google));
      if (google && googleHits.length && !googleHits.some(x => x.consentMode)) add('Google tags don’t use consent mode', '/', true, 'Turn on Google consent mode in the cookie banner’s settings. Google asks for it for ads and measurement aimed at visitors in the EEA, and GA4 can then model visits from people who decline.');
      if (accepted && !accepted.length && found.size && (c.afterAccept || []).length === 0) add('Accepting cookies doesn’t start any tags on the next page view', '/', true, 'Accept cookies on the site yourself, then check GA4’s Realtime report shows the visit.');
    } else if (first.length) {
      add(`${first.join(', ')} ${first.length === 1 ? 'runs' : 'run'} with no cookie banner`, '/', true, 'If the site has visitors from the EU, the UK or US states with privacy laws, ask the client whether it needs a cookie banner. Groundwork can’t tell where visitors come from.');
    }
  }
  // Ad clicks and campaigns keep their source through redirects.
  const dropped = (redirects || []).filter(r => !r.kept);
  if (dropped.length) add('Redirects drop gclid and UTM tags, so ad clicks and campaigns lose their source', null, !found.has('ads'), 'Keep the query string when redirecting. It’s usually the https, www or trailing-slash setting at the host, or the redirect rule.', dropped.slice(0, 3).map(r => ({ page: new URL(r.from).pathname, text: `${r.from} redirects to ${r.to} without the query string` })));

  return {
    issues,
    info: {
      tags, banner: c ? c.banner : null, buttons: c ? c.buttons : null, acceptedPass: ok !== crawled,
      consentMode: [...crawled.flatMap(p => p.tags), ...ok.flatMap(p => p.tags), ...(c ? c.first : [])].some(x => x.consentMode),
      firstVisit: c ? names(c.first) : null, afterReject: c && c.afterReject ? names(c.afterReject) : null, afterAccept: c && c.afterAccept ? names(c.afterAccept) : null,
      redirects: redirects || [], blocked: [...crawled, ...(ok === crawled ? [] : ok)].reduce((n, p) => n + p.tags.filter(x => x.kind === 'hit').length, 0) + (c ? [...c.first, ...(c.afterReject || [])].filter(x => x.kind === 'hit').length : 0),
    },
  };
}

module.exports = { watch, block, consent, clickIds, analyze, classify, TAGS, HIT };
