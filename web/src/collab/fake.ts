/* Serwer w pamięci do testów zbieżności wielu klientów (bez sieci). Zachowuje się jak funkcje z supabase/schema.sql. */
import type { Pull, RemoteOp, Transport } from './engine';

export class FakeServer {
  ops: RemoteOp[] = []; snapshot: { seq: number; payload: string } | null = null; head = 0;
  subs = new Set<{ onOp: (op: RemoteOp) => void; onStatus: (b: boolean) => void; net: FakeNet }>();
  init(payload: string): void { this.snapshot = { seq: 0, payload }; }
  client(): FakeNet { return new FakeNet(this); }
}
export class FakeNet implements Transport {
  online = true; delay = 0; dropAcks = false;
  constructor(private s: FakeServer) {}
  private async net(): Promise<void> {
    if (this.delay) await new Promise((r) => setTimeout(r, Math.random() * this.delay));
    if (!this.online) throw new Error('offline');
  }
  async pull(from: number): Promise<Pull> {
    await this.net();
    const snap = this.s.snapshot;
    const useSnap = snap && snap.seq > from ? snap : undefined;
    const start = useSnap ? useSnap.seq : from;
    return { snapshot: useSnap, ops: this.s.ops.filter((o) => o.seq > start) };
  }
  async push(clientId: string, localSeq: number, payload: string): Promise<number> {
    await this.net();
    const dup = this.s.ops.find((o) => o.clientId === clientId && o.localSeq === localSeq);
    if (dup) return dup.seq;
    const op: RemoteOp = { seq: ++this.s.head, clientId, localSeq, payload };
    this.s.ops.push(op);
    for (const sub of this.s.subs) if (sub.net.online) queueMicrotask(() => sub.onOp(op));
    if (this.dropAcks) { this.dropAcks = false; throw new Error('ack lost'); }
    return op.seq;
  }
  async putSnapshot(seq: number, payload: string): Promise<void> {
    await this.net();
    if (seq > this.s.head || (this.s.snapshot && seq <= this.s.snapshot.seq)) return;
    this.s.snapshot = { seq, payload };
    this.s.ops = this.s.ops.filter((o) => o.seq >= seq - 100);
  }
  subscribe(onOp: (op: RemoteOp) => void, onStatus: (b: boolean) => void): () => void {
    const sub = { onOp, onStatus, net: this };
    this.s.subs.add(sub);
    return () => this.s.subs.delete(sub);
  }
  setOnline(on: boolean): void { this.online = on; for (const sub of this.s.subs) if (sub.net === this) sub.onStatus(on); }
}
