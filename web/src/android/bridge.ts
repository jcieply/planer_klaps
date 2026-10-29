/* Wersja na Androida (Capacitor): ten sam most `window.klapsDesktop`, którego używa program na komputer, zbudowany na wtyczkach
   Capacitora. Dzięki temu okno startowe, licencja, zapis projektów do plików, chmura i eksporty działają tym samym kodem.
   - projekty: pliki w prywatnym folderze aplikacji (Directory.Data/Projekty), zapis przez plik tymczasowy + kopia .bak,
   - eksport PDF/XLSX/.klaps: plik w pamięci podręcznej + systemowe „Udostępnij” (zapis na Dysku, wysyłka mailem, komunikator),
   - profil, licencja i sekrety: Preferences (prywatne ustawienia aplikacji, niedostępne dla innych aplikacji),
   - zapis przed uśpieniem: zdarzenie „pause” (przełączenie aplikacji, wygaszenie ekranu). */
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Preferences } from '@capacitor/preferences';
import { Share } from '@capacitor/share';
import { App } from '@capacitor/app';
import type { DesktopProfile, DesktopSession, KlapsDesktop, LaunchIntent, LicenseResult, LicenseStatus } from '../desktop/bridge';
import { intentFromUrl, intentToQuery } from '../desktop/bridge';
import { checkKey, keyHint, knownHash } from '../lib/license';

declare const __KLAPS_VERSION__: string;

const DIR = 'Projekty';
const SAFE = /^[A-Za-z0-9_-]{1,80}$/;
const SECRET = /^[A-Za-z0-9_.:-]{1,120}$/;
const K = { profile: 'klaps.profile', license: 'klaps.license', secret: 'klaps.secret.' };

/* ---------- pliki ---------- */
const at = (name: string) => ({ path: `${DIR}/${name}`, directory: Directory.Data });
async function readText(name: string): Promise<string | null> {
  try { const r = await Filesystem.readFile({ ...at(name), encoding: Encoding.UTF8 }); return typeof r.data === 'string' ? r.data : await (r.data as Blob).text(); }
  catch { return null; }
}
async function exists(name: string) { try { await Filesystem.stat(at(name)); return true; } catch { return false; } }
/** zapis „atomowy”: plik tymczasowy → kopia poprzedniej wersji (.bak) → podmiana */
async function writeAtomic(name: string, data: string, backup?: string) {
  const tmp = name + '.tmp';
  await Filesystem.writeFile({ ...at(tmp), data, encoding: Encoding.UTF8, recursive: true });
  if (backup && await exists(name)) { try { await Filesystem.copy({ from: `${DIR}/${name}`, to: `${DIR}/${backup}`, directory: Directory.Data, toDirectory: Directory.Data }); } catch { /* kopia jest dodatkiem */ } }
  await Filesystem.rename({ from: `${DIR}/${tmp}`, to: `${DIR}/${name}`, directory: Directory.Data, toDirectory: Directory.Data });
}
async function readJson<T>(name: string, backup?: string): Promise<T | null> {
  for (const f of [name, backup]) {
    if (!f) continue;
    const t = await readText(f);
    if (t == null) continue;
    try { return JSON.parse(t) as T; } catch { /* uszkodzony – próbujemy kopię */ }
  }
  return null;
}
const checkId = (id: string) => { if (typeof id !== 'string' || !SAFE.test(id)) throw new Error('Niepoprawny identyfikator projektu'); return id; };

const store: KlapsDesktop['store'] = {
  async list() {
    let files: string[] = [];
    try { files = (await Filesystem.readdir(at(''))).files.map((f: any) => (typeof f === 'string' ? f : f.name)); } catch { return []; }
    const out: any[] = [];
    for (const f of files) {
      if (!f.endsWith('.meta.json')) continue;
      const m = await readJson<any>(f);
      if (m && m.id && files.includes(m.id + '.klaps.json')) out.push(m);
    }
    return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },
  async save(id, meta, plan, script, media) {
    checkId(id);
    await writeAtomic(id + '.klaps.json', JSON.stringify({ v: 1, id, plan, script, media }), id + '.bak');
    await writeAtomic(id + '.meta.json', JSON.stringify(Object.assign({}, meta, { id })));
    return true;
  },
  async load(id) {
    checkId(id);
    const o = await readJson<{ plan: string; script?: string; media?: string }>(id + '.klaps.json', id + '.bak');
    return o ? { plan: o.plan, script: o.script || '', media: o.media || '' } : null;
  },
  async remove(id) {
    checkId(id);
    for (const f of ['.klaps.json', '.bak', '.meta.json']) { try { await Filesystem.deleteFile(at(id + f)); } catch { /* brak */ } }
    return true;
  },
};

/* ---------- eksport: plik + systemowe „Udostępnij” ---------- */
const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000) as unknown as number[]); return btoa(s); };
const safeName = (n: string) => String(n || 'plik').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 120);
async function saveFile(name: string, data: Uint8Array | string): Promise<{ canceled?: boolean; path?: string }> {
  const file = safeName(name);
  const w = typeof data === 'string'
    ? await Filesystem.writeFile({ path: 'eksport/' + file, data, directory: Directory.Cache, encoding: Encoding.UTF8, recursive: true })
    : await Filesystem.writeFile({ path: 'eksport/' + file, data: b64(data), directory: Directory.Cache, recursive: true });
  try {
    await Share.share({ title: file, dialogTitle: file, files: [w.uri] });
    return { path: w.uri };
  } catch (e: any) {
    if (/cancel/i.test(String(e && e.message))) return { canceled: true };
    // brak systemowego udostępniania (np. podgląd w przeglądarce) – zwykłe pobranie pliku
    const blob = typeof data === 'string' ? new Blob([data]) : new Blob([data as BlobPart]);
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    return { path: file };
  }
}

/* ---------- profil (jak electron/profile.js) ---------- */
const clean = (s: unknown, max: number) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
function normProfile(o: any): DesktopProfile | null {
  if (!o || typeof o !== 'object') return null;
  const name = clean(o.name, 80);
  if (name.length < 2) return null;
  const prefs = o.prefs && typeof o.prefs === 'object' ? o.prefs : {};
  return {
    v: 1, id: typeof o.id === 'string' && o.id ? o.id : crypto.randomUUID(), name, role: clean(o.role, 80),
    createdAt: Number(o.createdAt) || Date.now(), lastOpenedAt: Number(o.lastOpenedAt) || 0, account: { provider: 'local' },
    prefs: { showLauncher: prefs.showLauncher !== false, lastProject: typeof prefs.lastProject === 'string' && prefs.lastProject ? prefs.lastProject : null },
  };
}
const pget = async (k: string) => (await Preferences.get({ key: k })).value;
const pset = (k: string, v: string) => Preferences.set({ key: k, value: v });
async function getProfile() { try { return normProfile(JSON.parse((await pget(K.profile)) || 'null')); } catch { return null; } }
async function putProfile(p: DesktopProfile) { await pset(K.profile, JSON.stringify(p)); return p; }
const profile: KlapsDesktop['profile'] = {
  get: getProfile,
  async set(input) {
    const name = clean(input && input.name, 80);
    if (name.length < 2) throw new Error('Wpisz imię i nazwisko (co najmniej 2 znaki).');
    const cur = await getProfile();
    return putProfile(normProfile(Object.assign({}, cur || { createdAt: Date.now() }, { name, role: clean(input.role, 80) }))!);
  },
  async setPrefs(patch) {
    const cur = await getProfile();
    if (!cur) throw new Error('Brak profilu.');
    if (typeof patch.showLauncher === 'boolean') cur.prefs.showLauncher = patch.showLauncher;
    if (patch.lastProject === null || typeof patch.lastProject === 'string') cur.prefs.lastProject = patch.lastProject || null;
    return putProfile(cur);
  },
};

/* ---------- licencja ---------- */
async function licenseStatus(): Promise<LicenseStatus> {
  let o: any = null;
  try { o = JSON.parse((await pget(K.license)) || 'null'); } catch { o = null; }
  if (!o || typeof o.hash !== 'string') return { active: false };
  const k = knownHash(o.hash);
  if (!k) return { active: false, revoked: true };
  return { active: true, id: k.id, label: k.label, at: +o.at || 0, hint: typeof o.hint === 'string' ? o.hint : '' };
}
async function licenseActivate(key: string): Promise<LicenseResult> {
  const c = await checkKey(key);
  if (!c.ok) { await new Promise((r) => setTimeout(r, 700)); return c; }
  await pset(K.license, JSON.stringify({ v: 1, hash: c.hash, at: Date.now(), hint: keyHint(key) }));
  return { ok: true, id: c.id };
}

/* ---------- okna (na telefonie: dwie strony tej samej aplikacji) ---------- */
async function launch(intent: LaunchIntent) {
  if (!(await licenseStatus()).active) return { ok: false, error: 'Brak aktywnej licencji. Wpisz klucz licencyjny w oknie startowym.' };
  if (intent.type === 'open' && intent.source === 'local') { try { const p = await getProfile(); if (p) { p.prefs.lastProject = intent.id; p.lastOpenedAt = Date.now(); await putProfile(p); } } catch { /* brak profilu */ } }
  location.assign('index.html' + intentToQuery(intent));
  return { ok: true };
}

let flushHandler: (() => Promise<void> | void) | null = null;
const flush = async () => { try { await flushHandler?.(); } catch { /* zapis zgłasza błąd sam */ } };

/** okno programu na telefonie: bez licencji albo bez wybranego projektu wraca do okna startowego */
export async function guardMain(): Promise<boolean> {
  if (!(await licenseStatus()).active || !intentFromUrl()) { location.replace('launcher.html'); return false; }
  return true;
}

export function installAndroid(): void {
  const windowKind: 'launcher' | 'main' = /launcher\.html$/.test(location.pathname) ? 'launcher' : 'main';
  const bridge: KlapsDesktop = {
    platform: 'android',
    version: typeof __KLAPS_VERSION__ === 'string' ? __KLAPS_VERSION__ : '',
    pdfjsBase: './vendor/pdfjs/',
    windowKind,
    store,
    saveFile,
    onMenu: () => {},
    onFlush: (f) => { flushHandler = f; },
    profile,
    launcher: {
      launch,
      show: async () => { await flush(); location.assign('launcher.html'); },
      quit: async () => { await flush(); try { await App.exitApp(); } catch { /* przeglądarka */ } },
    },
    secrets: {
      get: async (n) => { if (!SECRET.test(n)) throw new Error('Niepoprawna nazwa sekretu'); return pget(K.secret + n); },
      set: async (n, v) => { if (!SECRET.test(n) || typeof v !== 'string' || v.length > 20000) throw new Error('Niepoprawny sekret'); await pset(K.secret + n, v); return true; },
      remove: async (n) => { await Preferences.remove({ key: K.secret + n }); return true; },
      // prywatne ustawienia aplikacji (bez szyfrowania systemowym magazynem kluczy)
      info: async () => ({ secure: false }),
    },
    license: { status: licenseStatus, activate: licenseActivate },
    ready: () => {},
    session: async (): Promise<DesktopSession> => {
      const p = await getProfile();
      const i = intentFromUrl();
      return { account: p ? { id: p.id, name: p.name, provider: 'local' } : null, source: (i && i.source) || 'local', mode: 'local' };
    },
  };
  window.klapsDesktop = bridge;
  document.documentElement.classList.add('is-android');

  // przełączenie aplikacji / wygaszenie ekranu: najpierw zapis
  void App.addListener('pause', () => { void flush(); }).catch(() => undefined);
  // przycisk „Wstecz”: zamyka otwarte okno, w programie wraca do okna startowego, w oknie startowym zamyka aplikację
  void App.addListener('backButton', () => {
    const esc = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
    if (document.querySelector('.modal, .drawer, [role="dialog"], .sheet')) { (document.activeElement || document.body).dispatchEvent(esc); return; }
    if (windowKind === 'main') void bridge.launcher.show();
    else void bridge.launcher.quit();
  }).catch(() => undefined);
}
