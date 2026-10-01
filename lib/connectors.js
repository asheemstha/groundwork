// The official connectors Google and Meta publish for AI assistants, set up in the user's own Claude Code. Groundwork
// never connects to them: it checks which ones Claude Code has (`claude mcp list`, run when asked) and writes the
// questions to ask, filled in from the project.
const os = require('os');
const { execFile } = require('child_process');
const E = require('./engines');

// How each connector shows up in `claude mcp list`, by its name or its command.
const KNOWN = [
  ['ga4', /analytics-mcp|google[- ]?analytics/i],
  ['ads', /google[- ]?ads/i],
  ['meta', /mcp\.facebook\.com\/ads|meta[- ]?ads/i],
  ['gsc', /search[- ]?console|mcp-gsc|\bgsc\b/i],
];

/** `claude mcp list` output: [{ name, target, state: 'connected' | 'auth' | 'failed', note }]. */
function parse(out) {
  const rows = [];
  for (const line of String(out).split('\n')) {
    // "name: command or address - ✔ Connected"; names can have spaces ("claude.ai Meta Ads" for a claude.ai connector).
    const m = line.match(/^(\S.*?):\s+(.+?)\s+-\s+(✓|✔|✗|✘|⚠|!)\s*(.*)$/);
    if (!m) continue;
    const note = m[4].trim();
    rows.push({ name: m[1].trim(), target: m[2].trim(), state: /✓|✔/.test(m[3]) ? 'connected' : /auth/i.test(note) || /⚠|!/.test(m[3]) ? 'auth' : 'failed', note });
  }
  return rows;
}

/** Which connectors Claude Code has. Starting each one to check it can take a while, so it's only run when asked. */
function check() {
  const c = E.which('claude');
  if (!c) return Promise.resolve({ at: Date.now(), installed: false, found: {} });
  return new Promise(resolve => execFile(c, ['mcp', 'list'], { cwd: os.homedir(), env: E.ENV, timeout: 90000, maxBuffer: 1 << 20 }, (e, out, err) => {
    const servers = parse(out);
    const found = {};
    for (const [id, re] of KNOWN) { const s = servers.find(x => re.test(x.name) || re.test(x.target)); if (s) found[id] = { name: s.name, state: s.state, note: s.note }; }
    resolve({ at: Date.now(), installed: true, count: servers.length, found, error: e && !servers.length ? String(err || e.message).split('\n')[0].slice(0, 200) : null });
  }));
}

module.exports = { check, parse, KNOWN };
