/* Klucz licencyjny do testów: losowy, ważny tylko z listą skrótów zapisaną w pliku tymczasowym.
   Program przyjmuje taką listę (KLAPS_TEST_LICENSE_KEYS) wyłącznie wtedy, gdy działa ze źródeł – instalator ją ignoruje. */
const fs = require('fs'), os = require('os'), path = require('path');
const lic = require('../electron/license');
function testLicense() {
  const keys = { v: 2, salt: 'klaps-license-test', keys: [] };
  const g = lic.generate('test', 'Klucz testowy', keys);
  keys.keys.push(g.entry);
  const file = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-lic-')), 'keys.json');
  fs.writeFileSync(file, JSON.stringify(keys));
  return { key: g.key, keys, file, env: { KLAPS_TEST_LICENSE_KEYS: file } };
}
/** aktywna licencja w folderze danych (jak po wpisaniu klucza w oknie startowym) */
function seed(dataDir, key) {
  fs.writeFileSync(path.join(dataDir, 'secrets.json'), JSON.stringify({ v: 1, items: { [lic.SECRET]: 'p:' + lic.normalize(key) } }));
}
module.exports = { testLicense, seed };
