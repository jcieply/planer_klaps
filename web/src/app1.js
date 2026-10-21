/* ===== APLIKACJA: stan, pomocniki, import pliku, projekty, zapis ===== */
let S = null; // aktywny projekt
let PID = null;
let PROJECTS = [];
const UI = {
  tab: 'import', drawer: null, sel: new Set(), lastSel: null,
  f: { q: '', ie: '', tod: '', cast: '', site: '', plan: '' },
  pool: { q: '', sort: 'script' },
  calView: 'days', month: null, autoplan: false, ap: { strategy: 'site', scope: 'unscheduled', separateNight: true },
  settings: false, confirmDel: false, imp: { status: 'idle' }, paste: false, pasteText: '',
  exp: { calendar: true, board: true, shotlist: true, cast: true, crew: true, sites: true, dood: true, callsheet: true, transport: true, budget: true }, csDay: null, trDay: '',
  crewOpen: new Set(), crewF: { q: '', dept: '' }, shF: { scene: '' },
  save: 'saved', toast: null, busy: null, refocus: null, showScript: false, confirmReplace: false,
};
const appEl = () => document.getElementById('app');
/** polska odmiana liczebnikowa: 1 scena, 2 sceny, 5 scen */
const pl = (n, one, few, many) => Core.pl(n, one, few, many);
const $q = (sel, root) => (root || document).querySelector(sel);
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ICON = {
  clap: '<svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true"><path d="M3 10h20v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V10Z" fill="#F2F5F7"/><path d="M2.6 5.4 21.2 2l1 4.6-18.6 3.4-1-4.6Z" fill="#58C2CB"/><path d="m7.2 4.6 3 4.2M12 3.7l3 4.2M16.8 2.8l3 4.2" stroke="#25313A" stroke-width="2"/><path d="M7 15h12M7 19h8" stroke="#25313A" stroke-width="1.6" stroke-linecap="round"/></svg>',
  up: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 10 4.5-4.5 4.5 4.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  down: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3.5 6 4.5 4.5L12.5 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.6 8.5h5.8l.6-8.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  plus: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  dl: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2v8m0 0L5 7m3 3 3-3M3 13h10" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  file: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 1.8h5l3 3V14H4V1.8Z M9 1.8v3h3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>',
  x: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m4 4 8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  left: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m10 3.5-4.5 4.5L10 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  right: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m6 3.5 4.5 4.5L6 12.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cog: '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="2.2" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.4 1.4M11.2 11.2l1.4 1.4M3.4 12.6l1.4-1.4M11.2 4.8l1.4-1.4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
};

/* ---------- komunikaty ---------- */
let toastTimer = null;
function toast(msg, kind, action) {
  UI.toast = { msg, kind: kind || '', action };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { UI.toast = null; renderToastOnly(); }, kind === 'bad' ? 9000 : 4500);
  renderToastOnly();
}
function renderToastOnly() {
  let el = document.getElementById('toast-root');
  if (!el) { el = document.createElement('div'); el.id = 'toast-root'; document.body.appendChild(el); }
  const t = UI.toast;
  el.innerHTML = t ? `<div class="toast ${t.kind}" role="status">${esc(t.msg)}${t.action ? `<button data-act="${t.action.act}">${esc(t.action.label)}</button>` : ''}</div>` : '';
}

/* ---------- zapis ---------- */
let saveTimer = null, saving = false, pendingSave = false;
function updateSaveBadge() {
  const el = document.getElementById('save-badge');
  if (!el) return;
  const map = { saved: ['', 'Zapisano'], busy: ['is-busy', 'Zapisuję…'], err: ['is-err', 'Błąd zapisu'], mem: ['is-mem', 'Tylko w tej sesji'] };
  const m = map[UI.save] || map.saved;
  el.className = 'save ' + m[0];
  el.innerHTML = `<i></i>${m[1]}`;
  el.title = UI.save === 'mem' ? 'Ta przeglądarka nie zachowuje danych. Użyj „Zapisz projekt (.json)” w zakładce Eksport.' : '';
}
function queueSave() {
  if (!S) return;
  UI.save = 'busy'; updateSaveBadge();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(doSave, 700);
}
async function doSave() {
  clearTimeout(saveTimer); saveTimer = null;
  if (!S) return;
  if (saving) { pendingSave = true; return; }
  saving = true;
  try {
    const meta = await Store.save(PID, S);
    const i = PROJECTS.findIndex((p) => p.id === PID);
    if (i >= 0) PROJECTS[i] = meta; else PROJECTS.unshift(meta);
    UI.save = Store.mode === 'memory' ? 'mem' : 'saved';
  } catch (e) {
    UI.save = 'err';
    toast('Nie udało się zapisać projektu: ' + (e && e.message ? e.message : 'nieznany błąd'), 'bad');
  }
  saving = false;
  updateSaveBadge();
  if (pendingSave) { pendingSave = false; doSave(); }
}
function commit() { render(); queueSave(); }

/* Bramka przerysowania: zmiany pól (zdarzenie change przy utracie fokusu) i trzymany przycisk myszy
   nie mogą wymienić DOM-u w trakcie kliknięcia, bo kliknięcie w kolejny element by przepadło. */
const RQ = { change: false, down: false, at: 0, pending: false };
const ptrActive = () => RQ.down && Date.now() - RQ.at < 2500;
function render() {
  if (RQ.change || ptrActive()) { RQ.pending = true; if (!RQ.change) setTimeout(flushRender, 300); return; }
  renderNow();
}
function flushRender() {
  if (!RQ.pending) return;
  if (RQ.change) return;
  if (ptrActive()) { setTimeout(flushRender, 300); return; }
  renderNow();
}

/* ---------- pliki: pobieranie ---------- */
async function saveFile(name, data, mime) {
  if (window.klapsDesktop && window.klapsDesktop.saveFile) {
    const r = await window.klapsDesktop.saveFile(name, data);
    return r && r.canceled ? 'declined' : 'saved';
  }
  let dl = null;
  try { if (window.claude && typeof window.claude.use === 'function') dl = await window.claude.use('downloads'); } catch (e) { dl = null; }
  if (dl) {
    try { await dl.save({ filename: name, data }); return 'saved'; }
    catch (e) {
      if (e && e.code === 'declined') return 'declined';
      if (!(e && ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code))) throw new Error(e && e.message ? e.message : 'Nie udało się zapisać pliku');
      // zapis niedostępny w tym widoku: spróbuj zwykłego pobrania poniżej
    }
  }
  const blob = new Blob([data], { type: mime || 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 4000);
  return 'saved';
}
const MIME = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', json: 'application/json' };
async function doExport(kind, sections, suffix, opts) {
  if (!sections.length) { toast('Zaznacz przynajmniej jedną sekcję do eksportu.', 'bad'); return; }
  UI.busy = kind === 'pdf' ? 'Tworzę PDF…' : 'Tworzę plik Excel…'; render();
  await new Promise((r) => setTimeout(r, 30));
  try {
    const bytes = kind === 'pdf' ? await Reports.buildPdf(S, sections, opts) : await Reports.buildXlsx(S, sections, opts);
    const name = `${Reports.fileStem(S)}_${suffix}.${kind}`;
    UI.busy = null; render();
    const r = await saveFile(name, bytes, MIME[kind]);
    if (r === 'saved') toast(`Plik ${name} gotowy do pobrania.`);
  } catch (e) {
    UI.busy = null; render();
    toast('Eksport nie powiódł się: ' + (e && e.message ? e.message : e), 'bad');
  }
}
async function exportProjectJson() {
  try {
    const name = `${Reports.fileStem(S)}_projekt.json`;
    const r = await saveFile(name, JSON.stringify(S), MIME.json);
    if (r === 'saved') toast(`Kopia projektu ${name} gotowa do pobrania.`);
  } catch (e) { toast('Nie udało się zapisać kopii: ' + e.message, 'bad'); }
}

/* ---------- import scenariusza ---------- */
function decodeText(buf) {
  const u = new Uint8Array(buf);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u).replace(/^﻿/, ''); }
  catch (e) { try { return new TextDecoder('windows-1250').decode(u); } catch (e2) { return new TextDecoder('latin1').decode(u); } }
}
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('Nie udało się wczytać modułu do czytania PDF z internetu. Wklej tekst scenariusza albo wczytaj plik FDX, DOCX lub TXT.'));
    document.head.appendChild(s);
  });
}
const PDFJS = (window.klapsDesktop && window.klapsDesktop.pdfjsBase) || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
async function ensurePdfJs() {
  if (window.pdfjsLib) return;
  await loadScript(PDFJS + 'pdf.min.js');
  if (!window.pdfjsLib) throw new Error('Moduł PDF nie został załadowany');
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
}
async function extractPdf(buf) {
  await ensurePdfJs();
  const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    UI.imp.progress = `Czytam stronę ${i} z ${doc.numPages}…`;
    const el = document.getElementById('imp-progress'); if (el) el.textContent = UI.imp.progress;
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    pages.push({ width: vp.width, height: vp.height, items: tc.items.filter((it) => it.str !== undefined).map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) })) });
  }
  const chars = pages.reduce((a, p) => a + p.items.reduce((b, it) => b + it.s.length, 0), 0);
  if (chars < 50) throw new Error('Ten PDF nie zawiera tekstu (to prawdopodobnie skan). Użyj PDF-a z warstwą tekstową albo wklej tekst scenariusza.');
  return pages;
}
async function docxXml(buf) {
  const z = Zip.read(new Uint8Array(buf));
  const xml = await z.text('word/document.xml');
  if (!xml) throw new Error('W pliku nie znaleziono treści dokumentu Word');
  return xml;
}
async function handleFile(file) {
  UI.imp = { status: 'reading', file: file.name, progress: 'Czytam plik…' };
  UI.paste = false;
  render();
  await new Promise((r) => setTimeout(r, 20));
  try {
    const buf = await file.arrayBuffer();
    const name = file.name.toLowerCase();
    let raw;
    if (/\.pdf$/.test(name)) raw = { kind: 'pdf', pages: await extractPdf(buf) };
    else if (/\.fdx$/.test(name)) raw = { kind: 'fdx', text: decodeText(buf) };
    else if (/\.docx$/.test(name)) raw = { kind: 'docx', xml: await docxXml(buf) };
    else if (/\.(doc|rtf|odt|pages)$/.test(name)) throw new Error('Ten format Worda nie jest obsługiwany. Zapisz scenariusz jako .docx lub PDF.');
    else raw = { kind: 'text', text: decodeText(buf) };
    UI.imp = { status: 'ready', file: file.name, raw, keep: S.scenes.length > 0 };
    runParse();
  } catch (e) {
    UI.imp = { status: 'error', file: file.name, error: e && e.message ? e.message : String(e) };
  }
  render();
}
function handlePaste() {
  const text = UI.pasteText.trim();
  if (!text) { toast('Wklej najpierw tekst scenariusza.', 'bad'); return; }
  UI.imp = { status: 'ready', file: 'Wklejony tekst', raw: { kind: 'text', text }, keep: S.scenes.length > 0 };
  UI.paste = false;
  try { runParse(); } catch (e) { UI.imp = { status: 'error', file: 'Wklejony tekst', error: e.message }; }
  render();
}
function runParse() {
  const raw = UI.imp.raw;
  const o = { castFromAction: S.meta.castMode || 'all' };
  if (raw.kind === 'text' || raw.kind === 'fdx' || raw.kind === 'docx') o.linesPerPage = +S.meta.linesPerPage || 55;
  let p;
  if (raw.kind === 'pdf') p = Parser.fromPdfPages(raw.pages, o);
  else if (raw.kind === 'fdx') p = Parser.fromFdx(raw.text, o);
  else if (raw.kind === 'docx') p = Parser.fromDocxXml(raw.xml, o);
  else p = Parser.fromText(raw.text, o);
  UI.imp.parsed = p;
}
function applyImportNow() {
  const p = UI.imp.parsed;
  if (!p || !p.scenes.length) return;
  Core.applyImport(S, p, { keep: !!UI.imp.keep, title: p.title, file: UI.imp.file });
  S.demo = false;
  UI.imp = { status: 'idle' };
  UI.sel = new Set(); UI.drawer = null; UI.confirmReplace = false;
  UI.tab = 'board';
  commit();
  toast(`Utworzono rozpiskę: ${S.scenes.length} ${pl(S.scenes.length, 'scena', 'sceny', 'scen')}, ${S.cast.length} ${pl(S.cast.length, 'postać', 'postacie', 'postaci')}.`);
}

/* ---------- projekty ---------- */
function demoState() {
  const st = Core.newState();
  const p = Parser.fromText(SAMPLE_SCRIPT);
  Core.applyImport(st, p, { title: p.title, file: 'przykładowy scenariusz' });
  st.meta.title = p.title || 'Ostatni pociąg do Zalesia';
  st.meta.pagesPerDay = 3;
  st.demo = true;
  Core.autoPlan(st, { strategy: 'site', scope: 'all', separateNight: true });
  const d1 = st.days[0];
  if (d1) {
    const sh = Core.syncSheet(st, d1.id);
    Object.assign(sh, { crewCall: '06:30', sunrise: '06:41', sunset: '17:52', weather: 'Pochmurno, 9°C, możliwy deszcz po południu', hospital: 'Szpital Powiatowy, ul. Szpitalna 1, tel. 999', cameraNotes: 'Kamera A na steadicamie, kamera B na statywie. Obiektywy 24, 35, 50, 85 mm.' });
    sh.contacts.push({ role: 'Kierownik produkcji', name: 'Ewa Nowak', phone: '600 100 200' }, { role: 'II reżyser', name: 'Piotr Kowal', phone: '600 100 201' });
    // harmonogram: własne pozycje i sceny z kalendarzówki z ręcznymi godzinami
    const scRows = sh.rows.filter((r) => r.kind === 'scene');
    const half = Math.ceil(scRows.length / 2);
    let t = 8 * 60;
    const hm = (n) => Core.minToTime(n);
    const rows = [Core.customRow('Zbiórka ekipy', '06:30'), Core.customRow('Omówienie techniczne z ekipą', '07:15', '07:45')];
    scRows.forEach((r, i) => {
      if (i === half) { rows.push(Core.customRow('Przerwa na obiad', hm(t), hm(t + 30))); t += 30; }
      r.from = hm(t); r.to = hm(t + 75); t += 75;
      if (i === 0) { r.camera = 'Steadicam, obiektyw 35 mm'; r.notes = 'Światło naturalne, domykamy przed deszczem'; }
      rows.push(r);
    });
    rows.push(Core.customRow('Koniec zdjęć', hm(t)));
    sh.rows = rows;
    const bus = Core.uid(), truck = Core.uid();
    st.transport.vehicles.push({ id: bus, name: 'Bus 1', type: 'Bus', plate: 'WA 12345', driver: 'Adam Kierowca', phone: '500 111 222', note: '9 miejsc' }, { id: truck, name: 'Ciężarówka techniczna', type: 'Ciężarówka techniczna', plate: 'WX 9999', driver: 'Jan Grip', phone: '500 333 444', note: '' });
    st.transport.trips.push({ id: Core.uid(), dayId: d1.id, vehicleId: truck, time: '05:00', from: 'Magazyn sprzętu', to: 'STACJA KOLEJOWA', who: 'Sprzęt oświetleniowy', note: 'rozładunek o 06:00' }, { id: Core.uid(), dayId: d1.id, vehicleId: bus, time: '05:45', from: 'Hotel Centrum', to: 'STACJA KOLEJOWA', who: 'Ekipa i aktorzy', note: '' });
    st.budget.items.push({ id: Core.uid(), cat: 'crew', name: 'Operator kamery (3 dni)', est: 9000, act: 9000, dayId: '', site: '', note: '' }, { id: Core.uid(), cat: 'gear', name: 'Wynajem oświetlenia', est: 4200, act: '', dayId: d1.id, site: '', note: '' }, { id: Core.uid(), cat: 'transport', name: 'Bus 1 z kierowcą (dzień 1)', est: 900, act: 950, dayId: d1.id, site: 'STACJA KOLEJOWA', note: '' }, { id: Core.uid(), cat: 'reserve', name: 'Rezerwa produkcyjna', est: 2500, act: '', dayId: '', site: '', note: '' });
    // shotlista pierwszych dwóch scen dnia
    const types = [['WS', 'Establishing, stacja o świcie', '24 mm', 'Statyw', '15 min'], ['MS', 'Anna idzie po peronie', '35 mm', 'Steadicam', '25 min'], ['CU', 'Twarz Anny, wahanie', '85 mm', 'Statyw', '20 min']];
    d1.sceneIds.slice(0, 2).forEach((sid) => {
      types.forEach((tp, i) => {
        const x = Core.newShot(st, sid);
        Object.assign(x, { type: tp[0], desc: tp[1], lens: tp[2], grip: tp[3], eta: tp[4], shot: String(i + 1) });
        st.shots.push(x);
      });
    });
  }
  st.crew.push(
    Core.newCrew({ first: 'Marta', last: 'Wiśniewska', dept: 'Reżyseria', role: 'Reżyser', phone: '600 200 301', contract: 'Umowa o dzieło', rate: '12 000 zł / projekt', lodging: 'Tak', diet: 'Wegetariańska' }),
    Core.newCrew({ first: 'Piotr', last: 'Kowal', dept: 'Reżyseria', role: 'II reżyser', phone: '600 100 201', contract: 'Umowa zlecenie', rate: '900 zł / dzień' }),
    Core.newCrew({ first: 'Ewa', last: 'Nowak', dept: 'Produkcja', role: 'Kierownik produkcji', phone: '600 100 200', contract: 'B2B / faktura', rate: '1 100 zł / dzień', transport: 'Własny' }),
    Core.newCrew({ first: 'Tomasz', last: 'Lis', dept: 'Zdjęcia', role: 'Operator kamery', phone: '600 200 305', contract: 'B2B / faktura', rate: '1 800 zł / dzień', lodging: 'Tak', notes: 'Własna kamera' }),
    Core.newCrew({ first: 'Jan', last: 'Grip', dept: 'Grip', role: 'Grip', phone: '500 333 444', contract: 'Umowa zlecenie', rate: '600 zł / dzień', transport: 'Ciężarówka techniczna' }),
    Core.newCrew({ first: 'Kasia', last: 'Zalewska', dept: 'Dźwięk', role: 'Dźwiękowiec', phone: '600 200 308', contract: 'Umowa o dzieło', rate: '1 000 zł / dzień', diet: 'Bez glutenu' })
  );
  return st;
}
async function openProject(id) {
  const st = await Store.load(id);
  if (!st) { toast('Nie udało się otworzyć projektu.', 'bad'); return; }
  S = st; PID = id;
  UI.sel = new Set(); UI.drawer = null; UI.imp = { status: 'idle' }; UI.f = { q: '', ie: '', tod: '', cast: '', site: '', plan: '' }; UI.month = null; UI.confirmDel = false;
  try { localStorage.setItem('klaps.active', id); } catch (e) { /* brak */ }
  UI.tab = S.scenes.length ? (S.days.length ? 'schedule' : 'board') : 'import';
  render();
}
async function newProject(title, state) {
  const id = Core.uid();
  S = state || Core.newState();
  if (title != null) S.meta.title = title;
  PID = id;
  UI.sel = new Set(); UI.drawer = null; UI.imp = { status: 'idle' }; UI.month = null; UI.tab = S.scenes.length ? 'schedule' : 'import';
  try { localStorage.setItem('klaps.active', id); } catch (e) { /* brak */ }
  render();
  await doSave();
  render();
}
async function deleteProject() {
  const id = PID;
  try { await Store.remove(id); } catch (e) { toast('Nie udało się usunąć projektu: ' + e.message, 'bad'); return; }
  PROJECTS = PROJECTS.filter((p) => p.id !== id);
  UI.settings = false; UI.confirmDel = false;
  if (PROJECTS.length) await openProject(PROJECTS[0].id);
  else await newProject('Nowy projekt');
  toast('Projekt został usunięty.');
}
async function importProjectJson(file) {
  try {
    const st = Core.normalize(JSON.parse(await file.text()));
    if (!Array.isArray(st.scenes)) throw new Error('To nie jest plik projektu Klaps');
    await newProject((st.meta.title || 'Projekt') + ' (kopia)', st);
    toast('Wczytano projekt z pliku.');
  } catch (e) { toast('Nie udało się wczytać projektu: ' + e.message, 'bad'); }
}

/* ---------- pomocnicze ---------- */
function parseEighths(str) {
  const s = String(str).trim().replace(',', '.');
  if (!s) return null;
  let m = s.match(/^(\d+)?\s*(?:(\d)\s*\/\s*8)?$/);
  if (m && (m[1] || m[2])) return (m[1] ? +m[1] * 8 : 0) + (m[2] ? +m[2] : 0);
  m = s.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return Math.round(parseFloat(m[1]) * 8);
  return null;
}
function sceneLabel(sc) { return `${sc.num} ${Core.IE_LABEL[sc.ie] || ''} ${sc.place || sc.site || ''}`.trim(); }
function filteredScenes() {
  const f = UI.f, idx = Core.scheduleIndex(S);
  const q = f.q.trim().toLowerCase();
  const cmap = Core.castMap(S);
  return S.scenes.filter((s) => {
    if (f.ie && (f.ie === 'EXT' ? !(s.ie === 'EXT' || s.ie === 'INT/EXT') : f.ie === 'INT' ? !(s.ie === 'INT' || s.ie === 'INT/EXT') : false)) return false;
    if (f.tod && s.tod !== f.tod) return false;
    if (f.cast && !s.cast.includes(+f.cast)) return false;
    if (f.site && (s.site || s.place) !== f.site) return false;
    if (f.plan === 'planned' && !idx.has(s.id)) return false;
    if (f.plan === 'unplanned' && idx.has(s.id)) return false;
    if (q) {
      const hay = (s.num + ' ' + s.place + ' ' + s.site + ' ' + s.synopsis + ' ' + s.notes + ' ' + s.cast.map((id) => (cmap.get(id) || {}).name || '').join(' ')).toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
const sitesList = () => [...new Set(S.scenes.map((s) => s.site || s.place).concat(Object.keys(S.sites || {}).filter((k) => S.sites[k] && S.sites[k].manual)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
function dayLabel(d, nums) {
  const n = nums.get(d.id);
  return d.kind === 'off' ? `Dzień wolny (${Core.fmtDM(d.date)})` : `D${n} · ${Core.fmtDM(d.date)} ${Core.DAYS_SHORT[Core.dow(d.date)] || ''}`;
}
function captureScroll() {
  const o = { y: window.scrollY, els: {} };
  document.querySelectorAll('[data-scroll-id]').forEach((el) => { o.els[el.dataset.scrollId] = [el.scrollTop, el.scrollLeft]; });
  return o;
}
function restoreScroll(o) {
  Object.entries(o.els).forEach(([id, v]) => { const el = document.querySelector(`[data-scroll-id="${id}"]`); if (el) { el.scrollTop = v[0]; el.scrollLeft = v[1]; } });
  window.scrollTo(0, o.y);
}
