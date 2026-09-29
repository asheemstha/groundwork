// Projects and templates. A project is a client site plus its own copy of a checklist template.
// Everything is stored as JSON in the data folder: templates.json, and projects/<id>/project.json (+ files/ for proof).
const fs = require('fs'), path = require('path');
const { defaults } = require('./templates-default');

const TOOLS = {
  scan: { name: 'Site scan', ready: true },
  headings: { name: 'Heading plan', ready: true },
  seo: { name: 'SEO plan', ready: false },
  launch: { name: 'Launch check', ready: false },
  redirects: { name: 'Redirect check', ready: false },
};

module.exports = function projects({ DATA, readJson, writeJson, runsFor, hostOf }) {
  const PDIR = path.join(DATA, 'projects');
  const TFILE = path.join(DATA, 'templates.json');
  fs.mkdirSync(PDIR, { recursive: true });
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

  // ---------- dates (plain YYYY-MM-DD, local time) ----------
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const today = () => iso(new Date());
  const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };
  const dueOf = (rule, p) => {
    if (!rule) return null;
    const base = rule.from === 'launch' ? p.launch : p.kickoff;
    return base ? addDays(base, rule.days || 0) : null;
  };

  // ---------- templates ----------
  function allTemplates() {
    let t = readJson(TFILE, null);
    if (!t) { t = defaults(); writeJson(TFILE, t); }
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

  function create(b) {
    const t = getTemplate(b.templateId || 'website');
    if (!t || t.kind !== 'checklist') throw new Error('Pick a checklist template.');
    const parts = Array.isArray(b.parts) ? b.parts : [];
    const keep = it => !it.part || parts.includes(it.part);
    const p = {
      id: newId(), name: String(b.name || '').trim() || (b.url ? hostOf(b.url) : 'New project'), url: b.url || null, host: b.url ? hostOf(b.url) : null,
      created: Date.now(), kickoff: b.kickoff || null, launch: b.launch || null,
      client: { name: String(b.clientName || '').trim() },
      templateId: t.id, templateName: t.name, templateVersion: t.version || 1, parts,
      phases: t.phases.map(ph => ({ ...ph, groups: ph.groups.map(g => ({ ...g, items: g.items.filter(keep) })).filter(g => g.items.length), handoff: { ...ph.handoff, items: ph.handoff.items.filter(keep) } })),
      state: {}, signoffs: {},
    };
    writeRaw(p);
    return p;
  }
  function update(id, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    for (const k of ['name', 'kickoff', 'launch']) if (k in b) p[k] = b[k] || (k === 'name' ? p.name : null);
    if ('clientName' in b) p.client = { ...(p.client || {}), name: String(b.clientName || '').trim() };
    if ('url' in b && b.url) { p.url = b.url; p.host = hostOf(b.url); }
    writeRaw(p); return p;
  }
  function setItem(id, itemId, b) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    const s = { ...(p.state[itemId] || {}) };
    if ('status' in b) { s.s = b.status; s.at = Date.now(); }
    if ('note' in b) s.note = String(b.note || '').slice(0, 4000);
    if ('link' in b) s.link = String(b.link || '').slice(0, 1000);
    if ('asked' in b) s.asked = b.asked ? (typeof b.asked === 'number' ? b.asked : Date.now()) : null;
    if ('due' in b) s.due = b.due || null;
    p.state[itemId] = s; writeRaw(p);
  }
  function askItems(id, itemIds) {
    const p = readRaw(id); if (!p) throw new Error('That project doesn’t exist any more.');
    for (const i of itemIds) if (!(p.state[i] || {}).asked) p.state[i] = { ...(p.state[i] || {}), asked: Date.now() };
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

  // ---------- projects: what the app shows ----------
  function toolState(p) {
    const runs = p.host ? runsFor(p.host) : [];
    const scanned = runs.find(r => (r.pages || []).length && !['scanning', 'scan_failed'].includes(r.status));
    const plan = runs.find(r => ['done', 'partial'].includes(r.status));
    const prog = plan && plan.progress ? plan.progress.now || plan.progress.all || null : null;
    return {
      runs: runs.map(r => ({ id: r.id, status: r.status, created: r.created, pages: (r.pages || []).length, output: r.settings && r.settings.output || null, progress: r.progress || null, hasIcon: !!r.favicon })),
      scan: scanned ? { runId: scanned.id, urls: scanned.pages.length, at: scanned.created } : null,
      plan: plan ? { runId: plan.id, done: prog ? prog.done : 0, total: prog ? prog.tasks : 0, all: plan.progress && plan.progress.all || null, at: plan.created, output: plan.settings && plan.settings.output } : null,
      iconRun: (runs.find(r => r.favicon) || runs[0] || {}).id || null,
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
      if (it.tool && TOOLS[it.tool]) {
        toolInfo = { id: it.tool, ...TOOLS[it.tool] };
        if (it.tool === 'scan' && tools.scan) { toolInfo.text = `Done by the scan, ${tools.scan.urls} URLs saved`; toolInfo.runId = tools.scan.runId; if (!s.s) { status = 'done'; auto = true; } }
        if (it.tool === 'headings' && tools.plan) {
          toolInfo.progress = { done: tools.plan.done, total: tools.plan.total }; toolInfo.runId = tools.plan.runId;
          toolInfo.text = tools.plan.total ? `${tools.plan.done} of ${tools.plan.total} tag fixes done` : 'Plan ready';
          if (!s.s && tools.plan.total && tools.plan.done >= tools.plan.total) { status = 'done'; auto = true; }
        }
      }
      const due = s.due || dueOf(it.due || ph.due, p);
      return { id: it.id, title: it.title, doneMeans: it.done || '', who: it.who, part: it.part || null, tool: it.tool || null, toolInfo, due, status, auto, at: s.at || null, note: s.note || '', link: s.link || '', asked: s.asked || null, phaseId: ph.id, phaseName: ph.name, late: status === 'todo' && !!due && due < now };
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
    const client = {
      late: clientOpen.filter(x => x.asked && x.late).sort(byDue),
      soon: clientOpen.filter(x => x.asked && !x.late).sort(byDue),
      notAsked: clientOpen.filter(x => !x.asked).sort(byDue).map(x => ({ ...x, askBy: x.due ? addDays(x.due, -7) : null })),
      received: items.filter(x => x.who === 'client' && x.status === 'done').length,
    };
    const cur = phases[currentIdx] || null;
    return {
      id: p.id, name: p.name, url: p.url, host: p.host, created: p.created, updated: p.updated, kickoff: p.kickoff, launch: p.launch,
      clientName: (p.client && p.client.name) || '', templateId: p.templateId, templateName: p.templateName, parts: p.parts,
      phases, current: cur ? cur.id : null, client, tools,
    };
  }

  function summary(v) {
    const cur = v.phases.find(ph => ph.id === v.current) || null;
    return {
      id: v.id, name: v.name, host: v.host, url: v.url, launch: v.launch, iconRun: v.tools.iconRun,
      current: cur ? { index: cur.index, id: cur.id, name: cur.name, done: cur.done, total: cur.total, ready: cur.ready, needs: cur.handoff.needs, handoffTitle: cur.handoff.title } : null,
      phases: v.phases.map(ph => ({ state: ph.state, done: ph.done, total: ph.total })),
      clientOpen: v.client.late.length + v.client.soon.length, clientLate: v.client.late.length,
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

  return { TOOLS, templateList, getTemplate, saveTemplate, createTemplate, removeTemplate, list, get, create, update, setItem, askItems, signoff, unsign, remove, home, filePath, readRaw };
};
