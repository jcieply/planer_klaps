/* Generuje nowy klucz licencyjny i dopisuje jego skrót do electron/license-keys.json.
   Użycie: node scripts/license-key.js <id> ["opis"]      (np. node scripts/license-key.js studio-abc "Studio ABC, 5 stanowisk")
   Klucz jest wypisywany TYLKO na ekran – zapisz go w bezpiecznym miejscu i przekaż klientowi. Nie trafia do repozytorium.
   Wycofanie klucza: usuń jego wpis z license-keys.json i wydaj nową wersję programu. */
const fs = require('fs'), path = require('path');
const lic = require('../electron/license');
const [id, label] = process.argv.slice(2);
if (!id || !/^[a-z0-9-]{2,40}$/.test(id)) { console.error('Podaj identyfikator klucza (małe litery, cyfry, myślniki), np. studio-abc'); process.exit(1); }
const file = path.join(__dirname, '..', 'electron', 'license-keys.json');
const keys = JSON.parse(fs.readFileSync(file, 'utf8'));
if (keys.keys.some((k) => k.id === id)) { console.error('Klucz o identyfikatorze „' + id + '” już istnieje.'); process.exit(1); }
const g = lic.generate(id, label, keys);
keys.keys.push(g.entry);
fs.writeFileSync(file, JSON.stringify(keys, null, 2) + '\n');
console.log('Klucz licencyjny (' + id + '):\n\n  ' + g.key + '\n\nSkrót dopisany do electron/license-keys.json. Klucz zadziała w wersji programu zbudowanej po tej zmianie.');
