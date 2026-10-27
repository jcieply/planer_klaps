/* DOOD, Transport, Kosztorys, Eksport. */
import { useEffect, useRef, useState } from 'react';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import { Reports } from '../domain/reports';
import type { BudgetItem, ProjectState, Trip, Vehicle } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { goTab, setUI, useUI } from '../state/ui';
import { usePrefs } from '../state/prefs';
import { doExport, exportProjectFile, exportProjectJson, importProjectFile } from '../state/actions';
import { plN, sitesList, workOptions } from '../lib/format';
import { BlurInput, Btn, Datalist, ExportBtns, Field, Icon, PageHead, Select, Stat, TextInput, TimeInput, cx } from '../components/ui';
import { NoDays } from '../components/common';
import { fetchRates, fxStale } from '../lib/fx';

/* ================= DOOD ================= */
export function Dood() {
  const st = useProject((s) => s.st)!;
  const dd = Core.dood(st);
  const lg = (k: string, t: string) => <span key={k}><i className={'cd ' + k} style={{ width: 'auto', border: 0, padding: '1px 6px' }}>{k}</i> {t}</span>;
  return <><PageHead title="Day out of Days" sub={T('Kiedy każda postać pracuje. Zestawienie powstaje samo z kalendarzówki, więc zmiana planu od razu zmienia dni aktorów.')} />
    {dd.days.length ? <><div className="tbl-wrap" data-scroll-id="dood"><table className="tbl dood"><thead><tr><th className="l sticky-l" style={{ background: 'var(--surface-3)' }}>{T('Postać')}</th>{dd.days.map((d: any) => <th key={d.id || d.no} title={Core.fmtDatePL(d.date)}>D{d.no}<span className="dh">{Core.fmtDM(d.date)}</span></th>)}<th>{T('Dni pracy')}</th><th>{T('Wstrz.')}</th></tr></thead>
      <tbody>{dd.rows.map((r: any) => { const c = st.cast.find((x) => x.id === r.id); return <tr key={r.id}><td className="l sticky-l"><b>{r.id}</b> {r.name}{c && c.actor ? <div className="muted small">{c.actor}</div> : null}</td>{r.codes.map((x: string, i: number) => <td key={i}>{x ? <span className={'cd ' + x}>{x}</span> : null}</td>)}<td><b>{r.work}</b></td><td className="muted">{r.hold}</td></tr>; })}</tbody></table></div>
      <div className="legend">{lg('SW', T('start pracy'))}{lg('W', T('praca'))}{lg('WF', T('koniec pracy'))}{lg('SWF', T('start i koniec w jednym dniu'))}{lg('H', T('wstrzymanie (aktor czeka, nie gra)'))}</div></>
      : <div className="card"><div className="empty"><h3>{T('Brak dni zdjęciowych')}</h3><p>{T('Zaplanuj sceny w kalendarzówce, a zobaczysz tu dni pracy aktorów.')}</p><Btn v="primary" act="tab" data-tab="schedule" onClick={() => goTab('schedule')}>{T('Przejdź do kalendarzówki')}</Btn></div></div>}</>;
}

/* ================= TRANSPORT ================= */
const updVeh = (id: string, k: keyof Vehicle, v: string) => mutate((x) => { const o = x.transport.vehicles.find((y) => y.id === id); if (o) (o as any)[k] = v; });
const updTrip = (id: string, k: keyof Trip, v: string) => mutate((x) => { const o = x.transport.trips.find((y) => y.id === id); if (o) (o as any)[k] = v; });
export function Transport() {
  const st = useProject((s) => s.st)!;
  const trDay = useUI((s) => s.trDay);
  const dayOpts = workOptions(st);
  if (!dayOpts.length) return <NoDays title={T('Transport')} />;
  const f = trDay && dayOpts.some((x) => x[0] === trDay) ? trDay : '';
  const tv = st.transport.vehicles, vOpts: [string, string][] = [['', T('bez pojazdu')], ...tv.map((v) => [v.id, v.name || T('(bez nazwy)')] as [string, string])];
  const trips = st.transport.trips.filter((t) => !f || t.dayId === f);
  const vtypes: [string, string][] = Core.VEHICLE_TYPES.map((x: string) => [x, T(x)]);
  const exp = (k: 'pdf' | 'xlsx') => { const d = f ? st.days.find((x) => x.id === f) : null; const no = d ? Core.dayNumbers(st).get(d.id) : null; void doExport(k, ['transport'], no ? ['transport_D{n}', { n: no }] : 'transport', { dayId: f || null }); };
  return <>
    <PageHead title={T('Plan transportów')} sub={T('Pojazdy, kierowcy i kursy przypisane do dni zdjęciowych i dni specjalnych (np. przerzutu). Skąd i dokąd podpowiadają obiekty oraz adresy z zakładki Lokacje. Eksport sortuje kursy według dnia i godziny.')}
      right={<><Field label={T('Pokaż')}><Select data-act-change="tr-day" value={f} options={[['', T('Wszystkie dni')], ...dayOpts]} onChange={(v) => setUI((s) => { s.trDay = v; })} /></Field><ExportBtns prefix="tr-export" enabled={trips.length > 0 || tv.length > 0} onPdf={() => exp('pdf')} onXlsx={() => exp('xlsx')} /></>} />
    <Datalist id="dl-places" items={[...sitesList(st), ...Object.values(st.sites).map((x: any) => x.address).filter(Boolean)]} />
    <Datalist id="dl-who" items={[...st.cast.map((c) => c.name + (c.actor ? ' (' + c.actor + ')' : '')), T('Ekipa'), T('Sprzęt')]} />
    <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h3>{T('Pojazdy i kierowcy')}</h3><span className="chip">{tv.length}</span><Btn sm style={{ marginLeft: 'auto' }} act="veh-add" icon="plus" onClick={() => mutate((x) => { x.transport.vehicles.push({ id: Core.uid(), name: '', type: Core.VEHICLE_TYPES[0], plate: '', driver: '', phone: '', note: '' } as any); })}>{T('Dodaj pojazd')}</Btn></div>
      {tv.length ? <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl"><thead><tr><th>{T('Pojazd')}</th><th>{T('Typ')}</th><th>{T('Nr rej.')}</th><th>{T('Kierowca')}</th><th>{T('Telefon')}</th><th>{T('Uwagi')}</th><th /></tr></thead>
        <tbody>{tv.map((v) => <tr key={v.id}><td><TextInput value={v.name} placeholder={T('np. Bus 1')} bind="veh.name" bid={v.id} label={T('Nazwa pojazdu')} onCommit={(x) => updVeh(v.id, 'name', x)} /></td>
          <td><Select value={v.type} bind="veh.type" bid={v.id} label={T('Typ pojazdu')} options={vtypes} onChange={(x) => updVeh(v.id, 'type', x)} /></td>
          <td><TextInput value={v.plate} placeholder={T('nr rej.')} bind="veh.plate" bid={v.id} label={T('Numer rejestracyjny')} onCommit={(x) => updVeh(v.id, 'plate', x)} /></td>
          <td><TextInput value={v.driver} placeholder={T('kierowca')} bind="veh.driver" bid={v.id} label={T('Kierowca')} onCommit={(x) => updVeh(v.id, 'driver', x)} /></td>
          <td><TextInput value={v.phone} placeholder={T('telefon')} inputMode="tel" bind="veh.phone" bid={v.id} label={T('Telefon kierowcy')} onCommit={(x) => updVeh(v.id, 'phone', x)} /></td>
          <td><TextInput value={v.note} placeholder={T('uwagi')} bind="veh.note" bid={v.id} label={T('Uwagi')} onCommit={(x) => updVeh(v.id, 'note', x)} /></td>
          <td style={{ width: 44 }}><Btn sm v="ghost danger" act="veh-del" data-id={v.id} aria-label={T('Usuń pojazd')} onClick={() => mutate((x) => { x.transport.vehicles = x.transport.vehicles.filter((y) => y.id !== v.id); x.transport.trips.forEach((t) => { if (t.vehicleId === v.id) t.vehicleId = ''; }); })}><Icon n="trash" /></Btn></td></tr>)}</tbody></table></div>
        : <div className="empty"><p>{T('Dodaj busy, auta osobowe, ciężarówki techniczne i przypisz kierowców.')}</p></div>}</div>
    <div className="card"><div className="card-h"><h3>{T('Kursy i zadania transportowe')}</h3><span className="chip">{trips.length}</span><Btn sm style={{ marginLeft: 'auto' }} act="trip-add" icon="plus" onClick={() => mutate((x) => { const first = x.days.find((d) => d.kind !== 'off'); x.transport.trips.push({ id: Core.uid(), dayId: f || (first && first.id) || '', vehicleId: (x.transport.vehicles[0] || ({} as any)).id || '', time: '', from: '', to: '', who: '', note: '' } as any); })}>{T('Dodaj kurs')}</Btn></div>
      {trips.length ? <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl"><thead><tr><th>{T('Dzień')}</th><th>{T('Godz.')}</th><th>{T('Pojazd')}</th><th>{T('Skąd')}</th><th>{T('Dokąd')}</th><th>{T('Kto / co')}</th><th>{T('Uwagi')}</th><th /></tr></thead>
        <tbody>{trips.map((t) => <tr key={t.id}><td style={{ minWidth: 130 }}><Select value={t.dayId} bind="trip.dayId" bid={t.id} label={T('Dzień')} options={dayOpts} onChange={(x) => updTrip(t.id, 'dayId', x)} /></td>
          <td style={{ width: 84 }}><TimeInput className="tm" value={t.time} placeholder="hh:mm" bind="trip.time" bid={t.id} label={T('Godzina odjazdu')} onCommit={(x) => updTrip(t.id, 'time', x)} /></td>
          <td style={{ minWidth: 130 }}><Select value={t.vehicleId} bind="trip.vehicleId" bid={t.id} label={T('Pojazd')} options={vOpts} onChange={(x) => updTrip(t.id, 'vehicleId', x)} /></td>
          <td><TextInput value={t.from} placeholder={T('skąd (adres zbiórki)')} list="dl-places" bind="trip.from" bid={t.id} label={T('Skąd')} onCommit={(x) => updTrip(t.id, 'from', x)} /></td>
          <td><TextInput value={t.to} placeholder={T('dokąd (lokacja)')} list="dl-places" bind="trip.to" bid={t.id} label={T('Dokąd')} onCommit={(x) => updTrip(t.id, 'to', x)} /></td>
          <td><TextInput value={t.who} placeholder={T('aktor, ekipa, sprzęt')} list="dl-who" bind="trip.who" bid={t.id} label={T('Kto lub co')} onCommit={(x) => updTrip(t.id, 'who', x)} /></td>
          <td><TextInput value={t.note} placeholder={T('uwagi')} bind="trip.note" bid={t.id} label={T('Uwagi')} onCommit={(x) => updTrip(t.id, 'note', x)} /></td>
          <td style={{ width: 44 }}><Btn sm v="ghost danger" act="trip-del" data-id={t.id} aria-label={T('Usuń kurs')} onClick={() => mutate((x) => { x.transport.trips = x.transport.trips.filter((y) => y.id !== t.id); })}><Icon n="trash" /></Btn></td></tr>)}</tbody></table></div>
        : <div className="empty"><p>{T('Brak kursów. Dodaj przejazd ekipy, odbiór aktora albo transport sprzętu.')}</p></div>}</div>
  </>;
}

/* ================= KOSZTORYS ================= */
const updBud = (id: string, k: keyof BudgetItem, v: string) => mutate((x) => { const b = x.budget.items.find((y) => y.id === id); if (b) (b as any)[k] = v; });
function gotoRate(kind: string, ref: string) {
  if (kind === 'site') setUI((s) => { if (!s.siteOpen.includes(ref)) s.siteOpen.push(ref); s.tab = 'sites'; });
  else if (kind === 'cast') setUI((s) => { if (!s.castOpen.includes(+ref)) s.castOpen.push(+ref); s.tab = 'cast'; });
  else setUI((s) => { if (!s.crewOpen.includes(ref)) s.crewOpen.push(ref); s.crewView = 'list'; s.crewF = { q: '', dept: '' }; s.tab = 'crew'; });
  setTimeout(() => { const el = document.querySelector<HTMLInputElement>(`[data-bind="${kind}.rate"][data-id="${ref}"]`); if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.focus({ preventScroll: true }); } }, 120);
}
/** waluta projektu, kursy NBP (albo własne) i przeliczenie kwot po zmianie waluty */
function CurrencyBox({ st }: { st: ProjectState }) {
  const cur = st.budget.currency || 'PLN', fx = st.budget.fx;
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [from, setFrom] = useState('');
  const load = async (force: boolean) => {
    if (busy || (!force && !fxStale(st))) return;
    setBusy(true); setErr('');
    try { const n = await fetchRates(); mutate((x) => { if (!x.budget.fx || x.budget.fx.manual === false || force || x.budget.fx.date !== n.date) x.budget.fx = n; }); }
    catch { setErr(T('Nie udało się pobrać kursów. Wpisz je ręcznie albo spróbuj później.')); }
    setBusy(false);
  };
  useEffect(() => { if (typeof navigator === 'undefined' || navigator.onLine !== false) void load(false); /* raz po wejściu */ }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const rateOf = (c: string) => (fx && fx.pln[c]) || '';
  const setRate = (c: string, v: string) => mutate((x) => { const n = Core.num(v); if (!(n > 0)) return; const b = x.budget.fx || { date: '', src: '', pln: {}, manual: true }; b.pln[c] = n; b.manual = true; b.src = T('własne'); x.budget.fx = b; });
  const change = (c: string) => { if (c === cur) return; setFrom(cur); mutate((x) => { x.budget.currency = c; }); };
  const convertAll = () => { const f = from, to = cur; const r = (v: any) => { const n = Core.num(v); if (!n) return v; const k = Core.convert(st, n, f, to); return k == null ? v : String(Math.round(k * 100) / 100); };
    mutate((x) => { x.budget.items.forEach((i) => { i.est = r(i.est); i.act = r(i.act); }); Object.values(x.budget.rates).forEach((o: any) => { if (o.act != null) o.act = r(o.act); }); }); setFrom(''); };
  const canConv = !!from && from !== cur && Core.convert(st, 1, from, cur) != null;
  const others = Object.keys(Core.CURRENCIES).filter((c) => c !== 'PLN');
  return <div className="card rate-box" style={{ marginBottom: 16 }}><div className="card-b">
    <div className="row" style={{ justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
      <label className="field" style={{ minWidth: 220 }}><span>{T('Waluta kosztorysu')}</span>
        <Select value={cur} bind="bud.currency" label={T('Waluta kosztorysu')} options={Object.entries(Core.CURRENCIES).map(([k, v]: [string, any]) => [k, T(v.name)] as [string, string])} onChange={change} /></label>
      <span className="muted small" style={{ flex: 1, minWidth: 220 }}>{fx ? T('Kursy: {s} z dnia {d}. W stawkach możesz wpisać inną walutę (np. 300 € / dzień) – zostanie przeliczona.', { s: fx.src || 'NBP', d: fx.date || '—' }) : T('Brak kursów. Pobierz je, aby przeliczać waluty.')}</span>
      <Btn sm act="fx-refresh" disabled={busy} onClick={() => void load(true)}>{busy ? T('Pobieranie…') : T('Pobierz kursy NBP')}</Btn></div>
    {err && <div className="notice warn" style={{ marginTop: 10 }}><div><Icon n="warn" /></div><div>{err}</div></div>}
    {canConv && <div className="notice" style={{ marginTop: 10 }}><div><Icon n="warn" /></div><div>{T('Zmieniono walutę z {a} na {b}. Kwoty wpisane ręcznie nadal mają starą wartość liczbową.', { a: from, b: cur })} <Btn sm act="fx-convert" onClick={convertAll}>{T('Przelicz kwoty na {b}', { b: cur })}</Btn> <Btn sm v="ghost" act="fx-keep" onClick={() => setFrom('')}>{T('Zostaw bez zmian')}</Btn></div></div>}
    <details style={{ marginTop: 10 }}><summary className="small muted" style={{ cursor: 'pointer' }}>{T('Kursy (zł za 1 jednostkę) – można poprawić ręcznie')}</summary>
      <div className="fgrid" style={{ marginTop: 8 }}>{others.map((c) => <label className="field" key={c}><span>1 {c} =</span><BlurInput className="amt" inputMode="decimal" value={rateOf(c)} bind="fx.rate" bid={c} label={T('Kurs') + ' ' + c} onCommit={(v) => setRate(c, v)} /></label>)}</div></details>
  </div></div>;
}
export function Budget() {
  const st = useProject((s) => s.st)!;
  const lang = usePrefs((p) => p.lang);
  const bd = Core.budgetData(st), dayOpts: [string, string][] = [['', '—'], ...workOptions(st)], siteOpts: [string, string][] = [['', '—'], ...sitesList(st).map((x) => [x, x] as [string, string])];
  const total = bd.est || 0, over = bd.act && bd.dev > 0, cur = lang === 'en' ? bd.cur : (Core.CURRENCIES[bd.cur] || { sym: 'zł' }).sym;
  const lines = Core.rateLines(st), noRate = lines.filter((l: any) => !l.parsed), autoOn = st.budget.autoRates !== false;
  const nAuto = lines.filter((l: any) => l.parsed && !l.off).length, sumAuto = lines.filter((l: any) => l.parsed && !l.off).reduce((a: number, l: any) => a + l.est, 0);
  const autoRow = (i: any) => { const l = i.line; return <tr key={l.key} className={cx('auto-row', i.off && 'is-off')}><td style={{ minWidth: 200 }}><div className="auto-name"><span className="auto-tag" title={T('Pozycja liczona automatycznie ze stawki i dni pracy')}><Icon n="link" /></span><span><b>{l.who}</b>{l.role ? <> <span className="muted">– {l.role}</span></> : null}<small>{Core.rateFormula(l)}{l.contract ? ' · ' + l.contract : ''}</small></span></div></td>
    <td className="num muted small">{l.parsed.unit === 'project' ? T('ryczałt') : String(l.qty).replace('.', ',') + ' ' + Core.rateUnitLabel(l.parsed.unit, true)}</td><td className="muted small">{l.kind === 'cast' ? T('Obsada') : l.kind === 'site' ? T('Lokacje') : T('Ekipa')}</td>
    <td className="num" style={{ textAlign: 'right', width: 120 }}><b>{i.off ? '—' : Core.fmtMoney(l.est)}</b></td>
    <td style={{ width: 120 }}>{!i.off && <BlurInput className="amt" inputMode="decimal" placeholder="0,00" value={l.actRaw} bind="bud.ract" bid={l.key} label={T('Koszt rzeczywisty') + ' – ' + l.who} onCommit={(v) => mutate((x) => { const r = (x.budget.rates[l.key] = x.budget.rates[l.key] || {}); if (v.trim() === '') delete r.act; else r.act = v; })} />}</td>
    <td className="num" style={{ textAlign: 'right', width: 110, ...(!i.off && l.act && l.act > l.est ? { color: 'var(--bad)' } : {}) }}>{!i.off && l.act ? Core.fmtMoney(l.act - l.est) : '—'}</td>
    <td style={{ width: 84 }}><div className="rowact"><Btn sm v="ghost" act="rate-goto" data-kind={l.kind} data-id={String(l.ref)} aria-label={T('Edytuj stawkę: {n}', { n: l.who })} title={T('Edytuj stawkę')} onClick={() => gotoRate(l.kind, String(l.ref))}><Icon n="edit" /></Btn>
      <Btn sm v="ghost" act="rate-off" data-id={l.key} aria-pressed={!i.off} aria-label={i.off ? T('Uwzględnij w kosztorysie') : T('Pomiń w kosztorysie')} title={i.off ? T('Uwzględnij w kosztorysie') : T('Pomiń w kosztorysie')} onClick={() => mutate((x) => { const r = (x.budget.rates[l.key] = x.budget.rates[l.key] || {}); r.off = !r.off; if (!r.off) delete r.off; })}><Icon n={i.off ? 'eyeOff' : 'eye'} /></Btn></div></td></tr>; };
  const itemRow = (i: any) => { const raw = st.budget.items.find((x) => x.id === i.id)!; return <tr key={i.id}><td style={{ minWidth: 200 }}><TextInput value={i.name} placeholder={T('nazwa pozycji')} bind="bud.name" bid={i.id} label={T('Pozycja')} onCommit={(v) => updBud(i.id, 'name', v)} /></td>
    <td style={{ minWidth: 120 }}><Select value={i.dayId} bind="bud.dayId" bid={i.id} label={T('Dzień')} options={dayOpts} onChange={(v) => updBud(i.id, 'dayId', v)} /></td>
    <td style={{ minWidth: 140 }}><Select value={i.site} bind="bud.site" bid={i.id} label={T('Obiekt')} options={siteOpts} onChange={(v) => updBud(i.id, 'site', v)} /></td>
    <td style={{ width: 120 }}><BlurInput className="amt" inputMode="decimal" placeholder="0,00" value={raw.est} bind="bud.est" bid={i.id} label={T('Koszt planowany')} onCommit={(v) => updBud(i.id, 'est', v)} /></td>
    <td style={{ width: 120 }}><BlurInput className="amt" inputMode="decimal" placeholder="0,00" value={raw.act} bind="bud.act" bid={i.id} label={T('Koszt rzeczywisty')} onCommit={(v) => updBud(i.id, 'act', v)} /></td>
    <td className="num" style={{ textAlign: 'right', width: 110, ...(i.act && i.act > i.est ? { color: 'var(--bad)' } : {}) }}>{i.act ? Core.fmtMoney(i.act - i.est) : '—'}</td>
    <td style={{ width: 44 }}><Btn sm v="ghost danger" act="bud-del" data-id={i.id} aria-label={T('Usuń pozycję')} onClick={() => mutate((x) => { x.budget.items = x.budget.items.filter((b) => b.id !== i.id); })}><Icon n="trash" /></Btn></td></tr>; };
  return <>
    <PageHead title={T('Kosztorys')} sub={T('Budżet podzielony na piony produkcyjne. Wpisz koszt planowany, a po zakupie rzeczywisty. Sumy liczą się same. Pozycję możesz powiązać z dniem zdjęciowym lub obiektem.')}
      right={<ExportBtns prefix="bud-export" enabled={st.budget.items.length > 0 || nAuto > 0} onPdf={() => doExport('pdf', ['budget'], 'kosztorys')} onXlsx={() => doExport('xlsx', ['budget'], 'kosztorys')} />} />
    <CurrencyBox st={st} />
    <div className="card rate-box" style={{ marginBottom: 16 }}><div className="card-b row" style={{ justifyContent: 'space-between' }}><label className="chk"><input type="checkbox" data-act-change="bud-auto" checked={autoOn} onChange={(e) => { const c = e.target.checked; mutate((x) => { x.budget.autoRates = c; }); }} /> <span><b>{T('Stawki ekipy, obsady i lokacji w kosztorysie')}</b><br /><span className="muted small">{T('Stawka × dni pracy z kalendarzówki trafia do pionów Ekipa, Obsada i Lokacje. Zmiana stawki lub dni od razu zmienia kosztorys.')}</span></span></label>
      {autoOn && <span className="chip acc">{T('{n} pozycji ze stawek · {s}', { n: nAuto, s: Core.fmtMoney(sumAuto) })}</span>}</div>
      {autoOn && noRate.length > 0 && <div className="notice warn" style={{ margin: '0 16px 14px' }}><div><Icon n="warn" /></div><div>{T('Bez kwoty w stawce (nie trafiają do kosztorysu):')} {noRate.map((l: any) => <button type="button" key={l.key} className="numlink" data-act="rate-goto" data-kind={l.kind} data-id={String(l.ref)} onClick={() => gotoRate(l.kind, String(l.ref))}>{l.who}</button>)}</div></div>}</div>
    <div className="card" style={{ marginBottom: 16 }}><div className="card-b"><div className="stats"><Stat v={Core.fmtMoney(bd.est)} l={T('planowany')} /><Stat v={bd.act ? Core.fmtMoney(bd.act) : '—'} l={T('rzeczywisty')} /><Stat v={bd.act ? Core.fmtMoney(bd.dev) : '—'} l={T('różnica na rozliczonych pozycjach')} style={over ? { color: 'var(--bad)' } : undefined} /><Stat v={bd.cats.reduce((a: number, c: any) => a + c.items.length, 0)} l={T('pozycji')} /></div>
      {bd.conv.length > 0 && <div className="row" style={{ marginTop: 10, gap: 8, flexWrap: 'wrap' }}>{bd.conv.map((x: any) => x.est == null ? <span key={x.cur} className="chip">{x.cur}: {T('brak kursu')}</span> : <span key={x.cur} className="chip" data-fx={x.cur}>≈ {Core.fmtMoney(x.est, x.cur)}{x.act ? ' · ' + T('rzecz.') + ' ' + Core.fmtMoney(x.act, x.cur) : ''}</span>)}</div>}</div>
      <div className="tbl-wrap" style={{ border: 0, borderTop: '1px solid var(--line-2)', borderRadius: '0 0 10px 10px' }}><table className="tbl"><thead><tr><th>{T('Pion')}</th><th style={{ textAlign: 'right' }}>{T('Planowany')}</th><th style={{ textAlign: 'right' }}>{T('Rzeczywisty')}</th><th style={{ textAlign: 'right' }}>{T('Różnica')}</th><th>{T('Udział w budżecie')}</th></tr></thead>
        <tbody>{bd.cats.map((c: any) => <tr key={c.key}><td><b>{c.label}</b></td><td className="num" style={{ textAlign: 'right' }}>{Core.fmtMoney(c.est)}</td><td className="num" style={{ textAlign: 'right' }}>{c.act ? Core.fmtMoney(c.act) : '—'}</td><td className="num" style={{ textAlign: 'right', ...(c.act && c.dev > 0 ? { color: 'var(--bad)', fontWeight: 600 } : {}) }}>{c.act ? Core.fmtMoney(c.dev) : '—'}</td>
          <td style={{ minWidth: 120 }}><div className="load" style={{ background: 'var(--surface-3)' }}><i style={{ width: (total ? Math.round((c.est / total) * 100) : 0) + '%', background: 'var(--accent)' }} /></div><span className="muted small">{total ? Math.round((c.est / total) * 100) : 0}%</span></td></tr>)}</tbody></table></div></div>
    {bd.cats.map((c: any) => <div key={c.key} className="card" style={{ marginBottom: 14 }}><div className="card-h"><h3>{c.label}</h3><span className="chip">{c.items.length}</span><span className="num" style={{ marginLeft: 'auto' }}><b>{Core.fmtMoney(c.est)}</b> <span className="muted small">{T('plan')}</span> · <b>{c.act ? Core.fmtMoney(c.act) : '—'}</b> <span className="muted small">{T('rzecz.')}</span></span>
      <Btn sm act="bud-add" data-cat={c.key} icon="plus" onClick={() => mutate((x) => { x.budget.items.push({ id: Core.uid(), cat: c.key, name: '', est: '', act: '', dayId: '', site: '', note: '' } as any); })}>{T('Dodaj pozycję')}</Btn></div>
      {c.items.length > 0 && <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl"><thead><tr><th>{T('Pozycja')}</th><th>{T('Dzień')}</th><th>{T('Obiekt')}</th><th style={{ textAlign: 'right' }}>{T('Planowany ({c})', { c: cur })}</th><th style={{ textAlign: 'right' }}>{T('Rzeczywisty ({c})', { c: cur })}</th><th style={{ textAlign: 'right' }}>{T('Różnica')}</th><th /></tr></thead>
        <tbody>{c.items.map((i: any) => (i.auto ? autoRow(i) : itemRow(i)))}</tbody></table></div>}</div>)}
  </>;
}

/* ================= EKSPORT ================= */
export function Export() {
  const st = useProject((s) => s.st)!;
  const x = useUI((s) => s.exp);
  const lang = usePrefs((p) => p.lang);
  const jsonRef = useRef<HTMLInputElement>(null);
  const shoot = st.days.filter((d) => d.kind === 'shoot').length, work = st.days.filter((d) => d.kind !== 'off').length;
  const nums = Core.dayNumbers(st);
  const counts: Record<string, string> = {
    calendar: plN(shoot, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych'), board: plN(st.scenes.length, 'scena', 'sceny', 'scen'), cast: plN(st.cast.length, 'postać', 'postacie', 'postaci'),
    sites: plN(sitesList(st).length, 'obiekt', 'obiekty', 'obiektów'), dood: T('{a} × {b}', { a: plN(st.cast.length, 'postać', 'postacie', 'postaci'), b: plN(shoot, 'dzień', 'dni', 'dni') }), callsheet: T('{n} (po jednym na dzień)', { n: plN(shoot, 'plan', 'plany', 'planów') }),
    dpr: plN(Object.keys(st.dpr || {}).length, 'raport', 'raporty', 'raportów'), transport: plN(st.transport.trips.length, 'kurs', 'kursy', 'kursów'), shotlist: plN(st.shots.length, 'ujęcie', 'ujęcia', 'ujęć'), crew: plN(st.crew.length, 'osoba', 'osoby', 'osób'),
    catering: plN(work, 'dzień pracy', 'dni pracy', 'dni pracy'), budget: plN(Core.budgetData(st).cats.reduce((a: number, c: any) => a + c.items.length, 0), 'pozycja', 'pozycje', 'pozycji'),
  };
  const desc: Record<string, string> = {
    calendar: T('Dni zdjęciowe z datami, zbiórką, scenami, obsadą dnia i sumami, a także dni specjalne (przerzut, prelight, budowa). Kolorowe paski jak w rozpisce.'), board: T('Wszystkie sceny w kolejności scenariusza z numerem dnia zdjęciowego.'),
    cast: T('Lista postaci z aktorami, liczbą scen i dniami zdjęciowymi.'), sites: T('Obiekty z adresami, scenami i dniami zdjęciowymi.'), dood: T('Day out of Days: dni pracy każdej postaci (SW, W, WF, H).'),
    callsheet: T('Plan pracy każdego dnia zdjęciowego (PDF pionowo): zbiórki, harmonogram z godzinami, obsada, transport, kontakty, catering i mapki. Pojedynczy dzień pobierzesz w zakładce Plan pracy.'),
    dpr: T('Raporty dzienne (PDF pionowo): godziny plan i rzeczywistość, sceny nakręcone, ujęcia, zdarzenia i postęp zdjęć. Pojedynczy raport pobierzesz w zakładce Raport dzienny.'),
    transport: T('Pojazdy, kierowcy i kursy pogrupowane według dni.'), budget: T('Podsumowanie pionów i pozycje kosztowe, plan i rzeczywistość.'),
    shotlist: T('Tabela ujęć: scena, typ planu, opis, obiektyw, grip, ETA, aktorzy, lokacja, z legendą skrótów.'),
    crew: T('Lista ekipy pogrupowana według pionów: imię i nazwisko, funkcja, telefon (PDF pionowo, bez stawek i umów). Excel zawiera wszystkie dane i siatkę dni pracy.'),
    catering: T('Liczba posiłków według diet na każdy dzień pracy oraz lista diet specjalnych i alergii (PDF pionowo).'),
  };
  const any = Object.values(x).some(Boolean);
  const docLang = st.meta.docLang || lang;
  const sections = () => Reports.SECTIONS.map((s: [string]) => s[0]).filter((k: string) => x[k]);
  return <>
    <PageHead title={T('Eksport')} sub={T('Wybierz, co ma się znaleźć w pliku. PDF ma format A4 poziomo, a plany pracy, ekipa i catering pionowo. Excel ma osobne arkusze z formułami sum.')} />
    <div className="exp-grid"><div className="card"><div className="card-h"><h2>{T('Zawartość pliku')}</h2><Field label={T('Język dokumentu')} style={{ marginLeft: 'auto', minWidth: 160 }}><DocLang /></Field></div><div className="card-b">
      {Reports.SECTIONS.map(([k, l]: [string, string]) => <label key={k} className="opt"><input type="checkbox" data-act-change="exp-toggle" data-k={k} checked={!!x[k]} onChange={(e) => { const c = e.target.checked; setUI((s) => { s.exp[k] = c; }); }} /><div><b>{T(l)}</b><span>{desc[k]} <span className="chip">{counts[k]}</span></span></div></label>)}
      {shoot === 0 && x.calendar && <div className="notice warn" style={{ marginTop: 10 }}><div>{T('Kalendarzówka jest jeszcze pusta. Zaplanuj sceny w zakładce „Kalendarzówka”, aby pojawiły się w pliku.')}</div></div>}
      <div className="row" style={{ marginTop: 14 }}><Btn v="primary" big act="export-pdf" icon="dl" disabled={!any} onClick={() => doExport('pdf', sections(), 'produkcja')}>{T('Pobierz PDF')}</Btn><Btn big act="export-xlsx" icon="dl" disabled={!any} onClick={() => doExport('xlsx', sections(), 'produkcja')}>{T('Pobierz Excel (.xlsx)')}</Btn></div>
      <p className="muted small" style={{ margin: '10px 0 0' }}>{T('Dokumenty powstaną w języku: {l}. Przeglądarka poprosi o potwierdzenie zapisu pliku.', { l: docLang === 'en' ? 'English' : 'polski' })}</p></div></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}><div className="card"><div className="card-h"><h3>{T('Plik projektu')}</h3><span className="chip acc">.klaps</span></div><div className="card-b"><p className="small" style={{ marginTop: 0 }}>{T('Plik .klaps zawiera cały projekt: scenariusz, rozpiskę, plan, ekipę i mapki (jako zwykłe obrazy). Projekt zaszyfrowany zapisuje się wyłącznie jako szyfrogram. Przyda się do kopii zapasowej albo przeniesienia na inny komputer.')}</p>
        <div className="row"><Btn v="primary" act="export-klaps" icon="dl" onClick={exportProjectFile}>{T('Zapisz projekt (.klaps)')}</Btn><Btn act="pick-json" icon="file" onClick={() => jsonRef.current?.click()}>{T('Wczytaj projekt…')}</Btn>
          <input ref={jsonRef} type="file" id="json-in" accept=".klaps,.json,application/json,application/zip" hidden onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ''; if (fl) void importProjectFile(fl); }} /></div>
        <p className="muted small" style={{ margin: '10px 0 0' }}>{T('Wczytasz też kopie .json z wcześniejszych wersji.')} <button type="button" className="linkish" data-act="export-json" onClick={exportProjectJson}>{T('Zapisz w starym formacie (.json)')}</button></p></div></div>
        <div className="card"><div className="card-h"><h3>{T('Plan w skrócie')}</h3></div><div className="card-b small">{st.days.length ? st.days.map((d) => d.kind !== 'shoot'
          ? <div key={d.id} className="muted">{Core.fmtShort(d.date)} · {Core.dayTitle(d, nums).toLowerCase()}{d.site ? ' · ' + d.site : ''}</div>
          : <div key={d.id}><b>D{nums.get(d.id)}</b> · {Core.fmtDatePL(d.date)} · {plN(d.sceneIds.length, 'scena', 'sceny', 'scen')} · {Core.fmtEighths(Core.dayStats(st, d).eighths)} {T('str.')}</div>) : <span className="muted">{T('Nie ma jeszcze dni zdjęciowych.')}</span>}</div></div></div></div>
  </>;
}
export function DocLang() {
  const st = useProject((s) => s.st)!;
  const lang = usePrefs((p) => p.lang);
  return <Select data-act-change="doc-lang" value={st.meta.docLang || ''} options={[['', T('Jak interfejs ({l})', { l: lang.toUpperCase() })], ['pl', 'Polski (PL)'], ['en', 'English (EN)']]} onChange={(v) => mutate((x) => { x.meta.docLang = v; })} />;
}

