// Time and tasks: the work log and the day's task list, across every project.
// data/time.json holds the log, data/timer.json the one running timer, data/tasks.json the task list.
// Every entry records who logged it (your name from Settings), so a studio's logs can be put together later.
const path = require('path');

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => iso(new Date());
const isDay = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));
const addDays = (s, n) => { const [y, m, d] = s.split('-').map(Number); return iso(new Date(y, m - 1, d + n)); };

/**
 * A length of time typed by hand, in minutes: "1h 30m", "1.5h", "90m", "45 min", "1:30", "2 hours". A bare number is
 * hours, as in most timesheets ("1.5" is an hour and a half).
 */
function parseDur(s) {
  s = String(s || '').trim().toLowerCase().replace(',', '.');
  if (!s) return null;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return +m[1] * 60 + +m[2];
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Math.round(+m[1] * 60);
  m = s.match(/^(?:(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours))?\s*(?:(\d+)\s*(?:m|min|mins|minute|minutes))?$/);
  if (m && (m[1] || m[2])) return Math.round((+m[1] || 0) * 60 + (+m[2] || 0));
  return null;
}
/** A task typed as "Call Sam 30m": the title, and the time at the end as its estimate. */
function parseTask(text) {
  const t = String(text || '').trim().replace(/\s+/g, ' ');
  const m = t.match(/^(.*?\S)\s+((?:\d+(?:[.,]\d+)?\s*(?:h|hr|hrs|hour|hours))(?:\s*\d+\s*(?:m|min|mins|minutes))?|\d+\s*(?:m|min|mins|minutes))$/i);
  if (m) { const est = parseDur(m[2]); if (est) return { title: m[1], est }; }
  return { title: t, est: null };
}

module.exports = function time({ DATA, readJson, writeJson, newId, who, projectOf, itemOf }) {
  const TF = path.join(DATA, 'time.json'), RF = path.join(DATA, 'timer.json'), KF = path.join(DATA, 'tasks.json');
  // The log is read for every project view, so it's kept in memory and written through.
  let cache = null;
  const entries = () => (cache || (cache = (readJson(TF, null) || {}).entries || []));
  const saveEntries = list => { cache = list; writeJson(TF, { version: 1, entries: list }); };
  const running = () => readJson(RF, null);
  const setRunning = r => writeJson(RF, r);
  const tasks = () => (readJson(KF, null) || {}).tasks || [];
  const saveTasks = list => writeJson(KF, { version: 1, tasks: list });

  const clean = (s, n = 200) => String(s || '').trim().replace(/\s+/g, ' ').slice(0, n);
  // A project and checklist item an entry or task points at. An item only counts in its own project.
  function link(b, cur = {}) {
    const out = {};
    if ('projectId' in b) {
      const p = b.projectId ? projectOf(b.projectId) : null;
      if (b.projectId && !p) throw new Error('That project doesn’t exist any more.');
      out.projectId = p ? b.projectId : null; out.pname = p ? p.name : null;
      if (!('itemId' in b) && cur.projectId !== out.projectId) out.itemId = null;
    }
    if ('itemId' in b) {
      const pid = 'projectId' in out ? out.projectId : cur.projectId;
      const it = b.itemId && pid ? itemOf(pid, b.itemId) : null;
      out.itemId = it ? b.itemId : null;
    }
    return out;
  }

  // Lookups for one list: each project and item is read once.
  const lookups = () => {
    const P = new Map(), I = new Map();
    return {
      p: id => (P.has(id) ? P.get(id) : (P.set(id, projectOf(id)), P.get(id))),
      i: (pid, iid) => { const k = pid + '|' + iid; return I.has(k) ? I.get(k) : (I.set(k, itemOf(pid, iid)), I.get(k)); },
    };
  };

  // ---------- the log ----------
  function list({ from, to, projectId } = {}) {
    const L = lookups();
    return entries()
      .filter(e => (!from || e.day >= from) && (!to || e.day <= to) && (!projectId || e.projectId === projectId))
      .sort((a, b) => (a.day === b.day ? (b.start || b.at || 0) - (a.start || a.at || 0) : a.day < b.day ? 1 : -1))
      .map(e => view(e, L));
  }
  // What an entry shows: the project's current name, and the checklist item it's for.
  function view(e, L = lookups()) {
    const p = e.projectId ? L.p(e.projectId) : null;
    const it = e.itemId && p ? L.i(e.projectId, e.itemId) : null;
    return { ...e, pname: p ? p.name : e.pname || null, gone: !!e.projectId && !p, item: it ? { title: it.title, phase: it.phase } : null };
  }
  function add(b) {
    const mins = typeof b.mins === 'number' ? Math.round(b.mins) : parseDur(b.dur);
    if (!mins || mins < 1) throw new Error('Add how long, like 1h 30m.');
    if (mins > 24 * 60) throw new Error('That’s more than a day. Add it one day at a time.');
    const day = isDay(b.day) ? b.day : today();
    const l = link({ projectId: b.projectId || null, itemId: b.itemId || null });
    const it = l.itemId ? itemOf(l.projectId, l.itemId) : null;
    const title = clean(b.title) || (it ? it.title : '');
    if (!title && !l.projectId) throw new Error('Say what you worked on, or pick a project.');
    const e = { id: newId(), who: who(), ...l, taskId: b.taskId || null, title, day, mins, start: null, end: null, billable: 'billable' in b ? !!b.billable : !!l.projectId, by: 'hand', at: Date.now() };
    saveEntries([...entries(), e]);
    return view(e);
  }
  function edit(id, b) {
    const all = entries(), i = all.findIndex(e => e.id === id);
    if (i < 0) throw new Error('That time entry doesn’t exist any more.');
    const e = { ...all[i], ...link(b, all[i]) };
    if ('title' in b) e.title = clean(b.title);
    if ('billable' in b) e.billable = !!b.billable;
    if ('day' in b && isDay(b.day)) e.day = b.day;
    // A start and end time (from the edit form) set the length; otherwise a length typed by hand.
    if (b.start && b.end && +b.end > +b.start) { e.start = +b.start; e.end = +b.end; e.mins = Math.max(1, Math.round((e.end - e.start) / 60e3)); e.day = iso(new Date(e.start)); }
    else if ('dur' in b || 'mins' in b) {
      const mins = typeof b.mins === 'number' ? Math.round(b.mins) : parseDur(b.dur);
      if (!mins || mins < 1 || mins > 24 * 60) throw new Error('Add how long, like 1h 30m.');
      if (mins !== e.mins) { e.mins = mins; if (e.start) e.end = e.start + mins * 60e3; }
    }
    all[i] = e; saveEntries([...all]);
    return view(e);
  }
  function remove(id) { saveEntries(entries().filter(e => e.id !== id)); }

  // ---------- the timer ----------
  // One at a time: starting another stops the first. A timer under a minute isn't kept.
  function start(b) {
    const stopped = running() ? stop() : null;
    const l = link({ projectId: b.projectId || null, itemId: b.itemId || null });
    const task = b.taskId ? tasks().find(t => t.id === b.taskId) : null;
    const it = l.itemId ? itemOf(l.projectId, l.itemId) : null;
    const title = clean(b.title) || (task ? task.title : '') || (it ? it.title : '');
    const now = Date.now();
    const r = { id: newId(), who: who(), ...l, taskId: task ? task.id : null, title, start: now, billable: 'billable' in b ? !!b.billable : !!l.projectId, checked: null, idleFrom: null, away: null, tick: now };
    setRunning(r);
    return { running: r, stopped };
  }
  /** Stops the timer, at `at` when given (a time it was forgotten), and logs it. */
  function stop({ at } = {}) {
    const r = running(); if (!r) return null;
    const end = Math.min(Date.now(), Math.max(r.start, +at || Date.now()));
    setRunning(null);
    const mins = Math.round((end - r.start) / 60e3);
    if (mins < 1) return { dropped: true };
    const e = { id: r.id, who: r.who, projectId: r.projectId, pname: r.pname, itemId: r.itemId, taskId: r.taskId, title: r.title, day: iso(new Date(r.start)), mins, start: r.start, end, billable: r.billable, by: 'timer', at: Date.now() };
    saveEntries([...entries(), e]);
    return view(e);
  }
  /** The running timer as the app shows it, with how long it's run. */
  function current() {
    const r = running(); if (!r) return null;
    const p = r.projectId ? projectOf(r.projectId) : null, it = p && r.itemId ? itemOf(r.projectId, r.itemId) : null;
    return { ...r, pname: p ? p.name : r.pname, item: it ? { title: it.title, phase: it.phase } : null, now: Date.now() };
  }
  /** "Still on it" at the 3-hour check-in. */
  function still() { const r = running(); if (r) { r.checked = Date.now(); r.away = null; setRunning(r); } return current(); }
  /**
   * After time away from the Mac with the timer running: `keep` leaves it as it is, `trim` logs up to when you left and
   * carries on from when you came back, `stop` logs up to when you left and stops.
   */
  function away(what) {
    const r = running(); if (!r || !r.away) return current();
    const a = r.away;
    if (what === 'keep') { r.away = null; r.checked = Date.now(); setRunning(r); return current(); }
    stop({ at: a.from });
    if (what === 'trim') { setRunning({ ...r, id: newId(), start: a.to, away: null, idleFrom: null, checked: null, tick: Date.now() }); }
    return current();
  }
  /**
   * Called every minute, with how long the Mac has had no keyboard or mouse input (seconds) when that's known. A gap
   * since the last call means the Mac slept or Groundwork was closed; 15 minutes or more of no input counts as away.
   */
  function tick(idleSec) {
    const r = running(); if (!r) return;
    const now = Date.now(), last = r.tick || r.start;
    // Asleep or closed: away since the last call, or since input stopped before it.
    if (now - last > 10 * 60e3) r.idleFrom = Math.max(r.start, Math.min(r.idleFrom || last, last));
    const back = idleSec == null ? (r.idleFrom ? now : null) : idleSec >= 300 ? null : now - idleSec * 1000;
    if (idleSec != null && idleSec >= 300) r.idleFrom = r.idleFrom || now - idleSec * 1000;
    else if (r.idleFrom && back) { if (!r.away && back - r.idleFrom >= 15 * 60e3) r.away = { from: r.idleFrom, to: back }; r.idleFrom = null; }
    r.tick = now; setRunning(r);
  }

  // ---------- totals ----------
  const sum = list => list.reduce((n, e) => n + e.mins, 0);
  /** A project's time: the total, what's billable, and the minutes on each checklist item. The running timer counts. */
  function forProject(id, from = null) {
    const mine = entries().filter(e => e.projectId === id), r = running();
    const items = {};
    for (const e of mine) if (e.itemId) items[e.itemId] = (items[e.itemId] || 0) + e.mins;
    const live = r && r.projectId === id ? Math.round((Date.now() - r.start) / 60e3) : 0;
    if (live && r.itemId) items[r.itemId] = (items[r.itemId] || 0) + live;
    // `from` (a day) also counts the time since then: a care plan's month.
    const since = from ? sum(mine.filter(e => e.day >= from)) + live : null;
    return { mins: sum(mine) + live, billable: sum(mine.filter(e => e.billable)) + (r && r.billable ? live : 0), since, items, running: r && r.projectId === id ? { itemId: r.itemId, start: r.start } : null };
  }
  function dayTotal(day = today()) {
    const list = entries().filter(e => e.day === day), r = running();
    const live = r && iso(new Date(r.start)) <= day && day === today() ? Math.round((Date.now() - Math.max(r.start, new Date(day + 'T00:00').getTime())) / 60e3) : 0;
    return { mins: sum(list) + live, billable: sum(list.filter(e => e.billable)) + (r && r.billable ? live : 0) };
  }

  // ---------- tasks ----------
  // The day's list: open tasks planned for today or earlier (they roll over), and the ones done today.
  function taskList(day = today()) {
    const all = tasks(), r = running(), logged = {}, L = lookups();
    for (const e of entries()) if (e.taskId) logged[e.taskId] = (logged[e.taskId] || 0) + e.mins;
    if (r && r.taskId) logged[r.taskId] = (logged[r.taskId] || 0) + Math.round((Date.now() - r.start) / 60e3);
    return all
      .filter(t => (!t.done && t.day <= day) || (t.done && iso(new Date(t.done)) === day))
      .sort((a, b) => (!!a.done - !!b.done) || (a.order ?? a.created) - (b.order ?? b.created))
      .map(t => {
        const p = t.projectId ? L.p(t.projectId) : null, it = t.itemId && p ? L.i(t.projectId, t.itemId) : null;
        return { ...t, pname: p ? p.name : null, item: it ? { title: it.title, phase: it.phase, done: it.done } : null, mins: logged[t.id] || 0 };
      });
  }
  function addTask(b) {
    // Typed text carries an estimate at the end; a title from a checklist item is taken as it is.
    const { title, est } = b.text != null ? parseTask(b.text) : { title: b.title, est: null };
    const l = link({ projectId: b.projectId || null, itemId: b.itemId || null });
    if (l.itemId && tasks().some(t => !t.done && t.projectId === l.projectId && t.itemId === l.itemId)) throw new Error('That’s already in your tasks.');
    const it = l.itemId ? itemOf(l.projectId, l.itemId) : null;
    const t = { id: newId(), who: who(), title: clean(title) || (it ? it.title : ''), est: b.est != null ? Math.round(+b.est) || null : est, ...l, day: isDay(b.day) ? b.day : today(), done: null, created: Date.now() };
    if (!t.title) throw new Error('Type what you’ll work on.');
    saveTasks([...tasks(), t]);
    return t;
  }
  function editTask(id, b) {
    const all = tasks(), i = all.findIndex(t => t.id === id);
    if (i < 0) throw new Error('That task doesn’t exist any more.');
    const t = { ...all[i], ...link(b, all[i]) };
    // An edited title carries its estimate at the end, as when the task was added ("Call Sam 30m").
    if ('title' in b) { const x = parseTask(b.title); t.title = clean(x.title) || t.title; t.est = x.est; }
    else if ('est' in b) t.est = b.est == null || b.est === '' ? null : typeof b.est === 'number' ? Math.round(b.est) : parseDur(b.est);
    if ('day' in b && isDay(b.day)) t.day = b.day;
    if ('done' in b) t.done = b.done ? Date.now() : null;
    if ('order' in b) t.order = +b.order;
    all[i] = t; saveTasks([...all]);
    return t;
  }
  function removeTask(id) { saveTasks(tasks().filter(t => t.id !== id)); }

  // ---------- invoices ----------
  /** Entries billed on an invoice, so the same time isn't invoiced twice. */
  function markInvoiced(ids, invoiceId) { const set = new Set(ids || []); saveEntries(entries().map(e => (set.has(e.id) ? { ...e, invoice: invoiceId } : e))); }
  /** An invoice was removed: its time can be invoiced again. */
  function unmarkInvoice(invoiceId) { saveEntries(entries().map(e => { if (e.invoice !== invoiceId) return e; const { invoice, ...rest } = e; return rest; })); }

  // ---------- export and import ----------
  /** One project's entries, for a project export. */
  const ofProject = id => entries().filter(e => e.projectId === id);
  /** Entries from an imported project, under its id in this Groundwork. Ones already here are skipped. */
  function importFor(id, list) {
    const have = new Set(entries().map(e => e.id));
    const add = (Array.isArray(list) ? list : []).filter(e => e && e.id && !have.has(e.id) && e.mins > 0 && isDay(e.day)).map(e => ({ ...e, projectId: id }));
    if (add.length) saveEntries([...entries(), ...add]);
    return add.length;
  }

  /** The log as a CSV for a spreadsheet or an invoice: one row per entry, oldest first. */
  function csv(opts = {}) {
    // Text a spreadsheet would read as a formula starts with an apostrophe.
    const q = v => { let s = String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    const hm = t => t ? new Date(t).toTimeString().slice(0, 5) : '';
    const rows = [['Date', 'Start', 'End', 'Duration', 'Hours', 'Project', 'What', 'Checklist item', 'Billable', 'Who', 'Added']];
    for (const e of list(opts).reverse()) rows.push([e.day, hm(e.start), hm(e.end), `${Math.floor(e.mins / 60)}:${String(e.mins % 60).padStart(2, '0')}`, (e.mins / 60).toFixed(2), e.pname || '', e.title, e.item ? e.item.title : '', e.billable ? 'Yes' : 'No', e.who || '', e.by === 'timer' ? 'Timer' : 'By hand']);
    return rows.map(r => r.map(q).join(',')).join('\r\n') + '\r\n';
  }

  return { parseDur, parseTask, markInvoiced, unmarkInvoice, list, add, edit, remove, start, stop, current, still, away, tick, forProject, dayTotal, taskList, addTask, editTask, removeTask, ofProject, importFor, csv, addDays, today };
};
module.exports.parseDur = parseDur;
module.exports.parseTask = parseTask;
