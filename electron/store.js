/* Zapis projektów jako zwykłe pliki .json w folderze (czysty Node, bez Electrona – da się testować). */
const fs = require('fs');
const path = require('path');

const SAFE = /^[A-Za-z0-9_-]{1,80}$/;
function file(dir, id) {
  if (typeof id !== 'string' || !SAFE.test(id)) throw new Error('Niepoprawny identyfikator projektu');
  return path.join(dir, id + '.klaps.json');
}
function ensure(dir) { fs.mkdirSync(dir, { recursive: true }); }
function writeAtomic(target, text) {
  const tmp = target + '.tmp';
  fs.writeFileSync(tmp, text);
  if (fs.existsSync(target)) { try { fs.copyFileSync(target, target.replace(/\.klaps\.json$/, '.bak')); } catch (e) { /* kopia opcjonalna */ } }
  fs.renameSync(tmp, target);
}

function list(dir) {
  ensure(dir);
  const out = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith('.klaps.json')) continue;
    try {
      const o = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
      if (o && o.meta && o.id) out.push(o.meta);
    } catch (e) { /* uszkodzony plik pomijamy */ }
  }
  return out;
}
function save(dir, id, meta, plan, script, media) {
  ensure(dir);
  // media = mapki (obrazy) zapisane jako osobna część projektu
  writeAtomic(file(dir, id), JSON.stringify({ format: 'klaps-planer', version: 2, id, meta, plan, script, media: media || '{}' }));
  return true;
}
function load(dir, id) {
  const f = file(dir, id);
  if (!fs.existsSync(f)) return null;
  const o = JSON.parse(fs.readFileSync(f, 'utf8'));
  return { plan: o.plan, script: o.script, media: o.media || '' };
}
function remove(dir, id) {
  const f = file(dir, id);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  return true;
}
module.exports = { list, save, load, remove };
