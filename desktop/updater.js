// Self-updater for the unsigned Mac app, using the repo's GitHub Releases.
// It downloads the new .zip, unpacks it with ditto, swaps the app bundle once we quit, and reopens.
// Files downloaded this way aren't quarantined, so macOS doesn't ask again after the first install.
const https = require('https'), fs = require('fs'), path = require('path'), os = require('os');
const { execFile, spawn } = require('child_process');

module.exports = function updater({ app, shell, repo, log }) {
  const feed = process.env.GW_RELEASES_URL || `https://api.github.com/repos/${repo}/releases/latest`;
  const releasesPage = `https://github.com/${repo}/releases/latest`;
  let latest = null;

  const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); return false; };
  const request = (url, onResponse, reject, hops = 0) => {
    const mod = url.startsWith('http://') ? require('http') : https;
    mod.get(url, { headers: { 'User-Agent': 'Groundwork', Accept: 'application/vnd.github+json, application/octet-stream' } }, res => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && hops < 6) { res.resume(); return request(new URL(res.headers.location, url).href, onResponse, reject, hops + 1); }
      if (res.statusCode >= 400) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      onResponse(res);
    }).on('error', reject).setTimeout(60000, function () { this.destroy(new Error('Timed out')); });
  };
  const getJson = url => new Promise((resolve, reject) => request(url, res => { let b = ''; res.on('data', d => b += d); res.on('end', () => { try { resolve(JSON.parse(b)); } catch (e) { reject(e); } }); }, reject));
  const download = (url, file) => new Promise((resolve, reject) => request(url, res => { const out = fs.createWriteStream(file); res.pipe(out); out.on('finish', resolve); out.on('error', reject); }, reject));
  const run = (cmd, args) => new Promise((resolve, reject) => execFile(cmd, args, (e, o, er) => e ? reject(new Error(er || e.message)) : resolve(o)));

  async function check() {
    const version = app.getVersion();
    const base = { enabled: app.isPackaged, app: true, version, commit: version, behind: 0, latest: null, checkedAt: Date.now(), error: null, launcher: true, url: releasesPage };
    try {
      const rel = await getJson(feed);
      const v = String(rel.tag_name || '').replace(/^v/, '');
      const asset = (rel.assets || []).find(a => /\.zip$/i.test(a.name) && /mac|darwin|universal/i.test(a.name)) || (rel.assets || []).find(a => /\.zip$/i.test(a.name));
      latest = v && asset ? { v, url: asset.browser_download_url, page: rel.html_url || releasesPage } : null;
      const note = String(rel.body || rel.name || '').split('\n').map(s => s.trim()).find(Boolean) || null;
      return { ...base, behind: latest && newer(v, version) ? 1 : 0, latest: latest ? `${v}${note ? ': ' + note : ''}` : null, url: latest ? latest.page : releasesPage };
    } catch (e) {
      log && log('update check failed', e.message);
      if (/HTTP 404/.test(e.message)) return base; // no release published yet
      return { ...base, error: 'Couldn’t reach GitHub to check for updates.' };
    }
  }

  async function install() {
    if (!latest) await check();
    if (!latest || !newer(latest.v, app.getVersion())) throw new Error('Groundwork is already up to date.');
    const bundle = path.resolve(app.getPath('exe'), '..', '..', '..');
    try { fs.accessSync(path.dirname(bundle), fs.constants.W_OK); if (!bundle.endsWith('.app')) throw new Error(); }
    catch {
      shell.openExternal(latest.page);
      throw new Error('Groundwork can’t replace itself where it is. Move it to Applications, or download the new version from the page that just opened.');
    }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'groundwork-update-'));
    const zip = path.join(tmp, 'update.zip');
    log && log('downloading', latest.url);
    await download(latest.url, zip);
    await run('/usr/bin/ditto', ['-x', '-k', zip, tmp]);
    const found = fs.readdirSync(tmp).find(f => f.endsWith('.app'));
    if (!found) throw new Error('The update download didn’t contain the app.');
    const next = path.join(tmp, found);
    // Swap once this process has exited, then reopen the new version.
    const q = s => `'${s.replace(/'/g, `'\\''`)}'`;
    const script = `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.3; done; rm -rf ${q(bundle + '.old')}; mv ${q(bundle)} ${q(bundle + '.old')} && mv ${q(next)} ${q(bundle)} && rm -rf ${q(bundle + '.old')} ${q(tmp)}; open ${q(bundle)}`;
    spawn('/bin/sh', ['-c', script], { detached: true, stdio: 'ignore' }).unref();
    log && log('installing', latest.v, 'into', bundle);
    setTimeout(() => app.exit(0), 400);
    return { ok: true, restart: 'auto' };
  }

  return { check, install };
};
