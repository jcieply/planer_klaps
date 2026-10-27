/* Operacje na projekcie używane w kilku widokach (wywoływane wewnątrz mutate). */
import { Core } from '../domain/core';
import type { ProjectState, SheetRow } from '../domain/model';

/** dodaje sceny do dnia ('__new' tworzy nowy dzień zdjęciowy, '__pool' zdejmuje z planu) */
export function moveScenesToDay(st: ProjectState, ids: string[], target: string, index?: number | null): string | null {
  if (!ids.length) return null;
  if (target === '__pool' || target === 'pool' || target === '') { Core.unassign(st, ids); return 'pool'; }
  let day: any;
  if (target === '__new') {
    day = Core.addDay(st, 'shoot');
    const first = st.scenes.find((s) => s.id === ids[0]);
    if (first && Core.todClass(first.tod) === 'night') day.call = st.meta.callNight;
  } else day = st.days.find((d) => d.id === target);
  if (!day || day.kind !== 'shoot') return null;
  Core.assign(st, ids, day.id, index);
  return day.id;
}
/** wstawia wiersz harmonogramu: 'scene' = za ujęciami tej samej sceny, 'beforeEnd' = przed końcowym „Koniec zdjęć”, 'end' = na koniec */
export function insertRow(st: ProjectState, dayId: string, row: SheetRow, where: 'scene' | 'beforeEnd' | 'end') {
  const rows: SheetRow[] = Core.activeRows(st, dayId);
  let at = rows.length;
  if (where === 'scene' && row.sceneId) {
    let k = -1; rows.forEach((r, i) => { if (r.sceneId === row.sceneId && (r.kind === 'shot' || r.kind === 'scene')) k = i; });
    if (k >= 0) { rows.splice(k + 1, 0, row); return; }
  }
  if (where !== 'end') { while (at > 0 && rows[at - 1].kind === 'custom' && !(+(rows[at - 1].dur || 0) > 0)) at--; }
  rows.splice(at, 0, row);
}
export function filteredScenes(st: ProjectState, f: { q: string; ie: string; tod: string; cast: string; site: string; plan: string }) {
  const idx = Core.scheduleIndex(st);
  const q = f.q.trim().toLowerCase();
  const cmap = Core.castMap(st);
  return st.scenes.filter((s) => {
    if (f.ie && (f.ie === 'EXT' ? !(s.ie === 'EXT' || s.ie === 'INT/EXT') : f.ie === 'INT' ? !(s.ie === 'INT' || s.ie === 'INT/EXT') : false)) return false;
    if (f.tod && s.tod !== f.tod) return false;
    if (f.cast && !s.cast.includes(+f.cast)) return false;
    if (f.site && (s.site || s.place) !== f.site) return false;
    if (f.plan === 'planned' && !idx.has(s.id)) return false;
    if (f.plan === 'unplanned' && idx.has(s.id)) return false;
    if (q) {
      const hay = (s.num + ' ' + s.place + ' ' + s.site + ' ' + s.synopsis + ' ' + s.notes + ' ' + s.cast.map((id) => (cmap.get(id) || {}).name || '').join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
