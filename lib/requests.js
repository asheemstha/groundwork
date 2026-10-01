// Files to get from the client: copy for each page to rewrite, the logo, fonts and photos. Each request has a few
// match words, and it's ticked off when a file whose name or folder has those words lands in the project's folder
// (a shared Dropbox, Google Drive or iCloud folder on this Mac). Only file names are read, never what's in them.
const fs = require('fs'), path = require('path');

const tokens = s => String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
// Words that say nothing about which file it is.
const STOP = new Set(['the', 'and', 'for', 'with', 'our', 'us', 'we', 'a', 'an', 'of', 'to', 'in', 'on', 'page', 'pages', 'copy', 'new', 'file', 'files', 'final', 'draft', 'v', 'html', 'index']);
/** The match words for a request's title or a page's address, at most four. */
const words = s => [...new Set(tokens(s).filter(w => !STOP.has(w) && (w.length > 1 || /\d/.test(w))))].slice(0, 4);
const forPath = p => (p === '/' ? ['home'] : words(String(p).split('/').filter(Boolean).pop() || ''));

// The usual asks on any project: [title, kind, match words].
const USUAL = [['Logo files (SVG and PNG)', 'brand', 'logo'], ['Fonts, with a web licence', 'brand', 'font'], ['Brand guidelines or colours', 'brand', 'guide'], ['Photos you can use', 'brand', 'photo']];
// Font files count as fonts, whatever they're called.
const FONT = /\.(otf|ttf|woff2?)$/i;

/** The folder's files, a few levels down: [{ rel, mtime }]. Hidden files, Office lock files and app folders are skipped. */
function list(dir, { max = 4000, depth = 5 } = {}) {
  const out = [];
  const walk = (d, rel, n) => {
    if (out.length >= max || n > depth) return;
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (out.length >= max) return;
      if (/^[.~]|^Icon\r$|^desktop\.ini$/i.test(e.name) || /^(node_modules|__MACOSX)$/.test(e.name)) continue;
      const r = rel ? rel + '/' + e.name : e.name, full = path.join(d, e.name);
      if (e.isDirectory()) walk(full, r, n + 1);
      else if (e.isFile()) { let m = 0; try { m = fs.statSync(full).mtimeMs; } catch {} out.push({ rel: r, mtime: m }); }
    }
  };
  walk(dir, '', 0);
  return out;
}

/** Whether a file's path has every match word: at the start of one of its words, or inside a longer one ("webdesign"). */
function fits(match, rel) {
  const t = tokens(rel); if (!match.length) return false;
  if (match.length === 1 && match[0] === 'font' && FONT.test(rel)) return true;
  return match.every(w => t.some(x => x.startsWith(w) || (w.length >= 4 && x.includes(w))));
}

/**
 * Ticks off the waiting requests a file fits. The most specific requests pick first, each file counts once, and the
 * newest fitting file wins. Returns the rows that changed.
 */
function match(rows, files) {
  const used = new Set(rows.filter(r => r.file).map(r => r.file.name)), changed = [];
  const waiting = rows.filter(r => r.status === 'waiting').sort((a, b) => (b.match || []).length - (a.match || []).length);
  for (const r of waiting) {
    const hit = files.filter(f => !used.has(f.rel) && !(r.ignore || []).includes(f.rel) && fits(r.match || [], f.rel)).sort((a, b) => b.mtime - a.mtime)[0];
    if (!hit) continue;
    used.add(hit.rel); r.status = 'in'; r.file = { name: hit.rel, at: Math.round(hit.mtime) || Date.now() }; r.in = Date.now(); changed.push(r);
  }
  return changed;
}

module.exports = { words, forPath, USUAL, list, fits, match };
