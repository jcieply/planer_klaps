/* Typy rdzenia (logika w core.js, przeniesiona z wersji 1.x). */
import type { Fx, CastMember, CrewMember, Day, DayKind, Meta, ProjectState, Scene, Sheet, SheetRow, Shot, Site, Vehicle, Trip, Dpr } from './model';

export interface DayStats { scenes: Scene[]; eighths: number; sites: string[]; castIds: number[]; mixed: boolean }
export interface CallRow {
  id: string; kind: SheetRow['kind']; sceneId: string; shotId: string; fix: string; fixed: boolean; overlap: boolean; gap: number;
  dur: number; durSet: boolean; durDef: number | null; prep: number; prepSet: boolean; fromMin: number; toMin: number; from: string; to: string; nextDay: boolean;
  num: string; shot: string; desc: string; cast: string; camera: string; notes: string; bg: string; eighths: number; missing: boolean;
}
export interface DayTimes { start: number; end: number | null; work: number | null; known: boolean }
export interface HoursAlert { type: 'work' | 'rest'; text: string }
export interface HoursEntry { start: number; end: number | null; work: number | null; known: boolean; alerts: HoursAlert[]; restBefore: number | null; restAfter: number | null; actual?: boolean }
export interface Lunch { from: string; to: string; dur: number; fromMin: number; label: string }
export interface SchedPos { dayId: string; dayNo: number | null; idx: number }
export interface RateLine { key: string; kind: 'crew' | 'cast' | 'site'; ref: string | number; who: string; role: string; contract: string; rate: string; parsed: { amount: number; unit: string; cur: string | null } | null; fxMissing: boolean; qty: number; est: number; act: number; actRaw: string; off: boolean; days: Day[] }
export interface BudgetCat { key: string; label: string; items: any[]; est: number; act: number; dev: number; cur: string; conv: { cur: string; est: number | null; act: number | null }[] }
export interface BudgetData { cats: BudgetCat[]; est: number; act: number; dev: number; cur: string; conv: { cur: string; est: number | null; act: number | null }[] }
export interface CateringDay { id: string; kind: DayKind; tag: string; title: string; date: string; counts: Record<string, number>; crew: number; cast: number; extra: number; total: number; notes: { who: string; diet: string; note: string }[] }
export interface CateringData { keys: string[]; days: CateringDay[]; sum: Record<string, number>; total: number }
export interface CrewGroup { key: string; dept: string; list: CrewMember[] }
export interface DoodData { days: { no: number; date: string; id: string }[]; rows: { id: number; name: string; actor: string; codes: string[]; work: number; hold: number; first: number | null }[] }
export interface ShotRowX extends Shot { num: string; dayNo: number | null; bg: string; etaMin: number | null }
export interface TransportData { vehicles: Vehicle[]; trips: (Trip & { dayNo: number | null; dayTag: string; date: string; vehicle: Vehicle | null })[] }
export interface SiteReport { site: string; scenes: number; days: number[] }
export interface ReportData { days: any[]; unscheduled: any[]; sites: SiteReport[]; [k: string]: any }
type Opts = Record<string, unknown>;

export interface CoreApi {
  uid(): string;
  TOD: Record<string, { short: string; label: string; cls?: string }>;
  IE_LABEL: Record<string, string>;
  ELEMENT_CATS: [string, string][];
  STRIP: Record<string, { name: string; bg?: string }>;
  stripKey(sc: Scene): string; stripBg(sc: Scene): string; todClass(tod: string): string;
  DAY_KINDS: [DayKind, string][]; isSpecial(kind: string): boolean; isWork(kind: string): boolean;
  dayTag(d: Day | null | undefined, nums: Map<string, number | null>): string; dayTitle(d: Day | null | undefined, nums: Map<string, number | null>): string; kindLabel(k: string): string;
  setDayKind(st: ProjectState, id: string, kind: string): number;
  parseISO(s: string): Date; isoOf(d: Date): string; addDays(iso: string, n: number): string; dow(iso: string): number; dayIndex(iso: string): number;
  fmtDatePL(iso: string): string; fmtDate(iso: string): string; dayName(iso: string): string; fmtShort(iso: string): string; fmtDM(iso: string): string; todayISO(): string;
  readonly MONTHS_NOM: string[]; readonly DAYS_PL: string[]; readonly DAYS_SHORT: string[];
  pl(n: number, one: string, few: string, many: string): string;
  fmtEighths(n: number): string; fmtDur(min: number | null): string; fmtHM(min: number | null): string;
  newState(): ProjectState; normalize(o: unknown): ProjectState; maxEighths(meta: Meta): number;
  castMap(st: ProjectState): Map<number, CastMember>; sceneMap(st: ProjectState): Map<string, Scene>;
  scheduleIndex(st: ProjectState): Map<string, SchedPos>; dayNumbers(st: ProjectState): Map<string, number | null>;
  unassign(st: ProjectState, ids: string[]): void; assign(st: ProjectState, ids: string[], dayId: string, index?: number | null): void;
  addDay(st: ProjectState, kind: string): Day; recalcDates(st: ProjectState): void; removeDay(st: ProjectState, id: string): void; moveDay(st: ProjectState, id: string, dir: number): void;
  autoPlan(st: ProjectState, o: { strategy: string; scope: string; separateNight: boolean; basis?: string; hours?: number; move?: number; perEighth?: number }): number; sceneMinutes(st: ProjectState, sc: Scene, o?: { move?: number; perEighth?: number }): number; scenesWithoutEta(st: ProjectState, scenes: Scene[]): number;
  dayStats(st: ProjectState, d: Day): DayStats; dayWarnings(st: ProjectState, d: Day, hrs?: Map<string, HoursEntry>): string[];
  dood(st: ProjectState): DoodData; reportData(st: ProjectState): ReportData;
  BUDGET_CATS: [string, string][]; VEHICLE_TYPES: string[];
  timeToMin(s: string | null | undefined): number | null; minToTime(m: number): string; clock(m: number | null): string;
  sheetOf(st: ProjectState, dayId: string): Sheet & { _day?: Day }; ensureSheet(st: ProjectState, dayId: string): Sheet; syncSheet(st: ProjectState, dayId: string, force?: boolean): Sheet;
  initShotRows(st: ProjectState, dayId: string): Sheet; setSheetMode(st: ProjectState, dayId: string, mode: string): Sheet; activeRows(st: ProjectState, dayId: string): SheetRow[];
  callRows(st: ProjectState, d: Day): CallRow[]; dayStart(st: ProjectState, d: Day, sh?: Partial<Sheet>): number;
  dayTimes(st: ProjectState, d: Day): DayTimes | null; hoursCheck(st: ProjectState): Map<string, HoursEntry>; lunchOf(st: ProjectState, d: Day): Lunch | null;
  SITE_FIELDS: string[]; siteEntry(o?: Partial<Site> | null): Site & Record<string, any>; POWER: [string, string][]; SITE_CONTRACT: [string, string][];
  powerLabel(k: string): string; contractLabel(k: string): string; contractOpen(k: string): boolean;
  customRow(text: string, dur?: number | null, prep?: number | null, fix?: string): SheetRow; sceneRowOf(sceneId: string): SheetRow; shotRowOf(x: Shot, prep?: number | null): SheetRow;
  sceneDesc(sc: Scene): string; shotsOf(st: ProjectState, sceneId: string): Shot[]; shotEta(st: ProjectState, sceneId: string): number | null;
  sheetScenes(st: ProjectState, d: Day): Scene[]; sheetCastIds(st: ProjectState, d: Day): number[]; locationsText(st: ProjectState, d: Day): string;
  removeScenes(st: ProjectState, ids: string[]): void; addMap(st: ProjectState, dayId: string, img: { data: string; w: number; h: number; name?: string; caption?: string }): string; removeMap(st: ProjectState, dayId: string, mapId: string): void;
  DEPTS: string[]; CONTRACTS: string[]; DIETS: [string, string][]; dietLabel(k: string, short?: boolean): string;
  newCast(o: Partial<CastMember> & { id: number; name: string }): CastMember; newCrew(o?: Partial<CrewMember>): CrewMember;
  crewName(c: CrewMember): string; crewWorks(c: CrewMember, d: Day): boolean; toggleCrewDay(st: ProjectState, c: CrewMember, dayId: string, on?: boolean): void;
  setCrewAllDays(st: ProjectState, c: CrewMember, v: 'shoot' | 'all' | 'none'): void; crewDefaultDays(c: CrewMember): boolean; deptKey(c: CrewMember): string;
  crewGroups(st: { crew: CrewMember[] }): CrewGroup[]; catering(st: ProjectState): CateringData; cateringLine(d: CateringDay): string;
  SHOT_TYPES: [string, string, string][]; etaMin(s: string | null | undefined): number | null; shotRows(st: ProjectState): ShotRowX[]; shotDays(st: ProjectState): Map<string, string[]>;
  nextShotNo(st: ProjectState, sceneId: string): string; newShot(st: ProjectState, sceneId: string): Shot;
  num(v: unknown): number; fmtMoney(n: number, cur?: string): string; budgetData(st: ProjectState): BudgetData; transportData(st: ProjectState, dayId?: string | null): TransportData;
  parseRate(s: string): { amount: number; unit: string; cur: string | null } | null; CURRENCIES: Record<string, { sym: string; name: string }>; setCurrency(c?: string): void; plnPer(st: ProjectState, c: string): number | null; convert(st: ProjectState, amount: number, from: string, to: string): number | null; fxInfo(st: ProjectState): Fx | null; parseNbp(json: unknown): Fx | null; rateLines(st: ProjectState): RateLine[]; rateFormula(l: RateLine): string; rateUnitLabel(unit: string, short?: boolean): string;
  applyImport(st: ProjectState, parsed: any, o: Opts): void; renameSite(st: ProjectState, from: string, to: string): void;
  mergeCast(st: ProjectState, from: number, to: number): void; removeCast(st: ProjectState, id: number): void;
  weekdaysOf(meta: Meta): number[]; lastDate(st: ProjectState): string; normName(s: string): string;
  memoStats: { hit: number; miss: number }; commitState(st: ProjectState | null): void; releaseState(st: ProjectState | null): void;
  /* raport dzienny i pogoda (core.js) */
  dprOf(st: ProjectState, dayId: string): Dpr; ensureDpr(st: ProjectState, dayId: string): Dpr; dprSummary(st: ProjectState, d: Day): DprSummary; shotProgress(st: ProjectState): ShotProgress;
  moveUnshot(st: ProjectState, dayId: string, target: string): number;
  DPR_STATUS: [string, string][]; dprSceneIds(st: ProjectState, d: Day): string[];
}
export interface DprSceneRow { scene: Scene; status: string; planned: number; shot: number; setups: number; note: string; moved: boolean }
export interface DprSummary {
  rows: DprSceneRow[]; planned: number; shot: number; scenesDone: number; scenesPart: number; scenesNone: number; setups: number;
  plan: { call: string; firstShot: string; lunch: string; wrap: string; work: number | null };
  actual: { call: string; firstShot: string; lunchFrom: string; lunchTo: string; camWrap: string; crewWrap: string; work: number | null; lunchMin: number | null };
  overtime: number | null; delta: number; cum: { shot: number; planned: number; total: number; scenesDone: number; scenesTotal: number; delta: number };
}
export interface ShotProgress { shotEighths: number; totalEighths: number; doneScenes: Set<string>; partScenes: Set<string> }
export declare const Core: CoreApi;
