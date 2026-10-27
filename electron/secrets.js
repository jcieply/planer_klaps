/* Sekrety na tym komputerze (klucze projektów chmurowych, sesja logowania). Wartości są szyfrowane mechanizmem systemu
   (Keychain / DPAPI przez Electron safeStorage). Gdy system go nie udostępnia (np. Linux bez pęku kluczy), zapisujemy
   plik z uprawnieniami 0600 i oznaczamy to flagą `secure:false`. Czysty Node + wstrzykiwany szyfr – testowalny. */
const path = require('path');
const { writeAtomic, readJsonWithBackup } = require('./atomic');

const NAME = /^[A-Za-z0-9_.:-]{1,120}$/;
function open(dir, cipher) {
  const file = path.join(dir, 'secrets.json');
  const bak = path.join(dir, 'secrets.bak');
  const secure = !!(cipher && cipher.available());
  const load = () => { const r = readJsonWithBackup(file, bak); return r && r.value && typeof r.value === 'object' && r.value.items ? r.value : { v: 1, items: {} }; };
  const save = (o) => { writeAtomic(file, JSON.stringify(o), bak); try { require('fs').chmodSync(file, 0o600); } catch (e) { /* Windows */ } };
  const check = (n) => { if (typeof n !== 'string' || !NAME.test(n)) throw new Error('Niepoprawna nazwa sekretu'); };
  return {
    secure,
    get(name) {
      check(name);
      const raw = load().items[name];
      if (typeof raw !== 'string') return null;
      if (raw.startsWith('e:')) { try { return cipher.decrypt(Buffer.from(raw.slice(2), 'base64')); } catch (e) { return null; } }
      return raw.slice(2);
    },
    set(name, value) {
      check(name);
      if (typeof value !== 'string' || value.length > 20000) throw new Error('Niepoprawna wartość sekretu');
      const o = load();
      o.items[name] = secure ? 'e:' + cipher.encrypt(value).toString('base64') : 'p:' + value;
      save(o);
      return true;
    },
    remove(name) { check(name); const o = load(); if (name in o.items) { delete o.items[name]; save(o); } return true; },
    names() { return Object.keys(load().items); },
  };
}
module.exports = { open, NAME };
