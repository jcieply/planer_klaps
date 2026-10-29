/* Zlecanie ciężkich zadań wątkowi roboczemu. Gdy wątek nie wystartuje (stara przeglądarka, blokada, błąd ładowania)
   albo przestanie odpowiadać, zadanie wykonuje się w oknie programu – wynik jest zawsze ten sam, tylko wolniejszy dla interfejsu. */
import { I18N } from '../domain/i18n';
import type { Task } from '../work/tasks';

interface Pending { resolve: (v: unknown) => void; reject: (e: unknown) => void; task: Task; args: any; lang: 'pl' | 'en' }
let worker: Worker | null = null;
let state: 'idle' | 'starting' | 'ready' | 'broken' = 'idle';
let starting: Promise<Worker | null> | null = null;
let seq = 0;
const pending = new Map<number, Pending>();

/** te same zadania w oknie programu (moduł ładowany dopiero wtedy, gdy jest potrzebny) */
async function onMain(task: Task, args: any, lang: 'pl' | 'en') { const m = await import('../work/tasks'); return m.runTask(task, args, lang); }

function fail() {
  state = 'broken';
  try { worker?.terminate(); } catch { /* brak */ }
  worker = null;
  const left = [...pending.values()]; pending.clear();
  left.forEach((p) => { onMain(p.task, p.args, p.lang).then(p.resolve, p.reject); });
}

function start(): Promise<Worker | null> {
  if (state === 'ready') return Promise.resolve(worker);
  if (state === 'broken' || typeof Worker === 'undefined') return Promise.resolve(null);
  if (starting) return starting;
  state = 'starting';
  starting = (async () => {
    try {
      const W = (await import('../work/heavy.worker?worker&inline')).default;
      const w = new W();
      worker = w;
      w.onmessage = (e: MessageEvent) => {
        const m = e.data, p = pending.get(m.id);
        if (!p) return;
        pending.delete(m.id);
        if (m.ok) p.resolve(m.r);
        else if (m.code === 'main') onMain(p.task, p.args, p.lang).then(p.resolve, p.reject);
        else p.reject(new Error(m.error));
      };
      w.onerror = (e) => { e.preventDefault?.(); fail(); };
      w.onmessageerror = () => fail();
      // sprawdzenie, czy wątek naprawdę działa (np. blokada CSP daje cichy brak odpowiedzi)
      const ok = await Promise.race([send(w, 'ping', {}, 'pl'), new Promise((r) => setTimeout(() => r('timeout'), 8000))]);
      if (ok !== 'pong') throw new Error('worker-timeout');
      state = 'ready';
      return w;
    } catch {
      fail();
      return null;
    } finally { starting = null; }
  })();
  return starting;
}

function send(w: Worker, task: Task, args: any, lang: 'pl' | 'en', transfer?: Transferable[]): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject, task, args, lang });
    try { w.postMessage({ id, task, args, lang }, transfer || []); }
    catch (e) { pending.delete(id); onMain(task, args, lang).then(resolve, reject); } // dane, których nie da się przekazać do wątku
  });
}

/** wykonuje ciężkie zadanie poza wątkiem interfejsu (albo w nim, gdy wątek jest niedostępny) */
export async function heavy<R = unknown>(task: Exclude<Task, 'ping'>, args: Record<string, unknown>, transfer?: Transferable[]): Promise<R> {
  const lang = (I18N.lang === 'en' ? 'en' : 'pl') as 'pl' | 'en';
  const w = await start();
  if (!w) return (await onMain(task, args, lang)) as R;
  return (await send(w, task, args, lang, transfer)) as R;
}
/** uruchomienie wątku z wyprzedzeniem (po starcie programu), aby pierwszy eksport nie czekał */
export const warmHeavy = () => { void start(); };
export const heavyState = () => state;
