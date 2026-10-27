// @ts-nocheck
/* Moduł przeniesiony z wersji 1.x (logika bez zmian). */
import { T } from './i18n';
/* ===== SZYFROWANIE END-TO-END (Web Crypto): AES-256-GCM, klucz z hasła przez PBKDF2-SHA-256 =====
   Koperta: KLAPS-E2E1:<sól b64>:<iteracje>:<iv b64>:<szyfrogram b64>. Sól i liczba iteracji są w każdej kopercie,
   więc dowolny fragment projektu (plan, tekst scenariusza, mapka) da się odszyfrować samym hasłem na każdym urządzeniu.
   Hasło nie jest nigdzie zapisywane; klucz żyje tylko w pamięci do zamknięcia aplikacji albo zablokowania projektu. */
const Vault = (() => {
  const PFX = 'KLAPS-E2E1';
  const ITER = 600000;
  const te = new TextEncoder(), td = new TextDecoder();
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (s) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
  const subtle = () => (typeof crypto !== 'undefined' && crypto.subtle) || null;
  const available = () => !!subtle();
  const isEnc = (s) => typeof s === 'string' && s.startsWith(PFX + ':');
  const head = (env) => { const p = String(env).split(':'); return { salt: p[1], iter: +p[2] || ITER, iv: p[3], ct: p[4] }; };
  const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)));

  /** klucz AES-GCM z hasła (nieeksportowalny) */
  async function derive(password, salt, iter) {
    if (!available()) throw new Error(T('Ta przeglądarka nie obsługuje szyfrowania (Web Crypto). Otwórz aplikację przez https albo w aplikacji Klaps.'));
    const base = await subtle().importKey('raw', te.encode(String(password).normalize('NFC')), 'PBKDF2', false, ['deriveKey']);
    return subtle().deriveKey({ name: 'PBKDF2', salt: unb64(salt), iterations: iter || ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  /** k = { key, salt, iter } */
  async function seal(k, plain, aad) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv, additionalData: te.encode(aad || '') }, k.key, te.encode(plain)));
    return [PFX, k.salt, k.iter, b64(iv), b64(ct)].join(':');
  }
  async function open(k, env, aad) {
    const h = head(env);
    try {
      const pt = await subtle().decrypt({ name: 'AES-GCM', iv: unb64(h.iv), additionalData: te.encode(aad || '') }, k.key, unb64(h.ct));
      return td.decode(pt);
    } catch (e) {
      const err = new Error(T('Nieprawidłowe hasło albo uszkodzone dane.')); err.badKey = true; throw err;
    }
  }
  /** nowy klucz do zaszyfrowania projektu */
  async function create(password) { const salt = newSalt(); return { key: await derive(password, salt, ITER), salt, iter: ITER }; }
  /** klucz do istniejącej koperty (sprawdza hasło, odszyfrowując kopertę) */
  async function unlock(password, env, aad) {
    const h = head(env);
    const k = { key: await derive(password, h.salt, h.iter), salt: h.salt, iter: h.iter };
    await open(k, env, aad);
    return k;
  }
  /** ocena siły hasła 0–4 (bez wysyłania gdziekolwiek) */
  function strength(pw) {
    pw = String(pw || '');
    if (pw.length < 8) return 0;
    let classes = 0;
    if (/[a-ząćęłńóśźż]/.test(pw)) classes++;
    if (/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(pw)) classes++;
    if (/\d/.test(pw)) classes++;
    if (/[^\w\sąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(pw)) classes++;
    let s = 1 + (pw.length >= 12 ? 1 : 0) + (pw.length >= 16 ? 1 : 0) + (classes >= 3 ? 1 : 0);
    if (/^(.)\1+$/.test(pw) || /^(1234|qwer|haslo|hasło|password)/i.test(pw)) s = 1;
    return Math.min(4, s);
  }
  return { PFX, ITER, available, isEnc, head, derive, create, unlock, seal, open, strength };
})();
export { Vault };
