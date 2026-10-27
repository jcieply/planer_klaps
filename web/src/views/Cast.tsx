/* Obsada: postacie, aktorzy, kontakty, umowy, stawki, diety; łączenie zdublowanych postaci. */
import { useMemo } from 'react';
import { NewName } from '../components/common';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import type { CastMember, ProjectState } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { setUI, toast, useUI } from '../state/ui';
import { doExport } from '../state/actions';
import { ActionSelect, Btn, Datalist, ExportBtns, Field, Icon, PageHead, Select, Stat, TextArea, TextInput } from '../components/ui';
import { RateHint, confirmTwice } from '../components/common';

const updCast = (id: number, fn: (c: CastMember) => void) => mutate((x) => { const c = x.cast.find((y) => y.id === id); if (c) fn(c); });
function addCast(v: string) {
  const name = Core.normName(v);
  if (!name) return;
  mutate((x) => { if (!x.cast.some((c) => Core.normName(c.name) === name)) x.cast.push(Core.newCast({ id: x.nextCast++, name })); });
}

export function Cast() {
  const st = useProject((s) => s.st)!;
  const open = useUI((s) => s.castOpen);
  const idx = useMemo(() => Core.scheduleIndex(st), [st]);
  const withActor = st.cast.filter((c) => c.actor).length, lodging = st.cast.filter((c) => c.lodging === 'Tak').length, diets = st.cast.filter((c) => (c.diet && c.diet !== 'meat') || c.dietNote).length;
  return <>
    <PageHead title={T('Obsada')} sub={T('Postacie wykryte w scenariuszu i grający je aktorzy. W „Szczegółach” zapiszesz kontakt, umowę, stawkę, nocleg, dietę, transport i uwagi, tak jak w Ekipie. Połącz zdublowane postacie (np. ANNA i MŁODA ANNA) albo usuń pomyłkowe. Dieta aktora trafia do raportu cateringowego w dniach, w których gra.')}
      right={<ExportBtns prefix="cast-export" enabled={st.cast.length > 0} onPdf={() => doExport('pdf', ['cast'], 'obsada')} onXlsx={() => doExport('xlsx', ['cast'], 'obsada')} />} />
    <Datalist id="dl-contract" items={Core.CONTRACTS.map((x: string) => T(x))} /><Datalist id="dl-ctrans" items={[T('Własny'), T('Bus produkcji'), T('Odbiór przez kierowcę produkcji'), T('Zorganizowany dojazd')]} />
    {st.cast.length > 0 && <div className="card" style={{ marginBottom: 16 }}><div className="card-b"><div className="stats"><Stat v={st.cast.length} l={T('postaci')} /><Stat v={withActor} l={T('z obsadzonym aktorem')} /><Stat v={lodging} l={T('potrzebuje noclegu')} /><Stat v={diets} l={T('z dietą specjalną')} /></div></div></div>}
    <div className="tbl-wrap"><table className="tbl"><thead><tr><th>{T('Nr')}</th><th>{T('Postać')}</th><th>{T('Aktor / aktorka')}</th><th>{T('Telefon')}</th><th>{T('Sceny')}</th><th>{T('Str.')}</th><th>{T('Dni')}</th><th>{T('Numery scen')}</th><th /></tr></thead>
      <tbody>{st.cast.length ? st.cast.map((c) => <CastRow key={c.id} st={st} c={c} idx={idx} open={open.includes(c.id)} />) : <tr><td colSpan={9} className="muted" style={{ padding: 20 }}>{T('Brak postaci.')}</td></tr>}</tbody></table></div>
    <NewName id="new-cast" act="cast-add" placeholder={T('Nowa postać…')} label={T('Nazwa nowej postaci')} button={T('Dodaj postać')} onAdd={addCast} />
  </>;
}

function CastRow({ st, c, idx, open }: { st: ProjectState; c: CastMember; idx: Map<string, any>; open: boolean }) {
  const scs = st.scenes.filter((s) => s.cast.includes(c.id));
  const days = new Set(scs.map((s) => (idx.get(s.id) || {}).dayNo).filter(Boolean));
  const eighths = scs.reduce((a, s) => a + s.eighths, 0);
  const nm = c.actor || c.name;
  const set = (k: keyof CastMember) => (v: string) => updCast(c.id, (x) => { (x as any)[k] = v; });
  const main = <tr><td className="num"><b>{c.id}</b></td>
    <td style={{ minWidth: 140 }}><TextInput value={c.name} bind="cast.name" bid={c.id} label={T('Postać {n}', { n: c.id })} onCommit={set('name')} /></td>
    <td style={{ minWidth: 150 }}><TextInput value={c.actor} placeholder={T('aktor / aktorka')} bind="cast.actor" bid={c.id} label={T('Aktor postaci {n}', { n: c.name })} onCommit={set('actor')} /></td>
    <td style={{ minWidth: 120 }}><TextInput value={c.phone} placeholder={T('telefon')} inputMode="tel" bind="cast.phone" bid={c.id} label={T('Telefon') + ' – ' + nm} onCommit={set('phone')} /></td>
    <td className="num">{scs.length}</td><td className="num">{Core.fmtEighths(eighths)}</td><td className="num">{days.size || '—'}</td>
    <td style={{ maxWidth: 240 }}>{scs.map((s) => <button type="button" key={s.id} className="numlink" data-act="scene-open" data-id={s.id} onClick={() => setUI((u) => { u.drawer = s.id; u.showScript = false; })}>{s.num}</button>)}</td>
    <td style={{ whiteSpace: 'nowrap' }}><div className="rowact">
      {c.diet && c.diet !== 'meat' && <span className="diet-tag" title={Core.dietLabel(c.diet)}>{Core.dietLabel(c.diet, true)}</span>}
      {c.lodging === 'Tak' && <span className="diet-tag lodge" title={T('Nocleg')}>{T('Nocleg')}</span>}
      <Btn sm v={open ? '' : 'ghost'} act="cast-toggle" data-id={c.id} aria-expanded={open} aria-label={T('Szczegóły: {n}', { n: nm })} onClick={() => setUI((s) => { s.castOpen = s.castOpen.includes(c.id) ? s.castOpen.filter((x) => x !== c.id) : [...s.castOpen, c.id]; })}>{open ? T('Zwiń') : T('Szczegóły')}</Btn>
      <ActionSelect className="inp mini" data-act-change="cast-merge" data-id={c.id} label={T('Połącz {n} z inną postacią', { n: c.name })} placeholder={T('Połącz z…')} options={st.cast.filter((o) => o.id !== c.id).map((o) => [String(o.id), `${o.id} ${o.name}`] as [string, string])}
        onPick={(v) => { const to = st.cast.find((o) => o.id === +v); if (!to) return; mutate((x) => { Core.mergeCast(x, c.id, to.id); }); toast(T('Połączono „{a}” z „{b}”.', { a: c.name, b: to.name })); }} />
      <Btn sm v="ghost danger" act="cast-del" data-id={c.id} title={T('Usuń postać ze wszystkich scen')} aria-label={T('Usuń postać ze wszystkich scen')} onClick={() => {
        if (!confirmTwice('cast:' + c.id)) { toast(T('Kliknij jeszcze raz, aby usunąć „{n}” ze wszystkich scen.', { n: c.name }), 'bad'); return; }
        mutate((x) => { Core.removeCast(x, c.id); });
      }}><Icon n="trash" /></Btn></div></td></tr>;
  if (!open) return main;
  const fld = (label: string, key: keyof CastMember, o: { ph?: string; list?: string; mode?: any } = {}) => <Field label={label}><TextInput value={(c as any)[key] || ''} placeholder={o.ph} list={o.list} inputMode={o.mode} bind={'cast.' + key} bid={c.id} label={label + ' – ' + nm} onCommit={set(key)} /></Field>;
  return <>{main}<tr className="crew-det"><td colSpan={9}><div className="fgrid">
    {fld('E-mail', 'email', { ph: 'imie@domena.pl', mode: 'email' })}{fld(T('Typ umowy'), 'contract', { list: 'dl-contract', ph: T('np. umowa o dzieło') })}
    <div className="field">{fld(T('Stawka'), 'rate', { ph: T('np. 1500 zł / dzień zdjęciowy') })}<RateHint st={st} kind="cast" refId={c.id} /></div>
    <Field label={T('Nocleg')}><Select value={c.lodging || ''} bind="cast.lodging" bid={c.id} label={T('Nocleg') + ' – ' + nm} options={[['', '—'], ['Tak', T('Tak')], ['Nie', T('Nie')]]} onChange={set('lodging')} /></Field>
    <Field label={T('Dieta')}><Select value={c.diet || 'meat'} bind="cast.diet" bid={c.id} label={T('Dieta') + ' – ' + nm} options={Core.DIETS.map(([k, l]: [string, string]) => [k, T(l)])} onChange={set('diet')} /></Field>
    {fld(T('Alergie / uwagi do diety'), 'dietNote', { ph: T('np. orzechy, celiakia') })}{fld(T('Transport'), 'transport', { list: 'dl-ctrans', ph: T('np. odbiór z hotelu o 6:00') })}
    <Field label={T('Uwagi')} style={{ gridColumn: '1/-1' }}><TextArea rows={2} value={c.notes || ''} bind="cast.notes" bid={c.id} placeholder={T('agent, kostium, wymagania, dostępność…')} label={T('Uwagi') + ' – ' + nm} onCommit={set('notes')} /></Field>
  </div></td></tr></>;
}
