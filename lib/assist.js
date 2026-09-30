// Short AI jobs that aren't a plan: filling in a new project from a brief, and rewriting a client update in your
// voice. They use the same Claude Code or Codex login as the plans, in an empty folder, with the text in the prompt,
// so the AI sees only what's pasted in.
const fs = require('fs'), os = require('os'), path = require('path');
const engines = require('./engines');
const PF = require('./platforms');

async function ask({ engine = 'claude', model, prompt, timeoutMs = 180000 }) {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-assist-'));
  try {
    const m = model || (engine === 'claude' ? 'sonnet' : 'default');
    const { proc, done } = engines.start({ engine, model: m, effort: 'low', prompt, cwd, onEvent: () => {} });
    const timer = setTimeout(() => proc.kill('SIGTERM'), timeoutMs);
    const r = await done;
    clearTimeout(timer);
    if (!r.text) throw new Error(r.error || 'The AI didn’t answer. Try again.');
    return r.text.trim();
  } finally { fs.rmSync(cwd, { recursive: true, force: true }); }
}
const jsonOf = text => { const m = String(text).match(/\{[\s\S]*\}/); if (!m) throw new Error('The AI’s answer couldn’t be read. Try again.'); return JSON.parse(m[0]); };

const url = u => { u = String(u || '').trim(); if (!u) return null; if (!/^https?:\/\//i.test(u)) u = 'https://' + u; try { const x = new URL(u); return x.hostname.includes('.') ? x.origin + '/' : null; } catch { return null; } };
const day = d => (/^\d{4}-\d{2}-\d{2}$/.test(String(d || '')) ? d : null);
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').replace(/—/g, ',').trim().slice(0, n);

/** Keeps only answers that fit the project: known parts, platforms and phases, real addresses and dates. */
function clean(x, template) {
  const parts = new Set((template.parts || []).map(p => p.id)), phases = new Set(template.phases.map(p => p.id));
  const sites = x.sites || {};
  return {
    name: clip(x.name, 80) || null,
    clientName: clip(x.clientName, 80) || null,
    sites: { old: url(sites.old), staging: url(sites.staging), live: url(sites.live) },
    platform: PF.byId(x.platform) ? x.platform : null,
    kickoff: day(x.kickoff), launch: day(x.launch),
    parts: Array.isArray(x.parts) ? x.parts.filter(p => parts.has(p)) : null,
    items: (Array.isArray(x.items) ? x.items : []).slice(0, 12).map(i => ({ title: clip(i.title, 160), who: i.who === 'client' ? 'client' : 'us', phase: phases.has(i.phase) ? i.phase : template.phases[0].id, done: clip(i.done, 300) })).filter(i => i.title),
  };
}

/** The same fields found without AI: web addresses and dates written as YYYY-MM-DD. */
function plainRead(text, template) {
  const urls = [...String(text).matchAll(/\b(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)]*)?/gi)].map(m => url(m[0])).filter(Boolean);
  const sites = { old: null, staging: null, live: null };
  for (const u of [...new Set(urls)]) {
    const h = new URL(u).hostname;
    if (PF.isStaging(h)) sites.staging = sites.staging || u;
    else if (!sites.old) sites.old = u;
    else sites.live = sites.live || u;
  }
  const dated = [...String(text).matchAll(/(launch|go.?live|kick.?off|start)[^.\n]{0,40}?(\d{4}-\d{2}-\d{2})/gi)];
  const find = re => (dated.find(m => re.test(m[1])) || [])[2] || null;
  return { name: null, clientName: null, sites, platform: PF.ofHost(sites.staging && new URL(sites.staging).hostname), kickoff: find(/kick|start/i), launch: find(/launch|live/i), parts: null, items: [], template: template.id };
}

async function fromBrief({ text, template, engine, useAi }) {
  text = String(text || '').slice(0, 20000);
  if (!text.trim()) throw new Error('Paste the brief or your kickoff notes first.');
  if (!useAi) return { ...plainRead(text, template), ai: false };
  const today = new Date().toISOString().slice(0, 10);
  const titles = template.phases.map(ph => `${ph.id} (${ph.name}): ${[...ph.groups.flatMap(g => g.items), ...ph.handoff.items].map(i => i.title).join('; ')}`).join('\n');
  const parts = (template.parts || []).map(p => `${p.id}: ${p.name}${p.desc ? ', ' + p.desc : ''}`).join('\n') || '(none)';
  const prompt = `You're helping set up a client website project in Groundwork from the notes below. Today is ${today}.
Answer with JSON only, no other text, in this shape:
{"name": string or null, "clientName": string or null, "sites": {"old": string or null, "staging": string or null, "live": string or null}, "platform": one of ${PF.LIST.map(p => `"${p.id}"`).join(', ')} or null, "kickoff": "YYYY-MM-DD" or null, "launch": "YYYY-MM-DD" or null, "parts": [part ids], "items": [{"title": string, "who": "us" or "client", "phase": phase id, "done": string}]}

Rules:
- Use only what the notes say. Use null when they don't say it. Don't guess dates.
- name: the client's business or the project. clientName: the person to address in messages.
- sites: "old" is the site being replaced, "staging" the new site before launch, "live" the domain it launches on.
- parts: switch on only the optional parts the notes clearly need.
- items: up to 10 things this project needs that the checklist doesn't cover yet. Short, specific, plain words, no em dashes. "who" is "client" for things the client must send, do or decide. "done" says in one sentence what done means. Put each in the phase where it belongs.

Optional parts:
${parts}

The checklist already has, by phase:
${titles}

Notes:
"""
${text}
"""`;
  return { ...clean(jsonOf(await ask({ engine, prompt })), template), ai: true };
}

async function rewrite({ text, voice, engine }) {
  const prompt = `Rewrite this message to a client so it sounds like the person sending it wrote it. Their voice: ${clip(voice, 300) || 'friendly, plain and short'}.
Keep every fact, item, date, amount and name exactly as they are. Don't add anything new and don't drop any item. Keep lists as lists. No em dashes. Answer with the rewritten message only.

${String(text || '').slice(0, 12000)}`;
  return ask({ engine, prompt });
}

module.exports = { fromBrief, rewrite };
