// The "Heading structure" tool: AI prompt, assembling the AI's plan into to-dos, export and live verification.
const fs = require('fs'), path = require('path');
let C = null; // set by init() from shared/checks.mjs
const init = mod => { C = mod; };

const SKILL_DIR = path.join(__dirname, '..', 'tools', 'h-tag-planner');
const OUTPUTS = {
  live: 'Live H-tag map (tags only, wording stays as on the site)',
  optimize: 'Optimization plan (headings rewritten, added or removed for keywords)',
  both: 'Both: a Live H-tag map and an Optimization plan'
};
const modesFor = o => o === 'both' ? ['live', 'optimize'] : [o === 'optimize' ? 'optimize' : 'live'];

// ---------- crawl -> readable text for the AI ----------
function toAiText(pg, cr) {
  const L = [];
  L.push(`PAGE ${pg.id} — ${pg.name} — ${pg.path} — HTTP ${cr.status}${cr.finalPath && cr.finalPath !== pg.path ? ' (redirects to ' + cr.finalPath + ')' : ''}`);
  L.push(`TITLE: ${cr.title || '-'}`);
  L.push(`DESCRIPTION: ${cr.desc || '-'}`);
  L.push('HEADING COUNTS: ' + Object.entries(cr.counts || {}).map(([k, v]) => k + '=' + v).join(' '));
  L.push('');
  for (const it of cr.items || []) {
    if (it.sec) { L.push(`--- section [${it.cls}]${it.id ? ' #' + it.id : ''}`); continue; }
    const flags = (it.hidden ? ' (hidden)' : '') + (it.inTab ? ' {tab}' : '') + (it.zone ? ` {${it.zone}}` : '');
    if (/^H[1-6]$/.test(it.kind)) { L.push(`[${it.ref}] <${it.kind}>${flags} [${it.cls}] ${it.text}`); continue; }
    if (it.link) { L.push(`[${it.ref}]    (${it.kind === 'a' ? 'link' : 'button'}) ${it.text}${it.href ? ' → ' + it.href : ''}`); continue; }
    const style = it.fs ? ` ${it.fs}px/${it.fw}` : '';
    const text = it.styled ? it.text : (it.text.length > 140 ? it.text.slice(0, 140) + '…' : it.text);
    L.push(`[${it.ref}]    ${it.styled ? '~styled~ ' : ''}${it.kind}${flags} [${it.cls}]${style} ${text}`);
  }
  return L.join('\n');
}

// ---------- prompts ----------
function planPrompt(run) {
  const s = run.settings, dir = run.dir, sel = run.pages.filter(p => run.selected.includes(p.id));
  const modes = modesFor(s.output);
  const other = run.pages.filter(p => !run.selected.includes(p.id) && p.status && p.status < 400).map(p => p.path);
  const pageSchema = {};
  if (modes.includes('live')) pageSchema.live = { h1: { status: 'keep | client | optional', proposed: 'better H1 wording, or empty', why: 'reason, naming the keyword' }, rows: [{ section: 'Hero' }, { ref: 'i1', act: 'keep', rec: 'H1' }, { ref: 'i7', act: 'tag', rec: 'H3', note: 'Swap for a Heading element set to H3 with class d3' }, { ref: 'i9', act: 'retag', rec: '—', note: 'Footer title: make it text' }, { ref: 'i4', act: 'none', note: 'Eyebrow, stays text' }], notes: ['Suggestion for later'] };
  if (modes.includes('optimize')) pageSchema.optimize = { h1: { status: 'client', why: 'reason, naming the keyword' }, rows: [{ section: 'Hero' }, { ref: 'i1', act: 'rewrite', rec: 'H1', to: 'New H1 wording', note: 'Adds the primary keyword' }, { act: 'add', rec: 'H3', to: 'New heading', note: 'Above the pricing table; needs one line of copy' }, { ref: 'i12', act: 'remove', rec: '—', note: 'Duplicate card, delete' }], notes: ['Content idea'] };
  return `You are running the "h-tag-planner" skill inside Groundwork, a local app. The app has already crawled the site (the skill's Steps 0–2) and will build, check and verify the guide itself (Steps 5–6). Your job is Steps 3 and 4 only: page purposes, the keyword map and the heading plan, written as JSON files that the app reads while you work.

Read these first:
- ${dir}/skill/SKILL.md (context; ignore its crawling, Artifact and publishing steps)
- ${dir}/skill/references/heading-rules.md (the rulebook; apply Section B exactly)
- ${dir}/skill/references/output-spec.md (what each action and field means)
- ${dir}/skill/references/keyword-mapping.md (the method; see "Keyword data" below)

Settings (already answered, do not ask anything):
- Output: ${OUTPUTS[s.output]}
- Market: ${s.market}
- Live domain: ${s.liveDomain || 'not live yet / same as the crawled site'}
- Platform: ${run.platform}
- Applied by: ${s.appliedBy}

${s.notes ? `Extra instructions from the user (follow them unless they break the heading rules):\n${s.notes}\n\n` : ''}Keyword data: no keyword tool (Ahrefs) is connected for this run and the user agreed to continue without it. Build the keyword map from each page's content and the wording buyers in ${s.market} use. Put null for every volume. Never invent volumes, difficulty or rankings.

Site: ${run.name} (${run.origin})
Pages to plan, in this order (crawl file for each):
${sel.map((p, i) => `${i + 1}. ${p.id} — ${p.name} — ${p.path} — ${dir}/crawl/${p.id}.txt`).join('\n')}
${other.length ? `Other pages found but not planned (mention only if relevant): ${other.slice(0, 40).join(', ')}` : ''}
Header navigation as shown on the site: ${run.navText || '-'}
Links that point to "#": ${(run.dead || []).join(', ') || 'none'}

Crawl files list every element in DOM order. [iN] is the ref you use. <H2> = a real heading tag. ~styled~ = text styled like a heading (large, bold or a heading class) but not tagged. (hidden) = hidden on the page. {tab} = inside a tab panel. {header}/{footer} = site-wide chrome. Full-page screenshots are at ${dir}/shots/<id>.jpg (1280px wide); open one only when the visual hierarchy is unclear.

Work in this order and write each file as soon as it is finished. The app shows progress from these files, so do not hold them back until the end.

1) After reading every crawl file, write ${dir}/plan/_site.json:
${JSON.stringify({ name: 'Brand name as the site writes it', sharedHeadings: ['H2 text that repeats on purpose across pages (footer CTA, logo band)'], nav: [{ id: 'home' }, { group: 'Services', items: ['page-id', 'page-id'] }], pages: { 'page-id': { purpose: 'One sentence: what the page sells or explains, and to whom.', intent: 'commercial | informational | navigational | local', keywords: { primary: ['main keyword', null], secondary: [['supporting keyword', null]], note: 'why this page owns these' } } }, sitewide: [['keep | retag | content', 'One sentence about a site-wide pattern']], gaps: [{ cluster: 'topic no page covers', volume: null, note: 'where it could go' }] }, null, 1)}
- nav mirrors the site's header navigation (its labels and order), using only the page ids above. Pages not in the header go at the end as {"group": "Other pages", "items": [...]}.
- Every planned page gets a purpose. Commercial pages get one primary and 2–5 secondary keywords; no keyword belongs to two pages; industry or location pages carry a modifier. Brand, contact and legal pages can use "keywords": null.

2) Then, one page at a time in the order above, write ${dir}/plan/<page-id>.json:
${JSON.stringify(pageSchema, null, 1)}
Rules for page files:
- Include only these mode keys: ${modes.join(', ')}.
- rows follow page order. Start each visible block with {"section": "Name"} named the way someone scrolling would name it.
- Refer to crawl items by "ref". Every <H1>–<H6> item in the crawl file must appear exactly once in each mode's rows, including hidden ones and ones marked {header}/{footer} (group those under "Site header (shared)" or "Footer (shared)").
- Also list ~styled~ items and anything a developer might wrongly tag: "tag" when it should become a heading, "none" when it must stay text (eyebrows, stats, labels, subheading lines). Leave out plain paragraphs, links and buttons unless they need an action.
- act: keep | retag | tag | none${modes.includes('optimize') ? ' | rewrite | add | remove (these three only in "optimize")' : ''}. rec: "H1"–"H6", or "—" for text. For keep, rec is the current tag.
- Write notes in plain words for a developer. Don't use the crawl file's notation (~styled~, [iN], {tab}) in any text.
- Never use em dashes in anything you write (headings, rewrites, notes, reasons). Use commas, colons or full stops. Write like a person, without stock phrases or "this, not that" lines.
- note: short and actionable. For "tag", say which element and class to use. For rewrites, name the keyword served. For "add", say where it goes and what copy it needs.
${modes.includes('live') ? '- live: exactly one H1, the page\'s main visible title, with its current wording. Never change wording in live. If the H1 misses the primary keyword or doesn\'t say what the page is, set h1.proposed and h1.status "client" (recommended) or "optional"; otherwise status "keep". Other wording ideas go in notes.\n' : ''}${modes.includes('optimize') ? '- optimize: the H1 row holds the new wording in "to" (70 characters or fewer, contains the primary keyword naturally, unique across the site, in the brand\'s voice). Use secondary keywords in H2/H3 only where they truthfully name the section. h1.status is "client" when the H1 changes.\n' : ''}- In the final structure: one H1 that comes first, no skipped levels going down, no two pages with the same H1 or primary keyword.

When every page file is written, reply with a summary of 3–5 short lines. Do not repeat file contents.`;
}

function fixPrompt(run, problems) {
  return `You are fixing a heading plan made with the "h-tag-planner" skill (rules: ${run.dir}/skill/references/heading-rules.md). The app's automatic checks found these problems:

${problems.map(p => '- ' + p).join('\n')}

Plan files are in ${run.dir}/plan/ (one JSON file per page, plus _site.json). Crawl files are in ${run.dir}/crawl/. Edit only the files needed to fix the problems above, keeping the same JSON shape. Don't change anything else. Reply with one line per fix.`;
}

// ---------- assemble the AI's files into to-dos ----------
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const normRec = r => { const x = String(r == null ? '' : r).trim().toUpperCase(); return /^H[1-6]$/.test(x) ? x : '—'; };
const ACTS = ['keep', 'retag', 'tag', 'none', 'rewrite', 'add', 'remove'];

function buildMode(modeName, plan, crawl, warnings, pageName) {
  const live = modeName === 'live';
  const items = new Map((crawl.items || []).filter(i => i.ref).map(i => [i.ref, i]));
  const order = [...items.keys()];
  const rows = [], used = new Set(), notes = [...(plan.notes || [])].filter(x => typeof x === 'string');
  let addN = 0, secN = 0;
  for (const r of plan.rows || []) {
    if (!r || typeof r !== 'object') continue;
    if (r.section || r.s) { rows.push({ key: 's' + (secN++), s: String(r.section || r.s) }); continue; }
    let act = ACTS.includes(String(r.act).toLowerCase()) ? String(r.act).toLowerCase() : 'keep';
    let rec = normRec(r.rec), to = r.to ? String(r.to) : '', note = r.note ? String(r.note) : '';
    if (act === 'add') {
      if (live) { if (to) notes.push(`Consider adding a ${rec} “${to}”. ${note}`.trim()); continue; }
      if (!to || rec === '—') continue;
      rows.push({ key: 'add' + (addN++), cur: '—', text: '', rec, act, note, to });
      continue;
    }
    const it = items.get(r.ref);
    if (!it || used.has(r.ref)) continue;
    used.add(r.ref);
    const cur = /^H[1-6]$/.test(it.kind) ? it.kind : it.kind;
    if (live && act === 'rewrite') { if (to && to !== it.text) notes.push(`Wording idea for “${it.text}”: “${to}”. ${note}`.trim()); act = rec === cur ? 'keep' : (C.isH(cur) ? 'retag' : 'tag'); to = ''; }
    if (live && act === 'remove') { act = 'retag'; rec = '—'; }
    if (act === 'keep') rec = C.isH(cur) ? cur : '—';
    if (act === 'none') rec = '—';
    if (act === 'retag' && rec === cur) act = 'keep';
    if (act === 'tag' && rec === '—') act = 'none';
    if (act === 'rewrite' && (!to || to === it.text) && rec === cur) act = 'keep';
    if (act === 'rewrite' && (!to || to === it.text)) { act = C.isH(cur) ? 'retag' : 'tag'; to = ''; }
    rows.push({ key: it.ref, ref: it.ref, cur, text: it.text, rec, act, note, to, rect: it.rect || null, hidden: !!it.hidden, zone: it.zone || null });
  }
  // Every real heading must be in the plan. Anything the AI skipped is kept as-is and flagged.
  const missing = order.filter(ref => !used.has(ref) && C.isH(items.get(ref).kind));
  if (missing.length) warnings.push(`${pageName}: ${missing.length} heading(s) weren't reviewed by the AI and are kept as they are.`);
  for (const ref of missing) {
    const it = items.get(ref), idx = order.indexOf(ref);
    let at = rows.length;
    for (let k = 0; k < rows.length; k++) { const rr = rows[k]; if (rr.ref && order.indexOf(rr.ref) > idx) { at = k; break; } }
    rows.splice(at, 0, { key: ref, ref, cur: it.kind, text: it.text, rec: it.kind, act: 'keep', note: 'Not reviewed. Kept as it is.', to: '', rect: it.rect || null, hidden: !!it.hidden, zone: it.zone || null, auto: true });
  }
  const firstH1 = (crawl.items || []).find(i => i.kind === 'H1');
  const h1p = plan.h1 || {};
  const h1 = { cur: firstH1 ? firstH1.text : '', status: ['keep', 'client', 'optional'].includes(h1p.status) ? h1p.status : 'keep', proposed: h1p.proposed ? String(h1p.proposed) : '', why: h1p.why ? String(h1p.why) : '' };
  if (!live) { const f = C.finalH1(rows); h1.proposed = f && f !== h1.cur ? f : ''; if (h1.proposed) h1.status = 'client'; }
  if (live && h1.proposed === h1.cur) h1.proposed = '';
  return { h1, rows, notes };
}

function assemble(run) {
  const dir = run.dir, modes = modesFor(run.settings.output), warnings = [];
  const site = readJson(path.join(dir, 'plan', '_site.json')) || {};
  const sel = run.pages.filter(p => run.selected.includes(p.id));
  const pages = sel.map(p => {
    const crawl = readJson(path.join(dir, 'crawl', p.id + '.json')) || { items: [] };
    const plan = readJson(path.join(dir, 'plan', p.id + '.json'));
    const sp = (site.pages || {})[p.id] || {};
    const kw = sp.keywords && sp.keywords.primary ? {
      primary: [String(sp.keywords.primary[0] || ''), null],
      secondary: (sp.keywords.secondary || []).filter(k => k && k[0]).map(k => [String(Array.isArray(k) ? k[0] : k), null]),
      note: sp.keywords.note || ''
    } : null;
    const out = { id: p.id, name: p.name, path: p.path, status: crawl.status, title: crawl.title, desc: crawl.desc, counts: crawl.counts, purpose: sp.purpose || '', intent: sp.intent || '', keywords: kw && kw.primary[0] ? kw : null, planned: !!plan, modes: {} };
    if (plan) for (const m of modes) if (plan[m]) out.modes[m] = buildMode(m, plan[m], crawl, warnings, p.name);
    if (plan && !modes.every(m => out.modes[m])) warnings.push(`${p.name}: the plan is missing the ${modes.filter(m => !out.modes[m]).join(' and ')} part.`);
    return out;
  });
  const ids = new Set(pages.map(p => p.id)), placed = new Set();
  const nav = [];
  for (const it of site.nav || []) {
    if (it && it.id && ids.has(it.id) && !placed.has(it.id)) { nav.push({ id: it.id }); placed.add(it.id); }
    else if (it && it.group && Array.isArray(it.items)) { const items = it.items.filter(id => ids.has(id) && !placed.has(id)); items.forEach(id => placed.add(id)); if (items.length) nav.push({ group: String(it.group), items }); }
  }
  const rest = pages.map(p => p.id).filter(id => !placed.has(id));
  if (rest.length) nav.push({ group: nav.length ? 'Other pages' : 'Pages', items: rest });
  for (const p of pages) { const g = nav.find(n => n.group && n.items.includes(p.id)); p.group = g ? g.group : null; }
  return {
    site: {
      name: site.name || run.name, url: run.origin, liveDomain: run.settings.liveDomain || '', platform: run.platform, market: run.settings.market,
      appliedBy: run.settings.appliedBy, checked: new Date(run.crawledAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }),
      kwSource: 'No keyword tool connected: keywords are unverified and have no volumes', sharedHeadings: Array.isArray(site.sharedHeadings) ? site.sharedHeadings.map(String) : [], modes
    },
    nav, pages,
    sitewide: (site.sitewide || []).filter(x => Array.isArray(x) && x[1]).map(x => [['keep', 'retag', 'content'].includes(x[0]) ? x[0] : 'content', String(x[1])]),
    gaps: (site.gaps || []).filter(g => g && g.cluster).map(g => ({ cluster: String(g.cluster), volume: null, note: String(g.note || '') })),
    warnings, keywordsReady: !!site.pages
  };
}

// Problems the AI should fix in a second pass (not ones that just describe the current site).
function hardProblems(result) {
  const out = [];
  for (const m of result.site.modes) {
    for (const p of result.pages) for (const c of C.pageChecks(p, m)) if (!c.ok && c.hard) out.push(`${p.name} (${p.id}.json, ${m}): ${c.text}`);
    for (const c of C.siteChecks(result.pages, m, result.site.sharedHeadings)) if (!c.ok && c.hard) out.push(`Whole site (${m}): ${c.text}`);
  }
  return out;
}

// ---------- export the shareable guide (the skill's own template) ----------
function exportHtml(result, modeName) {
  const tpl = fs.readFileSync(path.join(SKILL_DIR, 'assets', 'heading-map-template.html'), 'utf8');
  const clean = r => r.s ? { s: r.s } : { cur: r.cur, text: r.text, rec: r.rec, act: r.act, note: r.note || '', to: r.to || '' };
  const pages = result.pages.filter(p => p.modes[modeName]).map(p => ({
    id: p.id, name: p.name, path: p.path, group: p.group, purpose: p.purpose,
    ...(p.keywords ? { keywords: p.keywords } : {}),
    h1: p.modes[modeName].h1, rows: p.modes[modeName].rows.map(clean), notes: p.modes[modeName].notes
  }));
  const site = { ...result.site, mode: modeName }; delete site.modes;
  const data = `/* ==================== DATA START ==================== */
const SITE = ${JSON.stringify(site, null, 1)};
const NAV = ${JSON.stringify([{ label: 'Site navigation', items: result.nav }])};
const PAGES = ${JSON.stringify(pages, null, 1)};
const SITEWIDE = ${JSON.stringify(result.sitewide)};
const GAPS = ${JSON.stringify(result.gaps)};
/* ==================== DATA END ==================== */`;
  const a = tpl.indexOf('/* ==================== DATA START'), b = tpl.indexOf('DATA END ==================== */') + 'DATA END ==================== */'.length;
  const title = `${result.site.name} ${modeName === 'optimize' ? 'Heading Plan' : 'H-Tag Map'}`;
  let body = (tpl.slice(0, a) + data + tpl.slice(b)).replace(/<title>[^<]*<\/title>/, '');
  // No keyword tool is connected yet, so the guide mustn't claim Ahrefs research.
  body = body.replace('Each page gets its own keywords from Ahrefs research', 'Each page gets its own keywords (chosen from the page content; unverified, no search volumes)');
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title.replace(/</g, '&lt;')}</title></head><body>\n${body}\n</body></html>`;
}

// ---------- check the live site against the plan ----------
const norm = s => String(s || '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().replace(/[.:]+$/, '').toLowerCase();
function verify(result, modeName, live) {
  const out = {};
  for (const p of result.pages) {
    const m = p.modes[modeName], l = live[p.path];
    if (!m || !l || l.status >= 400 || !l.status) { if (m) out[p.id] = { error: l ? (l.error || 'HTTP ' + l.status) : 'not checked', rows: {} }; continue; }
    const hs = l.headings.map(h => ({ tag: h.tag, t: norm(h.text) }));
    const rows = {};
    for (const r of m.rows) {
      if (!C.isTask(r)) continue;
      if (C.isH(r.rec) && r.act !== 'remove') rows[r.key] = hs.some(h => h.tag === r.rec && h.t === norm(C.finalText(r))) ? 'done' : 'todo';
      else rows[r.key] = hs.some(h => h.t === norm(r.text)) ? 'todo' : 'done';
    }
    const expect = C.finalRows(m.rows).map(r => r.rec + '|' + norm(C.finalText(r)));
    const actual = hs.map(h => h.tag + '|' + h.t);
    out[p.id] = { rows, matches: expect.length === actual.length && expect.every((x, i) => x === actual[i]), headings: l.headings.length };
  }
  return out;
}

module.exports = { init, SKILL_DIR, OUTPUTS, modesFor, toAiText, planPrompt, fixPrompt, assemble, hardProblems, exportHtml, verify };
