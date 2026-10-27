/* Stan interfejsu (bez historii cofania): zakładka, filtry, okna, szuflada, komunikaty. */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

export type Tab = 'home' | 'import' | 'board' | 'schedule' | 'shotlist' | 'dood' | 'callsheet' | 'dpr' | 'cast' | 'crew' | 'sites' | 'transport' | 'budget' | 'export';
export interface Toast { id: number; msg: string; kind?: '' | 'bad'; action?: { label: string; run: () => void } }
export interface PwDialog { kind: 'enable' | 'change' | 'disable' | 'file'; obj?: any; err?: string; busy?: boolean }
export interface ImpState { status: 'idle' | 'reading' | 'ready' | 'error'; file?: string; progress?: string; raw?: any; parsed?: any; keep?: boolean; error?: string }

export interface UIState {
  tab: Tab;
  drawer: string | null;
  sel: string[];
  f: { q: string; ie: string; tod: string; cast: string; site: string; plan: string };
  pool: { q: string; sort: 'script' | 'site' | 'tod' };
  calView: 'days' | 'month';
  month: string | null;
  autoplan: boolean;
  ap: { strategy: string; scope: string; separateNight: boolean; basis: string; hours: string; move: string };
  settings: boolean;
  confirmDel: boolean;
  imp: ImpState;
  paste: boolean;
  pasteText: string;
  exp: Record<string, boolean>;
  csDay: string | null;
  trDay: string;
  crewOpen: string[];
  castOpen: number[];
  siteOpen: string[];
  crewF: { q: string; dept: string };
  shF: { scene: string };
  crewView: 'list' | 'days' | 'catering';
  csPick: boolean;
  busy: string | null;
  showScript: boolean;
  confirmReplace: boolean;
  todoF: 'open' | 'done' | 'all';
  csPickAll: boolean;
  history: boolean;
  comments: boolean;
  dprDay: string | null;
  more: boolean;
  pw: PwDialog | null;
  shImp: any | null;
  toasts: Toast[];
  syncBusy: boolean;
  syncErr: string;
}

const initial: UIState = {
  tab: 'home', drawer: null, sel: [],
  f: { q: '', ie: '', tod: '', cast: '', site: '', plan: '' },
  pool: { q: '', sort: 'script' },
  calView: 'days', month: null, autoplan: false, ap: { strategy: 'site', scope: 'unscheduled', separateNight: true, basis: 'pages', hours: '8', move: '15' },
  settings: false, confirmDel: false, imp: { status: 'idle' }, paste: false, pasteText: '',
  exp: { calendar: true, board: true, shotlist: true, cast: true, crew: true, catering: true, sites: true, dood: true, callsheet: true, dpr: true, transport: true, budget: true },
  csDay: null, trDay: '', crewOpen: [], castOpen: [], siteOpen: [], crewF: { q: '', dept: '' }, shF: { scene: '' }, crewView: 'list', csPick: false,
  busy: null, showScript: false, confirmReplace: false, todoF: 'open', csPickAll: false, history: false, comments: false, dprDay: null, more: false, pw: null, shImp: null, toasts: [], syncBusy: false, syncErr: '',
};

interface UIStore extends UIState { set: (recipe: (s: UIState) => void) => void; reset: () => void }
export const useUI = create<UIStore>()(immer((set) => ({
  ...initial,
  set: (recipe) => set((s) => { recipe(s as UIState); }),
  reset: () => set((s) => { Object.assign(s, { ...initial, toasts: s.toasts }); }),
})));
export const ui = () => useUI.getState();
export const setUI = (recipe: (s: UIState) => void) => useUI.getState().set(recipe);
export const goTab = (tab: Tab) => setUI((s) => { s.tab = tab; s.drawer = null; s.more = false; });

let toastId = 0;
export function toast(msg: string, kind: '' | 'bad' = '', action?: Toast['action']) {
  const id = ++toastId;
  setUI((s) => { s.toasts = [{ id, msg, kind, action }]; });
  setTimeout(() => setUI((s) => { s.toasts = s.toasts.filter((t) => t.id !== id); }), kind === 'bad' ? 9000 : 4500);
}
