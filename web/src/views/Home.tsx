/* Pulpit produkcji: wskaźniki, najbliższy dzień, oś produkcji, ostrzeżenia, zadania, skróty. */
import { useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, m as motion } from 'motion/react';
import { T, T_ } from '../domain/i18n';
import { Core } from '../domain/core';
import type { Day, ProjectState, Todo } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { goTab, setUI, useUI } from '../state/ui';
import { doExport } from '../state/actions';
import { plN, sitesList } from '../lib/format';
import { Btn, Icon, Seg, TextInput, cx } from '../components/ui';
import type { IconName } from '../lib/icons';

const daysBetween = (a: string, b: string) => Core.dayIndex(b) - Core.dayIndex(a);
function relDay(iso: string) {
  const n = daysBetween(Core.todayISO(), iso);
  if (n === 0) return T('dziś');
  if (n === 1) return T('jutro');
  if (n === -1) return T('wczoraj');
  return n > 0 ? T('za {n}', { n: plN(n, 'dzień', 'dni', 'dni') }) : T('{n} temu', { n: plN(-n, 'dzień', 'dni', 'dni') });
}
const KEY_DEPTS = ['Reżyseria', 'Produkcja', 'Zdjęcia', 'Oświetlenie', 'Grip', 'Dźwięk', 'Scenografia', 'Kostiumy', 'Charakteryzacja'];
type H = ReturnType<typeof homeData>;
function homeData(st: ProjectState) {
  const today = Core.todayISO(), nums = Core.dayNumbers(st);
  const shoot = st.days.filter((d) => d.kind === 'shoot');
  const dated = shoot.filter((d) => d.date).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const done = dated.filter((d) => d.date < today).length;
  const todayDay = dated.find((d) => d.date === today);
  const next = todayDay || dated.find((d) => d.date > today) || null;
  const allDated = st.days.filter((d) => d.date).map((d) => d.date).sort();
  const special = st.days.filter((d) => Core.isSpecial(d.kind)).length;
  const idx = Core.scheduleIndex(st);
  const eighths = st.scenes.reduce((a, s) => a + s.eighths, 0);
  const planned = st.scenes.filter((s) => idx.has(s.id)).length;
  const bd = Core.budgetData(st);
  const castDone = st.cast.filter((c) => (c.actor || '').trim()).length;
  const deptSet = new Set(st.crew.map((c) => (c.dept || '').trim().toLowerCase()).filter(Boolean));
  const keyDepts = KEY_DEPTS.map((d) => T(d));
  const deptsDone = keyDepts.filter((d) => deptSet.has(d.toLowerCase())).length;
  const sites = sitesList(st);
  const signed = sites.filter((k) => (st.sites[k] || ({} as any)).contract === 'signed').length;
  const prog = Core.shotProgress(st);
  return { prog, today, nums, shoot, dated, done, todayDay, next, start: allDated[0] || '', end: allDated[allDated.length - 1] || '', special, eighths, planned, bd, castDone, keyDepts, deptsDone, sites, signed };
}
function Meter({ part, whole, cls }: { part: number; whole: number; cls?: string }) {
  const p = whole > 0 ? Math.max(0, Math.min(100, Math.round((part / whole) * 100))) : 0;
  return <div className={cx('meter', cls)} role="img" aria-label={p + '%'}><i style={{ width: p + '%' }} /></div>;
}
function Kpi({ label, value, sub, meter, tab, tone }: { label: string; value: ReactNode; sub: string; meter?: ReactNode; tab: any; tone?: string }) {
  return <button type="button" className={cx('kpi', tone)} data-act="tab" data-tab={tab} onClick={() => goTab(tab)}><span className="kpi-l">{label}</span><b className="kpi-v">{value}</b>{meter}<span className="kpi-s">{sub}</span></button>;
}

export function Home() {
  const st = useProject((s) => s.st)!;
  const h = useMemo(() => homeData(st), [st]);
  const m = st.meta;
  let status: string;
  if (!h.dated.length) status = T('Kalendarz zdjęć jest pusty');
  else if (h.todayDay) status = T('Dziś dzień zdjęciowy {n} z {all}', { n: h.nums.get(h.todayDay.id), all: h.shoot.length });
  else if (h.done === 0) status = T('Zdjęcia startują {d}', { d: relDay(h.dated[0].date) });
  else if (h.done >= h.dated.length) status = T('Zdjęcia zakończone');
  else status = T('Za nami {a} z {b} dni zdjęciowych', { a: h.done, b: h.dated.length });
  const crumbs = [m.company, m.director && T('reż. {n}', { n: m.director }), m.producer && T('prod. {n}', { n: m.producer })].filter(Boolean).join(' · ');
  const bd = h.bd, used = bd.est ? bd.act / bd.est : 0;
  return <>
    <section className="hero"><div className="hero-t"><span className="eyebrow">{T('Pulpit produkcji')}</span><h1>{m.title || T('Bez tytułu')}</h1>{crumbs && <p>{crumbs}</p>}</div>
      <div className="hero-s"><div className="hero-st"><span className={cx('pulse', h.todayDay && 'live')} aria-hidden="true" />{status}</div>
        {h.start && <div className="mono small muted">{Core.fmtShort(h.start)} – {Core.fmtShort(h.end)}</div>}
        {h.dated.length > 0 && <Meter part={h.done + (h.todayDay ? 0.5 : 0)} whole={h.dated.length} cls="acc" />}</div></section>
    <section className="kpis" aria-label={T('Wskaźniki produkcji')}>
      <Kpi label={T('Dni zdjęciowe')} value={h.shoot.length} sub={h.special ? T('+ {n} specjalnych (prelight, budowa, przerzut)', { n: h.special }) : T('bez dni specjalnych')} meter={h.dated.length ? <Meter part={h.done} whole={h.dated.length} /> : null} tab="schedule" />
      <Kpi label={T('Sceny')} value={st.scenes.length} sub={h.prog.shotEighths ? T('nakręcono {p} z {t} str. ({n}%)', { p: Core.fmtEighths(h.prog.shotEighths), t: Core.fmtEighths(h.eighths), n: h.eighths ? Math.round((h.prog.shotEighths / h.eighths) * 100) : 0 }) : `${Core.fmtEighths(h.eighths)} ${T('str.')} · ${T('{n}% w planie', { n: st.scenes.length ? Math.round((h.planned / st.scenes.length) * 100) : 0 })}`} meter={<Meter part={h.planned} whole={st.scenes.length} />} tab="board" />
      <Kpi label={T('Budżet')} value={<span className="mono">{Core.fmtMoney(bd.est).replace(/[,.]00(?=\s)/, '')}</span>} sub={bd.act ? T('wydano {a} · {p}%', { a: Core.fmtMoney(bd.act), p: Math.round(used * 100) }) : T('brak kosztów rzeczywistych')} meter={<Meter part={bd.act} whole={bd.est} cls={used > 1 ? 'bad' : used > 0.9 ? 'warn' : ''} />} tab="budget" tone={used > 1 ? 'bad' : ''} />
      <Kpi label={T('Obsada')} value={<>{h.castDone}<small>/{st.cast.length}</small></>} sub={h.castDone === st.cast.length && st.cast.length ? T('wszystkie role obsadzone') : T('ról z aktorem')} meter={<Meter part={h.castDone} whole={st.cast.length} />} tab="cast" />
      <Kpi label={T('Ekipa')} value={st.crew.length} sub={T('{a} z {b} kluczowych pionów', { a: h.deptsDone, b: h.keyDepts.length })} meter={<Meter part={h.deptsDone} whole={h.keyDepts.length} />} tab="crew" />
      <Kpi label={T('Lokacje')} value={<>{h.signed}<small>/{h.sites.length}</small></>} sub={T('podpisanych umów')} meter={<Meter part={h.signed} whole={h.sites.length} />} tab="sites" />
    </section>
    <div className="home-grid">
      <div className="home-col"><NextDay h={h} st={st} /><Timeline h={h} st={st} /><Alerts h={h} st={st} /></div>
      <div className="home-col"><Todos st={st} /><Shortcuts /></div>
    </div>
  </>;
}

function openCallsheet(id: string) { setUI((s) => { s.csDay = id; }); goTab('callsheet'); window.scrollTo(0, 0); }
function openScheduleDay(id: string) {
  setUI((s) => { s.calView = 'days'; }); goTab('schedule');
  setTimeout(() => { const el = document.getElementById('day-' + id); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 80);
}

function NextDay({ h, st }: { h: H; st: ProjectState }) {
  const d = h.next;
  if (!d) return <section className="card w"><div className="card-h"><h3>{T('Najbliższy dzień zdjęciowy')}</h3></div><div className="empty"><p>{h.shoot.length ? T('Wszystkie dni zdjęciowe są już za nami.') : T('Nie ma jeszcze dni zdjęciowych.')}</p><Btn v="primary" act="tab" onClick={() => goTab('schedule')}>{T('Otwórz kalendarzówkę')}</Btn></div></section>;
  const ds = Core.dayStats(st, d), t = Core.dayTimes(st, d), sh = Core.sheetOf(st, d.id), lunch = Core.lunchOf(st, d), cm = Core.castMap(st);
  const cast = Core.sheetCastIds(st, d).map((id: number) => cm.get(id)).filter(Boolean);
  const isToday = d.date === h.today;
  return <section className={cx('card w next', isToday && 'today')}><div className="card-h"><h3>{isToday ? T('Dziś na planie') : T('Najbliższy dzień zdjęciowy')}</h3><span className="chip acc">{relDay(d.date)}</span></div>
    <div className="next-b">
      <div className="next-day"><span className="next-tag">D{h.nums.get(d.id)}</span><span className="next-date">{Core.fmtDatePL(d.date)}</span><span className="muted">{Core.dayName(d.date)}</span></div>
      <div className="next-times">
        <span><span className="lbl">{T('Zbiórka')}</span><b className="mono acc-t">{Core.minToTime(t ? t.start : Core.dayStart(st, d, sh))}</b></span>
        <span><span className="lbl">{T('Obiad')}</span><b className="mono">{lunch ? lunch.from : '—'}</b></span>
        <span><span className="lbl">{T('Koniec')}</span><b className="mono">{t && t.known ? Core.clock(t.end) : '—'}</b></span>
        <span><span className="lbl">{T('Sceny')}</span><b className="mono">{ds.scenes.length}<small> · {Core.fmtEighths(ds.eighths)} {T('str.')}</small></b></span>
      </div>
      {ds.sites.length > 0 && <div className="next-row"><Icon n="mapPin" /><span>{ds.sites.join(' · ')}</span></div>}
      {cast.length > 0 && <div className="chips">{cast.map((c: any) => <span key={c.id} className="chip"><b>{c.id}</b> {c.actor || c.name}</span>)}</div>}
      {sh.weather && <div className="next-row muted small"><Icon n="sun" /><span>{sh.weather}</span></div>}
      <div className="row"><Btn v="primary" act="home-cs" icon="sheet" onClick={() => openCallsheet(d.id)}>{T('Plan pracy')}</Btn><Btn act="home-cs-pdf" icon="dl" onClick={() => { setUI((s) => { s.csDay = d.id; }); void doExport('pdf', ['callsheet'], ['plan_pracy_D{n}', { n: h.nums.get(d.id) }], { dayId: d.id }); }}>{T('Call sheet PDF')}</Btn></div>
    </div></section>;
}

function Timeline({ h, st }: { h: H; st: ProjectState }) {
  const days = st.days.filter((d) => d.date);
  if (!days.length) return null;
  return <section className="card w"><div className="card-h"><h3>{T('Oś produkcji')}</h3><span className="muted small">{T('dni zdjęciowe, specjalne i wolne')}</span></div>
    <div className="tl">{days.map((d) => {
      const past = d.date < h.today, today = d.date === h.today;
      const lab = d.kind === 'shoot' ? 'D' + h.nums.get(d.id) : d.kind === 'off' ? '' : T(Core.dayTag(d, h.nums)).slice(0, 1);
      return <button key={d.id} type="button" className={cx('tl-d', 'k-' + d.kind, past && 'past', today && 'now')} data-act="home-day" data-id={d.id} title={Core.dayTitle(d, h.nums) + ' · ' + Core.fmtDatePL(d.date)} aria-label={Core.dayTitle(d, h.nums) + ', ' + Core.fmtDatePL(d.date)} onClick={() => openScheduleDay(d.id)}><span>{lab}</span><small>{Core.fmtDM(d.date)}</small></button>;
    })}</div>
    <div className="legend tl-leg"><span><i className="k k-shoot" />{T('Dni zdjęciowe')}</span><span><i className="k k-prelight" />{T('Prelight')}</span><span><i className="k k-build" />{T('Budowa')}</span><span><i className="k k-travel" />{T('Przerzut')}</span><span><i className="k k-off" />{T('Wolne')}</span></div></section>;
}

const ALERT_GRP: Record<string, string> = { bhp: T_('Czas pracy i odpoczynek'), dpr: T_('Raporty dzienne'), site: T_('Lokacje'), plan: T_('Plan zdjęć'), cast: T_('Obsada'), money: T_('Budżet') };
interface Alert { grp: string; day?: Day; tag?: string; date?: string; text: string; tab?: any }
function homeAlerts(st: ProjectState, h: H): Alert[] {
  const out: Alert[] = [];
  const hrs = Core.hoursCheck(st);
  st.days.forEach((d) => {
    if (d.kind === 'off') return;
    const tag = Core.dayTag(d, h.nums), date = d.date ? Core.fmtDM(d.date) : '';
    const hh = hrs.get(d.id);
    if (hh) hh.alerts.forEach((a: any) => out.push({ grp: 'bhp', day: d, tag, date, text: a.text }));
    if (d.kind === 'shoot') Core.dayWarnings(st, d, new Map()).forEach((t: string) => out.push({ grp: /umowa|contract/i.test(t) ? 'site' : 'plan', day: d, tag, date, text: t }));
  });
  st.days.filter((d) => d.kind === 'shoot' && d.date && d.date < h.today).forEach((d) => {
    const r = st.dpr && st.dpr[d.id];
    if (!r || !r.closed) out.push({ grp: 'dpr', day: d, tag: Core.dayTag(d, h.nums), date: Core.fmtDM(d.date), text: r ? T('Raport dzienny nie jest zamknięty') : T('Brak raportu dziennego') });
  });
  const unplanned = st.scenes.length - h.planned;
  if (st.days.length && unplanned > 0) out.push({ grp: 'plan', tab: 'schedule', text: T('{n} poza planem zdjęć', { n: plN(unplanned, 'scena', 'sceny', 'scen') }) });
  const noActor = st.cast.length - h.castDone;
  if (noActor > 0) out.push({ grp: 'cast', tab: 'cast', text: T('{n} bez obsadzonego aktora', { n: plN(noActor, 'postać', 'postacie', 'postaci') }) });
  if (h.bd.act && h.bd.dev > 0) out.push({ grp: 'money', tab: 'budget', text: T('Budżet przekroczony o {m}', { m: Core.fmtMoney(h.bd.dev) }) });
  const seen = new Set<string>();
  return out.filter((a) => { if (a.grp !== 'site') return true; if (seen.has(a.text)) return false; seen.add(a.text); return true; });
}
function Alerts({ h, st }: { h: H; st: ProjectState }) {
  const list = useMemo(() => homeAlerts(st, h), [st, h]);
  const bhp = list.filter((a) => a.grp === 'bhp').length;
  return <section className="card w"><div className="card-h"><h3>{T('Ostrzeżenia')}</h3>{list.length > 0 && <span className={cx('chip', bhp ? 'bad-c' : 'warn-c')}>{list.length}</span>}<span className="muted small" style={{ marginLeft: 'auto' }}>{T('limit {a} h pracy · min. {b} h odpoczynku', { a: +st.meta.maxWorkH || 12, b: +st.meta.minRestH || 11 })}</span></div>
    <div className="card-b alerts">{list.length ? Object.keys(ALERT_GRP).filter((g) => list.some((a) => a.grp === g)).map((g) => {
      const items = list.filter((a) => a.grp === g);
      return <div key={g} className="al-g"><div className="lbl">{T(ALERT_GRP[g])}</div>
        {items.slice(0, 8).map((a, i) => <button key={i} type="button" className={cx('al-i', g)} data-act={a.day ? 'home-alert' : 'tab'} data-id={a.day?.id} onClick={() => { if (a.day && g === 'dpr') { const id = a.day.id; setUI((s) => { s.dprDay = id; }); goTab('dpr'); window.scrollTo(0, 0); } else if (a.day) { if (a.day.kind === 'shoot') openCallsheet(a.day.id); else openScheduleDay(a.day.id); } else goTab(a.tab); }}>{a.day && <span className="al-tag mono">{a.tag}{a.date ? ' · ' + a.date : ''}</span>}<span>{a.text}</span></button>)}
        {items.length > 8 && <div className="small muted">{T('…i {n} kolejnych', { n: items.length - 8 })}</div>}</div>;
    }) : <div className="ok-state"><Icon n="shield" /><span>{T('Brak ostrzeżeń. Czas pracy i odpoczynku mieści się w limitach.')}</span></div>}</div></section>;
}

function Todos({ st }: { st: ProjectState }) {
  const f = useUI((s) => s.todoF);
  const [text, setText] = useState('');
  const [dueOpen, setDueOpen] = useState<string | null>(null);
  const all = st.todos || [];
  const today = Core.todayISO();
  const open = all.filter((x) => !x.done), done = all.filter((x) => x.done);
  const list = (f === 'open' ? open : f === 'done' ? done : all).slice().sort((a, b) => (+a.done - +b.done) || (+(b.prio === 'high') - +(a.prio === 'high')) || ((a.due || '9999') < (b.due || '9999') ? -1 : (a.due || '9999') > (b.due || '9999') ? 1 : 0));
  const upd = (id: string, fn: (x: Todo) => void) => mutate((s) => { const x = s.todos.find((y) => y.id === id); if (x) fn(x); });
  const add = () => {
    const t = text.trim();
    if (!t) { document.getElementById('todo-new')?.focus(); return; }
    mutate((s) => { s.todos = s.todos || []; s.todos.push({ id: Core.uid(), text: t, done: false, due: '', prio: '', created: Date.now() }); });
    if (f === 'done') setUI((s) => { s.todoF = 'open'; });
    setText('');
    setTimeout(() => document.getElementById('todo-new')?.focus(), 0);
  };
  return <section className="card w todo-card"><div className="card-h"><h3>{T('Zadania produkcji')}</h3>
    <Seg value={f} act="todo-f" label={T('Filtr zadań')} onChange={(v) => setUI((s) => { s.todoF = v; })} items={[['open', <>{T('Do zrobienia')} <span className="cnt">{open.length}</span></>], ['done', <>{T('Zrobione')} <span className="cnt">{done.length}</span></>], ['all', T('Wszystkie')]]} /></div>
    <div className="todo-add"><input id="todo-new" className="inp" value={text} placeholder={T('Nowe zadanie, np. zamówić wóz agregatowy na D3')} aria-label={T('Nowe zadanie')} enterKeyHint="done" onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} /><Btn v="primary" act="todo-add" icon="plus" onClick={add}>{T('Dodaj')}</Btn></div>
    {list.length ? <ul className="todos"><AnimatePresence initial={false}>{list.map((x) => {
      const over = !x.done && x.due && x.due < today;
      return <motion.li key={x.id} className={cx('todo', x.done && 'done', x.prio === 'high' && 'hi', over && 'over')} data-tid={x.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.22 }}>
        <button type="button" className="todo-c" data-act="todo-toggle" role="checkbox" aria-checked={!!x.done} aria-label={x.done ? T('Oznacz jako niezrobione') : T('Oznacz jako zrobione')} onClick={() => upd(x.id, (t) => { t.done = !t.done; t.doneAt = t.done ? Date.now() : null; })}><Icon n="check" /></button>
        <TextInput className="todo-t" value={x.text} bind="todo.text" bid={x.id} label={T('Treść zadania')} onCommit={(v) => upd(x.id, (t) => { t.text = v; })} />
        {x.due || dueOpen === x.id
          ? <input className="inp todo-d" type="date" value={x.due || ''} data-bind="todo.due" data-id={x.id} aria-label={T('Termin')} title={over ? T('Po terminie') : T('Termin')} autoFocus={dueOpen === x.id} onChange={(e) => upd(x.id, (t) => { t.due = e.target.value; })} onBlur={() => setDueOpen(null)} />
          : <Btn sm v="ghost" className="todo-db" act="todo-due" aria-label={T('Dodaj termin')} title={T('Dodaj termin')} onClick={() => setDueOpen(x.id)}><Icon n="cal" /></Btn>}
        <Btn sm v="ghost" className={cx('todo-p', x.prio === 'high' && 'on')} act="todo-prio" aria-pressed={x.prio === 'high'} aria-label={T('Pilne')} title={T('Pilne')} onClick={() => upd(x.id, (t) => { t.prio = t.prio === 'high' ? '' : 'high'; })}>!</Btn>
        <Btn sm v="ghost danger" act="todo-del" aria-label={T('Usuń zadanie')} onClick={() => mutate((s) => { s.todos = s.todos.filter((y) => y.id !== x.id); })}><Icon n="trash" /></Btn>
      </motion.li>;
    })}</AnimatePresence></ul> : <div className="empty small"><p>{f === 'done' ? T('Nic jeszcze nie odhaczono.') : T('Brak zadań. Dodaj pierwsze powyżej.')}</p></div>}
    {done.length > 0 && f !== 'open' && <div className="card-f"><Btn sm v="ghost" act="todo-clear" onClick={() => mutate((s) => { s.todos = s.todos.filter((y) => !y.done); })}>{T('Usuń zrobione ({n})', { n: done.length })}</Btn></div>}
  </section>;
}

function Shortcuts() {
  const items: [any, IconName, string][] = [['import', 'script', T('Wczytaj scenariusz')], ['schedule', 'cal', T('Ułóż kalendarzówkę')], ['callsheet', 'sheet', T('Plan pracy dnia')], ['shotlist', 'cam', T('Shotlista')], ['crew', 'people', T('Ekipa i catering')], ['budget', 'wallet', T('Kosztorys')], ['sites', 'mapPin', T('Lokacje')], ['export', 'export', T('Eksport PDF / Excel')]];
  return <section className="card w"><div className="card-h"><h3>{T('Skróty')}</h3></div><div className="shortcuts">{items.map(([k, ic, l]) => <button key={k} type="button" className="sc-i" data-act="tab" data-tab={k} onClick={() => { goTab(k); window.scrollTo(0, 0); }}><Icon n={ic} /><span>{l}</span><Icon n="right" /></button>)}</div></section>;
}
