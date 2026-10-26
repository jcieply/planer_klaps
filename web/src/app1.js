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
  exp: { calendar: true, board: true, shotlist: true, cast: true, crew: true, catering: true, sites: true, dood: true, callsheet: true, transport: true, budget: true }, csDay: null, trDay: '',
  crewOpen: new Set(), castOpen: new Set(), siteOpen: new Set(), crewF: { q: '', dept: '' }, shF: { scene: '' }, crewView: 'list', csPick: false, csPickAll: false,
  save: 'saved', toast: null, busy: null, refocus: null, showScript: false, confirmReplace: false,
};
const appEl = () => document.getElementById('app');
/** polska odmiana liczebnikowa: 1 scena, 2 sceny, 5 scen (po angielsku 1 scene, 2 scenes) */
const pl = (n, one, few, many) => Core.pl(n, one, few, many);

/* ---------- preferencje aplikacji (na tym urządzeniu): język i motyw ---------- */
const PREFS = { lang: 'pl', theme: 'auto' };
function loadPrefs() {
  try { const o = JSON.parse(localStorage.getItem('klaps.prefs') || '{}'); if (o.lang === 'en' || o.lang === 'pl') PREFS.lang = o.lang; if (['auto', 'light', 'dark'].includes(o.theme)) PREFS.theme = o.theme; } catch (e) { /* domyślne */ }
  applyPrefs();
}
function savePrefs() { try { localStorage.setItem('klaps.prefs', JSON.stringify(PREFS)); } catch (e) { /* brak */ } }
function applyPrefs() {
  I18N.lang = PREFS.lang;
  const de = document.documentElement;
  de.lang = PREFS.lang;
  if (PREFS.theme === 'auto') de.removeAttribute('data-theme'); else de.setAttribute('data-theme', PREFS.theme);
}
const isDark = () => PREFS.theme === 'dark' || (PREFS.theme === 'auto' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
function setTheme(v) { PREFS.theme = v; savePrefs(); applyPrefs(); render(); }
function setLang(v) { PREFS.lang = v === 'en' ? 'en' : 'pl'; savePrefs(); applyPrefs(); render(); }

/* ---------- obrazy (mapki): zmniejszenie i zapis jako JPEG ---------- */
async function loadImageFile(file) {
  if (!/^image\/(png|jpe?g)$/i.test(file.type) && !/\.(png|jpe?g)$/i.test(file.name)) throw new Error(T('Wybierz plik JPG albo PNG.'));
  if (file.size > 25 * 1024 * 1024) throw new Error(T('Plik jest za duży (ponad 25 MB).'));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(T('Nie udało się odczytać obrazu.'))); i.src = url; });
    const MAX = 1800;
    const k = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    g.drawImage(img, 0, 0, w, h);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);
    return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), w, h, name: file.name };
  } finally { URL.revokeObjectURL(url); }
}
const mediaSrc = (id) => { const m = S.media[id]; return m ? 'data:' + (m.mime || 'image/jpeg') + ';base64,' + m.data : ''; };
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
  const map = { saved: ['', T('Zapisano')], busy: ['is-busy', T('Zapisuję…')], err: ['is-err', T('Błąd zapisu')], mem: ['is-mem', T('Tylko w tej sesji')] };
  const m = map[UI.save] || map.saved;
  el.className = 'save ' + m[0];
  el.innerHTML = `<i></i>${m[1]}`;
  el.title = UI.save === 'mem' ? T('Ta przeglądarka nie zachowuje danych. Użyj „Zapisz projekt (.json)” w zakładce Eksport.') : '';
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
    toast(T('Nie udało się zapisać projektu: {e}', { e: e && e.message ? e.message : T('nieznany błąd') }), 'bad');
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
      if (!(e && ['unavailable', 'not_granted', 'capability_disabled', 'capability_removed'].includes(e.code))) throw new Error(e && e.message ? e.message : T('Nie udało się zapisać pliku'));
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
  if (!sections.length) { toast(T('Zaznacz przynajmniej jedną sekcję do eksportu.'), 'bad'); return; }
  UI.busy = kind === 'pdf' ? T('Tworzę PDF…') : T('Tworzę plik Excel…'); render();
  await new Promise((r) => setTimeout(r, 30));
  try {
    const bytes = kind === 'pdf' ? await Reports.buildPdf(S, sections, opts) : await Reports.buildXlsx(S, sections, opts);
    const suf = I18N.withLang(S.meta.docLang || I18N.lang, () => (Array.isArray(suffix) ? T(suffix[0], suffix[1]) : T(suffix)));
    const name = `${Reports.fileStem(S)}_${suf}.${kind}`;
    UI.busy = null; render();
    const r = await saveFile(name, bytes, MIME[kind]);
    if (r === 'saved') toast(T('Plik {f} gotowy do pobrania.', { f: name }));
  } catch (e) {
    UI.busy = null; render();
    toast(T('Eksport nie powiódł się: {e}', { e: e && e.message ? e.message : e }), 'bad');
  }
}
async function exportProjectJson() {
  try {
    const name = `${Reports.fileStem(S)}_${T('projekt')}.json`;
    const r = await saveFile(name, JSON.stringify(S), MIME.json);
    if (r === 'saved') toast(T('Kopia projektu {f} gotowa do pobrania.', { f: name }));
  } catch (e) { toast(T('Nie udało się zapisać kopii: {e}', { e: e.message }), 'bad'); }
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
    s.src = src; s.onload = res; s.onerror = () => rej(new Error(T('Nie udało się wczytać modułu do czytania PDF z internetu. Wklej tekst scenariusza albo wczytaj plik FDX, DOCX lub TXT.')));
    document.head.appendChild(s);
  });
}
const PDFJS = (window.klapsDesktop && window.klapsDesktop.pdfjsBase) || 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
async function ensurePdfJs() {
  if (window.pdfjsLib) return;
  await loadScript(PDFJS + 'pdf.min.js');
  if (!window.pdfjsLib) throw new Error(T('Moduł PDF nie został załadowany'));
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
}
async function extractPdf(buf) {
  await ensurePdfJs();
  const doc = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    UI.imp.progress = T('Czytam stronę {i} z {n}…', { i, n: doc.numPages });
    const el = document.getElementById('imp-progress'); if (el) el.textContent = UI.imp.progress;
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    pages.push({ width: vp.width, height: vp.height, items: tc.items.filter((it) => it.str !== undefined).map((it) => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) })) });
  }
  const chars = pages.reduce((a, p) => a + p.items.reduce((b, it) => b + it.s.length, 0), 0);
  if (chars < 50) throw new Error(T('Ten PDF nie zawiera tekstu (to prawdopodobnie skan). Użyj PDF-a z warstwą tekstową albo wklej tekst scenariusza.'));
  return pages;
}
async function docxXml(buf) {
  const z = Zip.read(new Uint8Array(buf));
  const xml = await z.text('word/document.xml');
  if (!xml) throw new Error(T('W pliku nie znaleziono treści dokumentu Word'));
  return xml;
}
async function handleFile(file) {
  UI.imp = { status: 'reading', file: file.name, progress: T('Czytam plik…') };
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
    else if (/\.(doc|rtf|odt|pages)$/.test(name)) throw new Error(T('Ten format Worda nie jest obsługiwany. Zapisz scenariusz jako .docx lub PDF.'));
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
  if (!text) { toast(T('Wklej najpierw tekst scenariusza.'), 'bad'); return; }
  UI.imp = { status: 'ready', file: T('Wklejony tekst'), raw: { kind: 'text', text }, keep: S.scenes.length > 0 };
  UI.paste = false;
  try { runParse(); } catch (e) { UI.imp = { status: 'error', file: T('Wklejony tekst'), error: e.message }; }
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
  toast(T('Utworzono rozpiskę: {a}, {b}.', { a: `${S.scenes.length} ${pl(S.scenes.length, 'scena', 'sceny', 'scen')}`, b: `${S.cast.length} ${pl(S.cast.length, 'postać', 'postacie', 'postaci')}` }));
}

/* ---------- projekty ---------- */
function demoState() {
  const st = Core.newState();
  const p = Parser.fromText(SAMPLE_SCRIPT);
  Core.applyImport(st, p, { title: p.title, file: T('przykładowy scenariusz') });
  st.meta.title = p.title || 'Ostatni pociąg do Zalesia';
  st.meta.pagesPerDay = 3;
  st.demo = true;
  // dane lokacji (fikcyjne)
  if (st.sites['STACJA KOLEJOWA']) Object.assign(st.sites['STACJA KOLEJOWA'], { realName: T('Dworzec PKP Zalesie'), address: 'ul. Kolejowa 1, 05-500 Zalesie', owner: T('Jan Nowicki, zawiadowca stacji'), ownerContact: '601 400 500, stacja@example.com', power: 'three', toilet: T('Budynek dworca, parter (klucz u zawiadowcy)'), camp: T('Plac przed dworcem, miejsce na 3 busy i catering'), contract: 'signed', notes: T('Zdjęcia na peronie tylko między pociągami: 9:10–10:40 i 12:00–14:30. Parking dla ekipy za budynkiem.') });
  if (st.sites['DOM ANNY']) Object.assign(st.sites['DOM ANNY'], { realName: T('Dom prywatny, rodzina Wiśniewskich'), address: 'ul. Leśna 14, 05-500 Zalesie', owner: 'Teresa Wiśniewska', ownerContact: '602 111 222', power: 'house', toilet: T('Łazienka na piętrze (tylko obsada), toi-toi przy bramie'), camp: T('Łąka za ogrodem, dojazd drogą polną'), contract: 'negotiation', notes: T('Cisza nocna od 22:00, sąsiedzi uprzedzeni. Zabezpieczyć podłogi.') });
  Core.autoPlan(st, { strategy: 'site', scope: 'all', separateNight: true });
  const d1 = st.days[0];
  if (d1) {
    const sh = Core.syncSheet(st, d1.id);
    Object.assign(sh, { crewCall: '06:30', sunrise: '06:41', sunset: '17:52', weather: T('Pochmurno, 9°C, możliwy deszcz po południu'), hospital: T('Szpital Powiatowy, ul. Szpitalna 1, tel. 999'), cameraNotes: T('Kamera A na steadicamie, kamera B na statywie. Obiektywy 24, 35, 50, 85 mm.') });
    sh.contacts.push({ role: T('Kierownik produkcji'), name: 'Ewa Nowak', phone: '600 100 200' }, { role: T('II reżyser'), name: 'Piotr Kowal', phone: '600 100 201' });
    // harmonogram: czasy realizacji i przestawki, godziny liczą się same od zbiórki
    const scRows = sh.rows.filter((r) => r.kind === 'scene');
    const half = Math.ceil(scRows.length / 2);
    const sm = Core.sceneMap(st);
    const rows = [Core.customRow(T('Zbiórka ekipy'), 30), Core.customRow(T('Omówienie techniczne'), 15)];
    scRows.forEach((r, i) => {
      if (i === half) rows.push(Core.customRow(T('Przerwa na obiad'), 45));
      const sc = sm.get(r.sceneId);
      r.dur = Math.max(20, Math.round(((sc ? sc.eighths : 4) * 7.5) / 5) * 5 + 15);
      r.prep = i ? 15 : 10;
      if (i === 0) { r.camera = T('Steadicam, obiektyw 35 mm'); r.notes = T('Światło naturalne, domykamy przed deszczem'); }
      rows.push(r);
    });
    rows.push(Core.customRow(T('Koniec zdjęć'), 0, 15));
    sh.rows = rows;
    const bus = Core.uid(), truck = Core.uid();
    st.transport.vehicles.push({ id: bus, name: 'Bus 1', type: 'Bus', plate: 'WA 12345', driver: 'Adam Kierowca', phone: '500 111 222', note: T('9 miejsc') }, { id: truck, name: T('Ciężarówka techniczna'), type: 'Ciężarówka techniczna', plate: 'WX 9999', driver: 'Jan Grip', phone: '500 333 444', note: '' });
    st.transport.trips.push({ id: Core.uid(), dayId: d1.id, vehicleId: truck, time: '05:00', from: T('Magazyn sprzętu'), to: 'STACJA KOLEJOWA', who: T('Sprzęt oświetleniowy'), note: T('rozładunek o 06:00') }, { id: Core.uid(), dayId: d1.id, vehicleId: bus, time: '05:45', from: 'Hotel Centrum', to: 'STACJA KOLEJOWA', who: T('Ekipa i aktorzy'), note: '' });
    st.budget.items.push({ id: Core.uid(), cat: 'crew', name: T('Operator kamery (3 dni)'), est: 9000, act: 9000, dayId: '', site: '', note: '' }, { id: Core.uid(), cat: 'gear', name: T('Wynajem oświetlenia'), est: 4200, act: '', dayId: d1.id, site: '', note: '' }, { id: Core.uid(), cat: 'transport', name: T('Bus 1 z kierowcą (dzień 1)'), est: 900, act: 950, dayId: d1.id, site: 'STACJA KOLEJOWA', note: '' }, { id: Core.uid(), cat: 'reserve', name: T('Rezerwa produkcyjna'), est: 2500, act: '', dayId: '', site: '', note: '' });
    // shotlista pierwszych dwóch scen dnia
    const types = [['WS', T('Establishing, stacja o świcie'), '24 mm', T('Statyw'), '15 min'], ['MS', T('Anna idzie po peronie'), '35 mm', 'Steadicam', '25 min'], ['CU', T('Twarz Anny, wahanie'), '85 mm', T('Statyw'), '20 min']];
    d1.sceneIds.slice(0, 2).forEach((sid) => {
      types.forEach((tp, i) => {
        const x = Core.newShot(st, sid);
        Object.assign(x, { type: tp[0], desc: tp[1], lens: tp[2], grip: tp[3], eta: tp[4], shot: String(i + 1) });
        st.shots.push(x);
      });
    });
    // prelight dzień przed zdjęciami (nie wlicza się do dni zdjęciowych)
    const pre = Core.addDay(st, 'prelight', { call: '09:00', end: '17:00', site: (Core.dayStats(st, d1).sites[0] || ''), note: T('Ustawienie światła na peronie, ekipa oświetleniowa i operator') });
    st.days.unshift(st.days.pop());
    Core.recalcDates(st);
    st.crew.push(
      Core.newCrew({ first: 'Marta', last: 'Wiśniewska', dept: T('Reżyseria'), role: T('Reżyser'), phone: '600 200 301', email: 'marta@example.com', contract: T('Umowa o dzieło'), rate: '12 000 zł / projekt', lodging: 'Tak', dietType: 'veg' }),
      Core.newCrew({ first: 'Piotr', last: 'Kowal', dept: T('Reżyseria'), role: T('II reżyser'), phone: '600 100 201', contract: T('Umowa zlecenie'), rate: '900 zł / dzień' }),
      Core.newCrew({ first: 'Ewa', last: 'Nowak', dept: T('Produkcja'), role: T('Kierownik produkcji'), phone: '600 100 200', email: 'ewa@example.com', contract: T('B2B / faktura'), rate: '1 100 zł / dzień', transport: T('Własny'), extra: [pre.id] }),
      Core.newCrew({ first: 'Tomasz', last: 'Lis', dept: T('Zdjęcia'), role: T('Operator kamery'), phone: '600 200 305', contract: T('B2B / faktura'), rate: '1 800 zł / dzień', lodging: 'Tak', notes: T('Własna kamera'), extra: [pre.id] }),
      Core.newCrew({ first: 'Robert', last: 'Iskra', dept: T('Oświetlenie'), role: T('Gaffer'), phone: '600 200 306', contract: T('Umowa zlecenie'), rate: '1 000 zł / dzień', dietType: 'fish', extra: [pre.id] }),
      Core.newCrew({ first: 'Jan', last: 'Grip', dept: 'Grip', role: 'Grip', phone: '500 333 444', contract: T('Umowa zlecenie'), rate: '600 zł / dzień', transport: T('Ciężarówka techniczna') }),
      Core.newCrew({ first: 'Kasia', last: 'Zalewska', dept: T('Dźwięk'), role: T('Dźwiękowiec'), phone: '600 200 308', contract: T('Umowa o dzieło'), rate: '1 000 zł / dzień', dietType: 'gf', dietNote: T('Celiakia – osobne naczynia') })
    );
    st.catering.extra[d1.id] = 4;
    // dane aktorów (fikcyjne)
    const anna = st.cast.find((c) => c.name === 'ANNA'), hen = st.cast.find((c) => c.name === 'HENRYK');
    if (anna) Object.assign(anna, { actor: 'Joanna Kalinowska', phone: '601 300 100', email: 'joanna@example.com', contract: T('Umowa o dzieło'), rate: '2 500 zł / dzień zdjęciowy', lodging: 'Tak', diet: 'veg', transport: T('Odbiór przez kierowcę produkcji'), notes: T('Agent: Studio Aktor, tel. 22 100 20 30') });
    if (hen) Object.assign(hen, { actor: 'Marek Wolski', phone: '601 300 101', contract: T('Umowa zlecenie'), rate: '1 800 zł / dzień zdjęciowy', dietNote: T('Uczulenie na orzechy') });
  }
  return st;
}
async function openProject(id) {
  const st = await Store.load(id);
  if (!st) { toast(T('Nie udało się otworzyć projektu.'), 'bad'); return; }
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
  try { await Store.remove(id); } catch (e) { toast(T('Nie udało się usunąć projektu: {e}', { e: e.message }), 'bad'); return; }
  PROJECTS = PROJECTS.filter((p) => p.id !== id);
  UI.settings = false; UI.confirmDel = false;
  if (PROJECTS.length) await openProject(PROJECTS[0].id);
  else await newProject(T('Nowy projekt'));
  toast(T('Projekt został usunięty.'));
}
async function importProjectJson(file) {
  try {
    const st = Core.normalize(JSON.parse(await file.text()));
    if (!Array.isArray(st.scenes)) throw new Error(T('To nie jest plik projektu Klaps'));
    await newProject((st.meta.title || T('Projekt')) + ' ' + T('(kopia)'), st);
    toast(T('Wczytano projekt z pliku.'));
  } catch (e) { toast(T('Nie udało się wczytać projektu: {e}', { e: e.message }), 'bad'); }
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
  const dw = d.date ? Core.DAYS_SHORT[Core.dow(d.date)] || '' : '';
  if (d.kind === 'off') return `${T('Dzień wolny')} (${Core.fmtDM(d.date)})`;
  if (d.kind !== 'shoot') return `${Core.dayTitle(d, nums)} · ${Core.fmtDM(d.date)} ${dw}`;
  return `D${nums.get(d.id)} · ${Core.fmtDM(d.date)} ${dw}`;
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
