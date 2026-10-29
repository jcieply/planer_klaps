/* Start aplikacji Klaps Planer (React). */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/legacy.css';
import './styles/react.css';
import { usePrefs } from './state/prefs';
import { ensureEn } from './domain/enpack';
import { App } from './App';
import { boot } from './state/actions';
import { announceReady, installDesktop } from './desktop/install';
import { warmViews } from './views/lazy';
import { warmHeavy } from './lib/heavy';

const start = async () => {
  // obiekty globalne dla testów end-to-end – tylko w buildzie testowym (w programie ten kod nie istnieje)
  if (import.meta.env.MODE === 'e2e') (await import('./compat')).installCompat();
  if (usePrefs.getState().lang === 'en') await ensureEn();
  createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
  installDesktop();
  void boot().finally(() => {
    announceReady();
    // po pokazaniu projektu: zakładki i wątek roboczy wczytują się w tle
    warmViews();
    warmHeavy();
  });
};
void start();
