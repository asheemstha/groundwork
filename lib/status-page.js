// The client status page: a read-only page made from a project, to send as a PDF or an HTML file. It shows where
// the project stands, what the client still owes, what was done lately and what's next, in plain words. Nothing
// internal goes in: no notes, links, payments, scans or tool results.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parse = d => { const [y, m, x] = String(d).split('-').map(Number); return new Date(y, m - 1, x); };
const day = d => (d ? parse(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '');
const long = d => (d ? parse(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');
const iso = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

/** What the page holds, from the project as the app shows it. `opts` turns sections on and off. */
function content(v, opts = {}) {
  const today = iso(Date.now()), soon = iso(Date.now() + 14 * 864e5), since = Date.now() - (opts.days || 14) * 864e5;
  const all = v.phases.flatMap(ph => [...ph.groups.flatMap(g => g.items), ...ph.handoff.items]);
  const cur = v.phases.find(ph => ph.id === v.current);
  const behind = v.behind && v.behind.days >= 7 && !!cur;
  const status = !cur ? 'Every phase is signed off.'
    : behind ? `We’re working through ${cur.name}, about ${v.behind.days} days behind the plan${v.launch ? `, and still aiming for launch on ${long(v.launch)}` : ''}.`
    : v.client.late.length ? `We’re in ${cur.name}${v.launch ? ` and on course for launch on ${long(v.launch)}` : ''}, as long as the items you owe arrive soon.`
    : `We’re in ${cur.name}${v.launch ? ` and on track for launch on ${long(v.launch)}` : ''}.`;
  const phases = v.phases.map(ph => ({
    name: ph.name, state: ph.state,
    // A date that has passed reads as what was planned, so a project running late doesn't promise the past.
    text: ph.state === 'signed' ? `Signed off ${day(ph.signoff && ph.signoff.date)}`
      : ph.state === 'current' ? `In progress, ${ph.total ? Math.round((100 * ph.done) / ph.total) : 0}% done${ph.due ? (ph.due < today ? `, sign-off was planned for ${day(ph.due)}` : `, sign-off planned for ${day(ph.due)}`) : ''}`
      : ph.due ? (ph.due < today ? `Was planned to finish ${day(ph.due)}` : `Planned to finish ${day(ph.due)}`) : 'Coming up',
    pct: ph.state === 'signed' ? 100 : ph.total ? Math.round((100 * ph.done) / ph.total) : 0,
  }));
  const waiting = [...v.client.late, ...v.client.soon, ...v.client.notAsked.filter(x => !x.askBy || x.askBy <= today)]
    .map(x => ({ title: x.title, due: x.due, late: !!x.late, done: x.doneMeans || '' }));
  const done = [
    ...v.phases.filter(ph => ph.signoff && ph.signoff.at >= since).map(ph => ({ title: `${ph.handoff.title} (signed off)`, at: ph.signoff.at })),
    ...all.filter(x => x.status === 'done' && (x.at || 0) >= since).map(x => ({ title: x.who === 'client' ? `Received: ${x.title}` : x.title, at: x.at })),
  ].sort((a, b) => b.at - a.at).slice(0, 15);
  const next = all.filter(x => x.status === 'todo' && x.who === 'us' && (x.phaseId === (cur && cur.id) || (!!x.due && x.due <= soon)))
    .sort((a, b) => (a.due || '9999') < (b.due || '9999') ? -1 : 1).slice(0, 8).map(x => ({ title: x.title, due: x.due }));
  return { status, phases, waiting, done, next, kickoff: v.kickoff, launch: v.launch, days: opts.days || 14 };
}

function render(v, opts = {}) {
  const c = content(v, opts), on = k => opts[k] !== false;
  const from = [opts.agency, opts.yourName].filter(Boolean);
  const list = (rows, right) => rows.length ? `<ul class="rows">${rows.map(r => `<li><span class="t">${esc(r.title)}</span>${right(r)}</li>`).join('')}</ul>` : '';
  const sections = [];
  if (on('waiting')) sections.push(`<section><h2>What we need from you</h2>${c.waiting.length ? list(c.waiting, r => `<span class="d${r.late ? ' late' : ''}">${r.due ? (r.late ? `Was due ${day(r.due)}` : `By ${day(r.due)}`) : ''}</span>`) : '<p class="empty">Nothing right now. Thank you!</p>'}</section>`);
  if (on('done')) sections.push(`<section><h2>Done in the last ${c.days === 7 ? 'week' : `${c.days} days`}</h2>${list(c.done, r => `<span class="d">${day(iso(r.at))}</span>`) || '<p class="empty">Nothing new to show since the last update.</p>'}</section>`);
  if (on('next')) sections.push(`<section><h2>Up next</h2>${list(c.next, r => `<span class="d">${r.due ? day(r.due) : ''}</span>`) || '<p class="empty">Nothing scheduled for the next two weeks.</p>'}</section>`);
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(v.name)}: project status</title>
<style>
:root { --fg: #161716; --muted: #6f6e6a; --line: #e6e6e3; --soft: #f3f3f1; --bar: #161716; --late: #b42318; }
* { box-sizing: border-box; }
html { background: #fff; }
body { margin: 0; color: var(--fg); font: 15px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
main { max-width: 760px; margin: 0 auto; padding: 48px 32px 64px; }
.eyebrow { color: var(--muted); font-size: 13px; }
h1 { font-size: 30px; line-height: 1.2; font-weight: 500; margin: 6px 0 8px; }
.lede { font-size: 16px; margin: 0; }
.note { margin-top: 20px; padding: 14px 16px; background: var(--soft); border-radius: 10px; white-space: pre-line; }
h2 { font-size: 15px; font-weight: 500; margin: 34px 0 8px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
.dates { display: flex; gap: 28px; margin: 18px 0 0; color: var(--muted); font-size: 13.5px; }
.dates b { display: block; color: var(--fg); font-weight: 500; font-size: 15px; }
.phases { list-style: none; margin: 0; padding: 0; }
.phases li { display: grid; grid-template-columns: 150px 1fr 120px; gap: 14px; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--line); }
.phases li:last-child { border-bottom: 0; }
.phases .n { font-weight: 500; }
.phases .upcoming .n, .phases .upcoming .s { color: var(--muted); }
.phases .s { color: var(--muted); font-size: 13.5px; }
.bar { height: 5px; border-radius: 3px; background: var(--soft); overflow: hidden; }
.bar span { display: block; height: 100%; background: var(--bar); }
.rows { list-style: none; margin: 0; padding: 0; }
.rows li { display: grid; grid-template-columns: 1fr auto; gap: 16px; padding: 8px 0; border-bottom: 1px solid var(--line); }
.rows li:last-child { border-bottom: 0; }
.rows .d { color: var(--muted); font-size: 13.5px; white-space: nowrap; }
.rows .d.late { color: var(--late); }
.empty { color: var(--muted); margin: 0; }
footer { margin-top: 40px; color: var(--muted); font-size: 13px; }
@media (max-width: 600px) { main { padding: 28px 16px 40px; } .phases li { grid-template-columns: 1fr; gap: 4px; } }
@page { margin: 16mm; }
@media print { main { padding: 0; } li, .note, .dates { break-inside: avoid; } h2 { break-after: avoid; } }
</style></head>
<body><main>
<header>
<div class="eyebrow">${esc(from.join(' · '))}${from.length ? ' · ' : ''}Updated ${long(iso(Date.now()))}</div>
<h1>${esc(v.name)}</h1>
<p class="lede">${esc(c.status)}</p>
${(c.kickoff || c.launch) ? `<div class="dates">${c.kickoff ? `<span>Kickoff<b>${long(c.kickoff)}</b></span>` : ''}${c.launch ? `<span>${esc((v.labels && v.labels.launch) || 'Target launch')}<b>${long(c.launch)}</b></span>` : ''}</div>` : ''}
${opts.note ? `<div class="note">${esc(opts.note)}</div>` : ''}
</header>
<section><h2>Where things stand</h2><ol class="phases">${c.phases.map(ph => `<li class="${ph.state}"><span class="n">${esc(ph.name)}</span><span class="s">${esc(ph.text)}</span><span class="bar"><span style="width:${ph.pct}%"></span></span></li>`).join('')}</ol></section>
${sections.join('\n')}
<footer>${opts.yourName ? `Questions? Reply to ${esc(opts.yourName)}.` : 'Questions? Just reply to the email this came with.'}</footer>
</main></body></html>`;
}

module.exports = { render, content };
