/* Klucz licencyjny programu. W kodzie są tylko skróty SHA-256 dozwolonych kluczy (license-keys.json), nie same klucze.
   Aktywacja zapisuje się w folderze danych programu (license.json) – kolejne uruchomienia na tym komputerze nie pytają o klucz.
   Usunięcie skrótu z listy w nowej wersji programu unieważnia klucz także na komputerach, które go już aktywowały.
   Czysty Node – testowalny bez Electrona. */
const path = require('path');
const crypto = require('crypto');
const { writeAtomic, readJsonWithBackup } = require('./atomic');
const KEYS = require('./license-keys.json');

const FILE = 'license.json', BAK = 'license.bak';
const FORMAT = /^KLAPS-\d{4}-[A-Z0-9]{4}-[A-Z]{2,8}$/;

/** zapis klucza w jednej postaci: wielkie litery, bez spacji, myślniki zamiast półpauz */
function normalize(key) {
  return String(key == null ? '' : key).toUpperCase().replace(/[‐-―−_]/g, '-').replace(/\s+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
const hashOf = (norm) => crypto.createHash('sha256').update(KEYS.salt + ':' + norm).digest('hex');
const known = (hash) => KEYS.keys.find((k) => k.hash === hash) || null;

/** sprawdza klucz: { ok, id } albo { ok: false, reason: 'empty' | 'format' | 'unknown' } */
function check(key) {
  const n = normalize(key);
  if (!n) return { ok: false, reason: 'empty' };
  if (!FORMAT.test(n)) return { ok: false, reason: 'format' };
  const k = known(hashOf(n));
  return k ? { ok: true, id: k.id, hash: k.hash } : { ok: false, reason: 'unknown' };
}
/** stan licencji na tym komputerze */
function status(dir) {
  const r = readJsonWithBackup(path.join(dir, FILE), path.join(dir, BAK));
  const o = r && r.value;
  if (!o || typeof o.hash !== 'string') return { active: false };
  const k = known(o.hash);
  if (!k) return { active: false, revoked: true };
  return { active: true, id: k.id, label: k.label, at: +o.at || 0, hint: typeof o.hint === 'string' ? o.hint : '' };
}
function activate(dir, key) {
  const c = check(key);
  if (!c.ok) return c;
  const n = normalize(key);
  // podpowiedź do okna „O programie”: tylko początek i koniec klucza
  const hint = n.slice(0, 11) + '…' + n.slice(-4);
  writeAtomic(path.join(dir, FILE), JSON.stringify({ v: 1, hash: c.hash, at: Date.now(), hint }), path.join(dir, BAK));
  return { ok: true, id: c.id, active: true };
}
module.exports = { normalize, check, status, activate, FORMAT, KEYS };
