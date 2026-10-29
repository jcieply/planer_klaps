/* Zgodność z wersją 1.x: globalne obiekty (S, UI, Core…) używane przez testy end-to-end i narzędzia diagnostyczne.
   Zmiany wprowadzone bezpośrednio w S trzeba zatwierdzić wywołaniem commit(). */
import { Core } from './domain/core';
import { Reports } from './domain/reports';
import { Store } from './domain/store';
import { Sync } from './domain/sync';
import { Vault } from './domain/vault';
import { Table } from './domain/table';
import { I18N } from './domain/i18n';
import { useProject } from './state/project';
import { setUI, toast, useUI } from './state/ui';
import { usePrefs } from './state/prefs';
import { deleteProject, doSave, exportProjectJson, newProject, openProject } from './state/actions';
import { sitesList } from './lib/format';
import { heavy, heavyState } from './lib/heavy';

export function installCompat() {
  const w = window as any;
  const UI = new Proxy({}, {
    get(_, k: string) {
      if (k === 'toast') return useUI.getState().toasts[0] || null;
      if (k === 'locked') return useProject.getState().locked;
      if (k === 'save') return useProject.getState().save;
      return (useUI.getState() as any)[k];
    },
    set(_, k: string, v) {
      if (k === 'toast') { if (!v) setUI((s) => { s.toasts = []; }); return true; }
      setUI((s) => { (s as any)[k] = v; });
      return true;
    },
  });
  const PREFS = new Proxy({}, {
    get(_, k: string) { return (usePrefs.getState() as any)[k]; },
    set(_, k: string, v) { usePrefs.getState().setPrefs({ [k]: v }); return true; },
  });
  const commit = () => { const st = useProject.getState().st; if (st) useProject.setState({ st: JSON.parse(JSON.stringify(st)) }); };
  Object.defineProperties(w, {
    // testy zmieniają S w miejscu i zatwierdzają przez commit() – bez pamięci wyników dla tego obiektu
    S: { get: () => { const st = useProject.getState().st; Core.releaseState(st); return st; }, configurable: true },
    PID: { get: () => useProject.getState().pid, configurable: true },
    PROJECTS: { get: () => useProject.getState().projects, configurable: true },
  });
  Object.assign(w, {
    UI, PREFS, commit, heavy, heavyState, Core, Reports, Store, Sync, Vault, Table, I18N, toast, openProject, newProject, doSave, exportProjectJson, deleteProject,
    sitesList: () => sitesList(useProject.getState().st!),
    undoHistory: () => useProject.temporal.getState(),
    render: () => {}, renderNow: () => {}, renderToastOnly: () => {},
    setLang: (l: 'pl' | 'en') => usePrefs.getState().setPrefs({ lang: l }),
    setTheme: (t: 'auto' | 'light' | 'dark') => usePrefs.getState().setPrefs({ theme: t }),
  });
}
