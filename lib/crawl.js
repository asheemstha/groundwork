// Site crawling with a real (headless) browser: discovery, per-page heading audit, live re-checks.
// No AI is involved here, so scanning never touches the user's plan usage.
const { chromium } = require('playwright-core');

let browserP = null, browserName = null;
// Installed browsers, found by their files so we never have to start one just to know it's there. Starting Chrome
// isn't free: right after Chrome updates itself it tidies its app folder on the next launch, and macOS blocks that
// (and blames Groundwork with a "prevented from modifying apps" notice) when Groundwork is the one that launched it.
function installedBrowsers() {
  const home = require('os').homedir(), env = process.env;
  const mac = (app, bin) => [`/Applications/${app}.app/Contents/MacOS/${bin}`, `${home}/Applications/${app}.app/Contents/MacOS/${bin}`];
  const win = rel => [env.LOCALAPPDATA, env.PROGRAMFILES, env['PROGRAMFILES(X86)']].filter(Boolean).map(d => `${d}\\${rel}`);
  const list = process.platform === 'darwin' ? [['Google Chrome', 'chrome', mac('Google Chrome', 'Google Chrome')], ['Microsoft Edge', 'msedge', mac('Microsoft Edge', 'Microsoft Edge')]]
    : process.platform === 'win32' ? [['Google Chrome', 'chrome', win('Google\\Chrome\\Application\\chrome.exe')], ['Microsoft Edge', 'msedge', win('Microsoft\\Edge\\Application\\msedge.exe')]]
    : [['Google Chrome', 'chrome', ['/opt/google/chrome/chrome']], ['Microsoft Edge', 'msedge', ['/opt/microsoft/msedge/msedge']]];
  const fs = require('fs'), out = [];
  for (const [name, channel, files] of list) {
    const file = files.find(f => fs.existsSync(f));
    // The standard location launches by channel, exactly as before; anywhere else by path.
    if (file) out.push([name, file === files[0] ? { channel } : { executablePath: file }]);
  }
  return out;
}
// On a Mac, Chrome is started by macOS itself (like opening it from the Dock) and we connect to it. A Chrome that
// Groundwork spawns directly counts as Groundwork's, so when Chrome tidies its own app folder after one of its
// updates, macOS asks for permission on Groundwork's behalf ("prevented from modifying apps"), every time.
// Started by macOS, Chrome is responsible for itself and may tidy its own folder. It runs headless with a
// throwaway profile, so it has no Dock icon and never touches the user's own Chrome.
const PROFILE_PREFIX = 'groundwork-chrome-';
let macProfile = null;
const macBundle = file => file.replace(/\/Contents\/MacOS\/[^/]+$/, '');
async function launchMac(file) {
  const fs = require('fs'), os = require('os'), path = require('path');
  const { execFile } = require('child_process');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), PROFILE_PREFIX));
  const args = ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${dir}`, '--no-first-run', '--no-default-browser-check',
    '--use-mock-keychain', '--password-store=basic', '--disable-sync', '--disable-background-networking', '--disable-component-update',
    '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding',
    '--disable-hang-monitor', '--disable-popup-blocking', '--disable-prompt-on-repost', '--disable-search-engine-choice-screen',
    '--metrics-recording-only', '--mute-audio', '--hide-scrollbars', 'about:blank'];
  await new Promise((ok, no) => execFile('/usr/bin/open', ['-n', '-g', '-j', '-a', macBundle(file), '--args', ...args], e => e ? no(e) : ok()));
  // Chrome writes the port it picked into the profile folder.
  const portFile = path.join(dir, 'DevToolsActivePort');
  for (let i = 0; i < 150; i++) {
    const txt = fs.existsSync(portFile) ? fs.readFileSync(portFile, 'utf8') : '';
    const port = txt.split('\n')[0];
    if (port) { macProfile = dir; return chromium.connectOverCDP(`http://127.0.0.1:${port}`, { timeout: 15000 }); }
    await new Promise(r => setTimeout(r, 100));
  }
  fs.rmSync(dir, { recursive: true, force: true });
  throw new Error('The browser didn’t start.');
}
// Headless browsers left over from a Groundwork that quit without closing them.
function killLeftovers() {
  if (process.platform !== 'darwin') return;
  try { require('child_process').execFileSync('/usr/bin/pkill', ['-f', `user-data-dir=[^ ]*${PROFILE_PREFIX}`], { stdio: 'ignore' }); } catch {}
  const fs = require('fs'), os = require('os'), path = require('path');
  try { for (const d of fs.readdirSync(os.tmpdir())) if (d.startsWith(PROFILE_PREFIX)) fs.rmSync(path.join(os.tmpdir(), d), { recursive: true, force: true }); } catch {}
}
let cleaned = false;

async function getBrowser() {
  if (browserP) {
    const b = await browserP.catch(() => null);
    if (b && b.isConnected()) return b;
    browserP = null;
  }
  if (!cleaned) { cleaned = true; killLeftovers(); }
  browserP = (async () => {
    let last;
    const found = installedBrowsers();
    if (process.platform === 'darwin') for (const [name, opts] of found) {
      const file = opts.executablePath || (name === 'Google Chrome' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge');
      try { const b = await launchMac(file); browserName = name; return b; } catch (e) { last = e; }
    }
    for (const [name, opts] of found.length ? found : [['Google Chrome', { channel: 'chrome' }], ['Microsoft Edge', { channel: 'msedge' }], ['Chromium', {}]]) {
      // We handle shutdown signals ourselves (server.js), so Ctrl+C always stops the app.
      try { const b = await chromium.launch({ headless: true, handleSIGINT: false, handleSIGTERM: false, handleSIGHUP: false, ...opts }); browserName = name; return b; } catch (e) { last = e; }
    }
    throw new Error('No browser found. Install Google Chrome, then try again. (' + (last && last.message.split('\n')[0]) + ')');
  })();
  return browserP;
}
async function closeBrowser() {
  const b = browserP && await browserP.catch(() => null);
  browserP = null;
  if (!b) return;
  // A browser we connected to has to be told to quit; closing the connection alone would leave it running.
  if (macProfile) {
    const dir = macProfile; macProfile = null;
    try { const cdp = await b.newBrowserCDPSession(); await cdp.send('Browser.close').catch(() => {}); } catch {}
    await b.close().catch(() => {});
    setTimeout(() => { try { require('child_process').execFileSync('/usr/bin/pkill', ['-f', `user-data-dir=${dir}`], { stdio: 'ignore' }); } catch {} require('fs').rmSync(dir, { recursive: true, force: true }); }, 1500);
    return;
  }
  await b.close().catch(() => {});
}
async function browserStatus() {
  const found = installedBrowsers()[0];
  if (found) return { ok: true, name: found[0] };
  // Nothing in the usual places: fall back to actually trying one.
  try { await getBrowser(); return { ok: true, name: browserName }; } catch (e) { return { ok: false, error: e.message }; }
}

const FILE_RE = /\.(pdf|jpe?g|png|gif|svg|webp|avif|zip|mp4|mov|mp3|docx?|xlsx?|pptx?|csv|txt|xml|json)$/i;
const LEGAL_RE = /(privacy|terms|cookie|legal|disclaimer|accessibility|imprint|gdpr|policy|conditions)/i;
const bareHost = h => h.replace(/^www\./, '');
const niceName = t => t === t.toUpperCase() && /[A-Z]/.test(t) ? t.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()) : t;
// "About Us | Brand" -> "About Us". Used for pages that have no nav label.
function nameFromTitle(title, siteTitle) {
  const parts = String(title || '').split(/\s+[|–—·•-]\s+/).map(x => x.trim()).filter(Boolean);
  if (!parts.length) return '';
  const brand = String(siteTitle || '').split(/\s+[|–—·•-]\s+/).pop();
  const pick = parts.length > 1 && parts[parts.length - 1] === brand ? parts.slice(0, -1).join(' – ') : parts[0];
  return niceName(pick).slice(0, 60);
}

function normPath(href, origin) {
  try {
    const u = new URL(href, origin), o = new URL(origin);
    if (!/^https?:$/.test(u.protocol) || bareHost(u.hostname) !== bareHost(o.hostname)) return null;
    if (FILE_RE.test(u.pathname)) return null;
    return u.pathname.replace(/\/+$/, '') || '/';
  } catch { return null; }
}

// Runs in the page. Marks the header nav and footer with data-gw-zone, found by position rather than
// class names (sites name them anything: "nav-wrapper", "navbar_component", ...).
const MARK_JS = () => {
  const vis = a => { const r = a.getBoundingClientRect(), cs = getComputedStyle(a); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden'; };
  const allLinks = [...document.querySelectorAll('a[href]')];
  const lca = list => { if (!list.length) return null; let r = list[0]; while (r && !list.every(a => r.contains(a))) r = r.parentElement; return r; };
  const widen = (root, sel) => { let w = root; for (let i = 0; i < 5 && w && w.parentElement && w.parentElement !== document.body; i++) { if (w.matches(sel)) root = w; w = w.parentElement; } return root; };
  const ok = r => r && r !== document.body && r !== document.documentElement && !(allLinks.length > 20 && r.querySelectorAll('a[href]').length > allLinks.length * 0.6);
  let head = lca(allLinks.filter(a => vis(a) && a.getBoundingClientRect().top + scrollY < 220));
  if (head) head = widen(head, 'header,nav,[class*="nav"],[role=navigation]');
  if (!ok(head)) head = document.querySelector('header,nav,.w-nav,[role=navigation]');
  if (head) head.setAttribute('data-gw-zone', 'header');
  let foot = [...document.querySelectorAll('footer,[class*="footer"]')].filter(n => !n.parentElement.closest('footer,[class*="footer"]')).pop();
  if (!foot) { const H = document.documentElement.scrollHeight; foot = lca(allLinks.filter(a => vis(a) && a.getBoundingClientRect().top + scrollY > H - 500)); if (!ok(foot)) foot = null; }
  if (foot && foot !== head && !foot.contains(head)) foot.setAttribute('data-gw-zone', 'footer');
};

// Runs in the page. Finds header nav (with dropdown groups), footer links and body links.
const DISCOVER_JS = () => {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return cs.display !== 'none' && cs.visibility !== 'hidden' && r.width > 0 && r.height > 0; };
  const FOOT = '[data-gw-zone=footer]';
  const HEAD = '[data-gw-zone=header]';
  const html = document.documentElement.outerHTML.slice(0, 300000);
  const platform = document.documentElement.hasAttribute('data-wf-site') ? 'Webflow'
    : /wp-content|wp-includes/.test(html) ? 'WordPress'
    : /cdn\.shopify\.com|Shopify\.theme/.test(html) ? 'Shopify'
    : /static\.wixstatic\.com|wix-bolt|_wixCssImports/.test(html) ? 'Wix'
    : /framerusercontent\.com|data-framer-/.test(html) ? 'Framer'
    : /squarespace/.test(html) ? 'Squarespace' : 'Other';
  const heads = [...document.querySelectorAll(HEAD)];
  // textContent, not innerText: CSS text-transform would turn "The House" into "THE HOUSE".
  const linkText = a => { const t = a.querySelector('[class*="title"]'); return clean((t ? t.textContent : a.textContent) || a.getAttribute('aria-label') || '').slice(0, 60); };
  const groupOf = (a, root) => {
    let box = a.closest('.w-dropdown,[class*="dropdown"],details,li,[class*="menu-item"],[class*="nav-item"]');
    while (box && root.contains(box) && box !== root) {
      if (box.querySelectorAll('a[href]').length > 1 && box.querySelectorAll('a[href]').length < 30) {
        const t = box.querySelector('.w-dropdown-toggle,[class*="toggle"],summary,button,:scope > span,:scope > div > span');
        const label = t ? clean(t.textContent) : '';
        if (label && label !== linkText(a) && label.length < 40) return label;
      }
      box = box.parentElement && box.parentElement.closest('.w-dropdown,[class*="dropdown"],details,li,[class*="menu-item"],[class*="nav-item"]');
    }
    return null;
  };
  const seen = new Set(), header = [];
  heads.forEach(root => root.querySelectorAll('a[href]').forEach(a => {
    const href = a.getAttribute('href'); if (!href || seen.has(href + '|' + linkText(a))) return; seen.add(href + '|' + linkText(a));
    header.push({ text: linkText(a), href: a.href, raw: href, group: groupOf(a, root), visible: vis(a) });
  }));
  const feet = [...document.querySelectorAll(FOOT)];
  const footer = [];
  feet.forEach(root => root.querySelectorAll('a[href]').forEach(a => footer.push({ text: linkText(a), href: a.href, raw: a.getAttribute('href') })));
  const body = [...document.querySelectorAll('a[href]')].filter(a => !a.closest(FOOT) && !a.closest(HEAD)).map(a => ({ text: linkText(a), href: a.href, raw: a.getAttribute('href') }));
  const dead = [...document.querySelectorAll('a[href="#"],a:not([href])')].filter(a => clean(a.innerText)).map(a => clean(a.innerText).slice(0, 40)).slice(0, 30);
  const icons = [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="apple-touch-icon-precomposed"],link[rel="shortcut icon"]')].map(l => ({ href: l.href, rel: l.rel, sizes: l.getAttribute('sizes') || '', type: l.type || '' }));
  return { platform, title: document.title, header, footer, body, dead, icons, navText: heads.map(h => clean(h.innerText).slice(0, 400)).join(' | ') };
};

// Runs in the page. Walks the rendered DOM in order, like the skill's audit script,
// and records each heading / heading-like text with its position for highlighting.
const AUDIT_JS = () => {
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const ZONE = '[data-gw-zone],nav,header,footer,.w-nav,[class*="navbar"],[class*="footer"]';
  const SKIP = /^(SCRIPT|STYLE|NOSCRIPT|SVG|TEMPLATE|IFRAME|CANVAS|VIDEO|PICTURE|IMG|INPUT|SELECT|TEXTAREA)$/;
  const clsOf = e => (typeof e.className === 'string' ? e.className : (e.getAttribute && e.getAttribute('class')) || '') || '';
  const hidden = el => { for (let e = el; e && e !== document.body; e = e.parentElement) { const c = clsOf(e), st = e.getAttribute('style') || ''; if (/w-condition-invisible|(^|\s)(hide|hidden|u-hide|sr-only|visually-hidden)(\s|$)/i.test(c) || /display:\s*none/.test(st)) return true; } return false; };
  const rect = el => { const r = el.getBoundingClientRect(); return r.width || r.height ? [Math.round(r.left + scrollX), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height)] : null; };
  const inTab = el => !!el.closest('.w-tab-pane,[role=tabpanel]');
  // Split-text animations wrap each word (or letter) in its own element. Read them back as one line.
  const splitText = el => {
    // Libraries that put the real sentence in aria-label and hide the word wrappers from screen readers.
    const al = el.getAttribute('aria-label');
    if (al && !/^(A|BUTTON)$/.test(el.tagName) && el.querySelector('[aria-hidden="true"]') && al.replace(/\s/g, '') === el.textContent.replace(/\s/g, '')) return al.replace(/\s+/g, ' ').trim();
    const kids = [...el.children];
    if (kids.length < 2 || /^(A|BUTTON|UL|OL)$/.test(el.tagName) || [...el.childNodes].some(x => x.nodeType === 3 && x.textContent.trim())) return null;
    const k0 = clsOf(kids[0]);
    if (!kids.every(k => clsOf(k) === k0 && !/^(A|BUTTON|IMG|SVG)$/.test(k.tagName) && k.textContent.trim().length <= 30 && !k.querySelector('a,button,img,h1,h2,h3,h4,h5,h6'))) return null;
    const text = el.textContent.replace(/\s+/g, ' ').trim();
    if (!text || text.length > 150) return null;
    const hasSpaces = [...el.childNodes].some(x => x.nodeType === 3) || kids.some(k => /\s/.test(k.textContent));
    return hasSpaces ? text : (kids.every(k => k.textContent.trim().length <= 1) ? kids.map(k => k.textContent).join('') : kids.map(k => k.textContent.trim()).join(' ')).replace(/\s+/g, ' ').trim();
  };
  const items = []; let n = 0;
  const zoneOf = el => el.getAttribute('data-gw-zone') || (el.matches('footer,[class*="footer"]') ? 'footer' : 'header');
  const walk = (el, zone) => {
    for (const c of el.children) {
      const t = c.tagName; if (SKIP.test(t)) continue;
      const cls = clsOf(c);
      const z = zone || (c.matches(ZONE) ? zoneOf(c) : null);
      if (/^H[1-6]$/.test(t)) {
        // A <br> inside a heading separates words ("across<br>two"), so it counts as a space.
        const cp = c.cloneNode(true); cp.querySelectorAll('br').forEach(b => b.replaceWith(' '));
        items.push({ ref: 'i' + (n++), kind: t, text: clean(cp.textContent), cls, hidden: hidden(c), inTab: inTab(c), zone: z, rect: rect(c) });
        continue;
      }
      if (z) { walk(c, z); continue; }
      if (t === 'SECTION') items.push({ sec: true, cls: cls.slice(0, 50), id: c.id || '' });
      const merged = splitText(c);
      if (merged) {
        const cs = getComputedStyle(c.querySelector('[aria-hidden="true"]') || c.firstElementChild), fs = Math.round(parseFloat(cs.fontSize) || 0), fw = parseInt(cs.fontWeight) || 400;
        items.push({ ref: 'i' + (n++), kind: t.toLowerCase(), text: merged, cls, hidden: hidden(c), inTab: inTab(c), styled: (merged.length < 90 && fs >= 22) || /(^|\s)(d[1-6]|h[1-6]|heading[\w-]*|[\w-]*title[\w-]*)(\s|$)/i.test(cls), fs, fw, rect: rect(c), split: true });
        continue;
      }
      const direct = [...c.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim();
      if (direct && !/^(A|BUTTON|LABEL|OPTION)$/.test(t)) {
        const cs = getComputedStyle(c), fs = Math.round(parseFloat(cs.fontSize) || 0), fw = parseInt(cs.fontWeight) || 400;
        const text = clean(c.textContent);
        const styled = /(^|\s)(d[1-6]|h[1-6]|heading[\w-]*|[\w-]*title[\w-]*)(\s|$)/i.test(cls) || (text.length < 90 && fs >= 22) || (text.length < 70 && fw >= 600 && fs >= 17 && !c.closest('p'));
        items.push({ ref: 'i' + (n++), kind: t.toLowerCase(), text: text.slice(0, 400), cls, hidden: hidden(c), inTab: inTab(c), styled, fs, fw, rect: rect(c) });
        continue;
      }
      if (/^(A|BUTTON)$/.test(t)) { const text = clean(c.textContent); if (text) items.push({ ref: 'i' + (n++), kind: t.toLowerCase(), link: true, text: text.slice(0, 80), href: c.getAttribute('href') || '', rect: rect(c) }); continue; }
      walk(c, z);
    }
  };
  walk(document.body, null);
  const counts = {}; ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'].forEach(h => counts[h] = document.querySelectorAll(h).length);
  return {
    title: document.title, desc: (document.querySelector('meta[name=description]') || {}).content || '',
    canonical: (document.querySelector('link[rel=canonical]') || {}).href || '', lang: document.documentElement.lang || '',
    counts, items, height: document.documentElement.scrollHeight
  };
};

const LIVE_JS = () => [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].map(h => { const c = h.cloneNode(true); c.querySelectorAll('br').forEach(b => b.replaceWith(' ')); return { tag: h.tagName, text: (c.textContent || '').replace(/\s+/g, ' ').trim() }; });

// Scans say who they are: a normal Chrome user agent (without "HeadlessChrome", which many sites turn away) ending in
// "Groundwork/<version>", the way Google's Lighthouse names itself. A site owner can allow it by that name.
let UA = null;
const VERSION = (() => { try { return require('../package.json').version; } catch { return '0'; } })();
function userAgent(b) {
  if (UA) return UA;
  const major = String((b && b.version && b.version()) || '140').split('.')[0];
  const os = process.platform === 'darwin' ? 'Macintosh; Intel Mac OS X 10_15_7' : process.platform === 'win32' ? 'Windows NT 10.0; Win64; x64' : 'X11; Linux x86_64';
  return (UA = `Mozilla/5.0 (${os}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${major}.0.0.0 Safari/537.36 Groundwork/${VERSION}`);
}

// The browser only runs while there's work: it closes a few minutes after the last scan or check finishes.
let openContexts = 0, idleTimer = null;
async function newContext() {
  clearTimeout(idleTimer);
  const b = await getBrowser();
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1, ignoreHTTPSErrors: true, userAgent: userAgent(b) });
  // Scans and checks never add visits to the client's analytics or ad accounts: every page blocks the data tags send.
  const open = ctx.newPage.bind(ctx);
  ctx.newPage = async () => { const page = await open(); await require('./tracking').block(ctx, page); return page; };
  openContexts++;
  ctx.on('close', () => {
    if (--openContexts > 0) return;
    openContexts = 0;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { if (!openContexts) closeBrowser(); }, 3 * 60e3);
    idleTimer.unref?.();
  });
  return ctx;
}

// Cloudflare's "Just a moment..." visitor check, and pages like it.
const CHALLENGE_TITLE = /^(just a moment|attention required|checking your browser|please wait)/i;
async function isChallenge(page, r) {
  const h = r ? await r.allHeaders().catch(() => ({})) : {};
  if (h['cf-mitigated'] === 'challenge') return true;
  const status = r ? r.status() : 0;
  return (status === 403 || status === 503 || status === 429) && CHALLENGE_TITLE.test(await page.title().catch(() => ''));
}
async function open(ctx, url) {
  const page = await ctx.newPage();
  let status = 0, challenge = false;
  try {
    const r = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    status = r ? r.status() : 0;
    challenge = await isChallenge(page, r);
  } catch (e) { await page.close(); throw e; }
  await page.waitForLoadState('load', { timeout: 10000 }).catch(() => {});
  return { page, status, challenge };
}

// Finds things covering the page: preloaders, page-transition curtains, popups and cookie walls.
// Loaders go away on their own, so we wait for them. Popups don't, so we hide them straight away.
const BLOCKERS_JS = () => {
  const vw = innerWidth, vh = innerHeight, NAME = /(pre-?load|loader|loading|splash|intro|page-?trans|curtain|wipe|overlay-anim)/i;
  const found = { loaders: 0, popups: 0 };
  for (const el of document.body.querySelectorAll('body *')) {
    if (el.hasAttribute('data-gw-hidden')) continue;
    const cs = getComputedStyle(el), named = NAME.test((typeof el.className === 'string' ? el.className : '') + ' ' + el.id);
    if (cs.position !== 'fixed' && !(named && cs.position === 'absolute')) continue;
    if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
    const r = el.getBoundingClientRect();
    const cover = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0)) / (vw * vh);
    if (cover < 0.6) continue;
    const z = parseInt(cs.zIndex) || 0, bg = cs.backgroundColor.replace(/^[a-z-]+\(\s*(display-p3|srgb)?/i, '').match(/[\d.]+/g) || [], alpha = bg.length === 4 ? +bg[3] : bg.length ? 1 : 0;
    if (!named && (z < 1 || (alpha < 0.3 && cs.backgroundImage === 'none' && !el.querySelector('img,svg,canvas,video')))) continue; // fixed backgrounds and see-through wrappers
    if (el.querySelectorAll('h1,h2,h3,p').length > 6) continue; // a wrapper holding the page itself
    const interactive = el.querySelector('input,select,textarea,form,button,[role=dialog]') || el.matches('[role=dialog]');
    if (interactive && !named) { el.setAttribute('data-gw-hidden', ''); el.style.setProperty('display', 'none', 'important'); found.popups++; }
    else { el.setAttribute('data-gw-loader', ''); el.setAttribute('data-gw-was-loader', ''); found.loaders++; }
  }
  const ov = x => ['hidden', 'clip'].includes(getComputedStyle(x).overflowY);
  return { ...found, locked: ov(document.documentElement) || ov(document.body) };
};

// Wait until the page is really ready: network quiet, fonts loaded, loaders gone.
async function waitForReady(page) {
  await page.waitForLoadState('networkidle', { timeout: 2500 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready.then(() => true)).catch(() => {});
  const t0 = Date.now(); let st = { loaders: 0, popups: 0, locked: false }, popups = 0;
  while (Date.now() - t0 < 10000) {
    await page.evaluate(() => document.querySelectorAll('[data-gw-loader]').forEach(e => e.removeAttribute('data-gw-loader'))).catch(() => {});
    st = await page.evaluate(BLOCKERS_JS).catch(() => st);
    popups += st.popups;
    if (!st.loaders && (!st.locked || Date.now() - t0 > 4000)) break;
    await page.waitForTimeout(300);
  }
  // Loaders are hidden for good: some slide away with a transform that the reveal step below would undo.
  // Anything still covering the page after 10 s counts as forced.
  const forced = await page.evaluate(() => {
    const still = document.querySelectorAll('[data-gw-loader]').length;
    document.querySelectorAll('[data-gw-was-loader]').forEach(e => e.style.setProperty('display', 'none', 'important'));
    return still;
  }).catch(() => 0);
  return { waitedMs: Date.now() - t0, popups, forcedLoaders: forced };
}

// Scroll through the page so lazy images load and scroll-triggered content appears,
// then reveal anything a scroll animation left invisible, so screenshots aren't blank.
async function settle(page) {
  const ready = await waitForReady(page);
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation-duration:0s!important;animation-delay:0s!important;scroll-behavior:auto!important} html,body{overflow:visible!important;height:auto!important}' }).catch(() => {});
  await page.evaluate(async () => {
    document.querySelectorAll('img[loading=lazy]').forEach(i => { i.loading = 'eager'; });
    const H = () => document.documentElement.scrollHeight;
    for (let y = 0; y < Math.min(H(), 24000); y += Math.round(innerHeight * 0.7)) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
    window.scrollTo(0, H()); await new Promise(r => setTimeout(r, 150));
  }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 1500 }).catch(() => {});
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    const reveal = e => {
      if (e.closest('[data-gw-zone],[data-gw-hidden],[data-gw-was-loader],nav,header')) return;
      const cs = getComputedStyle(e);
      if (cs.position === 'fixed') return; // overlays, menus and loaders stay as they are
      if (cs.opacity === '0') e.style.setProperty('opacity', '1', 'important');
      if (cs.visibility === 'hidden' && e.style.visibility === 'hidden') e.style.setProperty('visibility', 'visible', 'important');
      if ((e.hasAttribute('data-w-id') || /translate|matrix/.test(e.style.transform || '')) && e.style.transform) e.style.setProperty('transform', 'none', 'important');
    };
    document.querySelectorAll('[data-w-id],[style*="opacity"],[style*="visibility"],[class*="reveal"],[class*="fade"],[class*="animate"],[data-aos],[data-scroll]').forEach(reveal);
    await new Promise(r => setTimeout(r, 200));
  }).catch(() => {});
  return ready;
}

// The site's icon: prefer SVG, then the largest PNG (apple-touch-icon is usually 180px), then /favicon.ico.
const ICONS_JS = () => [...document.querySelectorAll('link[rel~="icon"],link[rel="apple-touch-icon"],link[rel="apple-touch-icon-precomposed"],link[rel="shortcut icon"]')].map(l => ({ href: l.href, rel: l.rel, sizes: l.getAttribute('sizes') || '', type: l.type || '' }));
async function downloadIcon(ctx, icons, origin) {
  const score = i => /svg/.test(i.type) || /\.svg(\?|$)/i.test(i.href) ? 1000 : (parseInt(i.sizes) || (/apple/.test(i.rel) ? 180 : /\.ico(\?|$)/i.test(i.href) ? 16 : 32));
  const list = [...(icons || [])].filter(i => /^https?:/.test(i.href)).sort((a, b) => score(b) - score(a)).map(i => i.href);
  list.push(origin + '/favicon.ico');
  for (const href of list) {
    try {
      const r = await ctx.request.get(href, { timeout: 8000 });
      const type = (r.headers()['content-type'] || '').split(';')[0];
      const buf = await r.body();
      if (r.ok() && buf.length > 50 && buf.length < 600000 && (/^image\//.test(type) || /\.(ico|png|svg|jpe?g|webp)(\?|$)/i.test(href))) return { buf, type: type || 'image/x-icon' };
    } catch {}
  }
  return null;
}
// For sites scanned before icons were captured.
async function fetchFavicon(origin) {
  const ctx = await newContext();
  try {
    const { page } = await open(ctx, origin + '/');
    const icons = await page.evaluate(ICONS_JS).catch(() => []);
    await page.close();
    return await downloadIcon(ctx, icons, origin);
  } catch { return null; } finally { await ctx.close().catch(() => {}); }
}

async function discover(url, onStep, given) {
  const ctx = given || await newContext();
  try {
    onStep('open');
    const { page, status, challenge } = await open(ctx, url);
    if (challenge) { await page.close().catch(() => {}); throw new Error('CLOUDFLARE_CHALLENGE'); }
    const finalUrl = page.url(), origin = new URL(finalUrl).origin;
    onStep('nav');
    await page.evaluate(MARK_JS).catch(() => {});
    const d = await page.evaluate(DISCOVER_JS);
    onStep('sitemap');
    const sitemap = await page.evaluate(async () => {
      try { const r = await fetch('/sitemap.xml'); if (!r.ok) return []; const t = await r.text(); return [...t.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map(m => m[1]).slice(0, 500); } catch { return []; }
    });
    await page.close();

    const pages = new Map();
    const add = (href, text, src, group, order) => {
      const p = normPath(href, origin); if (!p) return;
      const e = pages.get(p) || { path: p, name: '', sources: [], group: null, order: 1e6 };
      if (!e.sources.includes(src)) e.sources.push(src);
      if (text && src === 'header' && !e.name) e.name = niceName(text);
      if (group && !e.group) e.group = group;
      if (order !== undefined) e.order = Math.min(e.order, order);
      pages.set(p, e);
    };
    add(finalUrl, 'Home', 'home', null, -1);
    const home = pages.get(normPath(finalUrl, origin)); if (home) { home.name = 'Home'; home.isHome = true; }
    d.header.forEach((l, i) => add(l.href, l.text, 'header', l.group, i));
    d.footer.forEach(l => add(l.href, l.text, 'footer'));
    d.body.forEach(l => add(l.href, l.text, 'home'));
    sitemap.forEach(u => add(u, '', 'sitemap'));

    // Collections: 3+ sibling pages under one folder (blog posts, case studies, locations...).
    const folders = {};
    for (const e of pages.values()) { const m = e.path.match(/^(\/[^/]+)\/[^/]+$/); if (m) (folders[m[1]] = folders[m[1]] || []).push(e); }
    for (const [f, list] of Object.entries(folders)) if (list.length >= 3) list.forEach((e, i) => { e.collection = f; e.sample = i === 0; });
    for (const e of pages.values()) {
      e.legal = LEGAL_RE.test(e.path) || LEGAL_RE.test(e.name || '');
      e.selected = !!(e.isHome || ((e.sources.includes('header') || e.sources.includes('footer') || e.sources.includes('home')) && !e.legal && (!e.collection || e.sample)));
    }
    const list = [...pages.values()].sort((a, b) => a.order - b.order || (a.sources.includes('sitemap') && !a.sources.includes('home') ? 1 : 0) - (b.sources.includes('sitemap') && !b.sources.includes('home') ? 1 : 0) || a.path.localeCompare(b.path));
    const favicon = await downloadIcon(ctx, d.icons, origin).catch(() => null);
    return { status, origin, finalUrl, platform: d.platform, title: d.title, navText: d.navText, dead: d.dead, pages: list, favicon };
  } finally { if (!given) await ctx.close().catch(() => {}); }
}

async function auditPage(ctx, origin, pth, { screenshot = true } = {}) {
  const t0 = Date.now();
  let o;
  try { o = await open(ctx, origin + (pth === '/' ? '/' : pth)); } catch (e) { return { path: pth, status: 0, error: e.message.split('\n')[0], ms: Date.now() - t0 }; }
  const { page, status, challenge } = o;
  if (challenge) { await page.close().catch(() => {}); return { path: pth, status, challenge: true, error: 'Cloudflare’s visitor check turned the scan away', ms: Date.now() - t0 }; }
  try {
    await page.evaluate(MARK_JS).catch(() => {});
    const ready = await settle(page);
    await page.evaluate(MARK_JS).catch(() => {});
    const data = await page.evaluate(AUDIT_JS);
    data.capture = ready;
    let shot = null;
    if (screenshot && status < 400) {
      const h = Math.min(data.height || 900, 14000);
      shot = await page.screenshot({ type: 'jpeg', quality: 55, fullPage: true, clip: { x: 0, y: 0, width: 1280, height: h } }).catch(() => null);
    }
    return { path: pth, status, finalPath: new URL(page.url()).pathname, ...data, shot, ms: Date.now() - t0 };
  } finally { await page.close().catch(() => {}); }
}

// Run fn over items with limited concurrency.
async function pool(items, n, fn) {
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => { while (i < items.length) { const k = i++; await fn(items[k], k); } }));
}

async function liveHeadings(origin, paths, onPage) {
  const ctx = await newContext(), out = {};
  try {
    await pool(paths, 4, async p => {
      try { const { page, status } = await open(ctx, origin + (p === '/' ? '/' : p)); out[p] = { status, headings: await page.evaluate(LIVE_JS) }; await page.close(); }
      catch (e) { out[p] = { status: 0, error: e.message.split('\n')[0], headings: [] }; }
      onPage && onPage(p);
    });
  } finally { await ctx.close().catch(() => {}); }
  return out;
}

module.exports = { fetchFavicon, closeBrowser, nameFromTitle, niceName, discover, auditPage, liveHeadings, newContext, pool, browserStatus };
