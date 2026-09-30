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
const runsFor = host => fs.readdirSync(RUNS).map(id => loadRun(id)).filter(r => r && hostOf(r.origin || r.url) === host).sort((a, b) => b.created - a.created);
const SK = require('./lib/skills')({ DATA, BUILTIN: H.SKILL_DIR, readJson, writeJson, seoRules: SEO.RULES });
const P = require('./lib/projects')({ DATA, readJson, writeJson, runsFor, hostOf: u => hostOf(/^https?:\/\//i.test(u) ? u : 'https://' + u) });
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
async function status(force) {
  if (!force && statusCache && Date.now() - statusAt < 15000) return statusCache;
  const [eng, br] = await Promise.all([engines.detect(), crawl.browserStatus()]);
  statusCache = { app: APP_NAME, engines: eng, browser: br, catalog: engines.CATALOG, effort: engines.EFFORT, limits: getSettings().limits || null };
  statusAt = Date.now();
  return statusCache;
}

// ---------- scanning (free: no AI) ----------
async function startScan(rawUrl, name) {
  let url = String(rawUrl || '').trim();
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  let u; try { u = new URL(url); } catch { throw new Error('That doesn’t look like a web address.'); }
  if (!u.hostname.includes('.') && u.hostname !== 'localhost') throw new Error('That doesn’t look like a web address.');
  const id = Date.now().toString(36);
  fs.mkdirSync(path.join(runDir(id), 'crawl'), { recursive: true });
  fs.mkdirSync(path.join(runDir(id), 'shots'), { recursive: true });
  const run = { id, tool: 'headings', url: u.href, name: u.hostname.replace(/^www\./, ''), created: Date.now(), status: 'scanning', scan: { started: Date.now(), step: 'open', done: 0, total: 0 }, pages: [] };
  run.dir = runDir(id);
  if (name) setSiteName(hostOf(u.href), name);
  saveRun(run); active[id] = run;
  scan(run).catch(e => { run.status = 'scan_failed'; run.scan.error = friendly(e); run.scan.ended = Date.now(); saveRun(run); push(run); }).finally(() => { delete active[id]; });
  return run;
}
const friendly = e => {
  const m = String(e && e.message || e);
  if (/ERR_NAME_NOT_RESOLVED/.test(m)) return 'We couldn’t find that site. Check the address.';
  if (/ERR_CONNECTION|ECONNREFUSED/.test(m)) return 'The site didn’t respond. Is it online?';
  if (/Timeout/i.test(m)) return 'The site took too long to load.';
  return m.split('\n')[0];
};

async function scan(run) {
  const d = await crawl.discover(run.url, step => { run.scan.step = step; push(run); });
  if (d.status >= 400) throw new Error(`The home page returned HTTP ${d.status}.`);
  Object.assign(run, { origin: d.origin, platform: d.platform, navText: d.navText, dead: d.dead, siteTitle: d.title });
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
  const ctx = await crawl.newContext();
  try {
    await crawl.pool(toScan, 3, async p => {
      const a = await crawl.auditPage(ctx, run.origin, p.path);
      if (a.shot) fs.writeFileSync(path.join(run.dir, 'shots', p.id + '.jpg'), a.shot);
      delete a.shot;
      writeJson(path.join(run.dir, 'crawl', p.id + '.json'), a);
      Object.assign(p, { status: a.status || 0, error: a.error || null, counts: a.counts || null, title: a.title || '', height: a.height || 0, headings: (a.items || []).filter(i => /^H[1-6]$/.test(i.kind)).length, styled: (a.items || []).filter(i => i.styled && !i.hidden).length });
      if (!p.name) p.name = crawl.nameFromTitle(a.title, d.title) || p.path;
      if (p.status >= 400 || !p.status) run.selected = run.selected.filter(x => x !== p.id);
      run.scan.done++; push(run);
    });
  } finally { await ctx.close().catch(() => {}); }
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
  // The skill in use: the one picked in the composer, else the one remembered, else the built-in.
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
  if (!planned) { run.error = r1.error || 'The AI finished without writing a plan.'; return finish(run, 'failed'); }
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
  if (!planned) { sq.error = r1.error || 'The AI finished without writing a plan.'; return seoFinish(run, 'failed'); }
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
      const list = fs.readdirSync(RUNS).map(id => loadRun(id)).filter(Boolean).map(r => ({ id: r.id, name: r.name, url: r.url, host: hostOf(r.origin || r.url), siteName: (names[hostOf(r.origin || r.url)] || {}).name || null, hasIcon: !!r.favicon, status: r.status, created: r.created, updated: r.updated, pages: (r.selected || []).length, progress: r.progress || null, percent: r.status === 'running' || r.status === 'scanning' ? (progress(r) || {}).percent : null, settings: r.settings || null, seo: r.seo ? { status: r.seo.status, progress: r.seo.progress || null, percent: r.seo.status === 'running' ? (jobProgress(r, 'seo') || {}).percent : null } : null }));
      return json(res, list.sort((a, b) => b.created - a.created));
    }
    if (p === '/api/scan' && M === 'POST') { const b = await body(req); try { const run = await startScan(b.url, b.name); return json(res, { id: run.id }); } catch (e) { return json(res, { error: e.message }, 400); } }

    // ---- templates ----
    if (p === '/api/templates' && M === 'GET') return json(res, P.templateList());
    if (p === '/api/templates' && M === 'POST') { const b = await body(req); return json(res, P.createTemplate(b)); }
    let m = p.match(/^\/api\/templates\/([\w-]+)$/);
    if (m) {
      if (M === 'GET') { const t = P.getTemplate(m[1]); return t ? json(res, t) : json(res, { error: 'That template doesn’t exist any more.' }, 404); }
      if (M === 'PUT') { const b = await body(req); try { return json(res, P.saveTemplate(m[1], b)); } catch (e) { return json(res, { error: e.message }, 400); } }
      if (M === 'DELETE') { P.removeTemplate(m[1]); return json(res, { ok: true }); }
    }
    // ---- projects ----
    if (p === '/api/home' && M === 'GET') return json(res, P.home());
    if (p === '/api/projects' && M === 'GET') return json(res, P.list());
    if (p === '/api/projects' && M === 'POST') {
      const b = await body(req);
      try {
        let url = String(b.url || '').trim(), run = null;
        if (url) {
          if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
          // Reuse the site's scans if Groundwork already knows it; otherwise start one.
          if (!runsFor(hostOf(url)).length) run = await startScan(url, b.name);
          else if (b.name) setSiteName(hostOf(url), b.name);
        }
        const proj = P.create({ ...b, url: run ? run.url : url || null });
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
        if (!sub && M === 'DELETE') { P.remove(id); return json(res, { ok: true }); }
        if (sub === '/template' && M === 'POST') { const b = await body(req); const r = P.templateUpdate(id, b); return json(res, b.dryRun ? r : { ...r, project: P.get(id) }); }
        if (sub === '/shift' && M === 'POST') { const b = await body(req); const r = P.shiftPlan(id, b); return json(res, b.dryRun ? r : P.get(id)); }
        let mm = sub.match(/^\/items\/([\w-]+)$/);
        if (mm && M === 'POST') { P.setItem(id, mm[1], await body(req)); return json(res, P.get(id)); }
        if (sub === '/ask' && M === 'POST') { const b = await body(req); P.askItems(id, b.items || [], !!b.nudge); return json(res, P.get(id)); }
        mm = sub.match(/^\/signoff\/([\w-]+)$/);
        if (mm && M === 'POST') { P.signoff(id, mm[1], await body(req)); return json(res, P.get(id)); }
        if (mm && M === 'DELETE') { P.unsign(id, mm[1]); return json(res, P.get(id)); }
        if (sub === '/launch' && M === 'POST') { const b = await body(req); return json(res, { checkId: P.startLaunch(id, b.url) }); }
        const lc = sub.match(/^\/launch\/([a-z0-9]+)\/cancel$/);
        if (lc && M === 'POST') { P.cancelLaunch(id, lc[1]); return json(res, { ok: true }); }
        if (sub === '/redirects/cancel' && M === 'POST') { P.cancelRedirects(id); return json(res, { ok: true }); }
        mm = sub.match(/^\/launch\/([a-z0-9]+)$/);
        if (mm && M === 'GET') { const r = P.getLaunch(id, mm[1]); return r ? json(res, r) : json(res, { error: 'Not found' }, 404); }
        if (sub === '/redirects' && M === 'GET') return json(res, P.redirectState(id));
        if (sub === '/redirects/build' && M === 'POST') { const b = await body(req); P.startRedirectBuild(id, b.url); return json(res, P.redirectState(id)); }
        if (sub === '/redirects/test' && M === 'POST') { const b = await body(req); P.startRedirectTest(id, b.url); return json(res, P.redirectState(id)); }
        if (sub === '/redirects/rows' && M === 'POST') { P.setRedirects(id, await body(req)); return json(res, P.redirectState(id)); }
        if (sub === '/scan' && M === 'POST') {
          const b = await body(req), raw = P.readRaw(id);
          const run = await startScan(b.url || raw.url, raw.name);
          P.update(id, { url: run.url });
          return json(res, { runId: run.id });
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
      if (sub === '/rescan' && M === 'POST') { const r2 = await startScan(run.url); return json(res, { id: r2.id }); }
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
  });
});
