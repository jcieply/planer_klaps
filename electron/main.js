/* Klaps Planer – proces główny: okno startowe (launcher) → okno programu.
   Kolejność: start → okno startowe → wybór projektu → okno programu rysuje projekt i zgłasza „gotowe” → płynne przejście. */
const { app, BrowserWindow, Menu, protocol, ipcMain, dialog, shell, screen, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const store = require('./store');
const profile = require('./profile');
const intents = require('./intent');
const secretsLib = require('./secrets');

// katalogi można podmienić zmiennymi środowiskowymi (testy nie dotykają prawdziwych danych użytkownika)
if (process.env.KLAPS_DATA_DIR) app.setPath('userData', process.env.KLAPS_DATA_DIR);
protocol.registerSchemesAsPrivileged([{ scheme: 'klaps', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);

const IS_MAC = process.platform === 'darwin';
const appDir = () => path.join(__dirname, '..', 'app');
const projectsDir = () => process.env.KLAPS_PROJECTS_DIR || path.join(app.getPath('documents'), 'Klaps Planer', 'Projekty');
const dataDir = () => app.getPath('userData');
const BG = '#17181B';
// testy automatyczne łączą się ze sztuczną chmurą na tym samym komputerze (http/ws na 127.0.0.1) – tylko z tą zmienną środowiskową
const LOOP = process.env.KLAPS_E2E_CLOUD ? ' http://127.0.0.1:* ws://127.0.0.1:*' : '';
const CSP = "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' data: blob: https: wss:" + LOOP + "; worker-src 'self' blob:; object-src 'none'; base-uri 'none'; form-action 'none'";
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.map': 'application/json' };

let launcher = null;
let main = null;
let mainShown = false;
let allowMainClose = false;
let revealTimer = null;
let session = { account: null, source: 'local', mode: 'local' };

/* ---------- okna ---------- */
function webPrefs() { return { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false, additionalArguments: ['--klaps-version=' + app.getVersion()] }; }
const alive = (w) => !!w && !w.isDestroyed();

function createLauncher() {
  launcher = new BrowserWindow({
    width: 880, height: 540, useContentSize: true, center: true, show: false,
    frame: false, resizable: false, maximizable: false, fullscreenable: false, title: 'Klaps Planer', backgroundColor: BG,
    webPreferences: webPrefs(),
  });
  const w = launcher;
  w.setMenuBarVisibility(false);
  w.loadURL('klaps://app/launcher.html');
  w.once('ready-to-show', () => { if (alive(w)) { try { w.setOpacity(0); } catch (e) { /* brak obsługi */ } w.show(); void fade(w, 0, 1, 180); } });
  w.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('klaps://')) e.preventDefault(); });
  w.on('closed', () => {
    if (launcher === w) launcher = null;
    // zamknięcie okna startowego, gdy nie ma programu = koniec pracy aplikacji
    if (!alive(main) && !quitting) app.quit();
  });
}

function stateFile() { return path.join(dataDir(), 'window.json'); }
function readState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    // zapamiętane położenie po odłączeniu monitora mogłoby wypaść poza ekran
    if (typeof s.x === 'number' && typeof s.y === 'number' && !screen.getAllDisplays().some((d) => { const a = d.workArea; return s.x + 80 > a.x && s.x < a.x + a.width - 80 && s.y >= a.y - 10 && s.y < a.y + a.height - 80; })) { delete s.x; delete s.y; }
    return s;
  } catch (e) { return {}; }
}
function writeState(b) { try { fs.writeFileSync(stateFile(), JSON.stringify(b)); } catch (e) { /* brak */ } }

function openMain(intent) {
  if (alive(main)) { main.show(); main.focus(); return { ok: true }; }
  const st = readState();
  mainShown = false; allowMainClose = false;
  const me = profile.get(dataDir());
  session = { account: me ? { id: me.id, name: me.name, provider: 'local' } : null, source: intent.source, mode: 'local' };
  const w = new BrowserWindow({
    width: st.width || 1360, height: st.height || 880, x: st.x, y: st.y, minWidth: 900, minHeight: 600, show: false,
    title: 'Klaps Planer', backgroundColor: BG,
    webPreferences: webPrefs(),
  });
  main = w;
  w.loadURL('klaps://app/index.html' + intents.toQuery(intent));
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('klaps://')) e.preventDefault(); });
  // zamknięcie okna: najpierw zapis projektu, dopiero potem faktyczne zamknięcie
  w.on('close', (e) => {
    if (allowMainClose) { writeState(w.getBounds()); return; }
    e.preventDefault();
    flushMain().finally(() => { allowMainClose = true; if (alive(w)) w.close(); });
  });
  w.on('closed', () => {
    if (main === w) main = null;
    clearTimeout(revealTimer);
    if (quitting || alive(launcher)) return;
    if (IS_MAC) showLauncher(); else app.quit();
  });
  // gdyby program nie zgłosił gotowości (błąd ładowania), pokazujemy okno po chwili
  clearTimeout(revealTimer);
  revealTimer = setTimeout(() => { void revealMain(); }, 15000);
  if (intent.type === 'open' && intent.source === 'local') { try { profile.setPrefs(dataDir(), { lastProject: intent.id, lastOpenedAt: Date.now() }); } catch (e) { /* brak profilu */ } }
  return { ok: true };
}

/** okno programu jest gotowe: pokazujemy je i zasuwamy okno startowe */
async function revealMain() {
  clearTimeout(revealTimer);
  const w = main;
  if (!alive(w) || mainShown) return;
  mainShown = true;
  try { w.setOpacity(0); } catch (e) { /* brak obsługi */ }
  w.show(); w.focus();
  const l = launcher; launcher = null; // zerujemy, aby zamknięcie okna startowego nie kończyło aplikacji
  await Promise.all([fade(w, 0, 1, 220), alive(l) ? fade(l, 1, 0, 200) : null]);
  if (alive(l)) l.destroy();
}

async function showLauncher() {
  if (alive(launcher)) { launcher.show(); launcher.focus(); }
  else createLauncher();
  if (alive(main)) { await flushMain(); allowMainClose = true; if (alive(main)) main.close(); }
}

function fade(w, from, to, ms) {
  return new Promise((resolve) => {
    const steps = Math.max(1, Math.round(ms / 16));
    let i = 0;
    const t = setInterval(() => {
      i++;
      if (!alive(w)) { clearInterval(t); resolve(); return; }
      try { w.setOpacity(from + (to - from) * Math.min(1, i / steps)); } catch (e) { clearInterval(t); resolve(); return; }
      if (i >= steps) { clearInterval(t); resolve(); }
    }, 16);
  });
}

/* ---------- zapis przy zamykaniu ---------- */
let flushSeq = 0;
const flushWaiters = new Map();
function flushMain(timeout = 6000) {
  if (!alive(main) || main.webContents.isLoading()) return Promise.resolve();
  return new Promise((resolve) => {
    const id = ++flushSeq;
    const done = () => { clearTimeout(t); flushWaiters.delete(id); resolve(); };
    const t = setTimeout(done, timeout);
    flushWaiters.set(id, done);
    try { main.webContents.send('app:flush', id); } catch (e) { done(); }
  });
}
let quitting = false;
app.on('before-quit', (e) => {
  if (quitting) return;
  if (alive(main) && !allowMainClose) {
    e.preventDefault();
    quitting = true;
    flushMain().finally(() => { allowMainClose = true; app.quit(); });
  } else quitting = true;
});

/* ---------- menu ---------- */
function toMain(action, payload) { if (alive(main)) main.webContents.send('menu', action, payload); }
async function importDialog() {
  if (!alive(main)) return;
  const r = await dialog.showOpenDialog(main, { title: 'Wczytaj projekt z kopii', properties: ['openFile'], filters: [{ name: 'Projekt Klaps', extensions: ['klaps', 'json'] }] });
  if (r.canceled || !r.filePaths[0]) return;
  try { toMain('import-file', { name: path.basename(r.filePaths[0]), bytes: fs.readFileSync(r.filePaths[0]) }); }
  catch (e) { dialog.showErrorBox('Klaps Planer', 'Nie udało się odczytać pliku: ' + e.message); }
}
function menu() {
  const t = [
    ...(IS_MAC ? [{ role: 'appMenu' }] : []),
    { label: 'Plik', submenu: [
      { label: 'Nowy projekt', accelerator: 'CmdOrCtrl+N', click: () => toMain('new-project') },
      { label: 'Okno startowe', accelerator: 'CmdOrCtrl+Shift+L', click: () => { void showLauncher(); } },
      { type: 'separator' },
      { label: 'Zapisz kopię projektu (.klaps)…', accelerator: 'CmdOrCtrl+Shift+S', click: () => toMain('export-json') },
      { label: 'Wczytaj projekt z kopii…', accelerator: 'CmdOrCtrl+O', click: () => { void importDialog(); } },
      { type: 'separator' },
      { label: 'Pokaż folder z projektami', click: () => { fs.mkdirSync(projectsDir(), { recursive: true }); shell.openPath(projectsDir()); } },
      { type: 'separator' },
      IS_MAC ? { role: 'close', label: 'Zamknij okno' } : { role: 'quit', label: 'Zakończ' },
    ] },
    { label: 'Edycja', submenu: [{ role: 'undo', label: 'Cofnij' }, { role: 'redo', label: 'Ponów' }, { type: 'separator' }, { role: 'cut', label: 'Wytnij' }, { role: 'copy', label: 'Kopiuj' }, { role: 'paste', label: 'Wklej' }, { role: 'selectAll', label: 'Zaznacz wszystko' }] },
    { label: 'Widok', submenu: [{ role: 'resetZoom', label: 'Rozmiar domyślny' }, { role: 'zoomIn', label: 'Powiększ' }, { role: 'zoomOut', label: 'Pomniejsz' }, { type: 'separator' }, { role: 'togglefullscreen', label: 'Pełny ekran' }] },
    { label: 'Okno', role: 'windowMenu' },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(t));
}

/* ---------- komunikacja z oknami ---------- */
const trusted = (e) => !!(e.senderFrame && typeof e.senderFrame.url === 'string' && e.senderFrame.url.startsWith('klaps://app/'));
function handle(channel, fn) { ipcMain.handle(channel, (e, ...a) => { if (!trusted(e)) throw new Error('Niedozwolone źródło'); return fn(e, ...a); }); }

function ipc() {
  const dir = projectsDir();
  handle('store:list', () => store.list(dir));
  handle('store:save', (_e, id, meta, plan, script, media) => store.save(dir, id, meta, plan, script, media));
  handle('store:load', (_e, id) => store.load(dir, id));
  handle('store:remove', (_e, id) => store.remove(dir, id));
  handle('profile:get', () => profile.get(dataDir()));
  handle('profile:set', (_e, p) => profile.set(dataDir(), p));
  handle('profile:prefs', (_e, p) => profile.setPrefs(dataDir(), p));
  const vault = () => secretsLib.open(dataDir(), { available: () => safeStorage.isEncryptionAvailable(), encrypt: (t) => safeStorage.encryptString(t), decrypt: (b) => safeStorage.decryptString(b) });
  handle('secrets:get', (_e, n) => vault().get(n));
  handle('secrets:set', (_e, n, v) => vault().set(n, v));
  handle('secrets:remove', (_e, n) => vault().remove(n));
  handle('secrets:info', () => ({ secure: vault().secure }));
  handle('session:get', () => session);
  handle('launcher:launch', (_e, raw) => {
    const intent = intents.validate(raw);
    if (!intent) return { ok: false, error: 'Niepoprawny wybór projektu.' };
    try { return openMain(intent); } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
  });
  handle('launcher:show', () => { void showLauncher(); });
  handle('launcher:quit', () => { if (alive(launcher)) launcher.close(); else app.quit(); });
  handle('file:save', async (_e, name, data) => {
    const safe = String(name).replace(/[\\/:*?"<>|]/g, '_');
    const target = alive(main) ? main : launcher;
    const r = await dialog.showSaveDialog(target, { defaultPath: path.join(app.getPath('documents'), 'Klaps Planer', safe) });
    if (r.canceled || !r.filePath) return { canceled: true };
    fs.mkdirSync(path.dirname(r.filePath), { recursive: true });
    fs.writeFileSync(r.filePath, Buffer.from(data instanceof Uint8Array ? data : typeof data === 'string' ? Buffer.from(data) : new Uint8Array(data)));
    return { canceled: false, path: r.filePath };
  });
  ipcMain.on('app:ready', (e) => { if (trusted(e) && alive(main) && e.sender === main.webContents) void revealMain(); });
  ipcMain.on('app:flushed', (e, id) => { if (trusted(e)) { const f = flushWaiters.get(id); if (f) f(); } });
}

/* ---------- start ---------- */
const single = app.requestSingleInstanceLock();
if (!single) app.quit();
else {
  app.on('second-instance', () => { const w = alive(main) ? main : launcher; if (alive(w)) { if (w.isMinimized()) w.restore(); w.show(); w.focus(); } });
  app.whenReady().then(() => {
    protocol.handle('klaps', async (req) => {
      const u = new URL(req.url);
      let rel = decodeURIComponent(u.pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const full = path.normalize(path.join(appDir(), rel));
      if (!full.startsWith(appDir() + path.sep)) return new Response('Forbidden', { status: 403 });
      try {
        const body = await fs.promises.readFile(full);
        return new Response(body, { headers: { 'Content-Type': MIME[path.extname(full).toLowerCase()] || 'application/octet-stream', 'Content-Security-Policy': CSP } });
      } catch (e) { return new Response('Not found', { status: 404 }); }
    });
    ipc();
    menu();
    // użytkownik wyłączył okno startowe i ma poprzedni projekt: otwieramy go od razu
    const p = profile.get(dataDir());
    if (p && p.prefs.showLauncher === false && p.prefs.lastProject && !process.env.KLAPS_FORCE_LAUNCHER) {
      const known = store.list(projectsDir()).some((m) => m.id === p.prefs.lastProject);
      if (known) { openMain({ type: 'open', source: 'local', id: p.prefs.lastProject }); return; }
    }
    createLauncher();
  });
  app.on('activate', () => { if (!alive(main) && !alive(launcher)) createLauncher(); });
  app.on('window-all-closed', () => { if (!IS_MAC) app.quit(); });
}
