const assert = require('assert');
const fs = require('fs'); const os = require('os'); const path = require('path');
const secrets = require('../electron/secrets');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-sec-'));
const xor = { available: () => true, encrypt: (s) => Buffer.from(Buffer.from(s).map((b) => b ^ 42)), decrypt: (b) => Buffer.from(Buffer.from(b).map((x) => x ^ 42)).toString() };
for (const [label, cipher] of [['szyfr', xor], ['bez szyfru', null]]) {
  const s = secrets.open(dir, cipher);
  assert.strictEqual(s.secure, !!cipher, label);
  assert.strictEqual(s.get('projectKey:abc'), null);
  s.set('projectKey:abc', 'TAJNE-ąę');
  assert.strictEqual(s.get('projectKey:abc'), 'TAJNE-ąę', label);
  const disk = fs.readFileSync(path.join(dir, 'secrets.json'), 'utf8');
  assert.strictEqual(disk.includes('TAJNE'), !cipher, 'w trybie szyfrowanym wartość nie leży jawnie na dysku');
  assert.throws(() => s.set('../zle', 'x'), /nazwa/);
  assert.throws(() => s.get('a b'), /nazwa/);
  assert.deepStrictEqual(s.names(), ['projectKey:abc']);
  s.remove('projectKey:abc');
  assert.strictEqual(s.get('projectKey:abc'), null);
}
fs.writeFileSync(path.join(dir, 'secrets.json'), '{"items":'); fs.writeFileSync(path.join(dir, 'secrets.bak'), 'x');
assert.deepStrictEqual(secrets.open(dir, null).names(), [], 'uszkodzony plik nie przewraca programu');
console.log('secrets OK');
