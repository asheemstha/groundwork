// Skills: the rulebook the AI follows for the heading plan. The built-in one ships with the app and can't be
// removed. Added ones live in <data>/skills/<id>/ and can be deleted. The one in use is remembered in prefs.skill.
const fs = require('fs'), path = require('path'), os = require('os');
const { execFileSync } = require('child_process');

// Files the heading plan's prompt points the AI to. A skill without some of them still works: the prompt only
// lists what's there, and the export falls back to the built-in guide template.
const KNOWN = {
  'references/heading-rules.md': 'the rulebook',
  'references/output-spec.md': 'what each action and field means',
  'references/keyword-mapping.md': 'the keyword method',
  'assets/heading-map-template.html': 'the export template',
};
const MAX_FILES = 300, MAX_BYTES = 20e6;

// Skills belong to a tool: 'headings' (the heading plan) or 'seo' (the SEO plan). The SEO plan's built-in rules live
// in its prompt, so its built-in skill has no folder; an editable copy writes those rules out as a SKILL.md.
const SEO_BUILTIN = 'seo-builtin';
module.exports = function skills({ DATA, BUILTIN, readJson, writeJson, seoRules = '' }) {
  const DIR = path.join(DATA, 'skills'), META = path.join(DIR, 'skills.json');
  const BUILTIN_ID = path.basename(BUILTIN);
  const meta = () => readJson(META, []);
  const toolOf = id => id === SEO_BUILTIN ? 'seo' : id === BUILTIN_ID ? 'headings' : ((meta().find(m => m.id === id) || {}).tool || 'headings');
  const builtinFor = tool => tool === 'seo' ? SEO_BUILTIN : BUILTIN_ID;

  function frontmatter(dir) {
    let md = '';
    try { md = fs.readFileSync(path.join(dir, 'SKILL.md'), 'utf8'); } catch {}
    const fm = (md.match(/^---\s*\n([\s\S]*?)\n---/) || [])[1] || '';
    const field = k => { const m = fm.match(new RegExp(`^${k}:\\s*(.+)$`, 'm')); return m ? m[1].trim().replace(/^["']|["']$/g, '') : ''; };
    return { name: field('name'), description: field('description'), title: (md.match(/^#\s+(.+)$/m) || [])[1] || '' };
  }
  function filesIn(dir) {
    const out = [];
    const walk = (d, rel) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name.startsWith('.')) continue; const r = rel ? rel + '/' + e.name : e.name; if (e.isDirectory()) walk(path.join(d, e.name), r); else out.push(r); } };
    try { walk(dir, ''); } catch {}
    return out;
  }
  function describe(id, dir, extra = {}) {
    const fm = frontmatter(dir), files = filesIn(dir), tool = extra.tool || 'headings';
    return {
      id, tool, builtin: id === BUILTIN_ID, name: fm.title || fm.name || id, slug: fm.name || id, description: fm.description || '',
      files: files.length, missing: tool === 'headings' ? Object.keys(KNOWN).filter(f => !files.includes(f)).map(f => ({ file: f, what: KNOWN[f] })) : [], ...extra,
    };
  }
  const seoBuiltin = () => ({ id: SEO_BUILTIN, tool: 'seo', builtin: true, name: 'Groundwork’s SEO rules', slug: 'groundwork-seo', description: 'Titles up to 60 characters with the keyword near the start, descriptions up to 155, one keyword per page, and URLs changed only when it clearly helps.', files: 0, missing: [] });
  const list = (tool = 'headings') => [
    tool === 'seo' ? seoBuiltin() : describe(BUILTIN_ID, BUILTIN),
    ...meta().filter(m => (m.tool || 'headings') === tool && fs.existsSync(path.join(DIR, m.id))).map(m => describe(m.id, path.join(DIR, m.id), { added: m.added, tool })),
  ];
  const dirOf = id => (!id || id === BUILTIN_ID ? BUILTIN : id === SEO_BUILTIN ? null : fs.existsSync(path.join(DIR, id, 'SKILL.md')) ? path.join(DIR, id) : (toolOf(id) === 'seo' ? null : BUILTIN));
  const get = (id, tool = 'headings') => list(tool).find(s => s.id === id) || list(tool)[0];

  // Keep only the folder that holds SKILL.md; everything else in an upload or zip is packaging.
  function install(root, tool = 'headings') {
    const all = filesIn(root);
    const skillMd = all.filter(f => path.basename(f) === 'SKILL.md').sort((a, b) => a.split('/').length - b.split('/').length)[0];
    if (!skillMd) throw new Error('That isn’t a skill: there’s no SKILL.md in it.');
    const base = path.join(root, path.dirname(skillMd));
    const fm = frontmatter(base);
    const id = (String(fm.name || path.basename(base) || 'skill').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skill') + '-' + Date.now().toString(36).slice(-4);
    fs.mkdirSync(DIR, { recursive: true });
    fs.cpSync(base, path.join(DIR, id), { recursive: true });
    writeJson(META, [...meta(), { id, added: Date.now(), tool }]);
    return id;
  }
  /** Add a skill from uploaded files ({path, data: base64}) or a .zip/.skill file (base64). */
  function add({ files, zip, tool = 'headings' }) {
    tool = tool === 'seo' ? 'seo' : 'headings';
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gw-skill-'));
    try {
      if (zip) {
        const buf = Buffer.from(String(zip), 'base64');
        if (buf.length > MAX_BYTES) throw new Error('That file is over 20 MB.');
        fs.writeFileSync(path.join(tmp, 'skill.zip'), buf);
        fs.mkdirSync(path.join(tmp, 'x'));
        try { execFileSync('unzip', ['-q', '-o', path.join(tmp, 'skill.zip'), '-d', path.join(tmp, 'x')], { timeout: 30000 }); }
        catch { throw new Error('Couldn’t open that file. Use a .zip or .skill file, or add the folder instead.'); }
        return install(path.join(tmp, 'x'), tool);
      }
      if (!Array.isArray(files) || !files.length) throw new Error('Choose a skill folder or file.');
      if (files.length > MAX_FILES) throw new Error(`That folder has over ${MAX_FILES} files. A skill is usually a handful.`);
      let bytes = 0;
      for (const f of files) {
        const rel = String(f.path || '').replace(/\\/g, '/').replace(/^\/+/, '');
        if (!rel || rel.split('/').some(p => p === '..' || p === '')) continue;
        const buf = Buffer.from(String(f.data || ''), 'base64');
        bytes += buf.length; if (bytes > MAX_BYTES) throw new Error('That folder is over 20 MB.');
        const to = path.join(tmp, 'x', rel);
        fs.mkdirSync(path.dirname(to), { recursive: true });
        fs.writeFileSync(to, buf);
      }
      return install(path.join(tmp, 'x'), tool);
    } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  }
  /** An editable copy of a skill (the built-in one included), named "… copy". */
  function duplicate(id) {
    const tool = toolOf(id);
    fs.mkdirSync(DIR, { recursive: true });
    if (id === SEO_BUILTIN) {
      // The built-in SEO rules, written out so they can be edited.
      const nid = 'groundwork-seo-copy-' + Date.now().toString(36).slice(-4);
      fs.mkdirSync(path.join(DIR, nid));
      fs.writeFileSync(path.join(DIR, nid, 'SKILL.md'), `---\nname: groundwork-seo-copy\ndescription: Our rules for page titles, meta descriptions and URLs. Edit them to match how the agency writes SEO.\n---\n\n# Groundwork SEO rules copy\n\n${seoRules}\n`);
      writeJson(META, [...meta(), { id: nid, added: Date.now(), from: id, tool }]);
      return nid;
    }
    const from = dirOf(id), fm = frontmatter(from);
    const slug = (fm.name || 'skill') + '-copy';
    const nid = slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36).slice(-4);
    fs.cpSync(from, path.join(DIR, nid), { recursive: true });
    const f = path.join(DIR, nid, 'SKILL.md');
    const md = fs.readFileSync(f, 'utf8').replace(/^(---[\s\S]*?^name:\s*).+$/m, `$1${slug}`).replace(/^#\s+(.+)$/m, (_, t) => `# ${t} copy`);
    fs.writeFileSync(f, md);
    writeJson(META, [...meta(), { id: nid, added: Date.now(), from: id, tool }]);
    return nid;
  }
  const folderOf = id => (id && id !== BUILTIN_ID && fs.existsSync(path.join(DIR, id)) ? path.join(DIR, id) : null);
  function remove(id) {
    if (!id || id === BUILTIN_ID || id === SEO_BUILTIN) throw new Error('The built-in skill can’t be deleted.');
    fs.rmSync(path.join(DIR, id), { recursive: true, force: true });
    writeJson(META, meta().filter(m => m.id !== id));
  }
  /** The files the AI should read first, in the order that matters, with what each one is for. */
  function reading(dir) {
    const files = filesIn(dir);
    return [['SKILL.md', 'context; ignore its crawling, Artifact and publishing steps'], ...Object.entries(KNOWN).filter(([f]) => f.endsWith('.md') && files.includes(f)),
      ...files.filter(f => /^references\/.+\.md$/.test(f) && !KNOWN[f]).map(f => [f, 'more of the skill’s rules'])];
  }
  return { BUILTIN_ID, SEO_BUILTIN, list, get, dirOf, add, duplicate, folderOf, remove, reading, toolOf, builtinFor };
};
