/* Kursy walut: tabela A NBP (bez klucza API). Kurs średni za 1 jednostkę waluty w złotych, zapisywany w projekcie,
   dzięki czemu kosztorys liczy się także bez internetu i nie zmienia się sam po zamknięciu projektu. */
import { Core } from '../domain/core';
import type { Fx, ProjectState } from '../domain/model';

const URL_A = 'https://api.nbp.pl/api/exchangerates/tables/A/?format=json';

export async function fetchRates(signal?: AbortSignal): Promise<Fx> {
  const r = await fetch(URL_A, { signal, headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error('nbp ' + r.status);
  const fx = Core.parseNbp(await r.json());
  if (!fx) throw new Error('nbp: pusta odpowiedź');
  return fx;
}
/** czy kursy trzeba odświeżyć: brak, starsze niż 1 dzień i nie wpisane ręcznie */
export function fxStale(st: ProjectState, now = Date.now()): boolean {
  const fx = st.budget.fx;
  if (fx && fx.manual) return false;
  if (!fx || !fx.date) return true;
  return now - Date.parse(fx.date + 'T12:00:00') > 2 * 864e5;
}
