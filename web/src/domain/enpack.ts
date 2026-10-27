/* Słownik angielski: spakowany przy budowaniu, rozpakowywany dopiero po wybraniu języka angielskiego
   (interfejs albo dokumenty PDF/Excel). Źródłem tłumaczeń pozostaje en.js. */
import packed from 'virtual:klaps-en';
import { I18N } from './i18n';
import { unpackJson } from '../lib/inflate';

let loading: Promise<void> | null = null;
export const enReady = () => Object.keys(I18N.EN).length > 0;
export function ensureEn(): Promise<void> {
  if (enReady()) return Promise.resolve();
  loading = loading || unpackJson<{ en: Record<string, string>; plural: Record<string, unknown> }>(packed).then((d) => { I18N.add(d.en, d.plural); });
  return loading;
}
