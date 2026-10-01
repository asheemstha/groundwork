// The handoff document: one page for the client, and for whoever runs the site or its marketing next. What the site
// is and where it lives, who owns which account, what's installed (from the tracking check), how the launch check
// went, the redirects, and when the domain and certificate renew. Made from the project; nothing is guessed.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parse = d => { const [y, m, x] = String(d).split('-').map(Number); return new Date(y, m - 1, x); };
const long = d => (d ? parse(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');
const iso = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const host = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u || ''; } };
const OWNER = { client: 'You', us: 'Us', none: 'Not used', '': 'Not set' };

/**
 * `v` is the project as the app shows it; `report` the latest launch check (of the live domain when there is one);
 * `opts`: studio, yourName, note, platform (the platform's name).
 */
function render(v, report, opts = {}) {
  const from = [opts.studio, opts.yourName].filter(Boolean);
  const live = v.sites.live, staging = report && report.staging;
  const sec = (title, body) => body ? `<section><h2>${esc(title)}</h2>${body}</section>` : '';
  const rows = list => `<table>${list.filter(Boolean).map(([k, val]) => `<tr><th>${esc(k)}</th><td>${val}</td></tr>`).join('')}</table>`;

  const site = rows([
    live && ['Live site', `<a href="${esc(live)}">${esc(host(live))}</a>`],
    opts.platform && ['Built with', esc(opts.platform)],
    v.launch && [v.launch <= iso(Date.now()) ? 'Launched' : 'Launch planned', esc(long(v.launch))],
    v.sites.old && v.sites.old !== live && ['Replaced', esc(host(v.sites.old))],
  ]);

  // Accounts filled in at least partly; empty and "not used" ones stay out.
  const accounts = (v.accounts || []).filter(a => a.owner !== 'none' && (a.owner || a.where || a.login));
  const acc = accounts.length ? `<table class="grid"><thead><tr><th>Account</th><th>Where</th><th>Owner</th><th>Login</th></tr></thead><tbody>${accounts.map(a => `<tr><td>${esc(a.name)}${a.note ? `<div class="sub">${esc(a.note)}</div>` : ''}</td><td>${esc(a.where)}</td><td>${esc(OWNER[a.owner] || '')}${a.owner !== 'us' && a.revoke ? '<div class="sub">Our access is removed at handoff</div>' : ''}${a.owner === 'us' ? '<div class="sub">Ask us to move it to you</div>' : ''}</td><td>${esc(a.login)}</td></tr>`).join('')}</tbody></table><p class="muted">Logins only. Passwords are never written down here: keep them in a password manager.</p>` : '';

  const t = report && report.info && report.info.tracking;
  const installed = t ? `${t.tags.length ? `<table class="grid"><thead><tr><th>Tag</th><th>ID</th><th>Loads on</th></tr></thead><tbody>${t.tags.map(x => `<tr><td>${esc(x.name)}</td><td>${esc(x.ids.join(', '))}</td><td>${x.pages === x.of ? 'Every page checked' : `${x.pages} of ${x.of} pages`}</td></tr>`).join('')}</tbody></table>` : '<p>No analytics or ad tags were found.</p>'}
    ${rows([
      ['Cookie banner', esc(t.banner || 'None found')],
      t.banner && t.firstVisit && ['Before a choice', esc(t.firstVisit.length ? `${t.firstVisit.join(', ')} ${t.firstVisit.length === 1 ? 'tracks' : 'track'}` : 'Nothing tracks')],
      t.banner && t.afterReject && ['After “Reject”', esc(t.afterReject.length ? `${t.afterReject.join(', ')} still ${t.afterReject.length === 1 ? 'tracks' : 'track'}` : 'Nothing tracks')],
      ['Google consent mode', t.consentMode ? 'On' : 'Not in use'],
      t.redirects.length && ['Ad click IDs', t.redirects.every(r => r.kept) ? 'Kept through redirects' : 'Some redirects drop them'],
    ])}
    <p class="muted">From the ${staging ? 'staging' : 'live site’s'} check on ${esc(long(iso(report.started)))}, seen from a visitor’s browser. It shows what the site tries to send, not what the accounts receive.</p>` : '';

  const checks = report && report.checks ? report.checks.filter(c => !(staging && ['indexing', 'https'].includes(c.id))) : [];
  const launch = checks.length ? `<ul class="checks">${checks.map(c => { const n = c.issues.filter(i => !i.soft).length; return `<li class="${c.ok ? 'ok' : 'bad'}"><span>${esc(c.name)}</span><span>${c.ok ? 'Passed' : `${n} ${n === 1 ? 'issue' : 'issues'} open`}</span></li>`; }).join('')}</ul><p class="muted">${esc(report.pagesChecked)} pages checked on ${esc(long(iso(report.started)))}${staging ? ', on staging' : ''}.</p>` : '';

  const rd = v.tools && v.tools.redirects;
  const redirects = rd ? rows([
    ['Old addresses mapped', `${rd.total}, with ${rd.redirects} ${rd.redirects === 1 ? 'redirect' : 'redirects'}`],
    rd.test && ['Last test', `${rd.test.ok} of ${rd.test.total} working on ${esc(long(iso(rd.test.at)))}${rd.test.live ? '' : rd.test.oldSite ? ' (the old site)' : ' (staging)'}`],
    ['Keep them', 'Leave the redirects in place for at least a year, so old links and search results still land on the right page.'],
  ]) : '';

  const r = v.renewals;
  const renew = r ? rows([
    r.domain && r.domain.expires && ['Domain', `${esc(r.domain.domain)} renews by ${esc(long(r.domain.expires))}${r.domain.registrar ? `, with ${esc(r.domain.registrar)}` : ''}`],
    r.ssl && r.ssl.expires && ['SSL certificate', `Valid until ${esc(long(r.ssl.expires))}${r.ssl.auto || r.hosted ? ', renews itself' : r.ssl.issuer ? `, issued by ${esc(r.ssl.issuer)}` : ''}`],
  ]) : '';

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(v.name)}: handoff</title>
<style>
:root { --fg: #161716; --muted: #6f6e6a; --line: #e6e6e3; --soft: #f3f3f1; --bad: #b42318; }
* { box-sizing: border-box; }
html { background: #fff; }
body { margin: 0; color: var(--fg); font: 14.5px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
main { max-width: 760px; margin: 0 auto; padding: 48px 32px 64px; }
a { color: var(--fg); }
.eyebrow { color: var(--muted); font-size: 13px; }
h1 { font-size: 28px; line-height: 1.2; font-weight: 500; margin: 6px 0 8px; }
.lede { margin: 0; font-size: 15.5px; }
.note { margin-top: 18px; padding: 14px 16px; background: var(--soft); border-radius: 10px; white-space: pre-line; }
h2 { font-size: 15px; font-weight: 500; margin: 32px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
table { width: 100%; border-collapse: collapse; }
th, td { text-align: left; vertical-align: top; padding: 7px 0; border-bottom: 1px solid var(--line); }
tr:last-child th, tr:last-child td { border-bottom: 0; }
table:not(.grid) th { width: 170px; font-weight: 400; color: var(--muted); }
.grid th { font-weight: 400; color: var(--muted); font-size: 12.5px; }
.grid td, .grid th { padding-right: 14px; }
.sub { color: var(--muted); font-size: 12.5px; }
.muted { color: var(--muted); font-size: 12.5px; margin: 8px 0 0; }
.checks { list-style: none; margin: 0; padding: 0; }
.checks li { display: grid; grid-template-columns: 1fr auto; gap: 16px; padding: 7px 0; border-bottom: 1px solid var(--line); }
.checks li:last-child { border-bottom: 0; }
.checks li span:last-child { color: var(--muted); white-space: nowrap; }
.checks li.bad span:last-child { color: var(--bad); }
footer { margin-top: 40px; color: var(--muted); font-size: 13px; }
@page { margin: 16mm; }
@media print { main { padding: 0; } tr, li, .note { break-inside: avoid; } h2 { break-after: avoid; } }
</style></head>
<body><main>
<header>
<div class="eyebrow">${esc(from.join(' · '))}${from.length ? ' · ' : ''}${esc(long(iso(Date.now())))}</div>
<h1>${esc(v.name)}: handoff</h1>
<p class="lede">Everything about the site in one place: where it lives, who owns which account, what’s installed, and what to keep an eye on.</p>
${opts.note ? `<div class="note">${esc(opts.note)}</div>` : ''}
</header>
${sec('The site', site)}
${sec('Accounts and who owns them', acc)}
${sec('What’s installed', installed)}
${sec('Launch check', launch)}
${sec('Redirects', redirects)}
${sec('Renewals', renew)}
<footer>${opts.yourName ? `Questions? Ask ${esc(opts.yourName)}${opts.studio ? ` at ${esc(opts.studio)}` : ''}.` : ''}</footer>
</main></body></html>`;
}

module.exports = { render };
