/* Kalendarzówka: pula scen do zaplanowania, dni zdjęciowe i specjalne, widok miesiąca, plan automatyczny.
   Przeciąganie scen: dnd-kit (mysz, rysik, dotyk) z podglądem paska i linią miejsca upuszczenia. */
import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { DndContext, DragOverlay, PointerSensor, TouchSensor, pointerWithin, useDraggable, useDroppable, useSensor, useSensors, type DragEndEvent, type DragMoveEvent, type DragStartEvent } from '@dnd-kit/core';
import { T, T_ } from '../domain/i18n';
import { Core } from '../domain/core';
import type { Day, ProjectState, Scene } from '../domain/model';
import { getSt, mutate, useProject } from '../state/project';
import { goTab, setUI, toast, useUI } from '../state/ui';
import { doExport, snapshotBefore } from '../state/actions';
import { dayLabel, kcls, pl, plN, sitesList } from '../lib/format';
import { moveScenesToDay } from '../lib/helpers';
import { ActionSelect, Btn, Datalist, Field, Icon, PageHead, Select, Seg, TextArea, TextInput, cx } from '../components/ui';
import { scrollToDay } from '../components/common';
import { ShotMark } from './Board';

type DropState = { zone: string; index: number } | null;

export function Schedule() {
  const st = useProject((s) => s.st)!;
  const calView = useUI((s) => s.calView);
  const autoplan = useUI((s) => s.autoplan);
  const idx = useMemo(() => Core.scheduleIndex(st), [st]);
  const nums = useMemo(() => Core.dayNumbers(st), [st]);
  const hrs = useMemo(() => Core.hoursCheck(st), [st]);
  const unsched = st.scenes.filter((s) => !idx.has(s.id));
  const shoot = st.days.filter((d) => d.kind === 'shoot');
  const special = st.days.filter((d) => Core.isSpecial(d.kind));
  const dates = shoot.map((d) => d.date).filter(Boolean).sort();
  const planned = st.scenes.length - unsched.length;
  const alerts = [...hrs.values()].reduce((a: number, h: any) => a + h.alerts.length, 0);
  const addDay = (kind: string) => { let id = ''; mutate((x) => { id = Core.addDay(x, kind).id; }); scrollToDay(id); return id; };
  const right = <>
    <Seg value={calView} label={T('Widok')} act="cal-view" onChange={(v) => setUI((s) => { s.calView = v; })} items={[['days', T('Dni')], ['month', T('Miesiąc')]]} />
    <Btn act="autoplan-toggle" disabled={!st.scenes.length} aria-expanded={autoplan} onClick={() => setUI((s) => { s.autoplan = !s.autoplan; if (s.autoplan && !st.days.length) s.ap.scope = 'unscheduled'; })}>{T('Plan automatyczny')}</Btn>
    <Btn act="day-add" icon="plus" onClick={() => addDay('shoot')}>{T('Dzień zdjęciowy')}</Btn>
    <ActionSelect className="inp btn-sel" data-act-change="day-add-kind" label={T('Dodaj dzień specjalny')} placeholder={T('+ Dzień specjalny…')} options={Core.DAY_KINDS.filter(([k]) => k !== 'shoot').map(([k, l]) => [k, T(l)] as [string, string])}
      onPick={(v) => { addDay(v); toast(T('Dodano: {k}. Przesuń dzień strzałkami na właściwe miejsce.', { k: Core.kindLabel(v) })); }} />
    <Btn act="export-quick-pdf" icon="dl" disabled={!st.days.length} onClick={() => doExport('pdf', ['calendar'], 'kalendarzowka')}>PDF</Btn>
    <Btn act="export-quick-xlsx" icon="dl" disabled={!st.days.length} onClick={() => doExport('xlsx', ['calendar'], 'kalendarzowka')}>Excel</Btn>
  </>;
  return <>
    <PageHead title={T('Kalendarzówka')} sub={T('Przeciągnij sceny z listy po lewej na dni zdjęciowe albo uruchom plan automatyczny. Dni specjalne (przerzut, prelight, budowa dekoracji) nie wliczają się do numeracji dni zdjęciowych.')} right={right} />
    <div className="sum-bar"><span><b className="num">{shoot.length}</b>{pl(shoot.length, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych')}</span>
      {special.length > 0 && <span><b className="num">{special.length}</b>{pl(special.length, 'dzień specjalny', 'dni specjalne', 'dni specjalnych')}</span>}
      <span><b className="num">{planned}</b>{T('z {n} scen w planie', { n: st.scenes.length })}</span>
      {unsched.length > 0 && <span style={{ color: 'var(--warn)' }}><b className="num">{unsched.length}</b>{T('do zaplanowania')}</span>}
      {alerts > 0 && <span className="alert-sum"><Icon n="warn" /> {plN(alerts, 'ostrzeżenie czasu pracy', 'ostrzeżenia czasu pracy', 'ostrzeżeń czasu pracy')}</span>}
      {dates.length > 0 && <span className="muted">{Core.fmtShort(dates[0])} – {Core.fmtShort(dates[dates.length - 1])}</span>}
      <span className="muted small" style={{ marginLeft: 'auto' }}>{T('Plan automatyczny: do {n} str. na dzień', { n: +st.meta.pagesPerDay })} <Btn sm v="ghost" act="settings-open" onClick={() => setUI((s) => { s.settings = true; })}>{T('zmień')}</Btn></span></div>
    {autoplan && <AutoPlan st={st} unsched={unsched.length} />}
    {calView === 'month' ? <Month st={st} nums={nums} /> : <DaysBoard st={st} unsched={unsched} nums={nums} hrs={hrs} addDay={addDay} />}
  </>;
}

function runAutoplan(ap: { strategy: string; scope: string; separateNight: boolean }) {
  let n = 0;
  if (ap.scope === 'all' && getSt().days.some((d) => d.kind === 'shoot')) void snapshotBefore(T_('Przed ułożeniem planu od nowa'));
  mutate((x) => {
    if (ap.scope === 'all') x.days.filter((d) => d.kind === 'shoot').forEach((d) => Core.removeDay(x, d.id));
    Core.recalcDates(x);
    n = Core.autoPlan(x, { strategy: ap.strategy, scope: 'unscheduled', separateNight: ap.separateNight });
  });
  setUI((s) => { s.autoplan = false; s.calView = 'days'; });
  toast(n ? T('Ułożono {n}.', { n: `${n} ${pl(n, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych')}` }) : T('Nie było scen do zaplanowania.'));
}
function AutoPlan({ st, unsched }: { st: ProjectState; unsched: number }) {
  const ap = useUI((s) => s.ap);
  return <div className="autoplan"><div className="row">
    <Field label={T('Kolejność')}><Select data-act-change="ap-strategy" value={ap.strategy} onChange={(v) => setUI((s) => { s.ap.strategy = v; })} options={[['site', T('Wg obiektów (mniej przejazdów)')], ['script', T('Wg kolejności w scenariuszu')]]} /></Field>
    <Field label={T('Zakres')}><Select data-act-change="ap-scope" value={ap.scope} onChange={(v) => setUI((s) => { s.ap.scope = v; })} options={[['unscheduled', T('Tylko niezaplanowane ({n})', { n: unsched })], ['all', T('Od nowa (zastąpi cały plan)')]]} /></Field>
    <label className="chk"><input type="checkbox" data-act-change="ap-night" checked={ap.separateNight} onChange={(e) => { const c = e.target.checked; setUI((s) => { s.ap.separateNight = c; }); }} /> {T('Osobne dni dla scen nocnych, świtu i zmierzchu')}</label>
    <Btn v="primary" act="autoplan-run" onClick={() => runAutoplan(ap)}>{T('Ułóż plan')}</Btn><Btn act="autoplan-toggle" onClick={() => setUI((s) => { s.autoplan = false; })}>{T('Anuluj')}</Btn></div>
    <p className="small muted" style={{ margin: '10px 0 0' }}>{ap.scope === 'all' && <span dangerouslySetInnerHTML={{ __html: T('<b>Uwaga:</b> plan od nowa usuwa dni zdjęciowe razem z ich planami pracy i kursami (dni specjalne zostają).') + ' ' }} />}{T('Do jednego dnia trafia najwyżej {n} str. scenariusza (limit zmienisz w ustawieniach). Później przeciągnij sceny, jak chcesz.', { n: +st.meta.pagesPerDay })}</p></div>;
}

/* ---------- dni + pula z przeciąganiem ---------- */
function DaysBoard({ st, unsched, nums, hrs, addDay }: { st: ProjectState; unsched: Scene[]; nums: Map<string, number | null>; hrs: Map<string, any>; addDay: (k: string) => string }) {
  const pool = useUI((s) => s.pool);
  const [active, setActive] = useState<string | null>(null);
  const [drop, setDrop] = useState<DropState>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }));
  const sm = useMemo(() => new Map(st.scenes.map((s) => [s.id, s])), [st.scenes]);
  /** miejsce upuszczenia z pozycji wskaźnika: indeks wśród pasków strefy (bez przeciąganego) */
  const where = (zone: string | null, y: number): DropState => {
    if (!zone) return null;
    const el = document.querySelector(`[data-drop="${zone}"]`);
    if (!el || zone === 'pool') return { zone, index: 0 };
    const items = [...el.querySelectorAll(':scope > .mini-strip:not(.dragging)')];
    let index = items.length;
    for (let i = 0; i < items.length; i++) { const r = items[i].getBoundingClientRect(); if (y < r.top + r.height / 2) { index = i; break; } }
    return { zone, index };
  };
  // rzeczywiste położenie wskaźnika (delta biblioteki obejmuje też przewinięcie strony)
  const ptr = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const mv = (e: PointerEvent) => { ptr.current = { x: e.clientX, y: e.clientY }; };
    const tm = (e: TouchEvent) => { const t = e.touches[0]; if (t) ptr.current = { x: t.clientX, y: t.clientY }; };
    window.addEventListener('pointermove', mv, true); window.addEventListener('touchmove', tm, { capture: true, passive: true });
    return () => { window.removeEventListener('pointermove', mv, true); window.removeEventListener('touchmove', tm, true); };
  }, []);
  const pointer = (e: DragMoveEvent | DragEndEvent) => ptr.current || (start.current ? { x: start.current.x + e.delta.x, y: start.current.y + e.delta.y } : null);
  /** strefa pod wskaźnikiem (pula albo dzień) – liczona z położenia wskaźnika, niezależnie od pomiarów biblioteki */
  const zoneAt = (p: { x: number; y: number } | null, fallback: string | null) => {
    if (p) for (const el of document.elementsFromPoint(p.x, p.y)) { const z = (el as HTMLElement).closest?.('[data-drop]'); if (z) return z.getAttribute('data-drop'); }
    return fallback;
  };
  const onStart = (e: DragStartEvent) => {
    const ev = e.activatorEvent as PointerEvent | TouchEvent;
    const p = 'touches' in ev ? ev.touches[0] : ev;
    start.current = { x: p.clientX, y: p.clientY }; ptr.current = null;
    setActive(String(e.active.id));
  };
  const onMove = (e: DragMoveEvent) => { const p = pointer(e); const w = where(zoneAt(p, e.over ? String(e.over.id) : null), p ? p.y : 0); setDrop((d) => (d?.zone === w?.zone && d?.index === w?.index ? d : w)); };
  const onEnd = (e: DragEndEvent) => {
    const id = String(e.active.id);
    const p = pointer(e);
    const w = where(zoneAt(p, e.over ? String(e.over.id) : null), p ? p.y : 0);
    setActive(null); setDrop(null); start.current = null;
    if (!w) return;
    const target = w.zone === 'pool' ? '__pool' : w.zone.replace('day:', '');
    mutate((x) => { moveScenesToDay(x, [id], target, target === '__pool' ? null : w.index); });
  };
  const q = pool.q.toLowerCase();
  const list = unsched.filter((s) => !q || (s.num + ' ' + s.place + ' ' + s.site).toLowerCase().includes(q));
  let poolRows: ReactNode;
  if (pool.sort === 'site') {
    const groups = new Map<string, Scene[]>();
    list.forEach((s) => { const k = s.site || s.place || '—'; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(s); });
    poolRows = [...groups.entries()].map(([k, arr]) => <div key={k} style={{ display: 'contents' }}><div className="grp">{k} · {arr.length}</div>{arr.map((s) => <MiniStrip key={s.id} s={s} mode="pool" st={st} nums={nums} dragging={active === s.id} />)}</div>);
  } else {
    const arr = (pool.sort as string) === 'tod' ? list.slice().sort((a, b) => (Core.todClass(a.tod) === 'day' ? 0 : 1) - (Core.todClass(b.tod) === 'day' ? 0 : 1)) : list;
    poolRows = arr.map((s) => <MiniStrip key={s.id} s={s} mode="pool" st={st} nums={nums} dragging={active === s.id} />);
  }
  const poolEighths = unsched.reduce((a, s) => a + s.eighths, 0);
  const act = active ? sm.get(active) : null;
  return <DndContext sensors={sensors} collisionDetection={pointerWithin} autoScroll={false} onDragStart={onStart} onDragMove={onMove} onDragEnd={onEnd} onDragCancel={() => { setActive(null); setDrop(null); }}>
    <div className="sched">
      <aside className="card pool"><div className="card-h"><h3>{T('Do zaplanowania')}</h3><span className="chip acc">{unsched.length} · {Core.fmtEighths(poolEighths)} {T('str.')}</span></div>
        <div className="row" style={{ padding: '8px 8px 0' }}><input className="inp grow" id="pool-q" type="search" placeholder={T('Szukaj sceny…')} value={pool.q} aria-label={T('Szukaj w scenach do zaplanowania')} onChange={(e) => { const v = e.target.value; setUI((s) => { s.pool.q = v; }); }} />
          <Select className="mini" data-act-change="pool-sort" label={T('Sortowanie')} value={pool.sort} onChange={(v) => setUI((s) => { s.pool.sort = v as any; })} options={[['script', T('Wg scenariusza')], ['site', T('Wg obiektów')], ['tod', T('Dzień / noc')]]} /></div>
        <DropZone id="pool" className="pool-s" over={drop?.zone === 'pool'} scrollId="pool">{list.length ? poolRows : <div className="day-empty">{unsched.length ? T('Brak wyników.') : T('Wszystkie sceny są w planie.')}</div>}</DropZone></aside>
      <div className="days"><Datalist id="dl-sites-sp" items={sitesList(st)} />
        {st.days.length ? st.days.map((d, i) => d.kind === 'shoot'
          ? <ShootDay key={d.id} d={d} i={i} st={st} nums={nums} hrs={hrs} active={active} drop={drop?.zone === 'day:' + d.id ? drop.index : null} overZone={drop?.zone === 'day:' + d.id} />
          : <SpecialDay key={d.id} d={d} i={i} st={st} nums={nums} hrs={hrs} />)
          : <div className="card"><div className="empty"><h3>{T('Nie ma jeszcze dni zdjęciowych')}</h3><p>{T('Dodaj pierwszy dzień i przeciągnij do niego sceny albo pozwól Klapsowi ułożyć plan.')}</p>
            <div className="row" style={{ justifyContent: 'center' }}>{st.scenes.length > 0 && <Btn v="primary" big act="autoplan-run-first" onClick={() => runAutoplan({ strategy: 'site', scope: 'unscheduled', separateNight: true })}>{T('Ułóż plan automatycznie')}</Btn>}<Btn big act="day-add" icon="plus" onClick={() => addDay('shoot')}>{T('Dodaj dzień')}</Btn></div></div></div>}
      </div>
    </div>
    <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(.2,.7,.2,1)' }}>{act ? <div className={`mini-strip drag-ghost ${kcls(act)}`}><span className="g"><Icon n="grip" /></span><span className="n">{act.num}</span><div className="t"><b>{act.place || act.site}</b></div><span className="p">{Core.fmtEighths(act.eighths)}</span></div> : null}</DragOverlay>
  </DndContext>;
}

function DropZone({ id, className, over, children, scrollId }: { id: string; className: string; over: boolean; children: ReactNode; scrollId?: string }) {
  const { setNodeRef } = useDroppable({ id });
  return <div ref={setNodeRef} className={cx(className, over && 'over-zone')} data-drop={id} data-scroll-id={scrollId}>{children}</div>;
}

const MiniStrip = memo(function MiniStrip({ s, mode, st, nums, dayId, dragging }: { s: Scene; mode: 'pool' | 'day'; st: ProjectState; nums: Map<string, number | null>; dayId?: string; dragging: boolean }) {
  const prog = Core.shotProgress(st);
  const shot = prog.doneScenes.has(s.id) ? 'done' : prog.partScenes.has(s.id) ? 'part' : '';
  const { attributes, listeners, setNodeRef } = useDraggable({ id: s.id });
  const shootOpts = st.days.filter((d) => d.kind === 'shoot' && d.id !== dayId).map((d) => [d.id, dayLabel(d, nums)] as [string, string]);
  const move = (v: string) => mutate((x) => { moveScenesToDay(x, [s.id], v); });
  const open = () => setUI((u) => { u.drawer = s.id; u.showScript = false; });
  const cast = s.cast.slice().sort((a, b) => a - b).join(', ');
  const onPointerDown = (e: React.PointerEvent) => { if ((e.target as HTMLElement).closest('select, input, button')) return; listeners?.onPointerDown?.(e as any); };
  const common = {
    ref: setNodeRef, ...attributes, role: 'button', tabIndex: 0, 'aria-roledescription': T('scena do przeciągnięcia'),
    className: cx('mini-strip', kcls(s), dragging && 'dragging'), 'data-drag': '1', 'data-sid': s.id, 'data-act': 'scene-open', 'data-id': s.id,
    onPointerDown, onTouchStart: listeners?.onTouchStart as any,
    onClick: (e: React.MouseEvent) => { if ((e.target as HTMLElement).closest('select, input, button')) return; open(); },
    onKeyDown: (e: React.KeyboardEvent) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); open(); } },
  };
  if (mode === 'pool') {
    return <div {...common} title={T('Przeciągnij na dzień zdjęciowy')}>
      <span className="g" aria-hidden="true"><Icon n="grip" /></span><span className="n">{s.num}</span>
      <div className="t"><b>{s.place || s.site}</b><span>{Core.IE_LABEL[s.ie] || ''} {(Core.TOD[s.tod] || {}).label || ''}{cast ? ' · ' + cast : ''}</span></div>
      <span className="p">{Core.fmtEighths(s.eighths)}</span>
      <ActionSelect data-act-change="pool-to-day" data-sid={s.id} label={T('Dodaj scenę {n} do dnia', { n: s.num })} placeholder={T('Dodaj…')} options={[...shootOpts, ['__new', T('+ nowy dzień')]]} onPick={move} /></div>;
  }
  return <div {...common} title={T('Przeciągnij, aby zmienić kolejność lub przenieść do innego dnia')}>
    <span className="g" aria-hidden="true"><Icon n="grip" /></span><span className="n">{s.num}</span><span className="ie">{Core.IE_LABEL[s.ie] || ''} {(Core.TOD[s.tod] || {}).short || ''}</span>
    <div className="t"><b>{s.place || s.site}</b></div><div className="t syn"><span>{s.synopsis}</span></div>
    <span className="cs" title={T('Obsada')}>{cast}</span><span className="p">{Core.fmtEighths(s.eighths)}{shot && <ShotMark v={shot} />}</span>
    <ActionSelect data-act-change="day-move" data-sid={s.id} label={T('Przenieś scenę {n}', { n: s.num })} placeholder={T('Przenieś…')} options={[['__pool', T('Do zaplanowania')], ...shootOpts]} onPick={move} /></div>;
});

function KindSelect({ d }: { d: Day }) {
  return <Select className="kind-sel" data-act-change="day-kind" bid={d.id} label={T('Rodzaj dnia')} value={d.kind} options={Core.DAY_KINDS.map(([k, l]: [string, string]) => [k, T(l)])}
    onChange={(v) => { let n = 0; mutate((x) => { n = Core.setDayKind(x, d.id, v); }); if (n) toast(T('{n} wróciło do puli „Do zaplanowania”.', { n: `${n} ${pl(n, 'scena', 'sceny', 'scen')}` })); }} />;
}
function DayMenu({ d, i, last }: { d: Day; i: number; last: boolean }) {
  return <div className="day-menu">
    <Btn act="day-up" data-id={d.id} title={T('Przesuń dzień wyżej')} aria-label={T('Przesuń dzień wyżej')} disabled={i === 0} onClick={() => mutate((x) => { Core.moveDay(x, d.id, -1); Core.recalcDates(x); })}><Icon n="up" /></Btn>
    <Btn act="day-down" data-id={d.id} title={T('Przesuń dzień niżej')} aria-label={T('Przesuń dzień niżej')} disabled={last} onClick={() => mutate((x) => { Core.moveDay(x, d.id, 1); Core.recalcDates(x); })}><Icon n="down" /></Btn>
    <Btn act="day-del" data-id={d.id} title={T('Usuń dzień')} aria-label={T('Usuń dzień')} onClick={() => {
      const n = d.sceneIds.length; mutate((x) => { Core.removeDay(x, d.id); });
      toast(n ? T('Dzień usunięty. {n} do puli.', { n: `${n} ${pl(n, 'scena wróciła', 'sceny wróciły', 'scen wróciło')}` }) : T('Dzień usunięty.'));
    }}><Icon n="trash" /></Btn></div>;
}
const WarnBar = ({ warns }: { warns: string[] }) => (warns.length ? <div className="day-warn">{warns.map((w, i) => <span key={i}>⚠ {w}</span>)}</div> : null);
const updDay = (id: string, fn: (d: Day) => void) => mutate((x) => { const d = x.days.find((y) => y.id === id); if (d) fn(d); });

function SpecialDay({ d, i, st, nums, hrs }: { d: Day; i: number; st: ProjectState; nums: Map<string, number | null>; hrs: Map<string, any> }) {
  const off = d.kind === 'off';
  const crewN = off ? 0 : st.crew.filter((c) => Core.crewWorks(c, d)).length;
  const warns: string[] = Core.dayWarnings(st, d, hrs);
  return <section className={`day sp sp-${d.kind}`} data-day={d.id} id={'day-' + d.id}><header className="day-h">
    <div className="day-no">{Core.dayTitle(d, nums)}</div>
    <input className="inp" type="date" value={d.date || ''} data-bind="day.date" data-id={d.id} aria-label={T('Data')} onChange={(e) => { const v = e.target.value; updDay(d.id, (x) => { x.date = v; }); }} /><span className="dow">{d.date ? Core.dayName(d.date) : ''}</span>
    {!off && <><label className="lab">{T('Start')} <input className="inp" type="time" value={d.call || ''} data-bind="day.call" data-id={d.id} onChange={(e) => { const v = e.target.value; updDay(d.id, (x) => { x.call = v; }); }} /></label>
      <label className="lab">{T('Koniec')} <input className="inp" type="time" value={d.end || ''} data-bind="day.end" data-id={d.id} onChange={(e) => { const v = e.target.value; updDay(d.id, (x) => { x.end = v; }); }} /></label></>}
    <div className="day-sum">{!off && <span className="small">{T('poza numeracją dni zdjęciowych')}</span>}</div>
    <DayMenu d={d} i={i} last={i === st.days.length - 1} /></header>
    <WarnBar warns={warns} />
    <div className="sp-body">{off
      ? <><Field label={T('Notatka')} style={{ flex: '3 1 260px' }}><TextInput placeholder={T('Notatka (np. odpoczynek ekipy)')} value={d.note} bind="day.note" bid={d.id} onCommit={(v) => updDay(d.id, (x) => { x.note = v; })} /></Field><Field label={T('Rodzaj dnia')} className="kind-f"><KindSelect d={d} /></Field></>
      : <><Field label={T('Lokacja / obiekt')}><TextInput list="dl-sites-sp" value={d.site || ''} bind="day.site" bid={d.id} placeholder={d.kind === 'travel' ? T('np. Warszawa → Zakopane') : T('obiekt, w którym trwają prace')} onCommit={(v) => updDay(d.id, (x) => { x.site = v; })} /></Field>
        <Field label={T('Opis prac i uwagi (trafiają do wydruku)')} style={{ flex: '2 1 260px' }}><TextInput value={d.note} bind="day.note" bid={d.id} placeholder={T('np. ustawienie światła, przejazd ekipy, budowa wnętrza…')} onCommit={(v) => updDay(d.id, (x) => { x.note = v; })} /></Field>
        <Field label={T('Rodzaj dnia')} className="kind-f"><KindSelect d={d} /></Field>
        <div className="sp-crew"><span className="lbl">{T('Ekipa tego dnia')}</span><Btn sm act="crew-days-open" onClick={() => { setUI((s) => { s.crewView = 'days'; }); goTab('crew'); window.scrollTo(0, 0); }}>{plN(crewN, 'osoba', 'osoby', 'osób')}</Btn></div></>}</div></section>;
}

function ShootDay({ d, i, st, nums, hrs, active, drop, overZone }: { d: Day; i: number; st: ProjectState; nums: Map<string, number | null>; hrs: Map<string, any>; active: string | null; drop: number | null; overZone: boolean }) {
  const ds = Core.dayStats(st, d);
  const warns: string[] = Core.dayWarnings(st, d, hrs);
  const cap = Core.maxEighths(st.meta);
  const pct = Math.min(100, Math.round((ds.eighths / cap) * 100));
  const h = hrs.get(d.id);
  const cm = Core.castMap(st);
  // pozycja linii upuszczenia liczona bez przeciąganego paska
  const strips: ReactNode[] = [];
  let k = 0;
  ds.scenes.forEach((s: Scene) => {
    const isActive = s.id === active;
    if (!isActive && drop === k) strips.push(<div key="line" className="drop-line" />);
    strips.push(<MiniStrip key={s.id} s={s} mode="day" st={st} nums={nums} dayId={d.id} dragging={isActive} />);
    if (!isActive) k++;
  });
  if (drop != null && drop >= k && k > 0) strips.push(<div key="line" className="drop-line" />);
  return <section className="day" data-day={d.id} id={'day-' + d.id}><header className="day-h">
    <div className="day-no">{T('Dzień')}<b>{nums.get(d.id)}</b></div>
    <input className="inp" type="date" value={d.date || ''} data-bind="day.date" data-id={d.id} aria-label={T('Data dnia zdjęciowego')} onChange={(e) => { const v = e.target.value; updDay(d.id, (x) => { x.date = v; }); }} /><span className="dow">{d.date ? Core.dayName(d.date) : ''}</span>
    <label className="lab">{T('Zbiórka')} <input className="inp" type="time" value={d.call || ''} data-bind="day.call" data-id={d.id} onChange={(e) => { const v = e.target.value; updDay(d.id, (x) => { x.call = v; }); }} /></label>
    {h && h.known && <span className="lab hrs" title={T('Z planu pracy')}>{T('Koniec')} <b>{Core.clock(h.end)}</b> · {Core.fmtDur(h.work)}</span>}
    <div className="day-sum"><b>{ds.scenes.length}</b> {pl(ds.scenes.length, 'scena', 'sceny', 'scen')} · <b>{Core.fmtEighths(ds.eighths)}</b> {T('str.')}<div className={cx('load', ds.eighths > cap && 'over')} title={T('Obłożenie dnia: {p}% limitu {n} str.', { p: pct, n: +st.meta.pagesPerDay })}><i style={{ width: pct + '%' }} /></div></div>
    <DayMenu d={d} i={i} last={i === st.days.length - 1} /></header>
    <WarnBar warns={warns} />
    <DropZone id={'day:' + d.id} className="day-body" over={overZone}>{ds.scenes.length ? strips : <div className="day-empty">{T('Przeciągnij tu sceny z listy „Do zaplanowania”.')}</div>}</DropZone>
    <div className="day-f"><div><div className="lbl">{T('Obsada dnia')}</div><div className="chips">{ds.castIds.length ? ds.castIds.slice().sort((a: number, b: number) => a - b).map((id: number) => cm.get(id)).filter(Boolean).map((c: any) => <span key={c.id} className="chip" title={c.name + (c.actor ? ' – ' + c.actor : '')}><b>{c.id}</b> {c.name}</span>) : <span className="muted">—</span>}</div>
      <div className="lbl" style={{ marginTop: 8 }}>{T('Obiekty')}</div><div className="chips">{ds.sites.length ? ds.sites.map((x: string) => <span key={x} className="chip">{x}</span>) : <span className="muted">—</span>}</div>
      <div className="lbl" style={{ marginTop: 8 }}>{T('Rodzaj dnia')}</div><KindSelect d={d} /></div>
      <Field label={T('Uwagi do dnia (trafiają do wydruku)')}><TextArea rows={3} value={d.note} bind="day.note" bid={d.id} placeholder={T('np. zezwolenie na plan, rekwizyty z magazynu, dojazd…')} onCommit={(v) => updDay(d.id, (x) => { x.note = v; })} /></Field></div></section>;
}

/* ---------- widok miesiąca ---------- */
function Month({ st, nums }: { st: ProjectState; nums: Map<string, number | null> }) {
  const month = useUI((s) => s.month);
  const dated = st.days.filter((d) => d.date);
  const ym = month || (dated.map((d) => d.date).sort()[0] || st.meta.startDate || Core.todayISO()).slice(0, 7);
  const [Y, M] = ym.split('-').map(Number);
  const first = new Date(Date.UTC(Y, M - 1, 1));
  const offset = (first.getUTCDay() + 6) % 7;
  const dim = new Date(Date.UTC(Y, M, 0)).getUTCDate();
  const cells = Math.ceil((offset + dim) / 7) * 7;
  const byDate = new Map<string, Day[]>();
  st.days.forEach((d) => { if (!byDate.has(d.date)) byDate.set(d.date, []); byDate.get(d.date)!.push(d); });
  const today = Core.todayISO();
  const shift = (n: number) => { const d = new Date(Date.UTC(Y, M - 1 + n, 1)); const v = d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); setUI((s) => { s.month = v; }); };
  const goto = (id: string) => { setUI((s) => { s.calView = 'days'; }); scrollToDay(id); };
  const grid: ReactNode[] = [1, 2, 3, 4, 5, 6, 0].map((x) => <div key={'h' + x} className="dn">{Core.DAYS_SHORT[x]}</div>);
  for (let c = 0; c < cells; c++) {
    const dnum = c - offset + 1;
    const dt = new Date(Date.UTC(Y, M - 1, dnum));
    const iso = Core.isoOf(dt);
    const out = dnum < 1 || dnum > dim, dw = dt.getUTCDay();
    grid.push(<div key={iso} className={cx('mcell', out && 'out', (dw === 0 || dw === 6) && 'we', iso === today && 'today')}><span className="d">{dt.getUTCDate()}</span>
      {(byDate.get(iso) || []).map((d) => {
        if (d.kind !== 'shoot') return <button type="button" key={d.id} className={`mchip sp sp-${d.kind}`} data-act="goto-day" data-id={d.id} onClick={() => goto(d.id)}><b>{Core.dayTag(d, nums)}</b><div className="meta">{d.site || d.note || ''}</div></button>;
        const ds = Core.dayStats(st, d);
        return <button type="button" key={d.id} className="mchip" data-act="goto-day" data-id={d.id} onClick={() => goto(d.id)}><b>D{nums.get(d.id)}</b> <span className="meta">{ds.scenes.length} {T('sc.')} · {Core.fmtEighths(ds.eighths)} {T('str.')}</span>
          <div className="meta small muted">{d.call || ''}{ds.sites[0] ? ' · ' + ds.sites[0].toLowerCase() : ''}</div><div className="dots">{ds.scenes.map((s: Scene) => <i key={s.id} className={kcls(s)} />)}</div></button>;
      })}</div>);
  }
  return <div className="month"><div className="month-h"><Btn sm act="month-prev" aria-label={T('Poprzedni miesiąc')} onClick={() => shift(-1)}><Icon n="left" /></Btn><h3>{Core.MONTHS_NOM[M - 1]} {Y}</h3><Btn sm act="month-next" aria-label={T('Następny miesiąc')} onClick={() => shift(1)}><Icon n="right" /></Btn><Btn sm v="ghost" act="month-today" onClick={() => setUI((s) => { s.month = null; })}>{T('Początek zdjęć')}</Btn></div><div className="mgrid">{grid}</div></div>;
}
