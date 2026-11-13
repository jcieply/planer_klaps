/* Klucz licencyjny na Androidzie / w przeglądarce: ta sama lista skrótów (electron/license-keys.json) i ta sama normalizacja
   co electron/license.js. Dowodem licencji jest sam klucz, sprawdzany przy każdym uruchomieniu (Web Crypto, SHA-256). */
import KEYS from '../../../electron/license-keys.json';

export const LICENSE_FORMAT = /^KLAPS(-[0-9A-HJKMNP-TV-Z]{5}){4}$/;
export interface KeyList { salt: string; keys: { id: string; label?: string; hash: string }[] }
export type LicenseCheck = { ok: true; id: string; label: string } | { ok: false; reason: 'empty' | 'format' | 'unknown' };

export function normalizeKey(key: string): string {
  const s = String(key == null ? '' : key).toUpperCase().replace(/[‐-―−_]/g, '-').replace(/\s+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
  const m = /^KLAPS-?(.*)$/.exec(s);
  if (!m) return s;
  const body = m[1].replace(/-/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/U/g, 'V');
  return body.length === 20 ? 'KLAPS-' + body.match(/.{5}/g)!.join('-') : s;
}
async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
export async function checkKey(key: string, keys: KeyList = KEYS as KeyList): Promise<LicenseCheck> {
  const n = normalizeKey(key);
  if (!n) return { ok: false, reason: 'empty' };
  if (!LICENSE_FORMAT.test(n)) return { ok: false, reason: 'format' };
  const hash = await sha256Hex(keys.salt + ':' + n);
  const k = keys.keys.find((x) => x.hash === hash);
  return k ? { ok: true, id: k.id, label: k.label || '' } : { ok: false, reason: 'unknown' };
}
export const keyHint = (key: string) => { const n = normalizeKey(key); return n.slice(0, 11) + '…' + n.slice(-5); };
