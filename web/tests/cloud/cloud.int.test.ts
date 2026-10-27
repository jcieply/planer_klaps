// @vitest-environment node
/* Test integracyjny całego stosu chmury: prawdziwe supabase-js + Realtime + RLS/funkcje SQL (na Postgresie) + szyfrowanie E2E. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const fake = require('./fake-supabase.cjs') as { start: (o?: object) => Promise<{ url: string; anonKey: string; sql: (q: string) => Promise<string>; stop: () => Promise<void> }> };

type Cloud = typeof import('../../src/collab/cloud');
type EngineMod = typeof import('../../src/collab/engine');
let srv: Awaited<ReturnType<typeof fake.start>>;
async function fresh(): Promise<{ cloud: Cloud; eng: EngineMod }> {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', srv.url);
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', srv.anonKey);
  return { cloud: await import('../../src/collab/cloud'), eng: await import('../../src/collab/engine') };
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function until(f: () => boolean, ms = 4000) { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(25); expect(f()).toBe(true); }

beforeAll(async () => { srv = await fake.start(); }, 60000);
afterAll(async () => { await srv.stop(); });

describe('chmura: konta, projekty, zaproszenia, role, zmiany na żywo', () => {
  let code = '', pid = '';
  const A = { email: 'anna@film.pl', pass: 'haslo-anny-1', name: 'Anna Nowak', pos: 'Kierownik produkcji' };
  const B = { email: 'borys@film.pl', pass: 'haslo-borysa-1', name: 'Borys Lis', pos: 'Operator' };
  let a: Cloud, b: Cloud, ea: EngineMod, eb: EngineMod;

  it('właściciel zakłada konto, profil i zaszyfrowany projekt', async () => {
    ({ cloud: a, eng: ea } = await fresh());
    expect(a.cloudConfigured()).toBe(true);
    const r = await a.signUp(A.email, A.pass, { name: A.name, position: A.pos, avatar: 'data:image/jpeg;base64,AAAA' });
    expect(r.needsConfirm).toBe(false);
    const me = await a.currentUser();
    expect(me?.name).toBe(A.name); expect(me?.position).toBe(A.pos);
    pid = await a.createProject('Ostatni pociąg', { meta: { title: 'Ostatni pociąg' }, scenes: [{ id: 's1', num: '1', text: 'x' }], days: [] });
    const list = await a.listProjects();
    expect(list.map((p) => p.title)).toEqual(['Ostatni pociąg']);
    expect(list[0].role).toBe('owner');
    // na serwerze leżą wyłącznie szyfrogramy
    const raw = await srv.sql(`select title_enc || (select payload from klaps_snapshots limit 1) from klaps_projects`);
    expect(raw).not.toContain('Ostatni'); expect(raw).not.toContain('pociąg');
  });
  it('kod zaproszenia: tworzenie, odczyt przez właściciela, dołączenie drugiej osoby', async () => {
    code = await a.createInvite(pid, 'editor', 24, 5);
    expect(code).toMatch(/^KLAPS-/);
    const inv = await a.invites(pid);
    expect(inv.length).toBe(1); expect(inv[0].code).toBe(code); expect(inv[0].role).toBe('editor');
    expect(await srv.sql(`select count(*) from klaps_invites where secret_enc like '%${code.slice(6, 12)}%'`)).toBe('0');
    ({ cloud: b, eng: eb } = await fresh());
    await b.signUp(B.email, B.pass, { name: B.name, position: B.pos, avatar: '' });
    expect((await b.listProjects()).length).toBe(0);
    await expect(b.redeemInvite('KLAPS-ZLY')).rejects.toThrow(/kod zaproszenia/i);
    await expect(b.redeemInvite(code.replace(/[A-Z]/, (c) => (c === 'A' ? 'B' : 'A')))).rejects.toThrow(/nieprawidłowy|nie wygląda/i);
    const j = await b.redeemInvite(code);
    expect(j).toEqual({ id: pid, role: 'editor' });
    const list = await b.listProjects();
    expect(list[0].title).toBe('Ostatni pociąg'); expect(list[0].role).toBe('editor'); expect(list[0].members).toBe(2);
    const ms = await a.members(pid);
    expect(ms.map((m) => [m.name, m.position, m.role])).toEqual([[A.name, A.pos, 'owner'], [B.name, B.pos, 'editor']]);
  });
  it('zmiany jednej osoby trafiają na żywo do drugiej (Realtime + E2E)', async () => {
    type S = { meta: { title: string; call?: string }; scenes: { id: string; num: string; text: string }[]; days: unknown[] };
    const mk = async (c: Cloud, e: EngineMod, id: string) => { const codec = await c.codecFor(pid); const views: S[] = []; const en = new e.Engine<S>({ transport: c.makeTransport(pid), codec, clientId: id, onView: (v) => views.push(v), retryMs: 200 }); await en.open(); return en; };
    const ea1 = await mk(a, ea, 'ca'), eb1 = await mk(b, eb, 'cb');
    await wait(500); // dołączenie kanału Realtime
    const v = JSON.parse(JSON.stringify(ea1.view)) as S; v.meta.call = '07:30'; v.scenes.push({ id: 's2', num: '2', text: 'nowa' });
    ea1.local(v);
    await until(() => eb1.view.meta.call === '07:30' && eb1.view.scenes.length === 2);
    const w = JSON.parse(JSON.stringify(eb1.view)) as S; w.scenes[0].text = 'poprawiona przez B';
    eb1.local(w);
    await until(() => ea1.view.scenes[0].text === 'poprawiona przez B');
    // serwer widzi tylko szyfrogramy zmian
    const ops = await srv.sql(`select string_agg(payload, '|') from klaps_ops`);
    expect(ops).not.toContain('poprawiona'); expect(ops).not.toContain('07:30');
    ea1.close(); eb1.close();
  });
  it('rola „Podgląd” blokuje zapis, a usunięcie osoby odcina dostęp', async () => {
    const bid = (await b.currentUser())!.id;
    await a.setRole(pid, bid, 'viewer');
    expect((await b.listProjects())[0].role).toBe('viewer');
    await expect(b.makeTransport(pid).push('cb', 999, 'x')).rejects.toThrow(/uprawnień/);
    await a.removeMember(pid, bid);
    expect(await b.listProjects()).toEqual([]);
    await expect(b.makeTransport(pid).push('cb', 1000, 'x')).rejects.toThrow(/nie należysz/i);
  });
  it('unieważnienie kodu, opuszczenie, ponowne dołączenie i usunięcie projektu', async () => {
    const c1 = await a.createInvite(pid, 'viewer', 24, 1);
    const c2 = await a.createInvite(pid, 'editor', 0, 0);
    const rows = await a.invites(pid);
    expect(rows.length).toBeGreaterThanOrEqual(3);
    await a.revokeInvite(rows.find((r) => r.code === c1)!.id);
    await expect(b.redeemInvite(c1)).rejects.toThrow(/nieprawidłowy/);
    expect((await b.redeemInvite(c2)).role).toBe('editor');
    expect((await b.listProjects()).length).toBe(1);
    await b.leaveProject(pid);
    expect(await b.listProjects()).toEqual([]);
    expect(await b.hasKey(pid)).toBe(false);
    await expect(a.leaveProject(pid)).rejects.toThrow(/Właściciel nie może/);
    expect((await b.redeemInvite(c2)).id).toBe(pid);           // kod bez limitu działa ponownie
    await a.deleteProject(pid);
    expect(await a.listProjects()).toEqual([]);
    expect(await b.listProjects()).toEqual([]);
  });
});
