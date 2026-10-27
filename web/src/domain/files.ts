/* Pliki: odczyt tekstu, skrypty na żądanie, obrazy (mapki), zapis do pobrania, PDF i DOCX scenariusza. */
import { T } from './i18n';
import { Zip } from './zip';

declare global {
  interface Window {
    claude?: { use: (name: string) => Promise<any> };
    pdfjsLib?: any;
    XLSX?: any;
  }
}

/** tekst z pliku: UTF-8, a gdy się nie da – Windows-1250 (polskie pliki z Excela/Worda) */
export function decodeText(buf: ArrayBuffer | Uint8Array): string {
  const u = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u).replace(/^﻿/, ''); }
  catch { try { return new TextDecoder('windows-1250').decode(u); } catch { return new TextDecoder('latin1').decode(u); } }
}

/** skrypt z CDN ładowany przy pierwszym użyciu (pdf.js, czytnik XLS) */
export function loadScript(src: string): Promise<void> {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => res();
    s.onerror = () => rej(new Error(T('Nie udało się wczytać modułu do czytania PDF z internetu. Wklej tekst scenariusza albo wczytaj plik FDX, DOCX lub TXT.')));
    document.head.appendChild(s);
  });
}

export interface ImageData { data: string; w: number; h: number; name: string; mime?: string }
/** obraz (mapka) zmniejszony do 1800 px i zapisany jako JPEG */
export async function loadImageFile(file: File): Promise<ImageData> {
  if (!/^image\/(png|jpe?g)$/i.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) throw new Error(T('Wybierz plik JPG albo PNG.'));
  if (file.size > 25 * 1024 * 1024) throw new Error(T('Plik jest za duży (ponad 25 MB).'));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(T('Nie udało się odczytać obrazu.'))); i.src = url; });
    const MAX = 1800;
    const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), w, h, name: file.name };
  } finally { URL.revokeObjectURL(url); }
}

export const MIME = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json', klaps: 'application/vnd.klaps+zip' } as const;

/** zapis pliku: aplikacja na komputer → możliwość „downloads” artefaktu → zwykłe pobranie w przeglądarce */
export async function saveFile(name: string, data: Uint8Array | string, mime?: string): Promise<'saved' | 'declined'> {
  if (window.klapsDesktop && window.klapsDesktop.saveFile) {
    const r = await window.klapsDesktop.saveFile(name, data);
    return r && r.canceled ? 'declined' : 'saved';
  }
  let dl: any = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data }); return 'saved'; }
    catch (e: any) {
      if (e && e.code === 'declined') return 'declined';
      if (!(e && ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code))) throw new Error(e && e.message ? e.message : T('Nie udało się zapisać pliku'));
    }
  }
  const blob = new Blob([data as BlobPart], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  return 'saved';
}

/* ---------- scenariusz: PDF (pdf.js na żądanie) i DOCX ---------- */
const PDFJS = (typeof window !== 'undefined' && window.klapsDesktop && window.klapsDesktop.pdfjsBase) || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
async function ensurePdfJs() {
  if (window.pdfjsLib) return;
  await loadScript(PDFJS + 'pdf.min.js');
  if (!window.pdfjsLib) throw new Error(T('Moduł PDF nie został załadowany'));
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
}
export async function extractPdf(buf: ArrayBuffer, progress?: (msg: string) => void) {
  await ensurePdfJs();
  const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages: any[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    if (progress) progress(T('Czytam stronę {i} z {n}…', { i, n: doc.numPages }));
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    pages.push({ width: vp.width, height: vp.height, items: tc.items.filter((it: any) => it.str !== undefined).map((it: any) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) })) });
  }
  const chars = pages.reduce((a, p) => a + p.items.reduce((b: number, it: any) => b + it.s.length, 0), 0);
  if (chars < 50) throw new Error(T('Ten PDF nie zawiera tekstu (to prawdopodobnie skan). Użyj PDF-a z warstwą tekstową albo wklej tekst scenariusza.'));
  return pages;
}
export async function docxXml(buf: ArrayBuffer): Promise<string> {
  const z = Zip.read(new Uint8Array(buf));
  const xml = await z.text('word/document.xml');
  if (!xml) throw new Error(T('W pliku nie znaleziono treści dokumentu Word'));
  return xml;
}
