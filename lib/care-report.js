// The monthly care report: one page for a care client on what was done and how the site is. The work from the
// checklist, the month's health check, whether the site answered when Groundwork looked, search traffic from an
// export, the hours against the plan, and renewals. Made from what Groundwork recorded; nothing is guessed.
const STACK = require('./stack');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parse = d => { const [y, m, x] = String(d).split('-').map(Number); return new Date(y, m - 1, x); };
const long = d => (d ? parse(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');
const short = t => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const when = t => new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const iso = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const hm = m => { m = Math.round(m || 0); const h = Math.floor(m / 60), r = m % 60; return h ? (r ? `${h}h ${String(r).padStart(2, '0')}m` : `${h}h`) : `${r}m`; };

/**
 * `v` the project as the app shows it; `d`: month (a label), done [{title, at}], report (the month's launch check),
 * up (the up checks), mins and plan (hours), traffic and before (search traffic imports), and `opts`: studio,
 * yourName, note.
 */
function render(v, d, opts = {}) {
  const from = [opts.studio, opts.yourName].filter(Boolean);
  const r = d.report, checks = r && r.checks ? r.checks : [];
  const failing = checks.filter(c => !c.ok);
  const down = (d.up || []).filter(x => !x.ok);
  const lede = [
    r ? (failing.length ? `${failing.length} of the site’s ${checks.length} checks found something to fix.` : `Every one of the site’s ${checks.length} checks passed.`) : 'The site’s health check didn’t run this month.',
    d.up && d.up.length ? (down.length ? (d.up.length === 1 ? 'It didn’t answer when we looked.' : `It didn’t answer ${down.length} of the ${d.up.length} times we looked.`) : d.up.length === 1 ? 'It answered when we looked.' : `It answered all ${d.up.length} times we looked.`) : '',
  ].filter(Boolean).join(' ');
  const sec = (title, body) => body ? `<section><h2>${esc(title)}</h2>${body}</section>` : '';
  const rows = list => `<table>${list.filter(Boolean).map(([k, val]) => `<tr><th>${esc(k)}</th><td>${val}</td></tr>`).join('')}</table>`;

  const work = d.done && d.done.length ? `<ul class="rows">${d.done.map(x => `<li><span>${esc(x.title)}</span><span class="d">${x.at ? esc(short(x.at)) : ''}</span></li>`).join('')}</ul>` : '';
  const speed = r && r.info && r.info.speed ? r.info.speed.filter(s => !s.error && s.lcp != null) : [];
  const health = r ? `<ul class="rows">${checks.map(c => { const n = c.issues.filter(i => !i.soft).length; return `<li><span>${esc(c.name)}</span><span class="d${c.ok ? '' : ' bad'}">${c.ok ? 'Passed' : `${n} to fix`}</span></li>`; }).join('')}</ul>
    ${speed.length ? `<p class="muted">On a phone, the main content showed in ${speed.map(s => `${(s.lcp / 1000).toFixed(1)} s on ${s.path === '/' ? 'the home page' : esc(s.path)}`).join(', ')}. Google’s target is 2.5 s.</p>` : ''}
    <p class="muted">${esc(r.pagesChecked)} pages checked on ${esc(long(iso(r.started)))}.</p>` : '';
  const upBody = d.up && d.up.length ? `<p>${down.length ? (d.up.length === 1 ? 'The site didn’t answer when we checked:' : `The site didn’t answer ${down.length} of the ${d.up.length} times we checked:`) : (d.up.length === 1 ? `The site answered when we checked on ${esc(short(d.up[0].at))}.` : `The site answered every time we checked, ${d.up.length} times between ${esc(short(d.up[d.up.length - 1].at))} and ${esc(short(d.up[0].at))}.`)}</p>${down.length ? `<ul class="rows">${down.slice(0, 10).map(x => `<li><span>${esc(when(x.at))}</span><span class="d bad">${x.status ? `HTTP ${x.status}` : esc(x.error || 'No answer')}</span></li>`).join('')}</ul>` : ''}<p class="muted">We check while our Mac is on, so this isn’t round-the-clock monitoring.</p>` : '';
  const t = d.traffic;
  const traffic = t ? `${rows([
    [`${t.metric[0].toUpperCase()}${t.metric.slice(1)}`, `${t.total.toLocaleString()}${d.before && d.before.metric === t.metric ? `, ${Math.round((100 * (t.total - d.before.total)) / Math.max(1, d.before.total)) >= 0 ? 'up' : 'down'} ${Math.abs(Math.round((100 * (t.total - d.before.total)) / Math.max(1, d.before.total)))}% on ${d.before.via === 'google' ? 'the month before' : 'the export before'}` : ''}`],
    ['Top pages', t.rows.slice(0, 5).map(x => `${esc(x.path)} (${x.n.toLocaleString()})`).join('<br>')],
  ])}<p class="muted">${t.from ? `From ${esc(t.source)}, ${esc(short(t.from + 'T00:00'))} to ${esc(short(t.to + 'T00:00'))}.` : `From the ${esc(t.source)} export of ${esc(short(t.at))}.`}</p>` : '';
  const hours = d.mins || d.plan ? rows([['Time on the site', d.plan ? `${hm(d.mins)} of the ${d.plan} ${d.plan === 1 ? 'hour' : 'hours'} in your plan` : hm(d.mins)]]) : '';
  const rn = v.renewals;
  const renew = rn ? rows([
    rn.domain && rn.domain.expires && ['Domain', `${esc(rn.domain.domain)} renews by ${esc(long(rn.domain.expires))}${rn.domain.registrar ? `, with ${esc(rn.domain.registrar)}` : ''}`],
    rn.ssl && rn.ssl.expires && ['SSL certificate', `Valid until ${esc(long(rn.ssl.expires))}${rn.ssl.auto || rn.hosted ? ', renews itself' : ''}`],
  ]) : '';
  const stackRows = STACK.rows(r && r.info && r.info.stack, r && r.staging ? null : rn);
  const runsOn = stackRows.length ? rows(stackRows.map(([k, val]) => [k, esc(val)])) : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(v.name)}: care report, ${esc(d.month)}</title>
<style>
:root { --fg: #161716; --muted: #6f6e6a; --line: #e6e6e3; --soft: #f3f3f1; --bad: #b42318; }
* { box-sizing: border-box; }
html { background: #fff; }
body { margin: 0; color: var(--fg); font: 14.5px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
main { max-width: 760px; margin: 0 auto; padding: 48px 32px 64px; }
.eyebrow { color: var(--muted); font-size: 13px; }
h1 { font-size: 28px; line-height: 1.2; font-weight: 500; margin: 6px 0 8px; }
.lede { margin: 0; font-size: 15.5px; }
.note { margin-top: 18px; padding: 14px 16px; background: var(--soft); border-radius: 10px; white-space: pre-line; }
h2 { font-size: 15px; font-weight: 500; margin: 32px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; vertical-align: top; padding: 7px 0; border-bottom: 1px solid var(--line); }
tr:last-child th, tr:last-child td { border-bottom: 0; }
th { width: 170px; font-weight: 400; color: var(--muted); }
.rows { list-style: none; margin: 0; padding: 0; }
.rows li { display: grid; grid-template-columns: 1fr auto; gap: 16px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.rows li:last-child { border-bottom: 0; }
.d { color: var(--muted); white-space: nowrap; }
.d.bad { color: var(--bad); }
p { margin: 0 0 8px; }
.muted { color: var(--muted); font-size: 12.5px; margin: 8px 0 0; }
footer { margin-top: 40px; color: var(--muted); font-size: 13px; }
@page { margin: 16mm; }
@media print { main { padding: 0; } li, tr, .note { break-inside: avoid; } h2 { break-after: avoid; } }
</style></head>
<body><main>
<header>
<div class="eyebrow">${esc(from.join(' · '))}${from.length ? ' · ' : ''}${esc(d.month)}</div>
<h1>${esc(v.name)}: care report</h1>
<p class="lede">${esc(lede)}</p>
${opts.note ? `<div class="note">${esc(opts.note)}</div>` : ''}
</header>
${sec('What we did', work || '<p class="muted">Nothing from the care checklist was ticked off yet.</p>')}
${sec('Health check', health)}
${sec('Up and running', upBody)}
${sec('Search traffic', traffic)}
${sec('Hours', hours)}
${sec('Renewals', renew)}
${sec('What the site runs on', runsOn)}
<footer>${opts.yourName ? `Questions? Ask ${esc(opts.yourName)}${opts.studio ? ` at ${esc(opts.studio)}` : ''}.` : ''}</footer>
</main></body></html>`;
}

module.exports = { render };
