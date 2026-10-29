/* Wersje scenariusza (rewizje, kolorowe strony): lista rewizji, ustawienia nowej wersji przy imporcie, znacznik koloru sceny. */
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import type { Revision } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { setUI, toast, useUI } from '../state/ui';
import { Btn, Field, Select, TextInput, cx } from '../components/ui';
import { confirmTwice } from '../components/common';

const colorOptions = (): [string, string][] => Core.REV_COLORS().map((c) => [c.key, c.name]);

/** kolorowy znacznik rewizji (kropka + nazwa albo sama kropka) */
export function RevMark({ r, label, short }: { r: Revision | null | undefined; label?: boolean; short?: boolean }) {
  if (!r) return null;
  const c = Core.revColor(r.color);
  const name = Core.revName(r);
  return <span className={cx('revm', label && 'lab', short && 'tag')} data-rev={c.key} title={T('Rewizja: {r}', { r: name }) + (r.date ? ' · ' + r.date : '')}
    style={{ '--rv-bg': '#' + c.bg, '--rv-dot': '#' + c.dot } as React.CSSProperties}>{short ? 'R' + r.n : <><i />{label ? name : null}</>}</span>;
}

/** ustawienia nowej wersji w podglądzie importu (kolor, nazwa, data) */
export function RevisionImportFields() {
  const st = useProject((s) => s.st)!;
  const imp = useUI((s) => s.imp);
  const def = Core.nextRevision(st);
  const rev = imp.rev || { color: def.color, label: def.label, date: def.date, note: '' };
  const auto = (key: string) => T('{c} rewizja', { c: Core.revColor(key).name });
  const set = (k: 'color' | 'label' | 'date' | 'note', v: string) => setUI((s) => {
    const cur = s.imp.rev || { ...rev };
    if (k === 'color' && (cur.label === auto(cur.color) || !cur.label.trim())) cur.label = auto(v);
    cur[k] = v;
    s.imp.rev = cur;
  });
  const c = Core.revColor(rev.color);
  return <div className="rev-new" style={{ '--rv-bg': '#' + c.bg, '--rv-dot': '#' + c.dot } as React.CSSProperties}>
    <span className="lbl">{T('Nowa rewizja scenariusza')}</span>
    <div className="fgrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
      <Field label={T('Kolor stron')}><Select value={rev.color} data-act-change="imp-rev-color" options={colorOptions()} onChange={(v) => set('color', v)} /></Field>
      <Field label={T('Nazwa wersji')}><TextInput value={rev.label} data-act-change="imp-rev-label" onCommit={(v) => set('label', v)} /></Field>
      <Field label={T('Data')}><input className="inp" type="date" value={rev.date} data-act-change="imp-rev-date" onChange={(e) => set('date', e.target.value)} /></Field>
    </div>
    <span className="muted small">{T('Sceny, których tekst się zmienił albo które są nowe, dostaną kolor tej rewizji. Pozostałe zachowają swój kolor.')}</span>
  </div>;
}

/** lista wersji scenariusza na stronie „Scenariusz” */
export function RevisionsCard() {
  const st = useProject((s) => s.st)!;
  const list = Core.revisions(st);
  if (!list.length && !st.scenes.length) return null;
  const upd = (id: string, fn: (r: Revision) => void) => mutate((x) => { const r = (x.revisions || []).find((y) => y.id === id); if (r) { fn(r); const last = Core.revisions(x).at(-1); if (last && last.id === id) { x.meta.scriptVersion = Core.revName(r); x.meta.scriptDate = r.date; } } });
  const addManual = () => {
    let name = '';
    mutate((x) => { Core.ensureBaseRevision(x); const d = Core.nextRevision(x); const r = Core.newRevision(x, { color: d.color, label: d.label, note: T('Zmiany wprowadzone ręcznie') }); name = Core.revName(r); });
    toast(T('Dodano: {r}. Oznacz zmienione sceny w ich szczegółach (pole „Rewizja”).', { r: name }));
  };
  return <div className="card rev-card" style={{ marginBottom: 16 }}>
    <div className="card-h"><h2>{T('Wersje scenariusza')}</h2><span className="muted small">{T('kolorowe strony, jak w praktyce produkcyjnej')}</span>
      <div style={{ marginLeft: 'auto' }}><Btn sm act="rev-add" icon="plus" onClick={addManual}>{T('Nowa rewizja bez pliku')}</Btn></div></div>
    <div className="card-b">
      {!list.length ? <p className="muted small" style={{ margin: 0 }}>{T('Historia wersji zacznie się przy następnym wczytaniu scenariusza albo po dodaniu rewizji.')}</p>
        : <div className="tbl-wrap"><table className="tbl rev-tbl"><thead><tr><th>{T('Kolor')}</th><th>{T('Nazwa wersji')}</th><th>{T('Data')}</th><th>{T('Zmiany')}</th><th>{T('Wpływ na plan')}</th><th /></tr></thead>
          <tbody>{list.slice().reverse().map((r) => {
            const c = Core.revColor(r.color);
            const imp = r.n > 0 ? Core.revisionImpact(st, r) : [];
            const marked = st.scenes.filter((s) => s.rev === r.id).length;
            return <tr key={r.id} data-id={r.id} style={{ '--rv-bg': '#' + c.bg, '--rv-dot': '#' + c.dot } as React.CSSProperties}>
              <td className="rev-col"><span className="revm"><i /></span><Select className="inp mini" value={r.color} bind="rev.color" bid={r.id} label={T('Kolor rewizji')} options={colorOptions()} onChange={(v) => upd(r.id, (x) => { x.color = v; })} /></td>
              <td><TextInput value={r.label} bind="rev.label" bid={r.id} placeholder={c.name} onCommit={(v) => upd(r.id, (x) => { x.label = v; })} />{r.file ? <small className="muted">{r.file}</small> : null}</td>
              <td><input className="inp" type="date" value={r.date} data-bind="rev.date" data-id={r.id} onChange={(e) => { const v = e.target.value; upd(r.id, (x) => { x.date = v; }); }} /></td>
              <td className="small">{r.n === 0 ? <span className="muted">{T('wersja pierwotna')}</span> : <>
                {r.changed.length > 0 && <span className="chip" title={r.changed.join(', ')}>{T('zmienione')} <b>{r.changed.length}</b></span>}{' '}
                {r.added.length > 0 && <span className="chip" title={r.added.join(', ')}>{T('nowe')} <b>{r.added.length}</b></span>}{' '}
                {r.removed.length > 0 && <span className="chip" title={r.removed.map((x) => x.num).join(', ')}>{T('usunięte')} <b>{r.removed.length}</b></span>}
                {!r.changed.length && !r.added.length && !r.removed.length && <span className="muted">{marked ? T('oznaczone ręcznie: {n}', { n: marked }) : T('brak oznaczonych scen')}</span>}
              </>}</td>
              <td className="small">{r.n === 0 ? '—' : imp.length ? imp.map((x) => <span key={x.dayId} className="dayb" title={[x.scenes.length && T('zmienione sceny: {s}', { s: x.scenes.join(', ') }), x.removedNums && T('usunięte z planu: {s}', { s: x.removedNums.join(', ') })].filter(Boolean).join(' · ')}>{x.no ? 'D' + x.no : T('wolny')}</span>) : <span className="muted">{T('nie dotyczy planu')}</span>}</td>
              <td>{r.n > 0 && <Btn sm v="ghost" act="rev-del" data-id={r.id} icon="trash" aria-label={T('Usuń rewizję')} onClick={() => {
                if (!confirmTwice('rev:' + r.id)) { toast(T('Kliknij jeszcze raz, aby usunąć rewizję. Sceny wrócą do koloru poprzedniej wersji.'), 'bad'); return; }
                mutate((x) => { Core.removeRevision(x, r.id); }); toast(T('Rewizja usunięta.'));
              }} />}</td>
            </tr>;
          })}</tbody></table></div>}
    </div></div>;
}
