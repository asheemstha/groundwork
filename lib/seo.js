// The "SEO plan" tool: a title, meta description and slug for each page. The AI writes one JSON file per page;
// this module builds the prompt, reads those files into a plan, checks it, and verifies it on the live site
// with plain requests (no browser, no AI).
const fs = require('fs'), path = require('path');
let S = null; // shared/seo.mjs, set by init()
const init = mod => { S = mod; };

const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const PLAN = run => path.join(run.dir, 'seo', 'plan');
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Groundwork';

// ---------- reading titles and descriptions from a live page ----------
const decode = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16))).replace(/&nbsp;/g, ' ');
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)')`, 'i')); return m ? decode(m[2] ?? m[3]) : null; };
async function fetchMeta(url, opts = {}) {
  try {
    const r = await fetch(url, { redirect: opts.redirect || 'follow', headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) });
    if (opts.redirect === 'manual') return { status: r.status, location: r.headers.get('location') };
    const html = r.status < 400 ? (await r.text()).slice(0, 400000) : '';
    const head = html.split(/<\/head>/i)[0];
    const title = decode((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '').replace(/\s+/g, ' ').trim();
    const metas = head.match(/<meta\b[^>]*>/gi) || [];
    const d = metas.find(m => /name\s*=\s*["']description["']/i.test(m));
    return { status: r.status, url: r.url, title, description: d ? (attr(d, 'content') || '').trim() : '' };
  } catch (e) { return { status: 0, error: (e.cause && e.cause.code) || e.message }; }
}
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

// ---------- the heading plan's keywords and H1s, so all three agree ----------
function fromHeadings(run) {
  const result = readJson(path.join(run.dir, 'result.json'));
  if (!result) return null;
  const pages = {};
  for (const p of result.pages || []) {
    if (!p.planned) continue;
    const m = p.modes.optimize || p.modes.live;
    const rows = (m && m.rows) || [];
    const h1Row = rows.find(r => !r.s && r.act !== 'remove' && r.rec === 'H1');
    const h1 = h1Row ? (h1Row.to || h1Row.text) : (m && m.h1 && (m.h1.proposed || m.h1.cur)) || '';
    pages[p.id] = { keywords: p.keywords, h1, purpose: p.purpose || '' };
  }
  return { pages, name: result.site && result.site.name };
}

// ---------- prompts ----------
// The built-in SEO rules. An added SEO skill is read first and wins where it differs (see prompt()).
const RULES = `- Title: never more than 60 characters. On pages with a primary keyword, put the keyword near the start, then the ending, and use most of the 60 characters. If it doesn't fit, shorten the words before the ending. If it still doesn't fit, use one short form of the brand name, the same on every page that needs it, never initials. Legal, contact and brand pages can be short, like "Privacy Policy | Brand". The home page can lead with the brand. Never repeat the brand name in a title. Say what the page offers in the words people search for. No keyword lists, no capitals for emphasis.
- Description: never more than 155 characters, ideally 120 to 155. One or two plain sentences: what the page offers, with the primary keyword, and a reason to click. Not a copy of the title.
- If the current title or description already follows these rules and fits the keyword, repeat it exactly and leave "why" empty. Don't reword just to reword, pad to a length or change the ending on its own. Every change should be one you could explain to the client.
- Slug: keep the current path unless it has capitals, underscores, IDs, dates, filler words, or doesn't describe the page. A new URL loses some ranking and needs a 301 redirect, so change it only when the gain is clear. Lowercase words joined by hyphens, one to four words, keep the parent folder. The home page is always "/".
- CMS collection items: the title and description apply to every item, so write them as patterns with the CMS field names in braces, like "{Name} | Brand" and "{Summary}". Keep the slug.
- Every title and every description must be unique across the site.
- "why" is one short sentence a client would understand. Leave it empty when nothing changed.
- Never use em dashes in anything you write. Use commas, colons or full stops. Write like a person, without stock phrases or "this, not that" lines.`;
function prompt(run, current) {
  const s = run.seo.settings, dir = run.dir, sel = run.pages.filter(p => run.seo.selected.includes(p.id));
  const hp = fromHeadings(run);
  const kwFrom = hp && sel.some(p => hp.pages[p.id]);
  const line = (p, i) => {
    const c = current[p.id] || {}, h = hp && hp.pages[p.id];
    const kw = h && h.keywords ? `keyword "${h.keywords.primary[0]}"${h.keywords.secondary.length ? `, also ${h.keywords.secondary.map(k => `"${k[0]}"`).join(', ')}` : ''}` : '';
    return `${i + 1}. ${p.id} (${p.name}) ${p.path}${p.collection ? ` [one item of the ${p.collection} CMS collection]` : ''}
   Now: title "${c.title || ''}", description "${c.description || ''}"${h ? `\n   From the heading plan: ${kw || 'no target keyword'}${h.h1 ? `, H1 "${h.h1}"` : ''}` : ''}
   Page content: ${dir}/crawl/${p.id}.txt`;
  };
  const example = { keyword: 'primary keyword, or null for brand, contact and legal pages', title: { text: 'Primary Keyword Service in City | Brand', why: 'Short reason, only if it changed' }, description: { text: 'One or two plain sentences with the keyword and a reason to click.', why: '' }, slug: { text: '/services/primary-keyword', why: 'Only if it changed' }, notes: ['Optional: one short suggestion the developer should know'] };
  return `You are writing the SEO plan for a website inside Groundwork, a local app. The app has already read the site. Your job: a title tag, a meta description and a URL slug for each page below, written as JSON files that the app reads while you work.

Settings (already answered, do not ask anything):
- Market: ${s.market}
- Platform: ${run.platform || 'unknown'}
- Site: ${run.name} (${run.origin})${s.liveDomain ? `\n- Live domain: ${s.liveDomain}` : ''}

${s.skill && s.skill !== 'seo-builtin' ? `The agency's own SEO rules are in ${dir}/seo/skill/ (start with SKILL.md). Read them first and follow them. Where they differ from the rules below, theirs win, except the JSON format and the limits of 60 characters for titles and 155 for descriptions, which the app checks.\n\n` : ''}${s.notes ? `Extra instructions from the user (follow them unless they break the rules below):\n${s.notes}\n\n` : ''}${kwFrom
    ? 'Keywords: the heading plan already chose each page\'s keywords and H1. Use the same primary keyword in the title and description, so the title, description and H1 all target the same words. Pages it didn\'t plan: pick a keyword from the page content.'
    : `Keywords: no keyword tool (Ahrefs) is connected. Pick one primary keyword per page from its content and the words people in ${s.market} search for. No keyword belongs to two pages. Brand, contact and legal pages can have none. Never invent search volumes.`}

Pages to plan, in this order:
${sel.map(line).join('\n')}

Page content files list every element in DOM order: headings as <H2>, text styled like a heading as ~styled~, links as (link). Read a page's file before writing its SEO.

Work in this order and write each file as soon as it's finished. The app shows progress from these files.

1) First write ${dir}/seo/plan/_site.json:
${JSON.stringify({ brand: 'Brand name as the site writes it', ending: ' | Brand', notes: ['Up to 4 site-wide SEO notes, for example that every page shares one title'] }, null, 1)}
"ending" is how titles end on this site. If the site already ends its titles the same way, keep that ending. Only when it's so long that most keyword titles can't fit, use the brand's short name instead, like " | Northwind" for "Northwind Dental Group".

2) Then, one page at a time in the order above, write ${dir}/seo/plan/<page-id>.json:
${JSON.stringify(example, null, 1)}

Rules:
${RULES}

When every page file is written, reply with a summary of 3 to 5 short lines. Do not repeat file contents.`;
}

function fixPrompt(run, problems) {
  return `You are fixing an SEO plan. The app's automatic checks found these problems:

${problems.map(p => '- ' + p).join('\n')}

Plan files are in ${run.dir}/seo/plan/ (one JSON file per page, plus _site.json). Titles are 60 characters or fewer, descriptions 155 or fewer, each unique, with the page's primary keyword in the title. Edit only the files needed to fix the problems above, keeping the same JSON shape. Never use em dashes. Reply with one line per fix.`;
}

// ---------- assemble the AI's files into a plan ----------
const txt = v => typeof v === 'string' ? v : v && typeof v === 'object' ? String(v.text ?? v.to ?? '') : '';
const why = v => v && typeof v === 'object' ? String(v.why || '') : '';
function assemble(run, current) {
  const site = readJson(path.join(PLAN(run), '_site.json')) || {};
  const hp = fromHeadings(run);
  const warnings = [];
  const pages = run.pages.filter(p => run.seo.selected.includes(p.id)).map(p => {
    const plan = readJson(path.join(PLAN(run), p.id + '.json'));
    const c = current[p.id] || {};
    const h = hp && hp.pages[p.id];
    const out = {
      id: p.id, name: p.name, path: p.path, group: p.navGroup || null, collection: p.collection || null, pattern: !!p.collection,
      planned: !!plan, keyword: null, secondary: [], h1: h ? h.h1 : '', keywordsFrom: h && h.keywords ? 'headings' : 'seo',
      why: {}, notes: [], status: c.status || null,
      fields: { title: { cur: c.title || '', to: c.title || '' }, description: { cur: c.description || '', to: c.description || '' }, slug: { cur: p.path, to: p.path } },
    };
    if (h && h.keywords) { out.keyword = h.keywords.primary[0] || null; out.secondary = (h.keywords.secondary || []).map(k => k[0]); }
    if (!plan) return out;
    if (!out.keyword && plan.keyword && typeof plan.keyword === 'string' && !/^null$/i.test(plan.keyword)) out.keyword = plan.keyword.trim();
    for (const f of S.FIELDS) {
      const v = txt(plan[f]).trim();
      if (v) out.fields[f].to = f === 'slug' ? S.normPath(v) : S.norm(v);
      if (why(plan[f]) && S.changed(out, f, {})) out.why[f] = why(plan[f]);
    }
    if (p.path === '/') out.fields.slug.to = '/';
    if (out.pattern) out.fields.slug.to = p.path;
    out.notes = (Array.isArray(plan.notes) ? plan.notes : []).filter(x => typeof x === 'string' && x.trim()).slice(0, 4);
    return out;
  });
  const missing = pages.filter(p => !p.planned).map(p => p.name);
  if (missing.length) warnings.push(`The AI didn’t finish ${missing.join(', ')}.`);
  return {
    site: {
      name: site.brand || (hp && hp.name) || run.name, url: run.origin, ending: typeof site.ending === 'string' ? site.ending : '', market: run.seo.settings.market,
      platform: run.platform || 'Other', checked: Date.now(), keywordsFrom: pages.some(p => p.keywordsFrom === 'headings') ? 'headings' : 'seo',
    },
    pages, notes: (Array.isArray(site.notes) ? site.notes : []).filter(x => typeof x === 'string').slice(0, 5), warnings,
  };
}

// Problems the AI should fix in a second pass.
function hardProblems(result) {
  const out = [];
  for (const p of result.pages) for (const c of S.pageChecks(p, {})) if (!c.ok && c.hard) out.push(`${p.name} (${p.id}.json): ${c.text}`);
  for (const c of S.siteChecks(result.pages, {})) if (!c.ok && c.hard) out.push(`Whole site: ${c.text}`);
  return out;
}

// ---------- current titles and descriptions, read fresh before planning ----------
async function readCurrent(run, ids, onPage = () => {}) {
  const out = {};
  const pages = run.pages.filter(p => ids.includes(p.id));
  await pool(pages, 6, async p => {
    const m = await fetchMeta(run.origin + p.path);
    if (m.status && m.status < 400) out[p.id] = { title: m.title, description: m.description, status: m.status };
    else {
      // Fall back to what the scan saw.
      const cr = readJson(path.join(run.dir, 'crawl', p.id + '.json')) || {};
      out[p.id] = { title: cr.title || '', description: cr.desc || '', status: m.status || cr.status || 0 };
    }
    onPage(p);
  });
  return out;
}

// ---------- check the live site against the plan ----------
async function verify(run, result, edits) {
  const origin = run.origin.replace(/\/$/, '');
  const out = {};
  const pages = result.pages.filter(p => p.planned);
  await pool(pages, 6, async p => {
    const T = S.tasks(p, edits);
    if (!T.length) return;
    const newPath = S.normPath(S.value(p, 'slug', edits));
    const m = await fetchMeta(origin + (newPath === '/' ? '/' : newPath));
    const rows = {};
    for (const t of T) {
      if (t.field === 'title' || t.field === 'description') {
        if (!m.status || m.status >= 400) { rows[t.key] = 'todo'; continue; }
        const want = S.value(p, t.field, edits), have = m[t.field];
        const ok = p.pattern && /\{[^}]+\}/.test(want) ? S.patternTest(want).test(S.norm(have)) : S.norm(have).toLowerCase() === S.norm(want).toLowerCase();
        rows[t.key] = ok ? 'done' : 'todo';
      } else if (t.field === 'slug') rows[t.key] = m.status && m.status < 400 && S.normPath(m.url || newPath) === newPath ? 'done' : 'todo';
      else if (t.field === 'redirect') {
        const r = await fetchMeta(origin + p.fields.slug.cur, { redirect: 'manual' });
        rows[t.key] = [301, 308].includes(r.status) && S.normPath(r.location || '') === newPath ? 'done' : 'todo';
      }
    }
    out[p.id] = { rows, status: m.status || 0, title: m.title || '', description: m.description || '' };
  });
  return out;
}

// ---------- export ----------
function csv(result, edits) {
  const q = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = ['Page', 'Current URL', 'New URL', 'Redirect needed', 'Primary keyword', 'Current title', 'New title', 'Title length', 'Current description', 'New description', 'Description length'];
  const rows = result.pages.filter(p => p.planned).map(p => {
    const t = S.value(p, 'title', edits), d = S.value(p, 'description', edits), s = S.normPath(S.value(p, 'slug', edits));
    return [p.name, p.fields.slug.cur, s, s !== S.normPath(p.fields.slug.cur) ? 'Yes, 301 from the current URL' : '', p.keyword || '', p.fields.title.cur, t, t.length, p.fields.description.cur, d, d.length];
  });
  return '﻿' + [head, ...rows].map(r => r.map(q).join(',')).join('\r\n');
}

module.exports = { RULES, init, prompt, fixPrompt, assemble, hardProblems, readCurrent, verify, csv, fetchMeta };
