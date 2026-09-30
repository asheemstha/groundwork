// SEO plan: what each page's title, meta description and slug should be, the automatic checks,
// and the to-dos. Shared by the server (fix pass, live check) and the web app (display, edits).
import { kwIn } from './checks.mjs';

export const FIELDS = ['title', 'description', 'slug'];
// Google shows about 60 characters of a title and 155 of a description.
export const LIMIT = { title: 60, description: 155 };
export const MIN = { title: 30, description: 70 };

export const norm = s => String(s ?? '').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
export const normPath = p => {
  let x = String(p || '/').trim();
  try { if (/^https?:\/\//i.test(x)) x = new URL(x).pathname; } catch {}
  if (!x.startsWith('/')) x = '/' + x;
  return x.replace(/\/+$/, '') || '/';
};
const key = (page, f) => `${page.id}|${f}`;

/** The value the page should end up with: your edit if you made one, otherwise the plan's. */
export const value = (page, f, edits) => {
  const k = key(page, f);
  return edits && Object.prototype.hasOwnProperty.call(edits, k) ? edits[k] : page.fields[f].to;
};
export const edited = (page, f, edits) => !!edits && Object.prototype.hasOwnProperty.call(edits, key(page, f));
export const changed = (page, f, edits) => f === 'slug'
  ? normPath(value(page, f, edits)) !== normPath(page.fields.slug.cur)
  : norm(value(page, f, edits)) !== norm(page.fields[f].cur);

/** The to-dos for one page: each field that changes, plus a redirect when the slug does. */
export function tasks(page, edits) {
  if (!page.planned) return [];
  const out = FIELDS.filter(f => changed(page, f, edits)).map(f => ({ key: key(page, f), field: f }));
  if (out.some(t => t.field === 'slug') && !page.pattern) out.push({ key: key(page, 'redirect'), field: 'redirect' });
  return out;
}
export function counts(pages, done, edits) {
  let t = 0, d = 0;
  for (const p of pages) for (const x of tasks(p, edits)) { t++; if (done[x.key]) d++; }
  return { tasks: t, done: d };
}

// A CMS template's title is a pattern like "{Name} | Brand"; its length depends on each item.
const isPattern = s => /\{[^}]+\}/.test(s);
const EM = /[—]/;

// Each check: {ok, text, hard}. "hard" failures are ones the AI should fix in its second pass.
export function pageChecks(page, edits) {
  if (!page.planned) return [];
  const out = [], t = norm(value(page, 'title', edits)), d = norm(value(page, 'description', edits)), s = normPath(value(page, 'slug', edits));
  if (!page.pattern || !isPattern(t)) {
    // A few characters over is a warning; the AI's fix pass only runs for clear misses.
    out.push({ ok: !!t && t.length <= LIMIT.title, text: !t ? 'No title' : t.length > LIMIT.title ? `Title is ${t.length} characters, over ${LIMIT.title}` : `Title is ${t.length} characters`, hard: !t || t.length > LIMIT.title + 5 });
    if (t && t.length < MIN.title) out.push({ ok: false, info: true, text: `Title is short (${t.length} characters). There’s room to say more.`, hard: false });
  }
  if (!page.pattern || !isPattern(d)) {
    out.push({ ok: !!d && d.length <= LIMIT.description, text: !d ? 'No meta description' : d.length > LIMIT.description ? `Description is ${d.length} characters, over ${LIMIT.description}` : `Description is ${d.length} characters`, hard: !d || d.length > LIMIT.description + 10 });
    if (d && d.length < MIN.description) out.push({ ok: false, info: true, text: `Description is short (${d.length} characters).`, hard: false });
  }
  if (page.keyword) {
    const has = kwIn(t, page.keyword);
    out.push({ ok: has, text: `${has ? 'Title contains' : 'Title doesn’t contain'} the primary keyword “${page.keyword}”`, hard: true });
  }
  out.push({ ok: /^\/([a-z0-9]+(-[a-z0-9]+)*\/?)*$/.test(s), text: /^\/([a-z0-9]+(-[a-z0-9]+)*\/?)*$/.test(s) ? 'Slug is lowercase words and hyphens' : `Slug “${s}” should be lowercase words joined by hyphens`, hard: true });
  if (page.path === '/') out.push({ ok: s === '/', text: s === '/' ? 'Home page stays at /' : 'The home page must stay at /', hard: true });
  const em = [t, d].some(x => EM.test(x));
  if (em) out.push({ ok: false, text: 'Uses an em dash', hard: true });
  return out;
}

export function siteChecks(pages, edits) {
  const list = pages.filter(p => p.planned), out = [];
  const dup = f => {
    const m = new Map();
    for (const p of list) { const v = f === 'slug' ? normPath(value(p, f, edits)) : norm(value(p, f, edits)).toLowerCase(); if (v) m.set(v, [...(m.get(v) || []), p.name]); }
    return [...m].filter(([, v]) => v.length > 1);
  };
  const dt = dup('title'), dd = dup('description'), ds = dup('slug');
  out.push({ ok: !dt.length, text: dt.length ? 'Same title on several pages: ' + dt.map(([, v]) => v.join(', ')).join('; ') : 'Every title is unique', hard: true });
  out.push({ ok: !dd.length, text: dd.length ? 'Same description on several pages: ' + dd.map(([, v]) => v.join(', ')).join('; ') : 'Every description is unique', hard: true });
  out.push({ ok: !ds.length, text: ds.length ? 'Two pages would share a URL: ' + ds.map(([k, v]) => `${k} (${v.join(', ')})`).join('; ') : 'Every URL is unique', hard: true });
  const kw = new Map();
  for (const p of list) if (p.keyword) kw.set(p.keyword.toLowerCase(), [...(kw.get(p.keyword.toLowerCase()) || []), p.name]);
  const dk = [...kw].filter(([, v]) => v.length > 1);
  out.push({ ok: !dk.length, text: dk.length ? 'Primary keyword on several pages: ' + dk.map(([k, v]) => `“${k}” (${v.join(', ')})`).join('; ') : 'Every primary keyword has one page', hard: false });
  return out;
}

/** A title pattern like "{Name} | Brand" as a test for a live title. */
export const patternTest = pattern => {
  const parts = norm(pattern).split(/\{[^}]+\}/).map(x => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp('^' + parts.join('.+') + '$', 'i');
};
