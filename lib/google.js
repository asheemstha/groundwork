// Search Console and GA4, read with the user's own Google Cloud OAuth client: a Desktop app client they make once in
// their own Cloud project, so nothing runs through a Groundwork server and nobody else's app is in between. Sign-in
// happens on Google's own page in their browser and comes back to this Mac (127.0.0.1). Read-only scopes. The
// refresh token goes in the macOS Keychain, never in the data folder or its backups.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const { execFile } = require('child_process');

const SCOPES = ['openid', 'email', 'https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/analytics.readonly'];
const SC = 'https://www.googleapis.com/auth/webmasters.readonly', GA = 'https://www.googleapis.com/auth/analytics.readonly';
const b64url = buf => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

module.exports = function google({ DATA, readJson, writeJson, port, fake = null, keychain = process.platform === 'darwin' }) {
  // A dev copy can point every Google address at a local stand-in (GW_GOOGLE_FAKE), so the whole flow is testable
  // without a real account.
  const G = fake
    ? { auth: fake + '/o/oauth2/v2/auth', token: fake + '/token', revoke: fake + '/revoke', sc: fake + '/webmasters/v3', admin: fake + '/v1beta', data: fake + '/v1beta' }
    : { auth: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', revoke: 'https://oauth2.googleapis.com/revoke', sc: 'https://www.googleapis.com/webmasters/v3', admin: 'https://analyticsadmin.googleapis.com/v1beta', data: 'https://analyticsdata.googleapis.com/v1beta' };
  const FILE = path.join(DATA, 'google.json'); // the client and who's signed in; no token
  const state = () => readJson(FILE, null) || {};
  const save = s => writeJson(FILE, s);
  const redirect = () => `http://127.0.0.1:${port()}/oauth/google`;

  // ---------- the refresh token: Keychain on a Mac, else a file only this user can read ----------
  const SERVICE = 'Groundwork Google sign-in', TFILE = path.join(DATA, 'google-token.json');
  const sec = args => new Promise((ok, no) => execFile('/usr/bin/security', args, { timeout: 15000 }, (e, out) => e ? no(e) : ok(String(out).trim())));
  const secret = {
    get: async acct => { if (keychain) { try { return await sec(['find-generic-password', '-s', SERVICE, '-a', acct, '-w']); } catch { return null; } } return (readJson(TFILE, {}) || {})[acct] || null; },
    set: async (acct, v) => { if (keychain) return sec(['add-generic-password', '-U', '-s', SERVICE, '-a', acct, '-w', v]); const all = readJson(TFILE, {}) || {}; all[acct] = v; writeJson(TFILE, all); try { fs.chmodSync(TFILE, 0o600); } catch {} },
    del: async acct => { if (keychain) { try { await sec(['delete-generic-password', '-s', SERVICE, '-a', acct]); } catch {} return; } const all = readJson(TFILE, {}) || {}; delete all[acct]; writeJson(TFILE, all); },
  };

  /** The client JSON Google gives you to download. Only a Desktop app client works with a sign-in that returns to this Mac. */
  function setClient(text) {
    let j; try { j = JSON.parse(String(text || '')); } catch { throw new Error('That isn’t the JSON file Google gives you for an OAuth client.'); }
    if (j.web) throw new Error('That’s a Web application client. Make one of the type Desktop app, and download its JSON.');
    const c = j.installed;
    if (!c || !c.client_id || !c.client_secret) throw new Error('That isn’t the JSON file Google gives you for an OAuth client.');
    const s = state();
    if (s.client && s.client.id !== c.client_id && s.email) secret.del(s.client.id).catch(() => {});
    save({ client: { id: c.client_id, secret: c.client_secret, project: c.project_id || '' }, at: Date.now() });
    access = null;
  }

  // Sign-ins waiting for Google to send the person back, by their state value.
  const pending = new Map();
  /** Google's sign-in page, for the person's browser. PKCE and a state value tie the answer to this request. */
  function signInUrl() {
    const s = state(); if (!s.client) throw new Error('Add your OAuth client first.');
    for (const [k, v] of pending) if (Date.now() - v.at > 15 * 60e3) pending.delete(k);
    const st = b64url(crypto.randomBytes(16)), verifier = b64url(crypto.randomBytes(48));
    pending.set(st, { verifier, at: Date.now() });
    const q = new URLSearchParams({ client_id: s.client.id, redirect_uri: redirect(), response_type: 'code', scope: SCOPES.join(' '), state: st, code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256', access_type: 'offline', prompt: 'consent' });
    return `${G.auth}?${q}`;
  }

  async function post(url, form) {
    const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(form), signal: AbortSignal.timeout(20000) });
    const j = await r.json().catch(() => ({}));
    return { ok: r.ok, status: r.status, j };
  }

  /** Google sends the person back here with a code, which becomes a refresh token. Returns a line for the page they see. */
  async function finish(q) {
    const p = pending.get(q.get('state') || '');
    if (!p) return { ok: false, text: 'This sign-in is out of date. Start it again from Groundwork’s Settings.' };
    pending.delete(q.get('state'));
    if (q.get('error')) { save({ ...state(), error: q.get('error') === 'access_denied' ? 'You didn’t allow access on Google’s page.' : `Google said: ${q.get('error')}` }); return { ok: false, text: 'Google didn’t give access, so nothing was saved. You can close this tab.' }; }
    const s = state();
    const r = await post(G.token, { code: q.get('code') || '', client_id: s.client.id, client_secret: s.client.secret, redirect_uri: redirect(), grant_type: 'authorization_code', code_verifier: p.verifier });
    if (!r.ok || !r.j.refresh_token) { save({ ...s, error: `Google didn’t finish the sign-in${r.j.error_description ? ': ' + r.j.error_description : r.j.error ? ': ' + r.j.error : ''}.` }); return { ok: false, text: 'The sign-in didn’t finish. Go back to Groundwork to see why.' }; }
    let email = '';
    try { email = JSON.parse(Buffer.from(String(r.j.id_token).split('.')[1], 'base64url').toString()).email || ''; } catch {}
    await secret.set(s.client.id, r.j.refresh_token);
    access = { token: r.j.access_token, until: Date.now() + (r.j.expires_in || 3600) * 1000 - 60e3 };
    const scope = String(r.j.scope || '');
    save({ ...s, email, scope, signedIn: Date.now(), error: null });
    return { ok: true, text: `Signed in to Google${email ? ' as ' + email : ''}. You can close this tab and go back to Groundwork.` };
  }

  let access = null;
  async function token() {
    if (access && Date.now() < access.until) return access.token;
    const s = state(); if (!s.client || !s.signedIn) throw new Error('Sign in to Google in Settings, Connected data first.');
    const refresh = await secret.get(s.client.id);
    if (!refresh) { save({ ...s, signedIn: null }); throw new Error('Sign in to Google again in Settings, Connected data.'); }
    const r = await post(G.token, { client_id: s.client.id, client_secret: s.client.secret, refresh_token: refresh, grant_type: 'refresh_token' });
    if (!r.ok) {
      if (r.j.error === 'invalid_grant') {
        // Revoked, or a Testing app's sign-in that ran out after 7 days.
        await secret.del(s.client.id); save({ ...s, signedIn: null, error: 'Google signed Groundwork out. If your Google app is still in Testing, that happens every 7 days: publish it on its Audience page, then sign in again.' });
        throw new Error('Google signed Groundwork out. Sign in again in Settings, Connected data.');
      }
      throw new Error(`Google didn’t answer the sign-in (${r.j.error || 'HTTP ' + r.status}).`);
    }
    access = { token: r.j.access_token, until: Date.now() + (r.j.expires_in || 3600) * 1000 - 60e3 };
    return access.token;
  }

  // Google's errors, in plain words: an API that isn't turned on, an account without access.
  function plain(j, status, what) {
    const e = (j && j.error) || {}, msg = String(e.message || '');
    const reason = ((e.details || []).find(d => d.reason) || {}).reason || ((e.errors || [])[0] || {}).reason || '';
    if (/SERVICE_DISABLED|accessNotConfigured/i.test(reason + msg) || /has not been used in project|is disabled/i.test(msg)) return `Turn on the ${what} in your Google Cloud project (${state().client.project || 'the one your OAuth client is in'}), then try again in a minute.`;
    if (status === 403) return `Your Google account can’t see that ${what === 'Google Search Console API' ? 'Search Console property' : 'Analytics property'}, or Groundwork wasn’t allowed to read it. Sign in again and tick every box on Google’s page.`;
    if (status === 429) return 'Google says that’s too many requests for now. Try again in a few minutes.';
    return `Google said: ${msg || 'HTTP ' + status}`;
  }
  async function call(url, what, body) {
    for (let tries = 0; tries < 2; tries++) {
      const r = await fetch(url, { method: body ? 'POST' : 'GET', headers: { authorization: 'Bearer ' + await token(), ...(body ? { 'content-type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(60000) });
      if (r.status === 401 && !tries) { access = null; continue; }
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(plain(j, r.status, what));
      return j;
    }
  }

  // ---------- Search Console ----------
  /** The properties the account can read: "sc-domain:example.com" or "https://www.example.com/". */
  async function sites() {
    const j = await call(`${G.sc}/sites`, 'Google Search Console API');
    return (j.siteEntry || []).filter(x => x.permissionLevel !== 'siteUnverifiedUser').map(x => x.siteUrl).sort();
  }
  /** Clicks and impressions by page between two days, up to 100,000 pages. */
  async function pages(site, from, to) {
    const out = [];
    for (let start = 0; start < 100000; start += 25000) {
      const j = await call(`${G.sc}/sites/${encodeURIComponent(site)}/searchAnalytics/query`, 'Google Search Console API', { startDate: from, endDate: to, dimensions: ['page'], type: 'web', rowLimit: 25000, startRow: start });
      const rows = j.rows || [];
      for (const r of rows) out.push({ url: r.keys[0], n: r.clicks || 0, impressions: r.impressions || 0 });
      if (rows.length < 25000) break;
    }
    return out;
  }

  // ---------- GA4 ----------
  /** Every GA4 property the account can see: [{ id: "properties/123", name, account }]. */
  async function properties() {
    const out = []; let pageToken = '';
    for (let i = 0; i < 20; i++) {
      const j = await call(`${G.admin}/accountSummaries?pageSize=200${pageToken ? '&pageToken=' + encodeURIComponent(pageToken) : ''}`, 'Google Analytics Admin API');
      for (const a of j.accountSummaries || []) for (const p of a.propertySummaries || []) out.push({ id: p.property, name: p.displayName || p.property, account: a.displayName || '' });
      pageToken = j.nextPageToken; if (!pageToken) break;
    }
    return out.sort((a, b) => a.account.localeCompare(b.account) || a.name.localeCompare(b.name));
  }
  /** Sessions and key events by landing page between two days. */
  async function landing(property, from, to) {
    const j = await call(`${G.data}/${property}:runReport`, 'Google Analytics Data API', { dateRanges: [{ startDate: from, endDate: to }], dimensions: [{ name: 'landingPage' }], metrics: [{ name: 'sessions' }, { name: 'keyEvents' }], limit: 25000, orderBys: [{ metric: { metricName: 'sessions' }, desc: true }] });
    return (j.rows || []).map(r => ({ path: r.dimensionValues[0].value, n: +r.metricValues[0].value || 0, keyEvents: +r.metricValues[1].value || 0 }));
  }

  function status() {
    const s = state();
    const scope = String(s.scope || '');
    return {
      client: s.client ? { id: s.client.id.replace(/^(\d{4})\d*(-.{4}).*$/, '$1…$2…'), project: s.client.project } : null,
      signedIn: !!s.signedIn, email: s.email || null, at: s.signedIn || null, error: s.error || null,
      searchConsole: !!s.signedIn && scope.includes(SC), analytics: !!s.signedIn && scope.includes(GA), keychain,
    };
  }
  async function signOut() {
    const s = state(); if (!s.client) return;
    const refresh = await secret.get(s.client.id);
    if (refresh) await post(G.revoke, { token: refresh }).catch(() => {});
    await secret.del(s.client.id);
    access = null;
    save({ client: s.client, at: s.at });
  }
  async function forget() { await signOut(); try { fs.rmSync(FILE); } catch {} }

  return { setClient, signInUrl, finish, status, signOut, forget, sites, pages, properties, landing, ready: () => { const s = state(); return !!(s.client && s.signedIn); } };
};
