// Projects and templates. A project is a client site plus its own copy of a checklist template.
// Everything is stored as JSON in the data folder: templates.json, and projects/<id>/project.json (+ files/ for proof).
const fs = require('fs'), path = require('path');
const { defaults, SEED, MESSAGE_FIXES } = require('./templates-default');
const launch = require('./launch');
const R = require('./redirects');
const INV = require('./inventory');
const PF = require('./platforms');
const INVO = require('./invoice');
const RN = require('./renewals');
const TR = require('./traffic');

const TOOLS = {
  scan: { name: 'Site scan', ready: true },
  headings: { name: 'Heading plan', ready: true },
  seo: { name: 'SEO plan', ready: true },
  launch: { name: 'Launch check', ready: true },
  redirects: { name: 'Redirect map', ready: true },
  inventory: { name: 'Content inventory', ready: true },
};

module.exports = function projects({ DATA, readJson, writeJson, allRuns, hostOf, timeOf }) {
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
  // Worked-out dates that land on a weekend move to a weekday: Saturday to Friday, Sunday to Monday. Kickoff and launch
  // day themselves stay where they were set.
  const weekday = s => { const [y, m, d] = s.split('-').map(Number), w = new Date(y, m - 1, d).getDay(); return w === 6 ? addDays(s, -1) : w === 0 ? addDays(s, 1) : s; };
  const dueOf = (rule, p) => {
    if (!rule) return null;
    const k = p.kickoff ? addDays(p.kickoff, p.slip || 0) : null;
    const span = p.dueMode === 'span';
    const scale = span && k && p.launch ? Math.max(0.2, daysBetween(k, p.launch) / (p.refSpan || REF_SPAN)) : 1;
    const d = rule.days || 0;
    const out = rule.from === 'launch' ? (p.launch ? addDays(p.launch, d < 0 ? Math.round(d * scale) : d) : null) : (k ? addDays(k, Math.round(d * scale)) : null);
    return out && span && d !== 0 ? weekday(out) : out;
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
      if (i >= 0 && (t[i].seed || 1) < SEED) { t[i] = (t[i].version || 1) === 1 ? b : { ...t[i], seed: SEED, name: t[i].name === 'Website project' && b.id === 'website' ? b.name : t[i].name, desc: t[i].desc || b.desc, basedOn: t[i].basedOn || b.basedOn, refSpan: t[i].refSpan || b.refSpan }; changed = true; }
    }
    // Built-in messages whose wording changed: an untouched copy takes the new text.
    for (const m of defaults().filter(x => x.kind !== 'checklist')) {
      const i = t.findIndex(x => x.id === m.id), old = (MESSAGE_FIXES[m.id] || []);
      if (i >= 0 && old.includes(t[i].body)) { t[i] = { ...t[i], body: m.body }; changed = true; }
    }
    // New built-in checklists arrive once, in gallery order. One you've deleted doesn't come back.
    const seenFile = path.join(DATA, 'templates-seen.json');
    let seen = readJson(seenFile, null);
    if (!seen) { const full = t.find(x => x.id === 'website'); seen = [...t.map(x => x.id), ...(full && full.leanOffered ? ['website-lean'] : [])]; }
    for (const [k, b] of built.entries()) {
      if (seen.includes(b.id) || t.some(x => x.id === b.id)) continue;
      // After the built-in that comes before it, or at the top.
      const prev = built.slice(0, k).map(x => t.findIndex(y => y.id === x.id)).filter(x => x >= 0).pop();
      t.splice(prev == null ? 0 : prev + 1, 0, b); changed = true;
    }
    // New built-in messages arrive the same way, at the end.
    for (const m of defaults().filter(x => x.kind !== 'checklist')) {
      if (seen.includes(m.id) || t.some(x => x.id === m.id)) continue;
      t.push(m); changed = true;
    }
    const all = [...new Set([...seen, ...defaults().map(b => b.id)])];
    if (all.length !== seen.length || !fs.existsSync(seenFile)) writeJson(seenFile, all);
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
      ...(t.kind === 'checklist' ? { items: countItems(t), phases: t.phases.length, desc: t.desc || '', basedOn: t.basedOn || [], labels: t.labels || null, repeat: t.repeat || null, website: t.website !== false } : { subject: t.subject || '', preview: t.body.slice(0, 160), use: t.use || [] }),
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
  function createTemplate({ kind, name, copyFrom, restore }) {
    const all = allTemplates();
    // Undo after a delete: the template comes back exactly as it was, with its id.
    if (restore && restore.id && ['checklist', 'message', 'email'].includes(restore.kind) && !all.some(t => t.id === restore.id)) { all.push(restore); saveTemplates(all); return restore; }
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
    if (PF.isStaging(hostOf(u))) return { old: null, staging: u, live: null };
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
  // In a same-domain redesign, the live domain still shows the old site until launch day. A check or test of the old
  // site's address counts as the old site: it's shown, but it never ticks launch or redirect items.
  const launched = p => !!p.launch && p.launch <= today();
  const isOldSite = (p, host) => { const o = sitesOf(p).old; return !!o && hostOf(o) === host && !(launched(p) && liveHostOf(p) === host); };
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
      // Webflow, WordPress, Shopify... Picked when the project is made, or read from the staging address or the first scan.
      platform: PF.byId(b.platform) ? b.platform : PF.ofHost(hostOf(normUrl(sites.staging) || '')) || null,
      // Due dates stretch or shrink with the time between kickoff and launch (see dueOf), from the template's own timescale.
      dueMode: 'span', refSpan: (t && t.refSpan) || REF_SPAN, labels: (t && t.labels) || null, repeat: (t && t.repeat) || null,
      // Work with no website (a brand, an ad setup) shows no Site tools until a website is added.
      ...(t && t.website === false ? { website: false } : {}),
      phases: t ? t.phases.map(ph => ({ ...ph, groups: ph.groups.map(g => ({ ...g, items: g.items.filter(keep) })).filter(g => g.items.length), handoff: { ...ph.handoff, items: ph.handoff.items.filter(keep) } })) : [],
      state: {}, signoffs: {},
    };
    setSites(p, sites);
    // Items suggested from the brief go into a "From the brief" group in the phase they belong to.
    for (const x of (Array.isArray(b.extraItems) ? b.extraItems : []).slice(0, 20)) {
      const ph = p.phases.find(y => y.id === x.phase) || p.phases[0];
      if (!ph || !String(x.title || '').trim()) continue;
      let g = ph.groups.find(y => y.id === ph.id + '-brief');
      if (!g) { g = { id: ph.id + '-brief', name: 'From the brief', items: [] }; ph.groups.push(g); }
      g.items.push({ id: 'b' + newId(), title: String(x.title).trim().slice(0, 160), who: x.who === 'client' ? 'client' : 'us', done: String(x.done || '').slice(0, 300), part: null, platforms: null, tool: null, check: null, due: null });
    }
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
  const words = t => new Set(normT(t).split(/[^a-z0-9]+/).filter(w => w.length > 2));
  const similar = (a, b) => { const x = words(a), y = words(b); if (!x.size || !y.size) return false; let n = 0; for (const w of x) if (y.has(w)) n++; return n / (x.size + y.size - n) >= 0.5; };
  function templateDiff(p, t) {
    const ours = [];
    p.phases.forEach(ph => { ph.groups.forEach(g => g.items.forEach(it => ours.push({ it, ph, g }))); ph.handoff.items.forEach(it => ours.push({ it, ph, g: null })); });
    const byId = new Map(ours.map(o => [o.it.id, o])), byTitle = new Map(ours.map(o => [normT(o.it.title), o]));
    const keep = it => !it.part || (p.parts || []).includes(it.part);
    const matched = new Set(), added = [], changed = [];
    t.phases.forEach(ph => {
      const each = (it, g) => {
        if (!keep(it)) return;
        // Same title first. Template items are numbered in order, so an item added earlier in a template shifts the
        // numbers after it: a number match only counts as the same item when the titles are close (a rename).
        let o = byTitle.get(normT(it.title)) || null;
        if (o && matched.has(o.it.id)) o = null;
        if (!o) { const x = byId.get(it.id); if (x && !matched.has(x.it.id) && x.ph.id === ph.id && similar(x.it.title, it.title)) o = x; }
        if (!o) { added.push({ it, ph, g }); return; }
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
    if ('remindEvery' in b) p.remindEvery = Math.max(0, Math.min(30, Math.round(+b.remindEvery || 0)));
    if (b.sites) setSites(p, b.sites);
    else if ('url' in b && b.url) setSites(p, { live: b.url });
    if ('platform' in b) p.platform = PF.byId(b.platform) ? b.platform : null;
    // An hourly rate for this project, when it differs from the one in Settings ("$90").
    if ('rate' in b) p.rate = String(b.rate || '').trim().slice(0, 30);
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
    // How long the item should take, in minutes, to compare with the time logged on it.
    if ('est' in b) { const est = b.est ? Math.max(1, Math.min(100000, Math.round(+b.est) || 0)) || null : null; if (est !== (s.est || null)) { s.est = est; note(s, est ? `Estimate set to ${est >= 60 ? `${Math.floor(est / 60)}h${est % 60 ? ` ${est % 60}m` : ''}` : `${est}m`}` : 'Estimate removed'); } }
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
  /** `opts.speed` false skips the speed test; the last speed result for the same site is kept. `opts.watch` marks an after-launch check. */
  function startLaunch(id, url, opts = {}) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const sp = sitesOf(p), liveNow = sp.live && !isOldSite(p, hostOf(sp.live)) ? sp.live : null;
    url = String(url || (launched(p) ? liveNow || sp.staging : sp.staging || liveNow) || '').trim();
    if (!url) throw new Error(sp.live ? 'Add the staging address. Before launch day, the live domain still shows the old site.' : 'Add the site’s address first.');
    const oldSite = isOldSite(p, hostOf(/^https?:\/\//i.test(url) ? url : 'https://' + url));
    if (Object.values(jobs).some(j => j.projectId === id && j.status === 'running')) throw new Error('A launch check is already running for this project.');
    const checkId = newId();
    const speedTest = opts.speed !== false;
    const job = jobs[checkId] = { id: checkId, projectId: id, url, started: Date.now(), status: 'running', speed: speedTest, watch: opts.watch || null, progress: { step: 'site', done: 0, total: 0 } };
    const signal = { aborted: false };
    Object.defineProperty(job, 'signal', { value: signal, enumerable: false });
    launch.run({ url, liveHost: liveHostOf(p), platform: p.platform || null, speedTest, signal }, pr => { job.progress = pr; })
      .then(report => {
        // Compare with the last finished check of the same site: new issues, and ones fixed since.
        const q0 = readRaw(id), prevSum = q0 && (q0.checks || []).find(c => c.status === 'done');
        const prev = prevSum && readJson(path.join(pdir(id), 'launch', prevSum.id + '.json'), null);
        // Without the speed test, the last speed result for this site carries over, dated.
        if (!speedTest && prev && prev.host === report.host) {
          const ps = (prev.checks || []).find(c => c.id === 'speed');
          if (ps) { report.checks.push({ ...ps, carried: ps.carried || prev.started }); report.info.speed = prev.info && prev.info.speed || null; }
        }
        if (prev && prev.host === report.host) {
          const keys = r => new Set((r.checks || []).flatMap(c => c.issues.filter(i => !i.soft).map(i => c.id + '|' + i.text)));
          const before = keys(prev), now = keys(report);
          for (const c of report.checks) for (const i of c.issues) if (!i.soft && !before.has(c.id + '|' + i.text)) i.isNew = true;
          report.previous = { id: prev.id, at: prev.started };
          report.fixed = (prev.checks || []).flatMap(c => c.issues.filter(i => !i.soft && !now.has(c.id + '|' + i.text)).map(i => ({ check: c.id, text: i.text, pages: i.pages.length })));
        }
        Object.assign(job, report, { status: 'done', ended: Date.now(), oldSite });
      })
      .catch(e => { Object.assign(job, { status: signal.aborted ? 'cancelled' : 'failed', error: signal.aborted ? 'Stopped' : String(e.message || e).split('\n')[0], ended: Date.now() }); })
      .finally(() => {
        fs.mkdirSync(path.join(pdir(id), 'launch'), { recursive: true });
        writeJson(path.join(pdir(id), 'launch', checkId + '.json'), job);
        const q = readRaw(id);
        if (q) {
          const summary = { id: checkId, at: job.started, url: job.url, status: job.status, staging: !!job.staging, oldSite, watch: job.watch, pages: job.pagesChecked || 0, compared: !!job.previous, newIssues: (job.checks || []).reduce((n, c) => n + c.issues.filter(i => i.isNew).length, 0), checks: Object.fromEntries((job.checks || []).map(c => [c.id, { ok: c.ok, count: c.issues.filter(i => !i.soft).length }])) };
          q.checks = [summary, ...(q.checks || [])].slice(0, 20); writeRaw(q);
        }
        setTimeout(() => { delete jobs[checkId]; }, 60e3);
      });
    return checkId;
  }
  const getLaunch = (id, checkId) => (jobs[checkId] && jobs[checkId].projectId === id ? jobs[checkId] : /^[a-z0-9]+$/.test(checkId) ? readJson(path.join(pdir(id), 'launch', checkId + '.json'), null) : null);
  const launchRunning = () => Object.values(jobs).filter(j => j.status === 'running').length;
  const cancelLaunch = (id, checkId) => { const j = jobs[checkId]; if (j && j.projectId === id && j.status === 'running') j.signal.aborted = true; };

  // ---------- content inventory ----------
  // projects/<id>/inventory.json: the old site's pages with a keep, rewrite, merge or remove call each.
  const ifile = id => path.join(pdir(id), 'inventory.json');
  const getInventory = id => readJson(ifile(id), null);
  /** Makes the calls again from the newest old-site scan. Your own calls are kept. `ask` runs AI calls when given. */
  async function buildInventory(id, ask) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const run = oldScan(p); if (!run) throw new Error(sitesOf(p).old ? 'Scan the old site first. The inventory starts from its pages.' : 'Add the old site to the project first.');
    const pages = INV.pagesOf(run, pg => readJson(path.join(run.dir, 'crawl', pg.id + '.json'), null));
    let rows = INV.suggest(pages);
    if (ask) {
      const ai = await INV.aiSuggest(pages, ask);
      // A call the rules were sure of (the home page, a page that doesn't load) stays sure when the AI agrees.
      rows = rows.map(r => ai[r.path] && !(r.status >= 400) ? { ...r, ...ai[r.path], by: 'ai', sure: r.sure && ai[r.path].decision === r.decision } : r);
    }
    const prev = getInventory(id), mine = new Map((prev && prev.rows || []).filter(r => r.by === 'you').map(r => [r.path, r]));
    rows = rows.map(r => mine.has(r.path) ? { ...r, decision: mine.get(r.path).decision, into: mine.get(r.path).into, reason: mine.get(r.path).reason, by: 'you', sure: true } : r);
    const inv = { at: Date.now(), runId: run.id, host: hostOf(run.origin || run.url), ai: !!ask, rows };
    writeJson(ifile(id), inv);
    return inv;
  }
  /** Your calls: `set` {path: {decision, into}}, and `accept` [paths] that look right as suggested. */
  function setInventory(id, b) {
    const inv = getInventory(id); if (!inv) throw new Error('Make the inventory first.');
    const by = new Map(inv.rows.map(r => [r.path, r]));
    for (const [pth, v] of Object.entries(b.set || {})) {
      const r = by.get(pth); if (!r || !INV.DECISIONS.includes(v.decision)) continue;
      r.decision = v.decision; r.into = v.decision === 'merge' ? (by.has(v.into) && v.into !== pth ? v.into : r.into) : null; r.by = 'you'; r.sure = true; r.reason = v.reason ?? r.reason;
    }
    for (const pth of b.accept || []) { const r = by.get(pth); if (r) r.sure = true; }
    writeJson(ifile(id), inv);
    return inv;
  }
  /** Merged pages go where the page they merge into goes, in the redirect map. */
  function applyInventory(id) {
    const inv = getInventory(id), m = readMap(id);
    if (!inv) throw new Error('Make the inventory first.');
    if (!m) throw new Error('Build the redirect map first.');
    const rows = new Map(m.rows.map(r => [R.key(r.from), r]));
    let n = 0;
    for (const x of inv.rows.filter(r => r.decision === 'merge' && r.into)) {
      const from = rows.get(R.key(R.normPath(x.path))), into = rows.get(R.key(R.normPath(x.into)));
      const to = into ? into.to : R.normPath(x.into);
      if (from && R.key(from.to) !== R.key(to)) { from.to = to; from.how = 'manual'; from.sure = true; from.checked = true; n++; }
    }
    writeJson(rfile(id), m);
    return n;
  }
  function inventorySummary(p) {
    const inv = sitesOf(p).old && getInventory(p.id); if (!inv) return null;
    const count = d => inv.rows.filter(r => r.decision === d).length;
    return { at: inv.at, total: inv.rows.length, review: inv.rows.filter(r => !r.sure).length, keep: count('keep'), rewrite: count('rewrite'), merge: count('merge'), remove: count('remove'), ai: inv.ai };
  }

  // ---------- after-launch watch ----------
  // While the app is open, the live site is checked again 3, 7 and 30 days after launch: the launch check with its speed
  // test, and the redirect test when there's a map. A milestone runs once, within two weeks of its day.
  const WATCH_DAYS = [3, 7, 30];
  function watchDue() {
    const now = today();
    for (const p of listRaw()) {
      if (p.kind === 'audit' || p.repeat || p.sample || !p.launch || p.launch > now) continue;
      const live = sitesOf(p).live; if (!live || isOldSite(p, hostOf(live))) continue;
      const day = WATCH_DAYS.filter(d => addDays(p.launch, d) <= now && now <= addDays(p.launch, d + 14) && !(p.watch || {})[d]).pop();
      if (day) return { p, day, live };
    }
    return null;
  }
  /** Starts one due after-launch check, when nothing else is running. Returns what it started, if anything. */
  function watchTick() {
    if (launchRunning() || redirectsRunning()) return null;
    const d = watchDue(); if (!d) return null;
    const q = readRaw(d.p.id);
    // Earlier milestones that were missed (the app was closed) are marked so they don't run late.
    q.watch = { ...(q.watch || {}) };
    for (const x of WATCH_DAYS) if (x < d.day && !q.watch[x]) q.watch[x] = { skipped: true, at: Date.now() };
    q.watch[d.day] = { at: Date.now(), checkId: null };
    writeRaw(q);
    let checkId = null;
    try { checkId = startLaunch(d.p.id, d.live, { speed: true, watch: d.day }); } catch {}
    try { if (sitesOf(d.p).old && readMap(d.p.id)) startRedirectTest(d.p.id, d.live); } catch {}
    const r = readRaw(d.p.id); r.watch[d.day].checkId = checkId; writeRaw(r);
    return { projectId: d.p.id, day: d.day, checkId };
  }
  /** The latest after-launch check, for Home: which day, and what it found. */
  function watchSummary(p) {
    const c = (p.checks || []).find(x => x.watch && x.status === 'done');
    if (!c) return null;
    const failing = Object.entries(c.checks || {}).filter(([, v]) => !v.ok);
    // With an earlier check to compare with, what's new; without one, everything it found.
    const issues = c.compared ? c.newIssues || 0 : failing.reduce((n, [, v]) => n + (v.count || 0), 0);
    return { day: c.watch, checkId: c.id, at: c.at, issues, compared: !!c.compared };
  }

  // ---------- accounts and access ----------
  // Every account the work depends on: who owns it, the login it's under (never a password), whether we have access,
  // and whether our access comes off at handoff. It feeds the handoff document.
  const WEB_ACCOUNTS = [['registrar', 'Domain registrar'], ['dns', 'DNS'], ['hosting', 'Website platform or hosting'], ['search-console', 'Google Search Console'], ['ga4', 'Google Analytics'], ['gtm', 'Google Tag Manager'], ['google-ads', 'Google Ads'], ['meta', 'Meta Business'], ['forms', 'Where form emails go']];
  const OTHER_ACCOUNTS = [['files', 'Shared files folder'], ['ga4', 'Google Analytics'], ['google-ads', 'Google Ads'], ['meta', 'Meta Business'], ['social', 'Social media accounts']];
  const OWNERS = ['client', 'us', 'none'];
  function accountsOf(p) {
    if (Array.isArray(p.accounts)) return p.accounts;
    const web = p.website !== false || Object.values(sitesOf(p)).some(Boolean);
    return (web ? WEB_ACCOUNTS : OTHER_ACCOUNTS).map(([kind, name]) => ({ id: kind, kind, name, where: kind === 'hosting' && p.platform ? (PF.byId(p.platform) || {}).name || '' : '', owner: '', login: '', access: false, revoke: false, note: '' }));
  }
  function setAccounts(id, list) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    if (!Array.isArray(list)) throw new Error('No accounts sent.');
    const s = (v, n) => String(v || '').trim().slice(0, n);
    p.accounts = list.slice(0, 40).map(a => ({
      id: /^[\w-]{1,40}$/.test(a.id || '') ? a.id : newId(), kind: s(a.kind, 40) || 'custom', name: s(a.name, 80) || 'Account', where: s(a.where, 80),
      owner: OWNERS.includes(a.owner) ? a.owner : '', login: s(a.login, 120), access: !!a.access, revoke: !!a.revoke, note: s(a.note, 300),
    }));
    writeRaw(p);
    return accountsOf(p);
  }

  // ---------- renewals ----------
  // The live domain's SSL certificate and domain registration: when each runs out. Checked once a day while the app is
  // open (server.js), and when asked.
  const HOSTED = ['webflow', 'shopify', 'squarespace', 'wix', 'framer'];
  const renewHost = p => { const l = sitesOf(p).live; const h = l && hostOf(l); return h && !PF.isStaging(h) ? h : null; };
  async function checkRenewals(id) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const host = renewHost(p); if (!host) throw new Error('Add the live domain to the project first.');
    const r = await RN.check(host);
    const q = readRaw(id); if (q) { q.renewals = r; writeRaw(q); }
    return r;
  }
  /** Projects whose renewals haven't been checked today, for the background check. */
  const renewalsDue = () => listRaw().filter(p => p.kind !== 'audit' && !p.sample && renewHost(p) && (!p.renewals || p.renewals.host !== renewHost(p) || Date.now() - p.renewals.at > 20 * 3600e3)).map(p => p.id);
  const renewalWarnings = p => (p.renewals && p.renewals.host === renewHost(p) ? RN.warnings(p.renewals, today(), HOSTED.includes(p.platform)) : []);

  // ---------- redirect map ----------
  // projects/<id>/redirects.json: the old site's URLs matched to the new site's pages, your changes, and the last test.
  const rfile = id => path.join(pdir(id), 'redirects.json');
  const readMap = id => readJson(rfile(id), null);
  const rjobs = {}; // projectId -> { kind: 'build' | 'test', progress, started }
  /** The current site's scan: the URL list the redirect map starts from. */
  function oldScan(p) {
    // Only a project that replaces a site needs redirects.
    if (!sitesOf(p).old) return null;
    // The newest scan of the old site. In a same-domain redesign, a scan from launch day on is of the new site.
    const s = sitesOf(p), same = s.live && hostOf(s.old) === hostOf(s.live);
    const runs = runsOf(p).filter(r => siteOfRun(p, r) === 'old' && !(same && p.launch && iso(new Date(r.created)) >= p.launch));
    return runs.find(r => (r.pages || []).length && r.status !== 'scanning' && r.status !== 'scan_failed') || null;
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
    if (!run) throw new Error(sitesOf(p).old ? 'Scan the old site first. The map starts from its list of URLs.' : 'Add the old site to the project first. Redirects are only needed when a site is replaced.');
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
        // Only a test of the live domain counts: staging can't prove the live redirects work, and before launch day a
        // same-domain redesign's live domain is still the old site.
        const oldSite = !!p && isOldSite(p, hostOf(origin));
        m.test = { at: Date.now(), url: origin, live: !!p && !!liveHostOf(p) && hostOf(origin) === liveHostOf(p) && !oldSite, oldSite, total: map.rows.length, ok: map.rows.length - bad, results };
        m.tests = [{ at: m.test.at, url: origin, live: m.test.live, oldSite, total: m.test.total, ok: m.test.ok }, ...(m.tests || [])].slice(0, 10);
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
  // A pasted list of URLs tested against a site: projects/<id>/redirect-list.json.
  const lfile = id => path.join(pdir(id), 'redirect-list.json');
  function startRedirectList(id, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    if (rjobs[id]) throw new Error('The redirect map is busy. Wait for it to finish.');
    let url = String(b.url || '').trim(); if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    let origin; try { origin = new URL(url).origin; } catch { throw new Error('That doesn’t look like a web address.'); }
    const items = R.parseList(b.text, origin);
    if (!items.length) throw new Error('No URLs found. Paste one per line, or a CSV with the URLs in a column.');
    const map = readMap(id);
    const job = rjobs[id] = { kind: 'list', started: Date.now(), progress: { step: 'list', done: 0, total: items.length }, signal: { aborted: false } };
    R.testList(items, origin, map && map.rows, n => { job.progress.done = n; }, job.signal)
      .then(results => writeJson(lfile(id), { at: Date.now(), url: origin, total: results.length, ok: results.filter(r => r.ok).length, results }))
      .catch(e => { if (!job.signal.aborted) job.error = String(e.message || e).split('\n')[0]; })
      .finally(() => { const err = job.error; delete rjobs[id]; if (err) rjobs[id + ':error'] = { error: err, at: Date.now() }; else delete rjobs[id + ':error']; });
  }
  /** Old paths found by a list test that the map doesn't have yet, added with a best guess to look at. */
  function addToMap(id, paths) {
    const m = readMap(id); if (!m) throw new Error('Build the redirect map first.');
    const have = new Set(m.rows.map(r => R.key(r.from)));
    const add = [...new Set((paths || []).map(x => R.normPath(x)).filter(x => x && !have.has(R.key(x))))].slice(0, 2000);
    const rows = R.match(add.map(x => ({ path: x, title: '' })), m.newPages || [], {}).map(r => ({ ...r, sure: false, added: true }));
    m.rows = [...m.rows, ...rows].sort((a, b) => a.from.localeCompare(b.from));
    writeJson(rfile(id), m);
    return rows.length;
  }
  const redirectState = id => {
    const m = readMap(id), job = rjobs[id], err = rjobs[id + ':error'], p = readRaw(id);
    return { map: m, list: readJson(lfile(id), null), job: job ? { kind: job.kind, progress: job.progress, started: job.started } : null, error: err && Date.now() - err.at < 10 * 60e3 ? err.error : null, traffic: p ? clicksByPath(p) : null };
  };

  // ---------- search traffic ----------
  // projects/<id>/traffic.json: CSV exports from Search Console, GA4 or Google Ads, newest first.
  const tfile = id => path.join(pdir(id), 'traffic.json');
  const readTraffic = id => readJson(tfile(id), null) || { imports: [] };
  const beforeLaunch = (p, x) => !p.launch || iso(new Date(x.at)) < p.launch;
  function importTraffic(id, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const r = TR.parse(b.text, b.name);
    const t = readTraffic(id);
    t.imports = [{ id: newId(), at: Date.now(), name: String(b.name || '').slice(0, 120), ...r }, ...t.imports].slice(0, 12);
    writeJson(tfile(id), t);
  }
  function removeTraffic(id, impId) { const t = readTraffic(id); t.imports = t.imports.filter(x => x.id !== impId); writeJson(tfile(id), t); }
  function trafficSummary(p) {
    const t = readTraffic(p.id); if (!t.imports.length) return null;
    return t.imports.map(x => ({ id: x.id, at: x.at, name: x.name, source: x.source, metric: x.metric, total: x.total, pages: x.rows.length, before: beforeLaunch(p, x), top: x.rows.slice(0, 5) }));
  }
  /** Clicks for each old URL, from the newest export made before launch (else the newest), keyed like the redirect map. */
  function clicksByPath(p) {
    const t = readTraffic(p.id), imp = t.imports.find(x => beforeLaunch(p, x)) || t.imports[0];
    if (!imp) return null;
    const by = {};
    for (const r of imp.rows) { const k = R.key(R.normPath(r.path)); by[k] = (by[k] || 0) + r.n; }
    return { source: imp.source, metric: imp.metric, at: imp.at, total: imp.total, by };
  }

  /**
   * Before and after: each page the old site's scan read, next to the page it moves to (the map's target, or the same
   * path) in a scan of the new site. Flags what search engines would notice: a title, description or H1 that's gone
   * or changed, a page the new scan didn't find, and a canonical pointing at another site.
   */
  function compare(id, newRunId) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const old = oldScan(p); if (!old) throw new Error('Scan the old site first.');
    const runs = runsOf(p).filter(r => r.id !== old.id && (r.pages || []).some(x => x.status) && ['staging', 'live'].includes(siteOfRun(p, r)) && !(siteOfRun(p, r) === 'live' && isOldSite(p, hostOf(r.origin || r.url))));
    const neu = runs.find(r => r.id === newRunId) || runs[0];
    const choices = runs.map(r => ({ runId: r.id, site: siteOfRun(p, r), host: hostOf(r.origin || r.url), at: r.crawledAt || r.created, pages: (r.pages || []).filter(x => x.status).length }));
    if (!neu) return { old: { runId: old.id, host: hostOf(old.origin || old.url), at: old.crawledAt || old.created }, new: null, choices, rows: [] };
    const read = (run, pg) => { const d = readJson(path.join(run.dir, 'crawl', pg.id + '.json'), null); if (!d) return null; const h1 = (d.items || []).filter(i => i.kind === 'h1' && !i.hidden).map(i => i.text); return { status: d.status, title: (d.title || '').trim(), desc: (d.desc || '').trim(), h1: h1[0] || '', h1s: h1.length, canonical: d.canonical || '' }; };
    const map = readMap(id), to = new Map((map && map.rows || []).map(r => [R.key(r.from), r.to]));
    const byPath = new Map((neu.pages || []).filter(x => x.status).map(x => [R.key(R.normPath(x.path)), x]));
    const newHost = hostOf(neu.origin || neu.url), live = liveHostOf(p);
    const rows = [];
    for (const op of (old.pages || []).filter(x => x.status && x.status < 400)) {
      const from = R.normPath(op.path), target = R.normPath(to.get(R.key(from)) || from);
      const before = read(old, op); if (!before) continue;
      const np = byPath.get(R.key(target));
      const after = np ? read(neu, np) : null;
      const changes = [];
      if (!after) changes.push({ what: 'page', kind: 'missing' });
      else {
        if (after.status >= 400) changes.push({ what: 'page', kind: 'missing' });
        const cmp = (what, a, b) => { if (a && !b) changes.push({ what, kind: 'gone', before: a }); else if (a && b && a.toLowerCase() !== b.toLowerCase()) changes.push({ what, kind: 'changed', before: a, after: b }); else if (!a && b) changes.push({ what, kind: 'added', after: b }); };
        cmp('title', before.title, after.title);
        cmp('description', before.desc, after.desc);
        cmp('h1', before.h1, after.h1);
        if (after.canonical) { const c = hostOf(after.canonical); if (c && c !== newHost && c !== live) changes.push({ what: 'canonical', kind: 'elsewhere', after: after.canonical }); }
      }
      rows.push({ from, to: target, moved: R.key(target) !== R.key(from), scanned: !!np, changes });
    }
    const n = k => rows.filter(r => r.changes.some(c => c.kind === k)).length;
    return {
      old: { runId: old.id, host: hostOf(old.origin || old.url), at: old.crawledAt || old.created },
      new: { runId: neu.id, host: newHost, site: siteOfRun(p, neu), at: neu.crawledAt || neu.created },
      choices, rows,
      counts: { pages: rows.length, same: rows.filter(r => !r.changes.length).length, missing: rows.filter(r => r.changes.some(c => c.what === 'page')).length, gone: n('gone'), changed: n('changed') },
    };
  }
  const redirectsRunning = () => Object.keys(rjobs).filter(k => !k.includes(':')).length;
  const cancelRedirects = id => { if (rjobs[id] && rjobs[id].signal) rjobs[id].signal.aborted = true; };
  function redirectSummary(p) {
    const m = sitesOf(p).old && readMap(p.id); if (!m) return null;
    const moves = m.rows.filter(r => R.key(r.to) !== R.key(r.from));
    return {
      built: m.built, total: m.rows.length, redirects: moves.length, same: m.rows.length - moves.length, review: m.rows.filter(r => !r.sure).length,
      test: m.test ? { at: m.test.at, url: m.test.url, live: m.test.live, oldSite: !!m.test.oldSite, total: m.test.total, ok: m.test.ok } : null,
    };
  }

  // ---------- projects: what the app shows ----------
  function toolState(p) {
    const runs = runsOf(p);
    // "Crawl the current site" is about the old site; a project without one counts any scan.
    const scanned = runs.find(r => (r.pages || []).length && !['scanning', 'scan_failed'].includes(r.status) && (!sitesOf(p).old || siteOfRun(p, r) === 'old'));
    // The heading and SEO items are about the new site, so a plan of staging counts first.
    const prefer = f => runs.find(r => f(r) && siteOfRun(p, r) === 'staging') || runs.find(f);
    const plan = prefer(r => ['done', 'partial'].includes(r.status));
    const seo = prefer(r => r.seo && ['done', 'partial'].includes(r.seo.status));
    // "Scan the old site again" before launch: an old-site scan in the 10 days before launch day.
    const recrawl = p.launch && sitesOf(p).old ? runs.find(r => siteOfRun(p, r) === 'old' && (r.pages || []).length && !['scanning', 'scan_failed'].includes(r.status) && iso(new Date(r.created)) >= addDays(p.launch, -10) && iso(new Date(r.created)) <= p.launch) : null;
    const prog = plan && plan.progress ? plan.progress.now || plan.progress.all || null : null;
    return {
      runs: runs.map(r => ({ id: r.id, site: siteOfRun(p, r), status: r.status, created: r.created, pages: (r.pages || []).length, scanned: (r.pages || []).filter(x => x.status).length, output: r.settings && r.settings.output || null, progress: r.progress || null, hasIcon: !!r.favicon, seo: r.seo ? { status: r.seo.status, progress: r.seo.progress || null } : null, error: (r.status === 'scan_failed' ? r.scan && r.scan.error : r.status === 'failed' ? r.error : null) || null, url: r.url })),
      scan: scanned ? { runId: scanned.id, urls: scanned.pages.length, at: scanned.created } : null,
      plan: plan ? { runId: plan.id, done: prog ? prog.done : 0, total: prog ? prog.tasks : 0, all: plan.progress && plan.progress.all || null, at: plan.created, output: plan.settings && plan.settings.output } : null,
      iconRun: (runs.find(r => r.favicon) || runs[0] || {}).id || null,
      seo: seo ? { runId: seo.id, done: (seo.seo.progress || {}).done || 0, total: (seo.seo.progress || {}).tasks || 0, pages: seo.seo.selected.length, of: (seo.pages || []).filter(x => x.status && x.status < 400).length, at: seo.seo.job.ended || seo.updated } : null,
      recrawl: recrawl ? { runId: recrawl.id, urls: recrawl.pages.length, at: recrawl.created } : null,
      seoRunning: (runs.find(r => r.seo && r.seo.status === 'running') || {}).id || null,
      // Checks of the old site are kept in the history but never tick anything.
      // A repeating project (a care plan) only counts checks from the current month.
      launch: (p.checks || []).find(c => c.status === 'done' && !c.oldSite && (!p.cycleStart || c.at >= p.cycleStart)) || null,
      launchRunning: Object.values(jobs).find(j => j.projectId === p.id && j.status === 'running') ? { id: Object.values(jobs).find(j => j.projectId === p.id && j.status === 'running').id } : null,
      launchHistory: (p.checks || []).slice(0, 10),
      redirects: redirectSummary(p),
      inventory: inventorySummary(p),
      redirectsRunning: rjobs[p.id] ? rjobs[p.id].kind : null,
      oldScan: (() => { const r = oldScan(p); return r ? { runId: r.id, urls: r.pages.length, at: r.crawledAt || r.created } : null; })(),
    };
  }

  function view(p) {
    const tools = toolState(p), now = today();
    // Time logged on the project and its items (lib/time.js).
    const time = timeOf ? timeOf(p.id) : { mins: 0, billable: 0, items: {}, running: null };
    const moved = {}; // items carried into a later phase
    for (const [id, s] of Object.entries(p.state)) if (s.move) moved[id] = s.move;
    const signedAll = p.phases.map(ph => p.signoffs[ph.id]);
    const currentIdx = signedAll.findIndex(s => !s);
    const itemView = (it, ph) => {
      const s = p.state[it.id] || {};
      let status = s.s || 'todo', auto = false, toolInfo = null;
      const check = it.tool === 'launch' ? it.check || launch.inferCheck(it.title) : it.tool === 'seo' ? it.check || (/per page|plan/i.test(it.title) ? 'plan' : 'live') : it.tool === 'redirects' ? it.check || R.inferCheck(it.title) : it.tool === 'scan' ? it.check || null : null;
      if (it.tool && TOOLS[it.tool] && (it.tool !== 'launch' || check)) {
        toolInfo = { id: it.tool, ...TOOLS[it.tool] };
        if (it.tool === 'scan' && check === 'recrawl') {
          toolInfo.check = 'recrawl';
          if (tools.recrawl) { toolInfo.text = `Scanned ${new Date(tools.recrawl.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${tools.recrawl.urls} URLs`; toolInfo.runId = tools.recrawl.runId; if (!s.s) { status = 'done'; auto = true; } }
          else toolInfo.text = p.launch ? 'Scan the old site in the 10 days before launch day' : 'Set the launch date first';
        } else if (it.tool === 'scan' && tools.scan) { toolInfo.text = `Done by the scan, ${tools.scan.urls} URLs saved`; toolInfo.runId = tools.scan.runId; if (!s.s) { status = 'done'; auto = true; } }
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
          } else toolInfo.text = check === 'speed' && last ? 'Run the launch check with the speed test' : (p.checks || []).some(c => c.oldSite) ? 'Only the old site has been checked so far' : 'Not run yet';
        }
        if (it.tool === 'seo') {
          toolInfo.check = check;
          if (tools.seoRunning) toolInfo.text = 'Planning now';
          else if (!tools.seo) toolInfo.text = 'Not planned yet';
          else if (check === 'plan') {
            // The plan is the deliverable, but only once it covers every page the scan read.
            toolInfo.runId = tools.seo.runId;
            const all = tools.seo.pages >= tools.seo.of;
            toolInfo.text = all ? `Planned for all ${tools.seo.pages} ${tools.seo.pages === 1 ? 'page' : 'pages'}, ${tools.seo.total} ${tools.seo.total === 1 ? 'change' : 'changes'}` : `Planned for ${tools.seo.pages} of ${tools.seo.of} pages. Plan the rest to tick this.`;
            if (!s.s && all) { status = 'done'; auto = true; }
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
          if (tools.redirectsRunning) toolInfo.text = tools.redirectsRunning === 'build' ? 'Building the map now' : 'Testing now';
          else if (!rd) toolInfo.text = 'No map yet';
          else if (check === 'map') {
            toolInfo.text = rd.review ? `${rd.total} old URLs mapped, ${rd.review} to look at` : `${rd.total} old URLs mapped, ${rd.redirects} ${rd.redirects === 1 ? 'redirect' : 'redirects'}`;
            toolInfo.issues = rd.review;
            if (!s.s && !rd.review) { status = 'done'; auto = true; }
          } else {
            // Redirects only count once they work on the live domain; "after" also needs a test after launch day.
            const t = rd.test, when = t && new Date(t.at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const afterLaunch = t && (!p.launch || iso(new Date(t.at)) >= p.launch);
            if (!t) toolInfo.text = 'Not tested yet';
            else toolInfo.text = t.ok === t.total ? `All ${t.total} worked in the ${when} test${t.live ? '' : t.oldSite ? ' of the old site' : ' on staging'}` : `${t.total - t.ok} of ${t.total} failed in the ${when} test`;
            if (t && t.ok < t.total) toolInfo.issues = t.total - t.ok;
            if (!s.s && t && t.live && t.ok === t.total && (check === 'live' || afterLaunch)) { status = 'done'; auto = true; }
          }
        }
        if (it.tool === 'inventory') {
          const inv = tools.inventory;
          if (!inv) toolInfo.text = tools.oldScan ? 'Not made yet' : 'Scan the old site first';
          else {
            toolInfo.text = inv.review ? `${inv.total} pages, ${inv.review} to look at` : `${inv.total} pages: ${inv.keep} keep, ${inv.rewrite} rewrite, ${inv.merge} merge, ${inv.remove} remove`;
            toolInfo.issues = inv.review;
            if (!s.s && !inv.review) { status = 'done'; auto = true; }
          }
        }
        if (it.tool === 'headings' && tools.plan) {
          toolInfo.progress = { done: tools.plan.done, total: tools.plan.total }; toolInfo.runId = tools.plan.runId;
          toolInfo.text = tools.plan.total ? `${tools.plan.done} of ${tools.plan.total} tag fixes done` : 'Plan ready';
          if (!s.s && tools.plan.total && tools.plan.done >= tools.plan.total) { status = 'done'; auto = true; }
        }
      }
      const due = s.due || dueOf(it.due || ph.due, p);
      const late = status === 'todo' && !!due && due < now;
      // A client item asked for and due within two days (or late) wants a reminder once `every` days pass without contact.
      const every = p.remindEvery == null ? 3 : p.remindEvery, lastContact = Math.max(s.asked || 0, s.nudged || 0);
      const remindDue = it.who === 'client' && status === 'todo' && !!s.asked && every > 0 && !!due && (late || daysBetween(now, due) <= 2) && Date.now() - lastContact >= every * 864e5;
      return { id: it.id, title: it.title, check, doneMeans: it.done || '', who: it.who, part: it.part || null, tool: it.tool || null, toolInfo, due, status, auto, at: s.at || null, note: s.note || '', link: s.link || '', asked: s.asked || null, nudged: s.nudged || null, hist: s.hist || [], manualDue: !!s.due, phaseId: ph.id, phaseName: ph.name, late, remindDue, est: s.est || null, mins: time.items[it.id] || 0 };
    };
    const phases = p.phases.map((ph, i) => {
      // Items for one platform (a Shopify step, a WordPress step) only show on projects on that platform.
      const fits = it => !moved[it.id] && (!it.platforms || !it.platforms.length || it.platforms.includes(p.platform));
      const groups = ph.groups.map(g => ({ id: g.id, name: g.name, items: g.items.filter(fits).map(it => itemView(it, ph)) })).filter(g => g.items.length || !ph.groups.some(x => x.items.length));
      const handoff = { title: ph.handoff.title, needs: ph.handoff.needs, items: ph.handoff.items.filter(fits).map(it => itemView(it, ph)) };
      // items carried here from earlier phases
      const carried = [];
      p.phases.forEach(src => [...src.groups.flatMap(g => g.items), ...src.handoff.items].forEach(it => { if (moved[it.id] === ph.id) carried.push({ ...itemView(it, src), phaseId: ph.id, carriedFrom: src.name }); }));
      if (carried.length) groups.unshift({ id: ph.id + '-carried', name: 'Carried over', items: carried });
      const all = [...groups.flatMap(g => g.items), ...handoff.items];
      const done = all.filter(x => x.status !== 'todo').length;
      const signed = p.signoffs[ph.id] || null;
      const state = signed ? 'signed' : i === currentIdx ? 'current' : 'upcoming';
      return { id: ph.id, name: ph.name, index: i, payment: (p.payments || {})[ph.id] || null, due: dueOf(ph.due, p), groups, handoff, signoff: signed, state, done, total: all.length, ready: !signed && all.length > 0 && done === all.length };
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
    const behind = { items: lateItems.length, ours: lateItems.filter(x => x.who === 'us').length, client: lateItems.filter(x => x.who === 'client').length, days: lateness(cur ? lateItems.filter(x => x.phaseId === cur.id) : lateItems) };
    return {
      id: p.id, kind: p.kind || 'project', name: p.name, url: p.url, host: p.host, sites: sitesOf(p), platform: p.platform || null, created: p.created,
      website: p.kind === 'audit' || p.website !== false || Object.values(sitesOf(p)).some(Boolean),
      labels: p.labels || null, repeat: p.repeat || null, cycle: (p.cycles || []).length + 1, sample: !!p.sample,
      lastUpdate: ((p.updates || [])[0] || {}).at || null, remindEvery: p.remindEvery == null ? 3 : p.remindEvery, updated: p.updated, kickoff: p.kickoff, launch: p.launch, slip: p.slip || 0, behind,
      templateChanged: (() => { const t = p.templateId && getTemplate(p.templateId); return !!t && (t.version || 1) > (p.templateVersion || 1); })(),
      clientName: (p.client && p.client.name) || '', templateId: p.templateId, templateName: ((p.templateId && getTemplate(p.templateId)) || {}).name || p.templateName, parts: p.parts,
      phases, current: cur ? cur.id : null, client, tools,
      time: { mins: time.mins, billable: time.billable, running: time.running },
      invoices: (p.invoices || []).map(x => ({ id: x.id, number: x.number, kind: x.kind, date: x.date, due: x.due, phaseId: x.phaseId, from: x.from, to: x.to, total: x.total, currency: x.currency, paid: x.paid, hours: x.kind === 'hours' ? x.lines.reduce((n, l) => n + (l.qty || 0), 0) : null })),
      rate: p.rate || '', billTo: p.billTo || '', paid: paidSoFar(p),
      accounts: accountsOf(p), traffic: trafficSummary(p),
      renewals: p.renewals && p.renewals.host === renewHost(p) ? { ...p.renewals, hosted: HOSTED.includes(p.platform), warnings: renewalWarnings(p) } : null,
    };
  }

  function summary(v) {
    const cur = v.phases.find(ph => ph.id === v.current) || null;
    return {
      id: v.id, kind: v.kind, name: v.name, host: v.host, url: v.url, launch: v.launch, iconRun: v.tools.iconRun, templateId: v.templateId, sample: v.sample, website: v.website,
      current: cur ? { index: cur.index, id: cur.id, name: cur.name, done: cur.done, total: cur.total, ready: cur.ready, needs: cur.handoff.needs, handoffTitle: cur.handoff.title } : null,
      phases: v.phases.map(ph => ({ state: ph.state, done: ph.done, total: ph.total })),
      clientOpen: v.client.late.length + v.client.soon.length, clientLate: v.client.late.length, behind: v.behind,
      // What's running for this project right now, for the sidebar.
      running: v.tools.launchRunning ? 'Launch check' : v.tools.seoRunning ? 'SEO plan' : v.tools.redirectsRunning ? (v.tools.redirectsRunning === 'build' ? 'Redirect map' : 'Redirect test')
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

  /**
   * Home: this week's work across every project, grouped by project. Late means the due date has passed, wherever the
   * item is, so these counts match the project page and the Client tab.
   */
  function home() {
    const now = today(), week = addDays(now, 7);
    const views = listRaw().filter(p => p.kind !== 'audit').map(view);
    // Sign-offs that are ready, then late work, then what's due soon, then what to ask for. Items left open in a phase
    // that's already signed off come last: they're still late, but they aren't this week's work.
    const rank = x => x.leftover ? '4' + (x.due || '') : (x.kind === 'signoff' && x.ready) || x.kind === 'watch' || x.kind === 'renewal' ? '0' : x.late ? '1' + (x.kind === 'client' ? 'a' : 'b') + (x.due || '') : x.kind === 'ask' ? '3' + (x.due || '') : '2' + (x.due || '9999');
    let overdue = 0, dueThisWeek = 0, dueToday = 0, toAsk = 0, signoffs = 0, watchIssues = 0;
    const raws = new Map(listRaw().map(p => [p.id, p])), p0 = id => raws.get(id);
    const groups = [], messages = [];
    for (const v of views) {
      const rows = [], base = { projectId: v.id };
      const cur = v.phases.find(ph => ph.id === v.current);
      if (cur && (cur.ready || (cur.due && cur.due <= week))) {
        rows.push({ ...base, kind: 'signoff', key: v.id + ':so', title: `Sign-off: ${cur.handoff.title}`, phaseId: cur.id, phaseName: cur.name, due: cur.due, late: !cur.ready && !!cur.due && cur.due < now, ready: cur.ready });
        if (cur.ready) signoffs++;
      }
      for (const ph of v.phases) for (const x of [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]) {
        if (x.status !== 'todo' || x.who !== 'us' || !x.due || x.due > week) continue;
        rows.push({ ...base, kind: 'item', key: v.id + ':' + x.id, itemId: x.id, title: x.title, phaseId: x.phaseId, phaseName: x.phaseName, due: x.due, late: x.late, leftover: ph.state === 'signed' });
        if (x.late) overdue++; else dueThisWeek++;
        if (x.due === now) dueToday++;
      }
      // An after-launch check in the last week that found new problems.
      const w = watchSummary(p0(v.id));
      if (w && w.issues && Date.now() - w.at < 7 * 864e5) { rows.push({ ...base, kind: 'watch', key: v.id + ':watch', title: `Day ${w.day} check after launch: ${w.issues} ${w.compared ? 'new ' : ''}${w.issues === 1 ? 'issue' : 'issues'}${w.compared ? '' : ' to fix'}`, checkId: w.checkId, due: iso(new Date(w.at)), late: false }); watchIssues++; }
      // An SSL certificate or a domain close to running out.
      for (const w of renewalWarnings(p0(v.id))) rows.push({ ...base, kind: 'renewal', key: v.id + ':renew:' + w.what, title: w.what === 'ssl' ? `SSL certificate for ${w.name} ${w.late ? 'has run out' : w.auto ? 'hasn’t renewed itself' : 'needs renewing'}` : `Domain ${w.name} ${w.late ? 'has expired' : 'needs renewing'}${w.by ? ` at ${w.by}` : ''}`, due: w.expires, late: w.late });
      for (const x of v.client.late) rows.push({ ...base, kind: 'client', key: v.id + ':' + x.id, itemId: x.id, title: x.title, phaseId: x.phaseId, phaseName: x.phaseName, due: x.due, late: true, asked: !!x.asked });
      for (const x of v.client.soon) if (x.due && x.due <= week) { rows.push({ ...base, kind: 'client', key: v.id + ':' + x.id, itemId: x.id, title: x.title, phaseId: x.phaseId, phaseName: x.phaseName, due: x.due, late: false, asked: true }); dueThisWeek++; }
      // Asking, reminding, the weekly update and invoices are messages, listed on their own at the top of Home.
      const askNow = v.client.notAsked.filter(x => x.askBy && x.askBy <= now).length;
      toAsk += askNow;
      const remind = [...v.client.late, ...v.client.soon].filter(x => x.remindDue).length;
      const started = !!v.kickoff && v.kickoff <= now;
      const update = started && !!v.current && !v.repeat && (!v.lastUpdate || Date.now() - v.lastUpdate >= 7 * 864e5);
      const invoices = v.phases.filter(ph => ph.payment && ph.state === 'signed' && !ph.payment.invoiced).map(ph => ({ phaseId: ph.id, label: ph.payment.label, amount: ph.payment.amount }));
      const unpaid = v.phases.filter(ph => ph.payment && ph.payment.invoiced && !ph.payment.paid && Date.now() - ph.payment.invoiced >= 14 * 864e5).map(ph => ({ phaseId: ph.id, label: ph.payment.label, amount: ph.payment.amount, invoiced: ph.payment.invoiced }));
      // Invoices for hours, two weeks after they were made, or once they're past their due date.
      for (const inv of p0(v.id).invoices || []) if (inv.kind === 'hours' && !inv.paid && (Date.now() - inv.at >= 14 * 864e5 || (inv.due && inv.due < now))) unpaid.push({ phaseId: null, invoiceId: inv.id, label: `Invoice ${inv.number}`, amount: INVO.fmtMoney(inv.total, inv.currency), invoiced: inv.at });
      if (askNow || remind || update || invoices.length || unpaid.length) messages.push({ projectId: v.id, projectName: v.name, iconRun: v.tools.iconRun, clientName: v.clientName, ask: askNow, remind, update, lastUpdate: v.lastUpdate, invoices, unpaid });
      rows.sort((a, c) => rank(a) < rank(c) ? -1 : 1);
      if (rows.length) groups.push({ projectId: v.id, projectName: v.name, iconRun: v.tools.iconRun, rows: rows.slice(0, 5), more: Math.max(0, rows.length - 5), late: rows.filter(x => x.late && x.kind !== 'signoff').length });
    }
    groups.sort((a, c) => rank(a.rows[0]) < rank(c.rows[0]) ? -1 : 1);
    const launches = views.filter(v => v.launch && v.launch >= now).sort((a, b) => a.launch < b.launch ? -1 : 1);
    return {
      groups, messages,
      stats: {
        dueThisWeek, dueToday, overdue, toAsk, signoffs, watchIssues,
        waiting: views.reduce((n, v) => n + v.client.late.length + v.client.soon.length, 0),
        late: views.reduce((n, v) => n + v.client.late.length, 0),
        nextLaunch: launches[0] ? { name: launches[0].name, date: launches[0].launch } : null,
      },
      projects: listRaw().map(p => summary(view(p))).sort((a, b) => (a.launch || '9999') < (b.launch || '9999') ? -1 : 1),
    };
  }

  /**
   * A repeating project (the monthly care plan) starts its next round: this month is kept as a summary, every item
   * opens again, and the dates move on a month.
   */
  function nextCycle(id) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    if (!p.repeat) throw new Error('This project doesn’t repeat.');
    const v = view(p), all = v.phases.flatMap(ph => [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]);
    // The same day next month, or its last day when next month is shorter (Jan 31 to Feb 28).
    const month = s => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()))); };
    p.cycles = [{ at: Date.now(), kickoff: p.kickoff, launch: p.launch, done: all.filter(x => x.status !== 'todo').length, total: all.length }, ...(p.cycles || [])].slice(0, 60);
    p.state = {}; p.signoffs = {}; p.slip = 0; p.cycleStart = Date.now();
    if (p.kickoff) p.kickoff = month(p.kickoff);
    if (p.launch) p.launch = month(p.launch);
    writeRaw(p);
  }

  /**
   * A sample project to look around in on first run: made-up client, a few weeks in, some items done, the client
   * asked for a few things and one of them late. It has no websites, so nothing is scanned.
   */
  function createSample() {
    const d = n => addDays(today(), n);
    const t = getTemplate('website-lean') || allTemplates().find(x => x.kind === 'checklist');
    const p = create({ name: 'Northwind Dental (sample)', clientName: 'Dana Whitfield', templateId: t.id, kickoff: d(-18), launch: d(52), parts: ['content', 'integrations'], platform: 'webflow' });
    p.sample = true;
    const ph = p.phases[0], items = [...ph.groups.flatMap(g => g.items), ...ph.handoff.items];
    const at = n => Date.now() - n * 864e5;
    items.filter(x => x.who === 'us' && !x.tool).slice(0, 3).forEach((x, i) => { p.state[x.id] = { s: 'done', at: at(14 - i * 3), hist: [{ at: at(14 - i * 3), what: 'Marked done' }] }; });
    items.filter(x => x.who === 'client').forEach((x, i) => { p.state[x.id] = i < 2 ? { s: 'done', at: at(9), asked: at(16), hist: [{ at: at(9), what: 'Marked done' }, { at: at(16), what: 'Asked the client' }] } : { asked: at(12), hist: [{ at: at(12), what: 'Asked the client' }] }; });
    writeRaw(p);
    return p;
  }
  const dirOf = id => (/^[a-z0-9]+$/.test(id) ? pdir(id) : null);

  /** The weekly client update was sent: the next one is due in a week. */
  function markUpdate(id) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    p.updates = [{ at: Date.now() }, ...(p.updates || [])].slice(0, 100); writeRaw(p);
  }
  /**
   * A payment milestone at a phase's sign-off, like "Second instalment, 40%". It's invoiced once the phase is signed
   * off, then paid. `remove` takes it off again.
   */
  function setPayment(id, phaseId, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    if (!p.phases.some(ph => ph.id === phaseId)) throw new Error('Unknown phase.');
    p.payments = p.payments || {};
    if (b.remove) delete p.payments[phaseId];
    else {
      const cur = p.payments[phaseId] || { label: '', amount: '', invoiced: null, paid: null };
      if ('label' in b) cur.label = String(b.label || '').trim().slice(0, 80) || 'Payment';
      if ('amount' in b) cur.amount = String(b.amount || '').trim().slice(0, 40);
      if ('invoiced' in b) cur.invoiced = b.invoiced ? Date.now() : null;
      if ('paid' in b) { cur.paid = b.paid ? Date.now() : null; if (b.paid && !cur.invoiced) cur.invoiced = cur.paid; }
      p.payments[phaseId] = cur;
    }
    writeRaw(p);
  }

  // ---------- invoices ----------
  // projects/<id>/project.json keeps each invoice: its number, lines and total, what it was for (a payment milestone, or
  // hours logged), and when it was paid. The PDF is made again from it whenever it's downloaded.
  const nextNumber = s => { const m = String(s || 'INV-0000').match(/^(.*?)(\d+)$/); return m ? m[1] + String(+m[2] + 1).padStart(m[2].length, '0') : String(s) + '-2'; };
  /**
   * A new invoice to look over before it's saved. `kind` 'milestone' bills a phase's payment; 'hours' bills the
   * billable time not invoiced yet between `from` and `to` (from `entries`), one line per item or task, at `rate`.
   */
  function invoiceDraft(id, b, { entries = [], rate, number, payDays = 14 } = {}) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const d = { kind: b.kind === 'hours' ? 'hours' : 'milestone', number: number || 'INV-0001', date: today(), due: addDays(today(), Math.max(0, +payDays || 14)), billTo: p.billTo || [p.client && p.client.name, p.name].filter(Boolean).join('\n'), note: '', lines: [], currency: { before: '$', after: '' }, total: 0 };
    if (d.kind === 'milestone') {
      const ph = p.phases.find(x => x.id === b.phaseId), pay = ph && (p.payments || {})[ph.id];
      if (!pay) throw new Error('Add the payment for this sign-off first.');
      const money = INVO.parseMoney(pay.amount);
      if (!money) throw new Error('Add the payment’s amount first, like $2,400.');
      d.phaseId = ph.id; d.currency = { before: money.before || (money.after ? '' : '$'), after: money.after };
      d.lines = [{ text: pay.label || `${ph.name} sign-off`, sub: `${p.name}: ${ph.handoff.title}`, amount: money.n }];
    } else {
      const r = INVO.parseMoney(b.rate || p.rate || rate);
      if (!r || r.n <= 0) throw new Error('Set an hourly rate first, like $90.');
      d.currency = { before: r.before || (r.after ? '' : '$'), after: r.after }; d.rate = r.n;
      const list = entries.filter(e => e.projectId === id && e.billable && !e.invoice && (!b.from || e.day >= b.from) && (!b.to || e.day <= b.to));
      if (!list.length) throw new Error(b.from || b.to ? 'There’s no billable time to invoice in those dates. Time already on an invoice isn’t billed twice.' : 'All the billable time is on an invoice already. Time already on an invoice isn’t billed twice.');
      d.from = b.from || list.map(e => e.day).sort()[0]; d.to = b.to || list.map(e => e.day).sort().pop(); d.entryIds = list.map(e => e.id);
      // One line per checklist item or task, else per description; the biggest first.
      const groups = new Map();
      for (const e of list) { const k = e.itemId ? 'i:' + e.itemId : e.taskId ? 't:' + e.taskId : 'x:' + (e.title || '').toLowerCase(); const g = groups.get(k) || { text: (e.item && e.item.title) || e.title || 'Work', mins: 0, n: 0 }; g.mins += e.mins; g.n++; groups.set(k, g); }
      d.lines = [...groups.values()].sort((a, b2) => b2.mins - a.mins).map(g => ({ text: g.text, qty: INVO.hrs(g.mins), unit: r.n, amount: Math.round(INVO.hrs(g.mins) * r.n * 100) / 100 }));
      d.mins = list.reduce((n, e) => n + e.mins, 0);
    }
    d.total = Math.round(d.lines.reduce((n, l) => n + (+l.amount || 0), 0) * 100) / 100;
    return d;
  }
  /** Saves an invoice as looked over and edited. A milestone's payment is marked invoiced. */
  function saveInvoice(id, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const lines = (Array.isArray(b.lines) ? b.lines : []).map(l => ({ text: String(l.text || '').trim().slice(0, 300), sub: l.sub ? String(l.sub).slice(0, 300) : undefined, qty: l.qty == null || l.qty === '' ? undefined : +l.qty, unit: l.unit == null || l.unit === '' ? undefined : +l.unit, amount: Math.round((+l.amount || 0) * 100) / 100 })).filter(l => l.text || l.amount);
    if (!lines.length) throw new Error('The invoice has no lines.');
    const number = String(b.number || '').trim().slice(0, 40);
    if (!number) throw new Error('Give the invoice a number.');
    if ((p.invoices || []).some(x => x.number === number)) throw new Error(`This project already has invoice ${number}.`);
    const inv = {
      id: newId(), number, kind: b.kind === 'hours' ? 'hours' : 'milestone', date: b.date || today(), due: b.due || null,
      phaseId: b.kind === 'hours' ? null : b.phaseId || null, from: b.from || null, to: b.to || null, entryIds: b.kind === 'hours' ? (b.entryIds || []).slice(0, 5000) : [],
      lines, total: Math.round(lines.reduce((n, l) => n + l.amount, 0) * 100) / 100, currency: b.currency && typeof b.currency === 'object' ? { before: String(b.currency.before || '').slice(0, 4), after: String(b.currency.after || '').slice(0, 4) } : { before: '$', after: '' },
      billTo: String(b.billTo || '').slice(0, 600), note: String(b.note || '').slice(0, 1000), at: Date.now(), paid: null,
    };
    p.invoices = [inv, ...(p.invoices || [])];
    p.billTo = inv.billTo;
    if (inv.phaseId && (p.payments || {})[inv.phaseId]) { const pay = p.payments[inv.phaseId]; pay.invoiced = pay.invoiced || Date.now(); pay.invoiceId = inv.id; }
    writeRaw(p);
    return inv;
  }
  const getInvoice = (id, invId) => { const p = readRaw(id); return p && (p.invoices || []).find(x => x.id === invId) || null; };
  /** Paid, or not paid after all. A milestone's payment follows. */
  function setInvoice(id, invId, b) {
    const p = readRaw(id), inv = p && (p.invoices || []).find(x => x.id === invId);
    if (!inv) throw new Error('That invoice doesn’t exist any more.');
    if ('paid' in b) {
      inv.paid = b.paid ? Date.now() : null;
      const pay = inv.phaseId && (p.payments || {})[inv.phaseId];
      if (pay) pay.paid = inv.paid;
    }
    writeRaw(p);
    return inv;
  }
  /** Removes an invoice made by mistake. Its time can be invoiced again, and a milestone goes back to "ready to invoice". */
  function removeInvoice(id, invId) {
    const p = readRaw(id), inv = p && (p.invoices || []).find(x => x.id === invId);
    if (!inv) return null;
    p.invoices = p.invoices.filter(x => x.id !== invId);
    const pay = inv.phaseId && (p.payments || {})[inv.phaseId];
    if (pay && pay.invoiceId === inv.id) { pay.invoiced = null; pay.paid = null; delete pay.invoiceId; }
    writeRaw(p);
    return inv;
  }
  /** What's been paid on the project so far: payments marked paid and paid hours invoices, in one currency. */
  function paidSoFar(p) {
    const amounts = [];
    for (const pay of Object.values(p.payments || {})) if (pay.paid) { const m = INVO.parseMoney(pay.amount); if (m) amounts.push({ n: m.n, cur: { before: m.before || (m.after ? '' : '$'), after: m.after } }); }
    for (const inv of p.invoices || []) if (inv.paid && inv.kind === 'hours') amounts.push({ n: inv.total, cur: inv.currency });
    if (!amounts.length) return null;
    const key = c => (c.before || '') + '|' + (c.after || '');
    const cur = amounts[0].cur;
    const same = amounts.filter(a => key(a.cur) === key(cur));
    return { amount: Math.round(same.reduce((n, a) => n + a.n, 0) * 100) / 100, currency: cur, mixed: same.length < amounts.length };
  }

  /** Key dates as a calendar: launches and sign-offs, and with `items` every open item with a due date. */
  function calendar({ items = false } = {}) {
    const esc = t => String(t).replace(/[\\,;]/g, m => '\\' + m).replace(/\n/g, '\\n');
    const d8 = s => s.replace(/-/g, '');
    const next = s => d8(addDays(s, 1));
    const ev = (uid, date, title, desc) => ['BEGIN:VEVENT', `UID:${uid}@groundwork`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART;VALUE=DATE:${d8(date)}`, `DTEND;VALUE=DATE:${next(date)}`, `SUMMARY:${esc(title)}`, ...(desc ? [`DESCRIPTION:${esc(desc)}`] : []), 'END:VEVENT'];
    const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Groundwork//Projects//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Groundwork'];
    for (const p of listRaw()) {
      if (p.kind === 'audit') continue;
      const v = view(p);
      if (v.launch) lines.push(...ev(`${v.id}-launch`, v.launch, `${v.labels && v.labels.launch || 'Launch'}: ${v.name}`));
      // Renewal dates: the domain always, the certificate when it doesn't renew itself.
      const rn = p.renewals && p.renewals.host === renewHost(p) ? p.renewals : null;
      if (rn && rn.domain && rn.domain.expires) lines.push(...ev(`${v.id}-domain`, rn.domain.expires, `Domain renews: ${rn.domain.domain} (${v.name})`, rn.domain.registrar ? `Registered with ${rn.domain.registrar}` : ''));
      if (rn && rn.ssl && rn.ssl.expires && !rn.ssl.auto && !HOSTED.includes(p.platform)) lines.push(...ev(`${v.id}-ssl`, rn.ssl.expires, `SSL certificate runs out: ${rn.host} (${v.name})`, rn.ssl.issuer ? `Issued by ${rn.ssl.issuer}` : ''));
      for (const ph of v.phases) {
        if (ph.due && ph.state !== 'signed') lines.push(...ev(`${v.id}-${ph.id}-signoff`, ph.due, `Sign-off due: ${ph.handoff.title} (${v.name})`));
        if (items) for (const x of [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]) if (x.status === 'todo' && x.due) lines.push(...ev(`${v.id}-${x.id}`, x.due, `${x.who === 'client' ? 'From the client: ' : ''}${x.title} (${v.name})`, ph.name));
      }
    }
    lines.push('END:VCALENDAR');
    // Calendar lines are folded at 75 characters.
    return lines.map(l => l.length <= 74 ? l : l.match(/.{1,73}/g).join('\r\n ')).join('\r\n') + '\r\n';
  }

  /** Every checklist item, for quick find: open ones first. */
  function searchItems() {
    const out = [];
    for (const p of listRaw()) {
      if (p.kind === 'audit') continue;
      const v = view(p);
      for (const ph of v.phases) for (const x of [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]) out.push({ projectId: v.id, projectName: v.name, iconRun: v.tools.iconRun, id: x.id, title: x.title, phaseName: x.phaseName, status: x.status, who: x.who, late: x.late });
    }
    return out.sort((a, b) => (a.status === 'todo' ? 0 : 1) - (b.status === 'todo' ? 0 : 1)).slice(0, 3000);
  }

  /** A checklist item's title and phase, for the time log and tasks that point at it. */
  function itemRef(id, itemId) {
    const p = readRaw(id); if (!p) return null;
    for (const ph of p.phases) for (const it of [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]) if (it.id === itemId) return { title: it.title, phase: ph.name, done: ((p.state[itemId] || {}).s || 'todo') !== 'todo' };
    return null;
  }

  /** A scan found the site's platform: fill it in on a project that doesn't have one yet. */
  function notePlatform(id, scanPlatform) {
    const p = readRaw(id), pf = PF.ofScan(scanPlatform);
    if (p && pf && !p.platform) { p.platform = pf; writeRaw(p); }
  }

  // An audit project for a site scanned outside a project (from before projects owned their scans).
  function createAudit({ name, url }) { return create({ kind: 'audit', name, sites: { live: url } }); }
  return { TOOLS, importTraffic, removeTraffic, setAccounts, checkRenewals, renewalsDue, itemRef, invoiceDraft, saveInvoice, getInvoice, setInvoice, removeInvoice, nextNumber, markUpdate, setPayment, calendar, searchItems, newId, dirOf, createSample, notePlatform, nextCycle, sitesOf, runsOf, createAudit, listRaw, startLaunch, getLaunch, launchRunning, cancelLaunch, cancelRedirects, watchTick, getInventory, buildInventory, setInventory, applyInventory, startRedirectBuild, startRedirectTest, startRedirectList, addToMap, compare, setRedirects, redirectState, redirectsRunning, templateList, getTemplate, saveTemplate, createTemplate, removeTemplate, list, get, create, update, shiftPlan, templateUpdate, setItem, askItems, signoff, unsign, remove, home, filePath, readRaw };
};
