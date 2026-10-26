const { app, BrowserWindow, Menu, protocol, net, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const store = require('./store');

protocol.registerSchemesAsPrivileged([{ scheme: 'klaps', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

let win = null;
const appDir = () => path.join(__dirname, '..', 'app');
const projectsDir = () => path.join(app.getPath('documents'), 'Klaps Planer', 'Projekty');

function createWindow() {
  const st = readState();
  win = new BrowserWindow({
    width: st.width || 1360, height: st.height || 880, minWidth: 900, minHeight: 600,
    title: 'Klaps Planer', backgroundColor: '#14161a',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  win.loadURL('klaps://app/index.html');
  win.on('close', () => writeState(win.getBounds()));
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('klaps://')) e.preventDefault(); });
}

const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function readState() { try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (e) { return {}; } }
function writeState(b) { try { fs.writeFileSync(stateFile(), JSON.stringify(b)); } catch (e) { /* brak */ } }

function menu() {
  const send = (a) => () => { if (win) win.webContents.send('menu', a); };
  const t = [
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { label: 'Plik', submenu: [
      { label: 'Nowy projekt', accelerator: 'CmdOrCtrl+N', click: send('new-project') },
      { type: 'separator' },
      { label: 'Zapisz kopię projektu (.json)…', accelerator: 'CmdOrCtrl+Shift+S', click: send('export-json') },
      { label: 'Wczytaj projekt z kopii (.json)…', accelerator: 'CmdOrCtrl+O', click: send('import-json') },
      { type: 'separator' },
      { label: 'Pokaż folder z projektami', click: () => { fs.mkdirSync(projectsDir(), { recursive: true }); shell.openPath(projectsDir()); } },
      { type: 'separator' },
      process.platform === 'darwin' ? { role: 'close', label: 'Zamknij okno' } : { role: 'quit', label: 'Zakończ' }
    ] },
    { label: 'Edycja', submenu: [{ role: 'undo', label: 'Cofnij' }, { role: 'redo', label: 'Ponów' }, { type: 'separator' }, { role: 'cut', label: 'Wytnij' }, { role: 'copy', label: 'Kopiuj' }, { role: 'paste', label: 'Wklej' }, { role: 'selectAll', label: 'Zaznacz wszystko' }] },
    { label: 'Widok', submenu: [{ role: 'resetZoom', label: 'Rozmiar domyślny' }, { role: 'zoomIn', label: 'Powiększ' }, { role: 'zoomOut', label: 'Pomniejsz' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Pełny ekran' }] },
    { label: 'Okno', role: 'windowMenu' }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

app.whenReady().then(() => {
  protocol.handle('klaps', (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname);
    if (rel === '/' || rel === '') rel = '/index.html';
    const full = path.normalize(path.join(appDir(), rel));
    if (!full.startsWith(appDir())) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(full).toString());
  });
  const dir = projectsDir();
  ipcMain.handle('store:list', () => store.list(dir));
  ipcMain.handle('store:save', (_e, id, meta, plan, script, media) => store.save(dir, id, meta, plan, script, media));
  ipcMain.handle('store:load', (_e, id) => store.load(dir, id));
  ipcMain.handle('store:remove', (_e, id) => store.remove(dir, id));
  ipcMain.handle('file:save', async (_e, name, data) => {
    const safe = String(name).replace(/[\\/:*?"<>|]/g, '_');
    const r = await dialog.showSaveDialog(win, { defaultPath: path.join(app.getPath('documents'), 'Klaps Planer', safe) });
    if (r.canceled || !r.filePath) return { canceled: true };
    fs.mkdirSync(path.dirname(r.filePath), { recursive: true });
    fs.writeFileSync(r.filePath, Buffer.from(data instanceof Uint8Array ? data : typeof data === 'string' ? Buffer.from(data) : new Uint8Array(data)));
    return { canceled: false, path: r.filePath };
  });
  menu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
