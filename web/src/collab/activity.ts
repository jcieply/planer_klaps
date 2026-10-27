/* Dziennik zmian: krótkie, czytelne opisy „co ktoś zmienił”, liczone z różnicy dwóch stanów projektu.
   Opisy są szyfrowane kluczem projektu tak jak reszta, serwer widzi tylko szyfrogram, autora i czas. */
import { T } from '../domain/i18n';
import type { ProjectState } from '../domain/model';
import { diff, type Op } from './ops';

export interface LogEntry { at: number; items: string[] }
const AREA: Record<string, string> = {
  scenes: 'Scena', shots: 'Ujęcie', days: 'Dzień', cast: 'Postać', crew: 'Ekipa', sites: 'Lokacja', budget: 'Kosztorys', sheets: 'Plan pracy', transport: 'Transport',
  todos: 'Zadanie', comments: 'Komentarz', meta: 'Ustawienia projektu', dpr: 'Raport dzienny', media: 'Plik', catering: 'Catering',
};
const FIELD: Record<string, string> = {
  synopsis: 'opis', notes: 'uwagi', num: 'numer', place: 'miejsce', site: 'obiekt', tod: 'pora dnia', ie: 'wnętrze/plener', eighths: 'długość', cast: 'obsada', text: 'tekst', elements: 'elementy',
  title: 'tytuł', date: 'data', call: 'zbiórka', end: 'koniec', kind: 'rodzaj', sceneIds: 'sceny', rate: 'stawka', phone: 'telefon', email: 'e-mail', est: 'koszt planowany', act: 'koszt rzeczywisty',
  name: 'nazwa', eta: 'czas', lens: 'obiektyw', desc: 'opis', done: 'wykonane', address: 'adres', contract: 'umowa', currency: 'waluta', rows: 'harmonogram',
};
const idOf = (step: string) => (step.startsWith('i:') ? step.slice(2) : step.startsWith('k:') ? step.slice(2) : '');
const lbl = (a: string) => T(AREA[a] || a);
function nameOf(area: string, id: string, a: ProjectState, b: ProjectState): string {
  const f = (st: ProjectState) => {
    if (area === 'scenes') { const s = st.scenes.find((x) => x.id === id); return s ? s.num : ''; }
    if (area === 'shots') { const s = st.shots.find((x) => x.id === id); return s ? s.shot : ''; }
    if (area === 'cast') { const c = st.cast.find((x) => String(x.id) === id); return c ? c.name : ''; }
    if (area === 'crew') { const c = st.crew.find((x) => x.id === id); return c ? [c.first, c.last].filter(Boolean).join(' ') : ''; }
    if (area === 'todos') { const c = (st.todos || []).find((x) => x.id === id); return c ? c.text.slice(0, 30) : ''; }
    if (area === 'sites') return id;
    if (area === 'days') { const d = st.days.find((x) => x.id === id); return d && d.date ? d.date.slice(8, 10) + '.' + d.date.slice(5, 7) : ''; }
    return '';
  };
  return f(b) || f(a);
}
/** opisy zmian między dwoma stanami (bez powtórzeń, najwyżej `max` pozycji) */
export function describeChange(prev: ProjectState, next: ProjectState, max = 8): string[] {
  let ops: Op[];
  try { ops = diff(prev, next); } catch { return []; }
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (s: string) => { if (!seen.has(s)) { seen.add(s); out.push(s); } };
  for (const op of ops) {
    const area = idOf(op.p[0] || '');
    if (!area) continue;
    const base = lbl(area);
    let who = '', verb = '', field = '';
    if (op.t === 'ins') { who = nameOf(area, String(op.v.id), prev, next); verb = T('dodano'); }
    else if (op.t === 'rm') { who = nameOf(area, op.id, prev, next); verb = T('usunięto'); }
    else if (op.t === 'mv') { who = nameOf(area, op.id, prev, next); verb = T('zmieniono kolejność'); }
    else {
      verb = T('zmieniono');
      if (op.p.length > 1 && (op.p[1] || '').startsWith('i:')) { who = nameOf(area, idOf(op.p[1]), prev, next); field = idOf(op.p[2] || ''); }
      else if (area === 'sites' || area === 'sheets' || area === 'dpr') { who = area === 'sites' ? idOf(op.p[1] || '') : nameOf('days', idOf(op.p[1] || ''), prev, next); field = idOf(op.p[2] || ''); }
      else field = idOf(op.p[1] || '');
    }
    // pozycje budżetu i inne tablice wewnątrz obszaru: opis ogólny
    if ((op.t === 'ins' || op.t === 'rm' || op.t === 'mv') && op.p.length > 1) { who = ''; }
    const f = field ? ` (${T(FIELD[field] || field)})` : '';
    add(`${base}${who ? ' ' + who : ''}: ${verb}${f}`);
    if (out.length >= max) break;
  }
  return out;
}
