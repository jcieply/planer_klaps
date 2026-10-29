/* Lekkie dane o raportach (lista sekcji, nazwy plików) – bez generatorów PDF/XLSX, więc mogą być w głównej paczce. */
import { T, T_ } from './i18n';
import { Core } from './core';

export const SECTIONS: [string, string][] = [
  ['calendar', T_('Kalendarzówka (dni zdjęciowe)')],
  ['board', T_('Rozpiska scen')],
  ['shotlist', T_('Shotlista')],
  ['cast', T_('Obsada')],
  ['crew', T_('Ekipa')],
  ['catering', T_('Catering (diety na dni)')],
  ['sites', T_('Lokacje')],
  ['dood', T_('Day out of Days (DOOD)')],
  ['callsheet', T_('Plany pracy (call sheet)')],
  ['dpr', T_('Raporty dzienne')],
  ['transport', T_('Plan transportów')],
  ['budget', T_('Kosztorys')],
];
export const secLabel = (k: string) => T((SECTIONS.find((s) => s[0] === k) || ['', k])[1]);
export const titleOf = (st: { meta: { title?: string } }) => (st.meta.title || T('Bez tytułu')).trim();
export const slug = (s: string) => String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 50) || 'projekt';
export const fileStem = (st: { meta: { title?: string } }) => `${slug(titleOf(st))}_${Core.todayISO()}`;
