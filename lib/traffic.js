// Search traffic from an export: a CSV from Search Console (Pages), GA4 (Landing page) or Google Ads (Landing page),
// read on this Mac. It ranks the redirect map by real clicks and keeps a before-launch number to compare with after.
// No account is connected; the person exports the file and drops it in.

/** Rows of a CSV, with quoted fields, a byte order mark, commas or tabs, and Windows line ends. */
function rows(text) {
  text = String(text || '').replace(/^﻿/, '');
  const first = text.split('\n').find(l => l.trim() && !l.startsWith('#')) || '';
  const sep = (first.match(/\t/g) || []).length > (first.match(/,/g) || []).length ? '\t' : ',';
  const out = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
    if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); out.push(row); }
  return out.map(r => r.map(x => x.trim())).filter(r => r.some(Boolean));
}

const METRICS = [['clicks', /^clicks$/i], ['sessions', /^sessions$/i], ['views', /^(views|page ?views|screen ?page ?views)$/i], ['users', /^(users|total users|active users)$/i]];
const PAGE = /^(top pages|pages?|landing page( \+ query string)?|page path( and screen class| \+ query string)?|url|address|final url)$/i;
const num = s => { const n = Number(String(s || '').replace(/[,\s]/g, '').replace(/%$/, '')); return isFinite(n) ? n : null; };
const pathOf = v => { v = String(v || '').trim(); if (!v) return null; if (/^https?:\/\//i.test(v)) { try { const u = new URL(v); return u.pathname || '/'; } catch { return null; } } return v.startsWith('/') ? v.split('?')[0].split('#')[0] : null; };

/**
 * Reads an export: which column holds the page, which holds the clicks (or sessions, views, users), and where it
 * came from. Throws a plain message when it can't find both.
 */
function parse(text, name = '') {
  const all = rows(text).filter(r => !String(r[0] || '').startsWith('#'));
  const hi = all.findIndex(r => r.some(x => PAGE.test(x)) && r.some(x => METRICS.some(([, re]) => re.test(x))));
  if (hi < 0) throw new Error('Couldn’t find a page column and a clicks or sessions column. Export the Pages report from Search Console, or Landing page from GA4 or Google Ads.');
  const head = all[hi];
  const pi = head.findIndex(x => PAGE.test(x));
  const [metric, mi] = METRICS.map(([k, re]) => [k, head.findIndex(x => re.test(x))]).find(([, i]) => i >= 0);
  const ii = head.findIndex(x => /^impressions$|^impr\.?$/i.test(x));
  const source = /^top pages$/i.test(head[pi]) || (/search console|pages\.csv/i.test(name)) ? 'Search Console' : /cost|impr/i.test(head.join(' ')) ? 'Google Ads' : metric === 'sessions' || /landing page|page path/i.test(head[pi]) ? 'GA4' : 'CSV';
  const by = new Map();
  for (const r of all.slice(hi + 1)) {
    const pth = pathOf(r[pi]), n = num(r[mi]);
    if (!pth || n == null) continue; // totals rows and blank lines
    const x = by.get(pth) || { path: pth, n: 0, impressions: 0 };
    x.n += n; if (ii >= 0) x.impressions += num(r[ii]) || 0;
    by.set(pth, x);
  }
  const list = [...by.values()].sort((a, b) => b.n - a.n);
  if (!list.length) throw new Error('The file has the right columns but no pages in it.');
  return { source, metric, total: list.reduce((s, x) => s + x.n, 0), rows: list.slice(0, 5000) };
}

module.exports = { parse, rows };
