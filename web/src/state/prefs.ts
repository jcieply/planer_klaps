/* Preferencje urządzenia: język, motyw, przypięte menu. */
import { create } from 'zustand';
import { I18N } from '../domain/i18n';
import { ensureEn } from '../domain/enpack';

export type Theme = 'auto' | 'light' | 'dark';
export interface Prefs { lang: 'pl' | 'en'; theme: Theme; sidePin: boolean }
const KEY = 'klaps.prefs';
function read(): Prefs {
  const p: Prefs = { lang: 'pl', theme: 'dark', sidePin: false };
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (o.lang === 'en' || o.lang === 'pl') p.lang = o.lang;
    if (['auto', 'light', 'dark'].includes(o.theme)) p.theme = o.theme;
    p.sidePin = o.sidePin === true;
  } catch { /* domyślne */ }
  return p;
}
function apply(p: Prefs) {
  I18N.lang = p.lang;
  const de = document.documentElement;
  de.lang = p.lang;
  if (p.theme === 'auto') de.removeAttribute('data-theme'); else de.setAttribute('data-theme', p.theme);
}
interface PrefsStore extends Prefs { setPrefs: (p: Partial<Prefs>) => void }
export const usePrefs = create<PrefsStore>()((set, get) => {
  const init = read();
  apply(init);
  return {
    ...init,
    setPrefs: (p) => {
      const next = { lang: get().lang, theme: get().theme, sidePin: get().sidePin, ...p };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* brak */ }
      // słownik angielski rozpakowuje się przy pierwszym przełączeniu (kilka milisekund)
      const done = () => { apply(next); set(next); };
      if (next.lang === 'en') void ensureEn().then(done); else done();
    },
  };
});
export const isDark = (theme: Theme) => theme === 'dark' || (theme === 'auto' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
