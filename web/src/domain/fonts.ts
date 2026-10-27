/* Fonty do PDF (Liberation Sans, SIL OFL 1.1, podzbiór łaciński) – rozpakowywane przy pierwszym eksporcie. */
import packed from 'virtual:klaps-fonts';
import { unpackBytes } from '../lib/inflate';

export const KLAPS_FONTS: { regular: Uint8Array | null; bold: Uint8Array | null } = { regular: null, bold: null };
let loading: Promise<void> | null = null;
export function loadFonts(): Promise<void> {
  if (KLAPS_FONTS.regular) return Promise.resolve();
  loading = loading || unpackBytes(packed.b64).then((all) => {
    KLAPS_FONTS.regular = all.subarray(0, packed.regular);
    KLAPS_FONTS.bold = all.subarray(packed.regular, packed.regular + packed.bold);
  });
  return loading;
}
