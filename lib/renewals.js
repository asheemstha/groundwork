// Renewals: when a site's SSL certificate and its domain run out. The certificate is read from the site itself; the
// domain from RDAP, the registries' free public lookup (through rdap.org, which points each domain to its registry).
const tls = require('tls');
// Lookups say who's asking, by name.
const UA = `Groundwork/${(() => { try { return require('../package.json').version; } catch { return '0'; } })()} (+https://github.com/asheemstha/groundwork)`;

const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
// Certificates from these renew themselves every few months, so only a late renewal is worth a warning.
const AUTO = /let'?s encrypt|google trust|amazon|cloudflare|zerossl/i;
// Two-part endings where the registered name is the label before them (example.co.uk).
const TWO = /\.(co|com|net|org|gov|ac|edu|ltd|plc|me|ne|or|gen|id|nom|biz|info|sch)\.[a-z]{2}$/i;

/** The domain someone registered: the host without www or other subdomains. */
const registrable = host => { const h = String(host || '').toLowerCase().replace(/\.$/, ''); const parts = h.split('.'); return parts.slice(TWO.test(h) ? -3 : -2).join('.'); };

/** The SSL certificate the site serves: when it expires, who issued it, and whether browsers trust it. */
function ssl(host) {
  return new Promise(resolve => {
    let done = false;
    const end = v => { if (!done) { done = true; resolve(v); } };
    const sock = tls.connect({ host, port: 443, servername: host, rejectUnauthorized: false, timeout: 10000 }, () => {
      const c = sock.getPeerCertificate();
      if (!c || !c.valid_to) { sock.end(); return end({ error: 'No certificate' }); }
      const issuer = (c.issuer && (c.issuer.O || c.issuer.CN)) || '';
      end({ expires: iso(new Date(c.valid_to)), issuer, trusted: sock.authorized, auto: AUTO.test(issuer) });
      sock.end();
    });
    sock.on('timeout', () => { sock.destroy(); end({ error: 'The site didn’t answer on https' }); });
    sock.on('error', e => end({ error: e.code === 'ENOTFOUND' ? 'The domain doesn’t point anywhere yet' : String(e.message || e).split('\n')[0] }));
  });
}

/** When the domain expires and who it's registered with. Some registries (.de, .nz and others) don't publish the date. */
async function domain(host) {
  const d = registrable(host);
  try {
    const r = await fetch('https://rdap.org/domain/' + encodeURIComponent(d), { headers: { accept: 'application/rdap+json', 'user-agent': UA }, redirect: 'follow', signal: AbortSignal.timeout(12000) });
    if (r.status === 404) return { domain: d, error: 'Not found in the registry' };
    if (!r.ok) return { domain: d, error: `The registry lookup answered ${r.status}` };
    const j = await r.json();
    const ev = (j.events || []).find(e => /expiration/i.test(e.eventAction || ''));
    const reg = (j.entities || []).find(e => (e.roles || []).includes('registrar'));
    const fn = reg && reg.vcardArray && (reg.vcardArray[1] || []).find(x => x[0] === 'fn');
    return { domain: d, expires: ev ? iso(new Date(ev.eventDate)) : null, registrar: fn ? fn[3] : null };
  } catch (e) { return { domain: d, error: 'The registry lookup didn’t answer' }; }
}

/** Both, for a site's host. */
async function check(host) {
  const [s, d] = await Promise.all([ssl(host), domain(host)]);
  return { host, ssl: s, domain: d, at: Date.now() };
}

/**
 * What needs attention, `today` being YYYY-MM-DD: a certificate that renews itself only when it's a week from running
 * out (its renewal has failed), any other within a month, and a domain within 45 days. Expired ones are late.
 */
function warnings(r, today, hostManaged = false) {
  if (!r) return [];
  const days = d => Math.round((new Date(d + 'T00:00') - new Date(today + 'T00:00')) / 864e5);
  const out = [];
  if (r.ssl && r.ssl.expires) {
    const n = days(r.ssl.expires), auto = r.ssl.auto || hostManaged;
    if (n <= (auto ? 7 : 30)) out.push({ what: 'ssl', name: r.host, expires: r.ssl.expires, days: n, late: n < 0, auto, by: r.ssl.issuer });
  }
  if (r.domain && r.domain.expires) {
    const n = days(r.domain.expires);
    if (n <= 45) out.push({ what: 'domain', name: r.domain.domain, expires: r.domain.expires, days: n, late: n < 0, by: r.domain.registrar });
  }
  return out;
}

module.exports = { ssl, domain, check, warnings, registrable };
