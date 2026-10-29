/* Model projektu (TypeScript). Walidacja plików (Zod) jest w schema.ts – ładowana dopiero przy imporcie. */

export type IE = 'INT' | 'EXT' | 'INT/EXT' | '';
export type TOD = 'DAY' | 'NIGHT' | 'DAWN' | 'DUSK' | string;
export type DayKind = 'shoot' | 'off' | 'travel' | 'prelight' | 'build';

export interface Scene {
  id: string; num: string; ie: IE; place: string; site: string; tod: TOD; eighths: number; page: number | null;
  synopsis: string; notes: string; cast: number[]; elements: Record<string, string[]>; text: string; heading: string; manualCast?: number[]; rev?: string;
}
export interface CastMember {
  id: number; name: string; actor: string; phone: string; email: string; contract: string; rate: string;
  lodging: string; diet: string; dietNote: string; transport: string; notes: string;
}
export interface CrewMember {
  id: string; first: string; last: string; dept: string; role: string; phone: string; email: string; contract: string; rate: string;
  lodging: string; dietType: string; dietNote: string; transport: string; notes: string; skip: string[]; extra: string[];
}
export interface Day { id: string; kind: DayKind; date: string; call: string; end: string; site: string; note: string; sceneIds: string[] }
export interface Geo { lat: number; lon: number; label: string }
export interface Site { realName: string; address: string; owner: string; ownerContact: string; power: string; toilet: string; camp: string; contract: string; rate: string; notes: string; manual?: boolean; geo?: Geo | null; geoQuery?: string }
export interface SheetRow {
  id: string; kind: 'custom' | 'scene' | 'shot'; sceneId: string; shotId: string; fix: string;
  dur: number | null; prep: number | null; num: string | null; shot: string | null; desc: string | null; cast: string | null; camera: string | null; notes: string;
}
export interface Sheet {
  crewCall: string; sunrise: string; sunset: string; weather: string; hospital: string; cameraNotes: string; locations: string | null;
  transportNote: string; notes: string; mode?: 'calendar' | 'shots'; rows: SheetRow[]; srows?: SheetRow[];
  cast: Record<string, { call?: string; makeup?: string; onset?: string; note?: string }>; contacts: { role: string; name: string; phone: string }[];
  maps: { id: string; media: string; caption?: string }[];
  synced?: string[]; v?: number; wx?: Weather | null;
}
/** prognoza pogody dnia (Open-Meteo) */
export interface Weather { at: number; date: string; place: string; lat: number; lon: number; code: number | null; tmin: number | null; tmax: number | null; pp: number | null; psum: number | null; wind: number | null; gust: number | null; sunrise: string; sunset: string; text: string }

/* ---------- raport dzienny (Daily Production Report) ---------- */
export type ShotStatus = '' | 'done' | 'part' | 'none';
export interface DprScene { status: ShotStatus; eighths: number | null; setups: string; note: string }
export interface DprCast { arrive?: string; onSet?: string; wrap?: string; note?: string }
export interface Dpr {
  planned: string[]; crewCall: string; firstShot: string; lunchFrom: string; lunchTo: string; camWrap: string; crewWrap: string;
  scenes: Record<string, DprScene>; cast: Record<string, DprCast>; extras: string; delays: string; incidents: string; equipment: string; notes: string;
  closed: boolean; closedAt?: number | null;
}
export interface Shot { id: string; sceneId: string; shot: string; type: string; desc: string; lens: string; grip: string; eta: string; cast: string; site: string }
export interface Fx { date: string; src: string; pln: Record<string, number>; manual: boolean }
export interface BudgetItem { id: string; cat: string; name: string; est: string | number; act: string | number; dayId: string; site: string; note: string }
export interface Vehicle { id: string; name: string; type: string; plate: string; driver: string; phone: string; note: string }
export interface Trip { id: string; dayId: string; vehicleId: string; time: string; from: string; to: string; who: string; note: string }
export interface Todo { id: string; text: string; done: boolean; due: string; prio: '' | 'high'; created?: number; doneAt?: number | null }
export interface Media { mime?: string; w: number; h: number; name: string; data: string }
export interface Meta {
  title: string; company: string; director: string; dop?: string; producer: string; manager: string; scriptVersion: string; scriptDate: string; scriptFile: string;
  startDate: string; weekdays: number[]; pagesPerDay: number; call: string; callNight: string; linesPerPage: number; castMode: string;
  maxWorkH: number; minRestH: number; docLang: string; baseCity?: string;
}
/** rewizja scenariusza (kolorowe strony): n = kolejność (0 = biała, pierwotna); listy numerów scen zmienionych w tej rewizji */
export interface Revision { id: string; n: number; color: string; label: string; date: string; note: string; file: string; at: number; added: string[]; changed: string[]; removed: { num: string; dayId: string }[] }
export interface Comment { id: string; at: number; by: string; name: string; ref: string; text: string; mentions: string[]; done: boolean; parent?: string }
export interface ProjectState {
  v: number; meta: Meta; scenes: Scene[]; cast: CastMember[]; days: Day[]; sites: Record<string, Site>; nextCast: number;
  sheets: Record<string, Sheet>; transport: { vehicles: Vehicle[]; trips: Trip[] };
  budget: { items: BudgetItem[]; rates: Record<string, { act?: string; off?: boolean }>; autoRates: boolean; currency: string; fx: Fx | null };
  crew: CrewMember[]; shots: Shot[]; media: Record<string, Media>; catering: { cast: boolean; extra: Record<string, number> };
  todos: Todo[]; comments?: Comment[]; revisions?: Revision[]; demo?: boolean; dpr?: Record<string, Dpr>;
}
export interface ProjectMeta { id: string; title: string; updatedAt: number; scenes?: number | null; days?: number | null; demo?: boolean; enc?: boolean }
