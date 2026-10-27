const assert = require('assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const profile = require('../electron/profile');
const intents = require('../electron/intent');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-prof-'));

assert.strictEqual(profile.get(dir), null, 'pierwsze uruchomienie: brak profilu');
assert.throws(() => profile.set(dir, { name: ' ' }), /imię i nazwisko/);
assert.throws(() => profile.set(dir, { name: 'A' }), /imię i nazwisko/);
const p = profile.set(dir, { name: '  Anna \n  Nowak ', role: ' Kierownik   produkcji ' });
assert.strictEqual(p.name, 'Anna Nowak', 'spacje i znaki sterujące oczyszczone');
assert.strictEqual(p.role, 'Kierownik produkcji');
assert.strictEqual(p.account.provider, 'local');
assert.strictEqual(p.prefs.showLauncher, true);
assert.ok(p.id && p.createdAt);
// kolejny zapis zachowuje tożsamość i datę utworzenia
const p2 = profile.set(dir, { name: 'Anna Kowalska', role: '' });
assert.strictEqual(p2.id, p.id); assert.strictEqual(p2.createdAt, p.createdAt); assert.strictEqual(p2.name, 'Anna Kowalska');
assert.strictEqual(profile.get(dir).name, 'Anna Kowalska');
// ustawienia
profile.setPrefs(dir, { showLauncher: false, lastProject: 'abc', lastOpenedAt: 5 });
const g = profile.get(dir);
assert.strictEqual(g.prefs.showLauncher, false); assert.strictEqual(g.prefs.lastProject, 'abc'); assert.strictEqual(g.lastOpenedAt, 5);
profile.setPrefs(dir, { showLauncher: 'tak' }); // zły typ ignorowany
assert.strictEqual(profile.get(dir).prefs.showLauncher, false);
// uszkodzony plik → kopia
fs.writeFileSync(path.join(dir, 'profile.json'), '{"name":');
assert.strictEqual(profile.get(dir).name, 'Anna Kowalska', 'profil odzyskany z kopii');
// bardzo długie imię jest przycinane
assert.strictEqual(profile.set(dir, { name: 'x'.repeat(500) }).name.length, 80);

// zamiar z okna startowego
assert.deepStrictEqual(intents.validate({ type: 'open', source: 'local', id: 'abc_12-3' }), { type: 'open', source: 'local', id: 'abc_12-3' });
assert.strictEqual(intents.validate({ type: 'open', source: 'local', id: '../x' }), null, 'ścieżka zamiast identyfikatora');
assert.deepStrictEqual(intents.validate({ type: 'open', source: 'cloud', id: 'a' }), { type: 'open', source: 'cloud', id: 'a' });
assert.strictEqual(intents.validate({ type: 'open', source: 'ftp', id: 'a' }), null, 'nieobsługiwane źródło');
assert.strictEqual(intents.validate(null), null);
assert.strictEqual(intents.validate({ type: 'rm' }), null);
const c = intents.validate({ type: 'create', title: '  Film \n  tytuł  ', template: 'demo' });
assert.deepStrictEqual(c, { type: 'create', source: 'local', title: 'Film tytuł', template: 'demo' });
assert.strictEqual(intents.validate({ type: 'create', title: 'a', template: 'x' }).template, 'empty');
const q = new URLSearchParams(intents.toQuery(c));
assert.strictEqual(q.get('create'), 'Film tytuł'); assert.strictEqual(q.get('template'), 'demo');
assert.strictEqual(new URLSearchParams(intents.toQuery({ type: 'open', source: 'local', id: 'z1' })).get('open'), 'z1');
console.log('profile + intent: OK');
