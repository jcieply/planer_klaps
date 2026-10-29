/* Główny komponent: ekran blokady albo powłoka z bieżącym widokiem i oknami. */
import { Suspense, useEffect, type ComponentType, type ReactNode } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { T } from './domain/i18n';
import { useProject } from './state/project';
import { useUI, setUI, type Tab } from './state/ui';
import { usePrefs } from './state/prefs';
import { doSave, handleScriptFile, hasPendingSave } from './state/actions';
import { Busy, Shell, Toasts } from './views/Shell';
import { Home } from './views/Home';
import { LockScreen, PwDialog, Settings } from './views/Settings';
import { lazyView } from './views/lazy';

// widoki ładowane przy pierwszym otwarciu zakładki (osobne fragmenty kodu); Pulpit, ustawienia i ekran blokady są w paczce startowej
const Import = lazyView(() => import('./views/Import').then((m) => m.Import));
const Board = lazyView(() => import('./views/Board').then((m) => m.Board));
const Schedule = lazyView(() => import('./views/Schedule').then((m) => m.Schedule));
const Callsheet = lazyView(() => import('./views/Callsheet').then((m) => m.Callsheet));
const Shotlist = lazyView(() => import('./views/Shotlist').then((m) => m.Shotlist));
const ShotImport = lazyView(() => import('./views/Shotlist').then((m) => m.ShotImport));
const Crew = lazyView(() => import('./views/Crew').then((m) => m.Crew));
const Cast = lazyView(() => import('./views/Cast').then((m) => m.Cast));
const Sites = lazyView(() => import('./views/Sites').then((m) => m.Sites));
const Budget = lazyView(() => import('./views/Misc').then((m) => m.Budget));
const Dood = lazyView(() => import('./views/Misc').then((m) => m.Dood));
const Export = lazyView(() => import('./views/Misc').then((m) => m.Export));
const Transport = lazyView(() => import('./views/Misc').then((m) => m.Transport));
const SceneDrawer = lazyView(() => import('./views/SceneDrawer').then((m) => m.SceneDrawer));
const History = lazyView(() => import('./views/History').then((m) => m.History));
const CommentsPanel = lazyView(() => import('./views/Comments').then((m) => m.CommentsPanel));
const Dpr = lazyView(() => import('./views/Dpr').then((m) => m.Dpr));

const VIEWS: Record<Tab, ComponentType> = {
  home: Home, import: Import, board: Board, schedule: Schedule, callsheet: Callsheet, dpr: Dpr, shotlist: Shotlist,
  crew: Crew, transport: Transport, budget: Budget, cast: Cast, sites: Sites, dood: Dood, export: Export,
};

export function App() {
  const st = useProject((s) => s.st);
  const locked = useProject((s) => s.locked);
  const tab = useUI((s) => s.tab);
  const lang = usePrefs((p) => p.lang);
  useGlobalEvents();
  if (locked) return <LazyMotion features={domAnimation} strict><div key={lang}><LockScreen /><Toasts /></div></LazyMotion>;
  if (!st) return <div className="boot" role="status"><span className="spin" aria-hidden="true" />{T('Wczytuję projekt…')}</div>;
  const View = VIEWS[tab] || Home;
  // zmiana języka przerysowuje całość (teksty pochodzą z T() w trakcie rysowania)
  return <LazyMotion features={domAnimation} strict><div key={lang} style={{ display: 'contents' }}>
    <Shell><Suspense fallback={<ViewLoading />}><View /></Suspense></Shell>
    <Lazy><SceneDrawer /></Lazy><Settings /><Lazy><ShotImport /></Lazy><PwDialog /><Lazy><History /></Lazy><Lazy><CommentsPanel /></Lazy>
    <Toasts /><Busy />
  </div></LazyMotion>;
}

/** nakładki (szuflady, panele) wczytywane w tle – do czasu wczytania nic nie pokazują */
const Lazy = ({ children }: { children: ReactNode }) => <Suspense fallback={null}>{children}</Suspense>;
/** zastępczy widok na czas wczytania zakładki (zwykle niewidoczny – zakładki są dociągane zaraz po starcie) */
function ViewLoading() { return <div className="view-loading" role="status" aria-live="polite"><span className="spin" aria-hidden="true" /></div>; }

/** zapis przy opuszczeniu karty, upuszczenie pliku scenariusza w dowolnym miejscu */
function useGlobalEvents() {
  useEffect(() => {
    const flush = () => { if (hasPendingSave()) void doSave(); };
    const vis = () => { if (document.visibilityState === 'hidden') flush(); };
    const over = (e: DragEvent) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); };
    const drop = (e: DragEvent) => {
      if (!e.dataTransfer || !e.dataTransfer.files.length || e.defaultPrevented) return;
      e.preventDefault();
      const f = e.dataTransfer.files[0];
      setUI((s) => { s.tab = 'import'; });
      void handleScriptFile(f);
    };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', flush);
    document.addEventListener('dragover', over);
    document.addEventListener('drop', drop);
    return () => { document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', flush); document.removeEventListener('dragover', over); document.removeEventListener('drop', drop); };
  }, []);
}
