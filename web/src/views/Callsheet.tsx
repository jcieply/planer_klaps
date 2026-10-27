/* Plan pracy (call sheet) dnia zdjęciowego: harmonogram z godzinami liczonymi od zbiórki, obsada, transport, kontakty, mapki. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { DndContext, PointerSensor, KeyboardSensor, closestCenter, useSensor, useSensors, type DragEndEvent, type Modifier } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { I18N, T, T_ } from '../domain/i18n';
import { Core } from '../domain/core';
import type { Day, ProjectState, Sheet } from '../domain/model';
import { loadImageFile } from '../domain/files';
import { mutate, useProject } from '../state/project';
import { goTab, setUI, toast, useUI } from '../state/ui';
import { doExport, loadWeather } from '../state/actions';
import { dayLabel, kcls, mediaSrc, plN } from '../lib/format';
import { insertRow } from '../lib/helpers';
import { ActionSelect, Btn, DurInput, ExportBtns, Field, Icon, PageHead, Select, TextArea, TextInput, TimeInput, cx } from '../components/ui';
import { NoDays, confirmTwice } from '../components/common';

export const ROW_PRESETS: [string, number][] = [[T_('Zbiórka ekipy'), 30], [T_('Charakteryzacja i kostiumy'), 60], [T_('Omówienie techniczne'), 15], [T_('Próba'), 20], [T_('Przejazd'), 30], [T_('Przerwa na obiad'), 45], [T_('Przerwa techniczna / przebudowa'), 30], [T_('Koniec zdjęć w lokacji'), 0], [T_('Koniec zdjęć'), 0], [T_('Rozładunek sprzętu'), 30]];

const sheetUpd = (dayId: string, fn: (sh: Sheet) => void) => mutate((x) => { fn(Core.ensureSheet(x, dayId)); });
const rowUpd = (dayId: string, rid: string, fn: (r: any) => void) => mutate((x) => { const r = Core.activeRows(x, dayId).find((y: any) => y.id === rid); if (r) fn(r); });

/** harmonogram dnia musi istnieć w projekcie (stałe identyfikatory wierszy); synchronizacja nie trafia do historii cofania */
function useSheetSync(st: ProjectState, dayId: string) {
  useEffect(() => {
    const cur = st.sheets[dayId];
    const sheets = { ...st.sheets };
    if (cur) sheets[dayId] = JSON.parse(JSON.stringify(cur)); else delete sheets[dayId];
    const tmp = { ...st, sheets } as ProjectState;
    Core.syncSheet(tmp, dayId);
    const next = tmp.sheets[dayId];
    if (JSON.stringify(next) === JSON.stringify(cur)) return;
    const t = useProject.temporal.getState();
    t.pause();
    mutate((x) => { x.sheets[dayId] = next; });
    t.resume();
  }, [st, dayId]);
}

export function Callsheet() {
  const st = useProject((s) => s.st)!;
  const csDay = useUI((s) => s.csDay);
  const days = st.days.filter((d) => d.kind === 'shoot');
  const day = days.find((d) => d.id === csDay) || days[0];
  if (!day) return <NoDays title={T('Plan pracy')} />;
  return <CallsheetDay key={day.id} st={st} day={day} days={days} />;
}

function CallsheetDay({ st, day, days }: { st: ProjectState; day: Day; days: Day[] }) {
  const id = day.id;
  useSheetSync(st, id);
  const nums = Core.dayNumbers(st);
  const sh = Core.sheetOf(st, id);
  const cm = Core.castMap(st);
  const mode = sh.mode === 'shots' ? 'shots' : 'calendar';
  const rows = useMemo(() => Core.callRows(st, day), [st, day]);
  const times = Core.dayTimes(st, day);
  const hrs = Core.hoursCheck(st).get(id);
  const scs = Core.sheetScenes(st, day);
  const castIds: number[] = Core.sheetCastIds(st, day);
  const catRow = Core.catering(st).days.find((x: any) => x.id === id);
  const csPick = useUI((s) => s.csPick);
  const exp = (k: 'pdf' | 'xlsx') => doExport(k, ['callsheet'], ['plan_pracy_D{n}', { n: nums.get(id) }], { dayId: id });
  const right = <><Field label={T('Dzień zdjęciowy')}><Select data-act-change="cs-day" value={id} options={days.map((d) => [d.id, dayLabel(d, nums) + ' · ' + Core.dayName(d.date)] as [string, string])} onChange={(v) => setUI((s) => { s.csDay = v; })} /></Field>
    <ExportBtns prefix="cs-export" enabled onPdf={() => exp('pdf')} onXlsx={() => exp('xlsx')} /></>;
  const missing = mode === 'calendar' ? Core.dayStats(st, day).scenes.filter((s: any) => !rows.some((r: any) => r.kind === 'scene' && r.sceneId === s.id)).length : 0;
  const maxW = (+st.meta.maxWorkH || 12) * 60;
  const work = times && times.known ? times.work ?? 0 : null;
  const workCls = work == null ? '' : work > maxW ? 'bad' : work > maxW - 60 ? 'warn' : 'ok';
  const alerts = hrs ? hrs.alerts : [];
  const lunch = Core.lunchOf(st, day);
  const addPreset = (v: string) => {
    const pr = v === '__custom' ? null : ROW_PRESETS[+v];
    const row = Core.customRow(pr ? T(pr[0]) : '', pr ? pr[1] : null);
    mutate((x) => { insertRow(x, id, row, pr && /koniec/i.test(pr[0]) ? 'end' : 'beforeEnd'); });
    setTimeout(() => { const el = document.querySelector<HTMLTextAreaElement>(`textarea[data-bind="row.desc"][data-id="${id}|${row.id}"]`); if (el) el.focus(); }, 40);
  };
  const presetSel = <ActionSelect className="inp mini" data-act-change="row-preset" data-id={id} label={T('Dodaj pozycję do harmonogramu')} placeholder={T('+ Dodaj pozycję…')} options={[...ROW_PRESETS.map(([x], i) => [String(i), T(x)] as [string, string]), ['__custom', T('Własna pozycja…')]]} onPick={addPreset} />;
  const tools = mode === 'calendar'
    ? <>{presetSel}{missing > 0 && <Btn sm act="row-restore" data-id={id} title={T('Dodaje wiersze usuniętych scen tego dnia')} onClick={() => mutate((x) => { Core.syncSheet(x, id, true); })}>{T('Przywróć {n}', { n: plN(missing, 'scenę', 'sceny', 'scen') })}</Btn>}</>
    : <>{presetSel}<Btn sm className={csPick ? 'on' : ''} act="cs-pick-toggle" aria-expanded={csPick} onClick={() => setUI((s) => { s.csPick = !s.csPick; })}>{T('Wybierz ujęcia z shotlisty')}</Btn>
      <Btn sm v="ghost" act="cs-rebuild" data-id={id} title={T('Układa harmonogram od nowa z ujęć scen tego dnia')} onClick={() => {
        if (!confirmTwice('rebuild:' + id)) { toast(T('Kliknij jeszcze raz, aby ułożyć harmonogram od nowa z ujęć scen tego dnia (zmiany w trybie shotlisty przepadną).'), 'bad'); return; }
        mutate((x) => { Core.initShotRows(x, id); });
      }}>{T('Odbuduj z kalendarzówki')}</Btn></>;
  const field = (label: string, key: 'crewCall' | 'sunrise' | 'sunset', ph: string) => <Field label={label}><TimeInput value={sh[key]} placeholder={ph} bind={'sheet.' + key} bid={id} label={label} onCommit={(v) => sheetUpd(id, (x) => { x[key] = v; })} /></Field>;
  return <>
    <PageHead title={T('Plan pracy')} sub={T('Call sheet dla wybranego dnia. Wpisujesz czas realizacji i przestawki, a godziny liczą się same od zbiórki ekipy. Harmonogram możesz budować ze scen z kalendarzówki albo z ujęć z shotlisty.')} right={right} />
    {alerts.length > 0 && <div className="notice bad cs-alerts"><div><Icon n="warn" /></div><div><b>{T('Ostrzeżenia czasu pracy')}</b><ul>{alerts.map((a: any, i: number) => <li key={i}>{a.text}</li>)}</ul></div></div>}
    <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h2>{T('Dzień {n}', { n: nums.get(id) })}</h2><span className="muted">{Core.fmtDatePL(day.date)}</span>
      <span className="chip" style={{ marginLeft: 'auto' }}>{plN(scs.length, 'scena', 'sceny', 'scen')} · {Core.fmtEighths(scs.reduce((a: number, s: any) => a + s.eighths, 0))} {T('str.')}</span>
      {catRow && catRow.total > 0 && <button type="button" className="chip acc chip-btn" data-act="crew-cat-open" title={T('Raport cateringowy')} onClick={() => { setUI((s) => { s.crewView = 'catering'; }); goTab('crew'); window.scrollTo(0, 0); }}>{Core.cateringLine(catRow)}</button>}</div>
      <div className="card-b"><div className="fgrid cs-grid">{field(T('Zbiórka ekipy'), 'crewCall', day.call || 'hh:mm')}{field(T('Wschód słońca'), 'sunrise', 'hh:mm')}{field(T('Zachód słońca'), 'sunset', 'hh:mm')}
        <div className="field wx-f" style={{ gridColumn: 'span 2' }}><span className="lbl">{T('Prognoza pogody')}
            <button type="button" className="wx-btn" data-act="wx-load" data-id={id} onClick={() => void loadWeather([id], false, true)} title={T('Prognoza z open-meteo.com dla lokacji dnia')}><Icon n="cloud" />{sh.wx ? T('Odśwież') : T('Pobierz prognozę')}</button></span>
          <TextInput value={sh.weather} bind="sheet.weather" bid={id} label={T('Prognoza pogody')} placeholder={T('np. zachmurzenie, 8°C, deszcz po południu')} onCommit={(v) => sheetUpd(id, (x) => { x.weather = v; })} />
          {sh.wx && <span className="wx-src small muted">{sh.wx.place} · {T('pobrano {t}', { t: new Date(sh.wx.at).toLocaleString(I18N.lang === 'en' ? 'en-GB' : 'pl-PL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) })} · open-meteo.com</span>}</div>
        <Field label={T('Szpital / pogotowie')} style={{ gridColumn: 'span 2' }}><TextInput value={sh.hospital} bind="sheet.hospital" bid={id} label={T('Szpital')} placeholder={T('adres i telefon najbliższego szpitala')} onCommit={(v) => sheetUpd(id, (x) => { x.hospital = v; })} /></Field></div></div></div>
    <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h3>{T('Harmonogram dnia')}</h3>
      <div className="seg mode-seg" role="group" aria-label={T('Źródło harmonogramu')}>{(['calendar', 'shots'] as const).map((v) => <button type="button" key={v} data-act="cs-mode" data-id={id} data-v={v} aria-pressed={mode === v} onClick={() => {
        let picked = false; mutate((x) => { const s2 = Core.setSheetMode(x, id, v); picked = s2.mode === 'shots' && !(s2.srows || []).some((r: any) => r.kind === 'shot'); }); setUI((s) => { s.csPick = picked; });
      }}>{v === 'calendar' ? T('Z kalendarzówki') : T('Z shotlisty')}</button>)}</div>
      <div className="row" style={{ marginLeft: 'auto' }}>{tools}</div></div>
      <div className="cs-sum"><span><span className="lbl">{T('Zbiórka')}</span><b className="num">{Core.minToTime(times ? times.start : Core.dayStart(st, day, sh))}</b></span>
        <span><span className="lbl">{T('Koniec')}</span><b className="num">{times && times.known ? Core.clock(times.end) : '—'}</b></span>
        <span className={workCls}><span className="lbl">{T('Czas pracy')}</span><b className="num">{times && times.known ? Core.fmtDur(times.work) : '—'}</b><small>{T('limit {n} h', { n: +st.meta.maxWorkH || 12 })}</small></span>
        <span className={cx('lunch', !lunch && 'none')}><span className="lbl">{T('Obiad')}</span><b className="num">{lunch ? lunch.from : '—'}</b><small>{lunch ? (lunch.dur ? Core.fmtHM(lunch.dur) + ' h' : '') : T('dodaj „Przerwa na obiad”')}</small></span>
        {hrs && hrs.restBefore != null && <span className={hrs.restBefore < (+st.meta.minRestH || 11) * 60 ? 'bad' : 'ok'}><span className="lbl">{T('Odpoczynek przed')}</span><b className="num">{hrs.restBefore < 0 ? '—' : Core.fmtDur(hrs.restBefore)}</b><small>{T('min. {n} h', { n: +st.meta.minRestH || 11 })}</small></span>}</div>
      {mode === 'shots' && csPick && <ShotPicker st={st} day={day} />}
      {rows.length ? <RowsTable st={st} id={id} rows={rows} /> : <div className="empty"><p>{mode === 'shots' ? T('Harmonogram jest pusty. Wybierz ujęcia z shotlisty albo dodaj pozycję.') : T('Harmonogram jest pusty. Dodaj pozycję albo sceny do tego dnia w kalendarzówce.')}</p></div>}
      <p className="small muted" style={{ margin: 0, padding: '8px 14px 12px' }} dangerouslySetInnerHTML={{ __html: T('<b>Przest.</b> to przestawka lub przygotowanie przed pozycją, <b>Czas</b> to czas realizacji (h:mm albo minuty). Godzina „Od” liczy się sama; wpisz ją tylko dla pozycji o stałej porze, np. obiadu. Szare czasy pochodzą z ETA w shotliście.') }} /></div>
    <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h3>{T('Obsada i zbiórki')}</h3><span className="muted small">{T('pusta zbiórka = zbiórka ekipy z kalendarzówki')}</span></div>
      {castIds.length ? <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl"><thead><tr><th>{T('Nr')}</th><th>{T('Postać')}</th><th>{T('Aktor / aktorka')}</th><th>{T('Zbiórka')}</th><th>{T('Charakteryzacja')}</th><th>{T('Na plan')}</th><th>{T('Sceny')}</th><th>{T('Uwagi')}</th></tr></thead>
        <tbody>{castIds.map((cid) => {
          const c = cm.get(cid); if (!c) return null;
          const cc = (sh.cast || {})[cid] || {}, key = id + '|' + cid;
          const set = (k: 'call' | 'makeup' | 'onset' | 'note') => (v: string) => sheetUpd(id, (x) => { x.cast[cid] = x.cast[cid] || {}; x.cast[cid][k] = v; });
          return <tr key={cid}><td className="num"><b>{c.id}</b></td><td><b>{c.name}</b></td><td>{c.actor}</td>
            <td><TimeInput className="tm" value={cc.call || ''} placeholder={day.call || ''} bind="sheetcast.call" bid={key} label={T('Zbiórka') + ' ' + c.name} onCommit={set('call')} /></td>
            <td><TimeInput className="tm" value={cc.makeup || ''} bind="sheetcast.makeup" bid={key} label={T('Charakteryzacja') + ' ' + c.name} onCommit={set('makeup')} /></td>
            <td><TimeInput className="tm" value={cc.onset || ''} bind="sheetcast.onset" bid={key} label={T('Na plan') + ' ' + c.name} onCommit={set('onset')} /></td>
            <td className="small">{scs.filter((s: any) => s.cast.includes(cid)).map((s: any) => s.num).join(', ')}</td>
            <td><TextInput value={cc.note || ''} bind="sheetcast.note" bid={key} placeholder={T('uwagi, kostium…')} label={T('Uwagi') + ' ' + c.name} onCommit={set('note')} /></td></tr>;
        })}</tbody></table></div> : <div className="empty"><p>{T('W scenach tego dnia nie ma postaci.')}</p></div>}</div>
    <div className="imp-grid" style={{ marginBottom: 16 }}><LocTransport st={st} day={day} sh={sh} /><Contacts st={st} id={id} sh={sh} castIds={castIds} /></div>
    <Maps st={st} dayId={id} sh={sh} />
    <div className="card"><div className="card-h"><h3>{T('Elementy kamerowe i uwagi')}</h3></div><div className="card-b fgrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
      <Field label={T('Elementy kamerowe dnia')}><TextArea rows={3} value={sh.cameraNotes} bind="sheet.cameraNotes" bid={id} placeholder={T('mocowania, sprzęt, obiektywy, szczególne wymagania')} onCommit={(v) => sheetUpd(id, (x) => { x.cameraNotes = v; })} /></Field>
      <Field label={T('Uwagi do dnia (z kalendarzówki)')}><TextArea rows={3} value={day.note} bind="day.note" bid={id} onCommit={(v) => mutate((x) => { const d = x.days.find((y) => y.id === id); if (d) d.note = v; })} /></Field>
      <Field label={T('Dodatkowe uwagi na plan pracy')}><TextArea rows={3} value={sh.notes} bind="sheet.notes" bid={id} placeholder={T('zgody, bezpieczeństwo, parking, catering…')} onCommit={(v) => sheetUpd(id, (x) => { x.notes = v; })} /></Field></div></div>
  </>;
}

/* ---------- tabela harmonogramu (kolejność: przeciąganie uchwytem albo strzałki) ---------- */
const vertical: Modifier = ({ transform }) => ({ ...transform, x: 0 });
function RowsTable({ st, id, rows }: { st: ProjectState; id: string; rows: any[] }) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));
  const sm = new Map(st.scenes.map((s) => [s.id, s]));
  const onEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    mutate((x) => { const list = Core.activeRows(x, id); const i = list.findIndex((r: any) => r.id === e.active.id), j = list.findIndex((r: any) => r.id === e.over!.id); if (i < 0 || j < 0) return; const next = arrayMove(list, i, j); list.splice(0, list.length, ...next); });
  };
  const move = (rid: string, dir: number) => mutate((x) => { const list = Core.activeRows(x, id), i = list.findIndex((r: any) => r.id === rid), j = i + dir; if (i < 0 || j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; });
  return <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }} data-scroll-id="cs-tbl"><DndContext sensors={sensors} collisionDetection={closestCenter} modifiers={[vertical]} onDragEnd={onEnd}>
    <table className="tbl sched-tbl"><thead><tr><th title={T('Przestawka / przygotowanie przed pozycją')}>{T('Przest.')}</th><th>{T('Czas')}</th><th>{T('Od')}</th><th>{T('Do')}</th><th>{T('Sc.')}</th><th>{T('Ujęcie')}</th><th>{T('Opis / plan')}</th><th>{T('Obsada')}</th><th>{T('Elementy kamerowe')}</th><th>{T('Uwagi')}</th><th /></tr></thead>
      <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}><tbody>
        {rows.map((r, i) => <RowItem key={r.id} id={id} r={r} sc={r.sceneId ? sm.get(r.sceneId) : null} first={i === 0} last={i === rows.length - 1} move={move} />)}
      </tbody></SortableContext></table></DndContext></div>;
}
function RowItem({ id, r, sc, first, last, move }: { id: string; r: any; sc: any; first: boolean; last: boolean; move: (rid: string, dir: number) => void }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: r.id });
  const key = id + '|' + r.id, sceneLike = r.kind !== 'custom';
  const durAuto = !r.durSet && r.durDef != null;
  const style: React.CSSProperties = { transform: CSS.Translate.toString(transform), transition, ...(sc ? { background: 'var(--sb)', color: 'var(--s-ink)' } : {}), ...(isDragging ? { position: 'relative', zIndex: 3, boxShadow: '0 8px 24px rgba(0,0,0,.35)' } : {}) };
  const set = (k: string) => (v: string) => rowUpd(id, r.id, (x) => { x[k] = v; });
  const setMin = (k: 'dur' | 'prep') => (v: string) => rowUpd(id, r.id, (x) => { x[k] = v.trim() === '' ? null : Core.etaMin(v); });
  return <>
    {r.prep > 0 && !isDragging && <tr className="prep-row"><td /><td /><td className="num muted">{Core.minToTime(r.fromMin - r.prep)}</td><td className="num muted">{r.from}</td><td colSpan={7} className="muted small">{T('Przestawka / przygotowanie')} · {Core.fmtHM(r.prep)}</td></tr>}
    <tr ref={setNodeRef} className={sc ? `${kcls(sc)}${r.kind === 'shot' ? ' shot-row' : ''}` : 'cu'} style={style}>
      <td style={{ width: 70 }}><DurInput className="tm" value={r.prepSet && r.prep ? Core.fmtHM(r.prep) : ''} placeholder="0:00" bind="row.prep" bid={key} label={T('Przestawka przed pozycją')} title={T('Przestawka / przygotowanie przed tą pozycją (h:mm albo minuty)')} onCommit={setMin('prep')} /></td>
      <td style={{ width: 70 }}><DurInput className={cx('tm', durAuto && 'auto')} value={r.durSet ? Core.fmtHM(r.dur) : ''} placeholder={r.durDef != null ? Core.fmtHM(r.durDef) : '0:00'} bind="row.dur" bid={key} label={T('Czas realizacji')} title={durAuto ? T('Z ETA shotlisty. Wpisz własny czas, aby go zmienić.') : T('Czas realizacji (h:mm albo minuty)')} onCommit={setMin('dur')} /></td>
      <td style={{ width: 84 }}><div className="tcell"><TimeInput className={cx('tm', r.fixed && 'fixed', r.overlap && 'clash')} value={r.fix} placeholder={r.from} bind="row.fix" bid={key} label={T('Stała godzina rozpoczęcia')} title={r.fixed ? T('Stała godzina. Usuń ją, aby godzina liczyła się sama.') : T('Godzina liczy się sama. Wpisz ją tylko dla pozycji o stałej porze (np. obiad 13:00).')} onCommit={set('fix')} />
        {r.fixed && <small className="pin"><Icon n="pin" />{r.overlap ? T('kolizja') : r.gap ? T('czekanie {d}', { d: Core.fmtHM(r.gap) }) : T('stała')}</small>}</div></td>
      <td style={{ width: 58 }} className="c"><b className="num to">{r.to}</b>{r.nextDay && <small className="nd">+1</small>}</td>
      <td style={{ width: 62 }}><TextInput className="sc" value={r.num} placeholder={sceneLike ? '' : '–'} bind="row.num" bid={key} label={T('Numer sceny')} onCommit={set('num')} /></td>
      <td style={{ width: 70 }}><TextInput className="shot" value={r.shot} placeholder="–" bind="row.shot" bid={key} label={T('Ujęcie')} onCommit={set('shot')} /></td>
      <td style={{ minWidth: 230 }}><TextArea className="cell" rows={3} value={r.desc} placeholder={sceneLike ? '' : T('np. przerwa na obiad, koniec zdjęć…')} bind="row.desc" bid={key} label={T('Opis pozycji')} onCommit={set('desc')} /></td>
      <td style={{ minWidth: 90 }}><TextInput value={r.cast} bind="row.cast" bid={key} label={T('Obsada')} onCommit={set('cast')} /></td>
      <td style={{ minWidth: 160 }}><TextArea className="cell" rows={3} value={r.camera} placeholder={T('mocowania, obiektywy…')} bind="row.camera" bid={key} label={T('Elementy kamerowe')} onCommit={set('camera')} /></td>
      <td style={{ minWidth: 160 }}><TextArea className="cell" rows={3} value={r.notes} placeholder={T('uwagi')} bind="row.notes" bid={key} label={T('Uwagi')} onCommit={set('notes')} /></td>
      <td style={{ width: 120 }}><div className="rowact">
        <button type="button" ref={setActivatorNodeRef} className="btn sm ghost grip-h" {...attributes} {...listeners} aria-label={T('Przeciągnij, aby zmienić kolejność')} title={T('Przeciągnij, aby zmienić kolejność')}><Icon n="grip" /></button>
        <Btn sm v="ghost" act="row-up" data-id={id} data-rid={r.id} disabled={first} aria-label={T('Wyżej')} onClick={() => move(r.id, -1)}><Icon n="up" /></Btn>
        <Btn sm v="ghost" act="row-down" data-id={id} data-rid={r.id} disabled={last} aria-label={T('Niżej')} onClick={() => move(r.id, 1)}><Icon n="down" /></Btn>
        <Btn sm v="ghost danger" act="row-del" data-id={id} data-rid={r.id} aria-label={T('Usuń pozycję')} onClick={() => mutate((x) => { const list = Core.activeRows(x, id); const i = list.findIndex((y: any) => y.id === r.id); if (i >= 0) list.splice(i, 1); })}><Icon n="trash" /></Btn></div></td>
    </tr></>;
}

/* ---------- wybór ujęć z shotlisty ---------- */
function ShotPicker({ st, day }: { st: ProjectState; day: Day }) {
  const all = useUI((s) => s.csPickAll);
  const sh = Core.sheetOf(st, day.id);
  const inRows = new Set((sh.srows || []).filter((r: any) => r.kind === 'shot').map((r: any) => r.shotId));
  const used = Core.shotDays(st), nums = Core.dayNumbers(st);
  const byScene = new Map<string, any[]>();
  st.shots.forEach((x) => { if (!byScene.has(x.sceneId)) byScene.set(x.sceneId, []); byScene.get(x.sceneId)!.push(x); });
  if (!st.shots.length) return <div className="picker"><div className="empty" style={{ padding: 18 }}><p>{T('Shotlista jest pusta. Dodaj ujęcia w zakładce Shotlista, a potem wybierz je tutaj.')}</p><Btn act="tab" data-tab="shotlist" onClick={() => goTab('shotlist')}>{T('Przejdź do shotlisty')}</Btn></div></div>;
  const dayScenes = day.sceneIds.filter((sid) => byScene.has(sid));
  const other = st.scenes.map((s) => s.id).filter((sid) => byScene.has(sid) && !day.sceneIds.includes(sid));
  if (byScene.has('')) other.push('');
  const toggle = (xid: string) => mutate((x) => {
    const rows = Core.activeRows(x, day.id); const i = rows.findIndex((r: any) => r.kind === 'shot' && r.shotId === xid);
    if (i >= 0) rows.splice(i, 1); else { const s = x.shots.find((y) => y.id === xid); if (s) insertRow(x, day.id, Core.shotRowOf(s), 'scene'); }
  });
  const setScene = (sid: string, on: boolean) => mutate((x) => {
    const rows = Core.activeRows(x, day.id); const xs = x.shots.filter((y) => y.sceneId === sid);
    if (on) xs.forEach((s) => { if (!rows.some((r: any) => r.kind === 'shot' && r.shotId === s.id)) insertRow(x, day.id, Core.shotRowOf(s), 'scene'); });
    else { const ids = new Set(xs.map((s) => s.id)); for (let k = rows.length - 1; k >= 0; k--) if (rows[k].kind === 'shot' && ids.has(rows[k].shotId)) rows.splice(k, 1); }
  });
  const group = (sid: string) => {
    const sc = st.scenes.find((s) => s.id === sid), xs = byScene.get(sid) || [];
    const allOn = xs.every((x) => inRows.has(x.id));
    return <div key={sid || '_'} className="pk-grp"><div className="pk-h">{sc ? <><span className={'pk-sc ' + kcls(sc)}>{sc.num}</span> {sc.place || sc.site || ''}</> : <><span className="pk-sc">–</span> {T('Ujęcia bez sceny')}</>}
      <Btn sm v="ghost" act="cs-scene-shots" data-id={day.id} data-sid={sid} data-on={allOn ? 0 : 1} onClick={() => setScene(sid, !allOn)}>{allOn ? T('Usuń wszystkie') : T('Dodaj wszystkie')}</Btn></div>
      <div className="pk-list">{xs.map((x) => { const on = inRows.has(x.id); const elsewhere = (used.get(x.id) || []).filter((t: string) => t !== Core.dayTag(day, nums));
        return <button type="button" key={x.id} className={cx('pk-shot', on && 'on')} data-act="cs-shot-toggle" data-id={day.id} data-xid={x.id} aria-pressed={on} onClick={() => toggle(x.id)}><b>{x.shot || '–'}</b>{x.type && <span className="pk-t">{x.type}</span>}<span className="pk-d">{x.desc || T('bez opisu')}</span>{x.eta && <span className="pk-e">{x.eta}</span>}{elsewhere.length > 0 && <span className="pk-u" title={T('Ujęcie jest też w planie innego dnia')}>{elsewhere.join(', ')}</span>}</button>; })}</div></div>;
  };
  return <div className="picker"><div className="pk-top"><b>{T('Ujęcia z shotlisty')}</b><span className="muted small">{T('Kliknij ujęcie, aby dodać je do harmonogramu albo usunąć.')}</span></div>
    {dayScenes.length ? <><div className="pk-sec">{T('Sceny tego dnia w kalendarzówce')}</div>{dayScenes.map(group)}</> : <p className="small muted" style={{ margin: '6px 0' }}>{T('Sceny tego dnia nie mają jeszcze ujęć w shotliście.')}</p>}
    {other.length > 0 && <><Btn sm v="ghost" className="pk-more" act="cs-pick-all" onClick={() => setUI((s) => { s.csPickAll = !s.csPickAll; })}>{all ? T('Ukryj pozostałe sceny') : T('Pokaż ujęcia z innych scen ({n})', { n: other.length })}</Btn>
      {all && <><div className="pk-sec">{T('Pozostałe sceny')}</div>{other.map(group)}</>}</>}</div>;
}

function LocTransport({ st, day, sh }: { st: ProjectState; day: Day; sh: any }) {
  const id = day.id;
  const autoLoc = typeof sh.locations !== 'string';
  const trips = Core.transportData(st, id).trips;
  return <div className="card"><div className="card-h"><h3>{T('Lokacje i transport')}</h3><Btn sm style={{ marginLeft: 'auto' }} act="tab" data-tab="transport" onClick={() => goTab('transport')}>{T('Edytuj kursy')}</Btn></div><div className="card-b">
    <label className="field"><span className="lbl">{T('Lokacje i adresy')} {autoLoc ? <span className="muted small">{T('(z kalendarzówki)')}</span> : <Btn sm v="ghost" act="cs-loc-reset" data-id={id} onClick={(e) => { e.preventDefault(); sheetUpd(id, (x) => { x.locations = null; }); }}>{T('przywróć automatyczne')}</Btn>}</span>
      <TextArea rows={3} value={Core.locationsText(st, day)} bind="sheet.locations" bid={id} placeholder={T('obiekt – adres, dojazd, parking')} onCommit={(v) => sheetUpd(id, (x) => { x.locations = v; })} /></label>
    <div className="lbl" style={{ marginTop: 12 }}>{T('Kursy tego dnia')} <span className="muted small">{T('(edycja w zakładce Transport)')}</span></div>
    <div className="small">{trips.length ? trips.map((t: any) => <div key={t.id} style={{ marginBottom: 4 }}><b className="num">{t.time || '--:--'}</b> · {t.vehicle ? t.vehicle.name : T('bez pojazdu')} · {[t.from, t.to].filter(Boolean).join(' → ')}{t.who ? ' · ' + t.who : ''}</div>) : <span className="muted">{T('Brak kursów.')}</span>}</div>
    <Field label={T('Dodatkowe informacje o transporcie i parkingu')} style={{ marginTop: 10 }}><TextInput value={sh.transportNote} bind="sheet.transportNote" bid={id} placeholder={T('np. parking dla ekipy przy bramie B')} label={T('Informacje o transporcie')} onCommit={(v) => sheetUpd(id, (x) => { x.transportNote = v; })} /></Field></div></div>;
}

function Contacts({ st, id, sh, castIds }: { st: ProjectState; id: string; sh: any; castIds: number[] }) {
  const cm = Core.castMap(st);
  const opts: [string, string][] = [...st.crew.map((c) => [c.id, Core.crewName(c) + (c.role ? ' · ' + c.role : '')] as [string, string]), ...castIds.map((cid) => cm.get(cid)).filter(Boolean).map((c: any) => ['cast:' + c.id, `${c.id} ${c.name}${c.actor ? ' · ' + c.actor : ''}`] as [string, string])];
  const fromCrew = (v: string) => mutate((x) => {
    const shx = Core.ensureSheet(x, id);
    if (v.startsWith('cast:')) { const a = Core.castMap(x).get(+v.slice(5)); if (a) shx.contacts.push({ role: T('Aktor – {n}', { n: a.name }), name: a.actor || a.name, phone: a.phone || '' }); return; }
    const c = x.crew.find((y) => y.id === v); if (c) shx.contacts.push({ role: c.role || '', name: Core.crewName(c), phone: c.phone || '' });
  });
  const set = (i: number, k: 'role' | 'name' | 'phone') => (v: string) => sheetUpd(id, (x) => { const c = x.contacts[i]; if (c) c[k] = v; });
  return <div className="card"><div className="card-h"><h3>{T('Ważne kontakty')}</h3><div className="row" style={{ marginLeft: 'auto' }}>
    {opts.length > 0 && <select className="inp mini" data-act-change="contact-from-crew" data-id={id} aria-label={T('Dodaj kontakt z ekipy lub obsady')} value="" onChange={(e) => { if (e.target.value) fromCrew(e.target.value); }}>
      <option value="">{T('Dodaj z ekipy lub obsady…')}</option>
      {st.crew.length > 0 && <optgroup label={T('Ekipa')}>{st.crew.map((c) => <option key={c.id} value={c.id}>{Core.crewName(c) + (c.role ? ' · ' + c.role : '')}</option>)}</optgroup>}
      {castIds.length > 0 && <optgroup label={T('Obsada dnia')}>{castIds.map((cid) => cm.get(cid)).filter(Boolean).map((c: any) => <option key={c.id} value={'cast:' + c.id}>{`${c.id} ${c.name}${c.actor ? ' · ' + c.actor : ''}`}</option>)}</optgroup>}
    </select>}
    <Btn sm act="contact-add" data-id={id} icon="plus" onClick={() => sheetUpd(id, (x) => { x.contacts.push({ role: '', name: '', phone: '' }); })}>{T('Dodaj')}</Btn></div></div>
    {sh.contacts.length ? <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl"><tbody>{sh.contacts.map((c: any, i: number) => <tr key={i}>
      <td><TextInput value={c.role} bind="contact.role" bid={id + '|' + i} placeholder={T('funkcja')} label={T('Funkcja')} onCommit={set(i, 'role')} /></td>
      <td><TextInput value={c.name} bind="contact.name" bid={id + '|' + i} placeholder={T('imię i nazwisko')} label={T('Imię i nazwisko')} onCommit={set(i, 'name')} /></td>
      <td><TextInput value={c.phone} bind="contact.phone" bid={id + '|' + i} placeholder={T('telefon')} inputMode="tel" label={T('Telefon')} onCommit={set(i, 'phone')} /></td>
      <td style={{ width: 44 }}><Btn sm v="ghost danger" act="contact-del" data-id={id} data-i={i} aria-label={T('Usuń kontakt')} onClick={() => sheetUpd(id, (x) => { x.contacts.splice(i, 1); })}><Icon n="trash" /></Btn></td></tr>)}</tbody></table></div>
      : <div className="empty"><p>{T('Dodaj kierownika produkcji, II reżysera, lekarza… Osoby z zakładki Ekipa dodasz jednym kliknięciem.')}</p></div>}</div>;
}

/** mapki lokacji i dojazdu (JPG/PNG), trafiają do PDF planu pracy */
export async function addMapFiles(dayId: string, files: FileList | File[] | null) {
  const list = [...(files || [])].filter((f) => /^image\/(png|jpe?g)$/i.test(f.type) || /\.(png|jpe?g)$/i.test(f.name));
  if (!list.length) { toast(T('Wybierz plik JPG albo PNG.'), 'bad'); return; }
  setUI((s) => { s.busy = T('Przygotowuję mapkę…'); });
  let ok = 0;
  for (const f of list) {
    try { const img = await loadImageFile(f); mutate((x) => { Core.addMap(x, dayId, img); }); ok++; } catch (e: any) { toast(T('Nie udało się dodać mapki: {e}', { e: e.message }), 'bad'); }
  }
  setUI((s) => { s.busy = null; });
  if (ok) toast(T('Dodano mapki: {n}. Trafią do PDF planu pracy.', { n: ok }));
}
function Maps({ st, dayId, sh }: { st: ProjectState; dayId: string; sh: any }) {
  const maps = (sh.maps || []).filter((m: any) => st.media[m.media]);
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h3>{T('Mapki i dojazd')}</h3><span className="chip">{maps.length}</span><span className="muted small">{T('JPG lub PNG, trafiają do PDF planu pracy')}</span>
    <Btn sm style={{ marginLeft: 'auto' }} act="map-pick" data-id={dayId} icon="img" onClick={() => ref.current?.click()}>{T('Dodaj mapkę')}</Btn>
    <input ref={ref} type="file" id="map-in" accept="image/png,image/jpeg,.jpg,.jpeg,.png" multiple hidden data-id={dayId} onChange={(e) => { const fs = [...(e.target.files || [])]; e.target.value = ''; void addMapFiles(dayId, fs); }} /></div>
    <div className={cx('card-b maps', over && 'over')} data-drop-img={dayId}
      onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
      onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); void addMapFiles(dayId, e.dataTransfer.files); }}>
      {maps.length ? maps.map((m: any) => { const im = st.media[m.media]; return <figure key={m.id} className="map"><img src={mediaSrc(st, m.media)} alt={m.caption || im.name || T('Mapka')} loading="lazy" /><figcaption>
        <TextInput value={m.caption || ''} placeholder={T('podpis, np. dojazd do bazy, parking')} bind="map.caption" bid={dayId + '|' + m.id} label={T('Podpis mapki')} onCommit={(v) => sheetUpd(dayId, (x) => { const mp = (x.maps || []).find((y: any) => y.id === m.id); if (mp) mp.caption = v; })} />
        <Btn sm v="ghost danger" act="map-del" data-id={dayId} data-mid={m.id} aria-label={T('Usuń mapkę')} onClick={() => mutate((x) => { Core.removeMap(x, dayId, m.id); })}><Icon n="trash" /></Btn></figcaption></figure>; })
        : <div className="map-empty"><Icon n="img" /><span>{T('Przeciągnij tu zrzut mapy z dojazdem, planem bazy albo parkingiem, albo użyj przycisku „Dodaj mapkę”.')}</span></div>}</div></div>;
}

