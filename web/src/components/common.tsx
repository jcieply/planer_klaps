/* Elementy wspólne dla kilku widoków. */
import { useRef, useState } from 'react';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import type { ProjectState } from '../domain/model';
import { mutate } from '../state/project';
import { goTab, setUI } from '../state/ui';
import { Btn, PageHead } from './ui';

/** pusty projekt: zachęta do wczytania scenariusza albo dodania sceny */
export function NeedScenes({ onAdd }: { onAdd: () => void }) {
  return <div className="card"><div className="empty"><h3>{T('Nie ma jeszcze scen')}</h3><p>{T('Wczytaj scenariusz albo dodaj sceny ręcznie. Scenariusz nie jest wymagany, a wszystkie zakładki działają także w pustym projekcie.')}</p>
    <div className="row" style={{ justifyContent: 'center' }}><Btn v="primary" big act="tab" data-tab="import" onClick={() => goTab('import')}>{T('Wczytaj scenariusz')}</Btn><Btn big act="scene-add" icon="plus" onClick={onAdd}>{T('Dodaj scenę ręcznie')}</Btn></div></div></div>;
}
/** widok wymagający dni zdjęciowych */
export function NoDays({ title }: { title: string }) {
  return <><PageHead title={title} /><div className="card"><div className="empty"><h3>{T('Najpierw dodaj dni zdjęciowe')}</h3><p>{T('Ten widok korzysta z dni zdjęciowych z kalendarzówki. Możesz je ułożyć automatycznie ze scen albo dodać puste dni i uzupełniać ręcznie.')}</p>
    <div className="row" style={{ justifyContent: 'center' }}><Btn v="primary" big act="day-add-stay" icon="plus" onClick={() => mutate((st) => { Core.addDay(st, 'shoot'); })}>{T('Dodaj dzień zdjęciowy')}</Btn><Btn big act="tab" data-tab="schedule" onClick={() => goTab('schedule')}>{T('Przejdź do kalendarzówki')}</Btn></div></div></div></>;
}
/** podpowiedź pod polem stawki: jak stawka trafia do kosztorysu */
export function RateHint({ st, kind, refId }: { st: ProjectState; kind: 'crew' | 'cast'; refId: string | number }) {
  const l = Core.rateLines(st).find((x: any) => x.kind === kind && String(x.ref) === String(refId));
  if (!l || !String(l.rate).trim()) return <span className="rate-hint muted">{T('Wpisz kwotę i jednostkę, np. 900 zł / dzień, 150 zł / h, 12 000 zł / projekt.')}</span>;
  if (!l.parsed) return <span className="rate-hint warn-t">{T('Nie rozpoznano kwoty – pozycja nie trafi do kosztorysu.')}</span>;
  return <span className="rate-hint">{Core.rateFormula(l)} = <b>{Core.fmtMoney(l.est)}</b> {T('w kosztorysie')}{l.off || st.budget.autoRates === false ? ' (' + T('pominięte') + ')' : ''}</span>;
}
/** nowa scena dodana ręcznie (otwiera szczegóły) */
export function addScene() {
  let id = '';
  mutate((st) => {
    const n = st.scenes.length + 1;
    let num = String(n); const used = new Set(st.scenes.map((s) => s.num));
    let k = n; while (used.has(num)) { k += 1; num = String(k); }
    id = Core.uid();
    st.scenes.push({ id, num, ie: 'INT', place: '', site: '', tod: 'DAY', eighths: 1, page: null, synopsis: '', notes: '', cast: [], elements: {}, text: '', heading: '' } as any);
  });
  setUI((s) => { s.drawer = id; s.f = { q: '', ie: '', tod: '', cast: '', site: '', plan: '' }; s.showScript = false; });
}
/** przewinięcie do dnia w kalendarzówce */
export function scrollToDay(id: string) {
  setTimeout(() => { const el = document.getElementById('day-' + id); if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, 60);
}
/** potwierdzenie drugim kliknięciem (np. usuwanie osoby) */
const confirms = new Map<string, number | null>();
export function confirmTwice(key: string): boolean {
  const t = confirms.get(key);
  if (t && Date.now() - t < 4000) { confirms.delete(key); return true; }
  confirms.set(key, Date.now());
  return false;
}

/** pole „nowa pozycja” z przyciskiem Dodaj (Enter też dodaje) */
export function NewName({ id, act, placeholder, label, button, onAdd }: { id: string; act: string; placeholder: string; label: string; button: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const go = () => { const t = v.trim(); if (t) { onAdd(t); setV(''); } ref.current?.focus(); };
  return <div className="row" style={{ marginTop: 12 }}><input ref={ref} className="inp" style={{ maxWidth: 280 }} id={id} placeholder={placeholder} aria-label={label} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }} />
    <Btn act={act} icon="plus" onClick={go}>{button}</Btn></div>;
}
