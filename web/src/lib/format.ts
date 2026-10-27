/* Pomocnicze formatowanie i odmiana. */
import { Core } from '../domain/core';
import { T } from '../domain/i18n';
import type { Day, ProjectState, Scene } from '../domain/model';

/** polska odmiana liczebnikowa: 1 scena, 2 sceny, 5 scen (po angielsku 1 scene, 2 scenes) */
export const pl = (n: number, one: string, few: string, many: string): string => Core.pl(n, one, few, many);
export const plN = (n: number, one: string, few: string, many: string) => `${n} ${pl(n, one, few, many)}`;

export function parseEighths(str: string): number | null {
  const s = String(str).trim().replace(',', '.');
  if (!s) return null;
  let m = s.match(/^(\d+)?\s*(?:(\d)\s*\/\s*8)?$/);
  if (m && (m[1] || m[2])) return (m[1] ? +m[1] * 8 : 0) + (m[2] ? +m[2] : 0);
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Math.round(parseFloat(m[1]) * 8);
  return null;
}
/** „7.30”, „730”, „7” → „07:30”; pusty → ''; błędny → null */
export function normTime(v: string): string | null {
  const s = String(v || '').trim().replace(/[.,;]/g, ':');
  if (!s) return '';
  let m: RegExpExecArray | string[] | null = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (!m) { m = /^(\d{1,2})(\d{2})$/.exec(s) || /^(\d{1,2})$/.exec(s); if (m && !m[2]) m = [s, m[1], '0']; }
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
}
export const sceneLabel = (sc: Scene) => `${sc.num} ${Core.IE_LABEL[sc.ie] || ''} ${sc.place || sc.site || ''}`.trim();
export const sitesList = (st: ProjectState): string[] =>
  [...new Set(st.scenes.map((s) => s.site || s.place).concat(Object.keys(st.sites || {}).filter((k) => st.sites[k] && st.sites[k].manual)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
export function dayLabel(d: Day, nums: Map<string, number | null>): string {
  const dw = d.date ? Core.DAYS_SHORT[Core.dow(d.date)] || '' : '';
  if (d.kind === 'off') return `${T('Dzień wolny')} (${Core.fmtDM(d.date)})`;
  if (d.kind !== 'shoot') return `${Core.dayTitle(d, nums)} · ${Core.fmtDM(d.date)} ${dw}`;
  return `D${nums.get(d.id)} · ${Core.fmtDM(d.date)} ${dw}`;
}
export const workOptions = (st: ProjectState): [string, string][] => { const nums = Core.dayNumbers(st); return st.days.filter((d) => d.kind !== 'off').map((d) => [d.id, dayLabel(d, nums)]); };
export const mediaSrc = (st: ProjectState, id: string) => { const m = st.media[id]; return m ? 'data:' + (m.mime || 'image/jpeg') + ';base64,' + m.data : ''; };
export const kcls = (sc: Scene) => 'k-' + Core.stripKey(sc);
