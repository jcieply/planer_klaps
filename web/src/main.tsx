/* Start aplikacji Klaps Planer (React). */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/legacy.css';
import './styles/react.css';
import { usePrefs } from './state/prefs';
import { ensureEn } from './domain/enpack';
import { App } from './App';
import { boot } from './state/actions';
import { installCompat } from './compat';
import { announceReady, installDesktop } from './desktop/install';

if (import.meta.env.MODE === 'e2e') installCompat();
const start = async () => {
  if (usePrefs.getState().lang === 'en') await ensureEn();
  createRoot(document.getElementById('app')!).render(<StrictMode><App /></StrictMode>);
  installDesktop();
  void boot().finally(announceReady);
};
void start();
