// AI engines: detect, describe and run Claude Code / Codex with the user's own login.
const { spawn, execFile } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const CATALOG = {
  claude: {
    name: 'Claude Code',
    vendor: 'Anthropic',
    plans: 'Claude Pro, Max, Team or Enterprise',
    plansUrl: 'https://claude.com/pricing',
    docsUrl: 'https://code.claude.com/docs/en/setup',
    install: [
      { label: 'Mac / Linux', cmd: 'curl -fsSL https://claude.ai/install.sh | bash' },
      { label: 'Windows (PowerShell)', cmd: 'irm https://claude.ai/install.ps1 | iex' },
      { label: 'With npm', cmd: 'npm install -g @anthropic-ai/claude-code' }
    ],
    login: 'claude auth login',
    models: [
      { id: 'sonnet', name: 'Sonnet 5.5', desc: 'Fast and careful. Right for most sites.', usage: 2, speed: 1.0, rec: true },
      { id: 'opus', name: 'Opus 5.5', desc: 'Better judgement on tricky pages and keyword overlaps.', usage: 3, speed: 1.5 },
      { id: 'fable', name: 'Fable 5.1', desc: 'Most capable. For large or high-stakes sites.', usage: 4, speed: 2.0 },
      { id: 'haiku', name: 'Haiku 4.5', desc: 'Quickest and lightest. Fine for small, simple sites.', usage: 1, speed: 0.55 }
    ],
    efforts: ['low', 'medium', 'high', 'xhigh', 'max']
  },
  codex: {
    name: 'Codex',
    vendor: 'OpenAI',
    plans: 'ChatGPT Plus, Pro, Business, Edu or Enterprise',
    plansUrl: 'https://chatgpt.com/pricing',
    docsUrl: 'https://developers.openai.com/codex/cli',
    install: [
      { label: 'With npm', cmd: 'npm install -g @openai/codex' },
      { label: 'Mac (Homebrew)', cmd: 'brew install --cask codex' }
    ],
    login: 'codex login',
    // Model IDs from learn.chatgpt.com/docs/models (September 2026).
    models: [
      { id: 'gpt-6-sol', name: 'GPT-6 Sol', desc: 'Codex’s default. Built for agent work like this.', usage: 2, speed: 1.0, rec: true },
      { id: 'gpt-6-astra', name: 'GPT-6 Astra', desc: 'Most capable. Slower, uses more of your limit.', usage: 4, speed: 1.8 },
      { id: 'gpt-6-luna', name: 'GPT-6 Luna', desc: 'Most efficient. Good for small sites.', usage: 1, speed: 0.6 },
      { id: 'default', name: 'Codex default', desc: 'Whatever model your Codex is set to.', usage: 2, speed: 1.0 }
    ],
    // Sent as -c model_reasoning_effort="<value>".
    efforts: ['low', 'medium', 'high', 'xhigh', 'max']
  }
};

const EFFORT = {
  low: { name: 'Low', desc: 'Quick pass with fewer second looks.', usage: 1, speed: 0.6 },
  medium: { name: 'Medium', desc: 'Balanced. Recommended for most sites.', usage: 2, speed: 1.0 },
  high: { name: 'High', desc: 'Weighs each heading more carefully.', usage: 3, speed: 1.5 },
  xhigh: { name: 'Extra high', desc: 'Slower. For complex or messy sites.', usage: 4, speed: 2.2 },
  max: { name: 'Max', desc: 'Slowest, heaviest usage. Rarely needed here.', usage: 5, speed: 3.0 }
};

// Finder-launched apps get a thin PATH; add the usual install locations.
const HOME = os.homedir();
const EXTRA_PATH = [path.join(HOME, '.local/bin'), path.join(HOME, '.claude/local'), '/opt/homebrew/bin', '/usr/local/bin', path.join(HOME, '.npm-global/bin'), path.join(HOME, '.volta/bin'), path.join(HOME, '.bun/bin')];
const ENV = { ...process.env, PATH: [...new Set([...EXTRA_PATH, ...(process.env.PATH || '').split(path.delimiter)])].join(path.delimiter) };

function which(bin) {
  for (const dir of ENV.PATH.split(path.delimiter)) {
    const p = path.join(dir, bin);
    try { fs.accessSync(p, fs.constants.X_OK); return p; } catch {}
  }
  return null;
}
const run = (cmd, args, ms = 10000) => new Promise(r => execFile(cmd, args, { timeout: ms, env: ENV }, (e, out, err) => r({ ok: !e, out: String(out || ''), err: String(err || '') })));

async function detect() {
  const out = {};
  const c = which('claude');
  out.claude = { installed: !!c, loggedIn: false };
  if (c) {
    const [a, v] = await Promise.all([run(c, ['auth', 'status']), run(c, ['--version'])]);
    out.claude.version = v.out.trim().split(' ')[0];
    try {
      const j = JSON.parse(a.out);
      out.claude.loggedIn = !!j.loggedIn;
      out.claude.account = j.email || null;
      out.claude.plan = j.subscriptionType || null;
      // API-key sign-ins are billed per token, not against a subscription.
      out.claude.billing = j.authMethod === 'claude.ai' ? 'subscription' : 'api';
    } catch {}
  }
  const x = which('codex');
  out.codex = { installed: !!x, loggedIn: false };
  if (x) {
    const [a, v] = await Promise.all([run(x, ['login', 'status']), run(x, ['--version'])]);
    const s = (a.out + a.err).trim();
    out.codex.version = v.out.trim().split(/\s+/).pop();
    out.codex.loggedIn = a.ok && /logged in/i.test(s);
    out.codex.billing = /api key/i.test(s) ? 'api' : 'subscription';
    out.codex.account = null;
  }
  return out;
}

// Turn a tool call into a short, human line for the activity feed.
function describeTool(name, input = {}) {
  const f = input.file_path || input.path || input.pattern || '';
  const base = f ? path.basename(String(f)) : '';
  switch (name) {
    case 'Read': return /\.(jpe?g|png)$/i.test(base) ? `Looked at screenshot ${base}` : `Read ${base}`;
    case 'Write': return `Wrote ${base}`;
    case 'Edit': return `Updated ${base}`;
    case 'Glob': case 'Grep': return `Searched files`;
    default: return name;
  }
}

/**
 * Start an agent run. onEvent receives:
 *  {type:'tool', text} {type:'text', text} {type:'limits', limits} {type:'usage', tokens}
 *  {type:'stderr', text}
 * Resolves with {ok, text, tokens, costUsd, sessionId, error}.
 */
function start({ engine, model, effort, prompt, cwd, onEvent }) {
  let proc, parse;
  const tokens = { input: 0, output: 0, cached: 0 };
  let finalText = '', sessionId = null, costUsd = null, errorText = '';
  const perMsg = new Map();

  if (engine === 'codex') {
    const args = ['exec', '--json', '--skip-git-repo-check', '--sandbox', 'workspace-write', '-C', cwd];
    if (model && model !== 'default') args.push('-m', model);
    if (effort) args.push('-c', `model_reasoning_effort="${effort}"`);
    args.push('-');
    proc = spawn(which('codex') || 'codex', args, { cwd, env: ENV, stdio: ['pipe', 'pipe', 'pipe'] });
    proc.stdin.end(prompt);
    parse = e => {
      const it = e.item;
      if (e.type === 'thread.started') sessionId = e.thread_id;
      if (e.type === 'item.started' && it) {
        if (it.type === 'command_execution') onEvent({ type: 'tool', text: 'Ran: ' + String(it.command).replace(/^bash -lc /, '').slice(0, 90) });
        if (it.type === 'file_change') onEvent({ type: 'tool', text: 'Changed ' + (it.changes || []).map(c => path.basename(c.path)).join(', ') });
      }
      if (e.type === 'item.completed' && it) {
        if (it.type === 'agent_message') { finalText = it.text; onEvent({ type: 'text', text: it.text }); }
        if (it.type === 'file_change') onEvent({ type: 'tool', text: 'Wrote ' + (it.changes || []).map(c => path.basename(c.path)).join(', ') });
      }
      if (e.type === 'turn.completed' && e.usage) {
        tokens.input += e.usage.input_tokens || 0; tokens.cached += e.usage.cached_input_tokens || 0; tokens.output += e.usage.output_tokens || 0;
        onEvent({ type: 'usage', tokens: { ...tokens } });
      }
      if (e.type === 'error' || e.type === 'turn.failed') errorText = e.message || (e.error && e.error.message) || 'Codex reported an error';
    };
  } else {
    const args = ['-p', prompt, '--output-format', 'stream-json', '--verbose',
      '--tools', 'Read,Write,Edit,Glob,Grep', '--permission-mode', 'acceptEdits', '--strict-mcp-config'];
    if (model && model !== 'default') args.push('--model', model);
    if (effort) args.push('--effort', effort);
    proc = spawn(which('claude') || 'claude', args, { cwd, env: ENV, stdio: ['ignore', 'pipe', 'pipe'] });
    parse = e => {
      if (e.type === 'system' && e.subtype === 'init') sessionId = e.session_id;
      if (e.type === 'rate_limit_event' && e.rate_limit_info) onEvent({ type: 'limits', limits: e.rate_limit_info });
      if (e.type === 'assistant') {
        for (const c of e.message.content || []) {
          if (c.type === 'text' && c.text.trim()) onEvent({ type: 'text', text: c.text });
          if (c.type === 'tool_use') onEvent({ type: 'tool', text: describeTool(c.name, c.input), file: c.input && c.input.file_path });
        }
        // Each content block repeats its message's usage, so count every message id once.
        const u = e.message.usage;
        if (u) {
          perMsg.set(e.message.id || perMsg.size, { input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0), cached: u.cache_read_input_tokens || 0, output: u.output_tokens || 0 });
          tokens.input = 0; tokens.cached = 0; tokens.output = 0;
          for (const x of perMsg.values()) { tokens.input += x.input; tokens.cached += x.cached; tokens.output += x.output; }
          onEvent({ type: 'usage', tokens: { ...tokens } });
        }
      }
      if (e.type === 'result') {
        finalText = e.result || finalText; costUsd = e.total_cost_usd ?? null;
        if (e.usage) {
          tokens.input = (e.usage.input_tokens || 0) + (e.usage.cache_creation_input_tokens || 0);
          tokens.cached = e.usage.cache_read_input_tokens || 0; tokens.output = e.usage.output_tokens || 0;
          onEvent({ type: 'usage', tokens: { ...tokens } });
        }
        if (e.is_error) errorText = e.result || e.subtype || 'Claude Code reported an error';
      }
    };
  }

  let buf = '', stderr = '';
  proc.stdout.on('data', d => {
    buf += d; let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i); buf = buf.slice(i + 1);
      if (!line.trim()) continue;
      try { parse(JSON.parse(line)); } catch {}
    }
  });
  proc.stderr.on('data', d => { stderr += d; onEvent({ type: 'stderr', text: String(d) }); });

  const done = new Promise(resolve => {
    proc.on('error', e => resolve({ ok: false, error: `Could not start ${CATALOG[engine].name}: ${e.message}`, tokens }));
    proc.on('close', code => resolve({
      ok: code === 0 && !errorText, code, text: finalText, tokens, costUsd, sessionId,
      error: errorText || (code !== 0 ? (stderr.trim().split('\n').slice(-3).join(' ') || `Exited with code ${code}`) : '')
    }));
  });
  return { proc, done };
}

// A tiny Claude call whose only purpose is to read the plan's current usage windows.
async function pingClaudeLimits(cwd) {
  let limits = null;
  const r = start({ engine: 'claude', model: 'haiku', effort: 'low', prompt: 'Reply with OK.', cwd, onEvent: e => { if (e.type === 'limits') limits = e.limits; } });
  await r.done;
  return limits;
}

module.exports = { CATALOG, EFFORT, detect, start, pingClaudeLimits, which, ENV };
