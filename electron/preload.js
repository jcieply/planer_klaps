const { contextBridge, ipcRenderer } = require('electron');
// wersję podaje proces główny w argumentach okna (preload w trybie sandbox nie może wczytywać plików projektu)
const version = (process.argv.find((a) => a.startsWith('--klaps-version=')) || '').slice('--klaps-version='.length);

let flushHandler = null;
ipcRenderer.on('app:flush', async (_e, id) => {
  try { if (flushHandler) await flushHandler(); } catch (e) { /* zapis zgłosił błąd – i tak odpowiadamy, aby okno dało się zamknąć */ }
  ipcRenderer.send('app:flushed', id);
});

contextBridge.exposeInMainWorld('klapsDesktop', {
  platform: process.platform,
  version,
  pdfjsBase: 'klaps://app/vendor/pdfjs/',
  windowKind: /launcher\.html$/.test(location.pathname) ? 'launcher' : 'main',
  store: {
    list: () => ipcRenderer.invoke('store:list'),
    save: (id, meta, plan, script, media) => ipcRenderer.invoke('store:save', id, meta, plan, script, media),
    load: (id) => ipcRenderer.invoke('store:load', id),
    remove: (id) => ipcRenderer.invoke('store:remove', id),
  },
  saveFile: (name, data) => ipcRenderer.invoke('file:save', name, data),
  onMenu: (fn) => { ipcRenderer.on('menu', (_e, action, payload) => fn(action, payload)); },
  onFlush: (fn) => { flushHandler = fn; },
  profile: {
    get: () => ipcRenderer.invoke('profile:get'),
    set: (p) => ipcRenderer.invoke('profile:set', p),
    setPrefs: (p) => ipcRenderer.invoke('profile:prefs', p),
  },
  launcher: {
    launch: (intent) => ipcRenderer.invoke('launcher:launch', intent),
    show: () => ipcRenderer.invoke('launcher:show'),
    quit: () => ipcRenderer.invoke('launcher:quit'),
  },
  secrets: {
    get: (n) => ipcRenderer.invoke('secrets:get', n),
    set: (n, v) => ipcRenderer.invoke('secrets:set', n, v),
    remove: (n) => ipcRenderer.invoke('secrets:remove', n),
    info: () => ipcRenderer.invoke('secrets:info'),
  },
  license: {
    status: () => ipcRenderer.invoke('license:status'),
    activate: (key) => ipcRenderer.invoke('license:activate', key),
  },
  ready: () => ipcRenderer.send('app:ready'),
  session: () => ipcRenderer.invoke('session:get'),
});
