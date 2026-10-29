/* Klucz licencyjny w przeglądarce / na Androidzie: ta sama lista skrótów co w programie na komputer (electron/license-keys.json)
   i ta sama normalizacja co electron/license.js. Sprawdzanie przez Web Crypto (SHA-256). */
import KEYS from '../../../electron/license-keys.json';

export const LICENSE_FORMAT = /^KLAPS-\d{4}-[A-Z0-9]{4}-[A-Z]{2,8}$/;
export type LicenseCheck = { ok: true; id: string; hash: string } | { ok: false; reason: 'empty' | 'format' | 'unknown' };

export function normalizeKey(key: string): string {
  return String(key == null ? '' : key).toUpperCase().replace(/[‐-―−_]/g, '-').replace(/\s+/g, '').replace(/-+/g, '-').replace(/^-|-$/g, '');
}
async function sha256Hex(s: string): Promise<string> {
  const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  return Array.from(d, (b) => b.toString(16).padStart(2, '0')).join('');
}
export const knownHash = (hash: string) => KEYS.keys.find((k) => k.hash === hash) || null;
export async function checkKey(key: string): Promise<LicenseCheck> {
  const n = normalizeKey(key);
  if (!n) return { ok: false, reason: 'empty' };
  if (!LICENSE_FORMAT.test(n)) return { ok: false, reason: 'format' };
  const hash = await sha256Hex(KEYS.salt + ':' + n);
  const k = knownHash(hash);
  return k ? { ok: true, id: k.id, hash } : { ok: false, reason: 'unknown' };
}
export const keyHint = (key: string) => { const n = normalizeKey(key); return n.slice(0, 11) + '…' + n.slice(-4); };
