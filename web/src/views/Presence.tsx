/* Miękka blokada: informacja, że ktoś inny ma teraz otwartą tę samą scenę, dzień planu pracy albo osobę. Niczego nie blokuje –
   zmiany łączą się same, ale wiadomo, z kim lepiej się dogadać. */
import { T } from '../domain/i18n';
import { useCollab, type Focus, type Peer } from '../collab/session';

/** inne osoby, które mają teraz otwarte to samo miejsce (wynik stabilny, odświeża się tylko przy zmianie osób) */
export function useEditors(k: Focus['k'], id: string | number): Peer[] {
  const key = useCollab((s) => s.peers.filter((p) => !p.me && p.focus && p.focus.k === k && p.focus.id === String(id)).map((p) => p.id).join(','));
  if (!key) return [];
  const ids = new Set(key.split(','));
  return useCollab.getState().peers.filter((p) => ids.has(p.id));
}
const ini = (n: string) => n.split(/\s+/).map((x) => x[0] || '').join('').slice(0, 2).toUpperCase();

/** znaczek z inicjałami (w listach) albo pełny komunikat (w nagłówku) */
export function Editing({ k, id, full }: { k: Focus['k']; id: string | number; full?: boolean }) {
  const who = useEditors(k, id);
  if (!who.length) return null;
  const names = who.map((p) => p.name).join(', ');
  if (full) return <div className="editing full" role="status" data-editing={who.map((p) => p.id).join(',')}><span className="editing-dots">{who.map((p) => <i key={p.id} style={{ background: p.color }}>{ini(p.name)}</i>)}</span>{who.length === 1 ? T('{n} ma teraz otwartą tę samą pozycję – zmiany łączą się same, ale warto się dogadać.', { n: names }) : T('{n} mają teraz otwartą tę samą pozycję – zmiany łączą się same, ale warto się dogadać.', { n: names })}</div>;
  return <span className="editing" title={T('Teraz otwarte przez: {n}', { n: names })} data-editing={who.map((p) => p.id).join(',')}><span className="editing-dots">{who.map((p) => <i key={p.id} style={{ background: p.color }}>{ini(p.name)}</i>)}</span></span>;
}
