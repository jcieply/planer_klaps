/* Główny komponent: ekran blokady albo powłoka z bieżącym widokiem i oknami. */
import { useEffect, type ReactNode } from 'react';
import { LazyMotion, domAnimation } from 'motion/react';
import { T } from './domain/i18n';
import { useProject } from './state/project';
import { useUI, setUI, type Tab } from './state/ui';
import { usePrefs } from './state/prefs';
import { doSave, handleScriptFile, hasPendingSave } from './state/actions';
import { Busy, Shell, Toasts } from './views/Shell';
import { Home } from './views/Home';
import { Import } from './views/Import';
import { Board } from './views/Board';
import { Schedule } from './views/Schedule';
import { Callsheet } from './views/Callsheet';
import { Shotlist, ShotImport } from './views/Shotlist';
import { Crew } from './views/Crew';
import { Cast } from './views/Cast';
import { Sites } from './views/Sites';
import { Budget, Dood, Export, Transport } from './views/Misc';
import { SceneDrawer } from './views/SceneDrawer';
import { LockScreen, PwDialog, Settings } from './views/Settings';
import { History } from './views/History';
import { Dpr } from './views/Dpr';

const VIEWS: Record<Tab, () => ReactNode> = {
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
    <Shell><View /></Shell>
    <SceneDrawer /><Settings /><ShotImport /><PwDialog /><History />
    <Toasts /><Busy />
  </div></LazyMotion>;
}

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
