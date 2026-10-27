/* Shotlista: tabela ujęć (TanStack Table – definicje kolumn; przy dużych listach TanStack Virtual) i import z Excela / CSV. */
import { useMemo, useRef } from 'react';
import { createColumnHelper, flexRender, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import { Table } from '../domain/table';
import type { ProjectState, Shot } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { setUI, useUI } from '../state/ui';
import { applyShotImport, doExport, readShotFile } from '../state/actions';
import { kcls, pl, plN, sitesList } from '../lib/format';
import { Btn, Datalist, ExportBtns, Field, Icon, Modal, PageHead, Select, TextArea, TextInput, cx } from '../components/ui';

type Row = Shot & { etaMin: number | null };
const ch = createColumnHelper<Row>();
const VIRTUAL_FROM = 120;

function updShot(id: string, key: keyof Shot, val: string) {
  mutate((st) => {
    const x = st.shots.find((y) => y.id === id); if (!x) return;
    if (key === 'sceneId' && val !== x.sceneId) {
      const cm = Core.castMap(st);
      const names = (sc: any) => (sc ? sc.cast.map((c: number) => (cm.get(c) || ({} as any)).name).filter(Boolean).join(', ') : '');
      const siteOf = (sc: any) => (sc ? sc.site || sc.place || '' : '');
      const prev = st.scenes.find((s) => s.id === x.sceneId), sc = st.scenes.find((s) => s.id === val);
      if (sc) {
        if (!x.cast || (prev && x.cast === names(prev))) x.cast = names(sc);
        if (!x.site || (prev && x.site === siteOf(prev))) x.site = siteOf(sc);
        if (!x.shot) x.shot = Core.nextShotNo(st, val);
      }
    }
    (x as any)[key] = val;
  });
}
function moveShot(id: string, dir: number) {
  mutate((st) => {
    const i = st.shots.findIndex((x) => x.id === id); if (i < 0) return;
    for (let j = i + dir; j >= 0 && j < st.shots.length; j += dir) if (st.shots[j].sceneId === st.shots[i].sceneId) { [st.shots[i], st.shots[j]] = [st.shots[j], st.shots[i]]; return; }
  });
}

export function Shotlist() {
  const st = useProject((s) => s.st)!;
  const shF = useUI((s) => s.shF.scene);
  const f = shF && st.scenes.some((s) => s.id === shF) ? shF : '';
  const all: Row[] = useMemo(() => Core.shotRows(st), [st]);
  const rows = useMemo(() => all.filter((x) => !f || x.sceneId === f), [all, f]);
  const totalEta = rows.reduce((a, x) => a + (x.etaMin || 0), 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const addShot = () => {
    let id = '';
    mutate((x) => { const last = x.shots[x.shots.length - 1]; const sh = Core.newShot(x, f || (last ? last.sceneId : '') || (x.scenes[0] || ({} as any)).id || ''); x.shots.push(sh); id = sh.id; });
    setTimeout(() => document.querySelector<HTMLTextAreaElement>(`textarea[data-bind="shot.desc"][data-id="${id}"]`)?.focus(), 40);
  };
  const right = <>
    <Field label={T('Scena')}><Select data-act-change="sh-scene" value={f} onChange={(v) => setUI((s) => { s.shF.scene = v; })} options={[['', T('Wszystkie sceny')], ...st.scenes.map((s) => [s.id, `${s.num} · ${s.place || s.site || ''}`.trim()] as [string, string])]} /></Field>
    <Btn act="shot-add" icon="plus" onClick={addShot}>{T('Dodaj ujęcie')}</Btn>
    <Btn act="shots-import" icon="upload" title={T('Import ujęć z pliku Excel (XLSX, XLS) albo CSV')} onClick={() => fileRef.current?.click()}>{T('Importuj z Excela / CSV')}</Btn>
    <input ref={fileRef} type="file" id="shots-in" hidden accept=".xlsx,.xlsm,.xls,.csv,.tsv,.txt,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(e) => { const fl = e.target.files?.[0]; e.target.value = ''; if (fl) void readShotFile(fl); }} />
    <ExportBtns prefix="shot-export" enabled={st.shots.length > 0} onPdf={() => doExport('pdf', ['shotlist'], 'shotlista')} onXlsx={() => doExport('xlsx', ['shotlist'], 'shotlista')} />
  </>;
  return <>
    <PageHead title={T('Shotlista')} sub={T('Lista ujęć do zdjęć. Wybierz scenę, a aktorzy i lokacja uzupełnią się ze sceny, każde pole możesz zmienić. ETA wpisz w minutach (20) albo jako 0:20. ETA podpowiada też czas realizacji w Planie pracy.')} right={right} />
    <Datalist id="dl-lens" items={['14 mm', '18 mm', '24 mm', '35 mm', '50 mm', '85 mm', '100 mm', '135 mm', 'Zoom 24–70', 'Zoom 70–200']} />
    <Datalist id="dl-grip" items={[T('Statyw'), T('Z ręki'), 'Steadicam', 'Gimbal', 'Dolly', 'Slider', T('Dźwig / jib'), T('Kamera w aucie')]} />
    <Datalist id="dl-places" items={sitesList(st)} />
    <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h3>{T('Legenda typów planu')}</h3><span className="muted small">{T('skróty w kolumnie „Typ planu”')}</span></div>
      <div className="card-b"><div className="legend-shots">{Core.SHOT_TYPES.map(([k, n, d]: [string, string, string]) => <div key={k}><b>{k}</b><strong>{T(n)}</strong> <span>– {T(d)}</span></div>)}</div></div></div>
    <div className="card"><div className="card-h"><h3>{T('Ujęcia')}</h3><span className="chip">{rows.length}</span>{totalEta > 0 && <span className="chip acc">{T('ETA razem {d}', { d: Core.fmtDur(totalEta) })}</span>}</div>
      {rows.length ? <ShotTable st={st} rows={rows} /> : <div className="empty"><p>{st.shots.length ? T('Ta scena nie ma jeszcze ujęć.') : T('Nie ma jeszcze ujęć. Dodaj pierwsze i wybierz scenę.')}</p><Btn v="primary" act="shot-add" icon="plus" onClick={addShot}>{T('Dodaj ujęcie')}</Btn></div>}</div>
  </>;
}

function ShotTable({ st, rows }: { st: ProjectState; rows: Row[] }) {
  const used = useMemo(() => Core.shotDays(st), [st]);
  const sceneOpts: [string, string][] = useMemo(() => [['', T('— bez sceny —')], ...st.scenes.map((s) => [s.id, `${s.num} · ${s.place || s.site || ''}`.trim()] as [string, string])], [st.scenes]);
  const typeOpts: [string, string][] = [['', '—'], ...Core.SHOT_TYPES.map(([k]) => [k, k] as [string, string])];
  // definicje kolumn są stałe (inaczej React wymieniałby pola w trakcie pisania); bieżące dane czytają z ref
  const ctx = useRef({ used, sceneOpts, typeOpts });
  ctx.current = { used, sceneOpts, typeOpts };
  const columns = useMemo(() => [
    ch.accessor('sceneId', { header: () => T('Scena'), meta: { style: { minWidth: 190 } }, cell: (c) => { const x = c.row.original; const u = ctx.current.used.get(x.id); return <><Select value={x.sceneId} bind="shot.sceneId" bid={x.id} label={T('Scena')} options={ctx.current.sceneOpts} onChange={(v) => updShot(x.id, 'sceneId', v)} />{u && <div className="small used">{T('w planie: {d}', { d: u.join(', ') })}</div>}</>; } }),
    ch.accessor('shot', { header: () => T('Ujęcie'), meta: { style: { width: 78 } }, cell: (c) => <TextInput className="shot" value={c.getValue()} placeholder="1" bind="shot.shot" bid={c.row.original.id} label={T('Ujęcie')} onCommit={(v) => updShot(c.row.original.id, 'shot', v)} /> }),
    ch.accessor('type', { header: () => T('Typ planu'), meta: { style: { width: 92 } }, cell: (c) => <Select value={c.getValue()} bind="shot.type" bid={c.row.original.id} label={T('Typ planu')} options={ctx.current.typeOpts} onChange={(v) => updShot(c.row.original.id, 'type', v)} /> }),
    ch.accessor('desc', { header: () => T('Opis'), meta: { style: { minWidth: 240 } }, cell: (c) => <TextArea className="cell" rows={3} value={c.getValue()} placeholder={T('co jest w kadrze, ruch kamery')} bind="shot.desc" bid={c.row.original.id} label={T('Opis ujęcia')} onCommit={(v) => updShot(c.row.original.id, 'desc', v)} /> }),
    ch.accessor('lens', { header: () => T('Obiektyw'), meta: { style: { minWidth: 100 } }, cell: (c) => <TextInput list="dl-lens" value={c.getValue()} placeholder="35 mm" bind="shot.lens" bid={c.row.original.id} label={T('Obiektyw')} onCommit={(v) => updShot(c.row.original.id, 'lens', v)} /> }),
    ch.accessor('grip', { header: () => 'Grip', meta: { style: { minWidth: 110 } }, cell: (c) => <TextInput list="dl-grip" value={c.getValue()} placeholder={T('statyw')} bind="shot.grip" bid={c.row.original.id} label="Grip" onCommit={(v) => updShot(c.row.original.id, 'grip', v)} /> }),
    ch.accessor('eta', { header: () => 'ETA', meta: { style: { width: 90 } }, cell: (c) => <TextInput value={c.getValue()} placeholder="20 min" bind="shot.eta" bid={c.row.original.id} label="ETA" onCommit={(v) => updShot(c.row.original.id, 'eta', v)} /> }),
    ch.accessor('cast', { header: () => T('Aktorzy'), meta: { style: { minWidth: 140 } }, cell: (c) => <TextInput value={c.getValue()} placeholder={T('aktorzy w kadrze')} bind="shot.cast" bid={c.row.original.id} label={T('Aktorzy')} onCommit={(v) => updShot(c.row.original.id, 'cast', v)} /> }),
    ch.accessor('site', { header: () => T('Lokacja'), meta: { style: { minWidth: 180 } }, cell: (c) => <TextInput list="dl-places" value={c.getValue()} placeholder={T('lokacja')} bind="shot.site" bid={c.row.original.id} label={T('Lokacja')} onCommit={(v) => updShot(c.row.original.id, 'site', v)} /> }),
    ch.display({ id: 'act', header: () => '', meta: { style: { width: 96 } }, cell: (c) => { const id = c.row.original.id; return <div className="rowact"><Btn sm v="ghost" act="shot-up" data-id={id} aria-label={T('Wyżej')} onClick={() => moveShot(id, -1)}><Icon n="up" /></Btn><Btn sm v="ghost" act="shot-down" data-id={id} aria-label={T('Niżej')} onClick={() => moveShot(id, 1)}><Icon n="down" /></Btn><Btn sm v="ghost danger" act="shot-del" data-id={id} aria-label={T('Usuń ujęcie')} onClick={() => mutate((x) => { x.shots = x.shots.filter((y) => y.id !== id); })}><Icon n="trash" /></Btn></div>; } }),
  ], []); // eslint-disable-line react-hooks/exhaustive-deps
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel(), getRowId: (r) => r.id });
  const sm = new Map(st.scenes.map((s) => [s.id, s]));
  const body = table.getRowModel().rows;
  const ref = useRef<HTMLTableSectionElement>(null);
  const big = body.length >= VIRTUAL_FROM;
  const v = useWindowVirtualizer({ count: big ? body.length : 0, estimateSize: () => 84, overscan: 8, scrollMargin: ref.current ? ref.current.getBoundingClientRect().top + window.scrollY : 0 });
  const tr = (r: (typeof body)[number]) => { const sc = sm.get(r.original.sceneId); return <tr key={r.id} className={sc ? kcls(sc) : undefined} style={sc ? { background: 'var(--sb)', color: 'var(--s-ink)' } : undefined}>{r.getVisibleCells().map((c) => <td key={c.id} style={(c.column.columnDef.meta as any)?.style}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>)}</tr>; };
  let rowsEl;
  if (!big) rowsEl = body.map(tr);
  else {
    const items = v.getVirtualItems();
    const top = items.length ? items[0].start - v.options.scrollMargin : 0, bottom = items.length ? v.getTotalSize() - (items[items.length - 1].end - v.options.scrollMargin) : 0;
    rowsEl = <>{top > 0 && <tr aria-hidden="true" style={{ height: top }} />}{items.map((it) => tr(body[it.index]))}{bottom > 0 && <tr aria-hidden="true" style={{ height: bottom }} />}</>;
  }
  return <div className="tbl-wrap" style={{ border: 0, borderRadius: 0 }}><table className="tbl sched-tbl">
    <thead>{table.getHeaderGroups().map((hg) => <tr key={hg.id}>{hg.headers.map((h) => <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>)}</tr>)}</thead>
    <tbody ref={ref}>{rowsEl}</tbody></table></div>;
}

/* ---------- import shotlisty ---------- */
const colLetter = (i: number) => { let s = ''; i += 1; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
export function ShotImport() {
  const m = useUI((s) => s.shImp);
  const st = useProject((s) => s.st);
  const close = () => setUI((s) => { s.shImp = null; });
  return <Modal open={!!m && !!st} onClose={close} act="shimp-close" title={T('Import shotlisty')} className="wide" headExtra={m ? <span className="muted small">{m.data.file}</span> : null}>{m && st ? <ShotImportBody m={m} st={st} /> : null}</Modal>;
}
function ShotImportBody({ m, st }: { m: any; st: ProjectState }) {
  const sheet = m.data.sheets[m.sheet] || m.data.sheets[0];
  const rows: any[][] = sheet.rows, header = rows[m.header] || [];
  const ncol = Math.max(header.length, ...rows.slice(0, 60).map((r) => r.length));
  const colOpts: [string, string][] = [['-1', T('— pomiń —')], ...Array.from({ length: ncol }, (_, i) => [String(i), `${colLetter(i)} · ${(Table.cellStr(header[i]) || T('kolumna {n}', { n: i + 1 })).slice(0, 40)}`] as [string, string])];
  const pv = useMemo(() => Table.preview(st, rows, m.header, m.map, { create: m.create }), [st, rows, m.header, m.map, m.create]);
  const hdrOpts: [string, string][] = rows.slice(0, 15).map((r, i) => [String(i), `${T('Wiersz {n}', { n: i + 1 })}: ${r.map(Table.cellStr).filter(Boolean).join(' · ').slice(0, 60)}`]);
  const inScenes = pv.shots.filter((x: any) => x.sceneId).length;
  const mode = m.mode === 'replace' ? 'replace' : 'append';
  const upd = (fn: (x: any) => void) => setUI((s) => { if (s.shImp) fn(s.shImp); });
  return <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
    <div className="row" style={{ alignItems: 'flex-end' }}>
      {m.data.sheets.length > 1 && <Field label={T('Arkusz')}><Select data-act-change="shimp-sheet" value={String(m.sheet)} options={m.data.sheets.map((sh: any, i: number) => [String(i), `${sh.name} (${sh.rows.length})`])} onChange={(v) => upd((x) => { x.sheet = +v; const r = x.data.sheets[x.sheet].rows; x.header = Table.findHeader(r); x.map = Table.guessMap(r[x.header] || []); })} /></Field>}
      <Field label={T('Wiersz z nagłówkami kolumn')} className="grow" style={{ maxWidth: 520 }}><Select data-act-change="shimp-header" value={String(m.header)} options={hdrOpts} onChange={(v) => upd((x) => { x.header = +v; x.map = Table.guessMap(x.data.sheets[x.sheet].rows[x.header] || []); })} /></Field>
    </div>
    <div><div className="lbl" style={{ marginBottom: 8 }}>{T('Przypisanie kolumn')} <span className="muted small" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>{T('rozpoznane automatycznie z nagłówków – możesz je zmienić')}</span></div>
      <div className="fgrid map-grid">{Table.FIELDS.map(([k, label]: [string, string]) => <Field key={k} label={T(label)} className={cx('map-f', m.map[k] >= 0 && 'on')}><Select data-act-change="shimp-map" data-k={k} label={T('Kolumna dla pola {f}', { f: T(label) })} value={String(m.map[k])} options={colOpts}
        onChange={(v) => upd((x) => { x.map[k] = +v; if (+v >= 0) Object.keys(x.map).forEach((y) => { if (y !== k && x.map[y] === +v) x.map[y] = -1; }); })} /></Field>)}</div></div>
    <div className="row">
      <div className="seg" role="group" aria-label={T('Sposób importu')}><button type="button" data-act="shimp-mode" data-v="append" aria-pressed={mode === 'append'} onClick={() => upd((x) => { x.mode = 'append'; })}>{T('Dopisz do shotlisty')}</button><button type="button" data-act="shimp-mode" data-v="replace" aria-pressed={mode === 'replace'} onClick={() => upd((x) => { x.mode = 'replace'; })}>{T('Zastąp shotlistę ({n})', { n: st.shots.length })}</button></div>
      <label className="chk"><input type="checkbox" data-act-change="shimp-create" checked={!!m.create} onChange={(e) => { const c = e.target.checked; upd((x) => { x.create = c; }); }} /> {T('Dodaj brakujące sceny')}</label>
    </div>
    <div className="chips"><span className="chip acc"><b>{pv.shots.length}</b> {pl(pv.shots.length, 'ujęcie', 'ujęcia', 'ujęć')}</span><span className="chip">{T('{n} w istniejących scenach', { n: inScenes })}</span>
      {pv.newScenes.length > 0 && <span className="chip">{T('nowe sceny: {l}', { l: pv.newScenes.map((x: any) => x.num).join(', ') })}</span>}{pv.noScene > 0 && <span className="chip">{T('{n} bez sceny', { n: pv.noScene })}</span>}{pv.skipped > 0 && <span className="chip">{T('{n} pustych wierszy pominięto', { n: pv.skipped })}</span>}</div>
    {m.map.scene < 0 && <div className="notice warn" style={{ margin: 0 }}><div><Icon n="warn" /></div><div>{T('Nie wskazano kolumny ze sceną – ujęcia trafią do shotlisty bez przypisanej sceny.')}</div></div>}
    {pv.shots.length ? <><div className="preview"><table><thead><tr><th>{T('Sc.')}</th><th>{T('Uj.')}</th><th>{T('Typ')}</th><th>{T('Opis')}</th><th>{T('Obiektyw')}</th><th>Grip</th><th>ETA</th><th>{T('Obsada')}</th><th>{T('Lokacja')}</th></tr></thead>
      <tbody>{pv.shots.slice(0, 10).map((x: any, i: number) => <tr key={i}><td><b>{x.num || x.sceneKey || '—'}</b>{x.isNew ? <> <span className="diet-tag warn-tag">{T('nowa')}</span></> : !x.sceneId && x.sceneKey ? <> <span className="diet-tag warn-tag">?</span></> : null}</td><td>{x.shot}</td><td>{x.type}</td><td className="trunc">{x.desc}</td><td>{x.lens}</td><td>{x.grip}</td><td>{x.eta}</td><td className="trunc">{x.cast}</td><td className="trunc">{x.site}</td></tr>)}</tbody></table></div>
      {pv.shots.length > 10 && <p className="small muted" style={{ margin: 0 }}>{T('…i {n} kolejnych', { n: pv.shots.length - 10 })}</p>}</>
      : <div className="empty"><p>{T('Nie znaleziono ujęć. Sprawdź wiersz nagłówków i przypisanie kolumn.')}</p></div>}
    <div className="row" style={{ justifyContent: 'flex-end' }}><Btn act="shimp-close" onClick={() => setUI((s) => { s.shImp = null; })}>{T('Anuluj')}</Btn><Btn v="primary" act="shimp-go" disabled={!pv.shots.length} onClick={applyShotImport}>{T('Importuj {n}', { n: plN(pv.shots.length, 'ujęcie', 'ujęcia', 'ujęć') })}</Btn></div>
  </div>;
}
