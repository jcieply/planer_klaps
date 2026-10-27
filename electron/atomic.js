/* Bezpieczny zapis plików: najpierw plik tymczasowy (z wymuszonym zapisem na dysk), potem podmiana.
   Przerwany zapis (zamknięcie programu, brak prądu) nigdy nie zostawia połowy pliku. Czysty Node – da się testować bez Electrona. */
const fs = require('fs');
const path = require('path');

function pause(ms) { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (e) { /* brak */ } }

/** zapisuje `data` do `target`; poprzednia wersja trafia do `backup` (jeśli podano) */
function writeAtomic(target, data, backup) {
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const tmp = target + '.' + process.pid + '.tmp';
  const fd = fs.openSync(tmp, 'w');
  try { fs.writeSync(fd, data); fs.fsyncSync(fd); }
  catch (e) { fs.closeSync(fd); try { fs.unlinkSync(tmp); } catch (x) { /* brak */ } throw e; }
  fs.closeSync(fd);
  if (backup && fs.existsSync(target)) { try { fs.copyFileSync(target, backup); } catch (e) { /* kopia jest dodatkiem */ } }
  // Windows: program antywirusowy albo indeksator potrafi na chwilę zablokować plik – ponawiamy
  let err;
  for (let i = 0; i < 5; i++) {
    try { fs.renameSync(tmp, target); return; } catch (e) { err = e; if (!/EPERM|EBUSY|EACCES/.test(e.code || '')) break; pause(40 * (i + 1)); }
  }
  try { fs.unlinkSync(tmp); } catch (e) { /* brak */ }
  throw err;
}
/** odczyt JSON z plikiem zapasowym: gdy główny plik jest uszkodzony, wraca kopia (i odtwarza główny plik) */
function readJsonWithBackup(file, backup) {
  for (const f of [file, backup]) {
    if (!f || !fs.existsSync(f)) continue;
    try {
      const o = JSON.parse(fs.readFileSync(f, 'utf8'));
      if (f !== file) { try { fs.copyFileSync(f, file); } catch (e) { /* brak */ } }
      return { value: o, recovered: f !== file };
    } catch (e) { /* próbujemy kopię */ }
  }
  return null;
}
module.exports = { writeAtomic, readJsonWithBackup };
