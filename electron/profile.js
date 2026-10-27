/* Profil użytkownika na tym komputerze (imię i nazwisko z pierwszego uruchomienia). Czysty Node – testowalny.
   Pole `account.provider` to miejsce na przyszłe logowanie do chmury: dziś zawsze „local”. */
const path = require('path');
const crypto = require('crypto');
const { writeAtomic, readJsonWithBackup } = require('./atomic');

const FILE = 'profile.json';
const clean = (s, max) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

function normalize(o) {
  if (!o || typeof o !== 'object') return null;
  const name = clean(o.name, 80);
  if (name.length < 2) return null;
  const prefs = o.prefs && typeof o.prefs === 'object' ? o.prefs : {};
  const acc = o.account && typeof o.account === 'object' ? o.account : {};
  const email = clean(acc.email, 120);
  return {
    v: 1,
    id: typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID(),
    name,
    role: clean(o.role, 80),
    createdAt: Number(o.createdAt) || Date.now(),
    lastOpenedAt: Number(o.lastOpenedAt) || 0,
    account: Object.assign({ provider: clean(acc.provider, 40) || 'local' }, email ? { email } : {}),
    prefs: { showLauncher: prefs.showLauncher !== false, lastProject: typeof prefs.lastProject === 'string' && prefs.lastProject ? prefs.lastProject : null },
  };
}
const files = (dir) => [path.join(dir, FILE), path.join(dir, 'profile.bak')];
function get(dir) { const r = readJsonWithBackup(...files(dir)); return r ? normalize(r.value) : null; }
function put(dir, p) { const [f, b] = files(dir); writeAtomic(f, JSON.stringify(p, null, 1), b); return p; }

/** tworzy albo zmienia profil; zwraca zapisany profil albo rzuca błąd z czytelnym komunikatem */
function set(dir, input) {
  const name = clean(input && input.name, 80);
  if (name.length < 2) throw new Error('Wpisz imię i nazwisko (co najmniej 2 znaki).');
  const cur = get(dir);
  return put(dir, normalize(Object.assign({}, cur || { createdAt: Date.now() }, { name, role: clean(input.role, 80) })));
}
function setPrefs(dir, patch) {
  const cur = get(dir);
  if (!cur) throw new Error('Brak profilu.');
  const p = patch || {};
  if (typeof p.showLauncher === 'boolean') cur.prefs.showLauncher = p.showLauncher;
  if (p.lastProject === null || typeof p.lastProject === 'string') cur.prefs.lastProject = p.lastProject || null;
  if (typeof p.lastOpenedAt === 'number') cur.lastOpenedAt = p.lastOpenedAt;
  return put(dir, normalize(cur));
}
module.exports = { get, set, setPrefs, normalize, clean };
