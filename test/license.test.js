/* Licencja: format, poprawny i błędny klucz, zapis aktywacji, unieważnienie. */
const assert = require('assert');
const fs = require('fs'), os = require('os'), path = require('path');
const lic = require('../electron/license');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-lic-'));

assert.strictEqual(lic.normalize(' klaps–2026–7q4m–prod '), 'KLAPS-2026-7Q4M-PROD', 'normalizacja (małe litery, półpauzy, spacje)');
assert.deepStrictEqual(lic.check(''), { ok: false, reason: 'empty' });
assert.deepStrictEqual(lic.check('abc'), { ok: false, reason: 'format' });
assert.deepStrictEqual(lic.check('KLAPS-2026-AAAA-PROD'), { ok: false, reason: 'unknown' });
assert.strictEqual(lic.check('KLAPS-2026-7Q4M-PROD').ok, true, 'klucz testowy');
assert.ok(!JSON.stringify(lic.KEYS).includes('7Q4M'), 'w programie nie ma jawnego klucza, tylko skrót');

assert.deepStrictEqual(lic.status(dir), { active: false }, 'nowy komputer: brak licencji');
assert.strictEqual(lic.activate(dir, 'KLAPS-2026-AAAA-PROD').ok, false, 'błędny klucz nie aktywuje');
assert.deepStrictEqual(lic.status(dir), { active: false });
assert.strictEqual(lic.activate(dir, 'klaps-2026-7q4m-prod').ok, true);
const s = lic.status(dir);
assert.strictEqual(s.active, true, 'aktywacja zapamiętana');
assert.strictEqual(s.hint, 'KLAPS-2026-…PROD');
assert.ok(!fs.readFileSync(path.join(dir, 'license.json'), 'utf8').includes('7Q4M'), 'w pliku aktywacji nie ma pełnego klucza');
// skrót spoza listy (np. klucz wycofany w nowej wersji)
fs.writeFileSync(path.join(dir, 'license.json'), JSON.stringify({ v: 1, hash: 'f'.repeat(64), at: 1 }));
fs.rmSync(path.join(dir, 'license.bak'), { force: true });
assert.deepStrictEqual(lic.status(dir), { active: false, revoked: true }, 'wycofany klucz nie działa');
console.log('licencja: OK');
