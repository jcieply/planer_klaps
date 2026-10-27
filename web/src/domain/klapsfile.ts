/* Format pliku projektu .klaps – archiwum ZIP:
     mimetype          application/vnd.klaps+zip (pierwszy, bez kompresji – rozpoznawanie pliku)
     manifest.json     format, wersja, aplikacja, data, czy zaszyfrowany, tytuł i liczby (tylko w jawnym)
     project.json      plan projektu (bez tekstu scenariusza i mapek)
     script.json       teksty scen
     media.json        opis mapek (nazwa, wymiary, typ) bez danych
     media/<id>.jpg    mapki jako zwykłe pliki obrazów (bez base64 – mniejszy plik)
   Wariant zaszyfrowany (E2E): manifest bez tytułu i liczb, a dane w encrypted/plan.e2e, encrypted/script.e2e,
   encrypted/media.json (koperty AES-GCM, te same co w zapisie projektu). */
import { Zip } from './zip';
import { Vault } from './vault';
import { T } from './i18n';
import type { Media, ProjectState } from './model';
import type { Raw } from './store';

export const KLAPS_MIME = 'application/vnd.klaps+zip';
export const KLAPS_EXT = 'klaps';
export const FORMAT_VERSION = 1;
export interface Manifest { format: 'klaps'; version: number; app: string; created: string; encrypted: boolean; title?: string; scenes?: number; days?: number; media?: number }
export type KlapsContent = { kind: 'plain'; st: ProjectState; manifest: Manifest } | { kind: 'encrypted'; raw: Raw; manifest: Manifest };

const dec = new TextDecoder();
const b64ToBytes = (s: string) => { const bin = atob(s); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
const bytesToB64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, Array.from(u.subarray(i, i + 0x8000))); return btoa(s); };
const extOf = (mime?: string) => (mime === 'image/png' ? 'png' : 'jpg');
const safeId = (id: string) => id.replace(/[^\w-]/g, '_');

/** zapis jawnego projektu (parts = wynik Store.split) */
export async function writePlain(st: ProjectState, parts: Raw): Promise<Uint8Array> {
  const media: Record<string, Media> = st.media || {};
  const index: Record<string, Omit<Media, 'data'> & { file: string }> = {};
  const files: { name: string; data: string | Uint8Array }[] = [];
  for (const [id, m] of Object.entries(media)) {
    const file = `media/${safeId(id)}.${extOf(m.mime)}`;
    index[id] = { mime: m.mime || 'image/jpeg', w: m.w, h: m.h, name: m.name || '', file };
    files.push({ name: file, data: b64ToBytes(m.data) });
  }
  const manifest: Manifest = { format: 'klaps', version: FORMAT_VERSION, app: 'Klaps Planer 2', created: new Date().toISOString(), encrypted: false, title: st.meta.title || '', scenes: st.scenes.length, days: st.days.filter((d) => d.kind === 'shoot').length, media: files.length };
  return Zip.write([
    { name: 'mimetype', data: KLAPS_MIME },
    { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
    { name: 'project.json', data: parts.plan },
    { name: 'script.json', data: parts.script },
    { name: 'media.json', data: JSON.stringify(index) },
    ...files,
  ]);
}
/** zapis zaszyfrowanego projektu (raw = zaszyfrowane części) */
export async function writeEncrypted(raw: Raw): Promise<Uint8Array> {
  const manifest: Manifest = { format: 'klaps', version: FORMAT_VERSION, app: 'Klaps Planer 2', created: new Date().toISOString(), encrypted: true };
  return Zip.write([
    { name: 'mimetype', data: KLAPS_MIME },
    { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
    { name: 'encrypted/plan.e2e', data: raw.plan },
    { name: 'encrypted/script.e2e', data: raw.script },
    { name: 'encrypted/media.json', data: raw.media },
  ]);
}

/** czy bajty wyglądają na plik .klaps (ZIP z wpisem mimetype) */
export function isKlaps(bytes: Uint8Array) {
  return bytes.length > 60 && bytes[0] === 0x50 && bytes[1] === 0x4b && dec.decode(bytes.subarray(30, 38)) === 'mimetype' && dec.decode(bytes.subarray(38, 38 + KLAPS_MIME.length)) === KLAPS_MIME;
}

/** odczyt pliku .klaps; join = Store.join (składa projekt z części) */
export async function readKlaps(bytes: Uint8Array, join: (plan: string, script: string, media: string) => ProjectState): Promise<KlapsContent> {
  let z: Awaited<ReturnType<typeof Zip.read>>;
  try { z = Zip.read(bytes); } catch { throw new Error(T('To nie jest plik projektu Klaps')); }
  const mt = await z.text('mimetype');
  if (mt !== KLAPS_MIME) throw new Error(T('To nie jest plik projektu Klaps'));
  const manifest = JSON.parse((await z.text('manifest.json')) || '{}') as Manifest;
  if (manifest.format !== 'klaps') throw new Error(T('To nie jest plik projektu Klaps'));
  if ((manifest.version || 0) > FORMAT_VERSION) throw new Error(T('Ten plik pochodzi z nowszej wersji Klapsa. Zaktualizuj aplikację.'));
  if (manifest.encrypted) {
    const raw: Raw = { plan: (await z.text('encrypted/plan.e2e')) || '', script: (await z.text('encrypted/script.e2e')) || '', media: (await z.text('encrypted/media.json')) || '{}' };
    if (!Vault.isEnc(raw.plan)) throw new Error(T('Plik jest uszkodzony (brak zaszyfrowanych danych).'));
    return { kind: 'encrypted', raw, manifest };
  }
  const plan = await z.text('project.json');
  if (!plan) throw new Error(T('Plik jest uszkodzony (brak project.json).'));
  const index = JSON.parse((await z.text('media.json')) || '{}') as Record<string, Omit<Media, 'data'> & { file: string }>;
  const media: Record<string, Media> = {};
  for (const [id, m] of Object.entries(index)) {
    const data = await z.get(m.file);
    if (data) media[id] = { mime: m.mime, w: m.w, h: m.h, name: m.name, data: bytesToB64(data) };
  }
  const st = join(plan, (await z.text('script.json')) || '{}', JSON.stringify(media));
  return { kind: 'plain', st, manifest };
}
