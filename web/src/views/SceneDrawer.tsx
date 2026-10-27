/* Szczegóły sceny w szufladzie z prawej: dane sceny, obsada, elementy, uwagi i tekst. */
import { useState } from 'react';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import type { Scene } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { setUI, toast, useUI } from '../state/ui';
import { dayLabel, kcls, parseEighths, sitesList } from '../lib/format';
import { moveScenesToDay } from '../lib/helpers';
import { ActionSelect, AddInput, BlurInput, Btn, Datalist, Drawer, Field, Icon, Select, TextArea, TextInput } from '../components/ui';
import { IES, TODS } from './Board';

export function SceneDrawer() {
  const id = useUI((s) => s.drawer);
  const st = useProject((s) => s.st);
  const sc = st && id ? st.scenes.find((s) => s.id === id) : null;
  const close = () => setUI((s) => { s.drawer = null; });
  return <Drawer open={!!sc} onClose={close} label={sc ? T('Scena {n}', { n: sc.num }) : ''}>{sc && <SceneBody key={sc.id} sc={sc} close={close} />}</Drawer>;
}

function SceneBody({ sc, close }: { sc: Scene; close: () => void }) {
  const st = useProject((s) => s.st)!;
  const showScript = useUI((s) => s.showScript);
  const [confirmDel, setConfirmDel] = useState(false);
  const i = st.scenes.indexOf(sc);
  const idx = Core.scheduleIndex(st), nums = Core.dayNumbers(st);
  const sch = idx.get(sc.id);
  const cm = Core.castMap(st);
  const avail = st.cast.filter((c) => !sc.cast.includes(c.id));
  const el = sc.elements || {};
  const upd = (fn: (s: Scene) => void) => mutate((x) => { const s = x.scenes.find((y) => y.id === sc.id); if (s) fn(s); });
  const go = (j: number) => { const n = st.scenes[j]; if (n) { setUI((s) => { s.drawer = n.id; }); setConfirmDel(false); const b = document.querySelector('.drawer-b'); if (b) b.scrollTop = 0; } };
  const lines = (sc.text || '').split('\n').map((l, k) => { const t = l.slice(0, 1), tx = l.slice(2); return tx ? <div key={k} className={t}>{tx}</div> : null; });
  return <>
    <div className={'drawer-h ' + kcls(sc)}>
      <Btn sm act="scene-prev" disabled={i === 0} aria-label={T('Poprzednia scena')} onClick={() => go(i - 1)}><Icon n="left" /></Btn><Btn sm act="scene-next" disabled={i === st.scenes.length - 1} aria-label={T('Następna scena')} onClick={() => go(i + 1)}><Icon n="right" /></Btn>
      <div className="ttl">{T('Scena {n}', { n: sc.num })}<div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '.02em' }}>{Core.IE_LABEL[sc.ie] || ''} {sc.place || sc.site} · {(Core.TOD[sc.tod] || {}).label || ''}</div></div>
      <Btn sm act="drawer-close" aria-label={T('Zamknij')} onClick={close}><Icon n="x" /></Btn></div>
    <div className="drawer-b" data-scroll-id="drawer">
      <div className="fgrid">
        <Field label={T('Numer sceny')}><TextInput value={sc.num} bind="scene.num" bid={sc.id} onCommit={(v) => upd((s) => { s.num = v; })} /></Field>
        <Field label={T('Wnętrze / plener')}><Select value={sc.ie} bind="scene.ie" bid={sc.id} options={IES.map(([k, l]) => [k, T(l)])} onChange={(v) => upd((s) => { s.ie = v as Scene['ie']; })} /></Field>
        <Field label={T('Pora dnia')}><Select value={sc.tod} bind="scene.tod" bid={sc.id} options={TODS.map(([k, l]) => [k, T(l)])} onChange={(v) => upd((s) => { s.tod = v as Scene['tod']; })} /></Field>
        <Field label={T('Długość (str.)')}><BlurInput value={Core.fmtEighths(sc.eighths)} data-act-change="scene-eighths" data-id={sc.id} title={T('Np. 2 3/8, 5/8 albo 1')} onCommit={(v) => {
          const n = parseEighths(v);
          if (n == null || n < 1 || n > 8 * 20) { toast(T('Wpisz długość np. 5/8, 1 3/8 albo 2.'), 'bad'); return; }
          upd((s) => { s.eighths = n; });
        }} /></Field>
      </div>
      <div className="fgrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))' }}>
        <Field label={T('Plan / lokacja w scenie')}><TextInput value={sc.place} bind="scene.place" bid={sc.id} onCommit={(v) => upd((s) => { s.place = v; })} /></Field>
        <Field label={T('Obiekt (grupowanie)')}><TextInput value={sc.site} bind="scene.site" bid={sc.id} list="dl-sites" onCommit={(v) => mutate((x) => { const s = x.scenes.find((y) => y.id === sc.id); if (!s) return; s.site = v; const k = s.site || s.place; if (k && !x.sites[k]) x.sites[k] = Core.siteEntry(); })} /><Datalist id="dl-sites" items={sitesList(st)} /></Field>
        <Field label={T('Dzień zdjęciowy')}><Select value={sch ? sch.dayId : ''} data-act-change="scene-day" data-id={sc.id} options={[['', T('Nie zaplanowano')], ...st.days.filter((d) => d.kind === 'shoot').map((d) => [d.id, dayLabel(d, nums)] as [string, string]), ['__new', T('+ Nowy dzień zdjęciowy')]]}
          onChange={(v) => mutate((x) => { moveScenesToDay(x, [sc.id], v === '' ? '__pool' : v); })} /></Field>
      </div>
      <Field label={T('Opis sceny')}><TextArea rows={3} value={sc.synopsis} bind="scene.synopsis" bid={sc.id} onCommit={(v) => upd((s) => { s.synopsis = v; })} /></Field>
      <div><span className="lbl">{T('Obsada w scenie')}</span>
        <div className="chips" style={{ marginBottom: 8 }}>{sc.cast.length ? sc.cast.slice().sort((a, b) => a - b).map((cid) => { const c = cm.get(cid); return c ? <span key={cid} className="chip acc"><b>{c.id}</b> {c.name}<button type="button" data-act="scene-cast-del" data-id={sc.id} data-cid={c.id} aria-label={T('Usuń {n} ze sceny', { n: c.name })} onClick={() => upd((s) => { s.cast = s.cast.filter((x) => x !== cid); s.manualCast = (s.manualCast || []).filter((x: number) => x !== cid); })}>×</button></span> : null; }) : <span className="muted small">{T('Nikt nie występuje.')}</span>}</div>
        <div className="row">
          <ActionSelect className="inp mini" data-act-change="scene-cast-add" data-id={sc.id} label={T('Dodaj postać do sceny')} placeholder={T('Dodaj postać…')} options={avail.map((c) => [String(c.id), `${c.id} ${c.name}`] as [string, string])}
            onPick={(v) => upd((s) => { const cid = +v; if (!s.cast.includes(cid)) { s.cast.push(cid); s.manualCast = (s.manualCast || []).concat(cid); } })} />
          <AddInput className="mini" style={{ width: 170 }} placeholder={T('lub nowa postać')} data-act-change="scene-cast-new" data-id={sc.id} id="dr-newcast" aria-label={T('Nowa postać')}
            onAdd={(v) => mutate((x) => { const s = x.scenes.find((y) => y.id === sc.id); const name = Core.normName(v); if (!s || !name) return; let c = x.cast.find((y) => Core.normName(y.name) === name); if (!c) { c = Core.newCast({ id: x.nextCast++, name }); x.cast.push(c!); } if (!s.cast.includes(c!.id)) { s.cast.push(c!.id); s.manualCast = (s.manualCast || []).concat(c!.id); } })} />
        </div></div>
      <div><span className="lbl">{T('Elementy sceny')}</span><div className="eg">{Core.ELEMENT_CATS.map(([k, l]: [string, string]) => <div key={k}><div className="small" style={{ fontWeight: 600, marginBottom: 3 }}>{T(l)}</div>
        <div className="chips">{(el[k] || []).map((t: string, n: number) => <span key={n} className="chip">{t}<button type="button" data-act="el-del" data-id={sc.id} data-cat={k} data-i={n} aria-label={T('Usuń {n}', { n: t })} onClick={() => upd((s) => { const arr = (s.elements[k] || []).slice(); arr.splice(n, 1); s.elements[k] = arr; })}>×</button></span>)}</div>
        <AddInput className="mini" style={{ width: '100%' }} id={'el-' + k} placeholder={T('dodaj i Enter')} data-act-change="el-add" data-id={sc.id} data-cat={k} aria-label={`${T(l)}: ${T('dodaj')}`}
          onAdd={(v) => upd((s) => { s.elements = s.elements || {}; s.elements[k] = (s.elements[k] || []).concat(v.split(/\s*[;,]\s*/).filter(Boolean)); })} /></div>)}</div></div>
      <Field label={T('Uwagi do sceny (trafiają do wydruku)')}><TextArea rows={2} value={sc.notes} bind="scene.notes" bid={sc.id} placeholder={T('np. zgoda na plan, dziecko na planie, dublet dźwiękowy…')} onCommit={(v) => upd((s) => { s.notes = v; })} /></Field>
      <div><div className="row" style={{ marginBottom: 6 }}><span className="lbl" style={{ margin: 0 }}>{T('Tekst sceny')}</span><Btn sm v="ghost" act="script-toggle" aria-expanded={showScript} onClick={() => setUI((s) => { s.showScript = !s.showScript; })}>{showScript ? T('Ukryj') : T('Pokaż')}</Btn></div>
        {showScript && <div className="script">{lines.some(Boolean) ? lines : <span className="muted">{T('Brak tekstu (scena dodana ręcznie).')}</span>}</div>}</div>
      <div className="row" style={{ borderTop: '1px solid var(--line-2)', paddingTop: 12 }}>{confirmDel
        ? <><span className="small">{T('Usunąć scenę {n}?', { n: sc.num })}</span><Btn sm v="danger" act="scene-del-yes" onClick={() => { mutate((x) => { Core.removeScenes(x, [sc.id]); }); setUI((s) => { s.drawer = null; s.sel = s.sel.filter((y) => y !== sc.id); }); toast(T('Scena usunięta.')); }}>{T('Tak, usuń')}</Btn><Btn sm act="scene-del-no" onClick={() => setConfirmDel(false)}>{T('Anuluj')}</Btn></>
        : <Btn sm v="ghost danger" act="scene-del" icon="trash" onClick={() => setConfirmDel(true)}>{T('Usuń scenę')}</Btn>}</div>
    </div></>;
}
