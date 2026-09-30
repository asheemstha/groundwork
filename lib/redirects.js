// Redirect map: every URL on the current site, matched to its closest page on the new one, then tested after
// the redirects are live. No AI: plain requests, sitemaps and word matching.
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Groundwork-Redirects';
const MAX_OLD = 2000, MAX_NEW = 400, MAX_TITLES = 300;

async function get(url, opts = {}) {
  try { return await fetch(url, { redirect: opts.redirect || 'follow', method: opts.method || 'GET', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(opts.timeout || 15000) }); }
  catch (e) { return { ok: false, status: 0, error: (e.cause && e.cause.code) || e.message, headers: new Headers(), text: async () => '', url }; }
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}
const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&nbsp;/g, ' ');

// ---------- paths ----------
const FILE = /\.(pdf|jpe?g|png|gif|svg|webp|avif|zip|mp4|mp3|docx?|xlsx?|pptx?|csv|txt|xml|json|css|js|ico|woff2?)$/i;
const JUNK = /^\/(wp-(content|includes|json|admin)|cdn-cgi|feed|xmlrpc|comments\/feed|\.well-known)(\/|$)/i;
/** A path without its trailing slash, index file or query. Capitals stay; comparisons use key(). */
function normPath(u, origin) {
  let x;
  try { x = new URL(u, origin || 'https://x.invalid'); } catch { return null; }
  let p; try { p = decodeURIComponent(x.pathname); } catch { p = x.pathname; }
  p = p.replace(/\/index\.(html?|php)$/i, '/').replace(/\/+$/, '');
  return p || '/';
}
const key = p => String(p).toLowerCase();
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'with', 'at', 'by', 'is', 'our', 'your', 'us', 'page', 'html', 'php', 'www']);
const stem = w => w.replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
const tokens = s => new Set(String(s || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w && !STOP.has(w) && !/^\d{1,4}$/.test(w)).map(stem));
const jaccard = (a, b) => { if (!a.size || !b.size) return 0; let n = 0; for (const x of a) if (b.has(x)) n++; return n / (a.size + b.size - n); };
const lastSeg = p => p.split('/').filter(Boolean).pop() || '';
const parentOf = p => p.split('/').slice(0, -1).join('/') || '/';
// A title without the brand ending ("About | Brand" -> "About").
const bare = t => String(t || '').split(/\s[|–·-]\s/)[0];

// ---------- reading a site ----------
async function sitemapUrls(origin, onUrl) {
  const out = new Set(), seen = new Set();
  const read = async (u, depth) => {
    if (seen.has(u) || depth > 2 || out.size >= MAX_OLD) return; seen.add(u);
    const r = await get(u); if (r.status !== 200) return;
    const xml = await r.text();
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => decode(m[1]));
    if (/<sitemapindex/i.test(xml)) { for (const l of locs.slice(0, 20)) await read(l, depth + 1); return; }
    for (const l of locs) { out.add(l); onUrl && onUrl(); if (out.size >= MAX_OLD) break; }
  };
  const robots = await get(origin + '/robots.txt');
  const listed = robots.status === 200 ? [...(await robots.text()).matchAll(/^\s*sitemap:\s*(\S+)/gim)].map(m => m[1]) : [];
  for (const u of listed.length ? listed.slice(0, 3) : [origin + '/sitemap.xml']) await read(u, 0);
  return [...out];
}
async function pageInfo(url) {
  const r = await get(url);
  if (!r.status || r.status >= 400) return { status: r.status || 0, title: '', links: [], url: r.url || url };
  const html = (await r.text()).slice(0, 500000);
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
  const links = [...html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"'#]+)/gi)].map(m => decode(m[1]));
  return { status: r.status, title, links, url: r.url || url };
}
/** The new site's pages: its sitemap plus the pages its links reach, with their titles. */
async function readNew(newUrl, onProgress) {
  const origin = new URL(newUrl).origin, host = new URL(newUrl).hostname.replace(/^www\./, '');
  const found = new Map(); // path -> {path, title}
  const queue = [origin + '/'], seen = new Set();
  const own = u => { try { const x = new URL(u, origin); return x.hostname.replace(/^www\./, '') === host && !FILE.test(x.pathname) ? x : null; } catch { return null; } };
  // A staging sitemap can list the live domain's URLs, so only the path counts.
  for (const u of await sitemapUrls(origin)) { try { const x = new URL(u); if (!FILE.test(x.pathname)) queue.push(origin + x.pathname); } catch {} }
  while (queue.length && found.size < MAX_NEW) {
    const batch = queue.splice(0, 8).filter(u => { const p = normPath(u, origin); if (!p || seen.has(key(p))) return false; seen.add(key(p)); return true; });
    await Promise.all(batch.map(async u => {
      const info = await pageInfo(u);
      if (info.status && info.status < 400) {
        const p = normPath(info.url, origin);
        if (p && !found.has(key(p))) found.set(key(p), { path: p, title: bare(info.title) });
        for (const l of info.links) { const x = own(l); if (x && !seen.has(key(normPath(x.href, origin)))) queue.push(origin + x.pathname); }
      }
    }));
    onProgress(found.size);
  }
  return [...found.values()];
}

// ---------- matching ----------
function match(oldPages, newPages, moves) {
  const byPath = new Map(newPages.map(p => [key(p.path), p]));
  const bySlug = new Map();
  for (const p of newPages) { const s = key(lastSeg(p.path)); if (s) bySlug.set(s, bySlug.has(s) ? null : p); } // null = more than one
  const newTok = newPages.map(p => ({ p, slug: tokens(lastSeg(p.path)), title: tokens(p.title), parent: parentOf(p.path) }));
  return oldPages.map(o => {
    const row = { from: o.path, title: o.title || '', to: '/', how: 'home', score: 0, sure: false };
    if (byPath.has(key(o.path))) return { ...row, to: byPath.get(key(o.path)).path, how: 'same', sure: true };
    if (moves[key(o.path)]) return { ...row, to: moves[key(o.path)], how: 'seo', sure: true };
    const s = bySlug.get(key(lastSeg(o.path)));
    if (s) return { ...row, to: s.path, how: 'slug', sure: true };
    const ot = tokens(lastSeg(o.path)), ott = tokens(bare(o.title)), op = parentOf(o.path);
    let best = null, bestScore = 0;
    for (const n of newTok) {
      if (n.p.path === '/') continue;
      const slugS = jaccard(ot, n.slug), titleS = ott.size && n.title.size ? jaccard(ott, n.title) : 0;
      let sc = ott.size && n.title.size ? 0.55 * slugS + 0.45 * titleS : slugS;
      sc = Math.max(sc, slugS * 0.9, titleS * 0.9);
      if (n.parent === op && op !== '/') sc += 0.08;
      if (sc > bestScore) { bestScore = sc; best = n.p; }
    }
    if (best && bestScore >= 0.45) return { ...row, to: best.path, how: 'similar', score: Math.round(Math.min(bestScore, 1) * 100), sure: bestScore >= 0.8 };
    // Nothing close: its section's page, else the home page. Both need a look.
    for (let p = op; p !== '/'; p = parentOf(p)) if (byPath.has(key(p))) return { ...row, to: byPath.get(key(p)).path, how: 'parent' };
    return row;
  });
}

/**
 * Build a redirect map. `oldPages` is the current site's URLs from the scan ({path, title}); the old site is
 * re-read for its sitemap and titles when it still answers. `moves` maps old paths to new ones from the SEO plan.
 */
async function build({ oldOrigin, oldPages, newUrl, moves = {}, signal = {} }, onProgress) {
  const stop = () => { if (signal.aborted) throw new Error('Stopped'); };
  const st = { step: 'old', done: 0, total: 0 };
  const tick = () => onProgress({ ...st });
  tick();
  const old = new Map();
  const add = (u, title) => { const p = normPath(u, oldOrigin); if (!p || FILE.test(p) || JUNK.test(p) || old.size >= MAX_OLD) return; const k = key(p); if (!old.has(k)) old.set(k, { path: p, title: title || '' }); else if (title && !old.get(k).title) old.get(k).title = title; };
  for (const p of oldPages) add(p.path, p.title);
  // Once the new site is live on the same domain, the old one is gone: only the scan's list is left.
  const bareHost = u => new URL(u).hostname.replace(/^www\./, '');
  let oldLive = false;
  if (oldOrigin && bareHost(oldOrigin) !== bareHost(newUrl)) {
    const home = await get(oldOrigin + '/', { timeout: 10000 });
    oldLive = !!home.status && home.status < 400;
    if (oldLive) for (const u of await sitemapUrls(oldOrigin, () => { st.done++; if (st.done % 50 === 0) tick(); })) add(u);
  }
  stop(); st.step = 'new'; st.done = 0; tick();
  const newPages = await readNew(newUrl, n => { st.done = n; tick(); });
  if (!newPages.length) throw new Error('Couldn’t read any pages on the new site. Check the address.');
  // Titles help match pages whose URL changed. Only fetch them where the path alone doesn't match.
  const newPaths = new Set(newPages.map(p => key(p.path)));
  const need = [...old.values()].filter(o => !o.title && !newPaths.has(key(o.path)) && !moves[key(o.path)]).slice(0, MAX_TITLES);
  if (oldLive && need.length) {
    st.step = 'titles'; st.done = 0; st.total = need.length; tick();
    await pool(need, 8, async o => { const i = await pageInfo(oldOrigin + o.path); o.title = bare(i.title); st.done++; if (st.done % 10 === 0) tick(); });
  }
  stop(); st.step = 'match'; tick();
  const rows = match([...old.values()].sort((a, b) => a.path.localeCompare(b.path)), newPages, moves);
  return { newPages, rows, oldLive };
}

// ---------- testing ----------
/** Follow an old URL on the live site one hop at a time and say what happened. */
async function follow(origin, path) {
  const hops = [];
  let url = origin + path;
  for (let i = 0; i < 6; i++) {
    const r = await get(url, { redirect: 'manual', timeout: 12000 });
    const loc = r.headers.get ? r.headers.get('location') : null;
    hops.push({ status: r.status, url });
    if (r.status >= 300 && r.status < 400 && loc) { url = new URL(loc, url).href; continue; }
    break;
  }
  return hops;
}
async function test(origin, rows, onProgress, signal = {}) {
  origin = origin.replace(/\/$/, '');
  const out = {};
  let done = 0;
  await pool(rows, 8, async row => {
    if (signal.aborted) return;
    const hops = await follow(origin, row.from);
    const last = hops[hops.length - 1], first = hops[0];
    const finalPath = normPath(last.url, origin), finalHost = (() => { try { return new URL(last.url).hostname.replace(/^www\./, ''); } catch { return ''; } })();
    const sameSite = finalHost === new URL(origin).hostname.replace(/^www\./, '');
    let problem = null;
    if (!first.status) problem = 'error';
    else if (key(row.to) === key(row.from)) {
      if (last.status >= 400) problem = 'missing';
      else if (key(finalPath) !== key(row.from)) problem = 'moved';
    } else if (hops.length === 1) problem = first.status >= 400 ? 'missing' : 'none';
    else if (hops.length > 5) problem = 'loop';
    else if (last.status >= 400 || !last.status) problem = 'dead-end';
    else if (!sameSite || key(finalPath) !== key(normPath(row.to))) problem = 'wrong';
    else if (![301, 308].includes(first.status)) problem = 'temporary';
    else if (hops.length > 2) problem = 'chain';
    out[row.from] = { ok: !problem, problem, status: first.status, final: sameSite ? finalPath : last.url, finalStatus: last.status, hops: hops.length - 1 };
    done++; if (done % 5 === 0) onProgress(done);
  });
  if (signal.aborted) throw new Error('Stopped');
  return out;
}

// Which checklist item a redirect item is, for items made before checks were named in the template.
const inferCheck = title => /map|points to/i.test(title) ? 'map' : /day|after|404/i.test(title) ? 'after' : 'live';

module.exports = { build, test, normPath, key, inferCheck };
