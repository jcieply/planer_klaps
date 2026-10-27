/* Zapis projektów jako zwykłe pliki w folderze (czysty Node, bez Electrona – da się testować).
   <id>.klaps.json  – projekt (plan, scenariusz, mapki)    <id>.bak – poprzednia wersja
   <id>.meta.json   – krótki opis do listy projektów (okno startowe nie musi czytać całych projektów) */
const fs = require('fs');
const path = require('path');
const { writeAtomic, readJsonWithBackup } = require('./atomic');

const SAFE = /^[A-Za-z0-9_-]{1,80}$/;
function name(id, ext) {
  if (typeof id !== 'string' || !SAFE.test(id)) throw new Error('Niepoprawny identyfikator projektu');
  return id + ext;
}
const file = (dir, id) => path.join(dir, name(id, '.klaps.json'));
const bak = (dir, id) => path.join(dir, name(id, '.bak'));
const side = (dir, id) => path.join(dir, name(id, '.meta.json'));
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
const mtime = (f) => { try { return fs.statSync(f).mtimeMs; } catch (e) { return 0; } };

function readProject(dir, id) { return readJsonWithBackup(file(dir, id), bak(dir, id)); }

function list(dir) {
  ensure(dir);
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.klaps.json')) continue;
    const id = f.slice(0, -'.klaps.json'.length);
    if (!SAFE.test(id)) continue;
    try {
      const sf = side(dir, id);
      if (mtime(sf) >= mtime(path.join(dir, f)) && mtime(sf) > 0) {
        const m = JSON.parse(fs.readFileSync(sf, 'utf8'));
        if (m && m.id) { out.push(m); continue; }
      }
    } catch (e) { /* opis uszkodzony – czytamy projekt */ }
    const r = readProject(dir, id);
    if (r && r.value && r.value.meta && r.value.id) {
      out.push(r.value.meta);
      try { writeAtomic(side(dir, id), JSON.stringify(r.value.meta)); } catch (e) { /* opis jest dodatkiem */ }
    }
  }
  return out;
}
function save(dir, id, meta, plan, script, media) {
  ensure(dir);
  // media = mapki (obrazy) zapisane jako osobna część projektu
  writeAtomic(file(dir, id), JSON.stringify({ format: 'klaps-planer', version: 2, id, meta, plan, script, media: media || '{}' }), bak(dir, id));
  try { writeAtomic(side(dir, id), JSON.stringify(meta)); } catch (e) { /* opis jest dodatkiem */ }
  return true;
}
function load(dir, id) {
  const r = readProject(dir, id);
  if (!r) return null;
  const o = r.value;
  return { plan: o.plan, script: o.script, media: o.media || '' };
}
function remove(dir, id) {
  for (const f of [file(dir, id), bak(dir, id), side(dir, id)]) { try { fs.unlinkSync(f); } catch (e) { /* brak pliku */ } }
  return true;
}
module.exports = { list, save, load, remove, SAFE };
