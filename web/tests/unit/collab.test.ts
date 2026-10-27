import { describe, expect, it } from 'vitest';
import { applyOps, deepEqual, diff } from '../../src/collab/ops';
import { Engine, type Codec } from '../../src/collab/engine';
import { FakeServer } from '../../src/collab/fake';
import { decryptJson, encryptJson, importKey, makeInvite, newKeyBytes, parseInvite } from '../../src/collab/crypto';

const plain: Codec = { enc: async (v) => JSON.stringify(v), dec: async (s) => JSON.parse(s) };
type S = { meta: { title: string; call: string }; scenes: { id: string; num: string; text: string; cast: number[] }[]; days: { id: string; sceneIds: string[]; note: string }[]; sites: Record<string, { n: string }> };
const init = (): S => ({ meta: { title: 'T', call: '07:00' }, scenes: [{ id: 'a', num: '1', text: 'x', cast: [1] }, { id: 'b', num: '2', text: 'y', cast: [] }], days: [{ id: 'd1', sceneIds: ['a'], note: '' }], sites: { s: { n: 'park' } } });
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('diff / apply', () => {
  it('odtwarza stan docelowy', () => {
    const a = init();
    const b = clone(a);
    b.scenes.reverse(); b.scenes.push({ id: 'c', num: '3', text: 'z', cast: [2] }); b.meta.title = 'N'; delete b.sites.s; b.sites.q = { n: 'las' }; b.days[0].sceneIds = ['b', 'a'];
    b.scenes.splice(1, 1);
    expect(deepEqual(applyOps(a, diff(a, b)), b)).toBe(true);
  });
  it('współdzieli niezmienione gałęzie i jest odporne na brakujące cele', () => {
    const a = init();
    const out = applyOps(a, [{ t: 'set', p: ['k:scenes', 'i:zzz', 'k:text'], v: 'q' }, { t: 'rm', p: ['k:scenes'], id: 'nie-ma' }, { t: 'set', p: ['k:__proto__', 'k:x'], v: 1 }]);
    expect(out).toBe(a);
  });
  it('różne sceny dodane równocześnie obie zostają', () => {
    const base = init();
    const x = clone(base); x.scenes.push({ id: 'x', num: '9', text: '', cast: [] });
    const y = clone(base); y.scenes.push({ id: 'y', num: '8', text: '', cast: [] });
    const m = applyOps(applyOps(base, diff(base, x)), diff(base, y));
    expect(m.scenes.map((s) => s.id).sort()).toEqual(['a', 'b', 'x', 'y']);
  });
});

describe('kod zaproszenia i szyfrowanie', () => {
  it('kod zawiera klucz i sekret, a szyfrogram wraca do jawnego tekstu', async () => {
    const kb = await newKeyBytes();
    const { code, secret } = await makeInvite(kb);
    const p = parseInvite(code.toLowerCase().replace(/-/g, ' '));
    expect(p?.secret).toBe(secret);
    expect(Array.from(p!.keyBytes)).toEqual(Array.from(kb));
    expect(secret.length).toBeGreaterThanOrEqual(20);
    const key = await importKey(p!.keyBytes);
    const ct = await encryptJson(key, { a: 1, zażółć: 'ć' });
    expect(ct).not.toContain('zażółć');
    expect(await decryptJson(await importKey(kb), ct)).toEqual({ a: 1, zażółć: 'ć' });
    await expect(decryptJson(await importKey(await newKeyBytes()), ct)).rejects.toBeTruthy();
    expect(parseInvite('KLAPS-ABC')).toBeNull();
  });
});

function rng(seed: number) { let s = seed; return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32; }
function mutate(s: S, r: () => number, id: number): S {
  const n = clone(s);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const k = Math.floor(r() * 9);
  if (k === 0) n.meta.title = 't' + id;
  else if (k === 1) n.scenes.push({ id: 'n' + id, num: String(id), text: '', cast: [] });
  else if (k === 2 && n.scenes.length) n.scenes.splice(Math.floor(r() * n.scenes.length), 1);
  else if (k === 3 && n.scenes.length) pick(n.scenes).text = 'x' + id;
  else if (k === 4 && n.scenes.length > 1) { const [m] = n.scenes.splice(Math.floor(r() * n.scenes.length), 1); n.scenes.splice(Math.floor(r() * (n.scenes.length + 1)), 0, m); }
  else if (k === 5 && n.days.length) pick(n.days).note = 'd' + id;
  else if (k === 6) n.days.push({ id: 'dd' + id, sceneIds: [], note: '' });
  else if (k === 7) n.sites['s' + (id % 4)] = { n: 'v' + id };
  else if (k === 8 && n.days.length) { const d = pick(n.days); d.sceneIds = n.scenes.slice(0, 2).map((x) => x.id); }
  return n;
}

describe('silnik – zbieżność wielu klientów', () => {
  for (const seed of [1, 2, 3, 4, 5, 6]) {
    it('6 osób, losowe zmiany, opóźnienia i rozłączenia (seed ' + seed + ')', async () => {
      const r = rng(seed);
      const srv = new FakeServer();
      srv.init(JSON.stringify(init()));
      const views: S[] = [];
      const engines: Engine<S>[] = [];
      const nets = [];
      for (let c = 0; c < 6; c++) {
        const net = srv.client(); net.delay = 3; nets.push(net);
        const e = new Engine<S>({ transport: net, codec: plain, clientId: 'c' + c, retryMs: 5, compactEvery: 15, onView: (v) => { views[c] = v; } });
        views[c] = await e.open();
        engines.push(e);
      }
      let id = 0;
      for (let step = 0; step < 220; step++) {
        const c = Math.floor(r() * 6);
        if (r() < 0.04) nets[c].setOnline(r() < 0.5);
        if (r() < 0.03) nets[c].dropAcks = true;
        const e = engines[c];
        e.local(mutate(e.view, r, ++id));
        if (r() < 0.2) await new Promise((res) => setTimeout(res, 2));
        if (r() < 0.05 && e.canUndo) e.doUndo();
      }
      for (const n of nets) n.setOnline(true);
      for (let t = 0; t < 8; t++) { for (const e of engines) await e.settle(); await new Promise((res) => setTimeout(res, 15)); }
      const ref = engines[0].base;
      for (const e of engines) { expect(e.pending.length).toBe(0); expect(deepEqual(e.base, ref)).toBe(true); expect(deepEqual(e.view, ref)).toBe(true); }
      expect(engines.every((e) => e.seq === engines[0].seq)).toBe(true);
      engines.forEach((e) => e.close());
    }, 30000);
  }
  it('nowy klient dostaje stan z migawki i ogona', async () => {
    const srv = new FakeServer(); srv.init(JSON.stringify(init()));
    const a = new Engine<S>({ transport: srv.client(), codec: plain, clientId: 'a', compactEvery: 5, onView: () => {} });
    await a.open();
    for (let n = 0; n < 40; n++) { const v = clone(a.view); v.meta.title = 't' + n; v.scenes.push({ id: 'z' + n, num: '', text: '', cast: [] }); a.local(v); await a.settle(); }
    const b = new Engine<S>({ transport: srv.client(), codec: plain, clientId: 'b', onView: () => {} });
    await b.open();
    expect(deepEqual(b.view, a.view)).toBe(true);
    a.close(); b.close();
  });
  it('cofanie dotyczy tylko moich zmian', async () => {
    const srv = new FakeServer(); srv.init(JSON.stringify(init()));
    const mk = (id: string) => new Engine<S>({ transport: srv.client(), codec: plain, clientId: id, onView: () => {} });
    const a = mk('a'), b = mk('b'); await a.open(); await b.open();
    const va = clone(a.view); va.meta.title = 'od A'; a.local(va); await a.settle();
    const vb = clone(b.view); vb.meta.call = '09:00'; b.local(vb); await b.settle(); await a.settle();
    expect(a.view.meta.call).toBe('09:00');
    a.doUndo(); await a.settle(); await b.settle();
    expect(a.view.meta.title).toBe('T');
    expect(a.view.meta.call).toBe('09:00');
    expect(b.view.meta.title).toBe('T');
    a.close(); b.close();
  });
  it('widz nie wysyła zmian', async () => {
    const srv = new FakeServer(); srv.init(JSON.stringify(init()));
    const v = new Engine<S>({ transport: srv.client(), codec: plain, clientId: 'v', readOnly: true, onView: () => {} });
    await v.open(); const n = clone(v.view); n.meta.title = 'x'; v.local(n); await v.settle();
    expect(srv.ops.length).toBe(0);
    v.close();
  });
});

describe('kompresja paczek', () => {
  it('duże paczki są kompresowane i wracają bez zmian', async () => {
    const key = await importKey(await newKeyBytes());
    const big = { text: 'Scena '.repeat(5000), n: [1, 2, 3] };
    const ct = await encryptJson(key, big);
    expect(ct.length).toBeLessThan(JSON.stringify(big).length / 3);
    expect(await decryptJson(key, ct)).toEqual(big);
  });
});

describe('seria szybkich zmian', () => {
  it('jest jednym krokiem cofania', async () => {
    const srv = new FakeServer(); srv.init(JSON.stringify(init()));
    const a = new Engine<S>({ transport: srv.client(), codec: plain, clientId: 'a', onView: () => {} });
    await a.open();
    let v = clone(a.view); v.meta.title = 'T1'; a.local(v, { burst: false });
    for (const t of ['T12', 'T123', 'T1234']) { v = clone(a.view); v.meta.title = t; a.local(v, { burst: true }); }
    expect(a.view.meta.title).toBe('T1234');
    a.doUndo();
    expect(a.view.meta.title).toBe('T');
    expect(a.canUndo).toBe(false);
    a.doRedo();
    expect(a.view.meta.title).toBe('T1234');
    a.close();
  });
});
