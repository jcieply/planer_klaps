const assert = require('assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const store = require('../electron/store');
const { writeAtomic } = require('../electron/atomic');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-'));
const proj = path.join(dir, 'a', 'b');
assert.deepStrictEqual(store.list(proj), []);
store.save(proj, 'p1', { id: 'p1', title: 'Żółć', updatedAt: 5 }, '{"plan":1}', '{"s":"zażółć"}');
store.save(proj, 'p1', { id: 'p1', title: 'Żółć 2', updatedAt: 6 }, '{"plan":2}', '{}');
assert.strictEqual(store.list(proj).length, 1);
assert.strictEqual(store.list(proj)[0].title, 'Żółć 2');
assert.strictEqual(store.load(proj, 'p1').plan, '{"plan":2}');
store.save(proj, 'p2', { id: 'p2', title: 'Mapki', updatedAt: 7 }, '{}', '{}', '{"m1":{"data":"abc"}}');
assert.strictEqual(store.load(proj, 'p2').media, '{"m1":{"data":"abc"}}', 'mapki zapisane w pliku projektu');
store.remove(proj, 'p2');
assert.ok(!fs.readdirSync(proj).some((f) => f.startsWith('p2')), 'usunięcie kasuje projekt, kopię i opis');
assert.ok(fs.readdirSync(proj).includes('p1.bak'), 'kopia poprzedniej wersji');
assert.ok(!fs.readdirSync(proj).some((f) => f.endsWith('.tmp')), 'brak plików tymczasowych');
fs.writeFileSync(path.join(proj, 'x.klaps.json'), '{uszkodzony');
assert.strictEqual(store.list(proj).length, 1, 'uszkodzony plik pominięty');
assert.throws(() => store.save(proj, '../evil', {}, '', ''));
assert.strictEqual(store.load(proj, 'nope'), null);

// lista korzysta z opisów: zmieniony opis jest widoczny bez czytania całego projektu
fs.writeFileSync(path.join(proj, 'p1.meta.json'), JSON.stringify({ id: 'p1', title: 'Z opisu', updatedAt: 9 }));
assert.strictEqual(store.list(proj).find((m) => m.id === 'p1').title, 'Z opisu');
// opis starszy niż projekt (np. przerwany zapis) jest ignorowany i odtwarzany
const old = new Date(Date.now() - 60000); fs.utimesSync(path.join(proj, 'p1.meta.json'), old, old);
assert.strictEqual(store.list(proj).find((m) => m.id === 'p1').title, 'Żółć 2');
// projekt bez opisu (zapisany starszą wersją programu) też trafia na listę
fs.unlinkSync(path.join(proj, 'p1.meta.json'));
assert.strictEqual(store.list(proj)[0].title, 'Żółć 2');

// odzyskiwanie: uszkodzony plik główny → wraca kopia
fs.writeFileSync(path.join(proj, 'p1.klaps.json'), '{"plan":'); // ucięty zapis
const back = store.load(proj, 'p1');
assert.ok(back && back.plan === '{"plan":1}', 'wczytano kopię poprzedniej wersji: ' + JSON.stringify(back));
assert.doesNotThrow(() => JSON.parse(fs.readFileSync(path.join(proj, 'p1.klaps.json'), 'utf8')), 'plik główny odtworzony z kopii');

// zapis atomowy: stary plik nie znika, gdy zapis się nie powiedzie
const target = path.join(proj, 'atom.json');
writeAtomic(target, 'jeden');
assert.throws(() => writeAtomic(target, { toString() { throw new Error('x'); } }));
assert.strictEqual(fs.readFileSync(target, 'utf8'), 'jeden');
assert.ok(!fs.readdirSync(proj).some((f) => f.endsWith('.tmp')), 'nieudany zapis nie zostawia plików tymczasowych');

// duży projekt (mapki) przechodzi w całości
const big = 'x'.repeat(5 * 1024 * 1024);
store.save(proj, 'big', { id: 'big', title: 'Duży', updatedAt: 1 }, big, '{}', JSON.stringify({ m: big }));
assert.strictEqual(store.load(proj, 'big').plan.length, big.length);
store.remove(proj, 'p1'); store.remove(proj, 'big');
assert.strictEqual(store.list(proj).length, 0);
console.log('store: OK');
