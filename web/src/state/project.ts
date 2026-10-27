/* Stan projektu: Zustand + Immer (zmiany jak na zwykłym obiekcie) + zundo (cofnij / ponów).
   Historia obejmuje wyłącznie dane projektu; szybkie zmiany (np. pisanie) łączą się w jeden krok. */
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { temporal } from 'zundo';
import { setAutoFreeze } from 'immer';
import type { ProjectMeta, ProjectState } from '../domain/model';
import { Core } from '../domain/core';

// logika z wersji 1.x czasem buduje obiekty pomocnicze na danych – bez zamrażania stanu
setAutoFreeze(false);

/** wspólne flagi sesji: zmiana pochodzi z chmury (nie zapisuj / nie licz jako własną); projekt tylko do odczytu */
export const flags = { remote: false, ro: false };
/** praca zespołowa przejmuje cofanie i ponawianie (cofamy tylko własne zmiany) */
export const undoHooks: { undo?: () => void; redo?: () => void } = {};

export type SaveState = 'saved' | 'busy' | 'err' | 'mem';
export interface LockedState { id: string; err?: string; busy?: boolean }

interface ProjectStore {
  st: ProjectState | null;
  pid: string | null;
  projects: ProjectMeta[];
  save: SaveState;
  locked: LockedState | null;
  /** zmiana danych projektu (wchodzi do historii cofania) */
  mutate: (recipe: (st: ProjectState) => void) => void;
  /** podmiana całego projektu (otwarcie, synchronizacja) – czyści historię */
  load: (pid: string | null, st: ProjectState | null) => void;
  setProjects: (p: ProjectMeta[]) => void;
  setSave: (s: SaveState) => void;
  setLocked: (l: LockedState | null) => void;
}

/** łączenie szybkich zmian: zapisujemy stan sprzed pierwszej zmiany w serii (ok. 700 ms przerwy kończy serię) */
let burstTimer: ReturnType<typeof setTimeout> | null = null;
function burst<A extends unknown[]>(fn: (...a: A) => void, gap = 700) {
  return (...a: A) => {
    if (!burstTimer) fn(...a);
    if (burstTimer) clearTimeout(burstTimer);
    burstTimer = setTimeout(() => { burstTimer = null; }, gap);
  };
}
/** kolejna zmiana na pewno zaczyna nowy krok historii (np. po otwarciu projektu) */
const endBurst = () => { if (burstTimer) { clearTimeout(burstTimer); burstTimer = null; } };

export const useProject = create<ProjectStore>()(
  temporal(
    immer((set) => ({
      st: null,
      pid: null,
      projects: [],
      save: 'saved',
      locked: null,
      mutate: (recipe) => set((s) => { if (s.st && !flags.ro) recipe(s.st as ProjectState); }),
      load: (pid, st) => set((s) => { s.pid = pid; s.st = st as any; s.locked = null; }),
      setProjects: (p) => set((s) => { s.projects = p as any; }),
      setSave: (v) => set((s) => { s.save = v; }),
      setLocked: (l) => set((s) => { s.locked = l; }),
    })),
    {
      partialize: (s) => ({ st: s.st }) as Pick<ProjectStore, 'st'>,
      equality: (a, b) => a.st === b.st,
      limit: 150,
      handleSet: (handleSet) => burst(handleSet as (...a: unknown[]) => void) as any,
    },
  ),
);

// stan zapisany w magazynie jest niezmienny – rdzeń może pamiętać wyliczenia dla niego (Core.commitState)
Core.commitState(useProject.getState().st);
useProject.subscribe((s) => { Core.commitState(s.st); Core.setCurrency(s.st && s.st.budget ? s.st.budget.currency : 'PLN'); });

export const history = () => useProject.temporal.getState();
export const undo = () => (undoHooks.undo ? undoHooks.undo() : history().undo());
export const redo = () => (undoHooks.redo ? undoHooks.redo() : history().redo());
export const clearHistory = () => { endBurst(); history().clear(); };
/** aktualny projekt (poza Reactem) */
export const getSt = () => useProject.getState().st as ProjectState;
export const mutate = (recipe: (st: ProjectState) => void) => useProject.getState().mutate(recipe);
