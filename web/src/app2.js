/* ===== APLIKACJA: widoki ===== */
const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`;
const kcls = (sc) => 'k-' + Core.stripKey(sc);
const TODS = [['DAY', T_('Dzień')], ['NIGHT', T_('Noc')], ['DAWN', T_('Świt')], ['DUSK', T_('Zmierzch')]];
const IES = [['INT', T_('Wnętrze (WN.)')], ['EXT', T_('Plener (ZN.)')], ['INT/EXT', T_('WN./ZN.')]];
const castChips = (ids) => { const m = Core.castMap(S); return ids.slice().sort((a, b) => a - b).map((id) => m.get(id)).filter(Boolean).map((c) => `<span class="chip" title="${esc(c.name)}${c.actor ? ' – ' + esc(c.actor) : ''}"><b>${c.id}</b> ${esc(c.name)}</span>`).join(''); };
ICON.sun = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="3" stroke="currentColor" stroke-width="1.5"/><path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M3.4 12.6l1.1-1.1M11.5 4.5l1.1-1.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
ICON.moon = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13.2 10.1A5.6 5.6 0 0 1 5.9 2.8a5.6 5.6 0 1 0 7.3 7.3Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
ICON.img = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3" width="12" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><circle cx="6" cy="6.5" r="1.2" fill="currentColor"/><path d="m2.8 12 3.6-3.6 2.4 2.4 1.6-1.6 3 3" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';
ICON.warn = '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2 1.6 13.2h12.8L8 2Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.5v3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.6" r=".9" fill="currentColor"/></svg>';
ICON.pin = '<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 2h4l-.6 4.2 2.6 2.3H4l2.6-2.3L6 2Z M8 8.5V14" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/></svg>';

const FIELDS = 'input:not([type=file]):not([type=hidden]), select, textarea';
/** Klucz aktywnego pola: id albo pozycja wśród pól formularza (DOM jest budowany deterministycznie) */
function focusKey() {
  const a = document.activeElement;
  if (!a || a === document.body || !a.matches || !a.matches(FIELDS)) return null;
  if (a.id) return { id: a.id };
  if (a.dataset && a.dataset.bind && a.dataset.id) return { bind: a.dataset.bind, did: a.dataset.id };
  const all = [...appEl().querySelectorAll(FIELDS)];
  const i = all.indexOf(a);
  return i >= 0 ? { i, tag: a.tagName } : null;
}
function restoreFocus(k) {
  if (!k) return;
  let el = null;
  if (k.id) el = document.getElementById(k.id);
  else if (k.bind) el = [...appEl().querySelectorAll('[data-bind]')].find((x) => x.dataset.bind === k.bind && x.dataset.id === k.did) || null;
  else { const all = appEl().querySelectorAll(FIELDS); el = all[k.i]; if (el && el.tagName !== k.tag) el = null; }
  if (el) try { el.focus({ preventScroll: true }); } catch (e) { /* brak */ }
}

function renderNow() {
  if (!S) return;
  RQ.pending = false;
  const keep = captureScroll();
  const fk = focusKey();
  appEl().innerHTML = renderTop() + renderTabs() + `<main class="gut">${renderView()}</main>` + renderDrawer() + renderSettings() + (UI.busy ? `<div class="busy" role="status"><div>${esc(UI.busy)}</div></div>` : '');
  restoreScroll(keep);
  if (UI.tabFocus) { UI.tabFocus = false; const t = $q('.tab[aria-selected="true"]'); if (t && t.scrollIntoView) t.scrollIntoView({ inline: 'center', block: 'nearest' }); }
  updateSaveBadge();
  updateSyncBadge();
  if (UI.refocus) { const el = $q(UI.refocus); if (el) el.focus(); UI.refocus = null; }
  else restoreFocus(fk);
}

function renderTop() {
  const list = PROJECTS.some((p) => p.id === PID) ? PROJECTS : [{ id: PID, title: S.meta.title, demo: S.demo }].concat(PROJECTS);
  const opts = list.map((p) => opt(p.id, (p.id === PID ? S.meta.title : p.title) || T('Bez tytułu'), PID)).join('');
  const dark = isDark();
  return `<header class="topbar"><div class="topbar-in gut">
    <div class="brand">${ICON.clap}Klaps</div>
    <div class="proj"><select id="proj-sel" data-act-change="proj-switch" aria-label="${T('Projekt')}">${opts}<option value="__new">${T('+ Nowy projekt')}</option></select>${S.demo ? `<span class="tag" title="${T('Projekt demonstracyjny z przykładowym scenariuszem')}">${T('Przykład')}</span>` : ''}</div>
    <span id="save-badge" class="save"><i></i>${T('Zapisano')}</span>${Sync.available() && Sync.loggedIn() ? `<button id="sync-badge" class="save sync" data-act="sync-now"><i></i></button>` : ''}
    <div class="actions">
      <button class="btn icon" data-act="lang-toggle" title="${T('Zmień język interfejsu')}" aria-label="${T('Zmień język interfejsu')}"><b class="lang-b">${PREFS.lang === 'en' ? 'EN' : 'PL'}</b></button>
      <button class="btn icon" data-act="theme-toggle" title="${dark ? T('Przełącz na jasny motyw') : T('Przełącz na ciemny motyw')}" aria-label="${dark ? T('Przełącz na jasny motyw') : T('Przełącz na ciemny motyw')}">${dark ? ICON.sun : ICON.moon}</button>
      <button class="btn" data-act="settings-open" title="${T('Dane produkcji, godziny pracy, język i motyw')}">${ICON.cog}<span class="lbl-d">${T('Ustawienia')}</span></button>
      <button class="btn primary" data-act="tab" data-tab="export">${ICON.dl}<span class="lbl-d">${T('Eksport')}</span> PDF / Excel</button>
    </div>
  </div></header>`;
}

const TABS = [['import', T_('Scenariusz')], ['board', T_('Rozpiska scen')], ['schedule', T_('Kalendarzówka')], ['callsheet', T_('Plan pracy')], ['shotlist', T_('Shotlista')], ['transport', T_('Transport')], ['budget', T_('Kosztorys')], ['cast', T_('Obsada')], ['crew', T_('Ekipa')], ['sites', T_('Lokacje')], ['dood', 'DOOD'], ['export', T_('Eksport')]];
function renderTabs() {
  const cnt = { board: S.scenes.length, schedule: S.days.filter((d) => d.kind === 'shoot').length, cast: S.cast.length, sites: sitesList().length, transport: S.transport.trips.length, budget: S.budget.items.length, crew: S.crew.length, shotlist: S.shots.length };
  return `<nav class="tabs" aria-label="${T('Widoki')}"><div class="tabs-in gut" role="tablist" data-scroll-id="tabs">${TABS.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${UI.tab === k}" data-act="tab" data-tab="${k}">${T(l)}${cnt[k] != null ? `<span class="cnt">${cnt[k]}</span>` : ''}</button>`).join('')}</div></nav>`;
}

function renderView() {
  switch (UI.tab) {
    case 'import': return renderImport();
    case 'board': return renderBoard();
    case 'schedule': return renderSchedule();
    case 'callsheet': return renderCallsheet();
    case 'shotlist': return renderShotlist();
    case 'crew': return renderCrew();
    case 'transport': return renderTransport();
    case 'budget': return renderBudget();
    case 'cast': return renderCast();
    case 'sites': return renderSites();
    case 'dood': return renderDood();
    case 'export': return renderExport();
    default: return '';
  }
}
const pageH = (title, sub, right) => `<div class="page-h"><div><h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}</div>${right ? `<div class="right">${right}</div>` : ''}</div>`;
const needScenes = () => `<div class="card"><div class="empty"><h3>${T('Nie ma jeszcze scen')}</h3><p>${T('Wczytaj scenariusz albo dodaj sceny ręcznie. Scenariusz nie jest wymagany, a wszystkie zakładki działają także w pustym projekcie.')}</p><div class="row" style="justify-content:center"><button class="btn primary big" data-act="tab" data-tab="import">${T('Wczytaj scenariusz')}</button><button class="btn big" data-act="scene-add">${ICON.plus} ${T('Dodaj scenę ręcznie')}</button></div></div></div>`;
const plN = (n, one, few, many) => `${n} ${pl(n, one, few, many)}`;

/* ================= IMPORT ================= */
function renderImport() {
  const imp = UI.imp;
  let h = pageH(T('Scenariusz'), T('Wczytaj scenariusz, a Klaps rozpozna sceny, obsadę i długość w ósemkach stron. Scenariusz nie jest wymagany: możesz też zacząć od pustego projektu i dodawać sceny ręcznie.'));
  if (imp.status === 'reading') return h + `<div class="card"><div class="card-b"><b>${esc(imp.file)}</b><div class="muted" id="imp-progress">${esc(imp.progress || '')}</div></div></div>`;
  if (imp.status === 'error') h += `<div class="notice bad"><div><b>${T('Nie udało się odczytać pliku')}${imp.file ? ' „' + esc(imp.file) + '”' : ''}.</b><br>${esc(imp.error)}</div></div>`;
  if (imp.parsed) return h + renderImportReview();
  if (S.scenes.length) {
    const eighths = S.scenes.reduce((a, s) => a + s.eighths, 0);
    h += `<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>${T('Aktualny scenariusz')}</h2><span class="muted small">${esc(S.meta.scriptFile || '')}</span><div class="right" style="margin-left:auto"><button class="btn" data-act="tab" data-tab="board">${T('Przejdź do rozpiski')}</button></div></div>
      <div class="card-b"><div class="stats"><div class="stat"><b>${S.scenes.length}</b><span>${T('scen')}</span></div><div class="stat"><b>${Core.fmtEighths(eighths)}</b><span>${T('stron')}</span></div><div class="stat"><b>${S.cast.length}</b><span>${T('postaci')}</span></div><div class="stat"><b>${sitesList().length}</b><span>${T('obiektów')}</span></div></div>
      <p class="muted small" style="margin:12px 0 0">${T('Nowa wersja scenariusza? Wczytaj ją poniżej. Klaps zachowa opisy, elementy i plan dla scen o tych samych numerach.')}</p></div></div>`;
  }
  h += `<div class="imp-grid"><div>
    <div class="drop" id="drop-zone" data-drop-file>
      <h2>${S.scenes.length ? T('Wczytaj nową wersję') : T('Przeciągnij scenariusz tutaj')}</h2>
      <p>${T('Klaps czyta teksty scenariuszy z nagłówkami scen w stylu <b>WN. KUCHNIA – DZIEŃ</b> albo <b>INT. KITCHEN – DAY</b>.')}</p>
      <div class="fmt"><span>PDF</span><span>FDX</span><span>FOUNTAIN</span><span>DOCX</span><span>TXT</span></div><br>
      <button class="btn primary big" data-act="pick-file">${ICON.file} ${T('Wybierz plik')}</button>
      <input type="file" id="file-in" accept=".pdf,.fdx,.fountain,.txt,.text,.md,.docx,.doc,.rtf" hidden>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>${T('Wklej tekst')}</h3><span class="muted small">${T('gdy scenariusz masz w innym programie')}</span><button class="btn sm" style="margin-left:auto" data-act="paste-toggle">${UI.paste ? T('Zwiń') : T('Rozwiń')}</button></div>
      ${UI.paste ? `<div class="card-b"><textarea id="paste-text" class="inp paste" placeholder="${T('Wklej tutaj scenariusz…')}" spellcheck="false">${esc(UI.pasteText)}</textarea><div class="row" style="margin-top:10px"><button class="btn primary" data-act="paste-go">${T('Analizuj tekst')}</button></div></div>` : ''}
    </div></div>
    <div class="card"><div class="card-h"><h3>${T('Co Klaps rozpoznaje')}</h3></div><div class="card-b small">
      <p style="margin-top:0">${T('<b>Nagłówki scen:</b> <code>1. WN. DOM ANNY – KUCHNIA – DZIEŃ</code>, <code>SCENA 12. PLENER. ULICA. NOC</code>, <code>INT./EXT. CAR – DUSK</code>.')}</p>
      <p>${T('<b>Obsada:</b> z wielkich liter nad dialogami (<code>ANNA</code>, <code>MARTA (V.O.)</code>) oraz z imion w opisach akcji.')}</p>
      <p>${T('<b>Długość sceny:</b> liczona w ósemkach strony, jak w Movie Magic. Z PDF-a dokładnie, z innych plików szacunkowo. Każdą wartość poprawisz ręcznie.')}</p>
      <p style="margin-bottom:0"><b>${T('Brak pliku pod ręką?')}</b></p><div class="row" style="margin-top:8px"><button class="btn" data-act="load-sample">${T('Wczytaj przykładowy scenariusz')}</button>${S.scenes.length ? '' : `<button class="btn primary" data-act="start-empty">${T('Zacznij bez scenariusza')}</button>`}</div>
    </div></div></div>`;
  return h;
}

function renderImportReview() {
  const imp = UI.imp, p = imp.parsed;
  const st = p.stats;
  const warn = (p.warnings || []).map((w) => `<div class="notice warn"><div>${esc(T(w.text || w, w.v))}</div></div>`).join('');
  const rows = p.scenes.map((s) => `<tr class="${kcls(s)}" style="background:var(--sb);color:var(--s-ink)"><td><b>${esc(s.num)}</b></td><td>${esc(Core.IE_LABEL[s.ie] || '—')}</td><td>${esc(s.place || '—')}</td><td>${esc((Core.TOD[s.tod] || {}).short || '')}</td><td class="num">${Core.fmtEighths(s.eighths)}</td><td>${esc(s.castNames.join(', '))}</td></tr>`).join('');
  const hasScenes = S.scenes.length > 0;
  const isPdf = imp.raw && imp.raw.kind === 'pdf';
  return `<div class="imp-grid">
    <div class="card"><div class="card-h"><h2>${T('Wynik analizy')}</h2><span class="muted small">${esc(imp.file)} · ${esc(T(st.source))}</span></div><div class="card-b">
      ${warn}
      <div class="stats" style="margin-bottom:14px"><div class="stat"><b>${st.scenes}</b><span>${T('scen')}</span></div><div class="stat"><b>${Core.fmtEighths(st.eighths)}</b><span>${T('stron')}</span></div><div class="stat"><b>${st.cast}</b><span>${T('postaci')}</span></div><div class="stat"><b>${new Set(p.scenes.map((s) => s.site)).size}</b><span>${T('obiektów')}</span></div></div>
      ${p.scenes.length ? `<div class="preview"><table><thead><tr><th>${T('Sc.')}</th><th>${T('W/Z')}</th><th>${T('Plan')}</th><th>${T('D/N')}</th><th>${T('Str.')}</th><th>${T('Obsada')}</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    </div></div>
    <div class="card"><div class="card-h"><h3>${T('Ustawienia importu')}</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:14px">
      <label class="field"><span class="lbl">${T('Postacie wzmiankowane w opisach akcji')}</span>
        <select class="inp" data-act-change="imp-castmode">${opt('all', T('Tak, także odmienione imiona (zalecane)'), S.meta.castMode || 'all')}${opt('caps', T('Tak, tylko zapisane WIELKIMI LITERAMI'), S.meta.castMode)}${opt('off', T('Nie, tylko postacie mówiące'), S.meta.castMode)}</select>
        <span class="muted small">${T('Dzięki temu postać, która w scenie milczy, też trafia do planu.')}</span></label>
      ${isPdf ? `<div class="small muted">${T('Strony PDF policzone z układu tekstu: {n} na stronę', { n: plN(st.linesPerPage, 'wiersz', 'wiersze', 'wierszy') })}${st.pageOffset ? ', ' + T('pominięto stronę tytułową') : ''}.</div>`
        : `<label class="field"><span class="lbl">${T('Wiersze na stronę scenariusza')}</span><input class="inp" type="number" min="30" max="80" value="${esc(S.meta.linesPerPage || 55)}" data-act-change="imp-lpp"><span class="muted small">${T('Ten plik nie ma układu stron, więc długość scen jest szacowana. Standard to 55 wierszy.')}</span></label>`}
      ${hasScenes ? `<div class="field"><span class="lbl">${T('W projekcie są już sceny')}</span>
        <label class="opt" style="border:0;padding:4px 0"><input type="radio" name="keep" value="1" data-act-change="imp-keep" ${imp.keep ? 'checked' : ''}><div><b>${T('Zachowaj dane scen o tych samych numerach')}</b><span>${T('opisy, elementy, uwagi i plan dni (nowa wersja scenariusza)')}</span></div></label>
        <label class="opt" style="border:0;padding:4px 0"><input type="radio" name="keep" value="0" data-act-change="imp-keep" ${!imp.keep ? 'checked' : ''}><div><b>${T('Zacznij od nowa')}</b><span>${T('usuwa dotychczasowe opisy i plan dni zdjęciowych')}</span></div></label></div>` : ''}
      <div class="row"><button class="btn primary big" data-act="imp-apply" ${p.scenes.length ? '' : 'disabled'}>${hasScenes ? T('Zastosuj nową wersję') : T('Utwórz rozpiskę scen')}</button><button class="btn" data-act="imp-cancel">${T('Anuluj')}</button></div>
    </div></div></div>`;
}

/* ================= ROZPISKA SCEN ================= */
function renderBoard() {
  if (!S.scenes.length) return pageH(T('Rozpiska scen'), T('Każda scena to jeden pasek. Dodaj sceny ręcznie albo wczytaj scenariusz.'), `<button class="btn" data-act="scene-add">${ICON.plus} ${T('Dodaj scenę')}</button>`) + needScenes();
  const idx = Core.scheduleIndex(S), cm = Core.castMap(S);
  const list = filteredScenes();
  const eighths = list.reduce((a, s) => a + s.eighths, 0);
  const f = UI.f;
  const rows = list.map((s) => {
    const sch = idx.get(s.id);
    const checked = UI.sel.has(s.id);
    return `<div class="strip bd ${kcls(s)}${checked ? ' sel' : ''}" data-act="scene-open" data-id="${s.id}">
      <div class="c"><input type="checkbox" data-act="sel-toggle" data-id="${s.id}" ${checked ? 'checked' : ''} aria-label="${T('Zaznacz scenę {n}', { n: esc(s.num) })}"></div>
      <div class="c scn">${esc(s.num)}</div><div class="c">${esc(Core.IE_LABEL[s.ie] || '—')}</div><div class="c">${esc((Core.TOD[s.tod] || {}).short || '')}</div>
      <div class="plc">${esc(s.place || s.site || '—')}${s.site && s.place && s.site !== s.place ? `<small>${esc(s.site)}</small>` : ''}</div>
      <div class="syn">${esc(s.synopsis)}</div>
      <div class="cst" title="${esc(s.cast.map((id) => (cm.get(id) || {}).name).filter(Boolean).join(', '))}">${esc(s.cast.slice().sort((a, b) => a - b).join(', '))}</div>
      <div class="c num">${Core.fmtEighths(s.eighths)}</div>
      <div class="c">${sch ? (sch.dayNo ? `<span class="dayb">D${sch.dayNo}</span>` : `<span class="dayb">${T('wolny')}</span>`) : '<span class="dayb none">—</span>'}</div></div>`;
  }).join('');
  const castOpts = S.cast.map((c) => opt(c.id, `${c.id} ${c.name}`, f.cast)).join('');
  const siteOpts = sitesList().map((x) => opt(x, x, f.site)).join('');
  const selBar = UI.sel.size ? `<div class="sel-bar"><b>${T('Zaznaczono {n}', { n: UI.sel.size })}</b>
      <select class="inp mini" data-act-change="bulk-to-day" aria-label="${T('Dodaj zaznaczone do dnia')}"><option value="">${T('Dodaj do dnia…')}</option>${S.days.filter((d) => d.kind === 'shoot').map((d) => opt(d.id, dayLabel(d, Core.dayNumbers(S)), '')).join('')}<option value="__new">${T('+ Nowy dzień zdjęciowy')}</option></select>
      <button class="btn sm" data-act="bulk-unplan">${T('Usuń z planu')}</button><button class="btn sm danger" data-act="bulk-delete">${ICON.trash} ${T('Usuń sceny')}</button><button class="btn sm ghost" data-act="sel-clear" style="margin-left:auto">${T('Wyczyść zaznaczenie')}</button></div>` : '';
  return pageH(T('Rozpiska scen'), T('Każda scena to jeden pasek. Kolor pokazuje wnętrze/plener i porę dnia. Kliknij pasek, aby uzupełnić opis, obsadę i elementy.'),
    `<button class="btn" data-act="scene-add">${ICON.plus} ${T('Dodaj scenę')}</button>`) +
    `<div class="toolbar">
      <input class="inp search" id="f-q" type="search" placeholder="${T('Szukaj: numer, plan, opis, postać…')}" value="${esc(f.q)}" aria-label="${T('Szukaj scen')}">
      <select class="inp" data-act-change="f-ie" aria-label="${T('Wnętrze / plener')}">${opt('', T('WN. i ZN.'), f.ie)}${opt('INT', T('Wnętrza'), f.ie)}${opt('EXT', T('Plenery'), f.ie)}</select>
      <select class="inp" data-act-change="f-tod" aria-label="${T('Pora dnia')}">${opt('', T('Cała doba'), f.tod)}${TODS.map(([k, l]) => opt(k, T(l), f.tod)).join('')}</select>
      <select class="inp" data-act-change="f-cast" aria-label="${T('Postać')}">${opt('', T('Każda postać'), f.cast)}${castOpts}</select>
      <select class="inp" data-act-change="f-site" aria-label="${T('Obiekt')}">${opt('', T('Każdy obiekt'), f.site)}${siteOpts}</select>
      <select class="inp" data-act-change="f-plan" aria-label="${T('Stan planu')}">${opt('', T('Wszystkie'), f.plan)}${opt('unplanned', T('Niezaplanowane'), f.plan)}${opt('planned', T('Zaplanowane'), f.plan)}</select>
      <button class="btn sm ghost" data-act="f-clear">${T('Wyczyść filtry')}</button>
      <span class="muted small" style="margin-left:auto">${T('<b class="num">{a}</b> z {b} scen · <b class="num">{p}</b> str.', { a: list.length, b: S.scenes.length, p: Core.fmtEighths(eighths) })}</span>
    </div>${selBar}
    <div class="board" data-scroll-id="board"><div class="board-in">
      <div class="bh"><div class="c"><input type="checkbox" data-act="sel-all" aria-label="${T('Zaznacz wszystkie widoczne')}" ${list.length && list.every((s) => UI.sel.has(s.id)) ? 'checked' : ''}></div><div class="c">${T('Sc.')}</div><div class="c">${T('W/Z')}</div><div class="c">${T('D/N')}</div><div>${T('Plan / lokacja')}</div><div>${T('Opis')}</div><div>${T('Obsada')}</div><div class="c">${T('Str.')}</div><div class="c">${T('Dzień')}</div></div>
      ${rows || `<div class="empty"><p>${T('Żadna scena nie pasuje do filtrów.')}</p></div>`}
    </div></div>
    <div class="legend">${Object.keys(Core.STRIP).map((k) => `<span class="k-${k}"><i></i>${Core.STRIP[k].name}</span>`).join('')}</div>`;
}

/* ================= KALENDARZÓWKA ================= */
function miniStrip(s, mode, nums, dayId) {
  const shootOpts = S.days.filter((d) => d.kind === 'shoot' && d.id !== dayId).map((d) => opt(d.id, dayLabel(d, nums), '')).join('');
  const moveSel = mode === 'pool'
    ? `<select data-act-change="pool-to-day" data-sid="${s.id}" aria-label="${T('Dodaj scenę {n} do dnia', { n: esc(s.num) })}"><option value="">${T('Dodaj…')}</option>${shootOpts}<option value="__new">${T('+ nowy dzień')}</option></select>`
    : `<select data-act-change="day-move" data-sid="${s.id}" aria-label="${T('Przenieś scenę {n}', { n: esc(s.num) })}"><option value="">${T('Przenieś…')}</option><option value="__pool">${T('Do zaplanowania')}</option>${shootOpts}</select>`;
  if (mode === 'pool') {
    return `<div class="mini-strip ${kcls(s)}" draggable="true" data-drag="1" data-sid="${s.id}" data-act="scene-open" data-id="${s.id}" title="${T('Przeciągnij na dzień zdjęciowy')}">
      <span class="g" aria-hidden="true">⋮⋮</span><span class="n">${esc(s.num)}</span>
      <div class="t"><b>${esc(s.place || s.site)}</b><span>${esc(Core.IE_LABEL[s.ie] || '')} ${esc((Core.TOD[s.tod] || {}).label || '')}${s.cast.length ? ' · ' + esc(s.cast.slice().sort((a, b) => a - b).join(', ')) : ''}</span></div>
      <span class="p">${Core.fmtEighths(s.eighths)}</span>${moveSel}</div>`;
  }
  return `<div class="mini-strip ${kcls(s)}" draggable="true" data-drag="1" data-sid="${s.id}" data-act="scene-open" data-id="${s.id}" title="${T('Przeciągnij, aby zmienić kolejność lub przenieść do innego dnia')}">
    <span class="g" aria-hidden="true">⋮⋮</span><span class="n">${esc(s.num)}</span><span class="ie">${esc(Core.IE_LABEL[s.ie] || '')} ${esc((Core.TOD[s.tod] || {}).short || '')}</span>
    <div class="t"><b>${esc(s.place || s.site)}</b></div><div class="t syn"><span>${esc(s.synopsis)}</span></div>
    <span class="cs" title="${T('Obsada')}">${esc(s.cast.slice().sort((a, b) => a - b).join(', '))}</span><span class="p">${Core.fmtEighths(s.eighths)}</span>${moveSel}</div>`;
}
const specialOptions = () => Core.DAY_KINDS.filter(([k]) => k !== 'shoot').map(([k, l]) => `<option value="${k}">${esc(T(l))}</option>`).join('');

function renderSchedule() {
  const idx = Core.scheduleIndex(S), nums = Core.dayNumbers(S);
  const hrs = Core.hoursCheck(S);
  const unsched = S.scenes.filter((s) => !idx.has(s.id));
  const shoot = S.days.filter((d) => d.kind === 'shoot');
  const special = S.days.filter((d) => Core.isSpecial(d.kind));
  const dates = shoot.map((d) => d.date).filter(Boolean).sort();
  const planned = S.scenes.length - unsched.length;
  const alerts = [...hrs.values()].reduce((a, h) => a + h.alerts.length, 0);
  const right = `<div class="seg" role="group" aria-label="${T('Widok')}"><button data-act="cal-view" data-v="days" aria-pressed="${UI.calView === 'days'}">${T('Dni')}</button><button data-act="cal-view" data-v="month" aria-pressed="${UI.calView === 'month'}">${T('Miesiąc')}</button></div>
    <button class="btn" data-act="autoplan-toggle" ${S.scenes.length ? '' : 'disabled'}>${T('Plan automatyczny')}</button>
    <button class="btn" data-act="day-add">${ICON.plus} ${T('Dzień zdjęciowy')}</button>
    <select class="inp btn-sel" data-act-change="day-add-kind" aria-label="${T('Dodaj dzień specjalny')}"><option value="">${T('+ Dzień specjalny…')}</option>${specialOptions()}</select>
    <button class="btn" data-act="export-quick-pdf" ${S.days.length ? '' : 'disabled'}>${ICON.dl} PDF</button>
    <button class="btn" data-act="export-quick-xlsx" ${S.days.length ? '' : 'disabled'}>${ICON.dl} Excel</button>`;
  let h = pageH(T('Kalendarzówka'), T('Przeciągnij sceny z listy po lewej na dni zdjęciowe albo uruchom plan automatyczny. Dni specjalne (przerzut, prelight, budowa dekoracji) nie wliczają się do numeracji dni zdjęciowych.'), right);
  const specCount = special.length ? `<span><b class="num">${special.length}</b>${pl(special.length, 'dzień specjalny', 'dni specjalne', 'dni specjalnych')}</span>` : '';
  h += `<div class="sum-bar"><span><b class="num">${shoot.length}</b>${pl(shoot.length, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych')}</span>${specCount}<span><b class="num">${planned}</b>${T('z {n} scen w planie', { n: S.scenes.length })}</span>${unsched.length ? `<span style="color:var(--warn)"><b class="num">${unsched.length}</b>${T('do zaplanowania')}</span>` : ''}${alerts ? `<span class="alert-sum">${ICON.warn} ${plN(alerts, 'ostrzeżenie czasu pracy', 'ostrzeżenia czasu pracy', 'ostrzeżeń czasu pracy')}</span>` : ''}${dates.length ? `<span class="muted">${Core.fmtShort(dates[0])} – ${Core.fmtShort(dates[dates.length - 1])}</span>` : ''}<span class="muted small" style="margin-left:auto">${T('Plan automatyczny: do {n} str. na dzień', { n: esc(+S.meta.pagesPerDay) })} <button class="btn sm ghost" data-act="settings-open">${T('zmień')}</button></span></div>`;
  if (UI.autoplan) {
    const ap = UI.ap;
    h += `<div class="autoplan"><div class="row"><label class="field"><span class="lbl">${T('Kolejność')}</span><select class="inp" data-act-change="ap-strategy">${opt('site', T('Wg obiektów (mniej przejazdów)'), ap.strategy)}${opt('script', T('Wg kolejności w scenariuszu'), ap.strategy)}</select></label>
      <label class="field"><span class="lbl">${T('Zakres')}</span><select class="inp" data-act-change="ap-scope">${opt('unscheduled', T('Tylko niezaplanowane ({n})', { n: unsched.length }), ap.scope)}${opt('all', T('Od nowa (zastąpi cały plan)'), ap.scope)}</select></label>
      <label class="chk"><input type="checkbox" data-act-change="ap-night" ${ap.separateNight ? 'checked' : ''}> ${T('Osobne dni dla scen nocnych, świtu i zmierzchu')}</label>
      <button class="btn primary" data-act="autoplan-run">${T('Ułóż plan')}</button><button class="btn" data-act="autoplan-toggle">${T('Anuluj')}</button></div>
      <p class="small muted" style="margin:10px 0 0">${ap.scope === 'all' ? T('<b>Uwaga:</b> plan od nowa usuwa dni zdjęciowe razem z ich planami pracy i kursami (dni specjalne zostają).') + ' ' : ''}${T('Do jednego dnia trafia najwyżej {n} str. scenariusza (limit zmienisz w ustawieniach). Później przeciągnij sceny, jak chcesz.', { n: esc(+S.meta.pagesPerDay) })}</p></div>`;
  }
  if (UI.calView === 'month') return h + renderMonth(nums);
  const pool = unsched.filter((s) => !UI.pool.q || (s.num + ' ' + s.place + ' ' + s.site).toLowerCase().includes(UI.pool.q.toLowerCase()));
  let poolRows;
  if (UI.pool.sort === 'site') {
    const groups = new Map();
    pool.forEach((s) => { const k = s.site || s.place || '—'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(s); });
    poolRows = [...groups.entries()].map(([k, arr]) => `<div class="grp">${esc(k)} · ${arr.length}</div>${arr.map((s) => miniStrip(s, 'pool', nums)).join('')}`).join('');
  } else {
    const arr = UI.pool.sort === 'tod' ? pool.slice().sort((a, b) => (Core.todClass(a.tod) === 'day' ? 0 : 1) - (Core.todClass(b.tod) === 'day' ? 0 : 1)) : pool;
    poolRows = arr.map((s) => miniStrip(s, 'pool', nums)).join('');
  }
  const poolEighths = unsched.reduce((a, s) => a + s.eighths, 0);
  h += `<div class="sched"><aside class="card pool"><div class="card-h"><h3>${T('Do zaplanowania')}</h3><span class="chip acc">${unsched.length} · ${Core.fmtEighths(poolEighths)} ${T('str.')}</span></div>
    <div class="row" style="padding:8px 8px 0"><input class="inp grow" id="pool-q" type="search" placeholder="${T('Szukaj sceny…')}" value="${esc(UI.pool.q)}" aria-label="${T('Szukaj w scenach do zaplanowania')}"><select class="inp mini" data-act-change="pool-sort" aria-label="${T('Sortowanie')}">${opt('script', T('Wg scenariusza'), UI.pool.sort)}${opt('site', T('Wg obiektów'), UI.pool.sort)}${opt('tod', T('Dzień / noc'), UI.pool.sort)}</select></div>
    <div class="pool-s" data-drop="pool" data-scroll-id="pool">${poolRows || `<div class="day-empty">${unsched.length ? T('Brak wyników.') : T('Wszystkie sceny są w planie.')}</div>`}</div></aside>
    <div class="days"><datalist id="dl-sites-sp">${sitesList().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>${S.days.length ? S.days.map((d, i) => renderDay(d, i, nums, hrs)).join('') : `<div class="card"><div class="empty"><h3>${T('Nie ma jeszcze dni zdjęciowych')}</h3><p>${T('Dodaj pierwszy dzień i przeciągnij do niego sceny albo pozwól Klapsowi ułożyć plan.')}</p><div class="row" style="justify-content:center">${S.scenes.length ? `<button class="btn primary big" data-act="autoplan-run-first">${T('Ułóż plan automatycznie')}</button>` : ''}<button class="btn big" data-act="day-add">${ICON.plus} ${T('Dodaj dzień')}</button></div></div></div>`}</div></div>`;
  return h;
}

const kindSelect = (d) => `<select class="inp kind-sel" data-act-change="day-kind" data-id="${d.id}" aria-label="${T('Rodzaj dnia')}">${Core.DAY_KINDS.map(([k, l]) => opt(k, T(l), d.kind)).join('')}</select>`;
const dayMenu = (d, i) => `<div class="day-menu"><button class="btn" data-act="day-up" data-id="${d.id}" title="${T('Przesuń dzień wyżej')}" aria-label="${T('Przesuń dzień wyżej')}" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button class="btn" data-act="day-down" data-id="${d.id}" title="${T('Przesuń dzień niżej')}" aria-label="${T('Przesuń dzień niżej')}" ${i === S.days.length - 1 ? 'disabled' : ''}>${ICON.down}</button><button class="btn" data-act="day-del" data-id="${d.id}" title="${T('Usuń dzień')}" aria-label="${T('Usuń dzień')}">${ICON.trash}</button></div>`;
const warnBar = (warns) => (warns.length ? `<div class="day-warn">${warns.map((w) => `<span>⚠ ${esc(w)}</span>`).join('')}</div>` : '');

function renderDay(d, i, nums, hrs) {
  const dayDate = d.date ? Core.dayName(d.date) : '';
  if (d.kind !== 'shoot') {
    const off = d.kind === 'off';
    const crewN = off ? 0 : S.crew.filter((c) => Core.crewWorks(c, d)).length;
    const warns = Core.dayWarnings(S, d, hrs);
    return `<section class="day sp sp-${d.kind}" data-day="${d.id}" id="day-${d.id}"><header class="day-h">
      <div class="day-no">${esc(Core.dayTitle(d, nums))}</div>
      <input class="inp" type="date" value="${esc(d.date)}" data-bind="day.date" data-id="${d.id}" aria-label="${T('Data')}"><span class="dow">${esc(dayDate)}</span>
      ${off ? '' : `<label class="lab">${T('Start')} <input class="inp" type="time" value="${esc(d.call)}" data-bind="day.call" data-id="${d.id}"></label><label class="lab">${T('Koniec')} <input class="inp" type="time" value="${esc(d.end || '')}" data-bind="day.end" data-id="${d.id}"></label>`}
      <div class="day-sum">${off ? '' : `<span class="small">${T('poza numeracją dni zdjęciowych')}</span>`}</div>
      ${dayMenu(d, i)}</header>
      ${warnBar(warns)}
      <div class="sp-body">${off
    ? `<label class="field" style="flex:3 1 260px"><span class="lbl">${T('Notatka')}</span><input class="inp" placeholder="${T('Notatka (np. odpoczynek ekipy)')}" value="${esc(d.note)}" data-bind="day.note" data-id="${d.id}"></label><label class="field kind-f"><span class="lbl">${T('Rodzaj dnia')}</span>${kindSelect(d)}</label>`
    : `<label class="field"><span class="lbl">${T('Lokacja / obiekt')}</span><input class="inp" list="dl-sites-sp" value="${esc(d.site || '')}" data-bind="day.site" data-id="${d.id}" placeholder="${d.kind === 'travel' ? T('np. Warszawa → Zakopane') : T('obiekt, w którym trwają prace')}"></label>
        <label class="field" style="flex:2 1 260px"><span class="lbl">${T('Opis prac i uwagi (trafiają do wydruku)')}</span><input class="inp" value="${esc(d.note)}" data-bind="day.note" data-id="${d.id}" placeholder="${T('np. ustawienie światła, przejazd ekipy, budowa wnętrza…')}"></label>
        <label class="field kind-f"><span class="lbl">${T('Rodzaj dnia')}</span>${kindSelect(d)}</label>
        <div class="sp-crew"><span class="lbl">${T('Ekipa tego dnia')}</span><button class="btn sm" data-act="crew-days-open">${plN(crewN, 'osoba', 'osoby', 'osób')}</button></div>`}</div></section>`;
  }
  const st = Core.dayStats(S, d);
  const warns = Core.dayWarnings(S, d, hrs);
  const cap = Core.maxEighths(S.meta);
  const pct = Math.min(100, Math.round((st.eighths / cap) * 100));
  const over = st.eighths > cap;
  const h = hrs.get(d.id);
  return `<section class="day" data-day="${d.id}" id="day-${d.id}"><header class="day-h">
    <div class="day-no">${T('Dzień')}<b>${nums.get(d.id)}</b></div>
    <input class="inp" type="date" value="${esc(d.date)}" data-bind="day.date" data-id="${d.id}" aria-label="${T('Data dnia zdjęciowego')}"><span class="dow">${esc(dayDate)}</span>
    <label class="lab">${T('Zbiórka')} <input class="inp" type="time" value="${esc(d.call)}" data-bind="day.call" data-id="${d.id}"></label>
    ${h && h.known ? `<span class="lab hrs" title="${T('Z planu pracy')}">${T('Koniec')} <b>${esc(Core.clock(h.end))}</b> · ${esc(Core.fmtDur(h.work))}</span>` : ''}
    <div class="day-sum"><b>${st.scenes.length}</b> ${pl(st.scenes.length, 'scena', 'sceny', 'scen')} · <b>${Core.fmtEighths(st.eighths)}</b> ${T('str.')}<div class="load${over ? ' over' : ''}" title="${T('Obłożenie dnia: {p}% limitu {n} str.', { p: pct, n: esc(+S.meta.pagesPerDay) })}"><i style="width:${pct}%"></i></div></div>
    ${dayMenu(d, i)}</header>
    ${warnBar(warns)}
    <div class="day-body" data-drop="day:${d.id}">${st.scenes.length ? st.scenes.map((s) => miniStrip(s, 'day', nums, d.id)).join('') : `<div class="day-empty">${T('Przeciągnij tu sceny z listy „Do zaplanowania”.')}</div>`}</div>
    <div class="day-f"><div><div class="lbl">${T('Obsada dnia')}</div><div class="chips">${castChips(st.castIds) || '<span class="muted">—</span>'}</div><div class="lbl" style="margin-top:8px">${T('Obiekty')}</div><div class="chips">${st.sites.map((x) => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="muted">—</span>'}</div><div class="lbl" style="margin-top:8px">${T('Rodzaj dnia')}</div>${kindSelect(d)}</div>
    <label class="field"><span class="lbl">${T('Uwagi do dnia (trafiają do wydruku)')}</span><textarea class="inp" rows="3" data-bind="day.note" data-id="${d.id}" placeholder="${T('np. zezwolenie na plan, rekwizyty z magazynu, dojazd…')}">${esc(d.note)}</textarea></label></div></section>`;
}

function renderMonth(nums) {
  const shoot = S.days.filter((d) => d.date);
  let ym = UI.month;
  if (!ym) { const first = shoot.map((d) => d.date).sort()[0] || S.meta.startDate || Core.todayISO(); ym = first.slice(0, 7); UI.month = ym; }
  const [Y, M] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(Y, M - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  const cells = Math.ceil((offset + dim) / 7) * 7;
  const byDate = new Map();
  S.days.forEach((d) => { if (!byDate.has(d.date)) byDate.set(d.date, []); byDate.get(d.date).push(d); });
  const today = Core.todayISO();
  const ds = Core.DAYS_SHORT;
  let grid = [1, 2, 3, 4, 5, 6, 0].map((x) => `<div class="dn">${ds[x]}</div>`).join('');
  for (let c = 0; c < cells; c++) {
    const dnum = c - offset + 1;
    const dt = new Date(Date.UTC(Y, M - 1, dnum));
    const iso = Core.isoOf(dt);
    const out = dnum < 1 || dnum > dim;
    const dw = dt.getUTCDay();
    const chips = (byDate.get(iso) || []).map((d) => {
      if (d.kind !== 'shoot') return `<button class="mchip sp sp-${d.kind}" data-act="goto-day" data-id="${d.id}"><b>${esc(Core.dayTag(d, nums))}</b><div class="meta">${esc(d.site || d.note || '')}</div></button>`;
      const st = Core.dayStats(S, d);
      return `<button class="mchip" data-act="goto-day" data-id="${d.id}"><b>D${nums.get(d.id)}</b> <span class="meta">${st.scenes.length} ${T('sc.')} · ${Core.fmtEighths(st.eighths)} ${T('str.')}</span><div class="meta small muted">${esc(d.call || '')}${st.sites[0] ? ' · ' + esc(st.sites[0].toLowerCase()) : ''}</div><div class="dots">${st.scenes.map((s) => `<i class="${kcls(s)}"></i>`).join('')}</div></button>`;
    }).join('');
    grid += `<div class="mcell${out ? ' out' : ''}${dw === 0 || dw === 6 ? ' we' : ''}${iso === today ? ' today' : ''}"><span class="d">${dt.getUTCDate()}</span>${chips}</div>`;
  }
  return `<div class="month"><div class="month-h"><button class="btn sm" data-act="month-prev" aria-label="${T('Poprzedni miesiąc')}">${ICON.left}</button><h3>${Core.MONTHS_NOM[M - 1]} ${Y}</h3><button class="btn sm" data-act="month-next" aria-label="${T('Następny miesiąc')}">${ICON.right}</button><button class="btn sm ghost" data-act="month-today">${T('Początek zdjęć')}</button></div><div class="mgrid">${grid}</div></div>`;
}

/* ================= OBSADA ================= */
function renderCast() {
  const idx = Core.scheduleIndex(S);
  const dietOpts = Core.DIETS.map(([k, l]) => [k, T(l)]);
  const dl = `<datalist id="dl-contract">${Core.CONTRACTS.map((x) => `<option value="${esc(T(x))}">`).join('')}</datalist><datalist id="dl-ctrans">${[T('Własny'), T('Bus produkcji'), T('Odbiór przez kierowcę produkcji'), T('Zorganizowany dojazd')].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
  const rows = S.cast.map((c) => {
    const scs = S.scenes.filter((s) => s.cast.includes(c.id));
    const days = new Set(scs.map((s) => (idx.get(s.id) || {}).dayNo).filter(Boolean));
    const eighths = scs.reduce((a, s) => a + s.eighths, 0);
    const others = S.cast.filter((o) => o.id !== c.id).map((o) => opt(o.id, `${o.id} ${o.name}`, '')).join('');
    const open = UI.castOpen.has(c.id);
    const nm = c.actor || c.name;
    const main = `<tr><td class="num"><b>${c.id}</b></td><td style="min-width:140px"><input class="inp" value="${esc(c.name)}" data-bind="cast.name" data-id="${c.id}" aria-label="${T('Postać {n}', { n: c.id })}"></td>
      <td style="min-width:150px"><input class="inp" value="${esc(c.actor)}" placeholder="${T('aktor / aktorka')}" data-bind="cast.actor" data-id="${c.id}" aria-label="${T('Aktor postaci {n}', { n: esc(c.name) })}"></td>
      <td style="min-width:120px"><input class="inp" value="${esc(c.phone)}" placeholder="${T('telefon')}" inputmode="tel" data-bind="cast.phone" data-id="${c.id}" aria-label="${T('Telefon')} – ${esc(nm)}"></td>
      <td class="num">${scs.length}</td><td class="num">${Core.fmtEighths(eighths)}</td><td class="num">${days.size || '—'}</td>
      <td style="max-width:240px">${scs.map((s) => `<button class="numlink" data-act="scene-open" data-id="${s.id}">${esc(s.num)}</button>`).join('')}</td>
      <td style="white-space:nowrap"><div class="rowact">${c.diet && c.diet !== 'meat' ? `<span class="diet-tag" title="${esc(Core.dietLabel(c.diet))}">${esc(Core.dietLabel(c.diet, true))}</span>` : ''}${c.lodging === 'Tak' ? `<span class="diet-tag lodge" title="${T('Nocleg')}">${T('Nocleg')}</span>` : ''}<button class="btn sm${open ? '' : ' ghost'}" data-act="cast-toggle" data-id="${c.id}" aria-expanded="${open}" aria-label="${T('Szczegóły: {n}', { n: esc(nm) })}">${open ? T('Zwiń') : T('Szczegóły')}</button><select class="inp mini" data-act-change="cast-merge" data-id="${c.id}" aria-label="${T('Połącz {n} z inną postacią', { n: esc(c.name) })}"><option value="">${T('Połącz z…')}</option>${others}</select><button class="btn sm ghost danger" data-act="cast-del" data-id="${c.id}" title="${T('Usuń postać ze wszystkich scen')}" aria-label="${T('Usuń postać ze wszystkich scen')}">${ICON.trash}</button></div></td></tr>`;
    if (!open) return main;
    const fld = (label, key, o = {}) => `<label class="field"><span class="lbl">${label}</span><input class="inp" value="${esc(c[key] || '')}"${o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o.list ? ` list="${o.list}"` : ''}${o.mode ? ` inputmode="${o.mode}"` : ''} data-bind="cast.${key}" data-id="${c.id}" aria-label="${esc(label)} – ${esc(nm)}"></label>`;
    return main + `<tr class="crew-det"><td colspan="9"><div class="fgrid">${fld('E-mail', 'email', { ph: 'imie@domena.pl', mode: 'email' })}${fld(T('Typ umowy'), 'contract', { list: 'dl-contract', ph: T('np. umowa o dzieło') })}${fld(T('Stawka'), 'rate', { ph: T('np. 1500 zł / dzień zdjęciowy') })}
      <label class="field"><span class="lbl">${T('Nocleg')}</span><select class="inp" data-bind="cast.lodging" data-id="${c.id}" aria-label="${T('Nocleg')} – ${esc(nm)}">${[['', '—'], ['Tak', T('Tak')], ['Nie', T('Nie')]].map(([v, l]) => opt(v, l, c.lodging || '')).join('')}</select></label>
      <label class="field"><span class="lbl">${T('Dieta')}</span><select class="inp" data-bind="cast.diet" data-id="${c.id}" aria-label="${T('Dieta')} – ${esc(nm)}">${dietOpts.map(([k, l]) => opt(k, l, c.diet || 'meat')).join('')}</select></label>
      ${fld(T('Alergie / uwagi do diety'), 'dietNote', { ph: T('np. orzechy, celiakia') })}${fld(T('Transport'), 'transport', { list: 'dl-ctrans', ph: T('np. odbiór z hotelu o 6:00') })}
      <label class="field" style="grid-column:1/-1"><span class="lbl">${T('Uwagi')}</span><textarea class="inp" rows="2" data-bind="cast.notes" data-id="${c.id}" placeholder="${T('agent, kostium, wymagania, dostępność…')}" aria-label="${T('Uwagi')} – ${esc(nm)}">${esc(c.notes || '')}</textarea></label></div></td></tr>`;
  }).join('');
  const withActor = S.cast.filter((c) => c.actor).length, lodging = S.cast.filter((c) => c.lodging === 'Tak').length, diets = S.cast.filter((c) => (c.diet && c.diet !== 'meat') || c.dietNote).length;
  return pageH(T('Obsada'), T('Postacie wykryte w scenariuszu i grający je aktorzy. W „Szczegółach” zapiszesz kontakt, umowę, stawkę, nocleg, dietę, transport i uwagi, tak jak w Ekipie. Połącz zdublowane postacie (np. ANNA i MŁODA ANNA) albo usuń pomyłkowe. Dieta aktora trafia do raportu cateringowego w dniach, w których gra.'), exportBtns('cast-export', S.cast.length > 0)) + dl +
    (S.cast.length ? `<div class="card" style="margin-bottom:16px"><div class="card-b"><div class="stats"><div class="stat"><b>${S.cast.length}</b><span>${T('postaci')}</span></div><div class="stat"><b>${withActor}</b><span>${T('z obsadzonym aktorem')}</span></div><div class="stat"><b>${lodging}</b><span>${T('potrzebuje noclegu')}</span></div><div class="stat"><b>${diets}</b><span>${T('z dietą specjalną')}</span></div></div></div></div>` : '') +
    `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>${T('Nr')}</th><th>${T('Postać')}</th><th>${T('Aktor / aktorka')}</th><th>${T('Telefon')}</th><th>${T('Sceny')}</th><th>${T('Str.')}</th><th>${T('Dni')}</th><th>${T('Numery scen')}</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="9" class="muted" style="padding:20px">${T('Brak postaci.')}</td></tr>`}</tbody></table></div>
    <div class="row" style="margin-top:12px"><input class="inp" style="max-width:280px" id="new-cast" placeholder="${T('Nowa postać…')}" aria-label="${T('Nazwa nowej postaci')}"><button class="btn" data-act="cast-add">${ICON.plus} ${T('Dodaj postać')}</button></div>`;
}

/* ================= LOKACJE ================= */
const contractCls = (k) => (!k ? 'none' : k === 'signed' ? 'ok' : k === 'sent' || k === 'negotiation' ? 'warn' : 'bad');
function renderSites() {
  const rd = Core.reportData(S);
  const rows = rd.sites.map((x) => {
    const info = Core.siteEntry(S.sites[x.site]);
    const scs = S.scenes.filter((s) => (s.site || s.place || '(bez nazwy)') === x.site);
    const name = x.site === '(bez nazwy)' ? T('(bez nazwy)') : x.site;
    const id = esc(x.site), open = UI.siteOpen.has(x.site);
    const inp = (key, ph, o = {}) => `<input class="inp" value="${esc(info[key])}" placeholder="${esc(ph)}"${o.mode ? ` inputmode="${o.mode}"` : ''} data-bind="site.${key}" data-id="${id}" aria-label="${esc(o.label || ph)} – ${esc(name)}">`;
    const main = `<tr><td style="min-width:170px"><input class="inp site-key" value="${esc(name)}" data-act-change="site-rename" data-from="${id}" aria-label="${T('Nazwa obiektu {n}', { n: esc(name) })}"></td>
      <td style="min-width:180px">${inp('realName', T('oficjalna nazwa miejsca'), { label: T('Rzeczywista nazwa') })}</td>
      <td style="min-width:200px">${inp('address', T('ulica, numer, miejscowość'), { label: T('Adres') })}</td>
      <td style="min-width:170px"><select class="inp st-sel st-${contractCls(info.contract)}" data-bind="site.contract" data-id="${id}" aria-label="${T('Status umowy')} – ${esc(name)}">${Core.SITE_CONTRACT.map(([k, l]) => opt(k, T(l), info.contract)).join('')}</select></td>
      <td class="num">${x.scenes}</td><td class="num">${x.days.length ? x.days.map((n) => 'D' + n).join(', ') : '—'}</td>
      <td style="max-width:220px">${scs.map((s) => `<button class="numlink" data-act="scene-open" data-id="${s.id}" title="${esc(s.place)}">${esc(s.num)}</button>`).join('')}</td>
      <td style="white-space:nowrap"><div class="rowact">${info.power === 'generator' ? `<span class="diet-tag warn-tag" title="${T('Brak prądu – agregat')}">${T('Agregat')}</span>` : ''}<button class="btn sm${open ? '' : ' ghost'}" data-act="site-toggle" data-id="${id}" aria-expanded="${open}" aria-label="${T('Szczegóły: {n}', { n: esc(name) })}">${open ? T('Zwiń') : T('Szczegóły')}</button>${!scs.length && (S.sites[x.site] || {}).manual ? `<button class="btn sm ghost danger" data-act="site-del" data-id="${id}" aria-label="${T('Usuń lokację')}">${ICON.trash}</button>` : ''}</div></td></tr>`;
    if (!open) return main;
    const fld = (label, key, ph, o) => `<label class="field"><span class="lbl">${label}</span>${inp(key, ph, Object.assign({ label }, o || {}))}</label>`;
    return main + `<tr class="crew-det site-det"><td colspan="8"><div class="fgrid">
      ${fld(T('Właściciel / osoba kontaktowa'), 'owner', T('imię i nazwisko, funkcja'))}${fld(T('Kontakt do właściciela'), 'ownerContact', T('telefon, e-mail'), { mode: 'tel' })}
      <label class="field"><span class="lbl">${T('Zasilanie na miejscu')}</span><select class="inp" data-bind="site.power" data-id="${id}" aria-label="${T('Zasilanie na miejscu')} – ${esc(name)}">${Core.POWER.map(([k, l]) => opt(k, T(l), info.power)).join('')}</select></label>
      ${fld(T('Lokalizacja toalety'), 'toilet', T('np. budynek dworca, parter; toi-toi przy bramie'))}${fld(T('Lokalizacja campu / bazy'), 'camp', T('miejsce na sprzęt, catering, busy, kampery'))}
      <label class="field" style="grid-column:1/-1"><span class="lbl">${T('Inne informacje / uwagi')}</span><textarea class="inp" rows="3" data-bind="site.notes" data-id="${id}" placeholder="${T('parking, ograniczenia hałasu, godziny dostępu, klucze, zgody…')}" aria-label="${T('Inne informacje / uwagi')} – ${esc(name)}">${esc(info.notes)}</textarea></label></div></td></tr>`;
  }).join('');
  const all = rd.sites.map((x) => Core.siteEntry(S.sites[x.site]));
  const signed = all.filter((o) => o.contract === 'signed').length, pending = all.filter((o) => Core.contractOpen(o.contract)).length, gen = all.filter((o) => o.power === 'generator').length;
  return pageH(T('Lokacje'), T('Obiekty zdjęciowe pogrupowane z nagłówków scen (np. DOM ANNY). W „Szczegółach” zapiszesz właściciela, kontakt, zasilanie, toaletę, miejsce na camp i uwagi. Adres, camp i toaleta trafiają do planu pracy, a niepodpisana umowa daje ostrzeżenie w kalendarzówce. Zmiana nazwy obiektu zmienia go we wszystkich scenach.'), exportBtns('site-export', rd.sites.length > 0)) +
    (rd.sites.length ? `<div class="card" style="margin-bottom:16px"><div class="card-b"><div class="stats"><div class="stat"><b>${rd.sites.length}</b><span>${T('obiektów')}</span></div><div class="stat"><b>${signed}</b><span>${T('umów podpisanych')}</span></div><div class="stat"><b style="${pending ? 'color:var(--warn)' : ''}">${pending}</b><span>${T('umów do domknięcia')}</span></div><div class="stat"><b>${gen}</b><span>${T('z agregatem')}</span></div></div></div></div>` : '') +
    `<div class="tbl-wrap"><table class="tbl sites-tbl"><thead><tr><th>${T('Obiekt')}</th><th>${T('Rzeczywista nazwa')}</th><th>${T('Adres')}</th><th>${T('Status umowy')}</th><th>${T('Sceny')}</th><th>${T('Dni zdjęciowe')}</th><th>${T('Numery scen')}</th><th></th></tr></thead><tbody>${rows || `<tr><td colspan="8" class="muted" style="padding:20px">${T('Brak lokacji. Pojawią się z scen albo dodaj własną poniżej.')}</td></tr>`}</tbody></table></div>
    <div class="row" style="margin-top:12px"><input class="inp" style="max-width:280px" id="new-site" placeholder="${T('Nowa lokacja…')}" aria-label="${T('Nazwa nowej lokacji')}"><button class="btn" data-act="site-add">${ICON.plus} ${T('Dodaj lokację')}</button></div>`;
}

/* ================= DOOD ================= */
function renderDood() {
  const dd = Core.dood(S);
  const head = dd.days.map((d) => `<th title="${esc(Core.fmtDatePL(d.date))}">D${d.no}<span class="dh">${esc(Core.fmtDM(d.date))}</span></th>`).join('');
  const rows = dd.rows.map((r) => { const c = S.cast.find((x) => x.id === r.id); return `<tr><td class="l sticky-l"><b>${r.id}</b> ${esc(r.name)}${c && c.actor ? `<div class="muted small">${esc(c.actor)}</div>` : ''}</td>${r.codes.map((x) => `<td>${x ? `<span class="cd ${x}">${x}</span>` : ''}</td>`).join('')}<td><b>${r.work}</b></td><td class="muted">${r.hold}</td></tr>`; }).join('');
  const lg = (k, t) => `<span><i class="cd ${k}" style="width:auto;border:0;padding:1px 6px">${k}</i> ${t}</span>`;
  return pageH('Day out of Days', T('Kiedy każda postać pracuje. Zestawienie powstaje samo z kalendarzówki, więc zmiana planu od razu zmienia dni aktorów.')) +
    (dd.days.length ? `<div class="tbl-wrap" data-scroll-id="dood"><table class="tbl dood"><thead><tr><th class="l sticky-l" style="background:var(--surface-3)">${T('Postać')}</th>${head}<th>${T('Dni pracy')}</th><th>${T('Wstrz.')}</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="legend">${lg('SW', T('start pracy'))}${lg('W', T('praca'))}${lg('WF', T('koniec pracy'))}${lg('SWF', T('start i koniec w jednym dniu'))}${lg('H', T('wstrzymanie (aktor czeka, nie gra)'))}</div>`
      : `<div class="card"><div class="empty"><h3>${T('Brak dni zdjęciowych')}</h3><p>${T('Zaplanuj sceny w kalendarzówce, a zobaczysz tu dni pracy aktorów.')}</p><button class="btn primary" data-act="tab" data-tab="schedule">${T('Przejdź do kalendarzówki')}</button></div></div>`);
}

/* ================= EKSPORT ================= */
function renderExport() {
  const x = UI.exp;
  const shoot = S.days.filter((d) => d.kind === 'shoot').length;
  const work = S.days.filter((d) => d.kind !== 'off').length;
  const nums = Core.dayNumbers(S);
  const counts = {
    calendar: plN(shoot, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych'), board: plN(S.scenes.length, 'scena', 'sceny', 'scen'), cast: plN(S.cast.length, 'postać', 'postacie', 'postaci'),
    sites: plN(sitesList().length, 'obiekt', 'obiekty', 'obiektów'), dood: T('{a} × {b}', { a: plN(S.cast.length, 'postać', 'postacie', 'postaci'), b: plN(shoot, 'dzień', 'dni', 'dni') }), callsheet: T('{n} (po jednym na dzień)', { n: plN(shoot, 'plan', 'plany', 'planów') }),
    transport: plN(S.transport.trips.length, 'kurs', 'kursy', 'kursów'), shotlist: plN(S.shots.length, 'ujęcie', 'ujęcia', 'ujęć'), crew: plN(S.crew.length, 'osoba', 'osoby', 'osób'),
    catering: plN(work, 'dzień pracy', 'dni pracy', 'dni pracy'), budget: plN(S.budget.items.length, 'pozycja', 'pozycje', 'pozycji'),
  };
  const desc = {
    calendar: T('Dni zdjęciowe z datami, zbiórką, scenami, obsadą dnia i sumami, a także dni specjalne (przerzut, prelight, budowa). Kolorowe paski jak w rozpisce.'), board: T('Wszystkie sceny w kolejności scenariusza z numerem dnia zdjęciowego.'),
    cast: T('Lista postaci z aktorami, liczbą scen i dniami zdjęciowymi.'), sites: T('Obiekty z adresami, scenami i dniami zdjęciowymi.'), dood: T('Day out of Days: dni pracy każdej postaci (SW, W, WF, H).'),
    callsheet: T('Plan pracy każdego dnia zdjęciowego (PDF pionowo): zbiórki, harmonogram z godzinami, obsada, transport, kontakty, catering i mapki. Pojedynczy dzień pobierzesz w zakładce Plan pracy.'),
    transport: T('Pojazdy, kierowcy i kursy pogrupowane według dni.'), budget: T('Podsumowanie pionów i pozycje kosztowe, plan i rzeczywistość.'),
    shotlist: T('Tabela ujęć: scena, typ planu, opis, obiektyw, grip, ETA, aktorzy, lokacja, z legendą skrótów.'),
    crew: T('Lista ekipy pogrupowana według pionów: imię i nazwisko, funkcja, telefon (PDF pionowo, bez stawek i umów). Excel zawiera wszystkie dane i siatkę dni pracy.'),
    catering: T('Liczba posiłków według diet na każdy dzień pracy oraz lista diet specjalnych i alergii (PDF pionowo).'),
  };
  const any = Object.values(x).some(Boolean);
  const lang = S.meta.docLang || PREFS.lang;
  return pageH(T('Eksport'), T('Wybierz, co ma się znaleźć w pliku. PDF ma format A4 poziomo, a plany pracy, ekipa i catering pionowo. Excel ma osobne arkusze z formułami sum.')) +
    `<div class="exp-grid"><div class="card"><div class="card-h"><h2>${T('Zawartość pliku')}</h2><label class="field" style="margin-left:auto;min-width:160px"><span class="lbl">${T('Język dokumentu')}</span><select class="inp" data-act-change="doc-lang">${opt('', T('Jak interfejs ({l})', { l: PREFS.lang.toUpperCase() }), S.meta.docLang || '')}${opt('pl', 'Polski (PL)', S.meta.docLang)}${opt('en', 'English (EN)', S.meta.docLang)}</select></label></div><div class="card-b">
      ${Reports.SECTIONS.map(([k, l]) => `<label class="opt"><input type="checkbox" data-act-change="exp-toggle" data-k="${k}" ${x[k] ? 'checked' : ''}><div><b>${T(l)}</b><span>${desc[k]} <span class="chip">${counts[k]}</span></span></div></label>`).join('')}
      ${shoot === 0 && x.calendar ? `<div class="notice warn" style="margin-top:10px"><div>${T('Kalendarzówka jest jeszcze pusta. Zaplanuj sceny w zakładce „Kalendarzówka”, aby pojawiły się w pliku.')}</div></div>` : ''}
      <div class="row" style="margin-top:14px"><button class="btn primary big" data-act="export-pdf" ${any ? '' : 'disabled'}>${ICON.dl} ${T('Pobierz PDF')}</button><button class="btn big" data-act="export-xlsx" ${any ? '' : 'disabled'}>${ICON.dl} ${T('Pobierz Excel (.xlsx)')}</button></div>
      <p class="muted small" style="margin:10px 0 0">${T('Dokumenty powstaną w języku: {l}. Przeglądarka poprosi o potwierdzenie zapisu pliku.', { l: lang === 'en' ? 'English' : 'polski' })}</p></div></div>
    <div style="display:flex;flex-direction:column;gap:16px"><div class="card"><div class="card-h"><h3>${T('Kopia projektu')}</h3></div><div class="card-b"><p class="small" style="margin-top:0">${T('Plik .json zawiera cały projekt: scenariusz, rozpiskę, plan i mapki. Przyda się do kopii zapasowej albo przeniesienia na inny komputer.')}</p>
      <div class="row"><button class="btn" data-act="export-json">${ICON.dl} ${T('Zapisz projekt (.json)')}</button><button class="btn" data-act="pick-json">${ICON.file} ${T('Wczytaj projekt…')}</button><input type="file" id="json-in" accept=".json,application/json" hidden></div></div></div>
    <div class="card"><div class="card-h"><h3>${T('Plan w skrócie')}</h3></div><div class="card-b small">${S.days.length ? S.days.map((d) => d.kind !== 'shoot' ? `<div class="muted">${esc(Core.fmtShort(d.date))} · ${esc(Core.dayTitle(d, nums).toLowerCase())}${d.site ? ' · ' + esc(d.site) : ''}</div>` : `<div><b>D${nums.get(d.id)}</b> · ${esc(Core.fmtDatePL(d.date))} · ${plN(d.sceneIds.length, 'scena', 'sceny', 'scen')} · ${esc(Core.fmtEighths(Core.dayStats(S, d).eighths))} ${T('str.')}</div>`).join('') : `<span class="muted">${T('Nie ma jeszcze dni zdjęciowych.')}</span>`}</div></div></div></div>`;
}

/* ================= SZUFLADA SCENY ================= */
function renderDrawer() {
  const sc = S.scenes.find((s) => s.id === UI.drawer);
  if (!sc) return '';
  const i = S.scenes.indexOf(sc);
  const idxs = Core.scheduleIndex(S), nums = Core.dayNumbers(S);
  const sch = idxs.get(sc.id);
  const cm = Core.castMap(S);
  const avail = S.cast.filter((c) => !sc.cast.includes(c.id));
  const lines = (sc.text || '').split('\n').map((l) => { const t = l.slice(0, 1), tx = l.slice(2); return tx ? `<div class="${t}">${esc(tx)}</div>` : ''; }).join('');
  const el = sc.elements || {};
  return `<div class="scrim" data-act="drawer-close"></div>
  <aside class="drawer" role="dialog" aria-label="${T('Scena {n}', { n: esc(sc.num) })}">
    <div class="drawer-h ${kcls(sc)}">
      <button class="btn sm" data-act="scene-prev" ${i === 0 ? 'disabled' : ''} aria-label="${T('Poprzednia scena')}">${ICON.left}</button><button class="btn sm" data-act="scene-next" ${i === S.scenes.length - 1 ? 'disabled' : ''} aria-label="${T('Następna scena')}">${ICON.right}</button>
      <div class="ttl">${T('Scena {n}', { n: esc(sc.num) })}<div style="font-size:15px;font-weight:500;letter-spacing:.02em">${esc(Core.IE_LABEL[sc.ie] || '')} ${esc(sc.place || sc.site)} · ${esc((Core.TOD[sc.tod] || {}).label || '')}</div></div>
      <button class="btn sm" data-act="drawer-close" aria-label="${T('Zamknij')}">${ICON.x}</button></div>
    <div class="drawer-b" data-scroll-id="drawer">
      <div class="fgrid">
        <label class="field"><span class="lbl">${T('Numer sceny')}</span><input class="inp" value="${esc(sc.num)}" data-bind="scene.num" data-id="${sc.id}"></label>
        <label class="field"><span class="lbl">${T('Wnętrze / plener')}</span><select class="inp" data-bind="scene.ie" data-id="${sc.id}">${IES.map(([k, l]) => opt(k, T(l), sc.ie)).join('')}</select></label>
        <label class="field"><span class="lbl">${T('Pora dnia')}</span><select class="inp" data-bind="scene.tod" data-id="${sc.id}">${TODS.map(([k, l]) => opt(k, T(l), sc.tod)).join('')}</select></label>
        <label class="field"><span class="lbl">${T('Długość (str.)')}</span><input class="inp" value="${esc(Core.fmtEighths(sc.eighths))}" data-act-change="scene-eighths" data-id="${sc.id}" title="${T('Np. 2 3/8, 5/8 albo 1')}"></label>
      </div>
      <div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <label class="field"><span class="lbl">${T('Plan / lokacja w scenie')}</span><input class="inp" value="${esc(sc.place)}" data-bind="scene.place" data-id="${sc.id}"></label>
        <label class="field"><span class="lbl">${T('Obiekt (grupowanie)')}</span><input class="inp" list="dl-sites" value="${esc(sc.site)}" data-bind="scene.site" data-id="${sc.id}"><datalist id="dl-sites">${sitesList().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
        <label class="field"><span class="lbl">${T('Dzień zdjęciowy')}</span><select class="inp" data-act-change="scene-day" data-id="${sc.id}">${opt('', T('Nie zaplanowano'), sch ? sch.dayId : '')}${S.days.filter((d) => d.kind === 'shoot').map((d) => opt(d.id, dayLabel(d, nums), sch ? sch.dayId : '')).join('')}<option value="__new">${T('+ Nowy dzień zdjęciowy')}</option></select></label>
      </div>
      <label class="field"><span class="lbl">${T('Opis sceny')}</span><textarea class="inp" rows="3" data-bind="scene.synopsis" data-id="${sc.id}">${esc(sc.synopsis)}</textarea></label>
      <div><span class="lbl">${T('Obsada w scenie')}</span><div class="chips" style="margin-bottom:8px">${sc.cast.slice().sort((a, b) => a - b).map((id) => { const c = cm.get(id); return c ? `<span class="chip acc"><b>${c.id}</b> ${esc(c.name)}<button data-act="scene-cast-del" data-id="${sc.id}" data-cid="${c.id}" aria-label="${T('Usuń {n} ze sceny', { n: esc(c.name) })}">×</button></span>` : ''; }).join('') || `<span class="muted small">${T('Nikt nie występuje.')}</span>`}</div>
        <div class="row"><select class="inp mini" data-act-change="scene-cast-add" data-id="${sc.id}" aria-label="${T('Dodaj postać do sceny')}"><option value="">${T('Dodaj postać…')}</option>${avail.map((c) => opt(c.id, `${c.id} ${c.name}`, '')).join('')}</select>
        <input class="inp mini" style="width:170px" placeholder="${T('lub nowa postać')}" data-act-change="scene-cast-new" data-id="${sc.id}" id="dr-newcast" aria-label="${T('Nowa postać')}"></div></div>
      <div><span class="lbl">${T('Elementy sceny')}</span><div class="eg">${Core.ELEMENT_CATS.map(([k, l]) => `<div><div class="small" style="font-weight:600;margin-bottom:3px">${T(l)}</div><div class="chips">${(el[k] || []).map((t, n) => `<span class="chip">${esc(t)}<button data-act="el-del" data-id="${sc.id}" data-cat="${k}" data-i="${n}" aria-label="${T('Usuń {n}', { n: esc(t) })}">×</button></span>`).join('')}</div><input class="inp mini" style="width:100%" id="el-${k}" placeholder="${T('dodaj i Enter')}" data-act-change="el-add" data-id="${sc.id}" data-cat="${k}" aria-label="${T(l)}: ${T('dodaj')}"></div>`).join('')}</div></div>
      <label class="field"><span class="lbl">${T('Uwagi do sceny (trafiają do wydruku)')}</span><textarea class="inp" rows="2" data-bind="scene.notes" data-id="${sc.id}" placeholder="${T('np. zgoda na plan, dziecko na planie, dublet dźwiękowy…')}">${esc(sc.notes)}</textarea></label>
      <div><div class="row" style="margin-bottom:6px"><span class="lbl" style="margin:0">${T('Tekst sceny')}</span><button class="btn sm ghost" data-act="script-toggle">${UI.showScript ? T('Ukryj') : T('Pokaż')}</button></div>${UI.showScript ? `<div class="script">${lines || `<span class="muted">${T('Brak tekstu (scena dodana ręcznie).')}</span>`}</div>` : ''}</div>
      <div class="row" style="border-top:1px solid var(--line-2);padding-top:12px">${UI.confirmSceneDel === sc.id ? `<span class="small">${T('Usunąć scenę {n}?', { n: esc(sc.num) })}</span><button class="btn sm danger" data-act="scene-del-yes" data-id="${sc.id}">${T('Tak, usuń')}</button><button class="btn sm" data-act="scene-del-no">${T('Anuluj')}</button>` : `<button class="btn sm ghost danger" data-act="scene-del" data-id="${sc.id}">${ICON.trash} ${T('Usuń scenę')}</button>`}</div>
    </div></aside>`;
}

/* ================= USTAWIENIA ================= */
function renderSettings() {
  if (!UI.settings) return '';
  const m = S.meta;
  const f = (label, key, type, extra) => `<label class="field"><span class="lbl">${label}</span><input class="inp" type="${type || 'text'}" value="${esc(m[key])}" data-bind="meta.${key}" ${extra || ''}></label>`;
  const ds = Core.DAYS_SHORT;
  const wd = [1, 2, 3, 4, 5, 6, 0].map((n) => [n, ds[n]]);
  const seg = (act, cur, items) => `<div class="seg" role="group">${items.map(([v, l]) => `<button data-act="${act}" data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
  return `<div class="scrim" data-act="settings-close"></div><div class="modal" role="dialog" aria-label="${T('Ustawienia')}">
    <div class="card-h"><h2>${T('Ustawienia')}</h2><button class="btn sm" style="margin-left:auto" data-act="settings-close">${ICON.x} ${T('Zamknij')}</button></div>
    <div class="card-b" style="display:flex;flex-direction:column;gap:18px">
      <div class="set-sec"><h3>${T('Aplikacja')}</h3><p class="small muted">${T('Te ustawienia dotyczą tego urządzenia i wszystkich projektów.')}</p>
        <div class="row" style="gap:18px;align-items:flex-start">
          <div class="field"><span class="lbl">${T('Język interfejsu')}</span>${seg('set-lang', PREFS.lang, [['pl', 'Polski'], ['en', 'English']])}</div>
          <div class="field"><span class="lbl">${T('Motyw')}</span>${seg('set-theme', PREFS.theme, [['auto', T('Systemowy')], ['light', T('Jasny')], ['dark', T('Ciemny')]])}</div>
        </div></div>
      ${renderSyncSettings()}
      <div class="set-sec"><h3>${T('Projekt')}</h3>
      <div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${f(T('Tytuł filmu'), 'title')}${f(T('Firma produkcyjna'), 'company')}${f(T('Reżyser'), 'director')}${f(T('Producent'), 'producer')}${f(T('Kierownik produkcji'), 'manager')}${f(T('Wersja scenariusza'), 'scriptVersion')}${f(T('Data wersji scenariusza'), 'scriptDate', 'date')}
        <label class="field"><span class="lbl">${T('Język dokumentów PDF i Excel')}</span><select class="inp" data-act-change="doc-lang">${opt('', T('Jak interfejs ({l})', { l: PREFS.lang.toUpperCase() }), m.docLang || '')}${opt('pl', 'Polski (PL)', m.docLang)}${opt('en', 'English (EN)', m.docLang)}</select></label></div></div>
      <div><span class="lbl">${T('Dni robocze ekipy')}</span><div class="wd">${wd.map(([n, l]) => `<label><input type="checkbox" data-act-change="wd-toggle" data-n="${n}" ${m.weekdays.includes(n) ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
      <div class="fgrid">
        <label class="field"><span class="lbl">${T('Pierwszy dzień zdjęć')}</span><input class="inp" type="date" value="${esc(m.startDate)}" data-bind="meta.startDate"></label>
        <label class="field"><span class="lbl">${T('Stron na dzień zdjęciowy')}</span><input class="inp" type="number" min="0.5" max="30" step="0.5" value="${esc(+m.pagesPerDay)}" data-bind="meta.pagesPerDay" data-num="1" data-render="1"></label>
        <label class="field"><span class="lbl">${T('Zbiórka (dzień)')}</span><input class="inp" type="time" value="${esc(m.call)}" data-bind="meta.call"></label>
        <label class="field"><span class="lbl">${T('Zbiórka (noc)')}</span><input class="inp" type="time" value="${esc(m.callNight)}" data-bind="meta.callNight"></label>
      </div>
      <div class="fgrid">
        <label class="field"><span class="lbl">${T('Maks. czas pracy (h dziennie)')}</span><input class="inp" type="number" min="1" max="24" step="0.5" value="${esc(+m.maxWorkH || 12)}" data-bind="meta.maxWorkH" data-num="1" data-render="1"></label>
        <label class="field"><span class="lbl">${T('Min. odpoczynek między dniami (h)')}</span><input class="inp" type="number" min="1" max="24" step="0.5" value="${esc(+m.minRestH || 11)}" data-bind="meta.minRestH" data-num="1" data-render="1"></label>
      </div>
      <p class="small muted" style="margin:0">${T('Limit stron służy do planu automatycznego i ostrzeżeń o przeładowanym dniu. Godziny dnia liczą się w Planie pracy z czasów realizacji. Limity czasu pracy i odpoczynku włączają ostrzeżenia BHP (domyślnie 12 h pracy i 11 h przerwy).')}</p>
      <div style="border-top:1px solid var(--line-2);padding-top:14px"><div class="row">${UI.confirmDel ? `<span class="small"><b>${T('Usunąć cały projekt „{t}”?', { t: esc(m.title || T('Bez tytułu')) })}</b> ${T('Tego nie da się cofnąć.')}</span><button class="btn danger" data-act="proj-del-yes">${T('Tak, usuń projekt')}</button><button class="btn" data-act="proj-del-no">${T('Anuluj')}</button>` : `<button class="btn danger" data-act="proj-del">${ICON.trash} ${T('Usuń projekt')}</button>`}</div></div>
    </div></div>`;
}

/* ================= SYNCHRONIZACJA (ustawienia) ================= */
function renderSyncSettings() {
  if (!Sync.available()) return '';
  const c = Sync.cfg, f = UI.syncForm || {}, st = Sync.status;
  const val = (k, d) => esc(f[k] != null ? f[k] : d || '');
  const head = `<h3>${T('Synchronizacja')}</h3><p class="small muted">${T('Projekty synchronizują się automatycznie między Twoimi urządzeniami (Mac, iPhone, iPad) przez Twoją bazę Supabase (darmowy plan wystarczy). Zmiany wysyłają się kilka sekund po zapisie, a nowe wersje z innych urządzeń pobierają się co minutę i po powrocie do aplikacji.')}</p>`;
  if (Sync.loggedIn()) {
    const hm = st.at ? new Date(st.at).toTimeString().slice(0, 5) : '—';
    return `<div class="set-sec">${head}
      <div class="sync-box ${st.state === 'error' ? 'bad' : 'ok'}"><div><b>${T('Zalogowano jako {e}', { e: esc((c.session.user && c.session.user.email) || c.email) })}</b><div class="small muted">${esc(c.url)}</div></div>
        <div class="small">${st.state === 'error' ? `<span class="bad-t">${T('Błąd')}: ${esc(st.error)}</span>` : st.state === 'busy' ? T('Synchronizuję…') : T('Ostatnia synchronizacja: {t}', { t: hm })}</div></div>
      <div class="row" style="margin-top:10px;align-items:flex-end"><label class="field" style="max-width:240px"><span class="lbl">${T('Nazwa tego urządzenia')}</span><input class="inp" id="sync-device" value="${esc(c.device)}" placeholder="Mac, iPhone…"></label>
        <button class="btn primary" data-act="sync-now">${T('Synchronizuj teraz')}</button><button class="btn" data-act="sync-logout">${T('Wyloguj')}</button></div></div>`;
  }
  return `<div class="set-sec">${head}
    <div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">
      <label class="field"><span class="lbl">${T('Adres projektu Supabase (Project URL)')}</span><input class="inp" id="sync-url" value="${val('url', c.url)}" placeholder="https://xxxx.supabase.co" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span class="lbl">${T('Klucz publiczny (anon / publishable key)')}</span><input class="inp" id="sync-key" value="${val('key', c.key)}" placeholder="eyJ…" autocomplete="off" autocapitalize="off" spellcheck="false"></label>
      <label class="field"><span class="lbl">E-mail</span><input class="inp" id="sync-email" type="email" value="${val('email', c.email)}" autocomplete="username" autocapitalize="off"></label>
      <label class="field"><span class="lbl">${T('Hasło')}</span><input class="inp" id="sync-pass" type="password" value="${val('pass', '')}" autocomplete="current-password"></label></div>
    ${UI.syncErr ? `<div class="notice bad" style="margin:10px 0 0"><div>${esc(UI.syncErr)}</div></div>` : ''}
    <div class="row" style="margin-top:10px"><button class="btn primary" data-act="sync-login" ${UI.syncBusy ? 'disabled' : ''}>${UI.syncBusy ? T('Łączę…') : T('Zaloguj i synchronizuj')}</button><button class="btn" data-act="sync-signup" ${UI.syncBusy ? 'disabled' : ''}>${T('Załóż konto')}</button></div>
    <details class="sync-help"><summary>${T('Jak przygotować bazę (ok. 5 minut, jednorazowo)')}</summary>
      <ol class="small"><li>${T('Załóż darmowe konto na supabase.com i utwórz nowy projekt (dowolna nazwa, region np. Frankfurt).')}</li>
      <li>${T('W projekcie otwórz SQL Editor, wklej poniższy skrypt i kliknij Run. Tworzy dwie tabele dostępne tylko dla zalogowanego właściciela.')}</li>
      <li>${T('W Authentication → Sign In / Providers → Email wyłącz „Confirm email” (albo potwierdź adres z maila po założeniu konta).')}</li>
      <li>${T('W Project Settings → API (Data API) skopiuj Project URL oraz klucz anon (publishable) i wklej je powyżej.')}</li>
      <li>${T('Kliknij „Załóż konto”. Na kolejnych urządzeniach wpisz te same dane i kliknij „Zaloguj i synchronizuj”.')}</li></ol>
      <div class="row" style="margin:6px 0"><button class="btn sm" data-act="sync-copy-sql">${ICON.file} ${T('Kopiuj skrypt SQL')}</button></div>
      <pre class="sql">${esc(Sync.SQL)}</pre></details></div>`;
}
