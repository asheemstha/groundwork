// Content inventory: every page the old site's scan found, with a call on what to do with it in the new site: keep,
// rewrite, merge into another page, or remove. The first calls come from plain rules on the scan's data (words on the
// page, whether it's in the menu, duplicate titles, pages that don't load); AI can make them instead, and you decide.
const DECISIONS = ['keep', 'rewrite', 'merge', 'remove'];
const bare = t => String(t || '').split(/\s[|–·-]\s/)[0].trim();
const parentOf = p => p.split('/').slice(0, -1).join('/') || '/';
// Pages that are short by nature: contact, booking, search, account and thank-you pages.
const UTILITY = /(^|\/)(contact|book|booking|quote|enquir|inquir|thank|search|login|log-in|sign-?in|account|cart|checkout|subscribe|404|sitemap)/i;

/** The scan's pages with what the inventory needs. `read(page)` returns the page's saved crawl data, or null. */
function pagesOf(run, read) {
  return (run.pages || []).slice(0, 1000).map(pg => {
    const d = pg.status ? read(pg) : null;
    const text = d ? (d.items || []).filter(i => !i.link && !i.hidden).map(i => i.text || '').join(' ') : '';
    return {
      path: pg.path, name: pg.name || pg.path, title: bare(d ? d.title : pg.title), status: pg.status || null,
      words: d ? text.split(/\s+/).filter(Boolean).length : null, h1: d ? ((d.items || []).find(i => i.kind === 'h1') || {}).text || '' : '',
      desc: d ? d.desc || '' : '', excerpt: text.slice(0, 300),
      nav: (pg.sources || []).some(s => s === 'header' || s === 'footer'), home: pg.path === '/', legal: !!pg.legal, collection: pg.collection || null,
    };
  });
}

/** Plain-rule calls. Anything the scan didn't read stays "keep" to look at. */
function suggest(pages) {
  const byTitle = new Map();
  for (const p of pages) if (p.title && p.status && p.status < 400) byTitle.set(p.title.toLowerCase(), [...(byTitle.get(p.title.toLowerCase()) || []), p]);
  const paths = new Set(pages.map(p => p.path));
  return pages.map(p => {
    const row = { path: p.path, name: p.name, title: p.title, words: p.words, status: p.status, nav: p.nav, collection: p.collection, decision: 'keep', reason: '', into: null, by: 'rule', sure: false };
    if (p.home) return { ...row, reason: 'The home page', sure: true };
    if (p.status && p.status >= 400) return { ...row, decision: 'remove', reason: `Doesn’t load now (HTTP ${p.status}). Redirect it.`, sure: true };
    if (p.legal) return { ...row, reason: 'A legal page. Have the client confirm the text is current.' };
    if (p.words == null) return { ...row, reason: 'The scan didn’t read this page. Open it to decide.' };
    if (UTILITY.test(p.path)) return { ...row, reason: 'A contact or utility page, short by nature', sure: true };
    // A collection's own page (/blog for /blog/posts) is a list, so few words is normal.
    if (pages.some(x => x.collection === p.path)) return { ...row, reason: `Lists the ${p.path} pages`, sure: true };
    const twins = (byTitle.get((p.title || '').toLowerCase()) || []).filter(x => x !== p);
    if (p.title && twins.length) {
      const best = [p, ...twins].sort((a, b) => (b.nav - a.nav) || ((b.words || 0) - (a.words || 0)))[0];
      if (best !== p) return { ...row, decision: 'merge', into: best.path, reason: `Same title as ${best.path}` };
    }
    // Word counts come from the scan's text blocks, so they run a little low; the limits allow for that.
    if (p.collection) return p.words < 150 ? { ...row, decision: 'rewrite', reason: `A short entry in ${p.collection} (${p.words} words)` } : { ...row, reason: `Part of ${p.collection}` };
    if (p.words < 80 && !p.nav) {
      const parent = parentOf(p.path);
      return parent !== '/' && paths.has(parent) ? { ...row, decision: 'merge', into: parent, reason: `Very little on it (${p.words} words)` } : { ...row, decision: 'remove', reason: `Very little on it (${p.words} words), and not in the menu` };
    }
    if (p.nav && p.words < 100) return { ...row, decision: 'rewrite', reason: `A main page with little on it (${p.words} words)` };
    return { ...row, reason: p.nav ? 'In the menu' : `${p.words} words` };
  });
}

/** The AI's calls, from the same data. Returns { path: {decision, reason, into} }. */
async function aiSuggest(pages, ask) {
  const read = pages.filter(p => p.words != null || p.home).slice(0, 150);
  const lines = read.map(p => `${p.path} | title: ${p.title || '-'} | h1: ${p.h1 || '-'} | ${p.words ?? '?'} words | ${p.nav ? 'in the menu' : p.collection ? 'in ' + p.collection : 'not in the menu'}${p.status >= 400 ? ' | HTTP ' + p.status : ''} | starts: ${p.excerpt.slice(0, 160).replace(/\|/g, '/')}`).join('\n');
  const prompt = `You're helping plan a website redesign. For each page of the current site below, decide what to do with it on the new site:
- keep: worth carrying over as it is, or with light edits
- rewrite: the topic belongs on the new site, but the page is thin, dated or unclear
- merge: overlaps another page; say which one in "into" (a path from the list)
- remove: no longer needed (redirect it to the closest page)
Base it only on what's listed. There's no traffic data, so don't remove pages that look like they answer a real question. Keep the home page. Keep legal pages.
Answer with JSON only: {"pages": [{"path": string, "decision": "keep" | "rewrite" | "merge" | "remove", "reason": string (under 12 words, plain, no em dashes), "into": string or null}]}

Pages (path | title | h1 | words | menu | how it starts):
${lines}`;
  const text = await ask(prompt);
  const m = String(text).match(/\{[\s\S]*\}/); if (!m) throw new Error('The AI’s answer couldn’t be read. Try again.');
  const known = new Set(pages.map(p => p.path)), out = {};
  for (const x of JSON.parse(m[0]).pages || []) {
    if (!known.has(x.path) || !DECISIONS.includes(x.decision)) continue;
    const why = String(x.reason || '').replace(/—/g, ',').trim().slice(0, 120);
    out[x.path] = { decision: x.decision, reason: why.charAt(0).toUpperCase() + why.slice(1), into: x.decision === 'merge' && known.has(x.into) && x.into !== x.path ? x.into : null };
    if (x.decision === 'merge' && !out[x.path].into) out[x.path].decision = 'rewrite';
  }
  return out;
}

module.exports = { DECISIONS, pagesOf, suggest, aiSuggest };
