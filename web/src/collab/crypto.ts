/* Szyfrowanie end-to-end projektów w chmurze.
 *  - klucz projektu K (AES-GCM 256) powstaje u właściciela i NIGDY nie trafia na serwer;
 *  - kod zaproszenia = sekret (serwer zna tylko jego skrót) + klucz K, więc kto ma kod, ma dostęp do treści;
 *  - każda paczka zmian / migawka / zdjęcie jest szyfrowana osobno ze świeżym IV. */
const subtle = (): SubtleCrypto => globalThis.crypto.subtle;
const rnd = (n: number): Uint8Array => globalThis.crypto.getRandomValues(new Uint8Array(n));
const te = new TextEncoder();
const td = new TextDecoder();

export function b64(u: Uint8Array): string {
  let s = '';
  for (let n = 0; n < u.length; n += 0x8000) s += String.fromCharCode(...u.subarray(n, n + 0x8000));
  return btoa(s);
}
export function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let n = 0; n < bin.length; n++) u[n] = bin.charCodeAt(n);
  return u;
}
const A32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function b32(u: Uint8Array): string {
  let bits = 0, val = 0, out = '';
  for (const byte of u) {
    val = (val << 8) | byte; bits += 8;
    while (bits >= 5) { out += A32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += A32[(val << (5 - bits)) & 31];
  return out;
}
export function unb32(s: string): Uint8Array {
  let bits = 0, val = 0;
  const out: number[] = [];
  for (const ch of s.toUpperCase()) {
    const v = A32.indexOf(ch);
    if (v < 0) continue;
    val = (val << 5) | v; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Uint8Array.from(out);
}

export type ProjectKey = CryptoKey;
export async function newKeyBytes(): Promise<Uint8Array> { return rnd(32); }
export async function importKey(raw: Uint8Array): Promise<ProjectKey> {
  return subtle().importKey('raw', raw as BufferSource, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}
export async function encryptBytes(key: ProjectKey, data: Uint8Array): Promise<string> {
  const iv = rnd(12);
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv); out.set(ct, 12);
  return b64(out);
}
export async function decryptBytes(key: ProjectKey, s: string): Promise<Uint8Array> {
  const u = unb64(s);
  if (u.length < 29) throw new Error('klaps:bad_cipher');
  return new Uint8Array(await subtle().decrypt({ name: 'AES-GCM', iv: u.subarray(0, 12) as BufferSource }, key, u.subarray(12) as BufferSource));
}
/* Format: bajt 0 = JSON, bajt 1 = JSON skompresowany gzip (dla większych paczek), potem szyfrowanie. */
async function gz(u: Uint8Array, dir: 'c' | 'd'): Promise<Uint8Array> {
  const s = dir === 'c' ? new CompressionStream('gzip') : new DecompressionStream('gzip');
  const w = s.writable.getWriter();
  void w.write(u as BufferSource).then(() => w.close());
  return new Uint8Array(await new Response(s.readable).arrayBuffer());
}
export async function encryptJson(key: ProjectKey, v: unknown): Promise<string> {
  let raw: Uint8Array = te.encode(JSON.stringify(v));
  let flag = 0;
  if (raw.length > 1024 && typeof CompressionStream !== 'undefined') { raw = await gz(raw, 'c'); flag = 1; }
  const out = new Uint8Array(raw.length + 1);
  out[0] = flag; out.set(raw, 1);
  return encryptBytes(key, out);
}
export async function decryptJson<T = unknown>(key: ProjectKey, s: string): Promise<T> {
  const u = await decryptBytes(key, s);
  const body = u[0] === 1 ? await gz(u.subarray(1), 'd') : u.subarray(1);
  return JSON.parse(td.decode(body)) as T;
}

/* ---------- kod zaproszenia ---------- */
export interface Invite { secret: string; keyBytes: Uint8Array }
const PREFIX = 'KLAPS-';
export async function makeInvite(keyBytes: Uint8Array): Promise<{ code: string; secret: string }> {
  const secretBytes = rnd(16);
  const secret = b32(secretBytes);
  const all = new Uint8Array(48);
  all.set(secretBytes); all.set(keyBytes, 16);
  return { code: formatCode(all), secret };
}
export function formatCode(all: Uint8Array): string {
  const s = b32(all);
  return PREFIX + (s.match(/.{1,5}/g) || []).join('-');
}
/** zwraca null dla błędnego kodu (zła długość / znaki) */
export function parseInvite(code: string): Invite | null {
  const s = String(code || '').trim().toUpperCase().replace(/^KLAPS-?/, '').replace(/[^A-Z2-7]/g, '');
  const bytes = unb32(s);
  if (bytes.length < 48) return null;
  return { secret: b32(bytes.subarray(0, 16)), keyBytes: bytes.slice(16, 48) };
}
