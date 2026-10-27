// @ts-nocheck
/* Moduł przeniesiony z wersji 1.x (logika bez zmian). */
import { I18N, T, T_ } from './i18n';
import { isDraft } from 'immer';
/* ===== RDZEŃ: model danych, daty, planowanie, harmonogram, DOOD, catering, dane do raportów ===== */
const Core = (() => {
  const uid = () => Math.random().toString(36).slice(2, 10);
  const EN = () => I18N.lang === 'en';

  /* ---------- etykiety zależne od języka ---------- */
  const TODL = {
    DAY: ['DZIEŃ', 'D', 'DAY', 'D'], NIGHT: ['NOC', 'N', 'NIGHT', 'N'], DAWN: ['ŚWIT', 'Ś', 'DAWN', 'DW'], DUSK: ['ZMIERZCH', 'Z', 'DUSK', 'DK'],
  };
  const TOD = {};
  Object.keys(TODL).forEach((k) => { TOD[k] = { get label() { return TODL[k][EN() ? 2 : 0]; }, get short() { return TODL[k][EN() ? 3 : 1]; } }; });
  const IEL = { INT: ['WN.', 'INT.'], EXT: ['ZN.', 'EXT.'], 'INT/EXT': ['WN./ZN.', 'INT./EXT.'], '': ['—', '—'] };
  const IE_LABEL = {};
  Object.keys(IEL).forEach((k) => { Object.defineProperty(IE_LABEL, k, { enumerable: true, get() { return IEL[k][EN() ? 1 : 0]; } }); });
  const ELEMENT_CATS = [
    ['extras', T_('Statyści')], ['props', T_('Rekwizyty')], ['wardrobe', T_('Kostiumy')], ['makeup', T_('Charakteryzacja')],
    ['vehicles', T_('Pojazdy')], ['sfx', T_('Efekty specjalne')], ['stunts', T_('Kaskaderzy / akcja')], ['setdress', T_('Scenografia')],
    ['animals', T_('Zwierzęta')], ['sound', T_('Dźwięk / muzyka')], ['other', T_('Inne')],
  ];
  const STRIPN = {
    'INT-DAY': ['FFFFFF', T_('Wnętrze, dzień')], 'EXT-DAY': ['FFF1A6', T_('Plener, dzień')], 'INT-NIGHT': ['BCD6F7', T_('Wnętrze, noc')],
    'EXT-NIGHT': ['BFE5B5', T_('Plener, noc')], 'INT-TWI': ['F7CBC1', T_('Wnętrze, świt/zmierzch')], 'EXT-TWI': ['F9D3A1', T_('Plener, świt/zmierzch')],
  };
  const STRIP = {};
  Object.keys(STRIPN).forEach((k) => { STRIP[k] = { bg: STRIPN[k][0], get name() { return T(STRIPN[k][1]); } }; });
  function stripKey(sc) {
    const ext = sc.ie === 'EXT' || sc.ie === 'INT/EXT';
    const t = sc.tod === 'NIGHT' ? 'NIGHT' : sc.tod === 'DAWN' || sc.tod === 'DUSK' ? 'TWI' : 'DAY';
    return (ext ? 'EXT' : 'INT') + '-' + t;
  }
  const stripBg = (sc) => STRIP[stripKey(sc)].bg;
  const todClass = (tod) => (tod === 'DAY' || !tod ? 'day' : 'night');

  /* ---------- dni: rodzaje ---------- */
  const DAY_KINDS = [
    ['shoot', T_('Dzień zdjęciowy')], ['travel', T_('Przerzut (dzień przejazdowy)')], ['prelight', T_('Prelight')], ['build', T_('Budowa dekoracji')], ['off', T_('Dzień wolny')],
  ];
  const KIND_TAG = { shoot: 'D', travel: T_('PRZERZUT'), prelight: T_('PRELIGHT'), build: T_('BUDOWA'), off: T_('WOLNY') };
  const KIND_NAME = { travel: T_('Przerzut'), prelight: T_('Prelight'), build: T_('Budowa dekoracji'), off: T_('Dzień wolny') };
  const KIND_BG = { travel: '9C6B1E', prelight: '6B4FA3', build: 'B5562A', off: '8A949D', shoot: '26323B' };
  const isSpecial = (k) => k === 'travel' || k === 'prelight' || k === 'build';
  const isWork = (d) => !!d && d.kind !== 'off';

  /* ---------- daty (UTC, bez stref czasowych) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const isoOf = (d) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
  const addDays = (iso, n) => { const d = parseISO(iso); d.setUTCDate(d.getUTCDate() + n); return isoOf(d); };
  const dow = (iso) => parseISO(iso).getUTCDay();
  const dayIndex = (iso) => Math.round(parseISO(iso).getTime() / 86400000);
  const MONTHS_GEN_PL = ['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'];
  const MONTHS_NOM_PL = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
  const MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const DAYS_PL = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
  const DAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const DAYS_SHORT_PL = ['ndz', 'pon', 'wt', 'śr', 'czw', 'pt', 'sob'];
  const DAYS_SHORT_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmtDatePL = (iso) => {
    if (!iso) return '';
    const d = parseISO(iso);
    if (EN()) return `${DAYS_EN[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_EN[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
    return `${DAYS_PL[d.getUTCDay()]}, ${d.getUTCDate()} ${MONTHS_GEN_PL[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  };
  const dayName = (iso) => (iso ? (EN() ? DAYS_EN : DAYS_PL)[dow(iso)] : '');
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
  const pl = (n, one, few, many) => I18N.plural(n, one, few, many);
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
      v: 2,
      meta: {
        title: '', company: '', director: '', producer: '', manager: '', scriptVersion: '', scriptDate: '', scriptFile: '',
        startDate: nextMonday(todayISO()), weekdays: [1, 2, 3, 4, 5], pagesPerDay: 5, call: '07:00', callNight: '17:00',
        linesPerPage: 55, castMode: 'all', maxWorkH: 12, minRestH: 11, docLang: '',
      },
      scenes: [], cast: [], days: [], sites: {}, nextCast: 1,
      sheets: {}, transport: { vehicles: [], trips: [] }, budget: { items: [], rates: {}, autoRates: true, currency: 'PLN', fx: null }, todos: [], crew: [], shots: [], media: {},
      catering: { cast: true, extra: {} },
    };
  }
  const DIET_GUESS = [[/wega[nń]/i, 'vegan'], [/wegetaria|vegetaria|wege\b|veg\b/i, 'veg'], [/gluten/i, 'gf'], [/laktoz|lactose/i, 'lf'], [/pesc|ryb|fish/i, 'fish']];
  function migrateCrew(c) {
    const x = Object.assign({ id: uid(), first: '', last: '', dept: '', role: '', phone: '', email: '', contract: '', rate: '', lodging: '', dietType: '', dietNote: '', transport: '', notes: '', skip: [], extra: [] }, c);
    if (x.diet != null) {
      const txt = String(x.diet || '').trim();
      if (!x.dietType) {
        const hit = DIET_GUESS.find(([re]) => re.test(txt));
        x.dietType = hit ? hit[1] : 'meat';
        if (!hit && txt) x.dietNote = x.dietNote || txt;
        else if (hit && txt && !/^(wegetariańska|wegańska|bez glutenu|bezglutenowa|bez laktozy)$/i.test(txt)) x.dietNote = x.dietNote || txt;
      }
      delete x.diet;
    }
    if (!x.dietType) x.dietType = 'meat';
    if (!Array.isArray(x.skip)) x.skip = [];
    if (!Array.isArray(x.extra)) x.extra = [];
    return x;
  }
  /** stare harmonogramy (godziny od–do) zamieniamy na czas trwania i przestawki */
  function migrateSheet(st, day, sh) {
    if (!sh || sh.v >= 2) return;
    const start0 = timeToMin(sh.crewCall) != null ? timeToMin(sh.crewCall) : timeToMin((day && day.call) || st.meta.call);
    if (Array.isArray(sh.rows)) {
      let prevEnd = start0;
      sh.rows.forEach((r, i) => {
        const f = timeToMin(r.from), to = timeToMin(r.to);
        if (f != null) {
          let end = to;
          if (end == null) {
            const nx = sh.rows.slice(i + 1).map((x) => timeToMin(x.from)).find((x) => x != null);
            end = nx != null && nx >= f ? nx : f;
          }
          if (end < f) end += 1440;
          r.dur = end - f;
          if (prevEnd != null && f >= prevEnd) { r.prep = f - prevEnd || null; r.fix = ''; } else r.fix = r.from;
          prevEnd = f + r.dur;
        } else { if (r.dur === undefined) r.dur = null; if (r.prep === undefined) r.prep = null; r.fix = r.fix || ''; }
        delete r.from; delete r.to;
      });
    }
    sh.v = 2;
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
    st.cast = (st.cast || []).map((c) => castEntry(c));
    st.days = (st.days || []).map((d) => Object.assign({ id: uid(), kind: 'shoot', date: '', call: '', end: '', site: '', note: '', sceneIds: [] }, d));
    st.days.forEach((d) => { if (!['shoot', 'off', 'travel', 'prelight', 'build'].includes(d.kind)) d.kind = 'shoot'; if (d.kind !== 'shoot') d.sceneIds = []; });
    st.sites = st.sites || {};
    Object.keys(st.sites).forEach((k) => { st.sites[k] = siteEntry(st.sites[k]); });
    st.sheets = st.sheets || {};
    st.transport = Object.assign({ vehicles: [], trips: [] }, st.transport || {});
    st.budget = Object.assign({ items: [], rates: {}, autoRates: true, currency: 'PLN', fx: null }, st.budget || {});
    if (!CURRENCIES[st.budget.currency]) st.budget.currency = 'PLN';
    if (!st.budget.fx || typeof st.budget.fx !== 'object' || !st.budget.fx.pln) st.budget.fx = null;
    if (!st.budget.rates || typeof st.budget.rates !== 'object') st.budget.rates = {};
    st.comments = Array.isArray(st.comments) ? st.comments.filter((x) => x && typeof x === 'object' && x.id && typeof x.text === 'string').map((x) => Object.assign({ at: 0, by: '', name: '', ref: 'general', mentions: [], done: false }, x)) : [];
    st.todos = Array.isArray(st.todos) ? st.todos.filter((x) => x && typeof x === 'object').map((x) => Object.assign({ id: uid(), text: '', done: false, due: '', prio: '' }, x)) : [];
    st.crew = (Array.isArray(st.crew) ? st.crew : []).map(migrateCrew);
    st.crew.forEach((c) => {
      // wcześniejszy zapis: lista dni pracy -> wyjątki (odznaczone dni zdjęciowe, dodane dni specjalne)
      if (Array.isArray(c.days)) {
        const set = new Set(c.days);
        c.skip = st.days.filter((d) => d.kind === 'shoot' && !set.has(d.id)).map((d) => d.id);
        c.extra = st.days.filter((d) => isSpecial(d.kind) && set.has(d.id)).map((d) => d.id);
      }
      delete c.days;
    });
    st.shots = Array.isArray(st.shots) ? st.shots : [];
    st.media = st.media && typeof st.media === 'object' ? st.media : {};
    st.catering = Object.assign({ cast: true, extra: {} }, st.catering || {});
    st.catering.extra = st.catering.extra || {};
    st.dpr = st.dpr && typeof st.dpr === 'object' ? st.dpr : {};
    st.nextCast = st.nextCast || (st.cast.reduce((a, c) => Math.max(a, c.id), 0) + 1);
    const dm = new Map(st.days.map((d) => [d.id, d]));
    Object.keys(st.sheets).forEach((id) => {
      const sh = st.sheets[id];
      migrateSheet(st, dm.get(id), sh);
      sh.maps = Array.isArray(sh.maps) ? sh.maps.filter((m) => m && st.media[m.media]) : [];
    });
    st.v = 2;
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
  /** krótki znacznik dnia: D3, PRZERZUT, PRELIGHT… */
  const dayTag = (d, nums) => (!d ? '' : d.kind === 'shoot' ? 'D' + (nums.get(d.id) || '') : T(KIND_TAG[d.kind] || ''));
  /** nazwa dnia: Dzień 3, Prelight, Dzień wolny */
  const dayTitle = (d, nums) => (!d ? '' : d.kind === 'shoot' ? T('Dzień {n}', { n: nums.get(d.id) || '' }) : T(KIND_NAME[d.kind] || ''));
  const kindLabel = (k) => T((DAY_KINDS.find((x) => x[0] === k) || ['', ''])[1]);

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
    kind = kind || 'shoot';
    const d = Object.assign({ id: uid(), kind, date: newDayDate(st, kind), call: kind === 'off' ? '' : st.meta.call, end: '', site: '', note: '', sceneIds: [] }, extra || {});
    st.days.push(d);
    return d;
  }
  /** zmiana rodzaju dnia; zwraca liczbę scen, które wróciły do puli */
  function setDayKind(st, dayId, kind) {
    const d = st.days.find((x) => x.id === dayId);
    if (!d || d.kind === kind) return 0;
    const n = kind === 'shoot' ? 0 : d.sceneIds.length;
    if (kind !== 'shoot') d.sceneIds = [];
    if (kind !== 'off' && !d.call) d.call = st.meta.call;
    d.kind = kind;
    return n;
  }
  function recalcDates(st) {
    let cursor = addDays(st.meta.startDate, -1);
    for (const d of st.days) {
      if (d.kind === 'off') cursor = addDays(cursor, 1);
      else cursor = nextWorkDate(cursor, st.meta);
      d.date = cursor;
    }
  }
  function removeDay(st, dayId) {
    const sh = st.sheets && st.sheets[dayId];
    if (sh && sh.maps) sh.maps.forEach((m) => { delete st.media[m.media]; });
    st.days = st.days.filter((d) => d.id !== dayId);
    if (st.sheets) delete st.sheets[dayId];
    if (st.transport) st.transport.trips = st.transport.trips.filter((t) => t.dayId !== dayId);
    if (st.budget) st.budget.items.forEach((i) => { if (i.dayId === dayId) i.dayId = ''; });
    (st.crew || []).forEach((c) => { c.skip = (c.skip || []).filter((x) => x !== dayId); c.extra = (c.extra || []).filter((x) => x !== dayId); });
    if (st.catering && st.catering.extra) delete st.catering.extra[dayId];
  }
  function moveDay(st, dayId, dir) {
    const i = st.days.findIndex((d) => d.id === dayId), j = i + dir;
    if (i < 0 || j < 0 || j >= st.days.length) return;
    [st.days[i], st.days[j]] = [st.days[j], st.days[i]];
  }

  /** czas zdjęć sceny w minutach: suma czasów ujęć z shotlisty (+ przestawka); bez ujęć z czasem – z liczby ósemek stron */
  function sceneMinutes(st, sc, o) {
    o = o || {};
    const times = shotsOf(st, sc.id).map((x) => etaMin(x.eta));
    const known = times.filter((t) => t != null);
    const base = known.length ? known.reduce((a, t) => a + t, 0) : Math.round(sc.eighths * (+o.perEighth || 12));
    return base + (o.move != null ? +o.move : 15);
  }
  /** ile scen z puli nie ma ujęć z czasem (plan z shotlisty policzy je ze stron) */
  function scenesWithoutEta(st, scenes) {
    return scenes.filter((sc) => !shotsOf(st, sc.id).some((x) => etaMin(x.eta) != null)).length;
  }
  function autoPlan(st, o) {
    o = Object.assign({ strategy: 'site', scope: 'unscheduled', separateNight: true, basis: 'pages', hours: 8, move: 15, perEighth: 12 }, o || {});
    if (o.scope === 'all') st.days.filter((d) => d.kind === 'shoot').forEach((d) => removeDay(st, d.id));
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
    const byShots = o.basis === 'shots';
    const cap = byShots ? Math.max(30, Math.round((+o.hours || 8) * 60)) : maxEighths(st.meta);
    for (const sc of ordered) {
      const est = byShots ? sceneMinutes(st, sc, o) : sc.eighths;
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
  /** ostrzeżenia dnia; hrs = wynik hoursCheck(st) (opcjonalnie, żeby nie liczyć go dla każdego dnia osobno) */
  function dayWarnings(st, day, hrs) {
    const w = [];
    if (day.kind === 'shoot') {
      const s = dayStats(st, day);
      if (s.eighths > maxEighths(st.meta)) w.push(T('Plan dnia ({p} str.) przekracza limit {max} str. na dzień', { p: fmtEighths(s.eighths), max: +st.meta.pagesPerDay }));
      if (s.mixed) w.push(T('Sceny dzienne i nocne w jednym dniu'));
      if (s.sites.length >= 4) w.push(T('{n} różnych obiektów – uwzględnij przejazdy', { n: s.sites.length }));
      s.sites.forEach((x) => { const c = (st.sites[x] || {}).contract; if (contractOpen(c)) w.push(T('Lokacja {s}: umowa – {c}', { s: x, c: contractLabel(c).toLowerCase() })); });
    }
    const h = (hrs || hoursCheck(st)).get(day.id);
    if (h) h.alerts.forEach((a) => w.push(a.text));
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
    const cm = castMap(st);
    const dn = dayNumbers(st);
    const hrs = hoursCheck(st);
    const days = st.days.map((d) => {
      const s = dayStats(st, d);
      const h = hrs.get(d.id);
      return {
        id: d.id, kind: d.kind, no: dn.get(d.id), tag: dayTag(d, dn), title: dayTitle(d, dn), date: d.date, call: d.call, end: d.end || '', site: d.site || '', note: d.note,
        rows: s.scenes.map((sc) => sceneRow(st, sc, idx)), eighths: s.eighths, sites: s.sites,
        castIds: s.castIds, cast: s.castIds.map((id) => cm.get(id)).filter(Boolean), warnings: dayWarnings(st, d, hrs), hours: h || null,
      };
    });
    const unscheduled = st.scenes.filter((s) => !idx.has(s.id)).map((s) => sceneRow(st, s, idx));
    const scenes = st.scenes.map((s) => sceneRow(st, s, idx));
    const shoot = days.filter((d) => d.kind === 'shoot');
    const special = days.filter((d) => isSpecial(d.kind));
    const cast = st.cast.map((c) => {
      const scs = st.scenes.filter((s) => s.cast.includes(c.id));
      const dayNos = [...new Set(scs.map((s) => (idx.get(s.id) || {}).dayNo).filter(Boolean))].sort((a, b) => a - b);
      return { id: c.id, name: c.name, actor: c.actor || '', notes: c.notes || '', phone: c.phone || '', email: c.email || '', contract: c.contract || '', rate: c.rate || '', lodging: c.lodging || '', diet: c.diet || 'meat', dietNote: c.dietNote || '', transport: c.transport || '', scenes: scs.length, sceneNums: scs.map((s) => s.num), days: dayNos, eighths: scs.reduce((a, s) => a + s.eighths, 0) };
    });
    const siteMap = new Map();
    st.scenes.forEach((s) => {
      const k = s.site || s.place || '(bez nazwy)';
      if (!siteMap.has(k)) siteMap.set(k, []);
      siteMap.get(k).push(s);
    });
    Object.keys(st.sites || {}).forEach((k) => { if (st.sites[k] && st.sites[k].manual && !siteMap.has(k)) siteMap.set(k, []); });
    const sites = [...siteMap.entries()].map(([k, scs]) => ({
      ...siteEntry(st.sites[k]), site: k, scenes: scs.length, sceneNums: scs.map((s) => s.num),
      eighths: scs.reduce((a, s) => a + s.eighths, 0), days: [...new Set(scs.map((s) => (idx.get(s.id) || {}).dayNo).filter(Boolean))].sort((a, b) => a - b),
      places: [...new Set(scs.map((s) => s.place))],
    }));
    const totalEighths = st.scenes.reduce((a, s) => a + s.eighths, 0);
    const dates = shoot.map((d) => d.date).filter(Boolean).sort();
    return {
      meta: st.meta, days, unscheduled, scenes, cast, sites, dood: dood(st),
      totals: { scenes: st.scenes.length, eighths: totalEighths, shootDays: shoot.length, specialDays: special.length, from: dates[0] || '', to: dates[dates.length - 1] || '', planned: st.scenes.length - unscheduled.length },
    };
  }

  /* ---------- plan pracy: harmonogram liczony z czasów trwania ---------- */
  const BUDGET_CATS = [['pre', T_('Preprodukcja')], ['crew', T_('Ekipa')], ['cast', T_('Obsada')], ['site', T_('Lokacje')], ['art', T_('Scenografia / kostiumy')], ['gear', T_('Sprzęt zdjęciowy / oświetlenie')], ['transport', T_('Transport / logistyka')], ['post', T_('Postprodukcja')], ['reserve', T_('Rezerwa')]];
  const VEHICLE_TYPES = ['Bus', 'Auto osobowe', 'Ciężarówka techniczna', 'Kamper / garderoba', 'Inny'];
  const timeToMin = (t) => { const m = /^(\d{1,2}):(\d{2})$/.exec(t || ''); return m ? (+m[1]) * 60 + (+m[2]) : null; };
  const minToTime = (n) => { n = ((Math.round(n) % 1440) + 1440) % 1440; return pad(Math.floor(n / 60)) + ':' + pad(n % 60); };
  /** godzina z oznaczeniem następnego dnia: 01:30 (+1) */
  const clock = (n) => minToTime(n) + (n >= 1440 ? ' (+1)' : '');
  /** czas trwania w minutach: 45, 45 min, 0:45, 1h, 1h30, 1,5 h */
  const etaMin = (v) => {
    if (typeof v === 'number') return isFinite(v) ? Math.max(0, Math.round(v)) : null;
    const s = String(v == null ? '' : v).trim().toLowerCase().replace(',', '.');
    if (!s) return null;
    let m = /^(\d+):(\d{1,2})$/.exec(s);
    if (m) return +m[1] * 60 + +m[2];
    m = /^(\d+(?:\.\d+)?)\s*(?:h|godz\.?|g)(?:\s*(\d+)\s*(?:m|min)?)?$/.exec(s);
    if (m) return Math.round(parseFloat(m[1]) * 60 + (m[2] ? +m[2] : 0));
    m = /^(\d+(?:\.\d+)?)\s*(?:m|min)?$/.exec(s);
    if (m) return Math.round(parseFloat(m[1]));
    return null;
  };
  const SHEET_FIELDS = { crewCall: '', sunrise: '', sunset: '', weather: '', hospital: '', cameraNotes: '', locations: null, transportNote: '', notes: '' };
  function sheetOf(st, dayId) {
    const day = st.days.find((d) => d.id === dayId);
    const sh = st.sheets[dayId] || {};
    return Object.assign({}, SHEET_FIELDS, { contacts: [], cast: {}, rows: [], synced: [], mode: 'calendar', srows: null, maps: [] }, sh, { _day: day });
  }
  function ensureSheet(st, dayId) {
    if (!st.sheets[dayId]) st.sheets[dayId] = Object.assign({}, SHEET_FIELDS, { v: 2, contacts: [], cast: {}, rows: null, synced: [], mode: 'calendar', srows: null, maps: [] });
    const s = st.sheets[dayId]; s.contacts = s.contacts || []; s.cast = s.cast || {}; s.synced = s.synced || []; s.maps = s.maps || []; s.v = s.v || 2;
    return s;
  }
  /** Domyślny opis sceny w harmonogramie: W/Z, pora, plan i opis */
  function sceneDesc(sc) {
    const head = `${IE_LABEL[sc.ie] || ''} ${(TOD[sc.tod] || {}).short || ''}.`.trim();
    const place = String(sc.place || sc.site || '').toUpperCase();
    return [head, place].filter(Boolean).join(' ') + (sc.synopsis ? ' – ' + sc.synopsis : '');
  }
  const shotsOf = (st, sceneId) => (st.shots || []).filter((x) => x.sceneId === sceneId);
  const shotEta = (st, sceneId) => { const xs = shotsOf(st, sceneId).map((x) => etaMin(x.eta)).filter((n) => n != null); return xs.length ? xs.reduce((a, b) => a + b, 0) : null; };
  const baseRow = (o) => Object.assign({ id: uid(), kind: 'custom', sceneId: '', shotId: '', fix: '', dur: null, prep: null, num: null, shot: null, desc: null, cast: null, camera: '', notes: '' }, o || {});
  /** własna pozycja harmonogramu: opis, czas trwania (min), przestawka przed (min), stała godzina startu */
  const customRow = (text, dur, prep, fix) => baseRow({ kind: 'custom', desc: text || '', num: '', shot: '', cast: '', dur: dur == null ? null : dur, prep: prep == null ? null : prep, fix: fix || '' });
  const sceneRowOf = (sceneId) => baseRow({ kind: 'scene', sceneId });
  const shotRowOf = (x, prep) => baseRow({ kind: 'shot', sceneId: x.sceneId || '', shotId: x.id, camera: null, prep: prep == null ? null : prep });
  /** Harmonogram dnia (tryb kalendarzówki): wiersze scen są powiązane z kalendarzówką, wiersze własne dodaje użytkownik.
      force = dodaj z powrotem także sceny, których wiersz usunięto ręcznie. */
  function syncRows(st, day, sh, force) {
    const sm = sceneMap(st);
    const inDay = day.sceneIds.filter((id) => sm.has(id));
    const inSet = new Set(inDay);
    if (!Array.isArray(sh.rows)) {
      sh.rows = inDay.map((id) => sceneRowOf(id));
      sh.synced = inDay.slice();
    } else {
      sh.rows = sh.rows.filter((r) => r.kind !== 'scene' || inSet.has(r.sceneId));
      const have = new Set(sh.rows.filter((r) => r.kind === 'scene').map((r) => r.sceneId));
      const seen = new Set(sh.synced || []);
      let prev = null;
      inDay.forEach((id) => {
        if (!have.has(id) && (force || !seen.has(id))) {
          const row = sceneRowOf(id);
          const pi = prev ? sh.rows.findIndex((r) => r.kind === 'scene' && r.sceneId === prev) : -1;
          if (pi >= 0) sh.rows.splice(pi + 1, 0, row); else sh.rows.push(row);
          have.add(id);
        }
        prev = id;
      });
      sh.synced = inDay.slice();
    }
    if (Array.isArray(sh.srows)) {
      const shotIds = new Set((st.shots || []).map((x) => x.id));
      sh.srows = sh.srows.filter((r) => (r.kind === 'shot' ? shotIds.has(r.shotId) : r.kind === 'scene' ? sm.has(r.sceneId) : true));
    }
    return sh;
  }
  function syncSheet(st, dayId, force) {
    const day = st.days.find((d) => d.id === dayId);
    const sh = ensureSheet(st, dayId);
    if (day) syncRows(st, day, sh, force);
    return sh;
  }
  /** pierwszy raz w trybie shotlisty: sceny zastępujemy ich ujęciami, własne pozycje zostają */
  function initShotRows(st, dayId) {
    const sh = syncSheet(st, dayId);
    const out = [];
    sh.rows.forEach((r) => {
      if (r.kind === 'scene') {
        const xs = shotsOf(st, r.sceneId);
        if (xs.length) xs.forEach((x, i) => out.push(shotRowOf(x, i === 0 ? r.prep : null)));
        else out.push(Object.assign({}, r, { id: uid() }));
      } else out.push(Object.assign({}, r, { id: uid() }));
    });
    sh.srows = out;
    return sh;
  }
  function setSheetMode(st, dayId, mode) {
    const sh = syncSheet(st, dayId);
    sh.mode = mode === 'shots' ? 'shots' : 'calendar';
    if (sh.mode === 'shots' && !Array.isArray(sh.srows)) initShotRows(st, dayId);
    return sh;
  }
  /** aktywna lista wierszy (do edycji) */
  function activeRows(st, dayId) {
    const sh = syncSheet(st, dayId);
    if (sh.mode === 'shots') { if (!Array.isArray(sh.srows)) initShotRows(st, dayId); return sh.srows; }
    return sh.rows;
  }
  const dayStart = (st, day, sh) => {
    const a = timeToMin((sh || {}).crewCall), b = timeToMin(day && day.call), c = timeToMin(st.meta.call);
    return a != null ? a : b != null ? b : c != null ? c : 420;
  };
  /** wiersze harmonogramu z wartościami domyślnymi i wyliczonymi godzinami (bez zmiany stanu) */
  function callRows(st, day) {
    const sh = JSON.parse(JSON.stringify(st.sheets[day.id] || {}));
    migrateSheet(st, day, sh);
    syncRows(st, day, sh);
    const mode = sh.mode === 'shots' ? 'shots' : 'calendar';
    let list = sh.rows;
    if (mode === 'shots') {
      if (!Array.isArray(sh.srows)) {
        const tmp = { sheets: { [day.id]: sh }, days: [day], scenes: st.scenes, shots: st.shots, meta: st.meta };
        sh.srows = initShotRows(tmp, day.id).srows;
      }
      list = sh.srows;
    }
    const sm = sceneMap(st), xm = new Map((st.shots || []).map((x) => [x.id, x]));
    let t = dayStart(st, day, sh);
    return list.map((r) => {
      const x = r.kind === 'shot' ? xm.get(r.shotId) : null;
      const sc = r.kind === 'scene' ? sm.get(r.sceneId) : x ? sm.get(x.sceneId) : null;
      let def = {};
      if (r.kind === 'scene' && sc) def = { num: sc.num, desc: sceneDesc(sc), cast: sc.cast.slice().sort((a, b) => a - b).join(', '), shot: shotsOf(st, sc.id).map((y) => y.shot).filter(Boolean).join(', '), camera: '', dur: shotEta(st, sc.id) };
      else if (x) def = { num: sc ? sc.num : '', shot: x.shot || '', desc: [x.type, x.desc].filter(Boolean).join(' – '), cast: x.cast || '', camera: [x.lens, x.grip].filter(Boolean).join(', '), dur: etaMin(x.eta) };
      const pick = (k) => (r[k] != null ? r[k] : def[k] != null ? def[k] : '');
      const durSet = r.dur != null && r.dur !== '';
      const dur = durSet ? Math.max(0, +r.dur || 0) : def.dur != null ? def.dur : 0;
      const prep = Math.max(0, +r.prep || 0);
      t += prep;
      let overlap = false, gap = 0, fixed = false;
      const f0 = timeToMin(r.fix);
      if (f0 != null) {
        let f = f0;
        while (f < t - 720) f += 1440;
        if (f < t) overlap = true; else gap = f - t;
        t = f; fixed = true;
      }
      const from = t, to = t + dur;
      t = to;
      return {
        id: r.id, kind: r.kind, sceneId: (sc && sc.id) || r.sceneId || '', shotId: r.shotId || '', fix: r.fix || '', fixed, overlap, gap,
        dur, durSet, durDef: def.dur != null ? def.dur : null, prep, prepSet: r.prep != null && r.prep !== '',
        fromMin: from, toMin: to, from: minToTime(from), to: minToTime(to), nextDay: to >= 1440,
        num: pick('num'), shot: pick('shot'), desc: pick('desc'), cast: pick('cast'), camera: pick('camera'), notes: r.notes || '',
        bg: sc ? stripBg(sc) : '', eighths: r.kind === 'scene' && sc ? sc.eighths : 0, missing: (r.kind === 'shot' && !x) || (r.kind === 'scene' && !sc),
      };
    });
  }
  /** przerwa obiadowa z harmonogramu dnia: pierwsza pozycja z „obiad / lunch / posiłek” w opisie */
  const LUNCH_RE = /obiad|lunch|posiłek|posilek|catering|meal break/i;
  function lunchOf(st, day) {
    if (!day || day.kind !== 'shoot') return null;
    const r = callRows(st, day).find((x) => x.kind === 'custom' && LUNCH_RE.test(x.desc || ''));
    if (!r) return null;
    return { from: r.from, to: r.dur ? r.to : '', dur: r.dur, fromMin: r.fromMin, label: r.from + (r.dur ? '–' + r.to : '') };
  }
  /** godziny pracy dnia: start (zbiórka), koniec (ostatnia pozycja harmonogramu albo koniec dnia specjalnego) */
  function dayTimes(st, day) {
    if (!day || day.kind === 'off') return null;
    if (day.kind === 'shoot') {
      const sh = st.sheets[day.id] || {};
      const start = dayStart(st, day, sh);
      const rows = callRows(st, day);
      const known = rows.some((r) => r.dur > 0 || r.fixed);
      const end = rows.length ? Math.max(start, ...rows.map((r) => r.toMin)) : start;
      return { start, end: known ? end : null, work: known ? end - start : null, known };
    }
    const s = timeToMin(day.call), e0 = timeToMin(day.end);
    if (s == null) return null;
    if (e0 == null) return { start: s, end: null, work: null, known: false };
    const e = e0 <= s ? e0 + 1440 : e0;
    return { start: s, end: e, work: e - s, known: true };
  }
  /** kontrola czasu pracy: limit godzin dziennie i minimalny odpoczynek między dniami */
  function hoursCheck(st) {
    const out = new Map();
    const maxW = Math.round((+st.meta.maxWorkH > 0 ? +st.meta.maxWorkH : 12) * 60), minR = Math.round((+st.meta.minRestH > 0 ? +st.meta.minRestH : 11) * 60);
    const nums = dayNumbers(st);
    // rzeczywiste godziny z raportu dziennego (zbiórka i koniec pracy ekipy) mają pierwszeństwo przed planem
    const actualTimes = (d) => {
      const r = d.kind === 'shoot' && st.dpr ? st.dpr[d.id] : null;
      if (!r) return null;
      const a = timeToMin(r.crewCall), b = timeToMin(r.crewWrap);
      if (a == null || b == null) return null;
      const e = b <= a ? b + 1440 : b;
      return { start: a, end: e, work: e - a, known: true, actual: true };
    };
    const list = st.days.filter((d) => d.kind !== 'off' && d.date).map((d, i) => ({ d, i, t: actualTimes(d) || dayTimes(st, d) })).filter((x) => x.t);
    list.sort((a, b) => (a.d.date < b.d.date ? -1 : a.d.date > b.d.date ? 1 : a.i - b.i));
    list.forEach((x) => {
      const e = { start: x.t.start, end: x.t.end, work: x.t.work, known: x.t.known, actual: !!x.t.actual, alerts: [], restBefore: null, restAfter: null };
      if (x.t.known && x.t.work > maxW) e.alerts.push({ type: 'work', text: T('Czas pracy {w} (zbiórka {a} → koniec {b}) przekracza limit {max} h dziennie', { w: fmtDur(x.t.work), a: clock(x.t.start), b: clock(x.t.end), max: maxW / 60 }) });
      out.set(x.d.id, e);
    });
    for (let k = 1; k < list.length; k++) {
      const a = list[k - 1], b = list[k];
      if (!a.t.known) continue;
      const endAbs = dayIndex(a.d.date) * 1440 + a.t.end, startAbs = dayIndex(b.d.date) * 1440 + b.t.start;
      const rest = startAbs - endAbs;
      out.get(a.d.id).restAfter = rest; out.get(b.d.id).restBefore = rest;
      if (rest < minR) {
        const v = { prev: dayTag(a.d, nums), end: clock(a.t.end), next: dayTag(b.d, nums), start: clock(b.t.start), rest: fmtDur(Math.max(0, rest)), min: minR / 60 };
        out.get(b.d.id).alerts.push({ type: 'rest', text: rest < 0 ? T('Zbiórka wypada przed końcem poprzedniego dnia pracy ({prev}, koniec {end})', v) : T('Odpoczynek po dniu {prev} (koniec {end}) trwa tylko {rest} – wymagane {min} h', v) });
        out.get(a.d.id).alerts.push({ type: 'rest', text: rest < 0 ? T('Koniec dnia nachodzi na zbiórkę następnego dnia ({next}, {start})', v) : T('Do zbiórki następnego dnia ({next}, {start}) zostaje tylko {rest} odpoczynku – wymagane {min} h', v) });
      }
    }
    return out;
  }
  /** sceny występujące w harmonogramie dnia (w trybie shotlisty: sceny wybranych ujęć) */
  function sheetScenes(st, day) {
    const sh = st.sheets[day.id] || {};
    if (sh.mode !== 'shots') return dayStats(st, day).scenes;
    const sm = sceneMap(st), seen = new Set(), out = [];
    callRows(st, day).forEach((r) => { const sc = sm.get(r.sceneId); if (sc && !seen.has(sc.id)) { seen.add(sc.id); out.push(sc); } });
    return out;
  }
  function sheetCastIds(st, day) { return [...new Set(sheetScenes(st, day).flatMap((s) => s.cast))].sort((a, b) => a - b); }
  /** tekst lokacji w planie pracy: ręczny albo z listy obiektów dnia */
  function locationsText(st, day) {
    const sh = st.sheets[day.id] || {};
    if (typeof sh.locations === 'string') return sh.locations;
    const sites = [...new Set(sheetScenes(st, day).map((s) => s.site || s.place).filter(Boolean))];
    return sites.map((x) => {
      const o = siteEntry(st.sites[x]);
      const head = x + (o.realName ? ` (${o.realName})` : '') + (o.address ? ' – ' + o.address : '');
      const info = [o.camp && T('Baza / camp: {t}', { t: o.camp }), o.toilet && T('Toaleta: {t}', { t: o.toilet }), o.power && T('Prąd: {t}', { t: powerLabel(o.power) })].filter(Boolean).join('   ·   ');
      return info ? head + '\n   ' + info : head;
    }).join('\n');
  }
  /* ---------- lokacje: dane obiektu ---------- */
  const SITE_FIELDS = ['realName', 'address', 'owner', 'ownerContact', 'power', 'toilet', 'camp', 'contract', 'rate', 'notes'];
  const siteEntry = (o) => { const x = Object.assign({}, o || {}); SITE_FIELDS.forEach((k) => { if (x[k] == null) x[k] = ''; }); return x; };
  const POWER = [['', T_('Nie ustalono')], ['house', T_('Gniazda domowe 230 V')], ['three', T_('Gniazda siłowe 400 V')], ['both', T_('Domowe i siłowe')], ['generator', T_('Brak prądu – agregat')], ['other', T_('Inne (opis w uwagach)')]];
  const SITE_CONTRACT = [['', T_('Brak informacji')], ['signed', T_('Podpisana')], ['sent', T_('Wysłana do podpisu')], ['negotiation', T_('W trakcie negocjacji')], ['unsigned', T_('Niepodpisana')], ['refused', T_('Odmowa')]];
  const powerLabel = (k) => T((POWER.find((x) => x[0] === k) || POWER[0])[1]);
  const contractLabel = (k) => T((SITE_CONTRACT.find((x) => x[0] === k) || SITE_CONTRACT[0])[1]);
  /** umowa jest problemem tylko, gdy status ustawiono i nie jest „Podpisana” */
  const contractOpen = (k) => !!k && k !== 'signed';
  const removeScenes = (st, ids) => {
    const set = new Set(ids);
    unassign(st, ids);
    st.scenes = st.scenes.filter((s) => !set.has(s.id));
    st.shots = (st.shots || []).filter((x) => !set.has(x.sceneId));
  };
  /* ---------- mapki (obrazy w projekcie) ---------- */
  function addMap(st, dayId, img) {
    const id = uid();
    st.media[id] = { mime: 'image/jpeg', data: img.data, w: img.w, h: img.h, name: img.name || '' };
    ensureSheet(st, dayId).maps.push({ id: uid(), media: id, caption: img.caption || '' });
    return id;
  }
  function removeMap(st, dayId, mapId) {
    const sh = ensureSheet(st, dayId);
    const m = sh.maps.find((x) => x.id === mapId);
    if (!m) return;
    sh.maps = sh.maps.filter((x) => x.id !== mapId);
    const used = Object.values(st.sheets).some((s) => (s.maps || []).some((x) => x.media === m.media));
    if (!used) delete st.media[m.media];
  }

  /* ---------- ekipa, diety, catering ---------- */
  const DEPTS = [T_('Reżyseria'), T_('Produkcja'), T_('Zdjęcia'), T_('Oświetlenie'), T_('Grip'), T_('Dźwięk'), T_('Scenografia'), T_('Kostiumy'), T_('Charakteryzacja'), T_('Obsada'), T_('Transport'), T_('Catering'), T_('Postprodukcja'), T_('Inne')];
  const CONTRACTS = [T_('Umowa o dzieło'), T_('Umowa zlecenie'), T_('Umowa o pracę'), T_('B2B / faktura'), T_('Wolontariat'), T_('Inna')];
  const DIETS = [['meat', T_('Standardowa (mięsna)'), T_('Mięsna')], ['veg', T_('Wegetariańska'), T_('Wege')], ['vegan', T_('Wegańska'), T_('Vegan')], ['fish', T_('Pescowegetariańska'), T_('Ryby')], ['gf', T_('Bezglutenowa'), T_('Bez glutenu')], ['lf', T_('Bez laktozy'), T_('Bez laktozy')], ['other', T_('Inna / specjalna'), T_('Inna')]];
  const dietLabel = (k, short) => { const d = DIETS.find((x) => x[0] === (k || 'meat')) || DIETS[0]; return T(short ? d[2] : d[1]); };
  const newCrew = (o) => Object.assign({ id: uid(), first: '', last: '', dept: '', role: '', phone: '', email: '', contract: '', rate: '', lodging: '', dietType: 'meat', dietNote: '', transport: '', notes: '', skip: [], extra: [] }, o || {});
  const crewName = (c) => [c.first, c.last].filter(Boolean).join(' ');
  /** postać z obsady: dane aktora takie jak u ekipy (kontakt, umowa, stawka, nocleg, dieta, transport, uwagi) */
  const CAST_FIELDS = ['actor', 'phone', 'email', 'contract', 'rate', 'lodging', 'diet', 'dietNote', 'transport', 'notes'];
  const castEntry = (o) => { const c = Object.assign({ id: 0, name: '' }, o || {}); CAST_FIELDS.forEach((k) => { if (c[k] == null) c[k] = ''; }); return c; };
  /** czy osoba pracuje danego dnia: domyślnie każdy dzień zdjęciowy (poza odznaczonymi), dni specjalne trzeba zaznaczyć */
  const crewWorks = (c, d) => (!d || d.kind === 'off' ? false : d.kind === 'shoot' ? !(c.skip || []).includes(d.id) : (c.extra || []).includes(d.id));
  function toggleCrewDay(st, c, dayId, on) {
    const d = st.days.find((x) => x.id === dayId); if (!d || d.kind === 'off') return;
    const want = on == null ? !crewWorks(c, d) : !!on;
    const list = d.kind === 'shoot' ? 'skip' : 'extra';
    const set = new Set(c[list] || []);
    if ((d.kind === 'shoot') === want) set.delete(dayId); else set.add(dayId);
    c[list] = [...set];
  }
  function setCrewAllDays(st, c, mode) {
    c.skip = mode === 'none' ? st.days.filter((x) => x.kind === 'shoot').map((x) => x.id) : [];
    c.extra = mode === 'all' ? st.days.filter((x) => isSpecial(x.kind)).map((x) => x.id) : [];
  }
  /** osoba pracuje we wszystkie dni zdjęciowe i w żaden specjalny (ustawienie domyślne) */
  const crewDefaultDays = (c) => !(c.skip || []).length && !(c.extra || []).length;
  const deptKey = (c) => (c.dept || '').trim() || '__none';
  /** ekipa pogrupowana po pionach (kolejność pionów jak w DEPTS, własne na końcu) */
  function crewGroups(st) {
    const map = new Map();
    st.crew.forEach((c) => { const k = deptKey(c); if (!map.has(k)) map.set(k, []); map.get(k).push(c); });
    const rank = (k) => { const i = DEPTS.findIndex((x) => x === k || I18N.EN[x] === k); return i >= 0 ? i : k === '__none' ? 1000 : 500; };
    return [...map.entries()].sort((a, b) => rank(a[0]) - rank(b[0]) || a[0].localeCompare(b[0], 'pl'))
      .map(([key, list]) => ({ key, dept: key === '__none' ? T('Bez pionu') : key, list }));
  }
  /** raport cateringowy: liczba posiłków wg diet na każdy dzień pracy */
  function catering(st) {
    const cm = castMap(st), nums = dayNumbers(st);
    const castOn = !st.catering || st.catering.cast !== false;
    const keys = DIETS.map((d) => d[0]);
    const days = st.days.filter((d) => d.kind !== 'off').map((d) => {
      const counts = {}; keys.forEach((k) => { counts[k] = 0; });
      const notes = [];
      const crew = st.crew.filter((c) => crewWorks(c, d));
      crew.forEach((c) => { const k = keys.includes(c.dietType) ? c.dietType : 'meat'; counts[k]++; if (c.dietNote || k !== 'meat') notes.push({ who: crewName(c) || T('(bez nazwiska)'), diet: dietLabel(k), note: c.dietNote || '' }); });
      const cast = castOn && d.kind === 'shoot' ? sheetCastIds(st, d).map((id) => cm.get(id)).filter(Boolean) : [];
      cast.forEach((c) => { const k = keys.includes(c.diet) ? c.diet : 'meat'; counts[k]++; if (k !== 'meat' || c.dietNote) notes.push({ who: (c.actor || c.name) + (c.actor ? ' (' + c.name + ')' : ''), diet: dietLabel(k), note: c.dietNote || '' }); });
      const extra = Math.max(0, Math.round(+((st.catering || {}).extra || {})[d.id] || 0));
      counts.meat += extra;
      const total = keys.reduce((a, k) => a + counts[k], 0);
      return { id: d.id, kind: d.kind, tag: dayTag(d, nums), title: dayTitle(d, nums), date: d.date, counts, crew: crew.length, cast: cast.length, extra, total, notes };
    });
    const sum = {}; keys.forEach((k) => { sum[k] = days.reduce((a, x) => a + x.counts[k], 0); });
    return { keys, days, sum, total: days.reduce((a, x) => a + x.total, 0) };
  }
  const cateringLine = (row) => (row && row.total ? T('{n} posiłków', { n: row.total }) + ': ' + DIETS.filter(([k]) => row.counts[k]).map(([k]) => `${row.counts[k]} ${dietLabel(k, true).toLowerCase()}`).join(' · ') : '');

  /* ---------- shotlista ---------- */
  const SHOT_TYPES = [
    ['DET', T_('Detal'), T_('Szczegół: oko, dłoń, przedmiot wypełnia kadr (Detail / ECU)')],
    ['CU', T_('Zbliżenie'), T_('Twarz lub przedmiot, kadr od ramion w górę (Close-up)')],
    ['MCU', T_('Półzbliżenie'), T_('Od piersi w górę (Medium close-up)')],
    ['MS', T_('Plan średni'), T_('Postać od pasa w górę (Medium shot)')],
    ['MFS', T_('Plan amerykański'), T_('Postać od kolan w górę (Medium full shot)')],
    ['FS', T_('Plan pełny'), T_('Cała sylwetka z głową i stopami (Full shot)')],
    ['WS', T_('Plan ogólny'), T_('Postać w szerokim otoczeniu, pokazuje miejsce akcji (Wide shot)')],
  ];
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
  /** dni, w których ujęcie jest w harmonogramie trybu shotlisty */
  function shotDays(st) {
    const m = new Map(), nums = dayNumbers(st);
    st.days.forEach((d) => { const sh = st.sheets[d.id]; if (!sh || sh.mode !== 'shots' || !Array.isArray(sh.srows)) return; sh.srows.forEach((r) => { if (r.kind === 'shot') { if (!m.has(r.shotId)) m.set(r.shotId, []); m.get(r.shotId).push(dayTag(d, nums)); } }); });
    return m;
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
  /* ---------- waluty: kwoty w kosztorysie są w walucie projektu, kursy (PLN za 1 jednostkę) trzyma budget.fx ---------- */
  const CURRENCIES = { PLN: { sym: 'zł', name: T_('złoty (PLN)') }, EUR: { sym: '€', name: T_('euro (EUR)') }, USD: { sym: '$', name: T_('dolar amerykański (USD)') }, GBP: { sym: '£', name: T_('funt szterling (GBP)') }, CHF: { sym: 'CHF', name: T_('frank szwajcarski (CHF)') }, CZK: { sym: 'Kč', name: T_('korona czeska (CZK)') } };
  let CUR = 'PLN';
  const setCurrency = (c) => { CUR = CURRENCIES[c] ? c : 'PLN'; };
  const fmtMoney = (n, cur) => {
    cur = CURRENCIES[cur] ? cur : CUR;
    n = Math.round((+n || 0) * 100) / 100; const neg = n < 0; const [i, f] = Math.abs(n).toFixed(2).split('.');
    if (EN()) return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + f + ' ' + cur;
    return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + f + ' ' + CURRENCIES[cur].sym;
  };
  /** ile złotych za 1 jednostkę waluty (null, gdy brak kursu) */
  const plnPer = (st, c) => { if (c === 'PLN') return 1; const v = st && st.budget && st.budget.fx && st.budget.fx.pln && st.budget.fx.pln[c]; return v > 0 ? v : null; };
  /** przeliczenie kwoty; null, gdy brakuje kursu */
  function convert(st, amount, from, to) {
    if (from === to) return amount;
    const a = plnPer(st, from), b = plnPer(st, to);
    return a && b ? (amount * a) / b : null;
  }
  const fxInfo = (st) => (st.budget && st.budget.fx) || null;
  /** kursy z tabeli A NBP → { date, pln: { EUR, USD, … } } */
  function parseNbp(json) {
    const t = Array.isArray(json) ? json[0] : json;
    if (!t || !Array.isArray(t.rates)) return null;
    const pln = {};
    t.rates.forEach((r) => { if (CURRENCIES[r.code] && r.code !== 'PLN' && r.mid > 0) pln[r.code] = r.mid; });
    return Object.keys(pln).length ? { date: t.effectiveDate || '', src: 'NBP', pln, manual: false } : null;
  }
  /* ---------- stawki ekipy i obsady → kosztorys ---------- */
  const RATE_UNITS = { day: [T_('dzień'), T_('dni')], hour: [T_('godz.'), T_('godz.')], week: [T_('tydzień'), T_('tyg.')], month: [T_('miesiąc'), T_('mies.')], project: [T_('ryczałt'), T_('ryczałt')] };
  /** „1 800 zł / dzień”, „12.000,00 zł za projekt”, „150 zł/h” → { amount, unit } */
  function parseRate(txt) {
    const raw = String(txt || '').toLowerCase().replace(/\u00a0/g, ' ');
    const s = raw.replace(/(\d)[ .](?=\d{3}(?!\d))/g, '$1');
    const m = s.match(/(\d+(?:[.,]\d+)?)\s*(k\b|tys)?/);
    if (!m) return null;
    let amount = parseFloat(m[1].replace(',', '.'));
    if (m[2]) amount *= 1000;
    if (!(amount > 0)) return null;
    let unit = 'day';
    if (/godz|\/\s*h\b|\d\s*h\b|hour|\bhr\b/.test(raw)) unit = 'hour';
    else if (/tydz|tydzie|tyg|week/.test(raw)) unit = 'week';
    else if (/mies|month|\/\s*mc\b/.test(raw)) unit = 'month';
    else if (/projekt|ryczał|ryczal|całość|calosc|całego|film|flat|project|total|łącznie|lacznie|za całość|honorarium/.test(raw)) unit = 'project';
    let cur = null;
    if (/€|\beur\b|\beuro\b/.test(raw)) cur = 'EUR';
    else if (/\$|\busd\b|dolar|dollar/.test(raw)) cur = 'USD';
    else if (/£|\bgbp\b|funt/.test(raw)) cur = 'GBP';
    else if (/\bchf\b|frank/.test(raw)) cur = 'CHF';
    else if (/\bczk\b|kč|koron/.test(raw)) cur = 'CZK';
    else if (/\bpln\b|zł|zl\b|złot/.test(raw)) cur = 'PLN';
    return { amount, unit, cur };
  }
  /** wyliczone pozycje kosztorysu ze stawek; każda pozycja zna osobę, liczbę dni/godzin i kwotę */
  function rateLines(st) {
    setCurrency(st.budget && st.budget.currency);
    const rates = (st.budget && st.budget.rates) || {};
    const work = st.days.filter((d) => d.kind !== 'off');
    const hoursOf = (d) => { const t = dayTimes(st, d); return t && t.known && t.work > 0 ? t.work / 60 : 10; };
    const wk = Math.max(1, weekdaysOf(st.meta).length);
    const qtyFor = (unit, days) => {
      if (!days.length) return 0;
      if (unit === 'day') return days.length;
      if (unit === 'hour') return Math.round(days.reduce((a, d) => a + hoursOf(d), 0) * 4) / 4;
      if (unit === 'week') return Math.ceil(days.length / wk);
      if (unit === 'month') { const ds = days.map((d) => d.date).filter(Boolean).sort(); return ds.length ? Math.max(1, Math.ceil((dayIndex(ds[ds.length - 1]) - dayIndex(ds[0]) + 1) / 30)) : 1; }
      return 1;
    };
    const mk = (kind, id, who, role, contract, rateTxt, days) => {
      const key = kind + ':' + id, r = parseRate(rateTxt), o = rates[key] || {};
      const qty = r ? qtyFor(r.unit, days) : 0;
      const pc = (st.budget && st.budget.currency) || 'PLN', from = r && r.cur ? r.cur : pc, f = from === pc ? 1 : convert(st, 1, from, pc);
      return { key, kind, ref: id, who, role, contract: contract || '', rate: rateTxt || '', parsed: r, days: days.length, qty, fxMissing: !!r && f == null, est: r ? Math.round(r.amount * qty * (f == null ? 1 : f) * 100) / 100 : 0, act: num(o.act), actRaw: o.act == null ? '' : o.act, off: !!o.off };
    };
    const out = [];
    st.crew.forEach((c) => { if (!String(c.rate || '').trim() && !String(c.contract || '').trim()) return; out.push(mk('crew', c.id, crewName(c) || T('(bez nazwiska)'), c.role || c.dept || '', c.contract, c.rate, work.filter((d) => crewWorks(c, d)))); });
    const shoot = st.days.filter((d) => d.kind === 'shoot');
    const castDays = new Map();
    shoot.forEach((d) => { dayStats(st, d).castIds.forEach((id) => { if (!castDays.has(id)) castDays.set(id, []); castDays.get(id).push(d); }); });
    st.cast.forEach((c) => { if (!String(c.rate || '').trim() && !String(c.contract || '').trim()) return; out.push(mk('cast', c.id, c.actor || c.name, c.actor ? c.name : '', c.contract, c.rate, castDays.get(c.id) || [])); });
    // lokacje: stawka za wynajem liczona po dniach zdjęciowych, w których obiekt występuje w planie
    const siteDays = new Map();
    shoot.forEach((d) => { dayStats(st, d).sites.forEach((k) => { if (!siteDays.has(k)) siteDays.set(k, []); siteDays.get(k).push(d); }); });
    Object.keys(st.sites || {}).forEach((k) => {
      const o = siteEntry(st.sites[k]);
      if (!String(o.rate || '').trim()) return;
      out.push(mk('site', k, k, o.realName || '', o.contract ? contractLabel(o.contract) : '', o.rate, siteDays.get(k) || []));
    });
    return out;
  }
  const rateUnitLabel = (u, many) => T((RATE_UNITS[u] || RATE_UNITS.day)[many ? 1 : 0]);
  /** „5 dni × 1 800,00 zł” */
  function rateFormula(l) {
    if (!l.parsed) return '';
    const own = fmtMoney(l.parsed.amount, l.parsed.cur || undefined);
    if (l.parsed.unit === 'project') return T('ryczałt') + ' ' + own;
    return `${String(l.qty).replace('.', EN() ? '.' : ',')} ${rateUnitLabel(l.parsed.unit, true)} × ${own}`;
  }
  function budgetData(st) {
    setCurrency(st.budget && st.budget.currency);
    const dn = dayNumbers(st), dm = new Map(st.days.map((d) => [d.id, d]));
    const cats = BUDGET_CATS.map(([k, label]) => {
      const items = st.budget.items.filter((i) => i.cat === k).map((i) => {
        const d = dm.get(i.dayId);
        return Object.assign({}, i, { est: num(i.est), act: num(i.act), dayNo: d && d.kind === 'shoot' ? dn.get(d.id) : null, dayTag: d ? dayTag(d, dn) : '', date: d ? d.date : '' });
      });
      const est = items.reduce((a, i) => a + i.est, 0), act = items.reduce((a, i) => a + i.act, 0);
      const dev = items.reduce((a, i) => a + (i.act ? i.act - i.est : 0), 0);
      return { key: k, label: T(label), items, est, act, dev };
    });
    // stawki ekipy i obsady jako pozycje kosztorysu (piony Ekipa i Obsada)
    if (!st.budget || st.budget.autoRates !== false) {
      rateLines(st).forEach((l) => {
        if (!l.parsed) return;
        const c = cats.find((x) => x.key === l.kind); if (!c) return;
        const it = { id: l.key, auto: true, off: l.off, line: l, name: `${l.who}${l.role ? ' – ' + l.role : ''} (${rateFormula(l)})`, est: l.off ? 0 : l.est, act: l.off ? 0 : l.act, dayNo: null, dayTag: l.parsed.unit === 'project' ? '' : `${l.qty}`, date: '', site: '', note: [l.contract, l.rate].filter(Boolean).join(' · ') };
        c.items.push(it);
        if (!l.off) { c.est += it.est; c.act += it.act; if (it.act) c.dev += it.act - it.est; }
      });
      cats.forEach((c) => { c.items = c.items.filter((i) => !(i.auto && i.off)).concat(c.items.filter((i) => i.auto && i.off)); });
    }
    const est = cats.reduce((a, c) => a + c.est, 0), act = cats.reduce((a, c) => a + c.act, 0), dev = cats.reduce((a, c) => a + c.dev, 0);
    const cur = (st.budget && st.budget.currency) || 'PLN';
    const conv = ['EUR', 'USD'].filter((c) => c !== cur).map((c) => ({ cur: c, est: convert(st, est, cur, c), act: convert(st, act, cur, c) }));
    return { cats, est, act, dev, cur, conv };
  }
  function transportData(st, dayId) {
    const dn = dayNumbers(st), vm = new Map(st.transport.vehicles.map((v) => [v.id, v]));
    const trips = st.transport.trips.filter((t) => !dayId || t.dayId === dayId).map((t) => {
      const d = st.days.find((x) => x.id === t.dayId);
      return Object.assign({}, t, { dayNo: d ? dn.get(d.id) : null, dayTag: d ? dayTag(d, dn) : '', date: d ? d.date : '', vehicle: vm.get(t.vehicleId) || null });
    }).sort((a, b) => (a.date || '').localeCompare(b.date || '') || (a.time || '').localeCompare(b.time || ''));
    return { vehicles: st.transport.vehicles, trips };
  }

  /* ---------- import scenariusza do stanu ---------- */
  const normName = (s) => String(s || '').toUpperCase().replace(/\s+/g, ' ').trim();
  function applyImport(st, parsed, o) {
    o = o || {};
    const oldScenes = new Map();
    st.scenes.forEach((s) => oldScenes.set(String(s.num).toUpperCase(), s));
    const oldCast = new Map(st.cast.map((c) => [normName(c.name), c]));
    const newCast = [];
    const idOf = new Map();
    for (const pc of parsed.cast) {
      const key = normName(pc.name);
      let c = oldCast.get(key);
      if (!c) c = castEntry({ id: st.nextCast++, name: pc.name });
      newCast.push(c);
      idOf.set(key, c.id);
    }
    const keepIds = new Set();
    if (o.keep) st.scenes.forEach((s) => (s.manualCast || []).forEach((id) => keepIds.add(id)));
    st.cast.forEach((c) => { if (keepIds.has(c.id) && !newCast.some((n) => n.id === c.id)) newCast.push(c); });
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
    scenes.forEach((s) => { const k = s.site || s.place; if (k && !st.sites[k]) st.sites[k] = siteEntry(); });
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
    if (old) {
      // przy łączeniu dwóch obiektów puste pola docelowego uzupełniamy danymi zmienianego
      const tgt = st.sites[to];
      if (tgt) { Object.keys(old).forEach((k) => { if (k !== 'manual' && !tgt[k] && old[k]) tgt[k] = old[k]; }); } else st.sites[to] = old;
      delete st.sites[from];
    } else if (!st.sites[to]) st.sites[to] = siteEntry();
    st.days.forEach((d) => { if (d.site === from) d.site = to; });
  }
  function mergeCast(st, fromId, toId) {
    if (fromId === toId) return;
    const a = st.cast.find((c) => c.id === fromId), b = st.cast.find((c) => c.id === toId);
    // dane aktora z łączonej postaci uzupełniają puste pola postaci docelowej
    if (a && b) CAST_FIELDS.forEach((k) => { if (!b[k] && a[k]) b[k] = a[k]; });
    st.scenes.forEach((s) => {
      if (s.cast.includes(fromId)) { s.cast = s.cast.filter((x) => x !== fromId); if (!s.cast.includes(toId)) s.cast.push(toId); }
    });
    st.cast = st.cast.filter((c) => c.id !== fromId);
  }
  function removeCast(st, id) {
    st.scenes.forEach((s) => { s.cast = s.cast.filter((x) => x !== id); });
    st.cast = st.cast.filter((c) => c.id !== id);
  }

  /* ---------- raport dzienny (Daily Production Report) ---------- */
  const DPR_STATUS = [['done', T_('Nakręcona')], ['part', T_('Częściowo')], ['none', T_('Nie nakręcona')]];
  const emptyDpr = () => ({ planned: [], crewCall: '', firstShot: '', lunchFrom: '', lunchTo: '', camWrap: '', crewWrap: '', scenes: {}, cast: {}, extras: '', delays: '', incidents: '', equipment: '', notes: '', closed: false, closedAt: null });
  /** raport dnia do odczytu (z wartościami domyślnymi; bez zmiany stanu) */
  function dprOf(st, dayId) { return Object.assign(emptyDpr(), (st.dpr || {})[dayId] || {}); }
  /** raport dnia do edycji; przy pierwszym użyciu zapamiętuje sceny zaplanowane na ten dzień */
  function ensureDpr(st, dayId) {
    st.dpr = st.dpr || {};
    if (!st.dpr[dayId]) { const day = st.days.find((d) => d.id === dayId); st.dpr[dayId] = Object.assign(emptyDpr(), { planned: day ? day.sceneIds.slice() : [] }); }
    const r = st.dpr[dayId];
    r.scenes = r.scenes || {}; r.cast = r.cast || {}; r.planned = r.planned || [];
    return r;
  }
  /** sceny raportu: aktualne sceny dnia oraz zaplanowane wcześniej (np. przeniesione na inny dzień) */
  function dprSceneIds(st, day) {
    const sm = sceneMap(st), r = (st.dpr || {})[day.id];
    const ids = day.sceneIds.slice();
    ((r && r.planned) || []).forEach((id) => { if (!ids.includes(id)) ids.push(id); });
    return ids.filter((id) => sm.has(id));
  }
  /** nakręcone ósemki sceny w raporcie: nakręcona = całość, częściowo = wpisana wartość (domyślnie połowa) */
  const shotEighths = (sc, rec) => {
    if (!rec || !rec.status) return 0;
    if (rec.status === 'done') return sc.eighths;
    if (rec.status === 'part') return rec.eighths != null && rec.eighths !== '' ? Math.max(0, Math.min(sc.eighths, +rec.eighths || 0)) : Math.round(sc.eighths / 2);
    return 0;
  };
  /** postęp zdjęć w całym projekcie (wszystkie raporty) */
  function shotProgress(st) {
    const sm = sceneMap(st), per = new Map(), done = new Set(), part = new Set();
    Object.values(st.dpr || {}).forEach((r) => Object.entries((r && r.scenes) || {}).forEach(([id, rec]) => {
      const sc = sm.get(id); if (!sc || !rec) return;
      if (rec.status === 'done') done.add(id); else if (rec.status === 'part') part.add(id);
      per.set(id, Math.min(sc.eighths, (per.get(id) || 0) + shotEighths(sc, rec)));
    }));
    done.forEach((id) => { part.delete(id); per.set(id, sm.get(id).eighths); });
    return { shotEighths: [...per.values()].reduce((a, b) => a + b, 0), totalEighths: st.scenes.reduce((a, s) => a + s.eighths, 0), doneScenes: done, partScenes: part };
  }
  const diffMin = (a, b) => { const x = timeToMin(a), y = timeToMin(b); if (x == null || y == null) return null; return y >= x ? y - x : y + 1440 - x; };
  /** podsumowanie raportu: sceny, ósemki, godziny plan/rzeczywistość, postęp narastająco */
  function dprSummary(st, day) {
    const sm = sceneMap(st), r = dprOf(st, day.id);
    const rows = dprSceneIds(st, day).map((id) => {
      const sc = sm.get(id), rec = r.scenes[id] || {};
      return { scene: sc, status: rec.status || '', planned: sc.eighths, shot: shotEighths(sc, rec), setups: Math.max(0, parseInt(rec.setups, 10) || 0), note: rec.note || '', moved: !day.sceneIds.includes(id) };
    });
    const sum = (k) => rows.reduce((a, x) => a + x[k], 0);
    const crows = callRows(st, day), sh = sheetOf(st, day.id), t = dayTimes(st, day), lunch = lunchOf(st, day);
    const first = crows.find((x) => x.kind !== 'custom');
    const work = diffMin(r.crewCall, r.crewWrap);
    const maxW = Math.round((+st.meta.maxWorkH > 0 ? +st.meta.maxWorkH : 12) * 60);
    // narastająco: dni zdjęciowe do tego dnia włącznie (w kolejności kalendarzówki)
    const shoot = st.days.filter((d) => d.kind === 'shoot');
    const upto = shoot.slice(0, shoot.findIndex((d) => d.id === day.id) + 1);
    let cumShot = 0, cumPlan = 0;
    upto.forEach((d) => {
      const rr = (st.dpr || {})[d.id];
      const ids = rr ? dprSceneIds(st, d) : d.sceneIds.filter((id) => sm.has(id));
      cumPlan += ids.reduce((a, id) => a + sm.get(id).eighths, 0);
      if (rr) cumShot += ids.reduce((a, id) => a + shotEighths(sm.get(id), (rr.scenes || {})[id]), 0);
    });
    const prog = shotProgress(st);
    return {
      rows, planned: sum('planned'), shot: sum('shot'), setups: sum('setups'),
      scenesDone: rows.filter((x) => x.status === 'done').length, scenesPart: rows.filter((x) => x.status === 'part').length, scenesNone: rows.filter((x) => x.status === 'none').length,
      plan: { call: minToTime(dayStart(st, day, sh)), firstShot: first ? first.from : '', lunch: lunch ? lunch.label : '', wrap: t && t.known ? clock(t.end) : '', work: t && t.known ? t.work : null },
      actual: { call: r.crewCall, firstShot: r.firstShot, lunchFrom: r.lunchFrom, lunchTo: r.lunchTo, camWrap: r.camWrap, crewWrap: r.crewWrap, work, lunchMin: diffMin(r.lunchFrom, r.lunchTo) },
      overtime: work != null && work > maxW ? work - maxW : null,
      delta: sum('shot') - sum('planned'),
      cum: { shot: cumShot, planned: cumPlan, total: prog.totalEighths, scenesDone: prog.doneScenes.size, scenesTotal: st.scenes.length, delta: cumShot - cumPlan },
    };
  }
  /** przeniesienie scen nienakręconych i nakręconych częściowo: '__next' = następny dzień zdjęciowy, '__pool' = do zaplanowania */
  function moveUnshot(st, dayId, target) {
    const day = st.days.find((d) => d.id === dayId); if (!day) return 0;
    const r = ensureDpr(st, dayId);
    const ids = day.sceneIds.filter((id) => ['none', 'part'].includes((r.scenes[id] || {}).status));
    if (!ids.length) return 0;
    ids.forEach((id) => { if (!r.planned.includes(id)) r.planned.push(id); });
    if (target === '__pool') { unassign(st, ids); return ids.length; }
    let to = target;
    if (target === '__next') {
      const shoot = st.days.filter((d) => d.kind === 'shoot');
      const nx = shoot[shoot.findIndex((d) => d.id === dayId) + 1];
      to = nx ? nx.id : addDay(st, 'shoot').id;
    }
    assign(st, ids, to, 0);
    return ids.length;
  }

  /* ---------- pamięć wyników (mniej przeliczeń) ----------
     Stan projektu jest niezmienny (każda zmiana daje nowy obiekt), więc wynik ciężkiej funkcji dla tego samego
     stanu, argumentów i języka można użyć ponownie. Pamięć działa tylko dla stanów zatwierdzonych w magazynie projektu
     (commitState); obiekty zmieniane w miejscu (wersje robocze, budowanie demo, import) liczone są zawsze od nowa. */
  const MEMO = new WeakMap();
  const COMMITTED = new WeakSet();
  const commitState = (st) => { if (st && typeof st === 'object' && !isDraft(st)) COMMITTED.add(st); };
  const releaseState = (st) => { if (st) { COMMITTED.delete(st); MEMO.delete(st); } };
  const memoStats = { hit: 0, miss: 0 };
  function memo(name, fn) {
    return function (st, ...args) {
      if (!st || !COMMITTED.has(st)) return fn(st, ...args);
      let m = MEMO.get(st);
      if (!m) { m = new Map(); MEMO.set(st, m); }
      const key = name + '|' + I18N.lang + '|' + args.map((a) => (a && typeof a === 'object' ? a.id || JSON.stringify(a) : String(a))).join('|');
      if (m.has(key)) { memoStats.hit++; return m.get(key); }
      memoStats.miss++;
      const r = fn(st, ...args);
      m.set(key, r);
      return r;
    };
  }
  callRows = memo('callRows', callRows); lunchOf = memo('lunchOf', lunchOf); dayTimes = memo('dayTimes', dayTimes); hoursCheck = memo('hoursCheck', hoursCheck);
  sheetScenes = memo('sheetScenes', sheetScenes); scheduleIndex = memo('scheduleIndex', scheduleIndex); dayNumbers = memo('dayNumbers', dayNumbers);
  budgetData = memo('budgetData', budgetData); rateLines = memo('rateLines', rateLines); catering = memo('catering', catering); reportData = memo('reportData', reportData);
  shotDays = memo('shotDays', shotDays); shotRows = memo('shotRows', shotRows); dood = memo('dood', dood);
  dprSummary = memo('dprSummary', dprSummary); shotProgress = memo('shotProgress', shotProgress);

  return {
    uid, TOD, IE_LABEL, ELEMENT_CATS, STRIP, stripKey, stripBg, todClass,
    DAY_KINDS, KIND_BG, isSpecial, isWork, dayTag, dayTitle, kindLabel, setDayKind,
    parseISO, isoOf, addDays, dow, dayIndex, fmtDatePL, fmtDate: fmtDatePL, dayName, fmtShort, fmtDM, todayISO, nextMonday,
    get MONTHS_NOM() { return EN() ? MONTHS_EN : MONTHS_NOM_PL; }, get DAYS_PL() { return EN() ? DAYS_EN : DAYS_PL; }, get DAYS_SHORT() { return EN() ? DAYS_SHORT_EN : DAYS_SHORT_PL; },
    pl, fmtEighths, fmtDur, fmtHM, newState, normalize, migrateCrew, maxEighths, castMap, sceneMap, scheduleIndex, dayNumbers,
    unassign, assign, nextWorkDate, newDayDate, addDay, recalcDates, removeDay, moveDay, autoPlan, dayStats, dayWarnings, dood, reportData,
    BUDGET_CATS, VEHICLE_TYPES, timeToMin, minToTime, clock, sheetOf, ensureSheet, syncRows, syncSheet, initShotRows, setSheetMode, activeRows, callRows, dayStart, dayTimes, hoursCheck, lunchOf,
    SITE_FIELDS, siteEntry, POWER, SITE_CONTRACT, powerLabel, contractLabel, contractOpen,
    customRow, sceneRowOf, shotRowOf, sceneDesc, shotsOf, shotEta, sheetScenes, sheetCastIds, locationsText, removeScenes, addMap, removeMap,
    DEPTS, CONTRACTS, DIETS, dietLabel, CAST_FIELDS, newCast: castEntry, newCrew, crewName, crewWorks, toggleCrewDay, setCrewAllDays, crewDefaultDays, deptKey, crewGroups, catering, cateringLine,
    SHOT_TYPES, etaMin, sceneMinutes, scenesWithoutEta, shotRows, shotDays, nextShotNo, newShot, num, fmtMoney, CURRENCIES, setCurrency, plnPer, convert, fxInfo, parseNbp, budgetData, transportData, parseRate, rateLines, rateFormula, rateUnitLabel,
    applyImport, renameSite, mergeCast, removeCast, weekdaysOf, lastDate, normName, memoStats, commitState, releaseState,
    DPR_STATUS, dprOf, ensureDpr, dprSceneIds, dprSummary, shotProgress, moveUnshot,
  };
})();
export { Core };
