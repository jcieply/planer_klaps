/* Podłączenie okna głównego do powłoki desktopowej: menu, zapis przy zamykaniu, sygnał „gotowe”, powrót do okna startowego. */
import { desktop } from './bridge';
import { exportProjectFile, flushSave, importProjectFile, switchProject } from '../state/actions';

export function installDesktop() {
  const d = desktop();
  if (!d) return;
  document.documentElement.classList.add('desktop');
  d.onFlush(() => flushSave());
  d.onMenu((action, payload) => {
    if (action === 'new-project') void switchProject('__new');
    else if (action === 'export-json') void exportProjectFile();
    else if (action === 'import-file' && payload && payload.bytes) void importProjectFile(new File([payload.bytes], String(payload.name || 'projekt.klaps')));
    else if (action === 'launcher') void backToLauncher();
  });
}
/** zapisuje projekt i pokazuje okno startowe (program zamyka bieżące okno) */
export async function backToLauncher() {
  await flushSave();
  await desktop()?.launcher.show();
}
/** dwa kolejne klatki po pierwszym rysunku – wtedy okno główne może się pokazać bez „mignięcia” */
export function announceReady() {
  const d = desktop();
  if (!d) return;
  requestAnimationFrame(() => requestAnimationFrame(() => d.ready()));
}
