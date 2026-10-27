/* Ekipa: lista osób z pionami i szczegółami, siatka dni pracy, raport cateringowy. */
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import type { CrewMember, Day, ProjectState } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { goTab, setUI, toast, useUI } from '../state/ui';
import { doExport } from '../state/actions';
import { pl } from '../lib/format';
import { BlurInput, Btn, Datalist, ExportBtns, Field, Icon, PageHead, Select, Stat, TextArea, TextInput, cx } from '../components/ui';
import { RateHint, confirmTwice } from '../components/common';

const updCrew = (id: string, fn: (c: CrewMember) => void) => mutate((x) => { const c = x.crew.find((y) => y.id === id); if (c) fn(c); });
export function addCrew() {
  const dept = useUI.getState().crewF.dept;
  let id = '';
  mutate((x) => { const c = Core.newCrew({ dept: dept && dept !== '__none' ? dept : '' }); x.crew.push(c); id = c.id; });
  setUI((s) => { s.crewF.q = ''; s.crewView = 'list'; });
  setTimeout(() => document.querySelector<HTMLInputElement>(`input[data-bind="crew.first"][data-id="${id}"]`)?.focus(), 40);
}

export function Crew() {
  const st = useProject((s) => s.st)!;
  const v = useUI((s) => s.crewView);
  const work = st.days.filter((d) => d.kind !== 'off');
  const seg = <div className="seg" role="tablist" aria-label={T('Widok ekipy')}>{([['list', T('Lista')], ['days', T('Dni pracy')], ['catering', T('Catering')]] as const).map(([k, l]) => <button type="button" role="tab" key={k} data-act="crew-view" data-v={k} aria-pressed={v === k} aria-selected={v === k} onClick={() => setUI((s) => { s.crewView = k; })}>{l}</button>)}</div>;
  const right = v === 'catering'
    ? <>{seg}<ExportBtns prefix="cat-export" enabled={work.length > 0} onPdf={() => doExport('pdf', ['catering'], 'catering')} onXlsx={() => doExport('xlsx', ['catering'], 'catering')} /></>
    : <>{seg}<Btn act="crew-add" icon="plus" onClick={addCrew}>{T('Dodaj osobę')}</Btn><ExportBtns prefix="crew-export" enabled={st.crew.length > 0} onPdf={() => doExport('pdf', ['crew'], 'ekipa')} onXlsx={() => doExport('xlsx', ['crew', 'catering'], 'ekipa')} /></>;
  const sub = v === 'days' ? T('Zaznacz, w które dni pracuje każda osoba. Bez zmian osoba pracuje we wszystkie dni zdjęciowe; dni specjalne (prelight, budowa, przerzut) zaznacz ręcznie. Na tej podstawie liczy się catering.')
    : v === 'catering' ? T('Raport cateringowy: ile posiłków każdej diety potrzeba w kolejne dni pracy. Liczy się z dni pracy i diet ekipy oraz (opcjonalnie) aktorów z planu dnia.')
      : T('Lista ekipy filmowej. W tabeli są dane podstawowe, a rozwinięcie „Szczegóły” zawiera e-mail, umowę, stawkę, nocleg, dietę, transport i dni pracy. Eksport PDF zawiera tylko dane podstawowe, więc możesz go wysłać razem z planem pracy.');
  return <><PageHead title={T('Ekipa')} sub={sub} right={right} />
    {v === 'days' ? <CrewDays st={st} work={work} /> : v === 'catering' ? <Catering st={st} /> : <CrewList st={st} work={work} />}</>;
}

function CrewList({ st, work }: { st: ProjectState; work: Day[] }) {
  const f = useUI((s) => s.crewF);
  const open = useUI((s) => s.crewOpen);
  const q = f.q.trim().toLowerCase();
  const list = st.crew.filter((c) => (!f.dept || Core.deptKey(c) === f.dept) && (!q || [c.first, c.last, c.dept, c.role, c.phone, c.email, c.notes].join(' ').toLowerCase().includes(q)));
  const groups = Core.crewGroups({ crew: list });
  const allDepts = Core.crewGroups({ crew: st.crew });
  const lodging = st.crew.filter((c) => c.lodging === 'Tak').length, diets = st.crew.filter((c) => (c.dietType && c.dietType !== 'meat') || c.dietNote).length;
  const nums = Core.dayNumbers(st);
  if (!st.crew.length) return <><Stats st={st} allDepts={allDepts.length} lodging={lodging} diets={diets} /><div className="card"><div className="empty"><h3>{T('Nie dodano jeszcze ekipy')}</h3><p>{T('Dodaj osoby z poszczególnych pionów: reżyserii, produkcji, zdjęć, dźwięku i innych.')}</p><Btn v="primary" big act="crew-add" icon="plus" onClick={addCrew}>{T('Dodaj pierwszą osobę')}</Btn></div></div></>;
  return <>
    <Datalist id="dl-depts" items={Core.DEPTS.map((x: string) => T(x))} /><Datalist id="dl-contract" items={Core.CONTRACTS.map((x: string) => T(x))} /><Datalist id="dl-ctrans" items={[T('Własny'), T('Bus produkcji'), T('Ciężarówka techniczna'), T('Zorganizowany dojazd')]} />
    <Stats st={st} allDepts={allDepts.length} lodging={lodging} diets={diets} />
    <div className="toolbar"><input className="inp search" id="crew-q" type="search" placeholder={T('Szukaj: imię, nazwisko, funkcja, telefon…')} value={f.q} aria-label={T('Szukaj w ekipie')} onChange={(e) => { const v = e.target.value; setUI((s) => { s.crewF.q = v; }); }} />
      <span className="muted small" style={{ marginLeft: 'auto' }} dangerouslySetInnerHTML={{ __html: T('<b class="num">{a}</b> z {b}', { a: list.length, b: st.crew.length }) }} /></div>
    {allDepts.length > 1 && <div className="chips" style={{ marginBottom: 12 }}><button type="button" className="dept-chip" data-act="crew-dept" data-d="" aria-pressed={!f.dept} onClick={() => setUI((s) => { s.crewF.dept = ''; })}>{T('Wszyscy')} · {st.crew.length}</button>
      {allDepts.map((g: any) => <button type="button" key={g.key} className="dept-chip" data-act="crew-dept" data-d={g.key} aria-pressed={f.dept === g.key} onClick={() => setUI((s) => { s.crewF.dept = g.key; })}>{g.dept} · {g.list.length}</button>)}</div>}
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>{T('Imię')}</th><th>{T('Nazwisko')}</th><th>{T('Pion')}</th><th>{T('Funkcja')}</th><th>{T('Telefon')}</th><th /></tr></thead>
      <tbody>{groups.length ? groups.map((g: any) => [<tr key={'g' + g.key} className="grp-row"><td colSpan={6}>{g.dept} · {g.list.length}</td></tr>,
        ...g.list.map((c: CrewMember) => <CrewRow key={c.id} st={st} c={c} open={open.includes(c.id)} work={work} nums={nums} />)])
        : <tr><td colSpan={6} className="muted" style={{ padding: 20 }}>{T('Nikt nie pasuje do filtrów.')}</td></tr>}</tbody></table></div>
  </>;
}
function Stats({ st, allDepts, lodging, diets }: { st: ProjectState; allDepts: number; lodging: number; diets: number }) {
  return <div className="card" style={{ marginBottom: 16 }}><div className="card-b"><div className="stats"><Stat v={st.crew.length} l={pl(st.crew.length, 'osoba', 'osoby', 'osób')} /><Stat v={allDepts} l={pl(allDepts, 'pion', 'piony', 'pionów')} /><Stat v={lodging} l={T('potrzebuje noclegu')} /><Stat v={diets} l={T('z dietą specjalną')} /></div></div></div>;
}
function CrewRow({ st, c, open, work, nums }: { st: ProjectState; c: CrewMember; open: boolean; work: Day[]; nums: Map<string, number | null> }) {
  const nm = Core.crewName(c) || T('osoba');
  const nDays = work.filter((d) => Core.crewWorks(c, d)).length;
  const set = (k: keyof CrewMember) => (v: string) => updCrew(c.id, (x) => { (x as any)[k] = v; });
  const main = <tr><td style={{ minWidth: 120 }}><TextInput value={c.first} placeholder={T('imię')} bind="crew.first" bid={c.id} label={T('Imię')} onCommit={set('first')} /></td>
    <td style={{ minWidth: 130 }}><TextInput value={c.last} placeholder={T('nazwisko')} bind="crew.last" bid={c.id} label={T('Nazwisko')} onCommit={set('last')} /></td>
    <td style={{ minWidth: 130 }}><BlurInput value={c.dept} placeholder={T('pion')} list="dl-depts" bind="crew.dept" bid={c.id} label={T('Pion')} onCommit={set('dept')} /></td>
    <td style={{ minWidth: 150 }}><TextInput value={c.role} placeholder={T('funkcja')} bind="crew.role" bid={c.id} label={T('Funkcja')} onCommit={set('role')} /></td>
    <td style={{ minWidth: 130 }}><TextInput value={c.phone} placeholder={T('telefon')} inputMode="tel" bind="crew.phone" bid={c.id} label={T('Telefon')} onCommit={set('phone')} /></td>
    <td style={{ width: 170 }}><div className="rowact">{c.dietType && c.dietType !== 'meat' && <span className="diet-tag" title={Core.dietLabel(c.dietType)}>{Core.dietLabel(c.dietType, true)}</span>}
      <Btn sm v={open ? '' : 'ghost'} act="crew-toggle" data-id={c.id} aria-expanded={open} aria-label={T('Szczegóły: {n}', { n: nm })} onClick={() => setUI((s) => { s.crewOpen = s.crewOpen.includes(c.id) ? s.crewOpen.filter((x) => x !== c.id) : [...s.crewOpen, c.id]; })}>{open ? T('Zwiń') : T('Szczegóły')}</Btn>
      <Btn sm v="ghost danger" act="crew-del" data-id={c.id} aria-label={T('Usuń: {n}', { n: nm })} onClick={() => {
        if (!confirmTwice('crew:' + c.id)) { toast(T('Kliknij jeszcze raz, aby usunąć: {n}.', { n: Core.crewName(c) || T('osoba bez nazwiska') }), 'bad'); return; }
        mutate((x) => { x.crew = x.crew.filter((y) => y.id !== c.id); }); setUI((s) => { s.crewOpen = s.crewOpen.filter((x) => x !== c.id); });
      }}><Icon n="trash" /></Btn></div></td></tr>;
  if (!open) return main;
  const fld = (label: string, key: keyof CrewMember, o: { ph?: string; list?: string; mode?: any } = {}) => <Field label={label}><TextInput value={(c as any)[key]} placeholder={o.ph} list={o.list} inputMode={o.mode} bind={'crew.' + key} bid={c.id} label={label + ' – ' + nm} onCommit={set(key)} /></Field>;
  return <>{main}<tr className="crew-det"><td colSpan={6}><div className="fgrid">
    {fld('E-mail', 'email', { ph: 'imie@domena.pl', mode: 'email' })}{fld(T('Typ umowy'), 'contract', { list: 'dl-contract', ph: T('np. umowa o dzieło') })}
    <div className="field">{fld(T('Stawka'), 'rate', { ph: T('np. 800 zł / dzień') })}<RateHint st={st} kind="crew" refId={c.id} /></div>
    <Field label={T('Nocleg')}><Select value={c.lodging || ''} bind="crew.lodging" bid={c.id} label={T('Nocleg') + ' – ' + nm} options={[['', '—'], ['Tak', T('Tak')], ['Nie', T('Nie')]]} onChange={set('lodging')} /></Field>
    <Field label={T('Dieta')}><Select value={c.dietType || 'meat'} bind="crew.dietType" bid={c.id} label={T('Dieta') + ' – ' + nm} options={Core.DIETS.map(([k, l]: [string, string]) => [k, T(l)])} onChange={set('dietType')} /></Field>
    {fld(T('Alergie / uwagi do diety'), 'dietNote', { ph: T('np. orzechy, celiakia') })}{fld(T('Transport'), 'transport', { list: 'dl-ctrans', ph: T('własny / bus produkcji') })}
    <div className="field" style={{ gridColumn: '1/-1' }}><span className="lbl">{T('Dni pracy')} <span className="muted small">{T('{a} z {b}', { a: nDays, b: work.length })}{Core.crewDefaultDays(c) ? ' · ' + T('wszystkie dni zdjęciowe') : ''}</span></span>
      <div className="day-chips">{work.length ? work.map((d) => { const on = Core.crewWorks(c, d); return <button type="button" key={d.id} className={cx('day-chip', on && 'on', d.kind !== 'shoot' && 'sp')} data-act="crew-day" data-id={c.id} data-day={d.id} aria-pressed={on} title={Core.fmtDatePL(d.date)} onClick={() => mutate((x) => { const cc = x.crew.find((y) => y.id === c.id); if (cc) Core.toggleCrewDay(x, cc, d.id); })}>{Core.dayTag(d, nums)}<small>{Core.fmtDM(d.date)}</small></button>; }) : <span className="muted small">{T('Brak dni w kalendarzówce.')}</span>}
        {work.length > 0 && (['shoot', 'all', 'none'] as const).map((k) => <Btn key={k} sm v="ghost" act="crew-days-all" data-id={c.id} data-v={k} onClick={() => mutate((x) => { const cc = x.crew.find((y) => y.id === c.id); if (cc) Core.setCrewAllDays(x, cc, k); })}>{k === 'shoot' ? T('Wszystkie zdjęciowe') : k === 'all' ? T('Wszystkie') : T('Żadne')}</Btn>)}</div></div>
    <Field label={T('Uwagi')} style={{ gridColumn: '1/-1' }}><TextArea rows={2} value={c.notes} bind="crew.notes" bid={c.id} label={T('Uwagi') + ' – ' + nm} onCommit={set('notes')} /></Field>
  </div></td></tr></>;
}

function CrewDays({ st, work }: { st: ProjectState; work: Day[] }) {
  if (!work.length) return <div className="card"><div className="empty"><h3>{T('Brak dni pracy')}</h3><p>{T('Dodaj dni zdjęciowe albo dni specjalne w kalendarzówce.')}</p><Btn v="primary" act="tab" data-tab="schedule" onClick={() => goTab('schedule')}>{T('Przejdź do kalendarzówki')}</Btn></div></div>;
  if (!st.crew.length) return <div className="card"><div className="empty"><h3>{T('Nie dodano jeszcze ekipy')}</h3><Btn v="primary" big act="crew-add" icon="plus" onClick={addCrew}>{T('Dodaj pierwszą osobę')}</Btn></div></div>;
  const nums = Core.dayNumbers(st);
  return <><div className="tbl-wrap" data-scroll-id="crew-days"><table className="tbl crew-days"><thead><tr><th className="l sticky-l" style={{ background: 'var(--surface-3)' }}>{T('Osoba')}</th>
    {work.map((d) => <th key={d.id} className={cx('dcol', d.kind !== 'shoot' && 'sp sp-' + d.kind)} title={Core.fmtDatePL(d.date)}><span>{Core.dayTag(d, nums)}</span><small>{Core.fmtDM(d.date)}</small>
      <button type="button" className="mini-all" data-act="crew-col" data-day={d.id} title={T('Zaznacz lub odznacz wszystkich tego dnia')} aria-label={T('Zaznacz lub odznacz wszystkich tego dnia')} onClick={() => mutate((x) => { const dd = x.days.find((y) => y.id === d.id); if (!dd) return; const allOn = x.crew.every((c) => Core.crewWorks(c, dd)); x.crew.forEach((c) => Core.toggleCrewDay(x, c, d.id, !allOn)); })}>±</button></th>)}<th>{T('Dni')}</th></tr></thead>
    <tbody>{Core.crewGroups(st).map((g: any) => [<tr key={'g' + g.key} className="grp-row"><td colSpan={work.length + 2}>{g.dept} · {g.list.length}</td></tr>,
      ...g.list.map((c: CrewMember) => <tr key={c.id}><td className="l sticky-l"><b>{Core.crewName(c) || T('(bez nazwiska)')}</b><div className="muted small">{c.role || ''}</div></td>
        {work.map((d) => { const on = Core.crewWorks(c, d); return <td key={d.id} className="dcell"><button type="button" className={cx('tick', on && 'on')} data-act="crew-day" data-id={c.id} data-day={d.id} aria-pressed={on} aria-label={(Core.crewName(c) || '') + ' · ' + Core.dayTag(d, nums)} onClick={() => mutate((x) => { const cc = x.crew.find((y) => y.id === c.id); if (cc) Core.toggleCrewDay(x, cc, d.id); })}>{on ? '✓' : ''}</button></td>; })}
        <td className="num"><b>{work.filter((d) => Core.crewWorks(c, d)).length}</b></td></tr>)])}
      <tr className="tot"><td className="l sticky-l">{T('Osób danego dnia')}</td>{work.map((d) => <td key={d.id} className="num"><b>{st.crew.filter((c) => Core.crewWorks(c, d)).length}</b></td>)}<td /></tr></tbody></table></div>
    <div className="legend"><span><i className="tick-lg on">✓</i> {T('pracuje')}</span><span><i className="tick-lg" /> {T('nie pracuje')}</span><span><i className="tick-lg sp" /> {T('dzień specjalny (prelight, budowa, przerzut)')}</span></div></>;
}

function Catering({ st }: { st: ProjectState }) {
  const cat = Core.catering(st);
  if (!cat.days.length) return <div className="card"><div className="empty"><h3>{T('Brak dni pracy')}</h3><p>{T('Dodaj dni zdjęciowe albo dni specjalne w kalendarzówce.')}</p></div></div>;
  const keys: string[] = cat.keys;
  const castOn = st.catering.cast !== false;
  const notes: { tag: string; who: string; diet: string; note: string }[] = [];
  cat.days.forEach((d: any) => d.notes.forEach((x: any) => notes.push({ tag: d.tag, ...x })));
  return <>
    <div className="card" style={{ marginBottom: 16 }}><div className="card-b"><div className="stats"><Stat v={cat.total} l={T('posiłków razem')} />{keys.filter((k) => cat.sum[k]).map((k) => <Stat key={k} v={cat.sum[k]} l={Core.dietLabel(k)} />)}</div>
      <label className="chk" style={{ marginTop: 12 }}><input type="checkbox" data-act-change="cat-cast" checked={castOn} onChange={(e) => { const c = e.target.checked; mutate((x) => { x.catering.cast = c; }); }} /> {T('Doliczaj aktorów z planu dnia (dieta aktora ustawiana w zakładce Obsada)')}</label></div></div>
    <div className="tbl-wrap" style={{ marginBottom: 16 }}><table className="tbl cat-tbl"><thead><tr><th>{T('Dzień')}</th>{keys.map((k) => <th key={k} className="c">{Core.dietLabel(k, true)}</th>)}<th className="c">{T('Ekipa')}</th><th className="c">{T('Aktorzy')}</th><th className="c" title={T('np. statyści, goście; liczone jako standardowe')}>{T('Dodatkowe')}</th><th className="c">{T('Razem')}</th></tr></thead>
      <tbody>{cat.days.map((d: any) => <tr key={d.id} className={d.kind !== 'shoot' ? 'sp-row' : undefined}><td className="l"><b>{d.tag}</b><div className="muted small">{Core.fmtDM(d.date)} {d.date ? Core.DAYS_SHORT[Core.dow(d.date)] : ''}</div></td>
        {keys.map((k) => <td key={k} className={cx('num', !d.counts[k] && 'zero')}>{d.counts[k] || '·'}</td>)}<td className="num">{d.crew}</td><td className="num">{castOn && d.kind === 'shoot' ? d.cast : '—'}</td>
        <td style={{ width: 84 }}><BlurInput className="tm" type="number" min={0} step={1} value={st.catering.extra[d.id] || ''} placeholder="0" bind="catx.n" bid={d.id} label={T('Dodatkowe porcje') + ' ' + d.tag} onCommit={(v) => mutate((x) => { const n = Math.max(0, Math.round(+v || 0)); if (n) x.catering.extra[d.id] = n; else delete x.catering.extra[d.id]; })} /></td>
        <td className="num tot"><b>{d.total}</b></td></tr>)}
        <tr className="tot"><td><b>{T('RAZEM')}</b></td>{keys.map((k) => <td key={k} className="num"><b>{cat.sum[k]}</b></td>)}<td className="num">{cat.days.reduce((a: number, d: any) => a + d.crew, 0)}</td><td className="num">{cat.days.reduce((a: number, d: any) => a + d.cast, 0)}</td><td className="num">{cat.days.reduce((a: number, d: any) => a + d.extra, 0)}</td><td className="num"><b>{cat.total}</b></td></tr></tbody></table></div>
    <div className="card"><div className="card-h"><h3>{T('Diety specjalne i alergie')}</h3><span className="chip">{notes.length}</span></div>
      {notes.length ? <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl"><thead><tr><th>{T('Dzień')}</th><th>{T('Osoba')}</th><th>{T('Dieta')}</th><th>{T('Uwagi')}</th></tr></thead><tbody>{notes.map((x, i) => <tr key={i}><td><b>{x.tag}</b></td><td>{x.who}</td><td>{x.diet}</td><td>{x.note}</td></tr>)}</tbody></table></div> : <div className="empty"><p>{T('Brak diet specjalnych i alergii w dniach pracy.')}</p></div>}</div>
  </>;
}
