// Projects and templates. A project is a client site plus its own copy of a checklist template.
// Everything is stored as JSON in the data folder: templates.json, and projects/<id>/project.json (+ files/ for proof).
const fs = require('fs'), path = require('path');
const { defaults, SEED } = require('./templates-default');
const launch = require('./launch');
const R = require('./redirects');

const TOOLS = {
  scan: { name: 'Site scan', ready: true },
  headings: { name: 'Heading plan', ready: true },
  seo: { name: 'SEO plan', ready: true },
  launch: { name: 'Launch check', ready: true },
  redirects: { name: 'Redirect map', ready: true },
};

module.exports = function projects({ DATA, readJson, writeJson, allRuns, hostOf }) {
  const PDIR = path.join(DATA, 'projects');
  const TFILE = path.join(DATA, 'templates.json');
  fs.mkdirSync(PDIR, { recursive: true });
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // ---------- dates (plain YYYY-MM-DD, local time) ----------
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => iso(new Date());
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
  const daysBetween = (a, b) => { const [y1, m1, d1] = a.split('-').map(Number), [y2, m2, d2] = b.split('-').map(Number); return Math.round((new Date(y2, m2 - 1, d2) - new Date(y1, m1 - 1, d1)) / 864e5); };
  // Dates counted from kickoff move with p.slip (days the plan has been shifted); kickoff itself stays the real date.
  // Template offsets assume 10 weeks from kickoff to launch. Projects made since v0.8 (dueMode 'span') stretch or
  // shrink every date before launch to fit their own span, so phases keep their order on a 6-week job too.
  // Dates after launch ("days 1 to 3") keep their exact days.
  const REF_SPAN = 70;
  const dueOf = (rule, p) => {
    if (!rule) return null;
    const k = p.kickoff ? addDays(p.kickoff, p.slip || 0) : null;
    const scale = p.dueMode === 'span' && k && p.launch ? Math.max(0.2, daysBetween(k, p.launch) / REF_SPAN) : 1;
    const d = rule.days || 0;
    if (rule.from === 'launch') return p.launch ? addDays(p.launch, d < 0 ? Math.round(d * scale) : d) : null;
    return k ? addDays(k, Math.round(d * scale)) : null;
  };

  // ---------- templates ----------
  function allTemplates() {
    let t = readJson(TFILE, null);
    if (!t) { t = defaults(); writeJson(TFILE, t); }
    // A newer built-in checklist replaces the saved one, unless someone has edited it (its version went up).
    const built = defaults().filter(x => x.kind === 'checklist');
    let changed = false;
    for (const b of built) {
      const i = t.findIndex(x => x.id === b.id);
      if (i >= 0 && (t[i].seed || 1) < SEED) { t[i] = (t[i].version || 1) === 1 ? b : { ...t[i], seed: SEED, name: t[i].name === 'Website project' && b.id === 'website' ? b.name : t[i].name }; changed = true; }
    }
    // Installs from before v0.8 had only the full agency checklist. The shorter one arrives once, at the top.
    const full = t.find(x => x.id === 'website');
    if (full && !t.some(x => x.id === 'website-lean') && !full.leanOffered) { t.unshift(built.find(x => x.id === 'website-lean')); changed = true; }
    if (full && !full.leanOffered) { full.leanOffered = true; changed = true; }
    if (changed) writeJson(TFILE, t);
    return t;
  }
  const saveTemplates = t => writeJson(TFILE, t);
  const countItems = t => t.phases.reduce((n, ph) => n + ph.groups.reduce((m, g) => m + g.items.length, 0) + ph.handoff.items.length, 0);
  function templateList() {
    const used = {};
    for (const p of listRaw()) used[p.templateId] = (used[p.templateId] || 0) + 1;
    return allTemplates().map(t => ({
      id: t.id, kind: t.kind, name: t.name, updated: t.updated, used: used[t.id] || 0,
      ...(t.kind === 'checklist' ? { items: countItems(t), phases: t.phases.length } : { subject: t.subject || '', preview: t.body.slice(0, 160), use: t.use || [] }),
    }));
  }
  const getTemplate = id => allTemplates().find(t => t.id === id) || null;
  function saveTemplate(id, doc) {
    const all = allTemplates(), i = all.findIndex(t => t.id === id);
    if (i < 0) throw new Error('That template doesn’t exist any more.');
    const kind = all[i].kind !== 'checklist' && ['message', 'email'].includes(doc.kind) ? doc.kind : all[i].kind;
    const t = { ...all[i], ...doc, id, kind, updated: Date.now() };
    if (t.kind === 'checklist') t.version = (all[i].version || 1) + 1;
    // Only one message template feeds the Client tab's request message.
    if ((t.use || []).includes('client-request')) for (const o of all) if (o.id !== id && o.use) o.use = o.use.filter(u => u !== 'client-request');
    all[i] = t; saveTemplates(all);
    return t;
  }
  function createTemplate({ kind, name, copyFrom }) {
    const all = allTemplates();
    const src = copyFrom && all.find(t => t.id === copyFrom);
    let t;
    if (src) t = { ...JSON.parse(JSON.stringify(src)), name: name || src.name + ' copy', use: [] };
    else if (kind === 'checklist') t = { kind, name: name || 'New checklist', version: 1, parts: [], phases: [{ id: 'p1', name: 'Phase 1', due: null, groups: [{ id: 'g1', name: 'Our process', items: [] }], handoff: { title: 'Sign-off', needs: 'client', items: [] } }] };
    else t = { kind: kind === 'email' ? 'email' : 'message', name: name || (kind === 'email' ? 'New email' : 'New message'), subject: '', body: 'Hi {client first name},\n\n\n\nThanks!\n{your name}', use: [] };
    t.id = newId(); t.updated = Date.now();
    all.push(t); saveTemplates(all);
    return t;
  }
  function removeTemplate(id) { saveTemplates(allTemplates().filter(t => t.id !== id)); }

  // ---------- projects: storage ----------
  const pdir = id => path.join(PDIR, id);
  const readRaw = id => (/^[a-z0-9]+$/.test(id) && readJson(path.join(pdir(id), 'project.json'))) || null;
  const writeRaw = p => { p.updated = Date.now(); fs.mkdirSync(pdir(p.id), { recursive: true }); writeJson(path.join(pdir(p.id), 'project.json'), p); };
  const listRaw = () => fs.readdirSync(PDIR).map(readRaw).filter(Boolean);

  // ---------- a project's websites ----------
  // Three addresses, because a redesign has three sites: the old one being replaced, the new one on staging, and the
  // live domain it launches on. Scans say which one they read; the launch check and the redirect test only count as
  // "live" against the live domain.
  const normUrl = u => { u = String(u || '').trim(); if (!u) return null; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { const x = new URL(u); if (!x.hostname.includes('.')) return null; return x.origin + '/'; } catch { return null; } };
  function sitesOf(p) {
    if (p.sites) return { old: p.sites.old || null, staging: p.sites.staging || null, live: p.sites.live || null };
    // Projects from before there were three fields had one address. Guess which it was.
    const u = normUrl(p.url);
    if (!u) return { old: null, staging: null, live: null };
    if (/\.webflow\.io$/i.test(hostOf(u))) return { old: null, staging: u, live: null };
    if ((p.parts || []).includes('existing') && p.kind !== 'audit') return { old: u, staging: null, live: null };
    return { old: null, staging: null, live: u };
  }
  function setSites(p, s) {
    const cur = sitesOf(p);
    p.sites = { ...cur };
    for (const k of ['old', 'staging', 'live']) if (k in s) p.sites[k] = normUrl(s[k]);
    const prim = p.sites.live || p.sites.staging || p.sites.old;
    p.url = prim || null; p.host = prim ? hostOf(prim) : null;
  }
  const liveHostOf = p => { const l = sitesOf(p).live; return l ? hostOf(l) : null; };
  // Scans and plans belong to a project; older ones were matched by address and are claimed at startup (server.js).
  const runsOf = p => allRuns().filter(r => r.projectId === p.id).sort((a, b) => b.created - a.created);
  const siteOfRun = (p, r) => r.site || (() => { const s = sitesOf(p), h = hostOf(r.origin || r.url); return Object.keys(s).find(k => s[k] && hostOf(s[k]) === h) || null; })();

  function create(b) {
    const audit = b.kind === 'audit';
    const t = audit ? null : getTemplate(b.templateId || 'website-lean');
    if (!audit && (!t || t.kind !== 'checklist')) throw new Error('Pick a checklist template.');
    const parts = Array.isArray(b.parts) ? b.parts : [];
    const keep = it => !it.part || parts.includes(it.part);
    const sites = b.sites || (b.url ? (parts.includes('existing') ? { old: b.url } : { live: b.url }) : {});
    const first = normUrl(sites.old || sites.live || sites.staging);
    const p = {
      id: newId(), kind: audit ? 'audit' : 'project', name: String(b.name || '').trim() || (first ? hostOf(first) : 'New project'),
      created: Date.now(), kickoff: audit ? null : b.kickoff || null, launch: audit ? null : b.launch || null,
      client: { name: String(b.clientName || '').trim() },
      templateId: t ? t.id : null, templateName: t ? t.name : null, templateVersion: t ? t.version || 1 : null, parts: audit ? [] : parts,
      // Due dates stretch or shrink with the time between kickoff and launch (see dueOf).
      dueMode: 'span',
      phases: t ? t.phases.map(ph => ({ ...ph, groups: ph.groups.map(g => ({ ...g, items: g.items.filter(keep) })).filter(g => g.items.length), handoff: { ...ph.handoff, items: ph.handoff.items.filter(keep) } })) : [],
      state: {}, signoffs: {},
    };
    setSites(p, sites);
    // A project that's already underway starts at a later phase: the ones before it count as finished.
    const startIdx = b.startAt ? p.phases.findIndex(ph => ph.id === b.startAt) : -1;
    for (let i = 0; i < startIdx; i++) {
      const ph = p.phases[i], at = Date.now();
      p.signoffs[ph.id] = { by: '', date: today(), note: 'Finished before the project was added to Groundwork', link: '', file: null, at, before: true };
      for (const it of [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]) p.state[it.id] = { s: 'done', at, hist: [{ at, what: 'Done before the project was added to Groundwork' }] };
    }
    writeRaw(p);
    return p;
  }
  // ---------- template changes for a running project ----------
  // Items match by id when the id and phase agree (ids are positions in the template), otherwise by title.
  // The project's own state (done, notes, dates) is never touched; only the checklist's wording and rules.
  const FIELDS = ['title', 'done', 'who', 'due', 'tool', 'check', 'part'];
  const normT = t => String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function templateDiff(p, t) {
    const ours = [];
    p.phases.forEach(ph => { ph.groups.forEach(g => g.items.forEach(it => ours.push({ it, ph, g }))); ph.handoff.items.forEach(it => ours.push({ it, ph, g: null })); });
    const byId = new Map(ours.map(o => [o.it.id, o])), byTitle = new Map(ours.map(o => [normT(o.it.title), o]));
    const keep = it => !it.part || (p.parts || []).includes(it.part);
    const matched = new Set(), added = [], changed = [];
    t.phases.forEach(ph => {
      const each = (it, g) => {
        if (!keep(it)) return;
        let o = byId.get(it.id);
        if (o && !(o.ph.id === ph.id || normT(o.it.title) === normT(it.title))) o = null;
        if (!o || matched.has(o.it.id)) o = byTitle.get(normT(it.title)) || null;
        if (!o || matched.has(o.it.id)) { added.push({ it, ph, g }); return; }
        matched.add(o.it.id);
        const diff = FIELDS.filter(f => JSON.stringify(o.it[f] ?? null) !== JSON.stringify(it[f] ?? null));
        if (diff.length) changed.push({ o, it, fields: diff });
      };
      ph.groups.forEach(g => g.items.forEach(it => each(it, g)));
      ph.handoff.items.forEach(it => each(it, null));
    });
    const removed = ours.filter(o => !matched.has(o.it.id));
    return { added, changed, removed };
  }
  function templateUpdate(id, b = {}) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const t = getTemplate(p.templateId);
    if (!t || t.kind !== 'checklist') throw new Error('The project’s template doesn’t exist any more.');
    const d = templateDiff(p, t);
    const summary = {
      template: t.name, version: t.version || 1, projectVersion: p.templateVersion || 1,
      added: d.added.map(x => ({ title: x.it.title, phase: x.ph.name })),
      changed: d.changed.map(x => ({ title: x.it.title, was: x.o.it.title, phase: x.o.ph.name, fields: x.fields })),
      removed: d.removed.map(x => ({ id: x.it.id, title: x.it.title, phase: x.ph.name, touched: !!p.state[x.it.id] })),
    };
    if (b.dryRun) return summary;
    for (const x of d.changed) for (const f of FIELDS) { if (x.it[f] === undefined) delete x.o.it[f]; else x.o.it[f] = x.it[f]; }
    for (const x of d.added) {
      let ph = p.phases.find(q => q.id === x.ph.id);
      if (!ph) { ph = { ...x.ph, groups: [], handoff: { ...x.ph.handoff, items: [] } }; const at = t.phases.findIndex(q => q.id === x.ph.id); p.phases.splice(Math.min(at, p.phases.length), 0, ph); }
      const item = { ...x.it, id: p.phases.some(q => [...q.groups.flatMap(g => g.items), ...q.handoff.items].some(i => i.id === x.it.id)) ? x.it.id + '-' + newId().slice(-4) : x.it.id };
      if (!x.g) { ph.handoff.items.push(item); continue; }
      let g = ph.groups.find(q => q.id === x.g.id) || ph.groups.find(q => normT(q.name) === normT(x.g.name));
      if (!g) { g = { id: x.g.id, name: x.g.name, items: [] }; ph.groups.push(g); }
      g.items.push(item);
    }
    if (b.removeUntouched) for (const x of d.removed) if (!p.state[x.it.id]) {
      if (x.g) x.g.items = x.g.items.filter(i => i.id !== x.it.id); else x.ph.handoff.items = x.ph.handoff.items.filter(i => i.id !== x.it.id);
    }
    for (const ph of p.phases) ph.groups = ph.groups.filter(g => g.items.length);
    p.templateVersion = t.version || 1; p.templateName = t.name;
    writeRaw(p);
    return summary;
  }

  function update(id, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    for (const k of ['name', 'kickoff', 'launch']) if (k in b) p[k] = b[k] || (k === 'name' ? p.name : null);
    if ('clientName' in b) p.client = { ...(p.client || {}), name: String(b.clientName || '').trim() };
    if (b.sites) setSites(p, b.sites);
    else if ('url' in b && b.url) setSites(p, { live: b.url });
    writeRaw(p); return p;
  }
  // Each item keeps a short history of what changed, for the item panel's Activity list.
  const note = (s, what) => { s.hist = [{ at: Date.now(), what }, ...(s.hist || [])].slice(0, 30); };
  function setItem(id, itemId, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const s = { ...(p.state[itemId] || {}) };
    if ('status' in b && b.status !== (s.s || 'todo')) { s.s = b.status; s.at = Date.now(); note(s, b.status === 'done' ? 'Marked done' : b.status === 'na' ? 'Marked not needed' : 'Opened again'); }
    if ('note' in b && String(b.note || '') !== (s.note || '')) { s.note = String(b.note || '').slice(0, 4000); note(s, s.note ? 'Notes edited' : 'Notes cleared'); }
    if ('link' in b && String(b.link || '') !== (s.link || '')) { s.link = String(b.link || '').slice(0, 1000); note(s, s.link ? 'Link added' : 'Link removed'); }
    if ('asked' in b) { s.asked = b.asked ? (typeof b.asked === 'number' ? b.asked : Date.now()) : null; note(s, s.asked ? 'Asked the client' : 'Marked as not asked'); }
    if ('nudged' in b) { s.nudged = b.nudged ? Date.now() : null; if (s.nudged) note(s, 'Nudged the client'); }
    if ('due' in b && (b.due || null) !== (s.due || null)) { s.due = b.due || null; note(s, s.due ? `Due date set to ${s.due}` : 'Due date back to the plan'); }
    p.state[itemId] = s; writeRaw(p);
  }
  function askItems(id, itemIds, nudge) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    for (const i of itemIds) {
      const s = { ...(p.state[i] || {}) };
      if (nudge) { s.nudged = Date.now(); s.asked = s.asked || s.nudged; note(s, 'Nudged the client'); }
      else if (!s.asked) { s.asked = Date.now(); note(s, 'Asked the client'); }
      p.state[i] = s;
    }
    writeRaw(p);
  }
  function signoff(id, phaseId, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const pi = p.phases.findIndex(ph => ph.id === phaseId); if (pi < 0) throw new Error('Unknown phase.');
    let file = null;
    if (b.file && b.file.data) {
      const name = String(b.file.name || 'proof').replace(/[^\w.\- ]+/g, '_').slice(-80);
      const stored = Date.now().toString(36) + '-' + name;
      fs.mkdirSync(path.join(pdir(id), 'files'), { recursive: true });
      fs.writeFileSync(path.join(pdir(id), 'files', stored), Buffer.from(String(b.file.data), 'base64'));
      file = { name, stored };
    }
    for (const i of b.skip || []) p.state[i] = { ...(p.state[i] || {}), s: 'na', at: Date.now() };
    const next = p.phases[pi + 1];
    for (const i of b.carry || []) if (next) p.state[i] = { ...(p.state[i] || {}), move: next.id };
    p.signoffs[phaseId] = { by: String(b.by || '').trim(), date: b.date || today(), note: String(b.note || '').trim(), link: String(b.link || '').trim(), file, at: Date.now() };
    writeRaw(p);
  }
  function unsign(id, phaseId) { const p = readRaw(id); if (!p) return; delete p.signoffs[phaseId]; writeRaw(p); }
  function remove(id) { if (/^[a-z0-9]+$/.test(id)) fs.rmSync(pdir(id), { recursive: true, force: true }); }
  const filePath = (id, name) => /^[a-z0-9]+$/.test(id) && !/[\/\\]/.test(name) ? path.join(pdir(id), 'files', name) : null;

  // ---------- launch checks ----------
  // Reports live in projects/<id>/launch/<checkId>.json; the project keeps a short summary of each.
  const jobs = {}; // checkId -> live state while running
  function startLaunch(id, url) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const sp = sitesOf(p), launched = p.launch && p.launch <= today();
    url = String(url || (launched ? sp.live || sp.staging : sp.staging || sp.live) || sp.old || '').trim();
    if (!url) throw new Error('Add the site’s address first.');
    if (Object.values(jobs).some(j => j.projectId === id && j.status === 'running')) throw new Error('A launch check is already running for this project.');
    const checkId = newId();
    const job = jobs[checkId] = { id: checkId, projectId: id, url, started: Date.now(), status: 'running', progress: { step: 'site', done: 0, total: 0 } };
    const signal = { aborted: false };
    Object.defineProperty(job, 'signal', { value: signal, enumerable: false });
    launch.run({ url, liveHost: liveHostOf(p), signal }, pr => { job.progress = pr; })
      .then(report => {
        // Compare with the last finished check of the same site: new issues, and ones fixed since.
        const q0 = readRaw(id), prevSum = q0 && (q0.checks || []).find(c => c.status === 'done');
        const prev = prevSum && readJson(path.join(pdir(id), 'launch', prevSum.id + '.json'), null);
        if (prev && prev.host === report.host) {
          const keys = r => new Set((r.checks || []).flatMap(c => c.issues.filter(i => !i.soft).map(i => c.id + '|' + i.text)));
          const before = keys(prev), now = keys(report);
          for (const c of report.checks) for (const i of c.issues) if (!i.soft && !before.has(c.id + '|' + i.text)) i.isNew = true;
          report.previous = { id: prev.id, at: prev.started };
          report.fixed = (prev.checks || []).flatMap(c => c.issues.filter(i => !i.soft && !now.has(c.id + '|' + i.text)).map(i => ({ check: c.id, text: i.text, pages: i.pages.length })));
        }
        Object.assign(job, report, { status: 'done', ended: Date.now() });
      })
      .catch(e => { Object.assign(job, { status: signal.aborted ? 'cancelled' : 'failed', error: signal.aborted ? 'Stopped' : String(e.message || e).split('\n')[0], ended: Date.now() }); })
      .finally(() => {
        fs.mkdirSync(path.join(pdir(id), 'launch'), { recursive: true });
        writeJson(path.join(pdir(id), 'launch', checkId + '.json'), job);
        const q = readRaw(id);
        if (q) {
          const summary = { id: checkId, at: job.started, url: job.url, status: job.status, staging: !!job.staging, pages: job.pagesChecked || 0, checks: Object.fromEntries((job.checks || []).map(c => [c.id, { ok: c.ok, count: c.issues.filter(i => !i.soft).length }])) };
          q.checks = [summary, ...(q.checks || [])].slice(0, 20); writeRaw(q);
        }
        setTimeout(() => { delete jobs[checkId]; }, 60e3);
      });
    return checkId;
  }
  const getLaunch = (id, checkId) => (jobs[checkId] && jobs[checkId].projectId === id ? jobs[checkId] : /^[a-z0-9]+$/.test(checkId) ? readJson(path.join(pdir(id), 'launch', checkId + '.json'), null) : null);
  const launchRunning = () => Object.values(jobs).filter(j => j.status === 'running').length;
  const cancelLaunch = (id, checkId) => { const j = jobs[checkId]; if (j && j.projectId === id && j.status === 'running') j.signal.aborted = true; };

  // ---------- redirect map ----------
  // projects/<id>/redirects.json: the old site's URLs matched to the new site's pages, your changes, and the last test.
  const rfile = id => path.join(pdir(id), 'redirects.json');
  const readMap = id => readJson(rfile(id), null);
  const rjobs = {}; // projectId -> { kind: 'build' | 'test', progress, started }
  /** The current site's scan: the URL list the redirect map starts from. */
  function oldScan(p) {
    const runs = runsOf(p).filter(r => siteOfRun(p, r) === 'old' || !sitesOf(p).old);
    // Once a map exists, stay with the scan it was built from: after launch, a new scan is of the new site.
    const m = readMap(p.id), was = m && runs.find(r => r.id === m.oldRunId);
    return was || runs.find(r => (r.pages || []).length && r.status !== 'scanning' && r.status !== 'scan_failed') || null;
  }
  // URL changes the SEO plan made (with your edits), keyed by lowercase old path.
  function seoMoves(run) {
    const res = readJson(path.join(run.dir, 'seo', 'result.json'), null); if (!res) return {};
    const edits = (readJson(path.join(run.dir, 'seo', 'state.json'), {}) || {}).edits || {};
    const out = {};
    for (const pg of res.pages || []) {
      if (!pg.planned || pg.pattern) continue;
      const to = R.normPath(edits[pg.id + '|slug'] ?? pg.fields.slug.to), from = R.normPath(pg.fields.slug.cur);
      if (to && from && R.key(to) !== R.key(from)) out[R.key(from)] = to;
    }
    return out;
  }
  function startRedirectBuild(id, newUrl) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    if (rjobs[id]) throw new Error('The redirect map is busy. Wait for it to finish.');
    const run = oldScan(p);
    if (!run) throw new Error('Scan the current site first. The map starts from its list of URLs.');
    newUrl = String(newUrl || '').trim(); if (!/^https?:\/\//i.test(newUrl)) newUrl = 'https://' + newUrl;
    try { new URL(newUrl); } catch { throw new Error('That doesn’t look like a web address.'); }
    const job = rjobs[id] = { kind: 'build', started: Date.now(), progress: { step: 'old', done: 0, total: 0 }, signal: { aborted: false } };
    const prev = readMap(id);
    R.build({ oldOrigin: run.origin, oldPages: run.pages.map(x => ({ path: x.path, title: x.title || (x.name && x.name !== x.path ? x.name : '') })), newUrl, moves: seoMoves(run), signal: job.signal }, pr => { job.progress = pr; })
      .then(res => {
        // Keep your choices from the last map for URLs that are still there.
        const mine = new Map((prev && prev.rows || []).filter(r => r.how === 'manual' || r.checked).map(r => [R.key(r.from), r]));
        const rows = res.rows.map(r => { const m = mine.get(R.key(r.from)); return m ? { ...r, to: m.to, how: m.how, sure: true, checked: m.checked } : r; });
        writeJson(rfile(id), { built: Date.now(), oldHost: hostOf(run.origin || run.url), oldRunId: run.id, oldLive: res.oldLive, newUrl, newPages: res.newPages, rows, test: prev && prev.test || null, tests: prev && prev.tests || [] });
      })
      .catch(e => { if (!job.signal.aborted) job.error = String(e.message || e).split('\n')[0]; })
      .finally(() => { const err = job.error; delete rjobs[id]; if (err) rjobs[id + ':error'] = { error: err, at: Date.now() }; else delete rjobs[id + ':error']; });
  }
  function startRedirectTest(id, url) {
    const map = readMap(id); if (!map) throw new Error('Build the redirect map first.');
    if (rjobs[id]) throw new Error('The redirect map is busy. Wait for it to finish.');
    url = String(url || '').trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    const origin = new URL(url).origin;
    const job = rjobs[id] = { kind: 'test', started: Date.now(), progress: { step: 'test', done: 0, total: map.rows.length }, signal: { aborted: false } };
    R.test(origin, map.rows, n => { job.progress.done = n; }, job.signal)
      .then(results => {
        const m = readMap(id) || map;
        const bad = Object.values(results).filter(x => !x.ok).length;
        const p = readRaw(id);
        // Only a test of the live domain counts: staging can't prove the live redirects work.
        m.test = { at: Date.now(), url: origin, live: !!p && !!liveHostOf(p) && hostOf(origin) === liveHostOf(p), total: map.rows.length, ok: map.rows.length - bad, results };
        m.tests = [{ at: m.test.at, url: origin, live: m.test.live, total: m.test.total, ok: m.test.ok }, ...(m.tests || [])].slice(0, 10);
        writeJson(rfile(id), m);
      })
      .catch(e => { if (!job.signal.aborted) job.error = String(e.message || e).split('\n')[0]; })
      .finally(() => { const err = job.error; delete rjobs[id]; if (err) rjobs[id + ':error'] = { error: err, at: Date.now() }; else delete rjobs[id + ':error']; });
  }
  /** Your changes: a new target for an old URL, or "looks right" on a guess. */
  function setRedirects(id, b) {
    const m = readMap(id); if (!m) throw new Error('Build the redirect map first.');
    const by = new Map(m.rows.map(r => [r.from, r]));
    for (const [from, to] of Object.entries(b.to || {})) { const r = by.get(from); if (!r) continue; r.to = R.normPath(to) || '/'; r.how = 'manual'; r.sure = true; r.checked = true; }
    for (const [from, v] of Object.entries(b.checked || {})) { const r = by.get(from); if (!r) continue; r.checked = !!v; r.sure = !!v || ['same', 'seo', 'slug', 'manual'].includes(r.how) || (r.how === 'similar' && r.score >= 80); }
    writeJson(rfile(id), m);
    return m;
  }
  const redirectState = id => {
    const m = readMap(id), job = rjobs[id], err = rjobs[id + ':error'];
    return { map: m, job: job ? { kind: job.kind, progress: job.progress, started: job.started } : null, error: err && Date.now() - err.at < 10 * 60e3 ? err.error : null };
  };
  const redirectsRunning = () => Object.keys(rjobs).filter(k => !k.includes(':')).length;
  const cancelRedirects = id => { if (rjobs[id] && rjobs[id].signal) rjobs[id].signal.aborted = true; };
  function redirectSummary(p) {
    const m = readMap(p.id); if (!m) return null;
    const moves = m.rows.filter(r => R.key(r.to) !== R.key(r.from));
    return {
      built: m.built, total: m.rows.length, redirects: moves.length, same: m.rows.length - moves.length, review: m.rows.filter(r => !r.sure).length,
      test: m.test ? { at: m.test.at, url: m.test.url, live: m.test.live, total: m.test.total, ok: m.test.ok } : null,
    };
  }

  // ---------- projects: what the app shows ----------
  function toolState(p) {
    const runs = runsOf(p);
    // "Crawl the current site" is about the old site; a project without one counts any scan.
    const scanned = runs.find(r => (r.pages || []).length && !['scanning', 'scan_failed'].includes(r.status) && (!sitesOf(p).old || siteOfRun(p, r) === 'old'));
    const plan = runs.find(r => ['done', 'partial'].includes(r.status));
    const seo = runs.find(r => r.seo && ['done', 'partial'].includes(r.seo.status));
    const prog = plan && plan.progress ? plan.progress.now || plan.progress.all || null : null;
    return {
      runs: runs.map(r => ({ id: r.id, site: siteOfRun(p, r), status: r.status, created: r.created, pages: (r.pages || []).length, output: r.settings && r.settings.output || null, progress: r.progress || null, hasIcon: !!r.favicon, seo: r.seo ? { status: r.seo.status, progress: r.seo.progress || null } : null, error: (r.status === 'scan_failed' ? r.scan && r.scan.error : r.status === 'failed' ? r.error : null) || null, url: r.url })),
      scan: scanned ? { runId: scanned.id, urls: scanned.pages.length, at: scanned.created } : null,
      plan: plan ? { runId: plan.id, done: prog ? prog.done : 0, total: prog ? prog.tasks : 0, all: plan.progress && plan.progress.all || null, at: plan.created, output: plan.settings && plan.settings.output } : null,
      iconRun: (runs.find(r => r.favicon) || runs[0] || {}).id || null,
      seo: seo ? { runId: seo.id, done: (seo.seo.progress || {}).done || 0, total: (seo.seo.progress || {}).tasks || 0, pages: seo.seo.selected.length, at: seo.seo.job.ended || seo.updated } : null,
      seoRunning: (runs.find(r => r.seo && r.seo.status === 'running') || {}).id || null,
      launch: (p.checks || []).find(c => c.status === 'done') || null,
      launchRunning: Object.values(jobs).find(j => j.projectId === p.id && j.status === 'running') ? { id: Object.values(jobs).find(j => j.projectId === p.id && j.status === 'running').id } : null,
      launchHistory: (p.checks || []).slice(0, 10),
      redirects: redirectSummary(p),
      redirectsRunning: rjobs[p.id] ? rjobs[p.id].kind : null,
      oldScan: (() => { const r = oldScan(p); return r ? { runId: r.id, urls: r.pages.length, at: r.crawledAt || r.created } : null; })(),
    };
  }

  function view(p) {
    const tools = toolState(p), now = today();
    const moved = {}; // items carried into a later phase
    for (const [id, s] of Object.entries(p.state)) if (s.move) moved[id] = s.move;
    const signedAll = p.phases.map(ph => p.signoffs[ph.id]);
    const currentIdx = signedAll.findIndex(s => !s);
    const itemView = (it, ph) => {
      const s = p.state[it.id] || {};
      let status = s.s || 'todo', auto = false, toolInfo = null;
      const check = it.tool === 'launch' ? it.check || launch.inferCheck(it.title) : it.tool === 'seo' ? it.check || (/per page|plan/i.test(it.title) ? 'plan' : 'live') : it.tool === 'redirects' ? it.check || R.inferCheck(it.title) : null;
      if (it.tool && TOOLS[it.tool] && (it.tool !== 'launch' || check)) {
        toolInfo = { id: it.tool, ...TOOLS[it.tool] };
        if (it.tool === 'scan' && tools.scan) { toolInfo.text = `Done by the scan, ${tools.scan.urls} URLs saved`; toolInfo.runId = tools.scan.runId; if (!s.s) { status = 'done'; auto = true; } }
        if (it.tool === 'launch') {
          const last = tools.launch;
          toolInfo.check = check;
          toolInfo.checkName = launch.CHECKS[check];
          if (tools.launchRunning) toolInfo.text = 'Checking now';
          else if (last && last.checks[check]) {
            const c = last.checks[check], when = new Date(last.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            toolInfo.runId = last.id;
            const later = last.staging && ['indexing', 'https'].includes(check);
            toolInfo.text = later ? 'Checked after launch, on the live domain' : c.ok ? `Passed in the ${when} check${last.staging ? ' on staging' : ''}` : `${c.count} ${c.count === 1 ? 'issue' : 'issues'} in the ${when} check`;
            toolInfo.issues = c.ok || later ? 0 : c.count;
            // Staging is normally hidden from Google and served by Webflow, so indexing and redirects only count on the live domain.
            if (!s.s && c.ok && !later) { status = 'done'; auto = true; }
          } else toolInfo.text = 'Not run yet';
        }
        if (it.tool === 'seo') {
          toolInfo.check = check;
          if (tools.seoRunning) toolInfo.text = 'Planning now';
          else if (!tools.seo) toolInfo.text = 'Not planned yet';
          else if (check === 'plan') {
            // The plan itself is the deliverable: ready means done.
            toolInfo.runId = tools.seo.runId;
            toolInfo.text = `Planned for ${tools.seo.pages} ${tools.seo.pages === 1 ? 'page' : 'pages'}, ${tools.seo.total} ${tools.seo.total === 1 ? 'change' : 'changes'}`;
            if (!s.s) { status = 'done'; auto = true; }
          } else {
            // Applying it covers titles, descriptions and slugs; the item also asks for OG images, schema and more, so you tick it.
            toolInfo.runId = tools.seo.runId;
            toolInfo.progress = { done: tools.seo.done, total: tools.seo.total };
            toolInfo.text = tools.seo.total ? `${tools.seo.done} of ${tools.seo.total} SEO changes done` : 'Nothing to change';
          }
        }
        if (it.tool === 'redirects') {
          const rd = tools.redirects;
          toolInfo.check = check;
          if (tools.redirectsRunning) toolInfo.text = tools.redirectsRunning === 'test' ? 'Testing now' : 'Building the map now';
          else if (!rd) toolInfo.text = 'No map yet';
          else if (check === 'map') {
            toolInfo.text = rd.review ? `${rd.total} old URLs mapped, ${rd.review} to look at` : `${rd.total} old URLs mapped, ${rd.redirects} ${rd.redirects === 1 ? 'redirect' : 'redirects'}`;
            toolInfo.issues = rd.review;
            if (!s.s && !rd.review) { status = 'done'; auto = true; }
          } else {
            // Redirects only count once they work on the live domain; "after" also needs a test after launch day.
            const t = rd.test, when = t && new Date(t.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const afterLaunch = t && (!p.launch || new Date(t.at).toISOString().slice(0, 10) >= p.launch);
            if (!t) toolInfo.text = 'Not tested yet';
            else toolInfo.text = t.ok === t.total ? `All ${t.total} worked in the ${when} test${t.live ? '' : ' on staging'}` : `${t.total - t.ok} of ${t.total} failed in the ${when} test`;
            if (t && t.ok < t.total) toolInfo.issues = t.total - t.ok;
            if (!s.s && t && t.live && t.ok === t.total && (check === 'live' || afterLaunch)) { status = 'done'; auto = true; }
          }
        }
        if (it.tool === 'headings' && tools.plan) {
          toolInfo.progress = { done: tools.plan.done, total: tools.plan.total }; toolInfo.runId = tools.plan.runId;
          toolInfo.text = tools.plan.total ? `${tools.plan.done} of ${tools.plan.total} tag fixes done` : 'Plan ready';
          if (!s.s && tools.plan.total && tools.plan.done >= tools.plan.total) { status = 'done'; auto = true; }
        }
      }
      const due = s.due || dueOf(it.due || ph.due, p);
      return { id: it.id, title: it.title, check, doneMeans: it.done || '', who: it.who, part: it.part || null, tool: it.tool || null, toolInfo, due, status, auto, at: s.at || null, note: s.note || '', link: s.link || '', asked: s.asked || null, nudged: s.nudged || null, hist: s.hist || [], manualDue: !!s.due, phaseId: ph.id, phaseName: ph.name, late: status === 'todo' && !!due && due < now };
    };
    const phases = p.phases.map((ph, i) => {
      const groups = ph.groups.map(g => ({ id: g.id, name: g.name, items: g.items.filter(it => !moved[it.id]).map(it => itemView(it, ph)) }));
      const handoff = { title: ph.handoff.title, needs: ph.handoff.needs, items: ph.handoff.items.filter(it => !moved[it.id]).map(it => itemView(it, ph)) };
      // items carried here from earlier phases
      const carried = [];
      p.phases.forEach(src => [...src.groups.flatMap(g => g.items), ...src.handoff.items].forEach(it => { if (moved[it.id] === ph.id) carried.push({ ...itemView(it, src), phaseId: ph.id, carriedFrom: src.name }); }));
      if (carried.length) groups.unshift({ id: ph.id + '-carried', name: 'Carried over', items: carried });
      const all = [...groups.flatMap(g => g.items), ...handoff.items];
      const done = all.filter(x => x.status !== 'todo').length;
      const signed = p.signoffs[ph.id] || null;
      const state = signed ? 'signed' : i === currentIdx ? 'current' : 'upcoming';
      return { id: ph.id, name: ph.name, index: i, due: dueOf(ph.due, p), groups, handoff, signoff: signed, state, done, total: all.length, ready: !signed && all.length > 0 && done === all.length };
    });
    const items = phases.flatMap(ph => [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]);
    const clientOpen = items.filter(x => x.who === 'client' && x.status === 'todo');
    const byDue = (a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1;
    // One meaning of late everywhere: the client's due date has passed, whether or not they were asked yet.
    const withAsk = x => ({ ...x, askBy: x.due ? addDays(x.due, -7) : null });
    const client = {
      late: clientOpen.filter(x => x.late).sort(byDue).map(withAsk),
      soon: clientOpen.filter(x => x.asked && !x.late).sort(byDue),
      notAsked: clientOpen.filter(x => !x.asked && !x.late).sort(byDue).map(withAsk),
      received: items.filter(x => x.who === 'client' && x.status === 'done').length,
    };
    const cur = phases[currentIdx] || null;
    // How far behind the plan is: the oldest late item in the current phase. Items left open in a phase that's
    // already signed off stay late, but they don't mean the plan slipped.
    const lateItems = items.filter(x => x.late);
    const lateness = list => list.reduce((m, x) => Math.max(m, daysBetween(x.due, now)), 0);
    const behind = { items: lateItems.length, days: lateness(cur ? lateItems.filter(x => x.phaseId === cur.id) : lateItems) };
    return {
      id: p.id, kind: p.kind || 'project', name: p.name, url: p.url, host: p.host, sites: sitesOf(p), created: p.created, updated: p.updated, kickoff: p.kickoff, launch: p.launch, slip: p.slip || 0, behind,
      templateChanged: (() => { const t = p.templateId && getTemplate(p.templateId); return !!t && (t.version || 1) > (p.templateVersion || 1); })(),
      clientName: (p.client && p.client.name) || '', templateId: p.templateId, templateName: ((p.templateId && getTemplate(p.templateId)) || {}).name || p.templateName, parts: p.parts,
      phases, current: cur ? cur.id : null, client, tools,
    };
  }

  function summary(v) {
    const cur = v.phases.find(ph => ph.id === v.current) || null;
    return {
      id: v.id, kind: v.kind, name: v.name, host: v.host, url: v.url, launch: v.launch, iconRun: v.tools.iconRun,
      current: cur ? { index: cur.index, id: cur.id, name: cur.name, done: cur.done, total: cur.total, ready: cur.ready, needs: cur.handoff.needs, handoffTitle: cur.handoff.title } : null,
      phases: v.phases.map(ph => ({ state: ph.state, done: ph.done, total: ph.total })),
      clientOpen: v.client.late.length + v.client.soon.length, clientLate: v.client.late.length, behind: v.behind,
      // What's running for this project right now, for the sidebar.
      running: v.tools.launchRunning ? 'Launch check' : v.tools.seoRunning ? 'SEO plan' : v.tools.redirectsRunning ? (v.tools.redirectsRunning === 'test' ? 'Redirect test' : 'Redirect map')
        : (v.tools.runs.find(r => r.status === 'scanning') ? 'Scan' : v.tools.runs.find(r => r.status === 'running') ? 'Heading plan' : null),
    };
  }

  /**
   * Shift the plan: every unfinished item's due date and the phase sign-offs move by `days`, and the launch date
   * too if asked. Done items keep theirs. With dryRun it only says what would change.
   */
  function shiftPlan(id, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const days = Math.round(+b.days || 0);
    if (!days || Math.abs(days) > 365) throw new Error('Pick a number of days between 1 and 365.');
    if (!p.kickoff && !(b.launch && p.launch)) throw new Error('Set the kickoff date first. The plan’s dates are counted from it.');
    const q = JSON.parse(JSON.stringify(p));
    q.slip = (q.slip || 0) + days;
    if (b.launch && q.launch) q.launch = addDays(q.launch, days);
    for (const st of Object.values(q.state || {})) if (st.due && st.s !== 'done' && st.s !== 'na') st.due = addDays(st.due, days);
    q.shifts = [{ at: Date.now(), days, launch: !!(b.launch && p.launch) }, ...(q.shifts || [])].slice(0, 20);
    if (!b.dryRun) { writeRaw(q); return view(q); }
    const before = view(p), after = view(q);
    const todo = v => v.phases.flatMap(ph => [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]).filter(x => x.status === 'todo');
    const next = todo(after).filter(x => x.due && !x.late).sort((a, c) => a.due < c.due ? -1 : 1)[0] || null;
    return {
      days, launch: { from: p.launch || null, to: q.launch || null },
      late: { before: todo(before).filter(x => x.late).length, after: todo(after).filter(x => x.late).length },
      next: next ? { title: next.title, due: next.due } : null,
      phases: after.phases.filter(ph => ph.state !== 'signed' && ph.due).map(ph => {
        const rule = (p.phases.find(x => x.id === ph.id) || {}).due;
        return { name: ph.name, from: before.phases.find(x => x.id === ph.id).due, to: ph.due, clash: !!(q.launch && rule && rule.from !== 'launch' && ph.due > q.launch) };
      }),
    };
  }

  const list = () => listRaw().map(p => summary(view(p))).sort((a, b) => (a.launch || '9999') < (b.launch || '9999') ? -1 : 1);
  const get = id => { const p = readRaw(id); return p ? view(p) : null; };

  function home() {
    const now = today(), week = addDays(now, 7);
    const views = listRaw().map(view);
    const next = [];
    for (const v of views) {
      const cur = v.phases.find(ph => ph.id === v.current);
      const base = { projectId: v.id, projectName: v.name, iconRun: v.tools.iconRun };
      if (cur && cur.ready) next.push({ ...base, kind: 'signoff', key: v.id + ':so', title: `Record sign-off: ${cur.handoff.title}`, phaseId: cur.id, phaseName: cur.name, due: null, late: false });
      if (cur) for (const x of [...cur.groups.flatMap(g => g.items), ...cur.handoff.items]) if (x.status === 'todo' && x.who === 'us') next.push({ ...base, kind: 'item', key: v.id + ':' + x.id, itemId: x.id, title: x.title, phaseId: x.phaseId, phaseName: x.phaseName, due: x.due, late: x.late });
      for (const x of [...v.client.late, ...v.client.soon]) next.push({ ...base, kind: 'client', key: v.id + ':' + x.id, itemId: x.id, title: x.title, phaseId: x.phaseId, phaseName: x.phaseName, due: x.due, late: x.late });
    }
    const rank = x => x.kind === 'signoff' ? '0' : x.late ? '1' + (x.due || '') : '2' + (x.due || '9999');
    next.sort((a, b) => rank(a) < rank(b) ? -1 : 1);
    const open = next.filter(x => x.kind !== 'signoff');
    const launches = views.filter(v => v.launch && v.launch >= now).sort((a, b) => a.launch < b.launch ? -1 : 1);
    return {
      next: next.slice(0, 8),
      stats: {
        dueThisWeek: open.filter(x => x.due && x.due >= now && x.due <= week).length,
        overdue: open.filter(x => x.kind === 'item' && x.late).length,
        waiting: views.reduce((n, v) => n + v.client.late.length + v.client.soon.length, 0),
        late: views.reduce((n, v) => n + v.client.late.length, 0),
        signoffs: next.filter(x => x.kind === 'signoff').length,
        nextLaunch: launches[0] ? { name: launches[0].name, date: launches[0].launch } : null,
      },
      projects: views.map(summary).sort((a, b) => (a.launch || '9999') < (b.launch || '9999') ? -1 : 1),
    };
  }

  // An audit project for a site scanned outside a project (from before projects owned their scans).
  function createAudit({ name, url }) { return create({ kind: 'audit', name, sites: { live: url } }); }
  return { TOOLS, sitesOf, runsOf, createAudit, listRaw, startLaunch, getLaunch, launchRunning, cancelLaunch, cancelRedirects, startRedirectBuild, startRedirectTest, setRedirects, redirectState, redirectsRunning, templateList, getTemplate, saveTemplate, createTemplate, removeTemplate, list, get, create, update, shiftPlan, templateUpdate, setItem, askItems, signoff, unsign, remove, home, filePath, readRaw };
};
