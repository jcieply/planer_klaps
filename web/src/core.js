/* ===== RDZEŃ: model danych, daty, planowanie, DOOD, dane do raportów ===== */
const Core = (() => {
  const uid = () => Math.random().toString(36).slice(2, 10);

  const TOD = {
    DAY: { label: 'DZIEŃ', short: 'D' },
    NIGHT: { label: 'NOC', short: 'N' },
    DAWN: { label: 'ŚWIT', short: 'Ś' },
    DUSK: { label: 'ZMIERZCH', short: 'Z' },
  };
  const IE_LABEL = { INT: 'WN.', EXT: 'ZN.', 'INT/EXT': 'WN./ZN.', '': '—' };
  const ELEMENT_CATS = [
    ['extras', 'Statyści'], ['props', 'Rekwizyty'], ['wardrobe', 'Kostiumy'], ['makeup', 'Charakteryzacja'],
    ['vehicles', 'Pojazdy'], ['sfx', 'Efekty specjalne'], ['stunts', 'Kaskaderzy / akcja'], ['setdress', 'Scenografia'],
    ['animals', 'Zwierzęta'], ['sound', 'Dźwięk / muzyka'], ['other', 'Inne'],
  ];
  const STRIP = {
    'INT-DAY': { bg: 'FFFFFF', name: 'Wnętrze, dzień' },
    'EXT-DAY': { bg: 'FFF1A6', name: 'Plener, dzień' },
    'INT-NIGHT': { bg: 'BCD6F7', name: 'Wnętrze, noc' },
    'EXT-NIGHT': { bg: 'BFE5B5', name: 'Plener, noc' },
    'INT-TWI': { bg: 'F7CBC1', name: 'Wnętrze, świt/zmierzch' },
    'EXT-TWI': { bg: 'F9D3A1', name: 'Plener, świt/zmierzch' },
  };
  function stripKey(sc) {
    const ext = sc.ie === 'EXT' || sc.ie === 'INT/EXT';
    const t = sc.tod === 'NIGHT' ? 'NIGHT' : sc.tod === 'DAWN' || sc.tod === 'DUSK' ? 'TWI' : 'DAY';
    return (ext ? 'EXT' : 'INT') + '-' + t;
  }
  const stripBg = (sc) => STRIP[stripKey(sc)].bg;
  const todClass = (tod) => (tod === 'DAY' || !tod ? 'day' : 'night');

  /* ---------- daty (UTC, bez stref czasowych) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const isoOf = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const addDays = (iso, n) => { const d = parseISO(iso); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
  const dow = (iso) => parseISO(iso).getUTCDay();
  const MONTHS_GEN = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const MONTHS_NOM = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  const DAYS_PL = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const DAYS_SHORT = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
  const fmtDatePL = (iso) => { if (!iso) return ''; const d = parseISO(iso); return `${DAYS_PL[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_GEN[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
  const fmtShort = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-'); return `${d}.${m}.${y}`; };
  const fmtDM = (iso) => { if (!iso) return ''; const [, m, d] = iso.split('-'); return `${d}.${m}`; };
  const todayISO = () => { const n = new Date(); return n.getFullYear() + '-' + pad(n.getMonth() + 1) + '-' + pad(n.getDate()); };
  function nextMonday(iso) { let d = iso; for (let i = 0; i < 8; i++) { d = addDays(d, 1); if (dow(d) === 1) return d; } return d; }

  function fmtEighths(n) {
    n = Math.round(n || 0);
    const w = Math.floor(n / 8), r = n % 8;
    if (!w) return r ? `${r}/8` : '0';
    return r ? `${w} ${r}/8` : `${w}`;
  }
  const pl = (n, one, few, many) => { n = Math.abs(n); const a = n % 10, b = n % 100; return n === 1 ? one : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? few : many; };
  const fmtDur = (min) => {
    min = Math.round(min || 0);
    const h = Math.floor(min / 60), m = min % 60;
    if (!h) return `${m} min`;
    return m ? `${h} h ${m} min` : `${h} h`;
  };
  const fmtHM = (min) => { min = Math.round(min || 0); return `${Math.floor(min / 60)}:${pad(min % 60)}`; };

  /* ---------- stan ---------- */
  function newState() {
    return {
      v: 1,
      meta: {
        title: '', company: '', director: '', producer: '', manager: '', scriptVersion: '', scriptDate: '', scriptFile: '',
        startDate: nextMonday(todayISO()), weekdays: [1, 2, 3, 4, 5], pagesPerDay: 5, call: '07:00', callNight: '17:00',
        linesPerPage: 55, castMode: 'all',
      },
      scenes: [], cast: [], days: [], sites: {}, nextCast: 1,
      sheets: {}, transport: { vehicles: [], trips: [] }, budget: { items: [] }, crew: [], shots: [],
    };
  }
  function normalize(st) {
    const base = newState();
    st = st || {};
    const om = st.meta || {};
    // starsze projekty liczyły czas zdjęć; zamieniamy to na limit stron na dzień
    const legacyPages = om.pagesPerDay == null && om.dayMin > 0 && om.minPerPage > 0 ? Math.max(1, Math.min(20, Math.round((om.dayMin / om.minPerPage) * 2) / 2)) : null;
    st.meta = Object.assign(base.meta, om);
    if (legacyPages) st.meta.pagesPerDay = legacyPages;
    delete st.meta.dayMin; delete st.meta.minPerPage;
    st.scenes = (st.scenes || []).map((s) => Object.assign({ id: uid(), num: '', ie: 'INT', place: '', site: '', tod: 'DAY', eighths: 1, page: null, synopsis: '', notes: '', cast: [], elements: {}, text: '', heading: '' }, s));
    st.scenes.forEach((x) => { delete x.estMin; });
    st.cast = st.cast || [];
    st.days = (st.days || []).map((d) => Object.assign({ id: uid(), kind: 'shoot', date: '', call: '', note: '', sceneIds: [] }, d));
    st.sites = st.sites || {};
    st.sheets = st.sheets || {};
    st.transport = Object.assign({ vehicles: [], trips: [] }, st.transport || {});
    st.budget = Object.assign({ items: [] }, st.budget || {});
    st.crew = Array.isArray(st.crew) ? st.crew : [];
    st.shots = Array.isArray(st.shots) ? st.shots : [];
    st.nextCast = st.nextCast || (st.cast.reduce((a, c) => Math.max(a, c.id), 0) + 1);
    st.v = 1;
    return st;
  }

  const maxEighths = (meta) => Math.round((+meta.pagesPerDay > 0 ? +meta.pagesPerDay : 5) * 8);
  const castMap = (st) => new Map(st.cast.map((c) => [c.id, c]));
  const sceneMap = (st) => new Map(st.scenes.map((s) => [s.id, s]));

  function scheduleIndex(st) {
    const m = new Map();
    let n = 0;
    st.days.forEach((d) => {
      if (d.kind === 'shoot') n += 1;
      d.sceneIds.forEach((id, i) => m.set(id, { dayId: d.id, dayNo: d.kind === 'shoot' ? n : null, idx: i }));
    });
    return m;
  }
  function dayNumbers(st) {
    let n = 0;
    const m = new Map();
    st.days.forEach((d) => { if (d.kind === 'shoot') { n += 1; m.set(d.id, n); } else m.set(d.id, null); });
    return m;
  }

  /* ---------- operacje na planie ---------- */
  function unassign(st, ids) {
    const set = new Set(ids);
    st.days.forEach((d) => { d.sceneIds = d.sceneIds.filter((x) => !set.has(x)); });
  }
  /** Przenosi sceny do dnia; index = pozycja na liście dnia PO usunięciu przenoszonych scen (null = na koniec) */
  function assign(st, ids, dayId, index) {
    const day = st.days.find((d) => d.id === dayId);
    if (!day || day.kind !== 'shoot') return;
    unassign(st, ids);
    const at = index == null ? day.sceneIds.length : Math.max(0, Math.min(day.sceneIds.length, index));
    day.sceneIds.splice(at, 0, ...ids);
  }

  const weekdaysOf = (meta) => (meta.weekdays && meta.weekdays.length ? meta.weekdays : [1, 2, 3, 4, 5]);
  function nextWorkDate(afterISO, meta) {
    const wd = weekdaysOf(meta);
    let d = afterISO;
    for (let i = 0; i < 400; i++) { d = addDays(d, 1); if (wd.includes(dow(d))) return d; }
    return d;
  }
  function lastDate(st) {
    let last = null;
    st.days.forEach((d) => { if (d.date && (!last || d.date > last)) last = d.date; });
    return last;
  }
  function newDayDate(st, kind) {
    const last = lastDate(st);
    if (kind === 'off') return last ? addDays(last, 1) : st.meta.startDate;
    if (!last) return nextWorkDate(addDays(st.meta.startDate, -1), st.meta);
    return nextWorkDate(last, st.meta);
  }
  function addDay(st, kind, extra) {
    const d = Object.assign({ id: uid(), kind: kind || 'shoot', date: newDayDate(st, kind), call: kind === 'off' ? '' : st.meta.call, note: '', sceneIds: [] }, extra || {});
    st.days.push(d);
    return d;
  }
  function recalcDates(st) {
    let cursor = addDays(st.meta.startDate, -1);
    for (const d of st.days) {
      if (d.kind === 'shoot') cursor = nextWorkDate(cursor, st.meta);
      else cursor = addDays(cursor, 1);
      d.date = cursor;
    }
  }
  function removeDay(st, dayId) {
    st.days = st.days.filter((d) => d.id !== dayId);
    if (st.sheets) delete st.sheets[dayId];
    if (st.transport) st.transport.trips = st.transport.trips.filter((t) => t.dayId !== dayId);
    if (st.budget) st.budget.items.forEach((i) => { if (i.dayId === dayId) i.dayId = ''; });
  }
  function moveDay(st, dayId, dir) {
    const i = st.days.findIndex((d) => d.id === dayId), j = i + dir;
    if (i < 0 || j < 0 || j >= st.days.length) return;
    [st.days[i], st.days[j]] = [st.days[j], st.days[i]];
  }

  function autoPlan(st, o) {
    o = Object.assign({ strategy: 'site', scope: 'unscheduled', separateNight: true }, o || {});
    if (o.scope === 'all') st.days.slice().forEach((d) => removeDay(st, d.id));
    const idx = scheduleIndex(st);
    const pool = st.scenes.filter((s) => !idx.has(s.id));
    if (!pool.length) return 0;
    const pos = new Map(st.scenes.map((s, i) => [s.id, i]));
    let ordered;
    if (o.strategy === 'site') {
      const siteOrder = new Map();
      pool.forEach((s) => { const k = s.site || s.place || ''; if (!siteOrder.has(k)) siteOrder.set(k, siteOrder.size); });
      ordered = pool.slice().sort((a, b) => {
        const sa = siteOrder.get(a.site || a.place || ''), sb = siteOrder.get(b.site || b.place || '');
        if (sa !== sb) return sa - sb;
        const ca = todClass(a.tod) === 'day' ? 0 : 1, cb = todClass(b.tod) === 'day' ? 0 : 1;
        if (ca !== cb) return ca - cb;
        return pos.get(a.id) - pos.get(b.id);
      });
    } else ordered = pool.slice();
    if (o.separateNight) {
      const d = ordered.filter((s) => todClass(s.tod) === 'day'), n = ordered.filter((s) => todClass(s.tod) !== 'day');
      ordered = d.concat(n);
    }
    let cur = null, load = 0, cls = null, created = 0;
    const cap = maxEighths(st.meta);
    for (const sc of ordered) {
      const est = sc.eighths;
      const c = todClass(sc.tod);
      if (!cur || (load + est > cap && cur.sceneIds.length) || (o.separateNight && c !== cls)) {
        cur = addDay(st, 'shoot', { call: c === 'night' ? st.meta.callNight : st.meta.call });
        load = 0; cls = c; created++;
      }
      cur.sceneIds.push(sc.id);
      load += est;
    }
    return created;
  }

  /* ---------- statystyki dnia, ostrzeżenia ---------- */
  function dayStats(st, day) {
    const sm = sceneMap(st);
    const scs = day.sceneIds.map((id) => sm.get(id)).filter(Boolean);
    const eighths = scs.reduce((a, s) => a + s.eighths, 0);
    const sites = [...new Set(scs.map((s) => s.site || s.place).filter(Boolean))];
    const castIds = [...new Set(scs.flatMap((s) => s.cast))].sort((a, b) => a - b);
    const classes = new Set(scs.map((s) => todClass(s.tod)));
    return { scenes: scs, eighths, sites, castIds, mixed: classes.size > 1 };
  }
  function dayWarnings(st, day) {
    if (day.kind !== 'shoot') return [];
    const s = dayStats(st, day), w = [];
    if (s.eighths > maxEighths(st.meta)) w.push(`Plan dnia (${fmtEighths(s.eighths)} str.) przekracza limit ${+st.meta.pagesPerDay} str. na dzień`);
    if (s.mixed) w.push('Sceny dzienne i nocne w jednym dniu');
    if (s.sites.length >= 4) w.push(`${s.sites.length} ${s.sites.length < 5 ? 'różne obiekty' : 'różnych obiektów'} – uwzględnij przejazdy`);
    return w;
  }

  /* ---------- DOOD ---------- */
  function dood(st) {
    const shoot = st.days.filter((d) => d.kind === 'shoot');
    const sm = sceneMap(st);
    const days = shoot.map((d, i) => ({ no: i + 1, date: d.date, id: d.id }));
    const rows = [];
    for (const c of st.cast) {
      const work = shoot.map((d) => d.sceneIds.some((id) => { const s = sm.get(id); return s && s.cast.includes(c.id); }));
      const idxs = work.map((w, i) => (w ? i : -1)).filter((i) => i >= 0);
      const first = idxs.length ? idxs[0] : -1, last = idxs.length ? idxs[idxs.length - 1] : -1;
      const codes = work.map((w, i) => {
        if (w) return first === last ? 'SWF' : i === first ? 'SW' : i === last ? 'WF' : 'W';
        return first >= 0 && i > first && i < last ? 'H' : '';
      });
      rows.push({ id: c.id, name: c.name, actor: c.actor || '', codes, work: idxs.length, hold: codes.filter((x) => x === 'H').length, first: first >= 0 ? first + 1 : null, last: last >= 0 ? last + 1 : null });
    }
    return { days, rows };
  }

  /* ---------- dane do raportów ---------- */
  function sceneRow(st, sc, schedIdx) {
    const cm = castMap(st);
    const sch = schedIdx.get(sc.id);
    return {
      id: sc.id, num: sc.num, ie: sc.ie, ieLabel: IE_LABEL[sc.ie] || '', tod: sc.tod, todShort: (TOD[sc.tod] || {}).short || '', todLabel: (TOD[sc.tod] || {}).label || '',
      place: sc.place || sc.site, site: sc.site, synopsis: sc.synopsis || '', notes: sc.notes || '', castIds: sc.cast.slice().sort((a, b) => a - b),
      castText: sc.cast.slice().sort((a, b) => a - b).join(', '), castNames: sc.cast.map((id) => (cm.get(id) || {}).name).filter(Boolean),
      eighths: sc.eighths, pages: fmtEighths(sc.eighths), page: sc.page, bg: stripBg(sc), dayNo: sch ? sch.dayNo : null,
      elements: sc.elements || {},
    };
  }
  function reportData(st) {
    const idx = scheduleIndex(st);
    const sm = sceneMap(st), cm = castMap(st);
    const dn = dayNumbers(st);
    const days = st.days.map((d) => {
      const s = dayStats(st, d);
      return {
        id: d.id, kind: d.kind, no: dn.get(d.id), date: d.date, call: d.call, note: d.note,
        rows: s.scenes.map((sc) => sceneRow(st, sc, idx)), eighths: s.eighths, sites: s.sites,
        castIds: s.castIds, cast: s.castIds.map((id) => cm.get(id)).filter(Boolean), warnings: dayWarnings(st, d),
      };
    });
    const unscheduled = st.scenes.filter((s) => !idx.has(s.id)).map((s) => sceneRow(st, s, idx));
    const scenes = st.scenes.map((s) => sceneRow(st, s, idx));
    const shoot = days.filter((d) => d.kind === 'shoot');
    const cast = st.cast.map((c) => {
      const scs = st.scenes.filter((s) => s.cast.includes(c.id));
      const dayNos = [...new Set(scs.map((s) => (idx.get(s.id) || {}).dayNo).filter(Boolean))].sort((a, b) => a - b);
      return { id: c.id, name: c.name, actor: c.actor || '', notes: c.notes || '', scenes: scs.length, sceneNums: scs.map((s) => s.num), days: dayNos, eighths: scs.reduce((a, s) => a + s.eighths, 0) };
    });
    const siteMap = new Map();
    st.scenes.forEach((s) => {
      const k = s.site || s.place || '(bez nazwy)';
      if (!siteMap.has(k)) siteMap.set(k, []);
      siteMap.get(k).push(s);
    });
    Object.keys(st.sites || {}).forEach((k) => { if (st.sites[k] && st.sites[k].manual && !siteMap.has(k)) siteMap.set(k, []); });
    const sites = [...siteMap.entries()].map(([k, scs]) => ({
      site: k, address: (st.sites[k] || {}).address || '', notes: (st.sites[k] || {}).notes || '', scenes: scs.length, sceneNums: scs.map((s) => s.num),
      eighths: scs.reduce((a, s) => a + s.eighths, 0), days: [...new Set(scs.map((s) => (idx.get(s.id) || {}).dayNo).filter(Boolean))].sort((a, b) => a - b),
      places: [...new Set(scs.map((s) => s.place))],
    }));
    const totalEighths = st.scenes.reduce((a, s) => a + s.eighths, 0);
    const dates = shoot.map((d) => d.date).filter(Boolean).sort();
    return {
      meta: st.meta, days, unscheduled, scenes, cast, sites, dood: dood(st),
      totals: { scenes: st.scenes.length, eighths: totalEighths, shootDays: shoot.length, from: dates[0] || '', to: dates[dates.length - 1] || '', planned: st.scenes.length - unscheduled.length },
    };
  }

  /* ---------- plan pracy, transport, kosztorys ---------- */
  const BUDGET_CATS = [['pre', 'Preprodukcja'], ['crew', 'Ekipa'], ['cast', 'Obsada'], ['art', 'Scenografia / kostiumy'], ['gear', 'Sprzęt zdjęciowy / oświetlenie'], ['transport', 'Transport / logistyka'], ['post', 'Postprodukcja'], ['reserve', 'Rezerwa']];
  const VEHICLE_TYPES = ['Bus', 'Auto osobowe', 'Ciężarówka techniczna', 'Kamper / garderoba', 'Inny'];
  const timeToMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const minToTime = (n) => { n = ((Math.round(n) % 1440) + 1440) % 1440; return pad(Math.floor(n / 60)) + ':' + pad(n % 60); };
  const SHEET_FIELDS = { crewCall: '', sunrise: '', sunset: '', weather: '', hospital: '', cameraNotes: '', locations: null, transportNote: '', notes: '' };
  function sheetOf(st, dayId) {
    const day = st.days.find((d) => d.id === dayId);
    const sh = st.sheets[dayId] || {};
    return Object.assign({}, SHEET_FIELDS, { contacts: [], cast: {}, rows: [], synced: [] }, sh, { _day: day });
  }
  function ensureSheet(st, dayId) {
    if (!st.sheets[dayId]) st.sheets[dayId] = Object.assign({}, SHEET_FIELDS, { contacts: [], cast: {}, rows: null, synced: [] });
    const s = st.sheets[dayId]; s.contacts = s.contacts || []; s.cast = s.cast || {}; s.synced = s.synced || [];
    return s;
  }
  /** Domyślny opis sceny w harmonogramie: W/Z, pora, plan i opis */
  function sceneDesc(sc) {
    const head = `${IE_LABEL[sc.ie] || ''} ${(TOD[sc.tod] || {}).short || ''}.`.trim();
    const place = String(sc.place || sc.site || '').toUpperCase();
    return [head, place].filter(Boolean).join(' ') + (sc.synopsis ? ' – ' + sc.synopsis : '');
  }
  /** numery ujęć danej sceny z shotlisty */
  const shotsOf = (st, sceneId) => (st.shots || []).filter((x) => x.sceneId === sceneId);
  const customRow = (text, from, to) => ({ id: uid(), kind: 'custom', sceneId: '', from: from || '', to: to || '', num: '', shot: '', desc: text, cast: '', camera: '', notes: '' });
  /** Harmonogram dnia: wiersze scen są powiązane z kalendarzówką, wiersze własne dodaje użytkownik.
      force = dodaj z powrotem także sceny, których wiersz usunięto ręcznie. */
  function syncRows(st, day, sh, force) {
    const sm = sceneMap(st);
    const inDay = day.sceneIds.filter((id) => sm.has(id));
    const inSet = new Set(inDay);
    if (!Array.isArray(sh.rows)) {
      const old = sh.times || {};
      sh.rows = inDay.map((id) => ({ id: uid(), kind: 'scene', sceneId: id, from: old[id] || '', to: '', camera: '', notes: '' }));
      if (sh.lunch) sh.rows.push(customRow('Przerwa na obiad', sh.lunch));
      if (sh.wrap) sh.rows.push(customRow('Koniec zdjęć', sh.wrap));
      sh.synced = inDay.slice();
      delete sh.times; delete sh.lunch; delete sh.wrap; delete sh.firstShot;
      return sh;
    }
    sh.rows = sh.rows.filter((r) => r.kind !== 'scene' || inSet.has(r.sceneId));
    const have = new Set(sh.rows.filter((r) => r.kind === 'scene').map((r) => r.sceneId));
    const seen = new Set(sh.synced || []);
    let prev = null;
    inDay.forEach((id) => {
      if (!have.has(id) && (force || !seen.has(id))) {
        const row = { id: uid(), kind: 'scene', sceneId: id, from: '', to: '', camera: '', notes: '' };
        const pi = prev ? sh.rows.findIndex((r) => r.kind === 'scene' && r.sceneId === prev) : -1;
        if (pi >= 0) sh.rows.splice(pi + 1, 0, row); else sh.rows.push(row);
        have.add(id);
      }
      prev = id;
    });
    sh.synced = inDay.slice();
    return sh;
  }
  function syncSheet(st, dayId, force) {
    const day = st.days.find((d) => d.id === dayId);
    const sh = ensureSheet(st, dayId);
    if (day) syncRows(st, day, sh, force);
    return sh;
  }
  /** wiersze harmonogramu z uzupełnionymi wartościami domyślnymi (bez zmiany stanu) */
  function callRows(st, day) {
    const sh = JSON.parse(JSON.stringify(st.sheets[day.id] || {}));
    syncRows(st, day, sh);
    const sm = sceneMap(st);
    return sh.rows.map((r) => {
      const sc = r.kind === 'scene' ? sm.get(r.sceneId) : null;
      const def = sc ? { num: sc.num, desc: sceneDesc(sc), cast: sc.cast.slice().sort((a, b) => a - b).join(', '), shot: shotsOf(st, sc.id).map((x) => x.shot).filter(Boolean).join(', ') } : {};
      const pick = (k) => (r[k] != null ? r[k] : def[k] != null ? def[k] : '');
      return { id: r.id, kind: r.kind, sceneId: r.sceneId || '', from: r.from || '', to: r.to || '', num: pick('num'), shot: pick('shot'), desc: pick('desc'), cast: pick('cast'), camera: r.camera || '', notes: r.notes || '', bg: sc ? stripBg(sc) : '', eighths: sc ? sc.eighths : 0 };
    });
  }
  /** tekst lokacji w planie pracy: ręczny albo z listy obiektów dnia */
  function locationsText(st, day) {
    const sh = st.sheets[day.id] || {};
    if (typeof sh.locations === 'string') return sh.locations;
    return dayStats(st, day).sites.map((x) => x + ((st.sites[x] || {}).address ? ' – ' + st.sites[x].address : '')).join('\n');
  }
  const removeScenes = (st, ids) => {
    const set = new Set(ids);
    unassign(st, ids);
    st.scenes = st.scenes.filter((s) => !set.has(s.id));
    st.shots = (st.shots || []).filter((x) => !set.has(x.sceneId));
  };

  /* ---------- ekipa ---------- */
  const DEPTS = ['Reżyseria', 'Produkcja', 'Zdjęcia', 'Oświetlenie', 'Grip', 'Dźwięk', 'Scenografia', 'Kostiumy', 'Charakteryzacja', 'Obsada', 'Transport', 'Catering', 'Postprodukcja', 'Inne'];
  const CONTRACTS = ['Umowa o dzieło', 'Umowa zlecenie', 'Umowa o pracę', 'B2B / faktura', 'Wolontariat', 'Inna'];
  const newCrew = (o) => Object.assign({ id: uid(), first: '', last: '', dept: '', role: '', phone: '', contract: '', rate: '', lodging: '', diet: '', transport: '', notes: '' }, o || {});
  const crewName = (c) => [c.first, c.last].filter(Boolean).join(' ');
  /** ekipa pogrupowana po pionach (kolejność pionów jak w DEPTS, własne na końcu) */
  function crewGroups(st) {
    const map = new Map();
    st.crew.forEach((c) => { const k = (c.dept || '').trim() || 'Bez pionu'; if (!map.has(k)) map.set(k, []); map.get(k).push(c); });
    const rank = (k) => { const i = DEPTS.indexOf(k); return i >= 0 ? i : k === 'Bez pionu' ? 1000 : 500; };
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'pl')).map(([dept, list]) => ({ dept, list }));
  }

  /* ---------- shotlista ---------- */
  const SHOT_TYPES = [
    ['DET', 'Detal', 'Szczegół: oko, dłoń, przedmiot wypełnia kadr (Detail / ECU)'],
    ['CU', 'Zbliżenie', 'Twarz lub przedmiot, kadr od ramion w górę (Close-up)'],
    ['MCU', 'Półzbliżenie', 'Od piersi w górę (Medium close-up)'],
    ['MS', 'Plan średni', 'Postać od pasa w górę (Medium shot)'],
    ['MFS', 'Plan amerykański', 'Postać od kolan w górę (Medium full shot)'],
    ['FS', 'Plan pełny', 'Cała sylwetka z głową i stopami (Full shot)'],
    ['WS', 'Plan ogólny', 'Postać w szerokim otoczeniu, pokazuje miejsce akcji (Wide shot)'],
  ];
  const etaMin = (v) => {
    const s = String(v == null ? '' : v).trim().toLowerCase().replace(',', '.');
    if (!s) return null;
    let m = /^(\d+):(\d{1,2})$/.exec(s);
    if (m) return +m[1] * 60 + +m[2];
    m = /^(\d+(?:\.\d+)?)\s*h(?:\s*(\d+)\s*(?:m|min)?)?$/.exec(s);
    if (m) return Math.round(parseFloat(m[1]) * 60 + (m[2] ? +m[2] : 0));
    m = /^(\d+(?:\.\d+)?)\s*(?:m|min)?$/.exec(s);
    if (m) return Math.round(parseFloat(m[1]));
    return null;
  };
  /** ujęcia w kolejności scen (ujęcia bez sceny na końcu), z numerem sceny i dniem zdjęciowym */
  function shotRows(st) {
    const sm = sceneMap(st), idx = scheduleIndex(st), pos = new Map(st.scenes.map((s, i) => [s.id, i]));
    return (st.shots || []).map((x, i) => ({ x, i })).sort((a, b) => {
      const pa = pos.has(a.x.sceneId) ? pos.get(a.x.sceneId) : 1e9, pb = pos.has(b.x.sceneId) ? pos.get(b.x.sceneId) : 1e9;
      return pa - pb || a.i - b.i;
    }).map(({ x }) => {
      const sc = sm.get(x.sceneId), sch = sc ? idx.get(sc.id) : null;
      return Object.assign({}, x, { num: sc ? sc.num : '', dayNo: sch ? sch.dayNo : null, bg: sc ? stripBg(sc) : '', eta: x.eta || '', etaMin: etaMin(x.eta) });
    });
  }
  function nextShotNo(st, sceneId) {
    const nums = shotsOf(st, sceneId).map((x) => parseInt(x.shot, 10)).filter((n) => isFinite(n));
    return String((nums.length ? Math.max(...nums) : shotsOf(st, sceneId).length) + 1);
  }
  function newShot(st, sceneId) {
    const sc = sceneMap(st).get(sceneId);
    const cm = castMap(st);
    return { id: uid(), sceneId: sceneId || '', shot: sceneId ? nextShotNo(st, sceneId) : '', type: '', desc: '', lens: '', grip: '', eta: '', cast: sc ? sc.cast.map((id) => (cm.get(id) || {}).name).filter(Boolean).join(', ') : '', site: sc ? sc.site || sc.place || '' : '' };
  }

  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(/\s/g, '').replace(',', '.')); return isFinite(n) ? n : 0; };
  const fmtMoney = (n) => { n = Math.round((+n || 0) * 100) / 100; const neg = n < 0; const [i, f] = Math.abs(n).toFixed(2).split('.'); return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0') + ',' + f + '\u00a0zł'; };
  function budgetData(st) {
    const dn = dayNumbers(st), dm = new Map(st.days.map((d) => [d.id, d]));
    const cats = BUDGET_CATS.map(([k, label]) => {
      const items = st.budget.items.filter((i) => i.cat === k).map((i) => {
        const d = dm.get(i.dayId);
        return Object.assign({}, i, { est: num(i.est), act: num(i.act), dayNo: d && d.kind === 'shoot' ? dn.get(d.id) : null, date: d ? d.date : '' });
      });
      const est = items.reduce((a, i) => a + i.est, 0), act = items.reduce((a, i) => a + i.act, 0);
      const dev = items.reduce((a, i) => a + (i.act ? i.act - i.est : 0), 0);
      return { key: k, label, items, est, act, dev };
    });
    const est = cats.reduce((a, c) => a + c.est, 0), act = cats.reduce((a, c) => a + c.act, 0), dev = cats.reduce((a, c) => a + c.dev, 0);
    return { cats, est, act, dev };
  }
  function transportData(st, dayId) {
    const dn = dayNumbers(st), vm = new Map(st.transport.vehicles.map((v) => [v.id, v]));
    const trips = st.transport.trips.filter((t) => !dayId || t.dayId === dayId).map((t) => {
      const d = st.days.find((x) => x.id === t.dayId);
      return Object.assign({}, t, { dayNo: d ? dn.get(d.id) : null, date: d ? d.date : '', vehicle: vm.get(t.vehicleId) || null });
    }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
    return { vehicles: st.transport.vehicles, trips };
  }

  /* ---------- import scenariusza do stanu ---------- */
  const normName = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
  function applyImport(st, parsed, o) {
    o = o || {};
    const oldScenes = new Map();
    st.scenes.forEach((s) => oldScenes.set(String(s.num).toUpperCase(), s));
    // obsada
    const oldCast = new Map(st.cast.map((c) => [normName(c.name), c]));
    const newCast = [];
    const idOf = new Map();
    for (const pc of parsed.cast) {
      const key = normName(pc.name);
      let c = oldCast.get(key);
      if (!c) c = { id: st.nextCast++, name: pc.name, actor: '', notes: '' };
      newCast.push(c);
      idOf.set(key, c.id);
    }
    // postacie dodane ręcznie do scen zostają
    const keepIds = new Set();
    if (o.keep) st.scenes.forEach((s) => (s.manualCast || []).forEach((id) => keepIds.add(id)));
    st.cast.forEach((c) => { if (keepIds.has(c.id) && !newCast.some((n) => n.id === c.id)) newCast.push(c); });
    // sceny
    const scenes = parsed.scenes.map((p) => {
      const old = o.keep ? oldScenes.get(String(p.num).toUpperCase()) : null;
      const sc = {
        id: old ? old.id : uid(), num: p.num, ie: p.ie || 'INT', place: p.place, site: p.site || p.place, tod: p.tod || 'DAY', eighths: p.eighths, page: p.page || p.estPage || null,
        synopsis: old && old.synopsis ? old.synopsis : p.synopsis, notes: old ? old.notes : '', elements: old ? old.elements : {},
        text: p.text, heading: p.heading, cast: p.castNames.map((n) => idOf.get(normName(n))).filter((x) => x != null),
      };
      if (old && old.manualCast && old.manualCast.length) {
        sc.manualCast = old.manualCast.slice();
        old.manualCast.forEach((id) => { if (!sc.cast.includes(id)) sc.cast.push(id); });
      }
      return sc;
    });
    const ids = new Set(scenes.map((s) => s.id));
    st.days.forEach((d) => { d.sceneIds = d.sceneIds.filter((id) => ids.has(id)); });
    st.scenes = scenes;
    st.cast = newCast;
    scenes.forEach((s) => { const k = s.site || s.place; if (k && !st.sites[k]) st.sites[k] = { address: '', notes: '' }; });
    if (o.title && !st.meta.title) st.meta.title = o.title;
    if (parsed.stats && parsed.stats.linesPerPage) st.meta.linesPerPage = parsed.stats.linesPerPage;
    if (o.file) st.meta.scriptFile = o.file;
    return st;
  }

  function renameSite(st, from, to) {
    to = String(to).trim().toUpperCase();
    if (!to || to === from) return;
    st.scenes.forEach((s) => { if ((s.site || s.place) === from) s.site = to; });
    const old = st.sites[from];
    if (old) { st.sites[to] = st.sites[to] ? Object.assign({}, old, st.sites[to]) : old; delete st.sites[from]; }
    else if (!st.sites[to]) st.sites[to] = { address: '', notes: '' };
  }
  function mergeCast(st, fromId, toId) {
    if (fromId === toId) return;
    st.scenes.forEach((s) => {
      if (s.cast.includes(fromId)) { s.cast = s.cast.filter((x) => x !== fromId); if (!s.cast.includes(toId)) s.cast.push(toId); }
    });
    st.cast = st.cast.filter((c) => c.id !== fromId);
  }
  function removeCast(st, id) {
    st.scenes.forEach((s) => { s.cast = s.cast.filter((x) => x !== id); });
    st.cast = st.cast.filter((c) => c.id !== id);
  }

  return {
    uid, TOD, IE_LABEL, ELEMENT_CATS, STRIP, stripKey, stripBg, todClass,
    parseISO, isoOf, addDays, dow, fmtDatePL, fmtShort, fmtDM, todayISO, nextMonday, MONTHS_NOM, MONTHS_GEN, DAYS_PL, DAYS_SHORT,
    pl, fmtEighths, fmtDur, fmtHM, newState, normalize, maxEighths, castMap, sceneMap, scheduleIndex, dayNumbers,
    unassign, assign, nextWorkDate, newDayDate, addDay, recalcDates, removeDay, moveDay, autoPlan, dayStats, dayWarnings, dood, reportData,
    BUDGET_CATS, VEHICLE_TYPES, timeToMin, minToTime, sheetOf, ensureSheet, syncRows, syncSheet, callRows, customRow, sceneDesc, shotsOf, locationsText, removeScenes,
    DEPTS, CONTRACTS, newCrew, crewName, crewGroups, SHOT_TYPES, etaMin, shotRows, nextShotNo, newShot, num, fmtMoney, budgetData, transportData,
    applyImport, renameSite, mergeCast, removeCast, weekdaysOf, lastDate, normName,
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
