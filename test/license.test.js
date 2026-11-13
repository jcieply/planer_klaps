/* Licencja: format, poprawny i błędny klucz, klucz jako dowód (nie skrót), unieważnienie, generator. */
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const lic = require('../electron/license');
const secrets = require('../electron/secrets');
const { testLicense } = require('./license-fixture');

const t = testLicense();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-lic-'));
const vault = secrets.open(dir, null);
const store = { get: () => vault.get(lic.SECRET), set: (k) => vault.set(lic.SECRET, k), remove: () => vault.remove(lic.SECRET) };

// format i normalizacja
assert.ok(lic.FORMAT.test(t.key), 'wygenerowany klucz ma poprawny format');
assert.strictEqual(t.key.replace(/^KLAPS|-/g, '').length, 20, '20 znaków base32 = 100 bitów');
assert.strictEqual(lic.normalize(' ' + t.key.toLowerCase().replace(/-/g, '–') + ' '), t.key, 'małe litery, półpauzy, spacje');
assert.strictEqual(lic.normalize('KLAPS-OIL00-00000-00000-0000U'), 'KLAPS-01100-00000-00000-0000V', 'O→0, I/L→1, U→V');
assert.deepStrictEqual(lic.check('', t.keys), { ok: false, reason: 'empty' });
assert.deepStrictEqual(lic.check('abc', t.keys), { ok: false, reason: 'format' });
assert.deepStrictEqual(lic.check('KLAPS-2026-7Q4M-PROD', t.keys), { ok: false, reason: 'format' }, 'stary, krótki format jest odrzucany');
assert.deepStrictEqual(lic.check('KLAPS-00000-00000-00000-00000', t.keys), { ok: false, reason: 'unknown' });
assert.strictEqual(lic.check(t.key, t.keys).ok, true);

// wbudowana lista: tylko skróty, wycofany klucz testowy 2.7.0 nie działa
assert.ok(lic.KEYS.keys.every((k) => /^[0-9a-f]{64}$/.test(k.hash) && !('key' in k)), 'w programie są tylko skróty');
assert.ok(!lic.KEYS.keys.some((k) => k.hash.startsWith('ef42f985')), 'skrót klucza testowego z 2.7.0 usunięty');
assert.strictEqual(lic.check('KLAPS-2026-7Q4M-PROD').ok, false);
assert.strictEqual(lic.check(t.key).ok, false, 'klucz testowy nie pasuje do wbudowanej listy');

// aktywacja: dowodem jest klucz w magazynie sekretów
assert.deepStrictEqual(lic.status(store, t.keys), { active: false }, 'nowy komputer: brak licencji');
assert.strictEqual(lic.activate(store, 'KLAPS-00000-00000-00000-00000', t.keys).ok, false);
assert.deepStrictEqual(lic.status(store, t.keys), { active: false }, 'błędny klucz nie aktywuje');
assert.strictEqual(lic.activate(store, t.key.toLowerCase(), t.keys).ok, true);
const s = lic.status(store, t.keys);
assert.strictEqual(s.active, true, 'aktywacja zapamiętana');
assert.strictEqual(s.hint, t.key.slice(0, 11) + '…' + t.key.slice(-5));

// podrobienie z wersji 2.7.0: skrót z publicznej listy zapisany do pliku albo do magazynu niczego nie aktywuje
const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-lic-'));
const v2 = secrets.open(dir2, null);
const store2 = { get: () => v2.get(lic.SECRET), set: (k) => v2.set(lic.SECRET, k), remove: () => v2.remove(lic.SECRET) };
fs.writeFileSync(path.join(dir2, 'license.json'), JSON.stringify({ v: 1, hash: t.keys.keys[0].hash, at: 1 }));
assert.deepStrictEqual(lic.status(store2, t.keys), { active: false }, 'plik license.json ze skrótem nie daje licencji');
v2.set(lic.SECRET, t.keys.keys[0].hash);
assert.deepStrictEqual(lic.status(store2, t.keys), { active: false, revoked: true }, 'skrót w miejscu klucza nie daje licencji');

// wycofanie klucza w nowej wersji (skrót usunięty z listy)
assert.deepStrictEqual(lic.status(store, { salt: t.keys.salt, keys: [] }), { active: false, revoked: true }, 'wycofany klucz przestaje działać');
console.log('licencja: OK');
