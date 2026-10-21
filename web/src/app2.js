/* ===== APLIKACJA: widoki ===== */
const opt = (v, label, cur) => `<option value="${esc(v)}"${String(v) === String(cur) ? ' selected' : ''}>${esc(label)}</option>`;
const kcls = (sc) => 'k-' + Core.stripKey(sc);
const TODS = [['DAY', 'Dzień'], ['NIGHT', 'Noc'], ['DAWN', 'Świt'], ['DUSK', 'Zmierzch']];
const IES = [['INT', 'Wnętrze (WN.)'], ['EXT', 'Plener (ZN.)'], ['INT/EXT', 'WN./ZN.']];
const castChips = (ids) => { const m = Core.castMap(S); return ids.slice().sort((a, b) => a - b).map((id) => m.get(id)).filter(Boolean).map((c) => `<span class="chip" title="${esc(c.name)}${c.actor ? ' – ' + esc(c.actor) : ''}"><b>${c.id}</b> ${esc(c.name)}</span>`).join(''); };

const FIELDS = 'input:not([type=file]):not([type=hidden]), select, textarea';
/** Klucz aktywnego pola: id albo pozycja wśród pól formularza (DOM jest budowany deterministycznie) */
function focusKey() {
  const a = document.activeElement;
  if (!a || a === document.body || !a.matches || !a.matches(FIELDS)) return null;
  if (a.id) return { id: a.id };
  const all = [...appEl().querySelectorAll(FIELDS)];
  const i = all.indexOf(a);
  return i >= 0 ? { i, tag: a.tagName } : null;
}
function restoreFocus(k) {
  if (!k) return;
  let el = null;
  if (k.id) el = document.getElementById(k.id);
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
  if (UI.refocus) { const el = $q(UI.refocus); if (el) el.focus(); UI.refocus = null; }
  else restoreFocus(fk);
}

function renderTop() {
  const list = PROJECTS.some((p) => p.id === PID) ? PROJECTS : [{ id: PID, title: S.meta.title, demo: S.demo }].concat(PROJECTS);
  const opts = list.map((p) => opt(p.id, (p.id === PID ? S.meta.title : p.title) || 'Bez tytułu', PID)).join('');
  return `<header class="topbar"><div class="topbar-in gut">
    <div class="brand">${ICON.clap}Klaps</div>
    <div class="proj"><select id="proj-sel" data-act-change="proj-switch" aria-label="Projekt">${opts}<option value="__new">+ Nowy projekt</option></select>${S.demo ? '<span class="tag" title="Projekt demonstracyjny z przykładowym scenariuszem">Przykład</span>' : ''}</div>
    <span id="save-badge" class="save"><i></i>Zapisano</span>
    <div class="actions">
      <button class="btn" data-act="settings-open" title="Dane produkcji, godziny pracy, dni tygodnia">${ICON.cog}<span class="lbl-d">Ustawienia</span></button>
      <button class="btn primary" data-act="tab" data-tab="export">${ICON.dl}<span class="lbl-d">Eksport</span> PDF / Excel</button>
    </div>
  </div></header>`;
}

const TABS = [['import', 'Scenariusz'], ['board', 'Rozpiska scen'], ['schedule', 'Kalendarzówka'], ['callsheet', 'Plan pracy'], ['shotlist', 'Shotlista'], ['transport', 'Transport'], ['budget', 'Kosztorys'], ['cast', 'Obsada'], ['crew', 'Ekipa'], ['sites', 'Lokacje'], ['dood', 'DOOD'], ['export', 'Eksport']];
function renderTabs() {
  const cnt = { board: S.scenes.length, schedule: S.days.filter((d) => d.kind === 'shoot').length, cast: S.cast.length, sites: sitesList().length, transport: S.transport.trips.length, budget: S.budget.items.length, crew: S.crew.length, shotlist: S.shots.length };
  return `<nav class="tabs" aria-label="Widoki"><div class="tabs-in gut" role="tablist" data-scroll-id="tabs">${TABS.map(([k, l]) => `<button class="tab" role="tab" aria-selected="${UI.tab === k}" data-act="tab" data-tab="${k}">${l}${cnt[k] != null ? `<span class="cnt">${cnt[k]}</span>` : ''}</button>`).join('')}</div></nav>`;
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
const needScenes = () => `<div class="card"><div class="empty"><h3>Nie ma jeszcze scen</h3><p>Wczytaj scenariusz albo dodaj sceny ręcznie. Scenariusz nie jest wymagany, a wszystkie zakładki działają także w pustym projekcie.</p><div class="row" style="justify-content:center"><button class="btn primary big" data-act="tab" data-tab="import">Wczytaj scenariusz</button><button class="btn big" data-act="scene-add">${ICON.plus} Dodaj scenę ręcznie</button></div></div></div>`;

/* ================= IMPORT ================= */
function renderImport() {
  const imp = UI.imp;
  let h = pageH('Scenariusz', 'Wczytaj scenariusz, a Klaps rozpozna sceny, obsadę i długość w ósemkach stron. Scenariusz nie jest wymagany: możesz też zacząć od pustego projektu i dodawać sceny ręcznie.');
  if (imp.status === 'reading') return h + `<div class="card"><div class="card-b"><b>${esc(imp.file)}</b><div class="muted" id="imp-progress">${esc(imp.progress || '')}</div></div></div>`;
  if (imp.status === 'error') h += `<div class="notice bad"><div><b>Nie udało się odczytać pliku${imp.file ? ' „' + esc(imp.file) + '”' : ''}.</b><br>${esc(imp.error)}</div></div>`;
  if (imp.parsed) return h + renderImportReview();
  if (S.scenes.length) {
    const eighths = S.scenes.reduce((a, s) => a + s.eighths, 0);
    h += `<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>Aktualny scenariusz</h2><span class="muted small">${esc(S.meta.scriptFile || '')}</span><div class="right" style="margin-left:auto"><button class="btn" data-act="tab" data-tab="board">Przejdź do rozpiski</button></div></div>
      <div class="card-b"><div class="stats"><div class="stat"><b>${S.scenes.length}</b><span>scen</span></div><div class="stat"><b>${Core.fmtEighths(eighths)}</b><span>stron</span></div><div class="stat"><b>${S.cast.length}</b><span>postaci</span></div><div class="stat"><b>${sitesList().length}</b><span>obiektów</span></div></div>
      <p class="muted small" style="margin:12px 0 0">Nowa wersja scenariusza? Wczytaj ją poniżej. Klaps zachowa opisy, elementy i plan dla scen o tych samych numerach.</p></div></div>`;
  }
  h += `<div class="imp-grid"><div>
    <div class="drop" id="drop-zone" data-drop-file>
      <h2>${S.scenes.length ? 'Wczytaj nową wersję' : 'Przeciągnij scenariusz tutaj'}</h2>
      <p>Klaps czyta teksty scenariuszy z nagłówkami scen w stylu <b>WN. KUCHNIA – DZIEŃ</b> albo <b>INT. KITCHEN – DAY</b>.</p>
      <div class="fmt"><span>PDF</span><span>FDX</span><span>FOUNTAIN</span><span>DOCX</span><span>TXT</span></div><br>
      <button class="btn primary big" data-act="pick-file">${ICON.file} Wybierz plik</button>
      <input type="file" id="file-in" accept=".pdf,.fdx,.fountain,.txt,.text,.md,.docx,.doc,.rtf" hidden>
    </div>
    <div class="card" style="margin-top:16px"><div class="card-h"><h3>Wklej tekst</h3><span class="muted small">gdy scenariusz masz w innym programie</span><button class="btn sm" style="margin-left:auto" data-act="paste-toggle">${UI.paste ? 'Zwiń' : 'Rozwiń'}</button></div>
      ${UI.paste ? `<div class="card-b"><textarea id="paste-text" class="inp paste" placeholder="Wklej tutaj scenariusz…" spellcheck="false">${esc(UI.pasteText)}</textarea><div class="row" style="margin-top:10px"><button class="btn primary" data-act="paste-go">Analizuj tekst</button></div></div>` : ''}
    </div></div>
    <div class="card"><div class="card-h"><h3>Co Klaps rozpoznaje</h3></div><div class="card-b small">
      <p style="margin-top:0"><b>Nagłówki scen:</b> <code>1. WN. DOM ANNY – KUCHNIA – DZIEŃ</code>, <code>SCENA 12. PLENER. ULICA. NOC</code>, <code>INT./EXT. CAR – DUSK</code>.</p>
      <p><b>Obsada:</b> z wielkich liter nad dialogami (<code>ANNA</code>, <code>MARTA (V.O.)</code>) oraz z imion w opisach akcji.</p>
      <p><b>Długość sceny:</b> liczona w ósemkach strony, jak w Movie Magic. Z PDF-a dokładnie, z innych plików szacunkowo. Każdą wartość poprawisz ręcznie.</p>
      <p style="margin-bottom:0"><b>Brak pliku pod ręką?</b></p><div class="row" style="margin-top:8px"><button class="btn" data-act="load-sample">Wczytaj przykładowy scenariusz</button>${S.scenes.length ? '' : `<button class="btn primary" data-act="start-empty">Zacznij bez scenariusza</button>`}</div>
    </div></div></div>`;
  return h;
}

function renderImportReview() {
  const imp = UI.imp, p = imp.parsed;
  const st = p.stats;
  const warn = (p.warnings || []).map((w) => `<div class="notice warn"><div>${esc(w)}</div></div>`).join('');
  const rows = p.scenes.map((s) => `<tr class="${kcls(s)}" style="background:var(--sb);color:var(--s-ink)"><td><b>${esc(s.num)}</b></td><td>${esc(Core.IE_LABEL[s.ie] || '—')}</td><td>${esc(s.place || '—')}</td><td>${esc((Core.TOD[s.tod] || {}).short || '')}</td><td class="num">${Core.fmtEighths(s.eighths)}</td><td>${esc(s.castNames.join(', '))}</td></tr>`).join('');
  const hasScenes = S.scenes.length > 0;
  const isPdf = imp.raw && imp.raw.kind === 'pdf';
  return `<div class="imp-grid">
    <div class="card"><div class="card-h"><h2>Wynik analizy</h2><span class="muted small">${esc(imp.file)} · ${esc(st.source)}</span></div><div class="card-b">
      ${warn}
      <div class="stats" style="margin-bottom:14px"><div class="stat"><b>${st.scenes}</b><span>scen</span></div><div class="stat"><b>${Core.fmtEighths(st.eighths)}</b><span>stron</span></div><div class="stat"><b>${st.cast}</b><span>postaci</span></div><div class="stat"><b>${new Set(p.scenes.map((s) => s.site)).size}</b><span>obiektów</span></div></div>
      ${p.scenes.length ? `<div class="preview"><table><thead><tr><th>Sc.</th><th>W/Z</th><th>Plan</th><th>D/N</th><th>Str.</th><th>Obsada</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
    </div></div>
    <div class="card"><div class="card-h"><h3>Ustawienia importu</h3></div><div class="card-b" style="display:flex;flex-direction:column;gap:14px">
      <label class="field"><span class="lbl">Postacie wzmiankowane w opisach akcji</span>
        <select class="inp" data-act-change="imp-castmode">${opt('all', 'Tak, także odmienione imiona (zalecane)', S.meta.castMode || 'all')}${opt('caps', 'Tak, tylko zapisane WIELKIMI LITERAMI', S.meta.castMode)}${opt('off', 'Nie, tylko postacie mówiące', S.meta.castMode)}</select>
        <span class="muted small">Dzięki temu postać, która w scenie milczy, też trafia do planu.</span></label>
      ${isPdf ? `<div class="small muted">Strony PDF policzone z układu tekstu: ${st.linesPerPage} ${pl(st.linesPerPage, 'wiersz', 'wiersze', 'wierszy')} na stronę${st.pageOffset ? ', pominięto stronę tytułową' : ''}.</div>`
        : `<label class="field"><span class="lbl">Wiersze na stronę scenariusza</span><input class="inp" type="number" min="30" max="80" value="${esc(S.meta.linesPerPage || 55)}" data-act-change="imp-lpp"><span class="muted small">Ten plik nie ma układu stron, więc długość scen jest szacowana. Standard to 55 wierszy.</span></label>`}
      ${hasScenes ? `<div class="field"><span class="lbl">W projekcie są już sceny</span>
        <label class="opt" style="border:0;padding:4px 0"><input type="radio" name="keep" value="1" data-act-change="imp-keep" ${imp.keep ? 'checked' : ''}><div><b>Zachowaj dane scen o tych samych numerach</b><span>opisy, elementy, uwagi i plan dni (nowa wersja scenariusza)</span></div></label>
        <label class="opt" style="border:0;padding:4px 0"><input type="radio" name="keep" value="0" data-act-change="imp-keep" ${!imp.keep ? 'checked' : ''}><div><b>Zacznij od nowa</b><span>usuwa dotychczasowe opisy i plan dni zdjęciowych</span></div></label></div>` : ''}
      <div class="row"><button class="btn primary big" data-act="imp-apply" ${p.scenes.length ? '' : 'disabled'}>${hasScenes ? 'Zastosuj nową wersję' : 'Utwórz rozpiskę scen'}</button><button class="btn" data-act="imp-cancel">Anuluj</button></div>
    </div></div></div>`;
}

/* ================= ROZPISKA SCEN ================= */
function renderBoard() {
  if (!S.scenes.length) return pageH('Rozpiska scen', 'Każda scena to jeden pasek. Dodaj sceny ręcznie albo wczytaj scenariusz.', `<button class="btn" data-act="scene-add">${ICON.plus} Dodaj scenę</button>`) + needScenes();
  const idx = Core.scheduleIndex(S), cm = Core.castMap(S);
  const list = filteredScenes();
  const eighths = list.reduce((a, s) => a + s.eighths, 0);
  const f = UI.f;
  const rows = list.map((s) => {
    const sch = idx.get(s.id);
    const checked = UI.sel.has(s.id);
    return `<div class="strip bd ${kcls(s)}${checked ? ' sel' : ''}" data-act="scene-open" data-id="${s.id}">
      <div class="c"><input type="checkbox" data-act="sel-toggle" data-id="${s.id}" ${checked ? 'checked' : ''} aria-label="Zaznacz scenę ${esc(s.num)}"></div>
      <div class="c scn">${esc(s.num)}</div><div class="c">${esc(Core.IE_LABEL[s.ie] || '—')}</div><div class="c">${esc((Core.TOD[s.tod] || {}).short || '')}</div>
      <div class="plc">${esc(s.place || s.site || '—')}${s.site && s.place && s.site !== s.place ? `<small>${esc(s.site)}</small>` : ''}</div>
      <div class="syn">${esc(s.synopsis)}</div>
      <div class="cst" title="${esc(s.cast.map((id) => (cm.get(id) || {}).name).filter(Boolean).join(', '))}">${esc(s.cast.slice().sort((a, b) => a - b).join(', '))}</div>
      <div class="c num">${Core.fmtEighths(s.eighths)}</div>
      <div class="c">${sch ? (sch.dayNo ? `<span class="dayb">D${sch.dayNo}</span>` : '<span class="dayb">wolny</span>') : '<span class="dayb none">—</span>'}</div></div>`;
  }).join('');
  const castOpts = S.cast.map((c) => opt(c.id, `${c.id} ${c.name}`, f.cast)).join('');
  const siteOpts = sitesList().map((x) => opt(x, x, f.site)).join('');
  const selBar = UI.sel.size ? `<div class="sel-bar"><b>Zaznaczono ${UI.sel.size}</b>
      <select class="inp mini" data-act-change="bulk-to-day" aria-label="Dodaj zaznaczone do dnia"><option value="">Dodaj do dnia…</option>${S.days.filter((d) => d.kind === 'shoot').map((d) => opt(d.id, dayLabel(d, Core.dayNumbers(S)), '')).join('')}<option value="__new">+ Nowy dzień zdjęciowy</option></select>
      <button class="btn sm" data-act="bulk-unplan">Usuń z planu</button><button class="btn sm danger" data-act="bulk-delete">${ICON.trash} Usuń sceny</button><button class="btn sm ghost" data-act="sel-clear" style="margin-left:auto">Wyczyść zaznaczenie</button></div>` : '';
  return pageH('Rozpiska scen', 'Każda scena to jeden pasek. Kolor pokazuje wnętrze/plener i porę dnia. Kliknij pasek, aby uzupełnić opis, obsadę i elementy.',
    `<button class="btn" data-act="scene-add">${ICON.plus} Dodaj scenę</button>`) +
    `<div class="toolbar">
      <input class="inp search" id="f-q" type="search" placeholder="Szukaj: numer, plan, opis, postać…" value="${esc(f.q)}" aria-label="Szukaj scen">
      <select class="inp" data-act-change="f-ie" aria-label="Wnętrze / plener">${opt('', 'WN. i ZN.', f.ie)}${opt('INT', 'Wnętrza', f.ie)}${opt('EXT', 'Plenery', f.ie)}</select>
      <select class="inp" data-act-change="f-tod" aria-label="Pora dnia">${opt('', 'Cała doba', f.tod)}${TODS.map(([k, l]) => opt(k, l, f.tod)).join('')}</select>
      <select class="inp" data-act-change="f-cast" aria-label="Postać">${opt('', 'Każda postać', f.cast)}${castOpts}</select>
      <select class="inp" data-act-change="f-site" aria-label="Obiekt">${opt('', 'Każdy obiekt', f.site)}${siteOpts}</select>
      <select class="inp" data-act-change="f-plan" aria-label="Stan planu">${opt('', 'Wszystkie', f.plan)}${opt('unplanned', 'Niezaplanowane', f.plan)}${opt('planned', 'Zaplanowane', f.plan)}</select>
      <button class="btn sm ghost" data-act="f-clear">Wyczyść filtry</button>
      <span class="muted small" style="margin-left:auto"><b class="num">${list.length}</b> z ${S.scenes.length} scen · <b class="num">${Core.fmtEighths(eighths)}</b> str.</span>
    </div>${selBar}
    <div class="board" data-scroll-id="board"><div class="board-in">
      <div class="bh"><div class="c"><input type="checkbox" data-act="sel-all" aria-label="Zaznacz wszystkie widoczne" ${list.length && list.every((s) => UI.sel.has(s.id)) ? 'checked' : ''}></div><div class="c">Sc.</div><div class="c">W/Z</div><div class="c">D/N</div><div>Plan / lokacja</div><div>Opis</div><div>Obsada</div><div class="c">Str.</div><div class="c">Dzień</div></div>
      ${rows || '<div class="empty"><p>Żadna scena nie pasuje do filtrów.</p></div>'}
    </div></div>
    <div class="legend">${Object.keys(Core.STRIP).map((k) => `<span class="k-${k}"><i></i>${Core.STRIP[k].name}</span>`).join('')}</div>`;
}

/* ================= KALENDARZÓWKA ================= */
function miniStrip(s, mode, nums, dayId) {
  const idx = null;
  const moveSel = mode === 'pool'
    ? `<select data-act-change="pool-to-day" data-sid="${s.id}" aria-label="Dodaj scenę ${esc(s.num)} do dnia"><option value="">Dodaj…</option>${S.days.filter((d) => d.kind === 'shoot').map((d) => opt(d.id, dayLabel(d, nums), '')).join('')}<option value="__new">+ nowy dzień</option></select>`
    : `<select data-act-change="day-move" data-sid="${s.id}" aria-label="Przenieś scenę ${esc(s.num)}"><option value="">Przenieś…</option><option value="__pool">Do zaplanowania</option>${S.days.filter((d) => d.kind === 'shoot' && d.id !== dayId).map((d) => opt(d.id, dayLabel(d, nums), '')).join('')}</select>`;
  if (mode === 'pool') {
    return `<div class="mini-strip ${kcls(s)}" draggable="true" data-drag="1" data-sid="${s.id}" data-act="scene-open" data-id="${s.id}" title="Przeciągnij na dzień zdjęciowy">
      <span class="g" aria-hidden="true">⋮⋮</span><span class="n">${esc(s.num)}</span>
      <div class="t"><b>${esc(s.place || s.site)}</b><span>${esc(Core.IE_LABEL[s.ie] || '')} ${esc((Core.TOD[s.tod] || {}).label || '')}${s.cast.length ? ' · ' + esc(s.cast.slice().sort((a, b) => a - b).join(', ')) : ''}</span></div>
      <span class="p">${Core.fmtEighths(s.eighths)}</span>${moveSel}</div>`;
  }
  return `<div class="mini-strip ${kcls(s)}" draggable="true" data-drag="1" data-sid="${s.id}" data-act="scene-open" data-id="${s.id}" title="Przeciągnij, aby zmienić kolejność lub przenieść do innego dnia">
    <span class="g" aria-hidden="true">⋮⋮</span><span class="n">${esc(s.num)}</span><span class="ie">${esc(Core.IE_LABEL[s.ie] || '')} ${esc((Core.TOD[s.tod] || {}).short || '')}</span>
    <div class="t"><b>${esc(s.place || s.site)}</b></div><div class="t syn"><span>${esc(s.synopsis)}</span></div>
    <span class="cs" title="Obsada">${esc(s.cast.slice().sort((a, b) => a - b).join(', '))}</span><span class="p">${Core.fmtEighths(s.eighths)}</span>${moveSel}</div>`;
}

function renderSchedule() {
  const idx = Core.scheduleIndex(S), nums = Core.dayNumbers(S);
  const unsched = S.scenes.filter((s) => !idx.has(s.id));
  const shoot = S.days.filter((d) => d.kind === 'shoot');
  const dates = shoot.map((d) => d.date).filter(Boolean).sort();
  const planned = S.scenes.length - unsched.length;
  const right = `<div class="seg" role="group" aria-label="Widok"><button data-act="cal-view" data-v="days" aria-pressed="${UI.calView === 'days'}">Dni</button><button data-act="cal-view" data-v="month" aria-pressed="${UI.calView === 'month'}">Miesiąc</button></div>
    <button class="btn" data-act="autoplan-toggle" ${S.scenes.length ? '' : 'disabled'}>Plan automatyczny</button>
    <button class="btn" data-act="day-add">${ICON.plus} Dzień zdjęciowy</button>
    <button class="btn" data-act="day-off">${ICON.plus} Dzień wolny</button>
    <button class="btn" data-act="export-quick-pdf" ${shoot.length ? '' : 'disabled'}>${ICON.dl} PDF</button>
    <button class="btn" data-act="export-quick-xlsx" ${shoot.length ? '' : 'disabled'}>${ICON.dl} Excel</button>`;
  let h = pageH('Kalendarzówka', 'Przeciągnij sceny z listy po lewej na dni zdjęciowe albo uruchom plan automatyczny. Gotową kalendarzówkę wyeksportujesz do PDF lub Excela.', right);
  h += `<div class="sum-bar"><span><b class="num">${shoot.length}</b>${pl(shoot.length, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych')}</span><span><b class="num">${planned}</b>z ${S.scenes.length} scen w planie</span>${unsched.length ? `<span style="color:var(--warn)"><b class="num">${unsched.length}</b>do zaplanowania</span>` : ''}${dates.length ? `<span class="muted">${Core.fmtShort(dates[0])} – ${Core.fmtShort(dates[dates.length - 1])}</span>` : ''}<span class="muted small" style="margin-left:auto">Plan automatyczny: do ${esc(+S.meta.pagesPerDay)} str. na dzień <button class="btn sm ghost" data-act="settings-open">zmień</button></span></div>`;
  if (UI.autoplan) {
    const ap = UI.ap;
    h += `<div class="autoplan"><div class="row"><label class="field"><span class="lbl">Kolejność</span><select class="inp" data-act-change="ap-strategy">${opt('site', 'Wg obiektów (mniej przejazdów)', ap.strategy)}${opt('script', 'Wg kolejności w scenariuszu', ap.strategy)}</select></label>
      <label class="field"><span class="lbl">Zakres</span><select class="inp" data-act-change="ap-scope">${opt('unscheduled', `Tylko niezaplanowane (${unsched.length})`, ap.scope)}${opt('all', 'Od nowa (zastąpi cały plan)', ap.scope)}</select></label>
      <label class="chk"><input type="checkbox" data-act-change="ap-night" ${ap.separateNight ? 'checked' : ''}> Osobne dni dla scen nocnych, świtu i zmierzchu</label>
      <button class="btn primary" data-act="autoplan-run">Ułóż plan</button><button class="btn" data-act="autoplan-toggle">Anuluj</button></div>
      <p class="small muted" style="margin:10px 0 0">${ap.scope === 'all' ? '<b>Uwaga:</b> plan od nowa usuwa też plany pracy i kursy przypisane do obecnych dni. ' : ''}Do jednego dnia trafia najwyżej ${esc(+S.meta.pagesPerDay)} str. scenariusza (limit zmienisz w ustawieniach). Później przeciągnij sceny, jak chcesz.</p></div>`;
  }
  if (UI.calView === 'month') return h + renderMonth(nums);
  // pula scen
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
  h += `<div class="sched"><aside class="card pool"><div class="card-h"><h3>Do zaplanowania</h3><span class="chip acc">${unsched.length} · ${Core.fmtEighths(poolEighths)} str.</span></div>
    <div class="row" style="padding:8px 8px 0"><input class="inp grow" id="pool-q" type="search" placeholder="Szukaj sceny…" value="${esc(UI.pool.q)}" aria-label="Szukaj w scenach do zaplanowania"><select class="inp mini" data-act-change="pool-sort" aria-label="Sortowanie">${opt('script', 'Wg scenariusza', UI.pool.sort)}${opt('site', 'Wg obiektów', UI.pool.sort)}${opt('tod', 'Dzień / noc', UI.pool.sort)}</select></div>
    <div class="pool-s" data-drop="pool" data-scroll-id="pool">${poolRows || `<div class="day-empty">${unsched.length ? 'Brak wyników.' : 'Wszystkie sceny są w planie.'}</div>`}</div></aside>
    <div class="days">${S.days.length ? S.days.map((d, i) => renderDay(d, i, nums)).join('') : `<div class="card"><div class="empty"><h3>Nie ma jeszcze dni zdjęciowych</h3><p>Dodaj pierwszy dzień i przeciągnij do niego sceny albo pozwól Klapsowi ułożyć plan.</p><div class="row" style="justify-content:center">${S.scenes.length ? '<button class="btn primary big" data-act="autoplan-run-first">Ułóż plan automatycznie</button>' : ''}<button class="btn big" data-act="day-add">${ICON.plus} Dodaj dzień</button></div></div></div>`}</div></div>`;
  return h;
}

function renderDay(d, i, nums) {
  const dayDate = d.date ? Core.fmtDatePL(d.date).split(',')[0] : '';
  if (d.kind === 'off') {
    return `<section class="day off" data-day="${d.id}"><header class="day-h"><div class="day-no">Dzień wolny</div>
      <input class="inp" type="date" value="${esc(d.date)}" data-bind="day.date" data-id="${d.id}" aria-label="Data"><span class="dow">${esc(dayDate)}</span>
      <input class="inp" style="flex:1 1 200px" placeholder="Notatka (np. przejazd, odpoczynek ekipy)" value="${esc(d.note)}" data-bind="day.note" data-id="${d.id}" aria-label="Notatka">
      <div class="day-menu"><button class="btn" data-act="day-up" data-id="${d.id}" title="Wyżej" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button class="btn" data-act="day-down" data-id="${d.id}" title="Niżej" ${i === S.days.length - 1 ? 'disabled' : ''}>${ICON.down}</button><button class="btn" data-act="day-del" data-id="${d.id}" title="Usuń dzień">${ICON.trash}</button></div></header></section>`;
  }
  const st = Core.dayStats(S, d);
  const warns = Core.dayWarnings(S, d);
  const cap = Core.maxEighths(S.meta);
  const pct = Math.min(100, Math.round((st.eighths / cap) * 100));
  const over = st.eighths > cap;
  const cm = Core.castMap(S);
  return `<section class="day" data-day="${d.id}" id="day-${d.id}"><header class="day-h">
    <div class="day-no">Dzień<b>${nums.get(d.id)}</b></div>
    <input class="inp" type="date" value="${esc(d.date)}" data-bind="day.date" data-id="${d.id}" aria-label="Data dnia zdjęciowego"><span class="dow">${esc(dayDate)}</span>
    <label class="lab">Zbiórka <input class="inp" type="time" value="${esc(d.call)}" data-bind="day.call" data-id="${d.id}"></label>
    <div class="day-sum"><b>${st.scenes.length}</b> ${pl(st.scenes.length, 'scena', 'sceny', 'scen')} · <b>${Core.fmtEighths(st.eighths)}</b> str.<div class="load${over ? ' over' : ''}" title="Obłożenie dnia: ${pct}% limitu ${esc(+S.meta.pagesPerDay)} str."><i style="width:${pct}%"></i></div></div>
    <div class="day-menu"><button class="btn" data-act="day-up" data-id="${d.id}" title="Przesuń dzień wyżej" ${i === 0 ? 'disabled' : ''}>${ICON.up}</button><button class="btn" data-act="day-down" data-id="${d.id}" title="Przesuń dzień niżej" ${i === S.days.length - 1 ? 'disabled' : ''}>${ICON.down}</button><button class="btn" data-act="day-del" data-id="${d.id}" title="Usuń dzień (sceny wrócą do puli)">${ICON.trash}</button></div></header>
    ${warns.length ? `<div class="day-warn">${warns.map((w) => `<span>⚠ ${esc(w)}</span>`).join('')}</div>` : ''}
    <div class="day-body" data-drop="day:${d.id}">${st.scenes.length ? st.scenes.map((s) => miniStrip(s, 'day', nums, d.id)).join('') : '<div class="day-empty">Przeciągnij tu sceny z listy „Do zaplanowania”.</div>'}</div>
    <div class="day-f"><div><div class="lbl">Obsada dnia</div><div class="chips">${castChips(st.castIds) || '<span class="muted">—</span>'}</div><div class="lbl" style="margin-top:8px">Obiekty</div><div class="chips">${st.sites.map((x) => `<span class="chip">${esc(x)}</span>`).join('') || '<span class="muted">—</span>'}</div></div>
    <label class="field"><span class="lbl">Uwagi do dnia (trafiają do wydruku)</span><textarea class="inp" rows="3" data-bind="day.note" data-id="${d.id}" placeholder="np. zezwolenie na plan, rekwizyty z magazynu, dojazd…">${esc(d.note)}</textarea></label></div></section>`;
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
  let grid = ['pon', 'wt', 'śr', 'czw', 'pt', 'sob', 'ndz'].map((x) => `<div class="dn">${x}</div>`).join('');
  for (let c = 0; c < cells; c++) {
    const dnum = c - offset + 1;
    const dt = new Date(Date.UTC(Y, M - 1, dnum));
    const iso = Core.isoOf(dt);
    const out = dnum < 1 || dnum > dim;
    const dw = dt.getUTCDay();
    const chips = (byDate.get(iso) || []).map((d) => {
      if (d.kind === 'off') return `<button class="mchip off" data-act="goto-day" data-id="${d.id}"><b>wolny</b><div class="meta">${esc(d.note)}</div></button>`;
      const st = Core.dayStats(S, d);
      return `<button class="mchip" data-act="goto-day" data-id="${d.id}"><b>D${nums.get(d.id)}</b> <span class="meta">${st.scenes.length} sc. · ${Core.fmtEighths(st.eighths)} str.</span><div class="meta small muted">${esc(d.call || '')}${st.sites[0] ? ' · ' + esc(st.sites[0].toLowerCase()) : ''}</div><div class="dots">${st.scenes.map((s) => `<i class="${kcls(s)}"></i>`).join('')}</div></button>`;
    }).join('');
    grid += `<div class="mcell${out ? ' out' : ''}${dw === 0 || dw === 6 ? ' we' : ''}${iso === today ? ' today' : ''}"><span class="d">${dt.getUTCDate()}</span>${chips}</div>`;
  }
  return `<div class="month"><div class="month-h"><button class="btn sm" data-act="month-prev" aria-label="Poprzedni miesiąc">${ICON.left}</button><h3>${Core.MONTHS_NOM[M - 1]} ${Y}</h3><button class="btn sm" data-act="month-next" aria-label="Następny miesiąc">${ICON.right}</button><button class="btn sm ghost" data-act="month-today">Początek zdjęć</button></div><div class="mgrid">${grid}</div></div>`;
}

/* ================= OBSADA ================= */
function renderCast() {
  const idx = Core.scheduleIndex(S);
  const rows = S.cast.map((c) => {
    const scs = S.scenes.filter((s) => s.cast.includes(c.id));
    const days = new Set(scs.map((s) => (idx.get(s.id) || {}).dayNo).filter(Boolean));
    const eighths = scs.reduce((a, s) => a + s.eighths, 0);
    const others = S.cast.filter((o) => o.id !== c.id).map((o) => opt(o.id, `${o.id} ${o.name}`, '')).join('');
    return `<tr><td class="num"><b>${c.id}</b></td><td><input class="inp" value="${esc(c.name)}" data-bind="cast.name" data-id="${c.id}" aria-label="Postać ${c.id}"></td>
      <td><input class="inp" value="${esc(c.actor)}" placeholder="aktor / aktorka" data-bind="cast.actor" data-id="${c.id}" aria-label="Aktor postaci ${esc(c.name)}"></td>
      <td class="num">${scs.length}</td><td class="num">${Core.fmtEighths(eighths)}</td><td class="num">${days.size || '—'}</td>
      <td style="max-width:260px">${scs.map((s) => `<button class="numlink" data-act="scene-open" data-id="${s.id}">${esc(s.num)}</button>`).join('')}</td>
      <td><input class="inp" value="${esc(c.notes || '')}" placeholder="uwagi" data-bind="cast.notes" data-id="${c.id}" aria-label="Uwagi do ${esc(c.name)}"></td>
      <td style="white-space:nowrap"><select class="inp mini" data-act-change="cast-merge" data-id="${c.id}" aria-label="Połącz ${esc(c.name)} z inną postacią"><option value="">Połącz z…</option>${others}</select> <button class="btn sm ghost danger" data-act="cast-del" data-id="${c.id}" title="Usuń postać ze wszystkich scen">${ICON.trash}</button></td></tr>`;
  }).join('');
  return pageH('Obsada', 'Postacie wykryte w scenariuszu. Wpisz aktorów, połącz zdublowane postacie (np. ANNA i MŁODA ANNA) albo usuń pomyłkowe. Numery trafiają do pasków i do zestawienia DOOD.') +
    `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nr</th><th>Postać</th><th>Aktor / aktorka</th><th>Sceny</th><th>Str.</th><th>Dni</th><th>Numery scen</th><th>Uwagi</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="9" class="muted" style="padding:20px">Brak postaci.</td></tr>'}</tbody></table></div>
    <div class="row" style="margin-top:12px"><input class="inp" style="max-width:280px" id="new-cast" placeholder="Nowa postać…" aria-label="Nazwa nowej postaci"><button class="btn" data-act="cast-add">${ICON.plus} Dodaj postać</button></div>`;
}

/* ================= LOKACJE ================= */
function renderSites() {
  const rd = Core.reportData(S);
  const sm = new Map(S.scenes.map((s) => [s.num, s]));
  const rows = rd.sites.map((x) => {
    const info = S.sites[x.site] || {};
    const scs = S.scenes.filter((s) => (s.site || s.place || '(bez nazwy)') === x.site);
    return `<tr><td style="min-width:200px"><input class="inp" value="${esc(x.site)}" data-act-change="site-rename" data-from="${esc(x.site)}" aria-label="Nazwa obiektu ${esc(x.site)}"></td>
      <td style="min-width:220px"><input class="inp" value="${esc(info.address || '')}" placeholder="adres, kontakt, uwagi" data-bind="site.address" data-id="${esc(x.site)}" aria-label="Adres obiektu ${esc(x.site)}"></td>
      <td class="num">${x.scenes}</td><td class="num">${Core.fmtEighths(x.eighths)}</td><td class="num">${x.days.length ? x.days.map((n) => 'D' + n).join(', ') : '—'}</td>
      <td style="max-width:300px">${scs.map((s) => `<button class="numlink" data-act="scene-open" data-id="${s.id}" title="${esc(s.place)}">${esc(s.num)}</button>`).join('')}</td>
      <td style="width:44px">${!scs.length && info.manual ? `<button class="btn sm ghost danger" data-act="site-del" data-id="${esc(x.site)}" aria-label="Usuń lokację">${ICON.trash}</button>` : ''}</td></tr>`;
  }).join('');
  return pageH('Lokacje', 'Sceny pogrupowane po obiekcie (pierwszy człon nagłówka, np. DOM ANNY). Zmiana nazwy obiektu zmienia go we wszystkich scenach, a zdublowane nazwy połączysz jedną nazwą. Lokacje możesz też dodawać ręcznie.') +
    `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Obiekt</th><th>Adres / uwagi</th><th>Sceny</th><th>Str.</th><th>Dni zdjęciowe</th><th>Numery scen</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="muted" style="padding:20px">Brak lokacji. Pojawią się z scen albo dodaj własną poniżej.</td></tr>'}</tbody></table></div>
    <div class="row" style="margin-top:12px"><input class="inp" style="max-width:280px" id="new-site" placeholder="Nowa lokacja…" aria-label="Nazwa nowej lokacji"><button class="btn" data-act="site-add">${ICON.plus} Dodaj lokację</button></div>`;
}

/* ================= DOOD ================= */
function renderDood() {
  const dd = Core.dood(S);
  const head = dd.days.map((d) => `<th title="${esc(Core.fmtDatePL(d.date))}">D${d.no}<span class="dh">${esc(Core.fmtDM(d.date))}</span></th>`).join('');
  const rows = dd.rows.map((r) => `<tr><td class="l sticky-l"><b>${r.id}</b> ${esc(r.name)}${S.cast.find((c) => c.id === r.id).actor ? `<div class="muted small">${esc(S.cast.find((c) => c.id === r.id).actor)}</div>` : ''}</td>${r.codes.map((c) => `<td>${c ? `<span class="cd ${c}">${c}</span>` : ''}</td>`).join('')}<td><b>${r.work}</b></td><td class="muted">${r.hold}</td></tr>`).join('');
  return pageH('Day out of Days', 'Kiedy każda postać pracuje. Zestawienie powstaje samo z kalendarzówki, więc zmiana planu od razu zmienia dni aktorów.') +
    (dd.days.length ? `<div class="tbl-wrap" data-scroll-id="dood"><table class="tbl dood"><thead><tr><th class="l sticky-l" style="background:var(--surface-3)">Postać</th>${head}<th>Dni pracy</th><th>Wstrz.</th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="legend"><span><i class="cd SW" style="width:auto;border:0;padding:1px 6px">SW</i> start pracy</span><span><i class="cd W" style="width:auto;border:0;padding:1px 6px">W</i> praca</span><span><i class="cd WF" style="width:auto;border:0;padding:1px 6px">WF</i> koniec pracy</span><span><i class="cd SWF" style="width:auto;border:0;padding:1px 6px">SWF</i> start i koniec w jednym dniu</span><span><i class="cd H" style="width:auto;border:0;padding:1px 6px">H</i> wstrzymanie (aktor czeka, nie gra)</span></div>`
      : '<div class="card"><div class="empty"><h3>Brak dni zdjęciowych</h3><p>Zaplanuj sceny w kalendarzówce, a zobaczysz tu dni pracy aktorów.</p><button class="btn primary" data-act="tab" data-tab="schedule">Przejdź do kalendarzówki</button></div></div>');
}

/* ================= EKSPORT ================= */
function renderExport() {
  const x = UI.exp;
  const shoot = S.days.filter((d) => d.kind === 'shoot').length;
  const counts = { calendar: `${shoot} ${pl(shoot, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych')}`, board: `${S.scenes.length} ${pl(S.scenes.length, 'scena', 'sceny', 'scen')}`, cast: `${S.cast.length} ${pl(S.cast.length, 'postać', 'postacie', 'postaci')}`, sites: `${sitesList().length} ${pl(sitesList().length, 'obiekt', 'obiekty', 'obiektów')}`, dood: `${S.cast.length} postaci × ${shoot} dni`, callsheet: `${shoot} ${pl(shoot, 'plan', 'plany', 'planów')} (po jednym na dzień)`, transport: `${S.transport.trips.length} ${pl(S.transport.trips.length, 'kurs', 'kursy', 'kursów')}`, shotlist: `${S.shots.length} ${pl(S.shots.length, 'ujęcie', 'ujęcia', 'ujęć')}`, crew: `${S.crew.length} ${pl(S.crew.length, 'osoba', 'osoby', 'osób')}`, budget: `${S.budget.items.length} ${pl(S.budget.items.length, 'pozycja', 'pozycje', 'pozycji')}` };
  const desc = { calendar: 'Dni zdjęciowe z datami, zbiórką, scenami, obsadą dnia i sumami. Kolorowe paski jak w rozpisce.', board: 'Wszystkie sceny w kolejności scenariusza z numerem dnia zdjęciowego.', cast: 'Lista postaci z aktorami, liczbą scen i dniami zdjęciowymi.', sites: 'Obiekty z adresami, scenami i dniami zdjęciowymi.', dood: 'Day out of Days: dni pracy każdej postaci (SW, W, WF, H).', callsheet: 'Plan pracy każdego dnia zdjęciowego (PDF pionowo): zbiórki, harmonogram, obsada, transport, kontakty. Pojedynczy dzień pobierzesz w zakładce Plan pracy.', transport: 'Pojazdy, kierowcy i kursy pogrupowane według dni.', budget: 'Podsumowanie pionów i pozycje kosztowe, plan i rzeczywistość.', shotlist: 'Tabela ujęć: scena, typ planu, opis, obiektyw, grip, ETA, aktorzy, lokacja, z legendą skrótów.', crew: 'Lista ekipy pogrupowana według pionów: imię i nazwisko, funkcja, telefon (PDF pionowo, bez stawek i umów).' };
  const any = Object.values(x).some(Boolean);
  const keys = Reports.SECTIONS.filter(([k]) => x[k]).map(([k]) => k);
  return pageH('Eksport', 'Wybierz, co ma się znaleźć w pliku. PDF ma format A4 poziomo, a plany pracy i lista ekipy pionowo. Excel ma osobne arkusze z formułami sum.') +
    `<div class="exp-grid"><div class="card"><div class="card-h"><h2>Zawartość pliku</h2></div><div class="card-b">
      ${Reports.SECTIONS.map(([k, l]) => `<label class="opt"><input type="checkbox" data-act-change="exp-toggle" data-k="${k}" ${x[k] ? 'checked' : ''}><div><b>${l}</b><span>${desc[k]} <span class="chip">${counts[k]}</span></span></div></label>`).join('')}
      ${shoot === 0 && x.calendar ? '<div class="notice warn" style="margin-top:10px"><div>Kalendarzówka jest jeszcze pusta. Zaplanuj sceny w zakładce „Kalendarzówka”, aby pojawiły się w pliku.</div></div>' : ''}
      <div class="row" style="margin-top:14px"><button class="btn primary big" data-act="export-pdf" ${any ? '' : 'disabled'}>${ICON.dl} Pobierz PDF</button><button class="btn big" data-act="export-xlsx" ${any ? '' : 'disabled'}>${ICON.dl} Pobierz Excel (.xlsx)</button></div>
      <p class="muted small" style="margin:10px 0 0">Przeglądarka poprosi o potwierdzenie zapisu pliku.</p></div></div>
    <div style="display:flex;flex-direction:column;gap:16px"><div class="card"><div class="card-h"><h3>Kopia projektu</h3></div><div class="card-b"><p class="small" style="margin-top:0">Plik .json zawiera cały projekt: scenariusz, rozpiskę i plan. Przyda się do kopii zapasowej albo przeniesienia na inny komputer.</p>
      <div class="row"><button class="btn" data-act="export-json">${ICON.dl} Zapisz projekt (.json)</button><button class="btn" data-act="pick-json">${ICON.file} Wczytaj projekt…</button><input type="file" id="json-in" accept=".json,application/json" hidden></div></div></div>
    <div class="card"><div class="card-h"><h3>Plan w skrócie</h3></div><div class="card-b small">${shoot ? S.days.map((d, i) => d.kind === 'off' ? `<div class="muted">${esc(Core.fmtShort(d.date))} · dzień wolny</div>` : `<div><b>D${Core.dayNumbers(S).get(d.id)}</b> · ${esc(Core.fmtDatePL(d.date))} · ${d.sceneIds.length} ${pl(d.sceneIds.length, 'scena', 'sceny', 'scen')} · ${esc(Core.fmtEighths(Core.dayStats(S, d).eighths))} str.</div>`).join('') : '<span class="muted">Nie ma jeszcze dni zdjęciowych.</span>'}</div></div></div></div>`;
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
  <aside class="drawer" role="dialog" aria-label="Scena ${esc(sc.num)}">
    <div class="drawer-h ${kcls(sc)}">
      <button class="btn sm" data-act="scene-prev" ${i === 0 ? 'disabled' : ''} aria-label="Poprzednia scena">${ICON.left}</button><button class="btn sm" data-act="scene-next" ${i === S.scenes.length - 1 ? 'disabled' : ''} aria-label="Następna scena">${ICON.right}</button>
      <div class="ttl">Scena ${esc(sc.num)}<div style="font-size:15px;font-weight:500;letter-spacing:.02em">${esc(Core.IE_LABEL[sc.ie] || '')} ${esc(sc.place || sc.site)} · ${esc((Core.TOD[sc.tod] || {}).label || '')}</div></div>
      <button class="btn sm" data-act="drawer-close" aria-label="Zamknij">${ICON.x}</button></div>
    <div class="drawer-b" data-scroll-id="drawer">
      <div class="fgrid">
        <label class="field"><span class="lbl">Numer sceny</span><input class="inp" value="${esc(sc.num)}" data-bind="scene.num" data-id="${sc.id}"></label>
        <label class="field"><span class="lbl">Wnętrze / plener</span><select class="inp" data-bind="scene.ie" data-id="${sc.id}">${IES.map(([k, l]) => opt(k, l, sc.ie)).join('')}</select></label>
        <label class="field"><span class="lbl">Pora dnia</span><select class="inp" data-bind="scene.tod" data-id="${sc.id}">${TODS.map(([k, l]) => opt(k, l, sc.tod)).join('')}</select></label>
        <label class="field"><span class="lbl">Długość (str.)</span><input class="inp" value="${esc(Core.fmtEighths(sc.eighths))}" data-act-change="scene-eighths" data-id="${sc.id}" title="Np. 2 3/8, 5/8 albo 1"></label>
      </div>
      <div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <label class="field"><span class="lbl">Plan / lokacja w scenie</span><input class="inp" value="${esc(sc.place)}" data-bind="scene.place" data-id="${sc.id}"></label>
        <label class="field"><span class="lbl">Obiekt (grupowanie)</span><input class="inp" list="dl-sites" value="${esc(sc.site)}" data-bind="scene.site" data-id="${sc.id}"><datalist id="dl-sites">${sitesList().map((x) => `<option value="${esc(x)}">`).join('')}</datalist></label>
        <label class="field"><span class="lbl">Dzień zdjęciowy</span><select class="inp" data-act-change="scene-day" data-id="${sc.id}">${opt('', 'Nie zaplanowano', sch ? sch.dayId : '')}${S.days.filter((d) => d.kind === 'shoot').map((d) => opt(d.id, dayLabel(d, nums), sch ? sch.dayId : '')).join('')}<option value="__new">+ Nowy dzień zdjęciowy</option></select></label>
      </div>
      <label class="field"><span class="lbl">Opis sceny</span><textarea class="inp" rows="3" data-bind="scene.synopsis" data-id="${sc.id}">${esc(sc.synopsis)}</textarea></label>
      <div><span class="lbl">Obsada w scenie</span><div class="chips" style="margin-bottom:8px">${sc.cast.slice().sort((a, b) => a - b).map((id) => { const c = cm.get(id); return c ? `<span class="chip acc"><b>${c.id}</b> ${esc(c.name)}<button data-act="scene-cast-del" data-id="${sc.id}" data-cid="${c.id}" aria-label="Usuń ${esc(c.name)} ze sceny">×</button></span>` : ''; }).join('') || '<span class="muted small">Nikt nie występuje.</span>'}</div>
        <div class="row"><select class="inp mini" data-act-change="scene-cast-add" data-id="${sc.id}" aria-label="Dodaj postać do sceny"><option value="">Dodaj postać…</option>${avail.map((c) => opt(c.id, `${c.id} ${c.name}`, '')).join('')}</select>
        <input class="inp mini" style="width:170px" placeholder="lub nowa postać" data-act-change="scene-cast-new" data-id="${sc.id}" id="dr-newcast" aria-label="Nowa postać"></div></div>
      <div><span class="lbl">Elementy sceny</span><div class="eg">${Core.ELEMENT_CATS.map(([k, l]) => `<div><div class="small" style="font-weight:600;margin-bottom:3px">${l}</div><div class="chips">${(el[k] || []).map((t, n) => `<span class="chip">${esc(t)}<button data-act="el-del" data-id="${sc.id}" data-cat="${k}" data-i="${n}" aria-label="Usuń ${esc(t)}">×</button></span>`).join('')}</div><input class="inp mini" style="width:100%" id="el-${k}" placeholder="dodaj i Enter" data-act-change="el-add" data-id="${sc.id}" data-cat="${k}" aria-label="${l}: dodaj"></div>`).join('')}</div></div>
      <label class="field"><span class="lbl">Uwagi do sceny (trafiają do wydruku)</span><textarea class="inp" rows="2" data-bind="scene.notes" data-id="${sc.id}" placeholder="np. zgoda na plan, dziecko na planie, dublet dźwiękowy…">${esc(sc.notes)}</textarea></label>
      <div><div class="row" style="margin-bottom:6px"><span class="lbl" style="margin:0">Tekst sceny</span><button class="btn sm ghost" data-act="script-toggle">${UI.showScript ? 'Ukryj' : 'Pokaż'}</button></div>${UI.showScript ? `<div class="script">${lines || '<span class="muted">Brak tekstu (scena dodana ręcznie).</span>'}</div>` : ''}</div>
      <div class="row" style="border-top:1px solid var(--line-2);padding-top:12px">${UI.confirmSceneDel === sc.id ? `<span class="small">Usunąć scenę ${esc(sc.num)}?</span><button class="btn sm danger" data-act="scene-del-yes" data-id="${sc.id}">Tak, usuń</button><button class="btn sm" data-act="scene-del-no">Anuluj</button>` : `<button class="btn sm ghost danger" data-act="scene-del" data-id="${sc.id}">${ICON.trash} Usuń scenę</button>`}</div>
    </div></aside>`;
}

/* ================= USTAWIENIA ================= */
function renderSettings() {
  if (!UI.settings) return '';
  const m = S.meta;
  const f = (label, key, type, extra) => `<label class="field"><span class="lbl">${label}</span><input class="inp" type="${type || 'text'}" value="${esc(m[key])}" data-bind="meta.${key}" ${extra || ''}></label>`;
  const wd = [[1, 'pon'], [2, 'wt'], [3, 'śr'], [4, 'czw'], [5, 'pt'], [6, 'sob'], [0, 'ndz']];
  return `<div class="scrim" data-act="settings-close"></div><div class="modal" role="dialog" aria-label="Ustawienia projektu">
    <div class="card-h"><h2>Ustawienia projektu</h2><button class="btn sm" style="margin-left:auto" data-act="settings-close">${ICON.x} Zamknij</button></div>
    <div class="card-b" style="display:flex;flex-direction:column;gap:18px">
      <div class="fgrid" style="grid-template-columns:repeat(auto-fit,minmax(220px,1fr))">${f('Tytuł filmu', 'title')}${f('Firma produkcyjna', 'company')}${f('Reżyser', 'director')}${f('Producent', 'producer')}${f('Kierownik produkcji', 'manager')}${f('Wersja scenariusza', 'scriptVersion')}${f('Data wersji scenariusza', 'scriptDate', 'date')}</div>
      <div><span class="lbl">Dni robocze ekipy</span><div class="wd">${wd.map(([n, l]) => `<label><input type="checkbox" data-act-change="wd-toggle" data-n="${n}" ${m.weekdays.includes(n) ? 'checked' : ''}>${l}</label>`).join('')}</div></div>
      <div class="fgrid">
        <label class="field"><span class="lbl">Pierwszy dzień zdjęć</span><input class="inp" type="date" value="${esc(m.startDate)}" data-bind="meta.startDate"></label>
        <label class="field"><span class="lbl">Stron na dzień zdjęciowy</span><input class="inp" type="number" min="0.5" max="30" step="0.5" value="${esc(+m.pagesPerDay)}" data-bind="meta.pagesPerDay" data-num="1"></label>
        <label class="field"><span class="lbl">Zbiórka (dzień)</span><input class="inp" type="time" value="${esc(m.call)}" data-bind="meta.call"></label>
        <label class="field"><span class="lbl">Zbiórka (noc)</span><input class="inp" type="time" value="${esc(m.callNight)}" data-bind="meta.callNight"></label>
      </div>
      <p class="small muted" style="margin:0">Limit stron służy tylko do planu automatycznego i ostrzeżeń o przeładowanym dniu. Godziny pracy każdego dnia ustawiasz ręcznie w zakładce Plan pracy. Standardowo przyjmuje się 4–6 stron dziennie.</p>
      <div style="border-top:1px solid var(--line-2);padding-top:14px"><div class="row">${UI.confirmDel ? `<span class="small"><b>Usunąć cały projekt „${esc(m.title || 'Bez tytułu')}”?</b> Tego nie da się cofnąć.</span><button class="btn danger" data-act="proj-del-yes">Tak, usuń projekt</button><button class="btn" data-act="proj-del-no">Anuluj</button>` : `<button class="btn danger" data-act="proj-del">${ICON.trash} Usuń projekt</button>`}</div></div>
    </div></div>`;
}
