// A site check as a page for the client: the verdict in a sentence, every check with its result, and the problems
// worst first, each with what to do and where. Made from one launch check; nothing is guessed.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const long = t => new Date(t).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

// The short names a client reads, and how much each kind of problem matters, most first.
const SHORT = { indexing: 'Search engines', placeholders: 'Placeholders', links: 'Links', seo: 'SEO basics', a11y: 'Accessibility', speed: 'Speed on a phone', tracking: 'Tracking', canonicals: 'Canonicals', legal: 'Legal pages', https: 'https and www' };
const WEIGHT = { indexing: 10, https: 9, links: 8, speed: 7, tracking: 6, a11y: 6, seo: 5, canonicals: 5, placeholders: 4, legal: 3 };
const LATER = ['indexing', 'https'];

/** The checks that count (on staging, two wait for the live domain), and the problems worst first. */
function verdict(r) {
  const checks = (r.checks || []).filter(c => !(r.staging && LATER.includes(c.id)));
  const passed = checks.filter(c => c.ok).length;
  const problems = checks.flatMap(c => c.issues.filter(i => !i.soft).map(i => ({ check: c.id, name: SHORT[c.id] || c.name, text: i.text, fix: i.fix || '', pages: Array.isArray(i.pages) ? i.pages : [] })))
    .sort((a, b) => (WEIGHT[b.check] || 0) - (WEIGHT[a.check] || 0) || b.pages.length - a.pages.length);
  const line = `${passed} of ${checks.length} checks pass.${problems.length ? ` ${problems.length} ${problems.length === 1 ? 'problem is' : 'problems are'} worth fixing.` : ' Nothing needs fixing right now.'}`;
  return { checks: checks.map(c => ({ id: c.id, name: SHORT[c.id] || c.name, ok: c.ok, n: c.issues.filter(i => !i.soft).length })), problems, line, passed, total: checks.length };
}
const where = pages => (!pages.length ? 'Site-wide' : pages.length === 1 ? (pages[0] === '/' ? 'Home page' : pages[0]) : `${pages.length} pages`);

/** `opts`: studio, yourName, name (what the site is called). */
function render(r, opts = {}) {
  const v = verdict(r);
  const from = [opts.studio, opts.yourName].filter(Boolean);
  const speed = r.info && r.info.speed ? r.info.speed.filter(s => !s.error && s.lcp != null) : [];
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(opts.name || r.host)}: site check</title>
<style>
:root { --fg: #161716; --muted: #6f6e6a; --line: #e6e6e3; --soft: #f3f3f1; --bad: #b42318; }
* { box-sizing: border-box; }
html { background: #fff; }
body { margin: 0; color: var(--fg); font: 14.5px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
main { max-width: 760px; margin: 0 auto; padding: 48px 32px 64px; }
.eyebrow { color: var(--muted); font-size: 13px; }
h1 { font-size: 28px; line-height: 1.2; font-weight: 500; margin: 6px 0 8px; }
.lede { margin: 0; font-size: 16px; }
h2 { font-size: 15px; font-weight: 500; margin: 32px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 24px; }
.grid div { display: flex; justify-content: space-between; gap: 12px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.ok { color: var(--muted); }
.bad { color: var(--bad); }
ol { margin: 0; padding: 0; list-style: none; counter-reset: n; }
ol li { counter-increment: n; display: grid; grid-template-columns: 28px 1fr auto; gap: 4px 12px; padding: 10px 0; border-bottom: 1px solid var(--line); }
ol li::before { content: counter(n); color: var(--muted); }
ol li .fix { grid-column: 2; color: var(--muted); font-size: 13.5px; }
ol li .where { color: var(--muted); font-size: 13px; white-space: nowrap; }
.muted { color: var(--muted); font-size: 12.5px; margin: 10px 0 0; }
footer { margin-top: 40px; color: var(--muted); font-size: 13px; }
@page { margin: 16mm; }
@media print { main { padding: 0; } li, .grid div { break-inside: avoid; } h2 { break-after: avoid; } }
</style></head>
<body><main>
<header>
<div class="eyebrow">${esc(from.join(' · '))}${from.length ? ' · ' : ''}${esc(long(r.started))}</div>
<h1>${esc(opts.name || r.host)}: site check</h1>
<p class="lede">${esc(v.line)}</p>
</header>
<h2>The checks</h2>
<div class="grid">${v.checks.map(c => `<div><span>${esc(c.name)}</span><span class="${c.ok ? 'ok' : 'bad'}">${c.ok ? 'Passed' : `${c.n} to fix`}</span></div>`).join('')}</div>
${v.problems.length ? `<h2>The problems, worst first</h2><ol>${v.problems.slice(0, 15).map(x => `<li><span>${esc(x.text)}</span><span class="where">${esc(where(x.pages))}</span>${x.fix ? `<span class="fix">${esc(x.fix)}</span>` : ''}</li>`).join('')}</ol>${v.problems.length > 15 ? `<p class="muted">And ${v.problems.length - 15} smaller ones.</p>` : ''}` : ''}
${speed.length ? `<p class="muted">On a phone, the main content showed in ${speed.map(s => `${(s.lcp / 1000).toFixed(1)} s on ${s.path === '/' ? 'the home page' : esc(s.path)}`).join(', ')}. Google’s target is 2.5 s.</p>` : ''}
<p class="muted">${esc(r.pagesChecked)} pages and ${esc(r.linksChecked)} links of ${esc(r.host)} checked on ${esc(long(r.started))}, from outside the site, the way Google and a visitor see it.</p>
<footer>${opts.yourName ? `Questions? Ask ${esc(opts.yourName)}${opts.studio ? ` at ${esc(opts.studio)}` : ''}.` : ''}</footer>
</main></body></html>`;
}

module.exports = { render, verdict };
