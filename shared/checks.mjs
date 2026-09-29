// Automatic heading checks, shared by the server (fix pass) and the web app (display).
// Ported from the h-tag-planner guide template so both agree.
export const isH = t => /^H[1-6]$/.test(t);
export const lvl = t => isH(t) ? +t[1] : 0;
export const WORK = ['retag', 'tag', 'rewrite', 'add', 'remove'];
export const isTask = r => !r.s && WORK.includes(r.act);
export const finalRows = rows => rows.filter(r => !r.s && r.act !== 'remove' && isH(r.rec));
export const finalText = r => r.to || r.text;
export const finalH1 = rows => { const r = finalRows(rows).find(r => r.rec === 'H1'); return r ? finalText(r) : ''; };
const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'for', 'of', 'to', 'in', 'on', 'with', 'near', 'me', '&']);
const stem = w => w.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/(ies)$/, 'y').replace(/(es|s)$/, '');
export const kwIn = (text, kw) => {
  const words = new Set(String(text).split(/[\s\-\/,.:;!?’'"()]+/).map(stem).filter(Boolean));
  return String(kw).split(/\s+/).filter(w => !STOP.has(w.toLowerCase())).map(stem).filter(Boolean).every(w => words.has(w));
};

// Each check: {ok, text, hard}. "hard" failures are ones the plan itself should fix.
export function pageChecks(page, modeName) {
  const live = modeName !== 'optimize', m = page.modes && page.modes[modeName];
  if (!m) return [];
  const out = [], rows = finalRows(m.rows), h1s = rows.filter(r => r.rec === 'H1');
  out.push({ ok: h1s.length === 1, text: `Exactly one H1 (${h1s.length})`, hard: true });
  let prev = 0, skip = null;
  rows.forEach(r => { const L = lvl(r.rec); if (prev && L > prev + 1 && !skip) skip = `${r.rec} “${finalText(r)}” follows H${prev}`; prev = L; });
  out.push({ ok: !skip, text: skip ? 'Skipped level: ' + skip : 'No skipped levels', hard: true });
  if (rows[0]) out.push({ ok: rows[0].rec === 'H1', text: rows[0].rec === 'H1' ? 'H1 is the first heading' : `First heading is ${rows[0].rec}, not the H1`, hard: true });
  const seen = {}, dup = [];
  rows.forEach(r => { const t = finalText(r).toLowerCase(); if (seen[t]) dup.push(finalText(r)); seen[t] = 1; });
  out.push({ ok: !dup.length || live, info: !!dup.length && live, text: dup.length ? 'Duplicate headings on the page: ' + [...new Set(dup)].join(', ') + (live ? ' (wording suggestion)' : '') : 'No duplicate headings on the page', hard: !live });
  const kw = page.keywords && page.keywords.primary && page.keywords.primary[0];
  if (kw) {
    const has = kwIn(finalH1(m.rows), kw);
    out.push({ ok: has || live, info: !has && live, text: (has ? 'H1 contains' : 'H1 does not contain') + ` the primary keyword “${kw}”` + (!has && live ? ' (see the H1 suggestion)' : ''), hard: !live });
  }
  return out;
}

export function siteChecks(pages, modeName, shared) {
  const live = modeName !== 'optimize', out = [], h1 = {}, kw = {}, h2 = {};
  const list = pages.filter(p => p.modes && p.modes[modeName]);
  list.forEach(p => {
    const rows = p.modes[modeName].rows, t = finalH1(rows).toLowerCase();
    if (t) (h1[t] = h1[t] || []).push(p.name);
    const k = p.keywords && p.keywords.primary && p.keywords.primary[0];
    if (k) (kw[k.toLowerCase()] = kw[k.toLowerCase()] || []).push(p.name);
    finalRows(rows).filter(r => r.rec === 'H2').forEach(r => { const x = finalText(r); if ((shared || []).includes(x)) return; (h2[x.toLowerCase()] = h2[x.toLowerCase()] || new Set()).add(p.name); });
  });
  const dH1 = Object.entries(h1).filter(([, v]) => v.length > 1), dKw = Object.entries(kw).filter(([, v]) => v.length > 1);
  out.push({ ok: !dH1.length || live, info: !!dH1.length && live, text: dH1.length ? 'Same H1 on several pages: ' + dH1.map(([k, v]) => `“${k}” (${v.join(', ')})`).join('; ') + (live ? ' (wording suggestion)' : '') : 'Every page has its own H1', hard: !live });
  out.push({ ok: !dKw.length, text: dKw.length ? 'Primary keyword owned by several pages: ' + dKw.map(([k, v]) => `“${k}” (${v.join(', ')})`).join('; ') : 'Every primary keyword has one owner page', hard: true });
  const dH2 = Object.entries(h2).filter(([, v]) => v.size > 1);
  out.push({ ok: !dH2.length || live, info: !!dH2.length && live, text: dH2.length ? 'H2 repeated across pages: ' + dH2.slice(0, 6).map(([k, v]) => `“${k}” (${[...v].join(', ')})`).join('; ') + (live ? ' (wording suggestion)' : '') : 'No H2 repeats across pages except shared sections', hard: false });
  const fails = list.filter(p => pageChecks(p, modeName).some(c => !c.ok)).map(p => p.name);
  out.push({ ok: !fails.length, text: fails.length ? 'Pages with a failing check: ' + fails.join(', ') : 'All page checks pass', hard: false });
  return out;
}


// One to-do list per page. When a plan has both outputs, phase 1 is the tag fixes the developer can do
// now (Live H-tag map) and phase 2 is only what the Optimization plan adds on top: rewrites, new or removed
// headings, and tag changes the tag fixes don't already cover. Phase 2 waits on client sign-off.
// Each row keeps its `mode` so done-state keys stay `${mode}|${page}|${key}`.
export function phases(page) {
  const L = page.modes && page.modes.live, O = page.modes && page.modes.optimize;
  if (!L || !O) {
    const mode = L ? 'live' : 'optimize', md = L || O;
    return { combined: false, rows: md ? md.rows.map(r => ({ ...r, mode, phase: 1 })) : [] };
  }
  const liveByRef = new Map(L.rows.filter(r => r.ref).map(r => [r.ref, r]));
  const afterPhase1 = ref => { const r = liveByRef.get(ref); return r ? (r.act === 'keep' || r.act === 'none' ? r.cur : r.rec) : null; };
  const p2 = [];
  for (const r of O.rows) {
    if (r.s) { p2.push({ ...r, key: 'p2' + r.key, mode: 'optimize', phase: 2 }); continue; }
    if (!isTask(r)) continue;
    const from = r.ref && afterPhase1(r.ref) != null ? afterPhase1(r.ref) : r.cur;
    if ((r.act === 'retag' || r.act === 'tag') && from === r.rec) continue; // phase 1 already does it
    if (r.act === 'remove' && from === '—') continue; // phase 1 already turns it into text
    p2.push({ ...r, from, mode: 'optimize', phase: 2 });
  }
  const phase2 = p2.filter((r, i) => !r.s || (p2[i + 1] && !p2[i + 1].s)); // drop empty sections
  return { combined: true, rows: [...L.rows.map(r => ({ ...r, mode: 'live', phase: 1 })), ...phase2] };
}

// Task counts per page and in total, across whatever the plan contains.
export function taskCounts(pages, done) {
  let tasks = 0, d = 0, p1 = 0, p1d = 0;
  for (const p of pages) for (const r of phases(p).rows) {
    if (!isTask(r)) continue;
    const ok = !!done[`${r.mode}|${p.id}|${r.key}`];
    tasks++; if (ok) d++;
    if (r.phase === 1) { p1++; if (ok) p1d++; }
  }
  return { tasks, done: d, now: { tasks: p1, done: p1d } };
}
