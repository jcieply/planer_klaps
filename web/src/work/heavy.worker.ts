/* Wątek roboczy: ciężkie obliczenia poza wątkiem interfejsu (płynne przewijanie i animacje w trakcie eksportu i importu). */
import { runTask, type Task } from './tasks';

interface Req { id: number; task: Task; args: any; lang: 'pl' | 'en' }
const ctx = self as unknown as { postMessage(m: unknown, t?: Transferable[]): void; onmessage: ((e: MessageEvent<Req>) => void) | null };

ctx.onmessage = async (e) => {
  const { id, task, args, lang } = e.data;
  try {
    const r = await runTask(task, Object.assign({}, args, { worker: true }), lang);
    const transfer = r instanceof Uint8Array && r.byteOffset === 0 && r.byteLength === r.buffer.byteLength ? [r.buffer as ArrayBuffer] : [];
    ctx.postMessage({ id, ok: true, r }, transfer);
  } catch (err) {
    const x = err as Error & { code?: string };
    ctx.postMessage({ id, ok: false, error: x && x.message ? x.message : String(err), code: x && x.code });
  }
};
