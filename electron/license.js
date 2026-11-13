/* Klucz licencyjny programu.
   - Klucze mają 100 bitów losowości (KLAPS-XXXXX-XXXXX-XXXXX-XXXXX, alfabet Crockford base32), więc skrótu SHA-256
     z listy license-keys.json nie da się odwrócić zgadywaniem. W programie są tylko skróty, nie klucze.
   - Dowodem licencji jest SAM KLUCZ, przechowywany w magazynie sekretów systemu (Keychain / DPAPI) i sprawdzany
     przy każdym uruchomieniu. Zapisanie w plikach programu skrótu z publicznej listy niczego nie aktywuje.
   - Usunięcie skrótu z listy w nowej wersji programu unieważnia klucz także tam, gdzie był aktywowany.
   Czysty Node – testowalny bez Electrona. Nowe klucze: node scripts/license-key.js */
const crypto = require('crypto');
const KEYS = require('./license-keys.json');

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const FORMAT = /^KLAPS(-[0-9A-HJKMNP-TV-Z]{5}){4}$/;
/** nazwa sekretu z kluczem – zastrzeżona, okno programu nie ma do niej dostępu przez IPC */
const SECRET = 'license.key';

/** zapis klucza w jednej postaci: wielkie litery, bez spacji, myślniki zamiast półpauz, O→0, I/L→1, U→V (pomyłki przy przepisywaniu) */
function normalize(key) {
  const s = String(key == null ? '' : key).toUpperCase().replace(/[‐-―−_]/g, '-').replace(/\s+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const m = /^KLAPS-?(.*)$/.exec(s);
  if (!m) return s;
  const body = m[1].replace(/-/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  return body.length === 20 ? 'KLAPS-' + body.match(/.{5}/g).join('-') : s;
}
const hashOf = (norm, keys) => crypto.createHash('sha256').update((keys || KEYS).salt + ':' + norm).digest('hex');
const known = (hash, keys) => (keys || KEYS).keys.find((k) => k.hash === hash) || null;

/** sprawdza klucz: { ok, id } albo { ok: false, reason: 'empty' | 'format' | 'unknown' } */
function check(key, keys) {
  const n = normalize(key);
  if (!n) return { ok: false, reason: 'empty' };
  if (!FORMAT.test(n)) return { ok: false, reason: 'format' };
  const k = known(hashOf(n, keys), keys);
  return k ? { ok: true, id: k.id, label: k.label || '' } : { ok: false, reason: 'unknown' };
}
const hint = (norm) => norm.slice(0, 11) + '…' + norm.slice(-5);

/** stan licencji: `store` = { get(), set(v), remove() } nad magazynem sekretów; klucz jest sprawdzany za każdym razem */
function status(store, keys) {
  let saved = null;
  try { saved = store.get(); } catch (e) { saved = null; }
  if (!saved) return { active: false };
  const c = check(saved, keys);
  if (!c.ok) return { active: false, revoked: true };
  return { active: true, id: c.id, label: c.label, hint: hint(normalize(saved)) };
}
function activate(store, key, keys) {
  const c = check(key, keys);
  if (!c.ok) return c;
  store.set(normalize(key));
  return { ok: true, id: c.id, active: true };
}
/** nowy losowy klucz (100 bitów) i wpis do license-keys.json */
function generate(id, label, keys) {
  const b = crypto.randomBytes(20);
  let body = '';
  for (let i = 0; i < 20; i++) body += ALPHABET[b[i] & 31];
  const key = 'KLAPS-' + body.match(/.{5}/g).join('-');
  return { key, entry: { id, label: label || '', hash: hashOf(key, keys) } };
}
module.exports = { normalize, check, status, activate, generate, hint, FORMAT, SECRET, KEYS };
