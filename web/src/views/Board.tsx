/* Rozpiska scen: paski scen z filtrami, zaznaczaniem i akcjami zbiorczymi.
   Przy dużych scenariuszach lista jest wirtualizowana (TanStack Virtual) – rysowane są tylko widoczne paski. */
import { Editing } from './Presence';
import { memo, useMemo, useRef } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { T, T_ } from '../domain/i18n';
import { Core } from '../domain/core';
import type { CastMember, ProjectState, Scene } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { setUI, toast, useUI } from '../state/ui';
import { dayLabel, kcls, pl, sitesList } from '../lib/format';
import { filteredScenes, moveScenesToDay } from '../lib/helpers';
import { ActionSelect, Btn, PageHead, Select } from '../components/ui';
import { NeedScenes, addScene, confirmTwice } from '../components/common';

export const TODS: [string, string][] = [['DAY', T_('Dzień')], ['NIGHT', T_('Noc')], ['DAWN', T_('Świt')], ['DUSK', T_('Zmierzch')]];
export const IES: [string, string][] = [['INT', T_('Wnętrze (WN.)')], ['EXT', T_('Plener (ZN.)')], ['INT/EXT', T_('WN./ZN.')]];
const VIRTUAL_FROM = 80;
const EMPTY_F = { q: '', ie: '', tod: '', cast: '', site: '', plan: '' };

export function Board() {
  const st = useProject((s) => s.st)!;
  const f = useUI((s) => s.f);
  const sel = useUI((s) => s.sel);
  const list = useMemo(() => filteredScenes(st, f), [st, f]);
  if (!st.scenes.length) return <><PageHead title={T('Rozpiska scen')} sub={T('Każda scena to jeden pasek. Dodaj sceny ręcznie albo wczytaj scenariusz.')} right={<Btn act="scene-add" icon="plus" onClick={addScene}>{T('Dodaj scenę')}</Btn>} /><NeedScenes onAdd={addScene} /></>;
  const eighths = list.reduce((a, s) => a + s.eighths, 0);
  const selSet = new Set(sel);
  const setF = (k: keyof typeof EMPTY_F, v: string) => setUI((s) => { s.f[k] = v; });
  const nums = Core.dayNumbers(st);
  return <>
    <PageHead title={T('Rozpiska scen')} sub={T('Każda scena to jeden pasek. Kolor pokazuje wnętrze/plener i porę dnia. Kliknij pasek, aby uzupełnić opis, obsadę i elementy.')} right={<Btn act="scene-add" icon="plus" onClick={addScene}>{T('Dodaj scenę')}</Btn>} />
    <div className="toolbar">
      <input className="inp search" id="f-q" type="search" placeholder={T('Szukaj: numer, plan, opis, postać…')} value={f.q} aria-label={T('Szukaj scen')} onChange={(e) => setF('q', e.target.value)} />
      <Select data-act-change="f-ie" label={T('Wnętrze / plener')} value={f.ie} onChange={(v) => setF('ie', v)} options={[['', T('WN. i ZN.')], ['INT', T('Wnętrza')], ['EXT', T('Plenery')]]} />
      <Select data-act-change="f-tod" label={T('Pora dnia')} value={f.tod} onChange={(v) => setF('tod', v)} options={[['', T('Cała doba')], ...TODS.map(([k, l]) => [k, T(l)] as [string, string])]} />
      <Select data-act-change="f-cast" label={T('Postać')} value={f.cast} onChange={(v) => setF('cast', v)} options={[['', T('Każda postać')], ...st.cast.map((c) => [c.id, `${c.id} ${c.name}`] as [number, string])]} />
      <Select data-act-change="f-site" label={T('Obiekt')} value={f.site} onChange={(v) => setF('site', v)} options={[['', T('Każdy obiekt')], ...sitesList(st).map((x) => [x, x] as [string, string])]} />
      <Select data-act-change="f-plan" label={T('Stan planu')} value={f.plan} onChange={(v) => setF('plan', v)} options={[['', T('Wszystkie')], ['unplanned', T('Niezaplanowane')], ['planned', T('Zaplanowane')]]} />
      <Btn sm v="ghost" act="f-clear" onClick={() => setUI((s) => { s.f = { ...EMPTY_F }; })}>{T('Wyczyść filtry')}</Btn>
      <span className="muted small" style={{ marginLeft: 'auto' }} dangerouslySetInnerHTML={{ __html: T('<b class="num">{a}</b> z {b} scen · <b class="num">{p}</b> str.', { a: list.length, b: st.scenes.length, p: Core.fmtEighths(eighths) }) }} />
    </div>
    {sel.length > 0 && <div className="sel-bar"><b>{T('Zaznaczono {n}', { n: sel.length })}</b>
      <ActionSelect className="inp mini" data-act-change="bulk-to-day" label={T('Dodaj zaznaczone do dnia')} placeholder={T('Dodaj do dnia…')} options={[...st.days.filter((d) => d.kind === 'shoot').map((d) => [d.id, dayLabel(d, nums)] as [string, string]), ['__new', T('+ Nowy dzień zdjęciowy')]]}
        onPick={(v) => { const ids = st.scenes.filter((s) => selSet.has(s.id)).map((s) => s.id); let r: string | null = null; mutate((x) => { r = moveScenesToDay(x, ids, v); }); setUI((s) => { s.sel = []; }); if (r && r !== 'pool') toast(T('Dodano {n} do planu.', { n: `${ids.length} ${pl(ids.length, 'scenę', 'sceny', 'scen')}` })); }} />
      <Btn sm act="bulk-unplan" onClick={() => { mutate((x) => { Core.unassign(x, sel); }); setUI((s) => { s.sel = []; }); toast(T('Sceny usunięte z planu.')); }}>{T('Usuń z planu')}</Btn>
      <Btn sm v="danger" act="bulk-delete" icon="trash" onClick={() => {
        if (!confirmTwice('bulk')) { toast(T('Kliknij jeszcze raz, aby usunąć {n}.', { n: `${sel.length} ${pl(sel.length, 'scenę', 'sceny', 'scen')}` }), 'bad'); return; }
        mutate((x) => { Core.removeScenes(x, sel); }); setUI((s) => { s.sel = []; }); toast(T('Sceny usunięte.'));
      }}>{T('Usuń sceny')}</Btn>
      <Btn sm v="ghost" act="sel-clear" style={{ marginLeft: 'auto' }} onClick={() => setUI((s) => { s.sel = []; })}>{T('Wyczyść zaznaczenie')}</Btn></div>}
    <div className="board" data-scroll-id="board"><div className="board-in">
      <div className="bh"><div className="c"><input type="checkbox" data-act="sel-all" aria-label={T('Zaznacz wszystkie widoczne')} checked={list.length > 0 && list.every((s) => selSet.has(s.id))}
        onChange={() => setUI((s) => { const all = list.every((x) => s.sel.includes(x.id)); const ids = new Set(s.sel); list.forEach((x) => (all ? ids.delete(x.id) : ids.add(x.id))); s.sel = [...ids]; })} /></div>
        <div className="c">{T('Sc.')}</div><div className="c">{T('W/Z')}</div><div className="c">{T('D/N')}</div><div>{T('Plan / lokacja')}</div><div>{T('Opis')}</div><div>{T('Obsada')}</div><div className="c">{T('Str.')}</div><div className="c">{T('Dzień')}</div></div>
      {list.length ? <Strips list={list} st={st} selSet={selSet} /> : <div className="empty"><p>{T('Żadna scena nie pasuje do filtrów.')}</p></div>}
    </div></div>
    <div className="legend">{Object.keys(Core.STRIP).map((k) => <span key={k} className={'k-' + k}><i />{Core.STRIP[k].name}</span>)}</div>
  </>;
}

function Strips({ list, st, selSet }: { list: Scene[]; st: ProjectState; selSet: Set<string> }) {
  const idx = useMemo(() => Core.scheduleIndex(st), [st]);
  const cm: Map<number, CastMember> = useMemo(() => Core.castMap(st), [st]);
  const prog = useMemo(() => Core.shotProgress(st), [st]);
  const ref = useRef<HTMLDivElement>(null);
  const big = list.length >= VIRTUAL_FROM;
  const v = useWindowVirtualizer({ count: big ? list.length : 0, estimateSize: () => 46, overscan: 12, scrollMargin: ref.current?.offsetTop ?? 0 });
  const row = (s: Scene) => <Strip key={s.id} s={s} sch={idx.get(s.id)} checked={selSet.has(s.id)} shot={prog.doneScenes.has(s.id) ? 'done' : prog.partScenes.has(s.id) ? 'part' : ''} castTitle={s.cast.map((id) => (cm.get(id) || ({} as any)).name).filter(Boolean).join(', ')} />;
  if (!big) return <>{list.map(row)}</>;
  const items = v.getVirtualItems();
  return <div ref={ref} style={{ height: v.getTotalSize(), position: 'relative' }}>
    {items.map((it) => <div key={list[it.index].id} data-index={it.index} ref={v.measureElement} style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${it.start - v.options.scrollMargin}px)` }}>{row(list[it.index])}</div>)}
  </div>;
}

const Strip = memo(function Strip({ s, sch, checked, castTitle, shot }: { s: Scene; sch: any; checked: boolean; castTitle: string; shot: '' | 'done' | 'part' }) {
  const open = () => setUI((u) => { u.drawer = s.id; u.showScript = false; });
  return <div className={`strip bd ${kcls(s)}${checked ? ' sel' : ''}`} data-act="scene-open" data-id={s.id} role="button" tabIndex={0} aria-label={T('Scena {n}', { n: s.num })}
    onClick={(e) => { if ((e.target as HTMLElement).closest('input, select, label')) return; open(); }}
    onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target === e.currentTarget) { e.preventDefault(); open(); } }}>
    <div className="c"><input type="checkbox" data-act="sel-toggle" data-id={s.id} checked={checked} aria-label={T('Zaznacz scenę {n}', { n: s.num })} onChange={() => setUI((u) => { u.sel = u.sel.includes(s.id) ? u.sel.filter((x) => x !== s.id) : [...u.sel, s.id]; })} /></div>
    <div className="c scn">{s.num}</div><div className="c">{Core.IE_LABEL[s.ie] || '—'}</div><div className="c">{(Core.TOD[s.tod] || {}).short || ''}</div>
    <div className="plc"><Editing k="scene" id={s.id} />{s.place || s.site || '—'}{s.site && s.place && s.site !== s.place ? <small>{s.site}</small> : null}</div>
    <div className="syn">{s.synopsis}</div>
    <div className="cst" title={castTitle}>{s.cast.slice().sort((a, b) => a - b).join(', ')}</div>
    <div className="c num">{Core.fmtEighths(s.eighths)}</div>
    <div className="c">{sch ? (sch.dayNo ? <span className="dayb">D{sch.dayNo}</span> : <span className="dayb">{T('wolny')}</span>) : <span className="dayb none">—</span>}{shot && <ShotMark v={shot} />}</div>
  </div>;
});

/** znacznik sceny nakręconej (z raportu dziennego) */
export function ShotMark({ v }: { v: 'done' | 'part' }) {
  return v === 'done' ? <span className="shot-ok" title={T('Nakręcona (raport dzienny)')} aria-label={T('Nakręcona')}>✓</span> : <span className="shot-ok shot-part" title={T('Nakręcona częściowo (raport dzienny)')} aria-label={T('Częściowo')}>½</span>;
}
