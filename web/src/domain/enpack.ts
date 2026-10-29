/* Słownik angielski: spakowany przy budowaniu, rozpakowywany dopiero po wybraniu języka angielskiego
   (interfejs albo dokumenty PDF/Excel). Źródłem tłumaczeń pozostaje en.js. */
import { I18N } from './i18n';
import { unpackJson } from '../lib/inflate';

let loading: Promise<void> | null = null;
export const enReady = () => Object.keys(I18N.EN).length > 0;
export function ensureEn(): Promise<void> {
  if (enReady()) return Promise.resolve();
  // słownik (ok. 50 KB) jest osobnym fragmentem kodu – osoby pracujące po polsku go nie pobierają
  loading = loading || import('virtual:klaps-en').then((m) => unpackJson<{ en: Record<string, string>; plural: Record<string, unknown> }>(m.default)).then((d) => { I18N.add(d.en, d.plural); });
  return loading;
}
