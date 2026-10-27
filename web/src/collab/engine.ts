/* Silnik pracy równoczesnej: serwer nadaje kolejność, klienci stosują te same operacje w tej samej kolejności.
 *   base    – stan potwierdzony (wszystkie zatwierdzone operacje do `seq`)
 *   pending – moje zmiany jeszcze niepotwierdzone przez serwer
 *   view    – base + pending (to widzi użytkownik)
 * Obcą operację dokładamy do base i przeliczamy view; własną po potwierdzeniu przenosimy z pending do base. */
import { applyOps, diff, type Op } from './ops';

export interface RemoteOp { seq: number; clientId: string; localSeq: number; payload: string }
export interface Pull { snapshot?: { seq: number; payload: string }; ops: RemoteOp[] }
export interface Transport {
  pull(fromSeq: number): Promise<Pull>;
  push(clientId: string, localSeq: number, payload: string): Promise<number>;
  putSnapshot(seq: number, payload: string): Promise<void>;
  subscribe(onOp: (op: RemoteOp) => void, onStatus: (online: boolean) => void): () => void;
}
export interface Codec { enc(v: unknown): Promise<string>; dec<T = unknown>(s: string): Promise<T> }
export type Status = 'connecting' | 'online' | 'offline' | 'readonly';
export interface Batch { localSeq: number; ops: Op[] }
export interface Persisted { base: unknown; seq: number; pending: Batch[]; nextLocal: number; undo: Op[][]; redo: Op[][] }

export interface EngineOpts<S> {
  transport: Transport; codec: Codec; clientId: string; readOnly?: boolean;
  onView: (s: S) => void; onStatus?: (s: Status) => void; onError?: (e: unknown) => void; onNeedKey?: () => void;
  restore?: Persisted; compactEvery?: number; retryMs?: number; undoLimit?: number;
  /** stan do zapisania w pamięci podręcznej zmienił się (potwierdzenie, nowa zmiana) */
  onPersist?: () => void;
}

export class Engine<S> {
  base!: S; seq = 0; pending: Batch[] = []; view!: S;
  private burstBase: S | undefined; private nextLocal = 1; private undo: Op[][] = []; private redo: Op[][] = [];
  private buf = new Map<number, RemoteOp>(); private sending = false; private stop?: () => void; private closed = false;
  private sinceSnap = 0; private retry?: ReturnType<typeof setTimeout>; private status: Status = 'connecting'; private pulling = false;
  private chain: Promise<void> = Promise.resolve();
  constructor(private o: EngineOpts<S>) {}

  /** otwiera projekt: pobiera migawkę + ogon operacji, odtwarza niewysłane zmiany i nasłuchuje */
  async open(): Promise<S> {
    const r = this.o.restore;
    if (r) { this.base = r.base as S; this.seq = r.seq; this.pending = r.pending; this.nextLocal = r.nextLocal; this.undo = r.undo; this.redo = r.redo; }
    try { await this.sync(true); }
    catch (e) { if (!r) throw e; this.o.onError?.(e); this.status = 'offline'; this.o.onStatus?.('offline'); if (!this.closed) this.retry = setTimeout(() => void this.recover(), this.o.retryMs ?? 3000); }
    this.view = applyOps(this.base, this.pending.flatMap((b) => b.ops));
    this.stop = this.o.transport.subscribe((op) => this.enqueue(() => this.receive(op)), (on) => this.setStatus(on ? 'online' : 'offline'));
    this.setStatus(this.o.readOnly ? 'readonly' : 'online');
    void this.flush();
    return this.view;
  }
  /** po nieudanym starcie offline: dociąga zmiany, gdy wróci sieć */
  private async recover(): Promise<void> {
    if (this.closed) return;
    try { await this.sync(false); this.setStatus('online'); } catch { if (!this.closed) this.retry = setTimeout(() => void this.recover(), this.o.retryMs ?? 3000); }
  }
  setReadOnly(b: boolean): void { this.o.readOnly = b; this.setStatus(b ? 'readonly' : 'online'); }
  close(): void { this.closed = true; this.stop?.(); if (this.retry) clearTimeout(this.retry); }

  persisted(): Persisted { return { base: this.base, seq: this.seq, pending: this.pending, nextLocal: this.nextLocal, undo: this.undo, redo: this.redo }; }
  get dirty(): boolean { return this.pending.length > 0; }
  get canUndo(): boolean { return this.undo.length > 0; }
  get canRedo(): boolean { return this.redo.length > 0; }

  /** zmiana lokalna: nowy stan widoku → różnica → kolejka do wysłania */
  local(next: S, opts: { undo?: boolean; burst?: boolean } = {}): void {
    if (this.o.readOnly || next === this.view) return;
    const ops = diff(this.view, next);
    if (!ops.length) { this.view = next; return; }
    if (opts.undo !== false && opts.burst && this.burstBase !== undefined && this.undo.length) {
      this.undo[this.undo.length - 1] = diff(next, this.burstBase); // seria szybkich zmian = jeden krok cofania
    } else if (opts.undo !== false) {
      this.burstBase = this.view;
      this.undo.push(diff(next, this.view));
      if (this.undo.length > (this.o.undoLimit ?? 200)) this.undo.shift();
      this.redo = [];
    }
    this.pending.push({ localSeq: this.nextLocal++, ops });
    this.view = next;
    this.o.onPersist?.();
    void this.flush();
  }
  /** cofnięcie WYŁĄCZNIE moich zmian (cudze zostają) */
  doUndo(): boolean { return this.stepHistory(this.undo, this.redo); }
  doRedo(): boolean { return this.stepHistory(this.redo, this.undo); }
  private stepHistory(from: Op[][], to: Op[][]): boolean {
    const inv = from.pop();
    this.burstBase = undefined;
    if (!inv || this.o.readOnly) return false;
    const next = applyOps(this.view, inv);
    const back = diff(next, this.view);
    if (back.length) to.push(back);
    this.local(next, { undo: false });
    this.o.onView(this.view);
    return true;
  }

  /* ---------- odbiór ---------- */
  private enqueue(fn: () => Promise<void>): void { this.chain = this.chain.then(fn).catch((e) => this.o.onError?.(e)); }
  private async sync(first: boolean): Promise<void> {
    if (this.pulling) return;
    this.pulling = true;
    try {
      const res = await this.o.transport.pull(this.base === undefined ? -1 : this.seq);
      if (res.snapshot && (this.base === undefined || res.snapshot.seq > this.seq)) {
        this.base = await this.o.codec.dec<S>(res.snapshot.payload);
        this.seq = res.snapshot.seq;
        this.buf.clear();
      }
      if (first && this.base === undefined) throw new Error('klaps:no_snapshot');
      for (const op of res.ops) this.buf.set(op.seq, op);
      await this.drain();
    } finally { this.pulling = false; }
  }
  private async receive(op: RemoteOp): Promise<void> {
    if (op.seq <= this.seq) return;
    this.buf.set(op.seq, op);
    const before = this.seq;
    await this.drain();
    if (this.seq === before && this.buf.size && !this.closed) await this.sync(false); // luka w numeracji → dociągnij
  }
  /** stosuje kolejne numery po kolei; zatrzymuje się na luce */
  private async drain(): Promise<void> {
    let foreign = false;
    for (;;) {
      const op = this.buf.get(this.seq + 1);
      if (!op) break;
      this.buf.delete(op.seq);
      let ops: Op[] = [];
      try { ops = (await this.o.codec.dec<{ ops: Op[] }>(op.payload)).ops; }
      catch (e) {
        // brak klucza (właściciel zmienił klucz projektu): nie pomijamy zmiany – czekamy na klucz i dociągniemy ją później
        if (String((e as Error)?.message || e).includes('klaps:no_key')) { this.buf.set(op.seq, op); this.o.onNeedKey?.(); break; }
        this.o.onError?.(e);
      }
      const mine = op.clientId === this.o.clientId && this.pending[0]?.localSeq === op.localSeq;
      if (mine) this.pending.shift();
      const nb = applyOps(this.base, ops);
      if (!mine && nb !== this.base) foreign = true;
      this.base = nb;
      this.seq = op.seq;
      this.sinceSnap++;
    }
    for (const k of this.buf.keys()) if (k <= this.seq) this.buf.delete(k);
    if (foreign && this.view !== undefined) {
      this.view = applyOps(this.base, this.pending.flatMap((b) => b.ops));
      this.o.onView(this.view);
    }
    this.o.onPersist?.();
    void this.maybeCompact();
  }

  /* ---------- wysyłka ---------- */
  private setStatus(s: Status): void {
    if (this.o.readOnly) s = 'readonly';
    if (s === this.status) return;
    this.status = s;
    this.o.onStatus?.(s);
    if (s === 'online') { void this.flush(); this.enqueue(async () => { await this.sync(false); }); }
  }
  async flush(): Promise<void> {
    if (this.sending || this.closed || this.o.readOnly) return;
    this.sending = true;
    try {
      while (this.pending.length && !this.closed) {
        const b = this.pending[0];
        const payload = await this.o.codec.enc({ ops: b.ops });
        const seq = await this.o.transport.push(this.o.clientId, b.localSeq, payload);
        this.enqueue(() => this.receive({ seq, clientId: this.o.clientId, localSeq: b.localSeq, payload }));
        await this.chain;
        if (this.pending[0] === b) this.pending.shift(); // serwer przyjął, a echo nie zdążyło – nie wysyłaj ponownie
        if (this.status === 'offline') this.setStatus('online');
      }
    } catch (e) {
      this.o.onError?.(e);
      this.sending = false;
      this.setStatus('offline');
      if (!this.closed) this.retry = setTimeout(() => void this.flush(), this.o.retryMs ?? 3000);
      return;
    }
    this.sending = false;
    if (this.pending.length) void this.flush();
  }
  private async maybeCompact(): Promise<void> {
    if (this.o.readOnly || this.sinceSnap < (this.o.compactEvery ?? 200) || this.closed) return;
    this.sinceSnap = 0;
    try { await this.o.transport.putSnapshot(this.seq, await this.o.codec.enc(this.base)); } catch (e) { this.o.onError?.(e); }
  }
  /** po zmianie klucza: dociągnij zmiany, których nie dało się odczytać, i wyślij oczekujące */
  resync(): void { if (this.closed) return; this.enqueue(async () => { await this.sync(false); }); void this.flush(); }
  /** czekaj aż wszystko zostanie wysłane i potwierdzone (testy, zamykanie okna) */
  async settle(): Promise<void> {
    for (let n = 0; n < 200 && !this.closed && (this.pending.length || this.sending); n++) { await this.flush(); await this.chain; await new Promise((r) => setTimeout(r, 0)); }
    await this.chain;
  }
}
