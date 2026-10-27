/* Wejście okna startowego (launcher.html). Mały pakiet: bez projektu, bez edytora – tylko profil i lista projektów. */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { LazyMotion, domAnimation } from 'motion/react';
import '../styles/legacy.css';
import '../styles/react.css';
import '../styles/launcher.css';
import { usePrefs } from '../state/prefs';
import { ensureEn } from '../domain/enpack';
import { Launcher } from './Launcher';
import { installDefaultServices } from './services';
import { installCloudServices } from './cloudServices';

installDefaultServices();
installCloudServices();
const start = async () => {
  if (usePrefs.getState().lang === 'en') await ensureEn();
  createRoot(document.getElementById('app')!).render(<StrictMode><LazyMotion features={domAnimation} strict><Launcher /></LazyMotion></StrictMode>);
};
void start();
