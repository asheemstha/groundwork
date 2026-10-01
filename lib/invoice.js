// Invoices: a PDF for a payment milestone or for hours logged, with your own payment details. Groundwork never takes
// payments; the invoice says how to pay you (a payment link, bank details), and you mark it paid.
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const parse = d => { const [y, m, x] = String(d).split('-').map(Number); return new Date(y, m - 1, x); };
const long = d => (d ? parse(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : '');

/**
 * An amount typed by hand, like "$2,400", "2400 EUR", "€1.250,50" or "90": the number and the currency as written
 * (a symbol before, or a code after). Null when there's no number in it.
 */
function parseMoney(s) {
  s = String(s ?? '').trim();
  const m = s.match(/^([^\d\s.,-]*)\s*(-?[\d.,\s]*\d)\s*([A-Za-z]{3})?/);
  if (!m) return null;
  let n = m[2].replace(/\s/g, '');
  const lastDot = n.lastIndexOf('.'), lastComma = n.lastIndexOf(',');
  // The last separator is the decimal point when two or fewer digits follow it; anything else groups thousands.
  const dec = Math.max(lastDot, lastComma);
  if (dec >= 0 && n.length - dec - 1 <= 2) n = n.slice(0, dec).replace(/[.,]/g, '') + '.' + n.slice(dec + 1);
  else n = n.replace(/[.,]/g, '');
  const value = Number(n);
  if (!isFinite(value)) return null;
  return { n: value, before: m[1] || '', after: m[3] ? m[3].toUpperCase() : '' };
}
/** A number in the same currency as `like`: "$2,400.00", "1,250.50 EUR". */
function fmtMoney(n, like = { before: '$', after: '' }) {
  const num = (Math.round(n * 100) / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${like.before || ''}${num}${like.after ? ' ' + like.after : ''}`;
}
const hrs = m => Math.round((m / 60) * 100) / 100;

/** The invoice as a page to print or save as a PDF. */
function render(inv, o = {}) {
  const cur = inv.currency || { before: '$', after: '' };
  const from = [o.studio, o.yourName].filter(Boolean);
  const rows = inv.lines.map(l => `<tr><td>${esc(l.text)}${l.sub ? `<div class="sub">${esc(l.sub)}</div>` : ''}</td><td class="n">${l.qty != null && inv.kind === 'hours' ? esc(String(l.qty)) : ''}</td><td class="n">${l.unit != null && inv.kind === 'hours' ? esc(fmtMoney(l.unit, cur)) : ''}</td><td class="n">${esc(fmtMoney(l.amount, cur))}</td></tr>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Invoice ${esc(inv.number)}</title>
<style>
:root { --fg: #161716; --muted: #6f6e6a; --line: #e6e6e3; --soft: #f3f3f1; }
* { box-sizing: border-box; }
html { background: #fff; }
body { margin: 0; color: var(--fg); font: 14px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
main { max-width: 760px; margin: 0 auto; padding: 48px 32px 64px; }
.top { display: grid; grid-template-columns: 1fr auto; gap: 24px; align-items: start; }
.from { white-space: pre-line; color: var(--muted); font-size: 13px; }
.from b { display: block; color: var(--fg); font-weight: 500; font-size: 15px; }
h1 { font-size: 28px; font-weight: 500; margin: 0; text-align: right; }
.meta { display: grid; grid-template-columns: auto auto; gap: 2px 18px; margin-top: 8px; font-size: 13px; text-align: right; }
.meta span { color: var(--muted); }
.to { margin-top: 36px; white-space: pre-line; }
.to .l { color: var(--muted); font-size: 13px; }
table { width: 100%; border-collapse: collapse; margin-top: 30px; }
th { text-align: left; font-weight: 500; font-size: 12.5px; color: var(--muted); border-bottom: 1px solid var(--line); padding: 8px 0; }
td { padding: 10px 0; border-bottom: 1px solid var(--line); vertical-align: top; }
th.n, td.n { text-align: right; padding-left: 18px; white-space: nowrap; }
.sub { color: var(--muted); font-size: 12.5px; }
.total { display: grid; grid-template-columns: 1fr auto; gap: 18px; margin-top: 14px; font-size: 16px; font-weight: 500; }
.total span:first-child { text-align: right; color: var(--muted); font-weight: 400; }
.pay { margin-top: 36px; padding: 16px 18px; background: var(--soft); border-radius: 10px; white-space: pre-line; }
.pay b { font-weight: 500; }
.pay a { color: var(--fg); }
.note { margin-top: 18px; white-space: pre-line; color: var(--muted); }
@page { margin: 16mm; }
@media print { main { padding: 0; } tr, .pay { break-inside: avoid; } }
</style></head>
<body><main>
<div class="top">
  <div class="from">${from.length ? `<b>${esc(from[0])}</b>${from[1] ? esc(from[1]) + '\n' : ''}` : ''}${esc(o.details || '')}</div>
  <div><h1>Invoice</h1><div class="meta"><span>Number</span>${esc(inv.number)}<span>Date</span>${long(inv.date)}${inv.due ? `<span>Due</span>${long(inv.due)}` : ''}</div></div>
</div>
<div class="to"><div class="l">Bill to</div>${esc(inv.billTo || o.client || '')}</div>
<table><thead><tr><th>${inv.kind === 'hours' ? 'Work' : 'Description'}</th><th class="n">${inv.kind === 'hours' ? 'Hours' : ''}</th><th class="n">${inv.kind === 'hours' ? 'Rate' : ''}</th><th class="n">Amount</th></tr></thead><tbody>${rows}</tbody></table>
<div class="total"><span>Total</span><span>${esc(fmtMoney(inv.total, cur))}</span></div>
${o.payLink || o.payDetails ? `<div class="pay"><b>How to pay</b>\n${o.payLink ? `Pay online: <a href="${esc(o.payLink)}">${esc(o.payLink)}</a>\n` : ''}${esc(o.payDetails || '')}</div>` : ''}
${inv.note ? `<div class="note">${esc(inv.note)}</div>` : ''}
</main></body></html>`;
}

module.exports = { parseMoney, fmtMoney, render, hrs };
