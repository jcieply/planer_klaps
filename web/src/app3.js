/* ===== APLIKACJA: zdarzenia, akcje, przeciąganie ===== */
const root = () => document.getElementById('app');
const closest = (t, sel) => (t && t.closest ? t.closest(sel) : null);
const shootDays = () => S.days.filter((d) => d.kind === 'shoot');
const sceneById = (id) => S.scenes.find((s) => s.id === id);
const dayById = (id) => S.days.find((d) => d.id === id);

/** Dodaje sceny do dnia ('__new' tworzy nowy dzień zdjęciowy) */
function moveScenesToDay(ids, target, index) {
  if (!ids.length) return null;
  if (target === '__pool' || target === 'pool' || target === '') { Core.unassign(S, ids); return 'pool'; }
  let day;
  if (target === '__new') {
    day = Core.addDay(S, 'shoot');
    const first = sceneById(ids[0]);
    if (first && Core.todClass(first.tod) === 'night') day.call = S.meta.callNight;
  } else day = dayById(target);
  if (!day || day.kind !== 'shoot') return null;
  Core.assign(S, ids, day.id, index);
  return day.id;
}

const ensureSheetS = (dayId) => Core.ensureSheet(S, dayId);
function setPath(bind, id, el) {
  const val = el.value;
  const [scope, key] = bind.split('.');
  if (scope === 'scene') {
    const sc = sceneById(id); if (!sc) return;
    if (el.dataset.num) sc[key] = val === '' ? null : Math.max(0, +val);
    else sc[key] = val;
    if (key === 'site') { const k = sc.site || sc.place; if (k && !S.sites[k]) S.sites[k] = Core.siteEntry(); }
    return;
  }
  if (scope === 'sheet') { ensureSheetS(id)[key] = val; return; }
  if (scope === 'row') {
    const [d, r] = id.split('|'); const row = Core.activeRows(S, d).find((x) => x.id === r); if (!row) return;
    if (key === 'dur' || key === 'prep') { row[key] = val.trim() === '' ? null : Core.etaMin(val); return; }
    row[key] = val; return;
  }
  if (scope === 'map') { const [d, m] = id.split('|'); const mp = (ensureSheetS(d).maps || []).find((x) => x.id === m); if (mp) mp[key] = val; return; }
  if (scope === 'catx') { const n = Math.max(0, Math.round(+val || 0)); if (n) S.catering.extra[id] = n; else delete S.catering.extra[id]; return; }
  if (scope === 'shot') {
    const x = S.shots.find((y) => y.id === id); if (!x) return;
    if (key === 'sceneId' && val !== x.sceneId) {
      const cm = Core.castMap(S);
      const names = (sc) => (sc ? sc.cast.map((c) => (cm.get(c) || {}).name).filter(Boolean).join(', ') : '');
      const siteOf = (sc) => (sc ? sc.site || sc.place || '' : '');
      const prev = sceneById(x.sceneId), sc = sceneById(val);
      if (sc) {
        if (!x.cast || (prev && x.cast === names(prev))) x.cast = names(sc);
        if (!x.site || (prev && x.site === siteOf(prev))) x.site = siteOf(sc);
        if (!x.shot) x.shot = Core.nextShotNo(S, val);
      }
    }
    x[key] = val; return;
  }
  if (scope === 'crew') { const c = S.crew.find((y) => y.id === id); if (c) c[key] = val; return; }
  if (scope === 'sheetcast') { const [d, c] = id.split('|'); const cc = ensureSheetS(d).cast; cc[c] = cc[c] || {}; cc[c][key] = val; return; }
  if (scope === 'contact') { const [d, i] = id.split('|'); const c = ensureSheetS(d).contacts[+i]; if (c) c[key] = val; return; }
  if (scope === 'veh') { const v = S.transport.vehicles.find((x) => x.id === id); if (v) v[key] = val; return; }
  if (scope === 'trip') { const t = S.transport.trips.find((x) => x.id === id); if (t) t[key] = val; return; }
  if (scope === 'bud') { const b = S.budget.items.find((x) => x.id === id); if (b) b[key] = val; return; }
  if (scope === 'day') { const d = dayById(id); if (d) d[key] = val; return; }
  if (scope === 'cast') { const c = Core.castMap(S).get(+id); if (c) c[key] = val; return; }
  if (scope === 'site') { if (!S.sites[id]) S.sites[id] = Core.siteEntry(); S.sites[id][key] = val; return; }
  if (scope === 'meta') {
    if (el.dataset.num) { const n = +val; if (n > 0) S.meta[key] = n; }
    else S.meta[key] = val;
    if (key === 'title') S.demo = false;
  }
}

/* ---------- input: pola tekstowe zapisywane na bieżąco bez przerysowania ---------- */
function onInput(e) {
  const el = e.target;
  if (el.id === 'f-q') { UI.f.q = el.value; renderKeepFocus('f-q'); return; }
  if (el.id === 'pool-q') { UI.pool.q = el.value; renderKeepFocus('pool-q'); return; }
  if (el.id && el.id.startsWith('sync-') && el.id !== 'sync-device') { UI.syncForm = UI.syncForm || {}; UI.syncForm[el.id.slice(5)] = el.value; return; }
  if (el.id === 'crew-q') { UI.crewF.q = el.value; renderKeepFocus('crew-q'); return; }
  if (el.id === 'paste-text') { UI.pasteText = el.value; return; }
  const bind = el.dataset && el.dataset.bind;
  if (!bind) return;
  if (el.type === 'date' || el.type === 'time' || el.type === 'number' || el.tagName === 'SELECT' || el.dataset.time || el.dataset.dur) return; // te obsługuje change
  setPath(bind, el.dataset.id, el);
  queueSave();
}
function renderKeepFocus(id) {
  const el = document.getElementById(id);
  const pos = el && el.selectionStart != null ? el.selectionStart : null;
  renderNow();
  const n = document.getElementById(id);
  if (n) { n.focus({ preventScroll: true }); if (pos != null) try { n.setSelectionRange(pos, pos); } catch (err) { /* brak */ } }
}

/* ---------- change ---------- */
function onChange(e) {
  const el = e.target;
  RQ.change = true;
  if (el.tagName === 'SELECT' || el.type === 'checkbox' || el.type === 'radio') RQ.down = false;
  try {
    const bind = el.dataset && el.dataset.bind;
    if (bind) {
      if (el.dataset.time) { const n = normTime(el.value); if (n === null) { toast(T('Wpisz godzinę w formacie gg:mm, np. 7:30.'), 'bad'); el.value = ''; } else el.value = n; }
      if (el.dataset.dur && el.value.trim() !== '' && Core.etaMin(el.value) == null) { toast(T('Wpisz czas jako h:mm albo w minutach, np. 1:30 lub 45.'), 'bad'); el.value = ''; }
      setPath(bind, el.dataset.id, el);
      if (bind === 'meta.startDate' && S.days.length && el.value) Core.recalcDates(S);
      queueSave();
      // pola tekstowe nie przerysowują widoku (zrobi to zamknięcie szuflady/okna); wybory i daty tak
      if (el.tagName === 'SELECT' || el.type === 'date' || el.type === 'time' || el.dataset.render || el.dataset.dur || (el.dataset.time && bind.startsWith('row.'))) render();
      return;
    }
    if (el.id === 'sync-device') { Sync.setDevice(el.value); return; }
    const act = el.dataset && el.dataset.actChange;
    if (act) handleChange(act, el);
  } finally {
    RQ.change = false;
    if (RQ.pending) setTimeout(flushRender, 0);
  }
}

function handleChange(act, el) {
  const v = el.value, id = el.dataset.id;
  switch (act) {
    case 'proj-switch':
      if (v === '__new') { el.value = PID; newProject(T('Nowy projekt')); }
      else if (v !== PID) { doSave().then(() => openProject(v)); }
      return;
    case 'imp-castmode': S.meta.castMode = v; try { runParse(); } catch (err) { /* zostaw */ } commit(); return;
    case 'imp-lpp': { const n = Math.max(30, Math.min(80, +v || 55)); S.meta.linesPerPage = n; try { runParse(); } catch (err) { /* zostaw */ } commit(); return; }
    case 'imp-keep': UI.imp.keep = v === '1'; render(); return;
    case 'f-ie': UI.f.ie = v; render(); return;
    case 'f-tod': UI.f.tod = v; render(); return;
    case 'f-cast': UI.f.cast = v; render(); return;
    case 'f-site': UI.f.site = v; render(); return;
    case 'f-plan': UI.f.plan = v; render(); return;
    case 'bulk-to-day': {
      if (!v) return;
      const ids = S.scenes.filter((s) => UI.sel.has(s.id)).map((s) => s.id);
      const r = moveScenesToDay(ids, v);
      UI.sel = new Set();
      commit();
      if (r && r !== 'pool') toast(T('Dodano {n} do planu.', { n: `${ids.length} ${pl(ids.length, 'scenę', 'sceny', 'scen')}` }));
      return;
    }
    case 'pool-to-day': { if (!v) return; moveScenesToDay([el.dataset.sid], v); commit(); return; }
    case 'day-move': { if (!v) return; moveScenesToDay([el.dataset.sid], v); commit(); return; }
    case 'pool-sort': UI.pool.sort = v; render(); return;
    case 'cs-day': UI.csDay = v; render(); return;
    case 'tr-day': UI.trDay = v; render(); return;
    case 'sh-scene': UI.shF.scene = v; render(); return;
    case 'row-preset': {
      if (!v) return;
      const pr = v === '__custom' ? null : ROW_PRESETS[+v];
      const row = Core.customRow(pr ? T(pr[0]) : '', pr ? pr[1] : null);
      insertRow(id, row, pr && /koniec/i.test(pr[0]) ? 'end' : 'beforeEnd');
      UI.refocus = `textarea[data-bind="row.desc"][data-id="${id}|${row.id}"]`;
      commit(); return;
    }
    case 'day-add-kind': { if (!v) return; el.value = ''; const d = Core.addDay(S, v); commit(); scrollToDay(d.id); toast(T('Dodano: {k}. Przesuń dzień strzałkami na właściwe miejsce.', { k: Core.kindLabel(v) })); return; }
    case 'day-kind': {
      const n = Core.setDayKind(S, id, v); commit();
      if (n) toast(T('{n} wróciło do puli „Do zaplanowania”.', { n: `${n} ${pl(n, 'scena', 'sceny', 'scen')}` }));
      return;
    }
    case 'doc-lang': S.meta.docLang = v; commit(); return;
    case 'cat-cast': S.catering.cast = el.checked; commit(); return;
    case 'contact-from-crew': {
      if (v.startsWith('cast:')) {
        const a = Core.castMap(S).get(+v.slice(5)); if (!a) return;
        Core.ensureSheet(S, id).contacts.push({ role: T('Aktor – {n}', { n: a.name }), name: a.actor || a.name, phone: a.phone || '' });
        commit(); return;
      }
      const c = S.crew.find((x) => x.id === v); if (!c) return;
      Core.ensureSheet(S, id).contacts.push({ role: c.role || '', name: Core.crewName(c), phone: c.phone || '' });
      commit(); return;
    }
    case 'ap-strategy': UI.ap.strategy = v; return;
    case 'ap-scope': UI.ap.scope = v; return;
    case 'ap-night': UI.ap.separateNight = el.checked; return;
    case 'cast-merge': {
      if (!v) return;
      const from = Core.castMap(S).get(+id), to = Core.castMap(S).get(+v);
      if (!from || !to) return;
      Core.mergeCast(S, from.id, to.id); commit();
      toast(T('Połączono „{a}” z „{b}”.', { a: from.name, b: to.name }));
      return;
    }
    case 'site-rename': { Core.renameSite(S, el.dataset.from, v); commit(); return; }
    case 'exp-toggle': UI.exp[el.dataset.k] = el.checked; render(); return;
    case 'wd-toggle': {
      const n = +el.dataset.n, set = new Set(S.meta.weekdays);
      if (el.checked) set.add(n); else set.delete(n);
      if (!set.size) { set.add(n); toast(T('Zaznacz przynajmniej jeden dzień roboczy.'), 'bad'); }
      S.meta.weekdays = [...set].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      commit(); return;
    }
    case 'scene-eighths': {
      const sc = sceneById(id); if (!sc) return;
      const n = parseEighths(v);
      if (n == null || n < 1 || n > 8 * 20) { toast(T('Wpisz długość np. 5/8, 1 3/8 albo 2.'), 'bad'); render(); return; }
      sc.eighths = n; commit(); return;
    }
    case 'scene-day': {
      const sc = sceneById(id); if (!sc) return;
      moveScenesToDay([sc.id], v === '' ? '__pool' : v); commit(); return;
    }
    case 'scene-cast-add': {
      const sc = sceneById(id); if (!sc || !v) return;
      const cid = +v;
      if (!sc.cast.includes(cid)) { sc.cast.push(cid); sc.manualCast = (sc.manualCast || []).concat(cid); }
      commit(); return;
    }
    case 'scene-cast-new': {
      const sc = sceneById(id); const name = Core.normName(v);
      if (!sc || !name) return;
      let c = S.cast.find((x) => Core.normName(x.name) === name);
      if (!c) { c = Core.newCast({ id: S.nextCast++, name }); S.cast.push(c); }
      if (!sc.cast.includes(c.id)) { sc.cast.push(c.id); sc.manualCast = (sc.manualCast || []).concat(c.id); }
      UI.refocus = '#dr-newcast'; commit(); return;
    }
    case 'el-add': {
      const sc = sceneById(id); const t = v.trim();
      if (!sc || !t) return;
      sc.elements = sc.elements || {};
      const cat = el.dataset.cat;
      sc.elements[cat] = (sc.elements[cat] || []).concat(t.split(/\s*[;,]\s*/).filter(Boolean));
      UI.refocus = '#el-' + cat; commit(); return;
    }
    default: break;
  }
}

/* ---------- klik ---------- */
function onClick(e) {
  const t = e.target;
  const actEl = closest(t, '[data-act]');
  if (!actEl) return;
  const act = actEl.dataset.act;
  // pole wyboru w pasku nie otwiera szuflady
  if (act === 'scene-open' && closest(t, 'input, select, button:not([data-act="scene-open"]), label')) return;
  const id = actEl.dataset.id;
  switch (act) {
    case 'tab': UI.tab = actEl.dataset.tab; UI.drawer = null; UI.tabFocus = true; render(); window.scrollTo(0, 0); return;
    case 'settings-open': UI.settings = true; UI.confirmDel = false; render(); return;
    case 'settings-close': UI.settings = false; UI.confirmDel = false; commit(); return;
    case 'proj-del': UI.confirmDel = true; render(); return;
    case 'sync-login': case 'sync-signup': {
      const g = (k) => { const e = document.getElementById('sync-' + k); return e ? e.value : ''; };
      UI.syncForm = { url: g('url'), key: g('key'), email: g('email'), pass: g('pass') };
      UI.syncBusy = true; UI.syncErr = ''; render();
      doSave().then(() => Sync.login(UI.syncForm.url, UI.syncForm.key, UI.syncForm.email, UI.syncForm.pass, act === 'sync-signup')).then((r) => {
        UI.syncBusy = false; UI.syncForm = {};
        if (r === 'confirm') { UI.syncErr = T('Konto założone. Potwierdź adres e-mail (link w wiadomości od Supabase), a potem kliknij „Zaloguj i synchronizuj”.'); render(); return; }
        toast(T('Synchronizacja włączona. Projekty z tego urządzenia trafiają do Twojej bazy.')); render();
      }).catch((e) => { UI.syncBusy = false; UI.syncErr = T('Nie udało się połączyć: {e}', { e: e.message }); render(); });
      return;
    }
    case 'sync-now': Sync.syncAll(); return;
    case 'sync-logout': Sync.logout(); render(); toast(T('Wylogowano. Projekty zostają na tym urządzeniu.')); return;
    case 'sync-copy-sql': { try { navigator.clipboard.writeText(Sync.SQL).then(() => toast(T('Skrypt SQL skopiowany.')), () => toast(T('Nie udało się skopiować – zaznacz tekst ręcznie.'), 'bad')); } catch (e) { toast(T('Nie udało się skopiować – zaznacz tekst ręcznie.'), 'bad'); } return; }
    case 'proj-del-no': UI.confirmDel = false; render(); return;
    case 'proj-del-yes': deleteProject(); return;
    case 'pick-file': { const f = document.getElementById('file-in'); if (f) f.click(); return; }
    case 'pick-json': { const f = document.getElementById('json-in'); if (f) f.click(); return; }
    case 'paste-toggle': UI.paste = !UI.paste; render(); if (UI.paste) { const p = document.getElementById('paste-text'); if (p) p.focus(); } return;
    case 'paste-go': { const p = document.getElementById('paste-text'); if (p) UI.pasteText = p.value; handlePaste(); return; }
    case 'load-sample': {
      UI.imp = { status: 'ready', file: T('przykładowy scenariusz') + '.fountain', raw: { kind: 'text', text: SAMPLE_SCRIPT }, keep: S.scenes.length > 0 };
      try { runParse(); } catch (err) { UI.imp = { status: 'error', file: T('przykład'), error: err.message }; }
      render(); return;
    }
    case 'imp-apply': applyImportNow(); return;
    case 'start-empty': UI.tab = 'board'; render(); window.scrollTo(0, 0); return;
    case 'day-add-stay': { Core.addDay(S, 'shoot'); commit(); return; }
    case 'imp-cancel': UI.imp = { status: 'idle' }; render(); return;

    case 'scene-open': {
      UI.drawer = id; UI.showScript = false; UI.confirmSceneDel = null; render();
      const dr = document.querySelector('.drawer'); if (dr) dr.focus && dr.setAttribute('tabindex', '-1');
      return;
    }
    case 'drawer-close': UI.drawer = null; UI.confirmSceneDel = null; render(); return;
    case 'scene-prev': case 'scene-next': {
      const i = S.scenes.findIndex((s) => s.id === UI.drawer), j = i + (act === 'scene-next' ? 1 : -1);
      if (S.scenes[j]) { UI.drawer = S.scenes[j].id; UI.confirmSceneDel = null; render(); const b = document.querySelector('.drawer-b'); if (b) b.scrollTop = 0; }
      return;
    }
    case 'script-toggle': UI.showScript = !UI.showScript; render(); return;
    case 'scene-add': {
      const n = S.scenes.length + 1;
      let num = String(n); const used = new Set(S.scenes.map((s) => s.num));
      let k = n; while (used.has(num)) { k += 1; num = String(k); }
      const sc = { id: Core.uid(), num, ie: 'INT', place: '', site: '', tod: 'DAY', eighths: 1, page: null, synopsis: '', notes: '', cast: [], elements: {}, text: '', heading: '' };
      S.scenes.push(sc); UI.drawer = sc.id; UI.f = { q: '', ie: '', tod: '', cast: '', site: '', plan: '' }; commit(); return;
    }
    case 'scene-del': UI.confirmSceneDel = id; render(); return;
    case 'scene-del-no': UI.confirmSceneDel = null; render(); return;
    case 'scene-del-yes': {
      Core.removeScenes(S, [id]);
      UI.drawer = null; UI.confirmSceneDel = null; UI.sel.delete(id); commit(); toast(T('Scena usunięta.')); return;
    }
    case 'scene-cast-del': {
      const sc = sceneById(id); if (!sc) return; const cid = +actEl.dataset.cid;
      sc.cast = sc.cast.filter((x) => x !== cid); sc.manualCast = (sc.manualCast || []).filter((x) => x !== cid); commit(); return;
    }
    case 'el-del': {
      const sc = sceneById(id); if (!sc) return;
      const arr = (sc.elements[actEl.dataset.cat] || []).slice(); arr.splice(+actEl.dataset.i, 1);
      sc.elements[actEl.dataset.cat] = arr; commit(); return;
    }

    case 'sel-toggle': {
      if (UI.sel.has(id)) UI.sel.delete(id); else UI.sel.add(id);
      render(); return;
    }
    case 'sel-all': {
      const list = filteredScenes();
      if (list.every((s) => UI.sel.has(s.id))) list.forEach((s) => UI.sel.delete(s.id)); else list.forEach((s) => UI.sel.add(s.id));
      render(); return;
    }
    case 'sel-clear': UI.sel = new Set(); render(); return;
    case 'bulk-unplan': { const ids = [...UI.sel]; Core.unassign(S, ids); UI.sel = new Set(); commit(); toast(T('Sceny usunięte z planu.')); return; }
    case 'bulk-delete': {
      if (!UI.confirmBulk) { UI.confirmBulk = true; toast(T('Kliknij jeszcze raz, aby usunąć {n}.', { n: `${UI.sel.size} ${pl(UI.sel.size, 'scenę', 'sceny', 'scen')}` }), 'bad'); setTimeout(() => { UI.confirmBulk = false; }, 4000); return; }
      const ids = [...UI.sel]; Core.removeScenes(S, ids); UI.sel = new Set(); UI.confirmBulk = false; commit(); toast(T('Sceny usunięte.')); return;
    }
    case 'f-clear': UI.f = { q: '', ie: '', tod: '', cast: '', site: '', plan: '' }; render(); return;

    case 'cal-view': UI.calView = actEl.dataset.v; render(); return;
    case 'autoplan-toggle': UI.autoplan = !UI.autoplan; if (UI.autoplan && !S.days.length) UI.ap.scope = 'unscheduled'; render(); return;
    case 'autoplan-run': case 'autoplan-run-first': {
      const ap = act === 'autoplan-run-first' ? { strategy: 'site', scope: 'unscheduled', separateNight: true } : UI.ap;
      if (ap.scope === 'all') S.days.filter((d) => d.kind === 'shoot').forEach((d) => Core.removeDay(S, d.id));
      Core.recalcDates(S);
      const n = Core.autoPlan(S, { strategy: ap.strategy, scope: 'unscheduled', separateNight: ap.separateNight });
      UI.autoplan = false; UI.calView = 'days';
      commit();
      toast(n ? T('Ułożono {n}.', { n: `${n} ${pl(n, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych')}` }) : T('Nie było scen do zaplanowania.'));
      return;
    }
    case 'day-add': { const d = Core.addDay(S, 'shoot'); commit(); scrollToDay(d.id); return; }
    case 'day-off': { Core.addDay(S, 'off'); commit(); return; }
    case 'day-del': {
      const d = dayById(id); if (!d) return;
      const n = d.sceneIds.length; Core.removeDay(S, id); commit();
      toast(n ? T('Dzień usunięty. {n} do puli.', { n: `${n} ${pl(n, 'scena wróciła', 'sceny wróciły', 'scen wróciło')}` }) : T('Dzień usunięty.'));
      return;
    }
    case 'day-up': Core.moveDay(S, id, -1); Core.recalcDates(S); commit(); return;
    case 'day-down': Core.moveDay(S, id, 1); Core.recalcDates(S); commit(); return;
    case 'goto-day': UI.calView = 'days'; render(); scrollToDay(id); return;
    case 'month-prev': case 'month-next': {
      const [y, m] = (UI.month || Core.todayISO().slice(0, 7)).split('-').map(Number);
      const d = new Date(Date.UTC(y, m - 1 + (act === 'month-next' ? 1 : -1), 1));
      UI.month = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); render(); return;
    }
    case 'month-today': UI.month = null; render(); return;

    case 'cast-add': {
      const inp = document.getElementById('new-cast'); const name = inp ? Core.normName(inp.value) : '';
      if (!name) { if (inp) inp.focus(); return; }
      if (!S.cast.some((c) => Core.normName(c.name) === name)) S.cast.push(Core.newCast({ id: S.nextCast++, name }));
      UI.refocus = '#new-cast'; commit(); return;
    }
    case 'cast-del': {
      const c = Core.castMap(S).get(+id); if (!c) return;
      if (UI.confirmCast !== c.id) { UI.confirmCast = c.id; toast(T('Kliknij jeszcze raz, aby usunąć „{n}” ze wszystkich scen.', { n: c.name }), 'bad'); setTimeout(() => { UI.confirmCast = null; }, 4000); return; }
      UI.confirmCast = null; Core.removeCast(S, c.id); commit(); return;
    }

    case 'export-pdf': doExport('pdf', Reports.SECTIONS.map((x) => x[0]).filter((k) => UI.exp[k]), 'produkcja'); return;
    case 'export-xlsx': doExport('xlsx', Reports.SECTIONS.map((x) => x[0]).filter((k) => UI.exp[k]), 'produkcja'); return;
    case 'export-quick-pdf': doExport('pdf', ['calendar'], 'kalendarzowka'); return;
    case 'export-quick-xlsx': doExport('xlsx', ['calendar'], 'kalendarzowka'); return;
    case 'export-json': exportProjectJson(); return;
    case 'cs-export-pdf': case 'cs-export-xlsx': {
      const d = dayById(UI.csDay); const no = d ? Core.dayNumbers(S).get(d.id) : '';
      doExport(act.endsWith('pdf') ? 'pdf' : 'xlsx', ['callsheet'], ['plan_pracy_D{n}', { n: no }], { dayId: UI.csDay }); return;
    }
    case 'row-up': case 'row-down': {
      const rows = Core.activeRows(S, id), i = rows.findIndex((r) => r.id === actEl.dataset.rid), j = i + (act === 'row-down' ? 1 : -1);
      if (i < 0 || j < 0 || j >= rows.length) return;
      [rows[i], rows[j]] = [rows[j], rows[i]]; commit(); return;
    }
    case 'row-del': { const rows = Core.activeRows(S, id); const i = rows.findIndex((r) => r.id === actEl.dataset.rid); if (i >= 0) rows.splice(i, 1); commit(); return; }
    case 'cs-mode': {
      const sh = Core.setSheetMode(S, id, actEl.dataset.v);
      UI.csPick = sh.mode === 'shots' && !(sh.srows || []).some((r) => r.kind === 'shot');
      commit(); return;
    }
    case 'cs-pick-toggle': UI.csPick = !UI.csPick; render(); return;
    case 'cs-pick-all': UI.csPickAll = !UI.csPickAll; render(); return;
    case 'cs-shot-toggle': {
      const rows = Core.activeRows(S, id), xid = actEl.dataset.xid;
      const i = rows.findIndex((r) => r.kind === 'shot' && r.shotId === xid);
      if (i >= 0) rows.splice(i, 1);
      else { const x = S.shots.find((y) => y.id === xid); if (x) insertRow(id, Core.shotRowOf(x), 'scene'); }
      commit(); return;
    }
    case 'cs-scene-shots': {
      const rows = Core.activeRows(S, id), sid = actEl.dataset.sid, on = actEl.dataset.on === '1';
      const xs = S.shots.filter((x) => x.sceneId === sid);
      if (on) xs.forEach((x) => { if (!rows.some((r) => r.kind === 'shot' && r.shotId === x.id)) insertRow(id, Core.shotRowOf(x), 'scene'); });
      else { const ids = new Set(xs.map((x) => x.id)); for (let k = rows.length - 1; k >= 0; k--) if (rows[k].kind === 'shot' && ids.has(rows[k].shotId)) rows.splice(k, 1); }
      commit(); return;
    }
    case 'cs-rebuild': {
      if (UI.confirmRebuild !== id) { UI.confirmRebuild = id; toast(T('Kliknij jeszcze raz, aby ułożyć harmonogram od nowa z ujęć scen tego dnia (zmiany w trybie shotlisty przepadną).'), 'bad'); setTimeout(() => { UI.confirmRebuild = null; }, 4000); return; }
      UI.confirmRebuild = null; Core.initShotRows(S, id); commit(); return;
    }
    case 'map-pick': { const f = document.getElementById('map-in'); if (f) f.click(); return; }
    case 'map-del': { Core.removeMap(S, id, actEl.dataset.mid); commit(); return; }
    case 'lang-toggle': setLang(PREFS.lang === 'en' ? 'pl' : 'en'); return;
    case 'theme-toggle': setTheme(isDark() ? 'light' : 'dark'); return;
    case 'set-lang': setLang(actEl.dataset.v); return;
    case 'set-theme': setTheme(actEl.dataset.v); return;
    case 'crew-view': UI.crewView = actEl.dataset.v; render(); return;
    case 'crew-days-open': UI.tab = 'crew'; UI.crewView = 'days'; UI.tabFocus = true; render(); window.scrollTo(0, 0); return;
    case 'crew-cat-open': UI.tab = 'crew'; UI.crewView = 'catering'; UI.tabFocus = true; render(); window.scrollTo(0, 0); return;
    case 'crew-day': { const c = S.crew.find((x) => x.id === id); if (!c) return; Core.toggleCrewDay(S, c, actEl.dataset.day); commit(); return; }
    case 'crew-days-all': { const c = S.crew.find((x) => x.id === id); if (!c) return; Core.setCrewAllDays(S, c, actEl.dataset.v); commit(); return; }
    case 'crew-col': {
      const d = dayById(actEl.dataset.day); if (!d) return;
      const allOn = S.crew.every((c) => Core.crewWorks(c, d));
      S.crew.forEach((c) => Core.toggleCrewDay(S, c, d.id, !allOn)); commit(); return;
    }
    case 'cat-export-pdf': case 'cat-export-xlsx': doExport(act.endsWith('pdf') ? 'pdf' : 'xlsx', ['catering'], 'catering'); return;
    case 'row-restore': { Core.syncSheet(S, id, true); commit(); return; }
    case 'cs-loc-reset': { Core.ensureSheet(S, id).locations = null; commit(); return; }
    case 'site-add': {
      const inp = document.getElementById('new-site'); const name = inp ? inp.value.trim().toUpperCase() : '';
      if (!name) { if (inp) inp.focus(); return; }
      if (!S.sites[name]) S.sites[name] = Core.siteEntry({ manual: true });
      UI.refocus = '#new-site'; commit(); return;
    }
    case 'site-del': { delete S.sites[id]; commit(); return; }
    case 'shot-add': {
      const f = UI.shF.scene && sceneById(UI.shF.scene) ? UI.shF.scene : '';
      const lastShot = S.shots[S.shots.length - 1];
      const x = Core.newShot(S, f || (lastShot ? lastShot.sceneId : '') || (S.scenes[0] || {}).id || '');
      S.shots.push(x);
      UI.refocus = `textarea[data-bind="shot.desc"][data-id="${x.id}"]`; commit(); return;
    }
    case 'shot-del': { S.shots = S.shots.filter((x) => x.id !== id); commit(); return; }
    case 'shot-up': case 'shot-down': {
      const i = S.shots.findIndex((x) => x.id === id); if (i < 0) return;
      const dir = act === 'shot-down' ? 1 : -1;
      for (let j = i + dir; j >= 0 && j < S.shots.length; j += dir) {
        if (S.shots[j].sceneId === S.shots[i].sceneId) { [S.shots[i], S.shots[j]] = [S.shots[j], S.shots[i]]; commit(); return; }
      }
      return;
    }
    case 'shot-export-pdf': case 'shot-export-xlsx': doExport(act.endsWith('pdf') ? 'pdf' : 'xlsx', ['shotlist'], 'shotlista'); return;
    case 'crew-add': {
      const x = Core.newCrew({ dept: UI.crewF.dept && UI.crewF.dept !== '__none' ? UI.crewF.dept : '' });
      S.crew.push(x); UI.crewF.q = ''; if (UI.crewView !== 'list') UI.crewView = 'list';
      UI.refocus = `input[data-bind="crew.first"][data-id="${x.id}"]`; commit(); return;
    }
    case 'crew-del': {
      const c = S.crew.find((x) => x.id === id); if (!c) return;
      if (UI.confirmCrew !== id) { UI.confirmCrew = id; toast(T('Kliknij jeszcze raz, aby usunąć: {n}.', { n: Core.crewName(c) || T('osoba bez nazwiska') }), 'bad'); setTimeout(() => { UI.confirmCrew = null; }, 4000); return; }
      UI.confirmCrew = null; S.crew = S.crew.filter((x) => x.id !== id); UI.crewOpen.delete(id); commit(); return;
    }
    case 'cast-toggle': { const k = +id; if (UI.castOpen.has(k)) UI.castOpen.delete(k); else UI.castOpen.add(k); render(); return; }
    case 'site-toggle': { if (UI.siteOpen.has(id)) UI.siteOpen.delete(id); else UI.siteOpen.add(id); render(); return; }
    case 'crew-toggle': { if (UI.crewOpen.has(id)) UI.crewOpen.delete(id); else UI.crewOpen.add(id); render(); return; }
    case 'crew-dept': UI.crewF.dept = actEl.dataset.d || ''; render(); return;
    case 'site-export-pdf': case 'site-export-xlsx': doExport(act.endsWith('pdf') ? 'pdf' : 'xlsx', ['sites'], 'lokacje'); return;
    case 'cast-export-pdf': case 'cast-export-xlsx': doExport(act.endsWith('pdf') ? 'pdf' : 'xlsx', ['cast'], 'obsada'); return;
    case 'crew-export-pdf': case 'crew-export-xlsx': doExport(act.endsWith('pdf') ? 'pdf' : 'xlsx', act.endsWith('pdf') ? ['crew'] : ['crew', 'catering'], 'ekipa'); return;
    case 'contact-add': { Core.ensureSheet(S, id).contacts.push({ role: '', name: '', phone: '' }); commit(); return; }
    case 'contact-del': { Core.ensureSheet(S, id).contacts.splice(+actEl.dataset.i, 1); commit(); return; }
    case 'veh-add': { S.transport.vehicles.push({ id: Core.uid(), name: '', type: Core.VEHICLE_TYPES[0], plate: '', driver: '', phone: '', note: '' }); commit(); return; }
    case 'veh-del': { S.transport.vehicles = S.transport.vehicles.filter((v) => v.id !== id); S.transport.trips.forEach((t) => { if (t.vehicleId === id) t.vehicleId = ''; }); commit(); return; }
    case 'trip-add': {
      const first = S.days.find((d) => d.kind !== 'off'); const dayId = UI.trDay || (first && first.id) || '';
      S.transport.trips.push({ id: Core.uid(), dayId, vehicleId: (S.transport.vehicles[0] || {}).id || '', time: '', from: '', to: '', who: '', note: '' });
      commit(); return;
    }
    case 'trip-del': { S.transport.trips = S.transport.trips.filter((t) => t.id !== id); commit(); return; }
    case 'tr-export-pdf': case 'tr-export-xlsx': {
      const d = UI.trDay ? dayById(UI.trDay) : null; const no = d ? Core.dayNumbers(S).get(d.id) : null;
      doExport(act.endsWith('pdf') ? 'pdf' : 'xlsx', ['transport'], no ? ['transport_D{n}', { n: no }] : 'transport', { dayId: UI.trDay || null }); return;
    }
    case 'bud-add': { S.budget.items.push({ id: Core.uid(), cat: actEl.dataset.cat, name: '', est: '', act: '', dayId: '', site: '', note: '' }); commit(); return; }
    case 'bud-del': { S.budget.items = S.budget.items.filter((b) => b.id !== id); commit(); return; }
    case 'bud-export-pdf': case 'bud-export-xlsx': doExport(act.endsWith('pdf') ? 'pdf' : 'xlsx', ['budget'], 'kosztorys'); return;
    case 'toast-undo': return;
    default: return;
  }
}

/** wstawia wiersz harmonogramu: 'scene' = za ujęciami tej samej sceny, 'beforeEnd' = przed końcowym „Koniec zdjęć”, 'end' = na koniec */
function insertRow(dayId, row, where) {
  const rows = Core.activeRows(S, dayId);
  let at = rows.length;
  if (where === 'scene' && row.sceneId) {
    let k = -1; rows.forEach((r, i) => { if (r.sceneId === row.sceneId && (r.kind === 'shot' || r.kind === 'scene')) k = i; });
    if (k >= 0) { rows.splice(k + 1, 0, row); return; }
  }
  if (where !== 'end') { while (at > 0 && rows[at - 1].kind === 'custom' && !(+rows[at - 1].dur > 0)) at--; }
  rows.splice(at, 0, row);
}
async function addMapFiles(dayId, files) {
  const list = [...(files || [])].filter((f) => /^image\/(png|jpe?g)$/i.test(f.type) || /\.(png|jpe?g)$/i.test(f.name));
  if (!list.length) { toast(T('Wybierz plik JPG albo PNG.'), 'bad'); return; }
  UI.busy = T('Przygotowuję mapkę…'); render();
  let ok = 0;
  for (const f of list) {
    try { const img = await loadImageFile(f); Core.addMap(S, dayId, img); ok++; } catch (e) { toast(T('Nie udało się dodać mapki: {e}', { e: e.message }), 'bad'); }
  }
  UI.busy = null; commit();
  if (ok) toast(T('Dodano mapki: {n}. Trafią do PDF planu pracy.', { n: ok }));
}
function scrollToDay(id) {
  setTimeout(() => { const el = document.getElementById('day-' + id); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 30);
}

/* ---------- klawiatura ---------- */
function onKeydown(e) {
  if (e.key === 'Escape') {
    if (UI.settings) { UI.settings = false; commit(); return; }
    if (UI.csPick) { UI.csPick = false; render(); return; }
    if (UI.drawer) { UI.drawer = null; render(); return; }
    return;
  }
  const el = e.target;
  if (e.key === 'Enter' && el && el.dataset && el.dataset.actChange && el.tagName === 'INPUT' && el.type === 'text') {
    e.preventDefault();
    el.blur();
    return;
  }
  if (e.key === 'Enter' && el && el.id === 'new-site') { e.preventDefault(); const b = document.querySelector('[data-act="site-add"]'); if (b) b.click(); }
  if (e.key === 'Enter' && el && el.id === 'new-cast') { e.preventDefault(); const b = document.querySelector('[data-act="cast-add"]'); if (b) b.click(); }
  if ((e.key === 'Enter' || e.key === ' ') && el && el.classList && el.classList.contains('strip') && el === e.target) {
    e.preventDefault(); UI.drawer = el.dataset.id; render();
  }
}

/* ---------- przeciąganie scen ---------- */
const DND = { ids: [], el: null, zone: null, index: null, line: null };

function dropIndexFor(zone, y) {
  const items = [...zone.querySelectorAll(':scope > .mini-strip:not(.dragging)')];
  let index = items.length, before = null;
  for (let i = 0; i < items.length; i++) {
    const r = items[i].getBoundingClientRect();
    if (y < r.top + r.height / 2) { index = i; before = items[i]; break; }
  }
  return { index, before };
}
function clearDnd() {
  document.querySelectorAll('.over-zone').forEach((z) => z.classList.remove('over-zone'));
  if (DND.line && DND.line.parentNode) DND.line.remove();
  DND.line = null; DND.zone = null; DND.index = null;
}
function onDragStart(e) {
  const strip = closest(e.target, '[data-drag]');
  if (!strip) return;
  RQ.down = false; // po przeciągnięciu przeglądarka nie wysyła mouseup
  const sid = strip.dataset.sid;
  DND.ids = [sid]; DND.el = strip;
  try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', sid); } catch (err) { /* brak */ }
  setTimeout(() => strip.classList.add('dragging'), 0);
}
function onDragOver(e) {
  if (!DND.ids.length) {
    const iz = closest(e.target, '[data-drop-img]');
    if (iz) { e.preventDefault(); iz.classList.add('over'); return; }
    const dz = closest(e.target, '[data-drop-file]');
    if (dz) { e.preventDefault(); dz.classList.add('over'); }
    return;
  }
  const zone = closest(e.target, '[data-drop]');
  if (!zone) { clearDnd(); return; }
  e.preventDefault();
  try { e.dataTransfer.dropEffect = 'move'; } catch (err) { /* brak */ }
  const { index, before } = dropIndexFor(zone, e.clientY);
  if (zone !== DND.zone) {
    clearDnd();
    zone.classList.add('over-zone');
    DND.zone = zone;
    DND.line = document.createElement('div'); DND.line.className = 'drop-line';
  }
  DND.index = index;
  if (zone.dataset.drop === 'pool') { if (DND.line.parentNode) DND.line.remove(); return; } // pula: bez wskaźnika pozycji
  const empty = zone.querySelector(':scope > .day-empty');
  if (empty) { if (DND.line.parentNode) DND.line.remove(); return; }
  if (before) zone.insertBefore(DND.line, before); else zone.appendChild(DND.line);
}
function onDragLeave(e) {
  const iz = closest(e.target, '[data-drop-img]');
  if (iz && !iz.contains(e.relatedTarget)) iz.classList.remove('over');
  const dz = closest(e.target, '[data-drop-file]');
  if (dz && !dz.contains(e.relatedTarget)) dz.classList.remove('over');
  if (DND.zone && !DND.zone.contains(e.relatedTarget)) clearDnd();
}
function onDrop(e) {
  const imgZone = closest(e.target, '[data-drop-img]');
  if (!DND.ids.length && imgZone) {
    e.preventDefault(); imgZone.classList.remove('over');
    addMapFiles(imgZone.dataset.dropImg, e.dataTransfer && e.dataTransfer.files);
    return;
  }
  const fileZone = closest(e.target, '[data-drop-file]');
  if (!DND.ids.length) {
    if (fileZone || (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length)) {
      e.preventDefault();
      if (fileZone) fileZone.classList.remove('over');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) { UI.tab = 'import'; handleFile(f); }
    }
    return;
  }
  e.preventDefault();
  const zone = closest(e.target, '[data-drop]') || DND.zone;
  const ids = DND.ids.slice();
  let index = DND.index;
  if (zone) {
    const target = zone.dataset.drop === 'pool' ? '__pool' : zone.dataset.drop.replace('day:', '');
    if (target !== '__pool' && index != null) {
      // indeks liczony bez przenoszonych scen już zawiera pozycję względem pozostałych
      const d = dayById(target);
      if (d) { /* DND.index odnosi się do listy bez przeciąganego paska */ }
    }
    clearDnd();
    moveScenesToDay(ids, target, target === '__pool' ? null : index);
    DND.ids = []; DND.el = null;
    commit();
  } else { clearDnd(); DND.ids = []; DND.el = null; render(); }
}
function onDragEnd() {
  clearDnd();
  document.querySelectorAll('.dragging').forEach((x) => x.classList.remove('dragging'));
  DND.ids = []; DND.el = null;
}

/* ---------- pliki z pól wyboru ---------- */
function onFileInput(e) {
  const el = e.target;
  if (el.id === 'file-in' && el.files && el.files[0]) { const f = el.files[0]; el.value = ''; handleFile(f); }
  else if (el.id === 'json-in' && el.files && el.files[0]) { const f = el.files[0]; el.value = ''; importProjectJson(f); }
  else if (el.id === 'map-in' && el.files && el.files.length) { const fs = [...el.files]; el.value = ''; addMapFiles(el.dataset.id, fs); }
}

function bindEvents() {
  const r = root();
  document.addEventListener('mousedown', () => { RQ.down = true; RQ.at = Date.now(); }, true);
  document.addEventListener('mouseup', () => { RQ.down = false; setTimeout(flushRender, 0); }, true);
  r.addEventListener('click', onClick);
  r.addEventListener('input', onInput);
  r.addEventListener('change', (e) => { if (e.target.type === 'file') onFileInput(e); else onChange(e); });
  r.addEventListener('keydown', onKeydown);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !r.contains(e.target)) onKeydown(e); });
  r.addEventListener('dragstart', onDragStart);
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('dragleave', onDragLeave);
  document.addEventListener('drop', onDrop);
  document.addEventListener('dragend', onDragEnd);
  // toast
  document.addEventListener('click', (e) => { const b = closest(e.target, '#toast-root button'); if (b && b.dataset.act) onClick(e); });
  // zapis przy opuszczeniu karty
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveTimer) doSave(); });
  window.addEventListener('pagehide', () => { if (saveTimer) doSave(); });
}
