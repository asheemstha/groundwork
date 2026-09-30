// Speed: a lab test of a page on this Mac, set up like Lighthouse's mobile test (a slow 4G connection and a phone's
// slower processor), measured against Google's Core Web Vitals targets. INP needs real taps, so the lab stand-in is
// Total Blocking Time, as in Lighthouse. Google ranks on real visitors' numbers, so this is an early warning, not the
// score Google uses.

// Google's thresholds: good at or under the first number, poor over the second.
const TARGETS = { lcp: [2500, 4000], cls: [0.1, 0.25], tbt: [200, 600] };
const rate = (k, v) => (v == null ? null : v <= TARGETS[k][0] ? 'good' : v <= TARGETS[k][1] ? 'fix' : 'poor');

// Lighthouse's "applied" mobile throttling: 562.5 ms round trips, 1.4 Mbps down, 675 kbps up, the CPU 4x slower.
const NETWORK = { offline: false, latency: 562.5, downloadThroughput: (1474.56 * 1024) / 8, uploadThroughput: (675 * 1024) / 8 };
const CPU = 4;
const PHONE = { width: 412, height: 823, deviceScaleFactor: 1.75, mobile: true };

// Runs in the page before its own scripts: records what Core Web Vitals are made of as it loads.
const OBSERVE = () => {
  const gw = (window.__gw = { lcp: 0, lcpEl: '', cls: 0, shifts: [], fcp: 0, long: [] });
  const file = u => { const f = String(u || '').split('?')[0].split('/').pop(); try { return decodeURIComponent(f).slice(0, 80); } catch { return f.slice(0, 80); } };
  const describe = el => {
    if (!el || !el.tagName) return '';
    const tag = el.tagName.toLowerCase();
    if (tag === 'img') return 'image ' + file(el.currentSrc || el.src);
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== 'none') return 'background image ' + file((bg.match(/url\("?([^")]+)/) || [])[1]);
    if (tag === 'video') return 'video';
    return 'text “' + (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60) + '”';
  };
  const on = (type, fn) => { try { new PerformanceObserver(l => l.getEntries().forEach(fn)).observe({ type, buffered: true }); } catch {} };
  on('largest-contentful-paint', e => { gw.lcp = e.startTime; gw.lcpEl = describe(e.element); });
  on('paint', e => { if (e.name === 'first-contentful-paint') gw.fcp = e.startTime; });
  on('longtask', e => gw.long.push([e.startTime, e.duration]));
  // CLS is the worst burst of shifts: shifts less than 1 s apart, in a window of up to 5 s.
  let sum = 0, first = 0, last = 0;
  on('layout-shift', e => {
    if (e.hadRecentInput) return;
    if (sum && e.startTime - last < 1000 && e.startTime - first < 5000) sum += e.value; else { sum = e.value; first = e.startTime; }
    last = e.startTime;
    gw.cls = Math.max(gw.cls, sum);
    if (e.value >= 0.01) for (const s of e.sources || []) if (s.node && s.node.nodeType === 1) gw.shifts.push([e.value, describe(s.node) || s.node.tagName.toLowerCase()]);
  });
};

/** Load one page cold, throttled like a mid-range phone on slow 4G, and measure it. */
async function measure(ctx, url, { timeout = 60000 } = {}) {
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  const sizes = new Map(), types = new Map();
  let requests = 0;
  try {
    await cdp.send('Network.enable');
    await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
    await cdp.send('Network.emulateNetworkConditions', NETWORK);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU });
    await cdp.send('Emulation.setDeviceMetricsOverride', PHONE);
    cdp.on('Network.requestWillBeSent', () => { requests++; });
    cdp.on('Network.responseReceived', e => types.set(e.requestId, { url: e.response.url, type: e.type }));
    cdp.on('Network.loadingFinished', e => sizes.set(e.requestId, e.encodedDataLength));
    await page.addInitScript(OBSERVE);
    const t0 = Date.now();
    const r = await page.goto(url, { waitUntil: 'load', timeout });
    const status = r ? r.status() : 0;
    // Wait for the page to go quiet (lazy images, late scripts), then give LCP and shifts a moment to report.
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const gw = await page.evaluate(() => window.__gw || null);
    if (!gw) throw new Error('The page didn’t report its timings.');
    // Total Blocking Time: the part of each long task over 50 ms, after the first paint.
    const tbt = Math.round(gw.long.filter(([s]) => s >= gw.fcp).reduce((n, [, d]) => n + Math.max(0, d - 50), 0));
    const bytes = [...sizes.values()].reduce((n, x) => n + x, 0);
    const heavy = [...sizes.entries()].map(([id, n]) => ({ ...(types.get(id) || { url: '', type: 'Other' }), bytes: n })).filter(x => x.url && !x.url.startsWith('data:')).sort((a, b) => b.bytes - a.bytes).slice(0, 3)
      .map(x => ({ name: decodeURIComponent(x.url.split('?')[0].split('/').pop() || x.url).slice(0, 80), type: x.type, bytes: x.bytes }));
    const shifts = [...new Map(gw.shifts.sort((a, b) => b[0] - a[0]).map(([, d]) => [d, d])).values()].slice(0, 3);
    const m = { status, lcp: gw.lcp ? Math.round(gw.lcp) : null, cls: Math.round(gw.cls * 1000) / 1000, tbt, fcp: gw.fcp ? Math.round(gw.fcp) : null, lcpEl: gw.lcpEl || '', shifts, bytes, requests, heavy, ms: Date.now() - t0 };
    m.rating = { lcp: rate('lcp', m.lcp), cls: rate('cls', m.cls), tbt: rate('tbt', m.tbt) };
    return m;
  } finally { await cdp.detach().catch(() => {}); await page.close().catch(() => {}); }
}

module.exports = { measure, TARGETS, rate };
