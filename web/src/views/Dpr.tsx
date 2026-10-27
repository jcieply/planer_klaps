/* Raport dzienny (Daily Production Report): co faktycznie nakręcono i o której – porównanie z planem, postęp, nadgodziny. */
import { useMemo } from 'react';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import type { Day, Dpr as DprT, DprScene, ProjectState } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { setUI, toast, useUI } from '../state/ui';
import { doExport } from '../state/actions';
import { dayLabel, kcls, parseEighths, plN } from '../lib/format';
import { ActionSelect, BlurInput, Btn, ExportBtns, Field, Icon, PageHead, Select, TextArea, TextInput, TimeInput, cx } from '../components/ui';
import { NoDays } from '../components/common';

const updDpr = (dayId: string, fn: (r: DprT) => void) => mutate((x) => { fn(Core.ensureDpr(x, dayId)); });
const updScene = (dayId: string, sid: string, fn: (r: DprScene) => void) => updDpr(dayId, (r) => { const rec = r.scenes[sid] = r.scenes[sid] || { status: '', eighths: null, setups: '', note: '' }; fn(rec); });
/** różnica rzeczywistość − plan w minutach (przez północ) */
function minDiff(plan: string, actual: string): number | null {
  const a = Core.timeToMin(plan), b = Core.timeToMin(actual);
  if (a == null || b == null) return null;
  let d = b - a;
  if (d < -720) d += 1440; else if (d > 720) d -= 1440;
  return d;
}
const signed = (m: number) => (m === 0 ? '0:00' : (m > 0 ? '+' : '−') + Core.fmtHM(Math.abs(m)));
const signedE = (e: number) => (e === 0 ? '0' : (e > 0 ? '+' : '−') + Core.fmtEighths(Math.abs(e)));

/** domyślny dzień raportu: ostatni dzień zdjęciowy do dziś (albo pierwszy) */
export function defaultDprDay(st: ProjectState): Day | undefined {
  const shoot = st.days.filter((d) => d.kind === 'shoot');
  const today = Core.todayISO();
  const past = shoot.filter((d) => d.date && d.date <= today);
  return past[past.length - 1] || shoot[0];
}

export function Dpr() {
  const st = useProject((s) => s.st)!;
  const sel = useUI((s) => s.dprDay);
  const days = st.days.filter((d) => d.kind === 'shoot');
  const day = days.find((d) => d.id === sel) || defaultDprDay(st);
  if (!day) return <NoDays title={T('Raport dzienny')} />;
  return <DprDay key={day.id} st={st} day={day} days={days} />;
}

function DprDay({ st, day, days }: { st: ProjectState; day: Day; days: Day[] }) {
  const id = day.id;
  const nums = Core.dayNumbers(st);
  const r = Core.dprOf(st, id);
  const s = useMemo(() => Core.dprSummary(st, day), [st, day]);
  const started = !!(st.dpr && st.dpr[id]);
  const cm = Core.castMap(st);
  const castIds = [...new Set(s.rows.flatMap((x) => x.scene.cast))].sort((a, b) => a - b);
  const exp = (k: 'pdf' | 'xlsx') => doExport(k, ['dpr'], ['raport_dzienny_D{n}', { n: nums.get(id) }], { dayId: id });
  const maxW = +st.meta.maxWorkH || 12;
  const pct = s.cum.total ? Math.round((s.cum.shot / s.cum.total) * 100) : 0;
  const timeRows: [string, keyof DprT | 'lunch', string][] = [
    [T('Zbiórka ekipy'), 'crewCall', s.plan.call], [T('Pierwsze ujęcie'), 'firstShot', s.plan.firstShot], [T('Obiad'), 'lunch', s.plan.lunch],
    [T('Koniec zdjęć (kamera)'), 'camWrap', s.plan.wrap], [T('Koniec pracy ekipy'), 'crewWrap', s.plan.wrap],
  ];
  const nextDay = days[days.findIndex((d) => d.id === id) + 1];
  const unshot = s.rows.filter((x) => !x.moved && (x.status === 'none' || x.status === 'part')).length;
  const move = (target: string) => {
    let n = 0; mutate((x) => { n = Core.moveUnshot(x, id, target); });
    if (n) toast(T('Przeniesiono {n}.', { n: plN(n, 'scenę', 'sceny', 'scen') }));
  };
  return <>
    <PageHead title={T('Raport dzienny')} sub={T('Po dniu zdjęciowym zapisz, co faktycznie nakręcono i o której. Klaps porówna to z planem, policzy postęp i nadgodziny, a sceny nienakręcone przeniesiesz jednym kliknięciem. Rzeczywiste godziny pracy liczą się też do kontroli odpoczynku między dniami.')}
      right={<><Field label={T('Dzień zdjęciowy')}><Select data-act-change="dpr-day" value={id} options={days.map((d) => [d.id, dayLabel(d, nums) + (st.dpr && st.dpr[d.id] ? (st.dpr[d.id].closed ? ' ✓' : ' •') : '')] as [string, string])} onChange={(v) => setUI((u) => { u.dprDay = v; })} /></Field>
        <ExportBtns prefix="dpr-export" enabled onPdf={() => exp('pdf')} onXlsx={() => exp('xlsx')} /></>} />
    <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h2>{T('Dzień {n}', { n: nums.get(id) })}</h2><span className="muted">{Core.fmtDatePL(day.date)}</span>
      {r.closed ? <span className="chip ok-c" style={{ marginLeft: 'auto' }}><Icon n="check" /> {T('Raport zamknięty')}{r.closedAt ? ' · ' + new Date(r.closedAt).toLocaleDateString() : ''}</span> : started ? <span className="chip warn-c" style={{ marginLeft: 'auto' }}>{T('W trakcie')}</span> : <span className="chip" style={{ marginLeft: 'auto' }}>{T('Nie rozpoczęty')}</span>}
      <Btn sm v={r.closed ? 'ghost' : 'primary'} act="dpr-close" onClick={() => updDpr(id, (x) => { x.closed = !x.closed; x.closedAt = x.closed ? Date.now() : null; })}>{r.closed ? T('Otwórz ponownie') : T('Zamknij raport')}</Btn></div>
      <div className="cs-sum dpr-sum">
        <span><span className="lbl">{T('Nakręcono')}</span><b className="num">{Core.fmtEighths(s.shot)}<small> / {Core.fmtEighths(s.planned)} {T('str.')}</small></b><small className={s.delta < 0 ? 'bad-t' : s.delta > 0 ? 'ok-t' : ''}>{started ? signedE(s.delta) + ' ' + T('str. wobec planu') : T('uzupełnij status scen')}</small></span>
        <span><span className="lbl">{T('Sceny')}</span><b className="num">{s.scenesDone}<small> / {s.rows.length}</small></b><small>{s.scenesPart ? T('{n} częściowo', { n: s.scenesPart }) : T('nakręconych w całości')}</small></span>
        <span><span className="lbl">{T('Ujęcia')}</span><b className="num">{s.setups || '—'}</b><small>{T('ustawień kamery')}</small></span>
        <span className={s.overtime ? 'bad' : s.actual.work != null ? 'ok' : ''}><span className="lbl">{T('Czas pracy')}</span><b className="num">{s.actual.work != null ? Core.fmtDur(s.actual.work) : '—'}</b><small>{s.overtime ? T('nadgodziny {d}', { d: Core.fmtDur(s.overtime) }) : T('limit {n} h', { n: maxW })}</small></span>
        <span className="dpr-cum"><span className="lbl">{T('Postęp zdjęć (narastająco)')}</span><b className="num">{pct}%<small> · {Core.fmtEighths(s.cum.shot)} / {Core.fmtEighths(s.cum.total)} {T('str.')}</small></b>
          <div className="meter acc" role="img" aria-label={pct + '%'}><i style={{ width: pct + '%' }} /></div>
          <small className={s.cum.delta < 0 ? 'bad-t' : ''}>{s.cum.delta === 0 ? T('zgodnie z planem') : s.cum.delta < 0 ? T('opóźnienie {e} str.', { e: Core.fmtEighths(-s.cum.delta) }) : T('wyprzedzenie {e} str.', { e: Core.fmtEighths(s.cum.delta) })} · {T('{a} z {b} scen', { a: s.cum.scenesDone, b: s.cum.scenesTotal })}</small></span>
      </div></div>

    <div className="imp-grid dpr-grid" style={{ marginBottom: 16 }}>
      <div className="card"><div className="card-h"><h3>{T('Godziny')}</h3><span className="muted small">{T('plan z planu pracy, rzeczywistość wpisz po dniu')}</span></div>
        <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl dpr-times"><thead><tr><th /><th>{T('Plan')}</th><th>{T('Rzeczywistość')}</th><th>{T('Różnica')}</th></tr></thead>
          <tbody>{timeRows.map(([label, key, plan]) => {
            if (key === 'lunch') {
              const lp = plan ? plan.split('–')[0] : '';
              const d = minDiff(lp, r.lunchFrom);
              return <tr key={key}><td><b>{label}</b></td><td className="num muted">{plan || '—'}</td>
                <td><div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}><TimeInput className="tm" value={r.lunchFrom} placeholder={T('od')} bind="dpr.lunchFrom" bid={id} label={T('Obiad od')} onCommit={(v) => updDpr(id, (x) => { x.lunchFrom = v; })} /><span className="muted">–</span><TimeInput className="tm" value={r.lunchTo} placeholder={T('do')} bind="dpr.lunchTo" bid={id} label={T('Obiad do')} onCommit={(v) => updDpr(id, (x) => { x.lunchTo = v; })} /></div></td>
                <td className={cx('num', d != null && d > 15 && 'bad-t')}>{d != null ? signed(d) : ''}{s.actual.lunchMin != null ? <small className="muted"> · {Core.fmtHM(s.actual.lunchMin)}</small> : null}</td></tr>;
            }
            const val = r[key] as string, d = minDiff(plan, val);
            return <tr key={key}><td><b>{label}</b></td><td className="num muted">{plan || '—'}</td>
              <td><TimeInput className="tm" value={val} placeholder="hh:mm" bind={'dpr.' + key} bid={id} label={label} onCommit={(v) => updDpr(id, (x) => { (x as any)[key] = v; })} /></td>
              <td className={cx('num', d != null && d > 15 && 'bad-t', d != null && d < 0 && 'ok-t')}>{d != null ? signed(d) : ''}</td></tr>;
          })}</tbody></table></div>
        <p className="small muted" style={{ margin: 0, padding: '8px 14px 12px' }}>{T('Zbiórka i koniec pracy ekipy zastępują w kontroli odpoczynku (BHP) godziny z planu.')}</p></div>
      <div className="card"><div className="card-h"><h3>{T('Zdarzenia dnia')}</h3></div><div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label={T('Opóźnienia i przestoje')}><TextArea rows={2} value={r.delays} bind="dpr.delays" bid={id} placeholder={T('np. 40 min czekania na słońce, awaria agregatu 10:20–10:45')} onCommit={(v) => updDpr(id, (x) => { x.delays = v; })} /></Field>
        <Field label={T('Wypadki i zdarzenia BHP')}><TextArea rows={2} value={r.incidents} bind="dpr.incidents" bid={id} placeholder={T('brak albo opis zdarzenia i podjętych działań')} onCommit={(v) => updDpr(id, (x) => { x.incidents = v; })} /></Field>
        <Field label={T('Sprzęt (awarie, braki, zwroty)')}><TextArea rows={2} value={r.equipment} bind="dpr.equipment" bid={id} onCommit={(v) => updDpr(id, (x) => { x.equipment = v; })} /></Field>
        <Field label={T('Uwagi ogólne')}><TextArea rows={2} value={r.notes} bind="dpr.notes" bid={id} onCommit={(v) => updDpr(id, (x) => { x.notes = v; })} /></Field>
      </div></div>
    </div>

    <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h3>{T('Sceny dnia')}</h3><span className="chip">{s.rows.length}</span>
      <div className="row" style={{ marginLeft: 'auto' }}>
        <Btn sm act="dpr-all-done" onClick={() => updDpr(id, (x) => { s.rows.forEach((row) => { if (row.moved) return; const rec = x.scenes[row.scene.id] = x.scenes[row.scene.id] || { status: '', eighths: null, setups: '', note: '' }; if (!rec.status) rec.status = 'done'; }); })}>{T('Pozostałe jako nakręcone')}</Btn>
        {unshot > 0 && <ActionSelect className="inp mini" data-act-change="dpr-move" label={T('Przenieś sceny nienakręcone')} placeholder={T('Przenieś nienakręcone ({n})…', { n: unshot })}
          options={[['__next', nextDay ? T('na następny dzień ({d})', { d: dayLabel(nextDay, nums) }) : T('na nowy dzień zdjęciowy')], ['__pool', T('do zaplanowania')], ...days.filter((d) => d.id !== id && d.id !== nextDay?.id).map((d) => [d.id, dayLabel(d, nums)] as [string, string])]} onPick={move} />}
      </div></div>
      {s.rows.length ? <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl dpr-scenes"><thead><tr><th>{T('Sc.')}</th><th>{T('Plan / lokacja')}</th><th>{T('Str.')}</th><th>{T('Status')}</th><th>{T('Nakręcono')}</th><th>{T('Ujęcia')}</th><th>{T('Uwagi')}</th></tr></thead>
        <tbody>{s.rows.map((row, ri) => {
          const sc = row.scene, rec = r.scenes[sc.id] || ({} as Partial<DprScene>);
          const where = row.moved ? (Core.scheduleIndex(st).get(sc.id)?.dayNo ? 'D' + Core.scheduleIndex(st).get(sc.id)!.dayNo : T('do zaplanowania')) : '';
          return <tr key={sc.id} className={cx(kcls(sc), 'dpr-row', row.status && 'st-' + row.status)} style={{ background: 'var(--sb)', color: 'var(--s-ink)' }} data-sid={sc.id}>
            <td className="c"><b>{sc.num}</b></td>
            <td style={{ minWidth: 180 }}>{sc.place || sc.site}{row.moved && <span className="moved-tag">{T('przeniesiona: {d}', { d: where })}</span>}</td>
            <td className="num c">{Core.fmtEighths(sc.eighths)}</td>
            <td><div className="seg dpr-seg" role="group" aria-label={T('Status sceny {n}', { n: sc.num })}>{Core.DPR_STATUS.map(([k, l]) => <button type="button" key={k} data-act="dpr-status" data-id={sc.id} data-v={k} aria-pressed={rec.status === k} onClick={() => updScene(id, sc.id, (x) => { x.status = x.status === k ? '' : (k as DprScene['status']); })}>{T(l)}</button>)}</div></td>
            <td style={{ width: 90 }}>{rec.status === 'part'
              ? <BlurInput className="tm" value={rec.eighths != null ? Core.fmtEighths(rec.eighths) : ''} placeholder={Core.fmtEighths(Math.round(sc.eighths / 2))} bind="dpr.eighths" bid={sc.id} label={T('Nakręcone strony sceny {n}', { n: sc.num })} title={T('Np. 3/8 albo 1 2/8')} onCommit={(v) => { const n = v.trim() === '' ? null : parseEighths(v); if (n == null && v.trim()) { toast(T('Wpisz długość np. 5/8, 1 3/8 albo 2.'), 'bad'); return; } updScene(id, sc.id, (x) => { x.eighths = n; }); }} />
              : <span className="num">{row.shot ? Core.fmtEighths(row.shot) : '—'}</span>}</td>
            <td style={{ width: 70 }}><BlurInput className="tm" inputMode="numeric" value={rec.setups || ''} placeholder="0" bind="dpr.setups" bid={sc.id} label={T('Liczba ujęć sceny {n}', { n: sc.num })} onCommit={(v) => updScene(id, sc.id, (x) => { x.setups = v.replace(/\D/g, ''); })} /></td>
            <td style={{ minWidth: 160 }}><TextInput value={rec.note || ''} bind="dpr.note" bid={sc.id} placeholder={ri === 0 ? T('np. brak planu ogólnego, dokrętka') : ''} label={T('Uwagi do sceny {n}', { n: sc.num })} onCommit={(v) => updScene(id, sc.id, (x) => { x.note = v; })} /></td></tr>;
        })}
          <tr className="tot"><td /><td><b>{T('Razem')}</b></td><td className="num c"><b>{Core.fmtEighths(s.planned)}</b></td><td className="small">{T('{a} nakręcone, {b} częściowo, {c} nie', { a: s.scenesDone, b: s.scenesPart, c: s.scenesNone })}</td><td className="num"><b>{Core.fmtEighths(s.shot)}</b></td><td className="num"><b>{s.setups || ''}</b></td><td /></tr></tbody></table></div>
        : <div className="empty"><p>{T('Ten dzień nie ma scen w planie.')}</p></div>}</div>

    <div className="card"><div className="card-h"><h3>{T('Obsada')}</h3><span className="muted small">{T('godziny rzeczywiste')}</span>
      <Field label={T('Statyści (osób)')} style={{ marginLeft: 'auto', maxWidth: 140 }}><BlurInput inputMode="numeric" value={r.extras} placeholder="0" bind="dpr.extras" bid={id} onCommit={(v) => updDpr(id, (x) => { x.extras = v.replace(/\D/g, ''); })} /></Field></div>
      {castIds.length ? <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl"><thead><tr><th>{T('Nr')}</th><th>{T('Postać')}</th><th>{T('Aktor / aktorka')}</th><th>{T('Przyjazd')}</th><th>{T('Na planie')}</th><th>{T('Koniec')}</th><th>{T('Uwagi')}</th></tr></thead>
        <tbody>{castIds.map((cid) => { const c = cm.get(cid); if (!c) return null; const cc = r.cast[cid] || {};
          const set = (k: 'arrive' | 'onSet' | 'wrap' | 'note') => (v: string) => updDpr(id, (x) => { x.cast[cid] = x.cast[cid] || {}; x.cast[cid][k] = v; });
          return <tr key={cid}><td className="num"><b>{c.id}</b></td><td><b>{c.name}</b></td><td>{c.actor}</td>
            <td><TimeInput className="tm" value={cc.arrive || ''} bind="dprcast.arrive" bid={id + '|' + cid} label={T('Przyjazd') + ' ' + c.name} onCommit={set('arrive')} /></td>
            <td><TimeInput className="tm" value={cc.onSet || ''} bind="dprcast.onSet" bid={id + '|' + cid} label={T('Na planie') + ' ' + c.name} onCommit={set('onSet')} /></td>
            <td><TimeInput className="tm" value={cc.wrap || ''} bind="dprcast.wrap" bid={id + '|' + cid} label={T('Koniec') + ' ' + c.name} onCommit={set('wrap')} /></td>
            <td><TextInput value={cc.note || ''} bind="dprcast.note" bid={id + '|' + cid} label={T('Uwagi') + ' ' + c.name} onCommit={set('note')} /></td></tr>; })}</tbody></table></div>
        : <div className="empty"><p>{T('W scenach tego dnia nie ma postaci.')}</p></div>}</div>
  </>;
}
