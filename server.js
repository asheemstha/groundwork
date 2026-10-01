// Groundwork: plan site improvements with your own Claude Code or Codex account.
// Local only: binds to 127.0.0.1. Runs live in ./data/runs/<id>/.
const APP_NAME = 'Groundwork';
const http = require('http'), fs = require('fs'), path = require('path');
const engines = require('./lib/engines');
const crawl = require('./lib/crawl');
const H = require('./lib/headings');
const SEO = require('./lib/seo');

const ROOT = __dirname, PORT = +process.env.PORT || 4477;
// The desktop app keeps data in ~/Library/Application Support/Groundwork/data; a terminal run keeps it next to the code.
const DATA = process.env.GW_DATA || path.join(ROOT, 'data'), RUNS = path.join(DATA, 'runs'), PUB = path.join(ROOT, 'web', 'dist');
const DESKTOP = () => global.gwDesktop || null;
fs.mkdirSync(RUNS, { recursive: true });

// ---------- small helpers ----------
const readJson = (f, d = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const writeJson = (f, o) => { fs.writeFileSync(f + '.tmp', JSON.stringify(o, null, 1)); fs.renameSync(f + '.tmp', f); };
const runDir = id => path.join(RUNS, id);
const readRun = id => { const m = /^[a-z0-9]+$/.test(id) && readJson(path.join(runDir(id), 'meta.json')); if (m) m.dir = runDir(id); return m || null; };
// While a run is scanning or planning, its live state is in memory; disk can lag behind.
const active = {};
const loadRun = id => active[id] || readRun(id);
const saveRun = run => { run.updated = Date.now(); const { dir, ...m } = run; writeJson(path.join(runDir(run.id), 'meta.json'), m); };
const slug = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'page';
const settingsFile = path.join(DATA, 'settings.json');
const getSettings = () => readJson(settingsFile, {});
const setSettings = patch => writeJson(settingsFile, { ...getSettings(), ...patch });
const history = () => readJson(path.join(DATA, 'history.json'), []);
const sitesFile = path.join(DATA, 'sites.json');
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return String(u || ''); } };
const siteName = host => (readJson(sitesFile, {})[host] || {}).name || null;
const setSiteName = (host, name) => { const all = readJson(sitesFile, {}); name = String(name || '').trim().slice(0, 60); if (name) all[host] = { ...(all[host] || {}), name }; else if (all[host]) delete all[host].name; writeJson(sitesFile, all); };
// Projects and templates (lib/projects.js). A project links to a site's scans and plans by its host.
const allRuns = () => fs.readdirSync(RUNS).map(id => loadRun(id)).filter(Boolean);
const assist = require('./lib/assist');
const statusPage = require('./lib/status-page');

// A page as a PDF: the app's own Chromium when running inside Groundwork, else the scan browser.
async function htmlToPdf(html) {
  const letter = /-(US|CA|MX|PH)\b/.test(Intl.DateTimeFormat().resolvedOptions().locale);
  if (process.versions.electron) {
    const { BrowserWindow } = require('electron');
    const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
    try {
      await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
      return await w.webContents.printToPDF({ pageSize: letter ? 'Letter' : 'A4', printBackground: true, margins: { top: 0.6, bottom: 0.6, left: 0.6, right: 0.6 } });
    } finally { w.destroy(); }
  }
  const ctx = await crawl.newContext();
  try { const page = await ctx.newPage(); await page.setContent(html, { waitUntil: 'load' }); return await page.pdf({ format: letter ? 'Letter' : 'A4', printBackground: true, margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } }); }
  finally { await ctx.close().catch(() => {}); }
}
const SK = require('./lib/skills')({ DATA, BUILTIN: H.SKILL_DIR, readJson, writeJson, seoRules: SEO.RULES });
const P = require('./lib/projects')({ DATA, readJson, writeJson, allRuns, hostOf: u => hostOf(/^https?:\/\//i.test(u) ? u : 'https://' + u), timeOf: (id, from) => T.forProject(id, from), userAgent: `Groundwork/${readJson(path.join(ROOT, 'package.json'), {}).version || '0'} (+https://github.com/asheemstha/groundwork)` });
// The work log, the running timer and the day's tasks (lib/time.js). Entries are signed with your name from Settings.
const T = require('./lib/time')({ DATA, readJson, writeJson, newId: () => P.newId(), who: () => (getSettings().prefs || {}).appliedBy || '', projectOf: id => P.readRaw(id), itemOf: (id, itemId) => P.itemRef(id, itemId), extraOf: (id, extraId) => P.extraRef(id, extraId) });
// Search Console and GA4 with the user's own Google sign-in (lib/google.js). A dev copy can point it at a local stand-in.
const GOOGLE = require('./lib/google')({ DATA, readJson, writeJson, port: () => PORT, fake: (process.env.GW_DEV_DATA && process.env.GW_GOOGLE_FAKE) || null, keychain: process.platform === 'darwin' && !process.env.GW_DEV_DATA });
/** Reads a project's Search Console clicks or GA4 sessions for a range of days, and saves them like an imported CSV. */
async function googlePull(id, source, kind) {
  const raw = P.readRaw(id); if (!raw) throw new Error('That project doesn’t exist any more.');
  const g = raw.google || {}, { from, to } = P.googleRange(raw, kind);
  try {
    let imp;
    if (source === 'gsc') { if (!g.gsc) throw new Error('Pick the Search Console property first.'); imp = P.addTraffic(id, { source: 'Search Console', metric: 'clicks', rows: await GOOGLE.pages(g.gsc, from, to), from, to, kind }); }
    else { if (!g.ga4) throw new Error('Pick the GA4 property first.'); imp = P.addTraffic(id, { source: 'GA4', metric: 'sessions', rows: await GOOGLE.landing(g.ga4, from, to), from, to, kind }); }
    if (g.error) P.setGoogle(id, { error: null });
    return imp;
  } catch (e) { P.setGoogle(id, { error: e.message }); throw e; }
}
// The page the browser shows when Google sends the person back after signing in.
const oauthPage = r => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Groundwork</title>
<style>html{background:#fafaf9}body{margin:0;min-height:100vh;display:grid;place-items:center;font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;color:#161716}main{max-width:440px;padding:32px;text-align:center}h1{font-size:20px;font-weight:500;margin:0 0 8px}p{margin:0;color:#6f6e6a}</style></head>
<body><main><h1>${r.ok ? 'Signed in' : 'Not signed in'}</h1><p>${String(r.text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</p></main></body></html>`;
let googleLists = { at: 0 };
const ICON_EXT = { 'image/svg+xml': 'svg', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/gif': 'gif' };
function saveFavicon(run, fav) {
  if (!fav) return;
  const ext = ICON_EXT[fav.type] || 'ico';
  fs.writeFileSync(path.join(run.dir, 'favicon.' + ext), fav.buf);
  run.favicon = { file: 'favicon.' + ext, type: fav.type };
}

// Live state per run (process, SSE listeners, activity log). Everything durable is on disk.
const live = {};
const L = id => live[id] || (live[id] = { listeners: new Set(), log: [], proc: null, cancelled: false });
function emit(id, msg) { for (const res of L(id).listeners) res.write(`data: ${JSON.stringify(msg)}\n\n`); }
// Lines from the SEO plan carry job: 'seo', so each plan shows its own activity.
function logLine(id, kind, text, job) {
  const e = { t: Date.now(), kind, text: String(text).slice(0, 2000), ...(job === 'seo' ? { job } : {}) };
  const l = L(id); l.log.push(e); if (l.log.length > 400) l.log.shift();
  fs.appendFile(path.join(runDir(id), 'activity.jsonl'), JSON.stringify(e) + '\n', () => {});
  emit(id, { type: 'log', entry: e });
}
// Both plans' activity, from the file (the memory copy only holds this session's lines).
const runLog = run => {
  const f = path.join(run.dir, 'activity.jsonl');
  if (!fs.existsSync(f)) return L(run.id).log;
  const all = fs.readFileSync(f, 'utf8').trim().split('\n').map(x => { try { return JSON.parse(x); } catch { return null; } }).filter(Boolean);
  // Keep the latest lines of each plan, so a long SEO run doesn't push the heading plan's log out.
  return [...all.filter(e => !e.job).slice(-200), ...all.filter(e => e.job).slice(-200)].sort((a, b) => a.t - b.t);
};
function push(run) { emit(run.id, { type: 'snapshot', run: publicRun(run), progress: progress(run), seoProgress: jobProgress(run, 'seo') }); }

function publicRun(run) {
  const { dir, ...m } = run;
  return m;
}

// ---------- status ----------
let statusCache = null, statusAt = 0;
/** The engine for short AI jobs: the one you use for plans, if it's signed in, else any signed-in one. */
function aiEngine(want) {
  if (!want) return null;
  const e = (statusCache && statusCache.engines) || {}, pref = (getSettings().prefs || {}).engine;
  const ok = k => e[k] && e[k].installed && e[k].loggedIn;
  return ok(pref) ? pref : ok('claude') ? 'claude' : ok('codex') ? 'codex' : null;
}
async function status(force) {
  if (!force && statusCache && Date.now() - statusAt < 15000) return statusCache;
  const [eng, br] = await Promise.all([engines.detect(), crawl.browserStatus()]);
  statusCache = { app: APP_NAME, engines: eng, browser: br, catalog: engines.CATALOG, effort: engines.EFFORT, limits: getSettings().limits || null };
  statusAt = Date.now();
  return statusCache;
}

// ---------- scanning (free: no AI) ----------
async function startScan(rawUrl, name, { projectId = null, site = null } = {}) {
  let url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let u; try { u = new URL(url); } catch { throw new Error('That doesn’t look like a web address.'); }
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') throw new Error('That doesn’t look like a web address.');
  const id = Date.now().toString(36);
  fs.mkdirSync(path.join(runDir(id), 'crawl'), { recursive: true });
  fs.mkdirSync(path.join(runDir(id), 'shots'), { recursive: true });
  const run = { id, tool: 'headings', projectId, site, url: u.href, name: u.hostname.replace(/^www\./, ''), created: Date.now(), status: 'scanning', scan: { started: Date.now(), step: 'open', done: 0, total: 0 }, pages: [] };
  run.dir = runDir(id);
  if (name) setSiteName(hostOf(u.href), name);
  saveRun(run); active[id] = run;
  scan(run).catch(e => { run.status = 'scan_failed'; run.scan.error = friendly(e); run.scan.ended = Date.now(); saveRun(run); push(run); }).finally(() => { delete active[id]; });
  return run;
}
// Errors people can act on, in place of the browser's or the engine's codes.
// The last errors people saw, kept in memory for "Copy app details" (feedback from testers).
const recentErrors = [];
const friendly = e => {
  const m = String(e && e.message || e);
  recentErrors.push({ at: Date.now(), m: m.split('\n')[0].slice(0, 300) }); if (recentErrors.length > 15) recentErrors.shift();
  if (/ERR_INTERNET_DISCONNECTED|ENETUNREACH|EAI_AGAIN/.test(m)) return 'This Mac seems to be offline. Check the internet connection and try again.';
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND/.test(m)) return 'We couldn’t find that site. Check the address for typos.';
  if (/ERR_CONNECTION|ECONNREFUSED|ECONNRESET/.test(m)) return 'The site didn’t respond. Check that it’s online, then try again.';
  if (/ERR_CERT|SSL|certificate/i.test(m)) return 'The site’s security certificate isn’t valid, so the browser won’t open it. Try the http:// address, or fix the certificate first.';
  if (/ERR_TOO_MANY_REDIRECTS/.test(m)) return 'The site keeps redirecting in a loop, so no page loads.';
  if (/Timeout|timed out/i.test(m)) return 'The site took too long to load. Try again, or scan fewer pages.';
  const http = m.match(/HTTP (\d{3})/);
  if (http && (http[1] === '401' || http[1] === '403')) return `The site blocked the scan (HTTP ${http[1]}). It may be password-protected or behind a firewall such as Cloudflare.`;
  if (http && http[1] === '404') return 'That address returned “page not found” (HTTP 404). Check the address.';
  if (http && http[1][0] === '5') return `The site had a server error (HTTP ${http[1]}). Try again in a few minutes.`;
  if (/CLOUDFLARE_CHALLENGE/.test(m)) return 'The site’s Cloudflare bot protection turned the scan away. Scan the staging address instead, or allow Groundwork in the site’s Cloudflare settings.';
  if (/rate.?limit|usage limit|\b429\b|quota/i.test(m)) return 'Your AI plan’s usage limit was reached. Try again when it resets; the pages already planned are kept.';
  if (/not logged in|login required|unauthori[sz]ed|invalid api key|authentication/i.test(m)) return 'Claude Code or Codex isn’t signed in any more. Open Settings, AI accounts, to sign in again.';
  return m.split('\n')[0];
};

async function scan(run) {
  // One browser session for the whole scan, so the site sees one visitor with its cookies.
  const ctx = await crawl.newContext();
  try { await scanWith(run, ctx); } finally { await ctx.close().catch(() => {}); }
}
async function scanWith(run, ctx) {
  const d = await crawl.discover(run.url, step => { run.scan.step = step; push(run); }, ctx);
  if (d.status >= 400) throw new Error(`The home page returned HTTP ${d.status}.`);
  Object.assign(run, { origin: d.origin, platform: d.platform, navText: d.navText, dead: d.dead, siteTitle: d.title });
  if (run.projectId) P.notePlatform(run.projectId, d.platform);
  saveFavicon(run, d.favicon);
  const used = new Set();
  run.pages = d.pages.map(p => {
    let id = p.path === '/' ? 'home' : slug(p.path.split('/').filter(Boolean).pop());
    if (used.has(id)) id = slug(p.path); used.add(id);
    return { id, path: p.path, name: p.name, navGroup: p.group, sources: p.sources, collection: p.collection || null, legal: p.legal, selected: p.selected, status: null };
  });
  run.selected = run.pages.filter(p => p.selected).map(p => p.id);
  const toScan = run.pages.slice(0, 60);
  run.scan.step = 'pages'; run.scan.total = toScan.length; run.scan.pagesStarted = Date.now(); push(run);
  let challenged = 0;
  {
    await crawl.pool(toScan, 3, async p => {
      const a = await crawl.auditPage(ctx, run.origin, p.path);
      if (a.shot) fs.writeFileSync(path.join(run.dir, 'shots', p.id + '.jpg'), a.shot);
      delete a.shot;
      writeJson(path.join(run.dir, 'crawl', p.id + '.json'), a);
      Object.assign(p, { status: a.status || 0, error: a.error || null, counts: a.counts || null, title: a.title || '', height: a.height || 0, headings: (a.items || []).filter(i => /^H[1-6]$/.test(i.kind)).length, styled: (a.items || []).filter(i => i.styled && !i.hidden).length });
      if (!p.name) p.name = crawl.nameFromTitle(a.title, d.title) || p.path;
      if (a.challenge) challenged++;
      if (p.status >= 400 || !p.status) run.selected = run.selected.filter(x => x !== p.id);
      run.scan.done++; push(run);
    });
  }
  // Bot protection that lets the home page through and then turns every page away: say so plainly.
  if (challenged && challenged >= toScan.length / 2) throw new Error('CLOUDFLARE_CHALLENGE');
  if (challenged) run.scan.blocked = challenged;
  for (const p of run.pages) if (!p.name) p.name = p.path;
  run.name = (crawl.nameFromTitle(d.title, d.title) || run.name).slice(0, 40);
  run.crawledAt = run.shotsAt = Date.now(); run.status = 'scanned'; run.scan.ended = Date.now();
  saveRun(run); push(run);
}

// ---------- estimates ----------
function estimate(settings, n, tool = 'headings') {
  const cat = engines.CATALOG[settings.engine] || engines.CATALOG.claude;
  const m = cat.models.find(x => x.id === settings.model) || cat.models[0];
  const e = engines.EFFORT[settings.effort] || engines.EFFORT.medium;
  const seo = tool === 'seo';
  // The SEO plan writes three short fields a page, so it's quicker and lighter than the heading plan.
  const both = seo ? 0.45 : settings.output === 'both' ? 1.7 : 1;
  const f = m.speed * e.speed;
  let kw = (seo ? 30 + 5 * n : 60 + 10 * n) * f, perPage = 40 * f * both;
  const hist = history().filter(h => (h.tool || 'headings') === tool && h.engine === settings.engine && h.model === settings.model && h.effort === settings.effort && (seo || h.output === settings.output));
  const med = a => a.sort((x, y) => x - y)[Math.floor(a.length / 2)];
  if (hist.length) { perPage = med(hist.map(h => h.perPage)); kw = med(hist.map(h => h.kwPerPage)) * n + med(hist.map(h => h.kwBase)); }
  const score = m.usage * e.usage * Math.max(1, n / 6) * both;
  const usage = score < 4 ? 'Light' : score < 9 ? 'Moderate' : score < 18 ? 'Heavy' : 'Very heavy';
  const perPageLimit = hist.filter(h => h.limitPerPage != null).map(h => h.limitPerPage);
  return { kw, perPage, build: seo ? 5 : 10, total: kw + perPage * n + (seo ? 5 : 10), usage, usageScore: score, calibrated: hist.length, limitPct: perPageLimit.length ? med(perPageLimit) * n : null };
}

// ---------- the AI jobs ----------
// A scanned site can hold two AI plans: the heading plan (run.job, run.status, plan/) and the SEO plan
// (run.seo, seo/plan/). Only one runs at a time. Both write a _site.json first, then one file per page.
const SLOT = {
  headings: {
    dir: 'plan', of: run => run.job ? { job: run.job, selected: run.selected, status: run.status } : null,
    labels: { refresh: 'Refresh page data', keywords: 'Read the rulebook and map keywords', plan: 'Plan headings page by page', check: 'Run checks and build the guide' },
    site: 'Keyword map ready', page: p => `Planned ${p.name}`,
  },
  seo: {
    dir: path.join('seo', 'plan'), of: run => run.seo && run.seo.job ? { job: run.seo.job, selected: run.seo.selected, status: run.seo.status } : null,
    labels: { refresh: 'Read each page’s current title and description', keywords: 'Read the pages and set the title style', plan: 'Write titles, descriptions and slugs', check: 'Run checks' },
    site: 'Title style set', page: p => `Wrote the SEO for ${p.name}`,
  },
};
const aiBusy = run => run.status === 'running' || run.status === 'scanning' || !!(run.seo && run.seo.status === 'running');
function planFiles(run, which = 'headings') {
  try { return fs.readdirSync(path.join(run.dir, SLOT[which].dir)).filter(f => f.endsWith('.json')); } catch { return []; }
}
function pollPlan(run, which = 'headings') {
  const sl = SLOT[which].of(run); if (!sl) return;
  const j = sl.job, files = planFiles(run, which), now = Date.now();
  j.files = j.files || {};
  for (const f of files) {
    if (j.files[f]) continue;
    if (!readJson(path.join(run.dir, SLOT[which].dir, f))) continue; // still being written
    j.files[f] = now;
    const id = f.replace(/\.json$/, '');
    if (id === '_site') { j.kwAt = now; logLine(run.id, 'step', SLOT[which].site, which); }
    else { const p = run.pages.find(x => x.id === id); if (p) logLine(run.id, 'step', SLOT[which].page(p), which); }
    saveRun(run);
  }
}

function progress(run) {
  if (run.status === 'scanning') {
    const s = run.scan, el = Date.now() - (s.pagesStarted || s.started);
    const eta = s.done >= 2 ? (el / s.done) * (s.total - s.done) / 1000 : s.total ? s.total * 1.6 : null;
    return { percent: s.total ? Math.round(5 + 95 * s.done / s.total) : 3, etaSec: eta, elapsedSec: (Date.now() - s.started) / 1000 };
  }
  return jobProgress(run, 'headings');
}
function jobProgress(run, which) {
  const sl = SLOT[which].of(run); if (!sl) return null;
  const j = sl.job, L$ = SLOT[which].labels;
  const n = sl.selected.length, est = j.estimate, now = Date.now();
  const planned = Object.keys(j.files || {}).filter(f => f !== '_site.json').length;
  const kwDone = !!j.kwAt, start = j.aiStarted || j.started;
  const end = j.ended || now;
  let doneW = 0;
  const totalW = est.kw + est.perPage * n + est.build;
  if (kwDone) doneW += est.kw; else if (j.aiStarted) doneW += Math.min((end - start) / 1000 / est.kw, 0.92) * est.kw;
  const obsPer = planned >= 2 && kwDone ? (Math.max(...Object.values(j.files)) - j.kwAt) / 1000 / planned : null;
  const per = obsPer || est.perPage;
  doneW += planned * est.perPage;
  if (kwDone && planned < n) { const last = Math.max(j.kwAt, ...Object.entries(j.files).filter(([f]) => f !== '_site.json').map(([, t]) => t)); doneW += Math.min((end - last) / 1000 / per, 0.9) * est.perPage; }
  if (['check', 'fix', 'done'].includes(j.stage)) doneW = est.kw + est.perPage * n + (j.stage === 'done' ? est.build : 0);
  let eta;
  if (!kwDone) eta = Math.max(est.kw - (now - start) / 1000, 15) + per * n + est.build;
  else eta = per * (n - planned) + est.build - (planned < n ? Math.min((now - Math.max(...Object.values(j.files))) / 1000, per * 0.9) : 0);
  if (j.stage === 'fix') eta = Math.max(60 - (now - j.fixStarted) / 1000, 10);
  if (j.stage === 'check') eta = 5;
  const current = !kwDone ? null : run.pages.find(p => sl.selected.includes(p.id) && !(j.files || {})[p.id + '.json']);
  return {
    percent: j.stage === 'done' ? 100 : Math.max(1, Math.min(99, Math.round(100 * doneW / totalW))),
    etaSec: sl.status === 'running' ? Math.max(Math.round(eta), 3) : null,
    elapsedSec: Math.round((end - j.started) / 1000),
    stage: j.stage, kwDone, planned, total: n, current: current ? { id: current.id, name: current.name } : null,
    plannedIds: Object.keys(j.files || {}).filter(f => f !== '_site.json').map(f => f.replace(/\.json$/, '')),
    stages: [
      ...(j.refresh ? [{ key: 'refresh', label: L$.refresh, state: j.stage === 'refresh' ? 'active' : 'done', done: j.refreshDone || 0, total: n }] : []),
      { key: 'keywords', label: L$.keywords, state: kwDone ? 'done' : j.stage === 'ai' ? 'active' : 'todo', at: j.kwAt ? Math.round((j.kwAt - start) / 1000) : null },
      { key: 'plan', label: L$.plan, state: planned >= n ? 'done' : kwDone ? 'active' : 'todo', done: planned, total: n },
      ...(j.fixStarted ? [{ key: 'fix', label: 'Fix failing checks', state: j.stage === 'fix' ? 'active' : 'done' }] : []),
      { key: 'check', label: L$.check, state: j.stage === 'done' ? 'done' : j.stage === 'check' ? 'active' : 'todo' }
    ],
    tokens: j.tokens || null, limits: j.limits || null
  };
}

async function startJob(run, settings, selected) {
  const S = {
    output: ['live', 'optimize', 'both'].includes(settings.output) ? settings.output : 'live',
    market: String(settings.market || 'United States').slice(0, 60),
    liveDomain: String(settings.liveDomain || '').trim().slice(0, 120),
    appliedBy: String(settings.appliedBy || 'the developer').slice(0, 40),
    engine: settings.engine === 'codex' ? 'codex' : 'claude',
    model: String(settings.model || 'default'), effort: String(settings.effort || 'medium'),
    notes: String(settings.notes || '').trim().slice(0, 2000)
  };
  // The skill in use: the one picked in the Run panel, else the one remembered, else the built-in.
  const sk = SK.get(settings.skill || (getSettings().prefs || {}).skill, 'headings');
  Object.assign(S, { skill: sk.id, skillName: sk.name, skillSlug: sk.slug });
  const ids = new Set(run.pages.map(p => p.id));
  run.selected = selected.filter(id => ids.has(id));
  if (!run.selected.length) throw new Error('Pick at least one page.');
  const st = await status(true), e = st.engines[S.engine];
  if (!e.installed || !e.loggedIn) throw new Error(`${engines.CATALOG[S.engine].name} isn’t ready on this computer.`);
  run.settings = S;
  run.status = 'running';
  active[run.id] = run;
  run.job = { started: Date.now(), stage: 'prepare', estimate: estimate(S, run.selected.length), tokens: null, files: {} };
  delete run.result; delete run.error;
  saveRun(run); push(run);
  L(run.id).cancelled = false; L(run.id).log = L(run.id).log.filter(e => e.job);
  job(run).catch(err => { run.status = 'failed'; run.job.ended = Date.now(); run.error = friendly(err); saveRun(run); push(run); logLine(run.id, 'error', run.error); }).finally(() => { delete active[run.id]; });
}

async function job(run) {
  const j = run.job, dir = run.dir, l = L(run.id);
  // Refresh crawl data if the scan is older than an hour.
  const sel = run.pages.filter(p => run.selected.includes(p.id));
  if (Date.now() - (run.crawledAt || 0) > 3600e3) {
    j.refresh = true; j.stage = 'refresh'; j.refreshDone = 0; push(run);
    const ctx = await crawl.newContext();
    try {
      await crawl.pool(sel, 3, async p => {
        const a = await crawl.auditPage(ctx, run.origin, p.path);
        if (a.shot) fs.writeFileSync(path.join(dir, 'shots', p.id + '.jpg'), a.shot);
        delete a.shot; writeJson(path.join(dir, 'crawl', p.id + '.json'), a);
        p.status = a.status; j.refreshDone++; push(run);
      });
    } finally { await ctx.close().catch(() => {}); }
    run.crawledAt = Date.now();
  }
  if (l.cancelled) return finish(run, 'cancelled');
  // Inputs for the AI: the skill, readable crawl files, a clean plan folder.
  fs.rmSync(path.join(dir, 'skill'), { recursive: true, force: true });
  fs.cpSync(SK.dirOf(run.settings.skill), path.join(dir, 'skill'), { recursive: true });
  fs.rmSync(path.join(dir, 'plan'), { recursive: true, force: true });
  fs.mkdirSync(path.join(dir, 'plan'));
  for (const p of sel) {
    const cr = readJson(path.join(dir, 'crawl', p.id + '.json'));
    if (cr) fs.writeFileSync(path.join(dir, 'crawl', p.id + '.txt'), H.toAiText(p, cr));
  }
  j.stage = 'ai'; j.aiStarted = Date.now(); saveRun(run); push(run);
  logLine(run.id, 'step', `Started ${engines.CATALOG[run.settings.engine].name}`);
  const r1 = await agent(run, H.planPrompt(run, run.settings.skill && run.settings.skill !== SK.BUILTIN_ID ? SK.reading(path.join(dir, 'skill')) : null));
  pollPlan(run);
  if (l.cancelled) return finish(run, 'cancelled');
  const planned = planFiles(run).filter(f => f !== '_site.json').length;
  if (!planned) { run.error = r1.error ? friendly(r1.error) : 'The AI finished without writing a plan.'; return finish(run, 'failed'); }
  if (!r1.ok) logLine(run.id, 'error', r1.error);
  // Checks, and one fix pass if the plan breaks its own rules.
  j.stage = 'check'; push(run);
  let result = H.assemble(run);
  const problems = H.hardProblems(result);
  if (problems.length && r1.ok) {
    j.stage = 'fix'; j.fixStarted = Date.now(); j.fixProblems = problems.length; push(run);
    logLine(run.id, 'step', `${problems.length} check(s) failed. Asking the AI to fix them.`);
    await agent(run, H.fixPrompt(run, problems.slice(0, 40)));
    if (l.cancelled) return finish(run, 'cancelled');
    j.stage = 'check'; push(run);
    result = H.assemble(run);
  }
  writeJson(path.join(dir, 'result.json'), result);
  fs.rmSync(stateFile(run), { force: true });
  run.progress = progressCounts(run, result);
  for (const m of result.site.modes) fs.writeFileSync(path.join(dir, `guide-${m}.html`), H.exportHtml(result, m, path.join(dir, 'skill', 'assets', 'heading-map-template.html')));
  run.summary = r1.text || '';
  run.warnings = result.warnings;
  finish(run, planned < run.selected.length ? 'partial' : 'done');
}

// Run the AI once, streaming activity and usage into the run.
function agent(run, prompt, which = 'headings') {
  const j = SLOT[which].of(run).job, l = L(run.id);
  const tickers = setInterval(() => { pollPlan(run, which); push(run); }, 1500);
  const base = j.tokens ? { ...j.tokens } : { input: 0, output: 0, cached: 0 };
  const { proc, done } = engines.start({
    engine: run.settings.engine, model: run.settings.model, effort: run.settings.effort, prompt, cwd: run.dir,
    onEvent: e => {
      if (e.type === 'tool') logLine(run.id, 'tool', e.text, which);
      else if (e.type === 'text') logLine(run.id, 'ai', e.text, which);
      else if (e.type === 'usage') j.tokens = { input: base.input + e.tokens.input, output: base.output + e.tokens.output, cached: base.cached + e.tokens.cached };
      else if (e.type === 'limits') {
        const w = e.limits.unifiedWindows || {};
        j.limits = j.limits || { first: w, at: Date.now() };
        j.limits.last = w; j.limits.status = e.limits.status; j.limits.resetsAt = e.limits.resetsAt;
        setSettings({ limits: { windows: w, status: e.limits.status, at: Date.now() } });
      }
    }
  });
  l.proc = proc;
  return done.then(r => { clearInterval(tickers); l.proc = null; return r; });
}

function finish(run, state) {
  const j = run.job;
  j.stage = state === 'done' || state === 'partial' ? 'done' : j.stage;
  j.ended = Date.now(); run.status = state;
  if ((state === 'done' || state === 'partial') && j.kwAt) {
    const n = run.selected.length, planned = Object.keys(j.files).filter(f => f !== '_site.json');
    const lastT = Math.max(...planned.map(f => j.files[f]));
    const rec = {
      engine: run.settings.engine, model: run.settings.model, effort: run.settings.effort, output: run.settings.output, pages: n,
      kwBase: Math.max(((j.kwAt - j.aiStarted) / 1000) * 0.5, 20), kwPerPage: ((j.kwAt - j.aiStarted) / 1000) * 0.5 / n,
      perPage: planned.length ? (lastT - j.kwAt) / 1000 / planned.length : 60,
      totalSec: (j.ended - j.started) / 1000, tokens: j.tokens
    };
    const f5 = j.limits && j.limits.first && j.limits.first.five_hour, l5 = j.limits && j.limits.last && j.limits.last.five_hour;
    if (f5 && l5 && l5.resetsAt === f5.resetsAt) { j.limitDelta = Math.max(0, l5.utilization - f5.utilization); rec.limitPerPage = j.limitDelta / n; }
    writeJson(path.join(DATA, 'history.json'), [...history(), rec].slice(-50));
  }
  saveRun(run); push(run);
  logLine(run.id, 'step', state === 'done' ? 'Finished' : state === 'partial' ? 'Finished with some pages missing' : state === 'cancelled' ? 'Stopped' : 'Failed');
}

// ---------- the SEO plan ----------
// Lives beside the heading plan in the same scan: run.seo holds its settings and job, seo/ its files.
const seoDir = run => path.join(run.dir, 'seo');
const seoStateFile = run => path.join(seoDir(run), 'state.json');
const getSeoState = run => ({ done: {}, verify: null, edits: {}, ...readJson(seoStateFile(run), {}) });
const seoResult = run => readJson(path.join(seoDir(run), 'result.json'));
const seoCounts = (result, st) => SEOS.counts(result.pages, st.done, st.edits);

async function startSeo(run, settings, selected) {
  if (aiBusy(run)) throw new Error('Wait until the current scan or plan finishes.');
  const S = {
    market: String(settings.market || 'United States').slice(0, 60),
    liveDomain: String(settings.liveDomain || '').trim().slice(0, 120),
    engine: settings.engine === 'codex' ? 'codex' : 'claude',
    model: String(settings.model || 'default'), effort: String(settings.effort || 'medium'),
    notes: String(settings.notes || '').trim().slice(0, 2000)
  };
  const sk = SK.get(settings.skill || (getSettings().prefs || {}).seoSkill, 'seo');
  Object.assign(S, { skill: sk.id, skillName: sk.name });
  const ok = new Set(run.pages.filter(p => p.status && p.status < 400).map(p => p.id));
  const sel = selected.filter(id => ok.has(id));
  if (!sel.length) throw new Error('Pick at least one page.');
  const st = await status(true), e = st.engines[S.engine];
  if (!e.installed || !e.loggedIn) throw new Error(`${engines.CATALOG[S.engine].name} isn’t ready on this computer.`);
  run.seo = { status: 'running', settings: S, selected: sel, job: { started: Date.now(), stage: 'refresh', refresh: true, refreshDone: 0, estimate: estimate(S, sel.length, 'seo'), tokens: null, files: {} } };
  active[run.id] = run;
  saveRun(run); push(run);
  L(run.id).cancelled = false; L(run.id).log = L(run.id).log.filter(x => !x.job);
  seoJob(run).catch(err => { run.seo.status = 'failed'; run.seo.job.ended = Date.now(); run.seo.error = friendly(err); saveRun(run); push(run); logLine(run.id, 'error', run.seo.error, 'seo'); }).finally(() => { if (!aiBusy(run)) delete active[run.id]; });
}

async function seoJob(run) {
  const sq = run.seo, j = sq.job, dir = run.dir, l = L(run.id);
  // Titles and descriptions change often, so read them fresh (plain requests, a few seconds).
  const current = await SEO.readCurrent(run, sq.selected, () => { j.refreshDone++; });
  if (l.cancelled) return seoFinish(run, 'cancelled');
  fs.rmSync(path.join(seoDir(run), 'plan'), { recursive: true, force: true });
  fs.mkdirSync(path.join(seoDir(run), 'plan'), { recursive: true });
  // An added SEO skill goes next to the plan, for the AI to read first.
  fs.rmSync(path.join(seoDir(run), 'skill'), { recursive: true, force: true });
  const skDir = sq.settings.skill && SK.dirOf(sq.settings.skill);
  if (skDir) fs.cpSync(skDir, path.join(seoDir(run), 'skill'), { recursive: true });
  else if (sq.settings.skill !== SK.SEO_BUILTIN) sq.settings.skill = SK.SEO_BUILTIN;
  writeJson(path.join(seoDir(run), 'current.json'), current);
  for (const p of run.pages.filter(x => sq.selected.includes(x.id))) {
    const cr = readJson(path.join(dir, 'crawl', p.id + '.json'));
    if (cr) fs.writeFileSync(path.join(dir, 'crawl', p.id + '.txt'), H.toAiText(p, cr));
  }
  j.stage = 'ai'; j.aiStarted = Date.now(); saveRun(run); push(run);
  logLine(run.id, 'step', `Started ${engines.CATALOG[sq.settings.engine].name}`, 'seo');
  const r1 = await agent(run, SEO.prompt(run, current), 'seo');
  pollPlan(run, 'seo');
  if (l.cancelled) return seoFinish(run, 'cancelled');
  const planned = planFiles(run, 'seo').filter(f => f !== '_site.json').length;
  if (!planned) { sq.error = r1.error ? friendly(r1.error) : 'The AI finished without writing a plan.'; return seoFinish(run, 'failed'); }
  if (!r1.ok) logLine(run.id, 'error', r1.error, 'seo');
  j.stage = 'check'; push(run);
  let result = SEO.assemble(run, current);
  const problems = SEO.hardProblems(result);
  if (problems.length && r1.ok) {
    j.stage = 'fix'; j.fixStarted = Date.now(); j.fixProblems = problems.length; push(run);
    logLine(run.id, 'step', `${problems.length} check(s) failed. Asking the AI to fix them.`, 'seo');
    await agent(run, SEO.fixPrompt(run, problems.slice(0, 40)), 'seo');
    if (l.cancelled) return seoFinish(run, 'cancelled');
    j.stage = 'check'; push(run);
    result = SEO.assemble(run, current);
  }
  writeJson(path.join(seoDir(run), 'result.json'), result);
  fs.rmSync(seoStateFile(run), { force: true });
  sq.progress = seoCounts(result, getSeoState(run));
  sq.summary = r1.text || '';
  sq.warnings = result.warnings;
  seoFinish(run, planned < sq.selected.length ? 'partial' : 'done');
}

function seoFinish(run, state) {
  const sq = run.seo, j = sq.job;
  j.stage = state === 'done' || state === 'partial' ? 'done' : j.stage;
  j.ended = Date.now(); sq.status = state;
  if ((state === 'done' || state === 'partial') && j.kwAt) {
    const planned = Object.keys(j.files).filter(f => f !== '_site.json'), n = sq.selected.length;
    const lastT = Math.max(...planned.map(f => j.files[f]));
    writeJson(path.join(DATA, 'history.json'), [...history(), {
      tool: 'seo', engine: sq.settings.engine, model: sq.settings.model, effort: sq.settings.effort, pages: n,
      kwBase: Math.max(((j.kwAt - j.aiStarted) / 1000) * 0.5, 15), kwPerPage: ((j.kwAt - j.aiStarted) / 1000) * 0.5 / n,
      perPage: planned.length ? (lastT - j.kwAt) / 1000 / planned.length : 20, totalSec: (j.ended - j.started) / 1000, tokens: j.tokens,
    }].slice(-50));
  }
  saveRun(run); push(run);
  logLine(run.id, 'step', state === 'done' ? 'Finished' : state === 'partial' ? 'Finished with some pages missing' : state === 'cancelled' ? 'Stopped' : 'Failed', 'seo');
}

// Re-read the live pages and tick off the SEO changes that are there.
async function checkSeoLive(run) {
  const result = seoResult(run); if (!result) throw new Error('No SEO plan yet.');
  const st = getSeoState(run);
  const v = await SEO.verify(run, result, st.edits);
  let found = 0, todo = 0;
  for (const p of result.pages) for (const t of SEOS.tasks(p, st.edits)) {
    const x = v[p.id] && v[p.id].rows[t.key]; if (!x) continue;
    if (x === 'done') { found++; if (!st.done[t.key]) st.done[t.key] = { at: Date.now(), via: 'site' }; }
    else { todo++; if (st.done[t.key] && st.done[t.key].via === 'site') delete st.done[t.key]; }
  }
  st.verify = { at: Date.now(), pages: v };
  writeJson(seoStateFile(run), st);
  run.seo.progress = seoCounts(result, st); saveRun(run);
  return { found, todo, state: st, progress: run.seo.progress };
}

// ---------- checklist state + live checks ----------
const stateFile = run => path.join(run.dir, 'state.json');
const getState = run => readJson(stateFile(run), { done: {}, verify: {}, approved: null });
// Counts across the one merged to-do list (tag fixes now + rewrites after sign-off).
function progressCounts(run, result) {
  const c = SC.taskCounts(result.pages, getState(run).done);
  return { all: { tasks: c.tasks, done: c.done }, now: c.now };
}
// Re-read the live pages once and check every change in the plan against them.
async function checkLive(run) {
  const result = readJson(path.join(run.dir, 'result.json'));
  if (!result) throw new Error('No plan yet.');
  const pages = result.pages.filter(p => p.planned);
  const liveH = await crawl.liveHeadings(run.origin, pages.map(p => p.path));
  const v = {};
  for (const m of result.site.modes) v[m] = H.verify(result, m, liveH);
  const st = getState(run);
  let found = 0, todo = 0;
  for (const p of pages) for (const r of SC.phases(p).rows) {
    if (!SC.isTask(r)) continue;
    let s = v[r.mode]?.[p.id]?.rows?.[r.key];
    // A tag fix counts as done once the approved rewrite of the same heading is live.
    if (s === 'todo' && r.phase === 1 && r.ref && v.optimize) {
      const o = (p.modes.optimize?.rows || []).find(x => x.ref === r.ref && SC.isTask(x));
      if (o && v.optimize[p.id]?.rows?.[o.key] === 'done') { s = 'done'; v.live[p.id].rows[r.key] = 'done'; }
    }
    if (!s) continue;
    const k = `${r.mode}|${p.id}|${r.key}`;
    if (s === 'done') { found++; if (!st.done[k]) st.done[k] = { at: Date.now(), via: 'site' }; }
    else { todo++; if (st.done[k] && st.done[k].via === 'site') delete st.done[k]; }
  }
  for (const m of Object.keys(v)) st.verify[m] = { at: Date.now(), pages: v[m] };
  writeJson(stateFile(run), st);
  run.progress = progressCounts(run, result); saveRun(run);
  return { found, todo, pages: pages.length, state: st };
}

// ---------- updates (from the GitHub repo this folder was cloned from) ----------
const { execFile } = require('child_process');
const VERSION = readJson(path.join(ROOT, 'package.json'), {}).version || '0';
// ---------- backup, export and import ----------
// A backup is the whole data folder as a zip in Documents/Groundwork Backups. A project export is one project with its
// scans and plans, which another Groundwork can import.
const os = require('os');
const zipDir = (src, dest) => new Promise((ok, no) => process.platform === 'darwin'
  ? execFile('/usr/bin/ditto', ['-c', '-k', '--norsrc', '--noextattr', '--noqtn', '--keepParent', src, dest], { timeout: 600000 }, e => e ? no(e) : ok())
  : execFile('zip', ['-qr', dest, path.basename(src)], { cwd: path.dirname(src), timeout: 600000 }, e => e ? no(e) : ok()));
const unzipTo = (file, dest) => new Promise((ok, no) => process.platform === 'darwin'
  ? execFile('/usr/bin/ditto', ['-x', '-k', file, dest], { timeout: 600000 }, e => e ? no(e) : ok())
  : execFile('unzip', ['-q', '-o', file, '-d', dest], { timeout: 600000 }, e => e ? no(e) : ok()));
const stamp = () => { const d = new Date(), z = n => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}.${z(d.getMinutes())}`; };
async function backupData() {
  const dir = path.join(os.homedir(), 'Documents', 'Groundwork Backups');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `Groundwork backup ${stamp()}.zip`);
  await zipDir(DATA, file);
  return file;
}
async function exportProject(id) {
  const raw = P.readRaw(id), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-export-')), root = path.join(tmp, 'groundwork-project');
  fs.cpSync(P.dirOf(id), path.join(root, 'project'), { recursive: true });
  for (const r of P.runsOf(raw)) if (fs.existsSync(runDir(r.id))) fs.cpSync(runDir(r.id), path.join(root, 'runs', r.id), { recursive: true });
  const time = T.ofProject(id); if (time.length) writeJson(path.join(root, 'time.json'), time);
  writeJson(path.join(root, 'manifest.json'), { format: 'groundwork-project', version: 1, app: VERSION, exported: Date.now(), name: raw.name });
  const file = path.join(tmp, 'project.zip');
  await zipDir(root, file);
  fs.rmSync(root, { recursive: true, force: true });
  return { file, name: raw.name };
}
async function importProject(data) {
  const buf = Buffer.from(String(data || ''), 'base64');
  if (!buf.length) throw new Error('Choose a Groundwork project file.');
  if (buf.length > 800e6) throw new Error('That file is over 800 MB.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-import-'));
  try {
    fs.writeFileSync(path.join(tmp, 'in.zip'), buf);
    await unzipTo(path.join(tmp, 'in.zip'), path.join(tmp, 'x')).catch(() => { throw new Error('That isn’t a Groundwork project file.'); });
    const root = [path.join(tmp, 'x', 'groundwork-project'), path.join(tmp, 'x')].find(d => fs.existsSync(path.join(d, 'manifest.json')));
    const proj = root && readJson(path.join(root, 'project', 'project.json'));
    if (!proj) throw new Error('That isn’t a Groundwork project file.');
    // Keep the ids unless this Groundwork already has them.
    const id = P.readRaw(proj.id) ? P.newId() : proj.id;
    const renamed = {};
    for (const rid of fs.existsSync(path.join(root, 'runs')) ? fs.readdirSync(path.join(root, 'runs')) : []) {
      if (!/^[a-z0-9]+$/.test(rid)) continue;
      const nid = fs.existsSync(runDir(rid)) ? Date.now().toString(36) + Math.random().toString(36).slice(2, 5) : rid;
      fs.cpSync(path.join(root, 'runs', rid), runDir(nid), { recursive: true });
      const m = readJson(path.join(runDir(nid), 'meta.json'), null);
      if (m) { m.id = nid; m.projectId = id; if (m.status === 'running' || m.status === 'scanning') m.status = 'failed'; writeJson(path.join(runDir(nid), 'meta.json'), m); }
      renamed[rid] = nid;
    }
    fs.cpSync(path.join(root, 'project'), P.dirOf(id), { recursive: true });
    const pj = readJson(path.join(P.dirOf(id), 'project.json'));
    pj.id = id; if (id !== proj.id) pj.name = pj.name + ' (imported)';
    writeJson(path.join(P.dirOf(id), 'project.json'), pj);
    const rf = path.join(P.dirOf(id), 'redirects.json'), rm = readJson(rf, null);
    if (rm && renamed[rm.oldRunId]) { rm.oldRunId = renamed[rm.oldRunId]; writeJson(rf, rm); }
    T.importFor(id, readJson(path.join(root, 'time.json'), []));
    return { id, name: pj.name, runs: Object.keys(renamed).length };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

const git = (args, ms = 20000) => new Promise(r => execFile('git', args, { cwd: ROOT, timeout: ms }, (e, out, err) => r({ ok: !e, out: String(out || '').trim(), err: String(err || '').trim() })));
let update = { enabled: !!(DESKTOP() && DESKTOP().enabled), version: VERSION, app: !!process.env.GW_APP, commit: null, behind: 0, latest: null, checkedAt: 0, error: null, launcher: !!process.env.GW_LAUNCHER };
async function checkUpdate() {
  if (DESKTOP()) return (update = await DESKTOP().check());
  if (!fs.existsSync(path.join(ROOT, '.git'))) return (update = { ...update, enabled: false });
  const head = await git(['rev-parse', '--short', 'HEAD']);
  const branch = (await git(['rev-parse', '--abbrev-ref', 'HEAD'])).out || 'main';
  const remote = await git(['remote']);
  if (!remote.out) return (update = { ...update, enabled: false, commit: head.out });
  const f = await git(['fetch', '--quiet', 'origin', branch], 30000);
  const behind = f.ok ? +(await git(['rev-list', '--count', `HEAD..origin/${branch}`])).out || 0 : 0;
  const latest = behind ? (await git(['log', '-1', '--format=%s', `origin/${branch}`])).out : null;
  update = { ...update, enabled: true, commit: head.out, behind, latest, checkedAt: Date.now(), error: f.ok ? null : 'Couldn’t reach GitHub.' };
  return update;
}
// One check at a time; the first request after start waits for it so the app never shows a stale state.
let checking = null;
const checkOnce = () => checking || (checking = checkUpdate().catch(() => update).finally(() => { checking = null; }));
const busyRuns = () => Object.values(active).filter(aiBusy);

// ---------- HTTP ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff' };
const json = (res, o, code = 200) => { res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(o)); };
const body = req => new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); });

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'), p = u.pathname, M = req.method;
  try {
    if (p === '/api/status') return json(res, await status(u.searchParams.has('fresh')));
    if (p === '/api/version' && M === 'GET') { if (u.searchParams.has('check') || !update.checkedAt) await checkOnce(); return json(res, update); }
    if (p === '/api/update' && M === 'POST') {
      if (busyRuns().length) return json(res, { error: 'Wait until the running scan or plan finishes.' }, 409);
      if (DESKTOP()) { try { return json(res, await DESKTOP().install()); } catch (e) { return json(res, { error: e.message }, 400); } }
      if (!update.enabled) return json(res, { error: 'This copy wasn’t installed from GitHub, so it can’t update itself.' }, 400);
      if (!process.env.GW_LAUNCHER) {
        // Started without the launcher: pull now, the user restarts.
        const r = await git(['pull', '--ff-only'], 60000);
        if (!r.ok) return json(res, { error: 'Update failed: ' + (r.err || r.out).split('\n')[0] }, 500);
        return json(res, { ok: true, restart: 'manual' });
      }
      // Started by the launcher: exit with 75 and it pulls, installs and restarts us.
      json(res, { ok: true, restart: 'auto' });
      setTimeout(async () => { server.close(); await Promise.race([crawl.closeBrowser(), new Promise(r => setTimeout(r, 2000))]); process.exit(75); }, 300);
      return;
    }
    // Google: the user's own OAuth client, the sign-in in their browser, and the properties it can read.
    if (p === '/oauth/google' && M === 'GET') { const r = await GOOGLE.finish(u.searchParams).catch(e => ({ ok: false, text: 'The sign-in didn’t finish: ' + e.message })); res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(oauthPage(r)); }
    if (p === '/api/google' && M === 'GET') return json(res, GOOGLE.status());
    if (p === '/api/google' && M === 'DELETE') { await GOOGLE.forget(); googleLists = { at: 0 }; return json(res, GOOGLE.status()); }
    if (p === '/api/google/client' && M === 'POST') { try { GOOGLE.setClient((await body(req)).text); googleLists = { at: 0 }; return json(res, GOOGLE.status()); } catch (e) { return json(res, { error: e.message }, 400); } }
    if (p === '/api/google/signin' && M === 'POST') { try { return json(res, { url: GOOGLE.signInUrl() }); } catch (e) { return json(res, { error: e.message }, 400); } }
    if (p === '/api/google/signout' && M === 'POST') { await GOOGLE.signOut(); googleLists = { at: 0 }; return json(res, GOOGLE.status()); }
    if (p === '/api/google/lists' && M === 'GET') {
      // Both lists at once, kept for five minutes; one of them can fail on its own (an API not turned on).
      if (!u.searchParams.has('fresh') && Date.now() - googleLists.at < 5 * 60e3) return json(res, googleLists);
      const [sc, ga] = await Promise.allSettled([GOOGLE.sites(), GOOGLE.properties()]);
      googleLists = { at: Date.now(), sites: sc.status === 'fulfilled' ? sc.value : null, sitesError: sc.status === 'rejected' ? sc.reason.message : null, properties: ga.status === 'fulfilled' ? ga.value : null, propertiesError: ga.status === 'rejected' ? ga.reason.message : null };
      return json(res, googleLists);
    }
    // Connected data: which of Google's and Meta's official connectors the user's Claude Code has. Checked when asked.
    if (p === '/api/connectors' && M === 'GET') return json(res, readJson(path.join(DATA, 'connectors.json'), null));
    if (p === '/api/connectors/check' && M === 'POST') { const r = await require('./lib/connectors').check(); writeJson(path.join(DATA, 'connectors.json'), r); return json(res, r); }
    if (p === '/api/prefs' && M === 'GET') return json(res, getSettings().prefs || {});
    if (p === '/api/prefs' && M === 'POST') { const b = await body(req); const prefs = { ...(getSettings().prefs || {}), ...b }; setSettings({ prefs }); return json(res, prefs); }
    if (p === '/api/limits/refresh' && M === 'POST') {
      const tmp = path.join(DATA, 'ping'); fs.mkdirSync(tmp, { recursive: true });
      const lim = await engines.pingClaudeLimits(tmp);
      if (lim) setSettings({ limits: { windows: lim.unifiedWindows || {}, status: lim.status, at: Date.now() } });
      statusCache = null;
      return json(res, getSettings().limits || null);
    }
    // ---- skills ----
    const skillsOut = () => { const pr = getSettings().prefs || {}; return { headings: { active: SK.get(pr.skill, 'headings').id, skills: SK.list('headings') }, seo: { active: SK.get(pr.seoSkill, 'seo').id, skills: SK.list('seo') } }; };
    const prefKey = tool => tool === 'seo' ? 'seoSkill' : 'skill';
    if (p === '/api/skills' && M === 'GET') return json(res, skillsOut());
    if (p === '/api/skills' && M === 'POST') {
      const b = await body(req);
      try { const id = SK.add(b); setSettings({ prefs: { ...(getSettings().prefs || {}), [prefKey(b.tool)]: id } }); return json(res, { ...skillsOut(), added: id }); }
      catch (e) { return json(res, { error: e.message }, 400); }
    }
    if (p === '/api/skills/active' && M === 'POST') { const b = await body(req); const tool = SK.toolOf(b.id); setSettings({ prefs: { ...(getSettings().prefs || {}), [prefKey(tool)]: SK.get(b.id, tool).id } }); return json(res, skillsOut()); }
    let sm = p.match(/^\/api\/skills\/([a-z0-9-]+)\/(copy|open)$/);
    if (sm && M === 'POST' && sm[2] === 'copy') { try { const id = SK.duplicate(sm[1]); return json(res, { ...skillsOut(), added: id }); } catch (e) { return json(res, { error: e.message }, 400); } }
    if (sm && M === 'POST' && sm[2] === 'open') {
      // Opens an added skill's folder in Finder so its files can be edited. The built-in one lives inside the app.
      const dir = SK.folderOf(sm[1]); if (!dir) return json(res, { error: 'Only added skills can be opened.' }, 400);
      execFile(process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open', [dir], () => {});
      return json(res, { ok: true });
    }
    sm = p.match(/^\/api\/skills\/([a-z0-9-]+)$/);
    if (sm && M === 'DELETE') {
      try {
        SK.remove(sm[1]); const pr = getSettings().prefs || {};
        if (pr.skill === sm[1]) setSettings({ prefs: { ...pr, skill: SK.BUILTIN_ID } });
        if (pr.seoSkill === sm[1]) setSettings({ prefs: { ...(getSettings().prefs || {}), seoSkill: SK.SEO_BUILTIN } });
        return json(res, skillsOut());
      }
      catch (e) { return json(res, { error: e.message }, 400); }
    }
    if (p === '/api/sites' && M === 'POST') { const b = await body(req); if (!b.host) return json(res, { error: 'Missing site' }, 400); setSiteName(String(b.host), b.name); return json(res, { ok: true, name: siteName(String(b.host)) }); }
    if (p === '/api/estimate' && M === 'POST') { const b = await body(req); return json(res, estimate(b.settings || {}, +b.pages || 1, b.tool === 'seo' ? 'seo' : 'headings')); }
    if (p === '/api/runs' && M === 'GET') {
      const names = readJson(sitesFile, {});
      const list = fs.readdirSync(RUNS).map(id => loadRun(id)).filter(Boolean).map(r => ({ id: r.id, projectId: r.projectId || null, site: r.site || null, name: r.name, url: r.url, host: hostOf(r.origin || r.url), siteName: (names[hostOf(r.origin || r.url)] || {}).name || null, hasIcon: !!r.favicon, status: r.status, created: r.created, updated: r.updated, pages: (r.selected || []).length, progress: r.progress || null, percent: r.status === 'running' || r.status === 'scanning' ? (progress(r) || {}).percent : null, settings: r.settings || null, seo: r.seo ? { status: r.seo.status, progress: r.seo.progress || null, percent: r.seo.status === 'running' ? (jobProgress(r, 'seo') || {}).percent : null } : null }));
      return json(res, list.sort((a, b) => b.created - a.created));
    }
    // ---- backup, export, import, sample ----
    if (p === '/api/backup' && M === 'POST') { try { const file = await backupData(); execFile('/usr/bin/open', ['-R', file], () => {}); return json(res, { file }); } catch (e) { return json(res, { error: 'Couldn’t make the backup: ' + friendly(e) }, 500); } }
    if (p === '/api/projects/import' && M === 'POST') { const b = await body(req); try { return json(res, await importProject(b.data)); } catch (e) { return json(res, { error: e.message }, 400); } }
    if (p === '/api/sample' && M === 'POST') { const x = P.createSample(); return json(res, { id: x.id }); }
    if (p === '/api/open-data' && M === 'POST') { execFile(process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open', [DATA], () => {}); return json(res, { ok: true }); }

    // ---- templates ----
    if (p === '/api/templates' && M === 'GET') return json(res, P.templateList());
    if (p === '/api/templates' && M === 'POST') { const b = await body(req); return json(res, P.createTemplate(b)); }
    let m = p.match(/^\/api\/templates\/([\w-]+)$/);
    if (m) {
      if (M === 'GET') { const t = P.getTemplate(m[1]); return t ? json(res, t) : json(res, { error: 'That template doesn’t exist any more.' }, 404); }
      if (M === 'PUT') { const b = await body(req); try { return json(res, P.saveTemplate(m[1], b)); } catch (e) { return json(res, { error: e.message }, 400); } }
      if (M === 'DELETE') { P.removeTemplate(m[1]); return json(res, { ok: true }); }
    }
    // ---- time and tasks ----
    const timerOut = () => ({ running: T.current(), today: T.dayTotal() });
    try {
      if (p === '/api/timer' && M === 'GET') return json(res, timerOut());
      if (p === '/api/timer/start' && M === 'POST') { const r = T.start(await body(req)); return json(res, { ...timerOut(), stopped: r.stopped }); }
      if (p === '/api/timer/stop' && M === 'POST') { const r = T.stop(await body(req)); return json(res, { ...timerOut(), stopped: r }); }
      if (p === '/api/timer/still' && M === 'POST') { T.still(); return json(res, timerOut()); }
      if (p === '/api/timer/away' && M === 'POST') { const b = await body(req); T.away(b.what); return json(res, timerOut()); }
      if (p === '/api/time' && M === 'GET') { const q = u.searchParams; return json(res, { entries: T.list({ from: q.get('from'), to: q.get('to'), projectId: q.get('project') }), ...timerOut() }); }
      if (p === '/api/time' && M === 'POST') return json(res, T.add(await body(req)));
      if (p === '/api/time.csv' && M === 'GET') {
        const q = u.searchParams, pid = q.get('project'), pr = pid && P.readRaw(pid);
        const name = `${pr ? pr.name.replace(/[^\w .()-]+/g, '').trim() + ' ' : ''}time ${q.get('from') || ''}${q.get('to') && q.get('to') !== q.get('from') ? ' to ' + q.get('to') : ''}`.replace(/\s+/g, ' ').trim();
        res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${name}.csv"` });
        return res.end('\ufeff' + T.csv({ from: q.get('from'), to: q.get('to'), projectId: pid }));
      }
      let tm = p.match(/^\/api\/time\/([a-z0-9]+)$/);
      if (tm && M === 'PATCH') return json(res, T.edit(tm[1], await body(req)));
      if (tm && M === 'DELETE') { T.remove(tm[1]); return json(res, { ok: true }); }
      // Every invoice as a CSV for the accountant, for a year or one project.
      if (p === '/api/invoices.csv' && M === 'GET') {
        const q = u.searchParams, rows = P.invoiceRows({ year: q.get('year'), projectId: q.get('project') });
        const cell = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
        const lines = [['Number', 'Date', 'Due', 'Client', 'Project', 'What', 'Amount', 'Currency', 'Paid on'], ...rows.map(r => [r.number, r.date, r.due, r.client, r.project, r.what, r.amount.toFixed(2), r.currency, r.paid])];
        res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="Invoices${q.get('year') ? ' ' + q.get('year') : ''}.csv"` });
        return res.end('\ufeff' + lines.map(r => r.map(cell).join(',')).join('\r\n') + '\r\n');
      }
      if (p === '/api/tasks' && M === 'GET') return json(res, { tasks: T.taskList(u.searchParams.get('day') || undefined), ...timerOut() });
      if (p === '/api/tasks' && M === 'POST') return json(res, T.addTask(await body(req)));
      tm = p.match(/^\/api\/tasks\/([a-z0-9]+)$/);
      if (tm && M === 'PATCH') return json(res, T.editTask(tm[1], await body(req)));
      if (tm && M === 'DELETE') { T.removeTask(tm[1]); return json(res, { ok: true }); }
    } catch (e) { return json(res, { error: e.message }, 400); }

    // ---- projects ----
    if (p === '/api/home' && M === 'GET') return json(res, P.home());
    if (p === '/api/projects' && M === 'GET') return json(res, P.list());
    if (p === '/api/items' && M === 'GET') return json(res, P.searchItems());
    // App details for a bug report: versions, the Mac, the browser and AI tools (never the account), counts and the
    // last errors. Shown to the person before they send it anywhere.
    if (p === '/api/diagnostics' && M === 'GET') {
      const os = require('os');
      let mac = ''; try { mac = require('child_process').execFileSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8', timeout: 2000 }).trim(); } catch {}
      const st = statusCache || {}, e = st.engines || {};
      const projects = P.listRaw(), runs = allRuns();
      const eng = k => { const x = e[k] || {}; return x.installed ? `${x.version || 'installed'}, ${x.loggedIn ? 'signed in' : 'not signed in'}${x.billing ? ', ' + x.billing : ''}${k === 'claude' && x.restricted ? ', confined to the run folder' : ''}` : 'not installed'; };
      let log = [];
      try { log = fs.readFileSync(path.join(DATA, '..', 'main.log'), 'utf8').split('\n').filter(l => /uncaught|failed|error|couldn/i.test(l)).slice(-8); } catch {}
      const redact = t => String(t).replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]').replace(new RegExp(os.homedir().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), '~');
      const lines = [
        `Groundwork ${VERSION}${process.versions.electron ? ` (app ${require('electron').app.getVersion()}, shell ${readJson(path.join(ROOT, 'package.json'), {}).gwShell || 1}, Electron ${process.versions.electron})` : ' (from source)'}`,
        `macOS ${mac || os.release()} on ${os.arch()}`,
        `Browser for scans: ${st.browser ? (st.browser.ok ? st.browser.name : 'none, ' + st.browser.error) : 'not checked yet'}`,
        `Claude Code: ${eng('claude')}`, `Codex: ${eng('codex')}`,
        `Projects: ${projects.filter(x => x.kind !== 'audit').length}, audits: ${projects.filter(x => x.kind === 'audit').length}, scans: ${runs.length}`,
        ...(recentErrors.length ? ['', 'Recent errors:', ...recentErrors.slice(-8).map(x => `${new Date(x.at).toISOString().slice(0, 16).replace('T', ' ')} ${x.m}`)] : []),
        ...(log.length ? ['', 'From the app log:', ...log] : []),
      ];
      return json(res, { text: redact(lines.join('\n')) });
    }
    if (p === '/api/calendar.ics' && M === 'GET') { res.writeHead(200, { 'content-type': 'text/calendar; charset=utf-8', 'content-disposition': 'inline; filename="groundwork.ics"' }); return res.end(P.calendar({ items: u.searchParams.get('items') === '1' })); }
    // Short AI jobs: set up a project from a brief, rewrite a message in your voice. Without an AI account the brief is
    // read for addresses and dates only.
    if (p === '/api/brief' && M === 'POST') {
      const b = await body(req), t = P.getTemplate(b.templateId);
      if (!t || t.kind !== 'checklist') return json(res, { error: 'Pick a checklist first.' }, 400);
      const eng = aiEngine(b.useAi !== false);
      try { return json(res, await assist.fromBrief({ text: b.text, template: t, engine: eng, useAi: !!eng })); } catch (e) { return json(res, { error: friendly(e) }, 400); }
    }
    if (p === '/api/rewrite' && M === 'POST') {
      const b = await body(req), eng = aiEngine(true);
      if (!eng) return json(res, { error: 'Sign in to Claude Code or Codex in Settings, AI accounts, to rewrite messages.' }, 400);
      if ((b.voice || '') !== ((getSettings().prefs || {}).voice || '')) setSettings({ prefs: { ...(getSettings().prefs || {}), voice: String(b.voice || '').slice(0, 300) } });
      try { return json(res, { text: await assist.rewrite({ text: b.text, voice: b.voice, engine: eng }) }); } catch (e) { return json(res, { error: friendly(e) }, 400); }
    }
    if (p === '/api/projects' && M === 'POST') {
      const b = await body(req);
      try {
        const proj = P.create(b), sites = P.sitesOf(proj);
        // An audit of the same site becomes part of the new project: its scans and plans move over.
        const hosts = Object.values(sites).filter(Boolean).map(hostOf);
        for (const other of P.listRaw()) {
          if (other.kind !== 'audit' || other.id === proj.id || !hosts.includes(other.host)) continue;
          // Each scan takes the role its address has in the new project: usually the old site being replaced.
          for (const r of P.runsOf(other)) { const run = readRun(r.id); if (run) { const h = hostOf(run.origin || run.url); run.projectId = proj.id; run.site = ['old', 'staging', 'live'].find(k => sites[k] && hostOf(sites[k]) === h) || null; saveRun(run); } }
          P.remove(other.id);
        }
        // Scan the old site (a redesign) or the site being audited, unless it's already been scanned.
        const which = proj.kind === 'audit' ? 'live' : sites.old ? 'old' : null;
        let run = null;
        if (which && !P.runsOf(proj).some(r => (r.pages || []).length)) run = await startScan(sites[which], proj.name, { projectId: proj.id, site: which });
        if (b.name && proj.host) setSiteName(proj.host, b.name);
        return json(res, { id: proj.id, runId: run ? run.id : null });
      } catch (e) { return json(res, { error: e.message }, 400); }
    }
    m = p.match(/^\/api\/projects\/([a-z0-9]+)(\/.*)?$/);
    if (m) {
      const id = m[1], sub = m[2] || '';
      if (!P.readRaw(id)) return json(res, { error: 'That project doesn’t exist any more.' }, 404);
      try {
        if (!sub && M === 'GET') return json(res, P.get(id));
        if (!sub && M === 'PATCH') { const b = await body(req); P.update(id, b); if (b.name && P.readRaw(id).host) setSiteName(P.readRaw(id).host, b.name); return json(res, P.get(id)); }
        if (!sub && M === 'DELETE') {
          // A project owns its scans and plans, so they go with it.
          for (const r of P.runsOf(P.readRaw(id))) { if (L(r.id).proc) L(r.id).proc.kill(); fs.rmSync(runDir(r.id), { recursive: true, force: true }); delete live[r.id]; }
          P.remove(id); return json(res, { ok: true });
        }
        if (sub === '/template' && M === 'POST') { const b = await body(req); const r = P.templateUpdate(id, b); return json(res, b.dryRun ? r : { ...r, project: P.get(id) }); }
        if (sub === '/next-cycle' && M === 'POST') { P.nextCycle(id); return json(res, P.get(id)); }
        if (sub === '/update-sent' && M === 'POST') { P.markUpdate(id); return json(res, P.get(id)); }
        const pm = sub.match(/^\/payments\/([\w-]+)$/);
        if (pm && M === 'POST') { P.setPayment(id, pm[1], await body(req)); return json(res, P.get(id)); }
        if (sub === '/shift' && M === 'POST') { const b = await body(req); const r = P.shiftPlan(id, b); return json(res, b.dryRun ? r : P.get(id)); }
        let mm = sub.match(/^\/items\/([\w-]+)$/);
        if (mm && M === 'POST') { P.setItem(id, mm[1], await body(req)); return json(res, P.get(id)); }
        if (sub === '/ask' && M === 'POST') { const b = await body(req); P.askItems(id, b.items || [], !!b.nudge); return json(res, P.get(id)); }
        mm = sub.match(/^\/signoff\/([\w-]+)$/);
        if (mm && M === 'POST') { P.signoff(id, mm[1], await body(req)); return json(res, P.get(id)); }
        if (mm && M === 'DELETE') { P.unsign(id, mm[1]); return json(res, P.get(id)); }
        if (sub === '/launch' && M === 'POST') { const b = await body(req); return json(res, { checkId: P.startLaunch(id, b.url, { speed: b.speed !== false }) }); }
        const lc = sub.match(/^\/launch\/([a-z0-9]+)\/cancel$/);
        if (lc && M === 'POST') { P.cancelLaunch(id, lc[1]); return json(res, { ok: true }); }
        if (sub === '/redirects/cancel' && M === 'POST') { P.cancelRedirects(id); return json(res, { ok: true }); }
        mm = sub.match(/^\/launch\/([a-z0-9]+)$/);
        if (mm && M === 'GET') { const r = P.getLaunch(id, mm[1]); return r ? json(res, r) : json(res, { error: 'Not found' }, 404); }
        if (sub === '/redirects' && M === 'GET') return json(res, P.redirectState(id));
        if (sub === '/redirects/build' && M === 'POST') { const b = await body(req); P.startRedirectBuild(id, b.url); return json(res, P.redirectState(id)); }
        if (sub === '/redirects/test' && M === 'POST') { const b = await body(req); P.startRedirectTest(id, b.url); return json(res, P.redirectState(id)); }
        if (sub === '/redirects/rows' && M === 'POST') { P.setRedirects(id, await body(req)); return json(res, P.redirectState(id)); }
        if (sub === '/redirects/list' && M === 'POST') { P.startRedirectList(id, await body(req)); return json(res, P.redirectState(id)); }
        if (sub === '/redirects/add' && M === 'POST') { const b = await body(req); const n = P.addToMap(id, b.paths); return json(res, { ...P.redirectState(id), added: n }); }
        if (sub === '/compare' && M === 'GET') return json(res, P.compare(id, u.searchParams.get('run')));
        // Content inventory: rules by default; with AI, the calls come from Claude or ChatGPT (page list only).
        if (sub === '/inventory' && M === 'GET') return json(res, P.getInventory(id));
        if (sub === '/inventory/build' && M === 'POST') {
          const b = await body(req), eng = b.ai ? aiEngine(true) : null;
          if (b.ai && !eng) return json(res, { error: 'Sign in to Claude Code or Codex in Settings to use AI, or make the inventory without it.' }, 400);
          try { return json(res, await P.buildInventory(id, eng ? prompt => assist.ask({ engine: eng, prompt, timeoutMs: 300000 }) : null)); } catch (e) { return json(res, { error: friendly(e) }, 400); }
        }
        if (sub === '/inventory/rows' && M === 'POST') return json(res, P.setInventory(id, await body(req)));
        if (sub === '/inventory/apply' && M === 'POST') return json(res, { changed: P.applyInventory(id) });
        if (sub === '/traffic' && M === 'POST') { P.importTraffic(id, await body(req)); return json(res, P.get(id)); }
        const trm = sub.match(/^\/traffic\/([a-z0-9]+)$/);
        if (trm && M === 'DELETE') { P.removeTraffic(id, trm[1]); return json(res, P.get(id)); }
        if (sub === '/extras' && M === 'POST') { P.setExtra(id, null, await body(req)); return json(res, P.get(id)); }
        const exm = sub.match(/^\/extras\/([a-z0-9]+)$/);
        if (exm && M === 'POST') { P.setExtra(id, exm[1], await body(req)); return json(res, P.get(id)); }
        if (exm && M === 'DELETE') { P.setExtra(id, exm[1], { remove: true }); return json(res, P.get(id)); }
        // Search Console and GA4: the properties the project reads, and a pull of a range of days.
        if (sub === '/google' && M === 'POST') { try { return json(res, P.setGoogle(id, await body(req))); } catch (e) { return json(res, { error: e.message }, 400); } }
        if (sub === '/google/pull' && M === 'POST') {
          const b = await body(req);
          try { const imp = await googlePull(id, b.source === 'ga4' ? 'ga4' : 'gsc', ['before', 'since', 'month', 'last28'].includes(b.kind) ? b.kind : 'last28'); return json(res, { ...P.get(id), pulled: { source: imp.source, metric: imp.metric, total: imp.total, pages: imp.rows.length, name: imp.name } }); }
          catch (e) { return json(res, { error: e.message }, 400); }
        }
        // Files from the client: the requests, the folder they land in, and a look in it now.
        if (sub === '/requests' && M === 'POST') { try { return json(res, P.setRequests(id, await body(req))); } catch (e) { return json(res, { error: e.message }, 400); } }
        if (sub === '/requests/scan' && M === 'POST') { const n = P.scanRequests(id); return json(res, { ...P.get(id), came: n }); }
        if (sub === '/requests/folder' && M === 'POST') {
          // In the app, a folder picker; from source, a typed path.
          let folder = (await body(req)).folder;
          if (folder === undefined && process.versions.electron) {
            const { dialog, BrowserWindow } = require('electron');
            const opts = { title: 'The folder the client’s files land in', buttonLabel: 'Use this folder', properties: ['openDirectory', 'createDirectory'] };
            const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
            const r = await (win ? dialog.showOpenDialog(win, opts) : dialog.showOpenDialog(opts));
            if (r.canceled || !r.filePaths[0]) return json(res, P.get(id));
            folder = r.filePaths[0];
          }
          try { return json(res, P.setRequests(id, { folder: folder || null })); } catch (e) { return json(res, { error: e.message }, 400); }
        }
        if (sub === '/requests/open' && M === 'POST') {
          const f = (P.get(id).requests || {}).folder; if (!f || !fs.existsSync(f)) return json(res, { error: 'That folder isn’t on this Mac any more.' }, 400);
          execFile(process.platform === 'win32' ? 'explorer' : process.platform === 'darwin' ? 'open' : 'xdg-open', [f], () => {});
          return json(res, { ok: true });
        }
        if (sub === '/accounts' && M === 'POST') { const b = await body(req); P.setAccounts(id, b.accounts); return json(res, P.get(id)); }
        if (sub === '/renewals' && M === 'POST') { try { await P.checkRenewals(id); } catch (e) { return json(res, { error: e.message }, 400); } return json(res, P.get(id)); }
        if (sub === '/scan' && M === 'POST') {
          // Scan one of the project's sites: the old one, staging or live.
          const b = await body(req), raw = P.readRaw(id), sites = P.sitesOf(raw);
          const site = ['old', 'staging', 'live'].includes(b.site) ? b.site : sites.old ? 'old' : sites.staging ? 'staging' : 'live';
          const url = sites[site] || b.url;
          if (!url) return json(res, { error: 'Add the site’s address to the project first.' }, 400);
          const run = await startScan(url, raw.name, { projectId: id, site });
          return json(res, { runId: run.id });
        }
        // The client status page, as HTML (a preview, or a file to send) or a PDF.
        if (sub === '/status-page' && M === 'GET') {
          const v = P.get(id); if (!v) return json(res, { error: 'That project doesn’t exist any more.' }, 404);
          const q = u.searchParams, prefs = getSettings().prefs || {};
          const opts = { done: q.get('done') !== '0', next: q.get('next') !== '0', waiting: q.get('waiting') !== '0', days: q.get('days') === '7' ? 7 : 14, note: String(q.get('note') || '').slice(0, 2000), agency: q.has('agency') ? String(q.get('agency')).slice(0, 80) : prefs.agency || '', yourName: prefs.appliedBy || '' };
          const html = statusPage.render(v, opts);
          const base = `${v.name.replace(/[^\w .()-]+/g, '').trim() || 'Project'} status ${new Date().toISOString().slice(0, 10)}`;
          if (q.get('format') === 'pdf') {
            try { const pdf = await htmlToPdf(html); res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${base}.pdf"` }); return res.end(pdf); }
            catch (e) { return json(res, { error: 'Couldn’t make the PDF: ' + friendly(e) }, 500); }
          }
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...(q.has('download') ? { 'content-disposition': `attachment; filename="${base}.html"` } : {}) });
          return res.end(html);
        }
        // Invoices: a draft to look over, then saved; the PDF is made from the saved invoice each time.
        if (sub === '/invoice-draft' && M === 'GET') {
          const q = u.searchParams, pr = getSettings().prefs || {};
          return json(res, P.invoiceDraft(id, { kind: q.get('kind'), phaseId: q.get('phase'), extraId: q.get('extra'), from: q.get('from'), to: q.get('to'), rate: q.get('rate') }, { entries: T.list({ projectId: id }), rate: pr.rate, number: pr.invoiceNext || 'INV-0001', payDays: pr.payDays || 14 }));
        }
        if (sub === '/invoices' && M === 'POST') {
          const inv = P.saveInvoice(id, await body(req));
          if (inv.entryIds.length) T.markInvoiced(inv.entryIds, inv.id);
          setSettings({ prefs: { ...(getSettings().prefs || {}), invoiceNext: P.nextNumber(inv.number) } });
          return json(res, { invoice: inv, project: P.get(id) });
        }
        const im = sub.match(/^\/invoices\/([a-z0-9]+)$/);
        if (im && M === 'GET') {
          const inv = P.getInvoice(id, im[1]); if (!inv) return json(res, { error: 'That invoice doesn’t exist any more.' }, 404);
          const pr = getSettings().prefs || {}, raw = P.readRaw(id);
          const html = require('./lib/invoice').render(inv, { studio: pr.agency || '', yourName: pr.appliedBy || '', details: pr.bizDetails || '', payLink: pr.payLink || '', payDetails: pr.payDetails || '', client: raw.client && raw.client.name });
          const base = `Invoice ${inv.number} ${raw.name}`.replace(/[^\w .()-]+/g, '').trim();
          if (u.searchParams.get('format') === 'html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(html); }
          try { const pdf = await htmlToPdf(html); res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${base}.pdf"` }); return res.end(pdf); }
          catch (e) { return json(res, { error: 'Couldn’t make the PDF: ' + friendly(e) }, 500); }
        }
        if (im && M === 'POST') { P.setInvoice(id, im[1], await body(req)); return json(res, P.get(id)); }
        if (im && M === 'DELETE') { const inv = P.removeInvoice(id, im[1]); if (inv) T.unmarkInvoice(inv.id); return json(res, P.get(id)); }
        // A care plan's monthly report: this month (cycle empty) or an earlier one (its index in the project's cycles).
        if (sub === '/care-report' && M === 'GET') {
          const v = P.get(id), raw = P.readRaw(id), q = u.searchParams, pr = getSettings().prefs || {};
          const past = q.get('cycle') ? (raw.cycles || [])[+q.get('cycle')] : null;
          const start = past ? past.start || (past.kickoff ? new Date(past.kickoff + 'T00:00').getTime() : 0) : raw.cycleStart || raw.created;
          const end = past ? past.at : Date.now();
          const from = past ? past.kickoff : v.kickoff, to = past ? past.launch : null;
          const checks = (raw.checks || []).filter(c => c.status === 'done' && !c.oldSite && !c.staging && c.at >= start && c.at < end);
          const all = v.phases.flatMap(ph => [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]);
          const imports = P.trafficOf(id).imports || [];
          // Search Console clicks first, else whatever was imported or pulled in the month; compared with the one before it.
          const inMonth = imports.filter(x => x.at >= start && x.at < end);
          const traffic = inMonth.find(x => x.source === 'Search Console') || inMonth[0] || null;
          // The hours logged in the plan's month: from the month's start day to its report day (or today).
          const day = t => { const x = new Date(t); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`; };
          const mins = T.list({ projectId: id, from: from || day(start), to: to || undefined }).reduce((n, e) => n + e.mins, 0);
          const month = new Date((from || day(start)) + 'T00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
          const html = require('./lib/care-report').render(v, {
            month, report: checks[0] ? P.getLaunch(id, checks[0].id) : null, up: P.uptimeIn(id, start, end), mins, plan: raw.planHours || null,
            done: past ? past.items || [] : all.filter(x => x.status === 'done' && (x.at || 0) >= start).map(x => ({ title: x.title, at: x.at })).sort((a, b) => a.at - b.at),
            traffic, before: traffic ? imports.find(x => x.at < traffic.at && x.source === traffic.source && x.metric === traffic.metric) || null : null,
          }, { studio: q.has('agency') ? String(q.get('agency')).slice(0, 80) : pr.agency || '', yourName: pr.appliedBy || '', note: String(q.get('note') || '').slice(0, 2000) });
          const base = `${v.name.replace(/[^\w .()-]+/g, '').trim() || 'Project'} care report ${month}`;
          if (q.get('format') === 'pdf') {
            try { const pdf = await htmlToPdf(html); res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${base}.pdf"` }); return res.end(pdf); }
            catch (e) { return json(res, { error: 'Couldn’t make the PDF: ' + friendly(e) }, 500); }
          }
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...(q.has('download') ? { 'content-disposition': `attachment; filename="${base}.html"` } : {}) });
          return res.end(html);
        }
        // The handoff document: what's installed, who owns which account, the launch check, redirects and renewals.
        if (sub === '/handoff' && M === 'GET') {
          const v = P.get(id), raw = P.readRaw(id), q = u.searchParams, pr = getSettings().prefs || {};
          // The latest finished check of the live domain, else the latest one of staging.
          const done = (raw.checks || []).filter(c => c.status === 'done' && !c.oldSite);
          const pick = done.find(c => !c.staging) || done[0];
          const report = pick ? P.getLaunch(id, pick.id) : null;
          const pf = require('./lib/platforms').byId(v.platform);
          const html = require('./lib/handoff-doc').render(v, report, { studio: q.has('agency') ? String(q.get('agency')).slice(0, 80) : pr.agency || '', yourName: pr.appliedBy || '', note: String(q.get('note') || '').slice(0, 2000), platform: pf ? pf.name : '' });
          const base = `${v.name.replace(/[^\w .()-]+/g, '').trim() || 'Project'} handoff ${new Date().toISOString().slice(0, 10)}`;
          if (q.get('format') === 'pdf') {
            try { const pdf = await htmlToPdf(html); res.writeHead(200, { 'content-type': 'application/pdf', 'content-disposition': `attachment; filename="${base}.pdf"` }); return res.end(pdf); }
            catch (e) { return json(res, { error: 'Couldn’t make the PDF: ' + friendly(e) }, 500); }
          }
          res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...(q.has('download') ? { 'content-disposition': `attachment; filename="${base}.html"` } : {}) });
          return res.end(html);
        }
        if (sub === '/export' && M === 'GET') {
          const { file, name } = await exportProject(id);
          res.writeHead(200, { 'content-type': 'application/zip', 'content-disposition': `attachment; filename="${name.replace(/[^\w .()-]+/g, '')} - Groundwork project.zip"` });
          const st = fs.createReadStream(file); st.pipe(res); st.on('close', () => fs.rmSync(path.dirname(file), { recursive: true, force: true }));
          return;
        }
        mm = sub.match(/^\/files\/([^/]+)$/);
        if (mm && M === 'GET') {
          const f = P.filePath(id, decodeURIComponent(mm[1]));
          if (!f || !fs.existsSync(f)) return json(res, { error: 'Not found' }, 404);
          res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': `attachment; filename="${path.basename(f).replace(/^[a-z0-9]+-/, '')}"` });
          return fs.createReadStream(f).pipe(res);
        }
      } catch (e) { return json(res, { error: e.message }, 400); }
      return json(res, { error: 'Not found' }, 404);
    }

    m = p.match(/^\/api\/runs\/([a-z0-9]+)(\/.*)?$/);
    if (m) {
      const run = loadRun(m[1]); if (!run) return json(res, { error: 'Not found' }, 404);
      const sub = m[2] || '';
      if (sub === '' && M === 'GET') return json(res, { run: { ...publicRun(run), siteName: siteName(hostOf(run.origin || run.url)) }, progress: progress(run), seoProgress: jobProgress(run, 'seo'), log: runLog(run) });
      if (sub === '' && M === 'DELETE') { if (L(run.id).proc) L(run.id).proc.kill(); fs.rmSync(run.dir, { recursive: true, force: true }); delete live[run.id]; return json(res, { ok: true }); }
      if (sub === '/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
        res.write(`data: ${JSON.stringify({ type: 'snapshot', run: publicRun(run), progress: progress(run), seoProgress: jobProgress(run, 'seo') })}\n\n`);
        L(run.id).listeners.add(res);
        const tick = setInterval(() => { const r = loadRun(run.id); if (r && aiBusy(r)) res.write(`data: ${JSON.stringify({ type: 'snapshot', run: publicRun(r), progress: progress(r), seoProgress: jobProgress(r, 'seo') })}\n\n`); else res.write(': ping\n\n'); }, 2000);
        req.on('close', () => { clearInterval(tick); L(run.id).listeners.delete(res); });
        return;
      }
      if (sub === '/start' && M === 'POST') {
        if (aiBusy(run)) return json(res, { error: 'Wait until the current scan or plan finishes.' }, 409);
        const b = await body(req);
        const prefs = getSettings().prefs || {};
        try {
          await startJob(run, { appliedBy: prefs.appliedBy, ...(b.settings || {}) }, b.selected || []);
          const { notes, liveDomain, ...keep } = b.settings || {};
          setSettings({ prefs: { ...prefs, ...keep } });
          return json(res, { ok: true });
        }
        catch (e) { return json(res, { error: e.message }, 400); }
      }
      // ---- SEO plan ----
      if (sub === '/seo/start' && M === 'POST') {
        const b = await body(req), prefs = getSettings().prefs || {};
        try {
          await startSeo(run, b.settings || {}, b.selected || []);
          const { engine, model, effort, market } = b.settings || {};
          setSettings({ prefs: { ...prefs, ...(engine ? { engine, model, effort, market } : {}) } });
          return json(res, { ok: true });
        } catch (e) { return json(res, { error: e.message }, 400); }
      }
      if (sub === '/seo/result' && M === 'GET') {
        let result = seoResult(run);
        if (!result && run.seo && run.seo.status === 'running' && fs.existsSync(path.join(seoDir(run), 'plan'))) result = SEO.assemble(run, readJson(path.join(seoDir(run), 'current.json'), {}));
        return json(res, { result, state: getSeoState(run) });
      }
      if (sub === '/seo/state' && M === 'POST') {
        const b = await body(req), st = getSeoState(run), result = seoResult(run);
        if (!result) return json(res, { error: 'No SEO plan yet.' }, 400);
        for (const [k, v] of Object.entries(b.set || {})) { if (v) st.done[k] = { at: Date.now(), via: 'manual' }; else delete st.done[k]; }
        // Your own wording for a field. null goes back to the plan's.
        for (const [k, v] of Object.entries(b.edits || {})) { if (v == null) delete st.edits[k]; else st.edits[k] = String(v).slice(0, 400); }
        writeJson(seoStateFile(run), st);
        run.seo.progress = seoCounts(result, st); saveRun(run);
        return json(res, { state: st, progress: run.seo.progress });
      }
      if (sub === '/seo/check' && M === 'POST') { try { return json(res, await checkSeoLive(run)); } catch (e) { return json(res, { error: friendly(e) }, 400); } }
      if (sub === '/seo/export.csv' && M === 'GET') {
        const result = seoResult(run); if (!result) return json(res, { error: 'No SEO plan yet.' }, 404);
        res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="${slug(run.name)}-seo-plan.csv"` });
        return res.end(SEO.csv(result, getSeoState(run).edits));
      }
      if (sub === '/cancel' && M === 'POST') { L(run.id).cancelled = true; if (L(run.id).proc) L(run.id).proc.kill('SIGTERM'); return json(res, { ok: true }); }
      if (sub === '/reshoot' && M === 'POST') {
        // Free: new screenshots with the current capture rules. Heading positions stay from the scan.
        if (run.status === 'running' || run.status === 'scanning') return json(res, { error: 'Wait until it finishes.' }, 409);
        const list = (run.pages || []).filter(p => p.status && p.status < 400);
        const ctx = await crawl.newContext(); let n = 0;
        try {
          await crawl.pool(list, 3, async p => { const a = await crawl.auditPage(ctx, run.origin, p.path); if (a.shot) { fs.writeFileSync(path.join(run.dir, 'shots', p.id + '.jpg'), a.shot); n++; } });
        } finally { await ctx.close().catch(() => {}); }
        run.shotsAt = Date.now(); saveRun(run); push(run);
        return json(res, { ok: true, pages: n });
      }
      if (sub === '/favicon') {
        if (!run.favicon && !run.faviconTried && run.origin && run.status !== 'scanning') {
          run.faviconTried = Date.now();
          saveFavicon(run, await crawl.fetchFavicon(run.origin));
          saveRun(run);
        }
        const f = run.favicon && path.join(run.dir, run.favicon.file);
        if (!f || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
        res.writeHead(200, { 'content-type': run.favicon.type || 'image/x-icon', 'cache-control': 'max-age=86400' });
        return fs.createReadStream(f).pipe(res);
      }
      if (sub === '/rescan' && M === 'POST') { const r2 = await startScan(run.url, null, { projectId: run.projectId || null, site: run.site || null }); return json(res, { id: r2.id }); }
      if (sub === '/result') {
        let result = readJson(path.join(run.dir, 'result.json'));
        if (!result && run.settings && fs.existsSync(path.join(run.dir, 'plan'))) result = H.assemble(run);
        return json(res, { result, state: getState(run) });
      }
      if (sub === '/state' && M === 'POST') {
        const b = await body(req), st = getState(run);
        for (const [k, v] of Object.entries(b.set || {})) { if (v) st.done[k] = { at: Date.now(), via: 'manual', by: (run.settings || {}).appliedBy }; else delete st.done[k]; }
        if (b.approved !== undefined) st.approved = b.approved ? { at: Date.now() } : null;
        writeJson(stateFile(run), st);
        const result = readJson(path.join(run.dir, 'result.json')); if (result) { run.progress = progressCounts(run, result); saveRun(run); }
        return json(res, { state: st, progress: run.progress });
      }
      if (sub === '/check' && M === 'POST') { try { return json(res, await checkLive(run)); } catch (e) { return json(res, { error: friendly(e) }, 400); } }
      let mm = sub.match(/^\/shot\/([a-z0-9-]+)$/);
      if (mm) { const f = path.join(run.dir, 'shots', mm[1] + '.jpg'); if (fs.existsSync(f)) { res.writeHead(200, { 'content-type': 'image/jpeg', 'cache-control': 'no-cache' }); return fs.createReadStream(f).pipe(res); } return json(res, { error: 'No screenshot' }, 404); }
      mm = sub.match(/^\/crawl\/([a-z0-9-]+)$/);
      if (mm) { const c = readJson(path.join(run.dir, 'crawl', mm[1] + '.json')); if (!c) return json(res, { error: 'Not scanned' }, 404); return json(res, { ...c, items: c.items.filter(i => /^H[1-6]$/.test(i.kind) || (i.styled && !i.hidden)) }); }
      mm = sub.match(/^\/export\/(live|optimize)$/);
      if (mm) {
        const f = path.join(run.dir, `guide-${mm[1]}.html`); if (!fs.existsSync(f)) return json(res, { error: 'No guide yet' }, 404);
        const name = `${slug(run.name)}-${mm[1] === 'live' ? 'h-tag-map' : 'heading-plan'}.html`;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', ...(u.searchParams.has('download') ? { 'content-disposition': `attachment; filename="${name}"` } : {}) });
        return fs.createReadStream(f).pipe(res);
      }
      return json(res, { error: 'Not found' }, 404);
    }
    // static
    const f = path.normalize(path.join(PUB, p === '/' ? 'index.html' : p));
    if (f.startsWith(PUB) && fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream', 'cache-control': p.startsWith('/assets/') ? 'max-age=31536000, immutable' : 'no-cache' }); return fs.createReadStream(f).pipe(res); }
    if (!p.startsWith('/api/')) {
      if (!fs.existsSync(path.join(PUB, 'index.html'))) { res.writeHead(503, { 'content-type': 'text/plain' }); return res.end('The app isn’t built yet. Run: npm run build'); }
      res.writeHead(200, { 'content-type': MIME['.html'] }); return fs.createReadStream(path.join(PUB, 'index.html')).pipe(res);
    }
    json(res, { error: 'Not found' }, 404);
  } catch (e) { console.error(e); if (!res.headersSent) json(res, { error: e.message }, 500); }
});

// Runs interrupted by a restart can't be resumed; mark them so the UI doesn't spin forever.
for (const id of fs.readdirSync(RUNS)) {
  const r = readRun(id);
  if (r && (r.status === 'running' || r.status === 'scanning')) { r.status = r.status === 'running' ? 'failed' : 'scan_failed'; r.error = 'Interrupted: Groundwork was closed while this was running.'; if (r.scan) r.scan.error = r.error; if (r.job) r.job.ended = Date.now(); saveRun(r); }
  if (r && r.seo && r.seo.status === 'running') { r.seo.status = 'failed'; r.seo.error = 'Interrupted: Groundwork was closed while this was running.'; r.seo.job.ended = Date.now(); saveRun(r); }
}
// Every scan belongs to a project. Scans from before that are claimed by the project with the same address; the
// rest (sites scanned on their own) become audit projects, grouped by site.
(function claimRuns() {
  const projects = P.listRaw();
  const byHost = new Map();
  for (const pr of projects) for (const [k, u] of Object.entries(P.sitesOf(pr))) if (u && !byHost.has(hostOf(u))) byHost.set(hostOf(u), { id: pr.id, site: k });
  const loose = new Map();
  for (const id of fs.readdirSync(RUNS)) {
    const r = readRun(id); if (!r || r.projectId) continue;
    const h = hostOf(r.origin || r.url), owner = byHost.get(h);
    if (owner) { r.projectId = owner.id; r.site = r.site || owner.site; saveRun(r); continue; }
    if (!loose.has(h)) loose.set(h, []);
    loose.get(h).push(r);
  }
  for (const [h, list] of loose) {
    const latest = list.sort((a, b) => b.created - a.created)[0];
    const audit = P.createAudit({ name: siteName(h) || latest.name || h, url: latest.origin || latest.url });
    for (const r of list) { r.projectId = audit.id; r.site = 'live'; saveRun(r); }
  }
})();
// Ctrl+C, closing the Terminal window or a kill: stop AI runs and the browser, then exit.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(sig, async () => {
  for (const l of Object.values(live)) if (l.proc) l.proc.kill('SIGTERM');
  await Promise.race([crawl.closeBrowser(), new Promise(r => setTimeout(r, 2000))]);
  process.exit(0);
});
server.on('error', e => { if (e.code === 'EADDRINUSE' && !process.env.GW_RESTARTED && !process.env.GW_APP) { console.log(`${APP_NAME} is already running: http://localhost:${PORT}`); process.exit(0); } if (e.code !== 'EADDRINUSE') throw e; });
let SC = null, SEOS = null; // shared/checks.mjs and shared/seo.mjs, loaded at boot
let markReady;
module.exports = { ready: new Promise(r => { markReady = r; }), busy: () => busyRuns().length + P.launchRunning() + P.redirectsRunning() };
Promise.all([import('./shared/checks.mjs'), import('./shared/seo.mjs')]).then(([mod, seo]) => {
  SC = mod; H.init(mod); SEOS = seo; SEO.init(seo);
  // After an update the old process may still be letting go of the port for a moment.
  let tries = 0;
  server.on('error', e => { if (e.code === 'EADDRINUSE' && process.env.GW_RESTARTED && tries++ < 20) setTimeout(() => server.listen(PORT, '127.0.0.1'), 250); });
  server.listen(PORT, '127.0.0.1', () => {
    markReady(PORT);
    console.log(`${APP_NAME} ${VERSION} is running: http://localhost:${PORT}`);
    status(true).catch(() => {});
    setTimeout(checkOnce, 4000);
    setInterval(checkOnce, 6 * 3600e3);
    // After-launch checks: a look two minutes after opening, then every half hour.
    const watch = () => {
      try { const w = P.watchTick(); if (w) console.log('after-launch check', w.projectId, 'day', w.day); } catch (e) { console.log('after-launch check failed', e.message); }
      // A care plan's monthly check, when no after-launch check is running.
      try { const c = P.careTick(); if (c) console.log('monthly care check', c.projectId); } catch (e) { console.log('monthly care check failed', e.message); }
    };
    setTimeout(watch, 2 * 60e3).unref?.();
    setInterval(watch, 30 * 60e3).unref?.();
    // The running timer notices time away from the Mac: in the app, from how long there's been no keyboard or mouse
    // input; anywhere, from a gap while the Mac slept or Groundwork was closed.
    const idle = () => { try { return process.versions.electron ? require('electron').powerMonitor.getSystemIdleTime() : null; } catch { return null; } };
    const tick = () => { try { T.tick(idle()); } catch (e) { console.log('timer check failed', e.message); } };
    tick(); setInterval(tick, 60e3).unref?.();
    // SSL and domain renewal dates: each project's live domain once a day, a few at a time.
    const renew = async () => { for (const id of P.renewalsDue().slice(0, 3)) { try { await P.checkRenewals(id); } catch (e) { console.log('renewal check failed', id, e.message); } } };
    setTimeout(renew, 90e3).unref?.();
    setInterval(renew, 60 * 60e3).unref?.();
    // Is it up: launched sites and care plans, soon after opening and then every hour, one at a time.
    const up = async () => { for (const id of P.upDue()) { try { await P.upCheck(id); } catch (e) { console.log('up check failed', id, e.message); } } };
    setTimeout(up, 20e3).unref?.();
    setInterval(up, 60 * 60e3).unref?.();
    // Search Console and GA4, for projects with a property picked: before launch, after launch, and each care month.
    const pulls = async () => {
      if (!GOOGLE.ready()) return;
      for (const j of P.googleDue().slice(0, 4)) {
        try { const imp = await googlePull(j.id, j.source, j.kind); console.log('google', j.kind, j.id, imp.total); }
        catch (e) { console.log('google pull failed', j.id, e.message); if (/sign in/i.test(e.message)) break; }
      }
    };
    setTimeout(pulls, 3 * 60e3).unref?.();
    setInterval(pulls, 60 * 60e3).unref?.();
    // Files from the client: each project's folder, every two minutes, for files that fit what's still to come.
    const files = () => { try { const n = P.requestsTick(); if (n) console.log('files from clients', n); } catch (e) { console.log('files check failed', e.message); } };
    setTimeout(files, 30e3).unref?.();
    setInterval(files, 2 * 60e3).unref?.();
  });
});
