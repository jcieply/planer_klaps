/* Operacje aplikacji: otwieranie i zapis projektów, import, eksport, szyfrowanie, synchronizacja. */
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import { Parser } from '../domain/parser';
import { Reports } from '../domain/reports';
import { Store } from '../domain/store';
import { Sync } from '../domain/sync';
import { Table } from '../domain/table';
import { demoState } from '../domain/demo';
import { SAMPLE_SCRIPT } from '../domain/sample';
import { decodeText, docxXml, extractPdf, MIME, saveFile } from '../domain/files';
import { KLAPS_EXT, isKlaps, readKlaps } from '../domain/klapsfile';
import { describeZod, EncryptedFileSchema, ProjectFileSchema, type Geo, type ProjectState } from '../domain/model';
import { I18N, T_ } from '../domain/i18n';
import { clearHistory, flags, getSt, mutate, useProject } from './project';
import * as cloud from '../collab/cloud';
import { closeCloud, flushCloud, isCloud, openCloud, useCollab } from '../collab/session';
import { setUI, toast, ui } from './ui';
import { pl, plN } from '../lib/format';
import { desktop, intentFromUrl } from '../desktop/bridge';
import { FORECAST_DAYS, forecast, geocode, placeFor } from '../lib/weather';

const P = () => useProject.getState();

/* ---------- zapis: automatycznie 700 ms po każdej zmianie projektu ---------- */
let saveTimer: ReturnType<typeof setTimeout> | null = null;
let saving = false, pending = false;
export const hasPendingSave = () => !!saveTimer;
/** anuluje zaplanowany zapis (np. przed zaszyfrowaniem projektu, aby nie zapisać jawnej wersji) */
export function cancelSave() { if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; } }
export function queueSave() {
  if (!P().st || isCloud()) return;
  P().setSave('busy');
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void doSave(); }, 700);
}
export async function doSave() {
  if (isCloud()) return;
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  const { st, pid } = P();
  if (!st || !pid) return;
  if (saving) { pending = true; return; }
  saving = true;
  try {
    const meta = await Store.save(pid, st);
    const list = P().projects.slice();
    const i = list.findIndex((p) => p.id === pid);
    if (i >= 0) list[i] = meta; else list.unshift(meta);
    P().setProjects(list);
    P().setSave(Store.mode === 'memory' ? 'mem' : 'saved');
    Sync.touch();
    void autoSnapshot(pid, st);
  } catch (e: any) {
    P().setSave('err');
    toast(T('Nie udało się zapisać projektu: {e}', { e: e && e.message ? e.message : T('nieznany błąd') }), 'bad');
  }
  saving = false;
  if (pending) { pending = false; void doSave(); } else settle();
}
const idle: Array<() => void> = [];
const settle = () => { if (!saving && !pending && !saveTimer) idle.splice(0).forEach((f) => f()); };
/** zapis „teraz” i czekanie, aż dane naprawdę trafią na dysk (zamknięcie okna, wyjście z programu) */
export async function flushSave() {
  if (isCloud()) { await flushCloud(); return; }
  await doSave();
  if (saving || pending) await new Promise<void>((r) => idle.push(r));
}
// każda zmiana danych otwartego projektu → zapis
useProject.subscribe((s, prev) => { if (s.st && s.st !== prev.st && s.pid === prev.pid && !applyingRemote && !flags.remote) queueSave(); });
let applyingRemote = false;

/* ---------- historia wersji ---------- */
export const AUTO_SNAPSHOT_MIN = 30;
const lastAuto = new Map<string, number>();
let snapping = false;
/** automatyczna wersja co 30 minut pracy (tylko gdy coś się zmieniło) */
async function autoSnapshot(pid: string, st: ProjectState) {
  if (snapping) return;
  if (!lastAuto.has(pid)) { try { const l = await Store.snapshots(pid); lastAuto.set(pid, l.length ? l[0].at : 0); } catch { lastAuto.set(pid, 0); } }
  if (Date.now() - (lastAuto.get(pid) || 0) < AUTO_SNAPSHOT_MIN * 60000) return;
  snapping = true;
  try { const m = await Store.snapshot(pid, st, T_('Automatyczna kopia'), true); lastAuto.set(pid, m ? m.at : Date.now()); } catch { /* historia nie może blokować zapisu */ }
  snapping = false;
}
/** wersja przed ryzykowną operacją (import, plan od nowa, przywrócenie) – stan sprzed zmiany jest niezmienny, więc zapis może trwać w tle */
export function snapshotBefore(label: string) {
  const { st, pid } = P();
  if (!st || !pid) return Promise.resolve(null);
  return Store.snapshot(pid, st, label, false).catch(() => null);
}
export async function snapshotNow(label: string) {
  const { st, pid } = P();
  if (!st || !pid) return null;
  await doSave();
  const m = await Store.snapshot(pid, st, label || T_('Wersja zapisana ręcznie'), false);
  toast(T('Zapisano wersję projektu.'));
  return m;
}
/** przywrócenie wersji: bieżący stan trafia najpierw do historii; mapki zostają z bieżącego projektu; krok da się cofnąć */
export async function restoreSnapshot(id: string) {
  const { st, pid } = P();
  if (!st || !pid) return;
  const old = await Store.snapshotState(id);
  await snapshotBefore(T_('Przed przywróceniem wersji'));
  old.media = { ...(st.media || {}) };
  useProject.setState({ st: old });
  setUI((s) => { s.sel = []; s.drawer = null; s.history = false; s.csDay = null; });
  toast(T('Przywrócono wersję projektu. Możesz to cofnąć (Ctrl+Z).'));
}

/* ---------- projekty ---------- */
export async function refreshProjects() { P().setProjects(await Store.list()); }
export async function openProject(id: string) {
  let st: ProjectState | null;
  try { st = await Store.load(id); }
  catch (e: any) {
    if (e && e.locked) {
      P().load(id, null); P().setLocked({ id }); clearHistory();
      setUI((s) => { s.settings = false; s.pw = null; s.more = false; s.drawer = null; });
      try { localStorage.setItem('klaps.active', id); } catch { /* brak */ }
      return;
    }
    throw e;
  }
  if (!st) { toast(T('Nie udało się otworzyć projektu.'), 'bad'); return; }
  P().load(id, st); clearHistory();
  setUI((s) => { s.sel = []; s.drawer = null; s.imp = { status: 'idle' }; s.f = { q: '', ie: '', tod: '', cast: '', site: '', plan: '' }; s.month = null; s.confirmDel = false; s.tab = 'home'; s.more = false; s.shImp = null; s.csDay = null; });
  try { localStorage.setItem('klaps.active', id); } catch { /* brak */ }
}
/** otwiera projekt z chmury (praca zespołowa, zaszyfrowana end-to-end) */
export async function openCloudProject(id: string) {
  const st = await openCloud(id);
  P().load(id, st); clearHistory();
  setUI((s) => { s.sel = []; s.drawer = null; s.imp = { status: 'idle' }; s.f = { q: '', ie: '', tod: '', cast: '', site: '', plan: '' }; s.month = null; s.confirmDel = false; s.tab = st.scenes.length ? 'home' : 'import'; s.more = false; s.shImp = null; s.csDay = null; s.settings = false; });
  P().setSave('saved');
}
/** kopiuje otwarty projekt lokalny do chmury (zostaje też lokalnie) i otwiera kopię w chmurze */
export async function shareToCloud() {
  const { st, pid } = P();
  if (!st || !pid || isCloud()) return;
  setUI((s) => { s.busy = T('Przenoszę projekt do chmury…'); });
  try {
    await doSave();
    const copy = JSON.parse(JSON.stringify(st)) as ProjectState;
    const id = await cloud.createProject(copy.meta.title || T('Projekt'), copy);
    setUI((s) => { s.busy = null; });
    await openCloudProject(id);
    toast(T('Projekt jest w chmurze. Zaproś osoby w oknie startowym (Zarządzanie).'));
  } catch (e: any) {
    setUI((s) => { s.busy = null; });
    toast(T('Nie udało się udostępnić projektu: {e}', { e: e && e.message ? e.message : T('nieznany błąd') }), 'bad');
  }
}
/** zakłada projekt w chmurze z podanego stanu (pusty, przykład albo kopia lokalnego) i go otwiera */
export async function createCloudProject(title: string, state?: ProjectState) {
  const st = state || Core.newState();
  st.meta.title = title || st.meta.title || T('Nowy projekt');
  const id = await cloud.createProject(st.meta.title, st);
  await openCloudProject(id);
  return id;
}
export async function newProject(title?: string | null, state?: ProjectState, key?: any) {
  const id = Core.uid();
  const st = state || Core.newState();
  if (title != null) st.meta.title = title;
  if (key) Store.adoptKey(id, key);
  P().load(id, st); clearHistory();
  setUI((s) => { s.sel = []; s.drawer = null; s.imp = { status: 'idle' }; s.month = null; s.tab = st.scenes.length ? 'home' : 'import'; s.more = false; s.shImp = null; s.csDay = null; });
  try { localStorage.setItem('klaps.active', id); } catch { /* brak */ }
  await doSave();
}
export async function switchProject(id: string) {
  if (id === '__new') { await doSave(); await newProject(T('Nowy projekt')); return; }
  if (id === P().pid) return;
  await doSave();
  await openProject(id);
}
export async function deleteProject() {
  const id = P().pid!;
  if (isCloud()) {
    // projekt w chmurze: właściciel usuwa go dla wszystkich, pozostali tylko opuszczają
    try {
      const owner = useCollab.getState().role === 'owner';
      await closeCloud();
      if (owner) await cloud.deleteProject(id); else await cloud.leaveProject(id);
      await cloud.cacheDrop(id);
    } catch (e: any) { toast(T('Nie udało się usunąć projektu: {e}', { e: e.message }), 'bad'); return; }
    setUI((s) => { s.settings = false; s.confirmDel = false; });
    P().load(null as any, null as any); clearHistory();
    await desktop()!.launcher.show();
    return;
  }
  try { await Store.remove(id); void Sync.removed(id); } catch (e: any) { toast(T('Nie udało się usunąć projektu: {e}', { e: e.message }), 'bad'); return; }
  const list = P().projects.filter((p) => p.id !== id);
  P().setProjects(list);
  setUI((s) => { s.settings = false; s.confirmDel = false; });
  if (desktop()) {
    // aplikacja na komputer: po usunięciu wracamy do okna startowego (bez ponownego zapisu usuniętego projektu)
    cancelSave(); P().load(null as any, null as any); clearHistory();
    await desktop()!.launcher.show();
    return;
  }
  if (list.length) await openProject(list[0].id); else await newProject(T('Nowy projekt'));
  toast(T('Projekt został usunięty.'));
}

/* ---------- start ---------- */
export async function boot() {
  try { await Store.init(); await refreshProjects(); } catch { P().setProjects([]); }
  Sync.setHooks({
    isDirty: (id: string) => P().pid === id && hasPendingSave(),
    onRemote: async (id: string) => {
      if (P().pid !== id || !P().st) return;
      try {
        const st = await Store.load(id);
        applyingRemote = true; P().load(id, st); applyingRemote = false;
        toast(T('Projekt zaktualizowany zmianami z innego urządzenia.'));
      } catch (e: any) {
        applyingRemote = false;
        // projekt zaszyfrowano na innym urządzeniu: tu trzeba podać hasło
        if (e && e.locked) { P().load(id, null); P().setLocked({ id }); setUI((s) => { s.settings = false; s.drawer = null; }); }
      }
    },
    onList: refreshProjects,
    toast: (m: string, k?: '' | 'bad') => toast(m, k || ''),
  });
  // aplikacja na komputer: okno startowe przekazuje, co otworzyć albo utworzyć
  const intent = desktop() ? intentFromUrl() : null;
  if (intent && intent.source === 'cloud') {
    try {
      if (intent.type === 'open') await openCloudProject(intent.id);
      else {
        const st = intent.template === 'demo' ? demoState() : undefined;
        if (st && intent.title) st.demo = false;
        await createCloudProject(intent.title || (st ? st.meta.title : T('Nowy projekt')), st);
      }
      if (P().st) return;
    } catch (e: any) {
      // bez klucza, internetu albo uprawnień wracamy do okna startowego z wyjaśnieniem
      toast(e && e.message ? e.message : T('Nie udało się otworzyć projektu z chmury.'), 'bad');
      await desktop()!.launcher.show();
      return;
    }
  }
  if (intent) {
    try {
      if (intent.type === 'open') await openProject(intent.id);
      else {
        const st = intent.template === 'demo' ? demoState() : undefined;
        if (st && intent.title) st.demo = false;
        await newProject(intent.title || (st ? null : T('Nowy projekt')), st);
      }
      if (P().st || P().locked) { Sync.start(); return; }
    } catch { /* wracamy do ostatnio otwartego projektu */ }
  }
  let active: string | null = null;
  try { active = localStorage.getItem('klaps.active'); } catch { active = null; }
  const list = P().projects;
  const target = list.find((p) => p.id === active) || list[0];
  if (target) {
    try { await openProject(target.id); Sync.start(); return; } catch { /* utwórz nowy */ }
  }
  const demo = demoState();
  await newProject(demo.meta.title, demo);
  setUI((s) => { s.tab = 'home'; });
  Sync.start();
  if (Store.mode === 'memory') toast(T('Ta przeglądarka nie zachowuje danych. Zapisuj projekt do pliku w zakładce Eksport.'), 'bad');
}

/* ---------- eksport ---------- */
export async function doExport(kind: 'pdf' | 'xlsx', sections: string[], suffix: string | [string, Record<string, unknown>], opts?: Record<string, unknown>) {
  if (!sections.length) { toast(T('Zaznacz przynajmniej jedną sekcję do eksportu.'), 'bad'); return; }
  const st = getSt();
  setUI((s) => { s.busy = kind === 'pdf' ? T('Tworzę PDF…') : T('Tworzę plik Excel…'); });
  await new Promise((r) => setTimeout(r, 30));
  try {
    const bytes = kind === 'pdf' ? await Reports.buildPdf(st, sections, opts) : await Reports.buildXlsx(st, sections, opts);
    const suf = I18N.withLang(st.meta.docLang || I18N.lang, () => (Array.isArray(suffix) ? T(suffix[0], suffix[1]) : T(suffix)));
    const name = `${Reports.fileStem(st)}_${suf}.${kind}`;
    setUI((s) => { s.busy = null; });
    const r = await saveFile(name, bytes, MIME[kind]);
    if (r === 'saved') toast(T('Plik {f} gotowy do pobrania.', { f: name }));
  } catch (e: any) {
    setUI((s) => { s.busy = null; });
    toast(T('Eksport nie powiódł się: {e}', { e: e && e.message ? e.message : e }), 'bad');
  }
}
export async function exportProjectJson() {
  const { st, pid } = P();
  if (!st || !pid) return;
  try {
    const enc = Store.isEncrypted(pid);
    const name = `${Reports.fileStem(st)}_${T('projekt')}${enc ? '_E2E' : ''}.json`;
    const r = await saveFile(name, await Store.exportFile(pid, st), MIME.json);
    if (r === 'saved') toast(enc ? T('Zaszyfrowana kopia projektu {f} gotowa do pobrania. Otworzysz ją tylko hasłem projektu.', { f: name }) : T('Kopia projektu {f} gotowa do pobrania.', { f: name }));
  } catch (e: any) { toast(T('Nie udało się zapisać kopii: {e}', { e: e.message }), 'bad'); }
}
/** zapis projektu do pliku .klaps (zalecany format) */
export async function exportProjectFile() {
  const { st, pid } = P();
  if (!st || !pid) return;
  try {
    const enc = Store.isEncrypted(pid);
    const name = `${Reports.fileStem(st)}${enc ? '_E2E' : ''}.${KLAPS_EXT}`;
    const r = await saveFile(name, await Store.exportKlaps(pid, st), MIME.klaps);
    if (r === 'saved') toast(enc ? T('Zaszyfrowana kopia projektu {f} gotowa do pobrania. Otworzysz ją tylko hasłem projektu.', { f: name }) : T('Kopia projektu {f} gotowa do pobrania.', { f: name }));
  } catch (e: any) { toast(T('Nie udało się zapisać kopii: {e}', { e: e.message }), 'bad'); }
}
/** wczytanie projektu z pliku .klaps albo .json (starsze wersje) */
export async function importProjectFile(file: File) {
  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (isKlaps(bytes)) {
      const c = await readKlaps(bytes, Store.join);
      if (c.kind === 'encrypted') { setUI((s) => { s.pw = { kind: 'file', obj: c.raw }; s.settings = false; }); return; }
      await newProject((c.st.meta.title || T('Projekt')) + ' ' + T('(kopia)'), c.st);
      toast(T('Wczytano projekt z pliku.'));
      return;
    }
    let o: unknown;
    try { o = JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new Error(T('To nie jest plik projektu Klaps')); }
    if (Store.isEncryptedFile(o)) {
      const v = EncryptedFileSchema.safeParse(o);
      if (!v.success) throw new Error(describeZod(v.error));
      setUI((s) => { s.pw = { kind: 'file', obj: v.data }; s.settings = false; });
      return;
    }
    const v = ProjectFileSchema.safeParse(o);
    if (!v.success) throw new Error(T('To nie jest plik projektu Klaps') + ' (' + describeZod(v.error) + ')');
    const st = Core.normalize(v.data);
    await newProject((st.meta.title || T('Projekt')) + ' ' + T('(kopia)'), st);
    toast(T('Wczytano projekt z pliku.'));
  } catch (e: any) { toast(T('Nie udało się wczytać projektu: {e}', { e: e.message }), 'bad'); }
}

/* ---------- import scenariusza ---------- */
export async function handleScriptFile(file: File) {
  setUI((s) => { s.imp = { status: 'reading', file: file.name, progress: T('Czytam plik…') }; s.paste = false; });
  await new Promise((r) => setTimeout(r, 20));
  try {
    const buf = await file.arrayBuffer();
    const name = file.name.toLowerCase();
    let raw: any;
    if (/\.pdf$/.test(name)) raw = { kind: 'pdf', pages: await extractPdf(buf, (m) => setUI((s) => { s.imp.progress = m; })) };
    else if (/\.fdx$/.test(name)) raw = { kind: 'fdx', text: decodeText(buf) };
    else if (/\.docx$/.test(name)) raw = { kind: 'docx', xml: await docxXml(buf) };
    else if (/\.(doc|rtf|odt|pages)$/.test(name)) throw new Error(T('Ten format Worda nie jest obsługiwany. Zapisz scenariusz jako .docx lub PDF.'));
    else raw = { kind: 'text', text: decodeText(buf) };
    const parsed = runParse(raw);
    setUI((s) => { s.imp = { status: 'ready', file: file.name, raw, parsed, keep: getSt().scenes.length > 0 }; });
  } catch (e: any) {
    setUI((s) => { s.imp = { status: 'error', file: file.name, error: e && e.message ? e.message : String(e) }; });
  }
}
export function handlePaste() {
  const text = ui().pasteText.trim();
  if (!text) { toast(T('Wklej najpierw tekst scenariusza.'), 'bad'); return; }
  const raw = { kind: 'text', text };
  try { const parsed = runParse(raw); setUI((s) => { s.imp = { status: 'ready', file: T('Wklejony tekst'), raw, parsed, keep: getSt().scenes.length > 0 }; s.paste = false; }); }
  catch (e: any) { setUI((s) => { s.imp = { status: 'error', file: T('Wklejony tekst'), error: e.message }; }); }
}
export function runParse(raw: any) {
  const st = getSt();
  const o: any = { castFromAction: st.meta.castMode || 'all' };
  if (raw.kind === 'text' || raw.kind === 'fdx' || raw.kind === 'docx') o.linesPerPage = +st.meta.linesPerPage || 55;
  if (raw.kind === 'pdf') return Parser.fromPdfPages(raw.pages, o);
  if (raw.kind === 'fdx') return Parser.fromFdx(raw.text, o);
  if (raw.kind === 'docx') return Parser.fromDocxXml(raw.xml, o);
  return Parser.fromText(raw.text, o);
}
export function reparse() { const imp = ui().imp; if (imp.raw) { const parsed = runParse(imp.raw); setUI((s) => { s.imp.parsed = parsed; }); } }
export function applyImportNow() {
  const imp = ui().imp, p = imp.parsed;
  if (!p || !p.scenes.length) return;
  if (getSt().scenes.length) void snapshotBefore(T_('Przed importem scenariusza'));
  mutate((st) => { Core.applyImport(st, p, { keep: !!imp.keep, title: p.title, file: imp.file }); st.demo = false; });
  setUI((s) => { s.imp = { status: 'idle' }; s.sel = []; s.drawer = null; s.confirmReplace = false; s.tab = 'board'; });
  const st = getSt();
  toast(T('Utworzono rozpiskę: {a}, {b}.', { a: `${st.scenes.length} ${pl(st.scenes.length, 'scena', 'sceny', 'scen')}`, b: `${st.cast.length} ${pl(st.cast.length, 'postać', 'postacie', 'postaci')}` }));
}
export function loadSample() {
  const raw = { kind: 'text', text: SAMPLE_SCRIPT };
  try { const parsed = runParse(raw); setUI((s) => { s.imp = { status: 'ready', file: T('przykładowy scenariusz') + '.fountain', raw, parsed, keep: getSt().scenes.length > 0 }; }); }
  catch (e: any) { setUI((s) => { s.imp = { status: 'error', file: T('przykład'), error: e.message }; }); }
}

/* ---------- import shotlisty (XLSX / XLS / CSV) ---------- */
export async function readShotFile(file: File) {
  setUI((s) => { s.busy = T('Czytam plik…'); });
  await new Promise((r) => setTimeout(r, 20));
  try {
    const data = await Table.readFile(file);
    let best = 0, bestN = -1;
    data.sheets.forEach((sh: any, i: number) => { const h = Table.findHeader(sh.rows); const mp = Table.guessMap(sh.rows[h] || []); const n = Object.values(mp).filter((v: any) => v >= 0).length; if (n > bestN) { bestN = n; best = i; } });
    const header = Table.findHeader(data.sheets[best].rows);
    setUI((s) => { s.shImp = { data, sheet: best, header, map: Table.guessMap(data.sheets[best].rows[header] || []), mode: 'append', create: true }; });
  } catch (e: any) {
    toast(T('Nie udało się odczytać pliku: {e}', { e: e && e.message ? e.message : e }), 'bad');
  }
  setUI((s) => { s.busy = null; });
}
export function applyShotImport() {
  const m = ui().shImp; if (!m) return;
  const sheet = m.data.sheets[m.sheet] || m.data.sheets[0];
  const pv = Table.preview(getSt(), sheet.rows, m.header, m.map, { create: m.create });
  if (getSt().shots.length) void snapshotBefore(T_('Przed importem shotlisty'));
  let n = 0;
  mutate((st) => { n = Table.apply(st, pv, { mode: m.mode, create: m.create }); });
  setUI((s) => { s.shImp = null; s.shF.scene = ''; });
  toast(T('Zaimportowano {a}{b}.', { a: plN(n, 'ujęcie', 'ujęcia', 'ujęć'), b: pv.newScenes.length ? ', ' + T('dodano sceny: {l}', { l: pv.newScenes.map((x: any) => x.num).join(', ') }) : '' }));
}

/* ---------- szyfrowanie ---------- */
export async function unlockLocked(pw: string) {
  const L = P().locked; if (!L || L.busy) return;
  if (!pw) { P().setLocked({ ...L, err: T('Wpisz hasło.') }); return; }
  P().setLocked({ ...L, busy: true, err: '' });
  try {
    await Store.unlock(L.id, pw);
    await openProject(L.id);
    await refreshProjects();
  } catch (e: any) {
    P().setLocked({ id: L.id, busy: false, err: e && e.badKey ? T('Nieprawidłowe hasło.') : (e && e.message) || String(e) });
  }
}
export async function lockCurrent() {
  const { pid } = P();
  if (!pid || !Store.isEncrypted(pid)) return;
  await doSave();
  Store.lock(pid);
  P().load(pid, null); P().setLocked({ id: pid }); clearHistory();
  setUI((s) => { s.settings = false; s.pw = null; s.drawer = null; });
  await refreshProjects();
}

/* ---------- pogoda ---------- */
/** prognoza dla dni zdjęciowych: położenie z lokacji dnia (zapamiętywane w lokacji), prognoza i godziny słońca do planu pracy */
/** force = jawne kliknięcie „Pobierz prognozę”: zastępuje też wpisy ręczne (krok da się cofnąć) */
export async function loadWeather(dayIds: string[], quiet = false, force = false) {
  const st0 = getSt();
  const days = dayIds.map((id) => st0.days.find((d) => d.id === id)).filter((d): d is NonNullable<typeof d> => !!d && d.kind === 'shoot' && !!d.date);
  if (!days.length) { if (!quiet) toast(T('Dzień nie ma daty – ustaw ją w kalendarzówce.'), 'bad'); return 0; }
  setUI((s) => { s.busy = T('Pobieram prognozę pogody…'); });
  const geoCache = new Map<string, Geo>();
  let ok = 0, sunOnly = 0, missing = 0;
  try {
    for (const d of days) {
      const place = placeFor(getSt(), d);
      if (!place) { missing++; continue; }
      let geo = place.geo;
      if (!geo) {
        geo = geoCache.get(place.query) || await geocode(place.query, I18N.lang);
        geoCache.set(place.query, geo);
        const g = geo;
        if (place.site) mutate((x) => { const o = x.sites[place.site] = x.sites[place.site] || Core.siteEntry(); o.geo = g; });
      }
      const w = await forecast(geo, d.date);
      mutate((x) => {
        const sh = Core.ensureSheet(x, d.id), prev = sh.wx;
        const auto = (cur: string, old: string | undefined) => force || !cur || (!!old && cur === old);
        if (w.text && auto(sh.weather, prev?.text)) sh.weather = w.text;
        if (w.sunrise && auto(sh.sunrise, prev?.sunrise)) sh.sunrise = w.sunrise;
        if (w.sunset && auto(sh.sunset, prev?.sunset)) sh.sunset = w.sunset;
        sh.wx = w;
      });
      if (w.text) ok++; else sunOnly++;
    }
  } catch (e: any) {
    setUI((s) => { s.busy = null; });
    toast(e && e.message ? e.message : String(e), 'bad');
    return ok;
  }
  setUI((s) => { s.busy = null; });
  if (quiet) return ok;
  if (missing && !ok && !sunOnly) toast(T('Brak miejsca do prognozy: uzupełnij adres lokacji (zakładka Lokacje) albo miejscowość bazy produkcji w ustawieniach.'), 'bad');
  else if (sunOnly && !ok) toast(T('Prognoza pogody jest dostępna najwcześniej {n} dni przed zdjęciami. Uzupełniono wschód i zachód słońca.', { n: FORECAST_DAYS }));
  else toast(T('Pobrano prognozę: {n}.', { n: plN(ok, 'dzień', 'dni', 'dni') }) + (sunOnly ? ' ' + T('Dla dalszych dni uzupełniono wschód i zachód słońca.') : ''));
  return ok;
}
