/* Lokacje: obiekty zdjęciowe z danymi właściciela, zasilaniem, toaletą, campem i statusem umowy. */
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import type { ProjectState } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { setUI, useUI } from '../state/ui';
import { doExport } from '../state/actions';
import { BlurInput, Btn, ExportBtns, Field, Icon, PageHead, Select, Stat, TextArea, TextInput, cx } from '../components/ui';
import { NewName, RateHint } from '../components/common';
import { localityOf } from '../lib/weather';

const contractCls = (k: string) => (!k ? 'none' : k === 'signed' ? 'ok' : k === 'sent' || k === 'negotiation' ? 'warn' : 'bad');
const updSite = (id: string, key: string, v: string) => mutate((x) => { if (!x.sites[id]) x.sites[id] = Core.siteEntry(); (x.sites[id] as any)[key] = v; });

export function Sites() {
  const st = useProject((s) => s.st)!;
  const open = useUI((s) => s.siteOpen);
  const rd = Core.reportData(st);
  const all = rd.sites.map((x: any) => Core.siteEntry(st.sites[x.site]));
  const signed = all.filter((o: any) => o.contract === 'signed').length, pending = all.filter((o: any) => Core.contractOpen(o.contract)).length, gen = all.filter((o: any) => o.power === 'generator').length;
  return <>
    <PageHead title={T('Lokacje')} sub={T('Obiekty zdjęciowe pogrupowane z nagłówków scen (np. DOM ANNY). W „Szczegółach” zapiszesz właściciela, kontakt, zasilanie, toaletę, miejsce na camp i uwagi. Adres, camp i toaleta trafiają do planu pracy, a niepodpisana umowa daje ostrzeżenie w kalendarzówce. Zmiana nazwy obiektu zmienia go we wszystkich scenach.')}
      right={<ExportBtns prefix="site-export" enabled={rd.sites.length > 0} onPdf={() => doExport('pdf', ['sites'], 'lokacje')} onXlsx={() => doExport('xlsx', ['sites'], 'lokacje')} />} />
    {rd.sites.length > 0 && <div className="card" style={{ marginBottom: 16 }}><div className="card-b"><div className="stats"><Stat v={rd.sites.length} l={T('obiektów')} /><Stat v={signed} l={T('umów podpisanych')} /><Stat v={pending} l={T('umów do domknięcia')} style={pending ? { color: 'var(--warn)' } : undefined} /><Stat v={gen} l={T('z agregatem')} /></div></div></div>}
    <div className="tbl-wrap"><table className="tbl sites-tbl"><thead><tr><th>{T('Obiekt')}</th><th>{T('Rzeczywista nazwa')}</th><th>{T('Adres')}</th><th>{T('Status umowy')}</th><th>{T('Sceny')}</th><th>{T('Dni zdjęciowe')}</th><th>{T('Numery scen')}</th><th /></tr></thead>
      <tbody>{rd.sites.length ? rd.sites.map((x: any) => <SiteRow key={x.site} st={st} x={x} open={open.includes(x.site)} />) : <tr><td colSpan={8} className="muted" style={{ padding: 20 }}>{T('Brak lokacji. Pojawią się z scen albo dodaj własną poniżej.')}</td></tr>}</tbody></table></div>
    <NewName id="new-site" act="site-add" placeholder={T('Nowa lokacja…')} label={T('Nazwa nowej lokacji')} button={T('Dodaj lokację')} onAdd={(v) => { const name = v.trim().toUpperCase(); mutate((x) => { if (!x.sites[name]) x.sites[name] = Core.siteEntry({ manual: true }); }); }} />
  </>;
}

function SiteRow({ st, x, open }: { st: ProjectState; x: any; open: boolean }) {
  const info = Core.siteEntry(st.sites[x.site]);
  const scs = st.scenes.filter((s) => (s.site || s.place || '(bez nazwy)') === x.site);
  const name = x.site === '(bez nazwy)' ? T('(bez nazwy)') : x.site;
  const id = x.site;
  const inp = (key: string, ph: string, label?: string, mode?: any) => <TextInput value={info[key]} placeholder={ph} inputMode={mode} bind={'site.' + key} bid={id} label={(label || ph) + ' – ' + name} onCommit={(v) => updSite(id, key, v)} />;
  const main = <tr><td style={{ minWidth: 170 }}><BlurInput className="site-key" value={name} data-act-change="site-rename" data-from={id} label={T('Nazwa obiektu {n}', { n: name })} onCommit={(v) => mutate((s) => { Core.renameSite(s, id, v); })} /></td>
    <td style={{ minWidth: 180 }}>{inp('realName', T('oficjalna nazwa miejsca'), T('Rzeczywista nazwa'))}</td>
    <td style={{ minWidth: 200 }}>{inp('address', T('ulica, numer, miejscowość'), T('Adres'))}</td>
    <td style={{ minWidth: 170 }}><Select className={cx('st-sel', 'st-' + contractCls(info.contract))} value={info.contract} bind="site.contract" bid={id} label={T('Status umowy') + ' – ' + name} options={Core.SITE_CONTRACT.map(([k, l]: [string, string]) => [k, T(l)])} onChange={(v) => updSite(id, 'contract', v)} /></td>
    <td className="num">{x.scenes}</td><td className="num">{x.days.length ? x.days.map((n: number) => 'D' + n).join(', ') : '—'}</td>
    <td style={{ maxWidth: 220 }}>{scs.map((s) => <button type="button" key={s.id} className="numlink" data-act="scene-open" data-id={s.id} title={s.place} onClick={() => setUI((u) => { u.drawer = s.id; u.showScript = false; })}>{s.num}</button>)}</td>
    <td style={{ whiteSpace: 'nowrap' }}><div className="rowact">{info.power === 'generator' && <span className="diet-tag warn-tag" title={T('Brak prądu – agregat')}>{T('Agregat')}</span>}
      <Btn sm v={open ? '' : 'ghost'} act="site-toggle" data-id={id} aria-expanded={open} aria-label={T('Szczegóły: {n}', { n: name })} onClick={() => setUI((s) => { s.siteOpen = s.siteOpen.includes(id) ? s.siteOpen.filter((y) => y !== id) : [...s.siteOpen, id]; })}>{open ? T('Zwiń') : T('Szczegóły')}</Btn>
      {!scs.length && (st.sites[x.site] || ({} as any)).manual && <Btn sm v="ghost danger" act="site-del" data-id={id} aria-label={T('Usuń lokację')} onClick={() => mutate((s) => { delete s.sites[id]; })}><Icon n="trash" /></Btn>}</div></td></tr>;
  if (!open) return main;
  const fld = (label: string, key: string, ph: string, mode?: any) => <Field label={label}>{inp(key, ph, label, mode)}</Field>;
  return <>{main}<tr className="crew-det site-det"><td colSpan={8}><div className="fgrid">
    {fld(T('Właściciel / osoba kontaktowa'), 'owner', T('imię i nazwisko, funkcja'))}{fld(T('Kontakt do właściciela'), 'ownerContact', T('telefon, e-mail'), 'tel')}
    <Field label={T('Stawka za wynajem lokacji')}>{inp('rate', T('np. 2 000 zł / dzień'), T('Stawka za wynajem lokacji'))}<RateHint st={st} kind="site" refId={id} /></Field>
    <Field label={T('Zasilanie na miejscu')}><Select value={info.power} bind="site.power" bid={id} label={T('Zasilanie na miejscu') + ' – ' + name} options={Core.POWER.map(([k, l]: [string, string]) => [k, T(l)])} onChange={(v) => updSite(id, 'power', v)} /></Field>
    <Field label={T('Miejscowość lub współrzędne do prognozy pogody')}><TextInput value={info.geoQuery || ''} placeholder={localityOf(info.address) || T('np. Zakopane albo 49.30, 19.95')} bind="site.geoQuery" bid={id} label={T('Miejscowość do prognozy') + ' – ' + name} onCommit={(v) => mutate((x) => { const o = x.sites[id] = x.sites[id] || Core.siteEntry(); o.geoQuery = v; o.geo = null; })} />
      <span className="small muted">{info.geo ? T('Pogoda dla: {p}', { p: info.geo.label }) : T('Puste pole = miejscowość z adresu.')}</span></Field>
    {fld(T('Lokalizacja toalety'), 'toilet', T('np. budynek dworca, parter; toi-toi przy bramie'))}{fld(T('Lokalizacja campu / bazy'), 'camp', T('miejsce na sprzęt, catering, busy, kampery'))}
    <Field label={T('Inne informacje / uwagi')} style={{ gridColumn: '1/-1' }}><TextArea rows={3} value={info.notes} bind="site.notes" bid={id} placeholder={T('parking, ograniczenia hałasu, godziny dostępu, klucze, zgody…')} label={T('Inne informacje / uwagi') + ' – ' + name} onCommit={(v) => updSite(id, 'notes', v)} /></Field>
  </div></td></tr></>;
}
