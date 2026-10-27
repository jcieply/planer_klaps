import { beforeEach, describe, expect, it, vi } from 'vitest';

const H = vi.hoisted(() => ({ role: 'editor' as string, renamed: [] as string[], store: new Map<string, unknown>(), srv: null as any }));
vi.mock('../../src/collab/cloud', async () => {
  const { FakeServer } = await import('../../src/collab/fake');
  H.srv = new FakeServer();
  const chain: any = { on: () => chain, subscribe: () => chain, track: async () => undefined, presenceState: () => ({}) };
  return {
    currentUser: async () => ({ id: 'me', name: 'Ja', email: 'ja@x', position: 'Reżyser', avatar: '', color: '#fff' }),
    myRole: async () => H.role,
    codecFor: async () => ({ enc: async (v: unknown) => JSON.stringify(v), dec: async (s: string) => JSON.parse(s) }),
    makeTransport: () => H.srv.client(),
    cacheGet: async (id: string) => H.store.get(id) ?? null,
    cachePut: async (id: string, v: unknown) => { H.store.set(id, JSON.parse(JSON.stringify(v))); },
    members: async () => [{ id: 'me', name: 'Ja', position: 'Reżyser', avatar: '', color: '#fff', role: H.role, addedAt: 0 }],
    renameProject: async (_id: string, t: string) => { H.renamed.push(t); },
    colorFor: () => '#000',
    client: async () => ({ channel: () => chain, removeChannel: () => undefined }),
  };
});

import { Core } from '../../src/domain/core';
import { Engine } from '../../src/collab/engine';
import { closeCloud, openCloud, useCollab, isCloud, flushCloud } from '../../src/collab/session';
import { mutate, undo, redo, useProject, getSt } from '../../src/state/project';
import type { ProjectState } from '../../src/domain/model';

const plain = { enc: async (v: unknown) => JSON.stringify(v), dec: async (s: string) => JSON.parse(s) };
const wait = (ms = 20) => new Promise((r) => setTimeout(r, ms));
async function setup(role = 'editor') {
  H.role = role; H.renamed = []; H.store.clear();
  await closeCloud();
  const st = Core.newState(); st.meta.title = 'Film';
  H.srv = new (H.srv.constructor)(); H.srv.init(JSON.stringify(st));
  const view = await openCloud('p1');
  useProject.getState().load('p1', view);
  const other = new Engine<ProjectState>({ transport: H.srv.client(), codec: plain, clientId: 'other', onView: () => {} });
  await other.open();
  return other;
}

describe('sesja chmurowa w oknie głównym', () => {
  beforeEach(async () => { await closeCloud(); });
  it('zmiana w programie trafia do innych osób, a zmiana innej osoby pojawia się w programie', async () => {
    const other = await setup();
    expect(isCloud()).toBe(true);
    mutate((st) => { st.meta.title = 'Nowy tytuł'; });
    await wait(); await other.settle(); await wait();
    expect(other.view.meta.title).toBe('Nowy tytuł');
    const v = JSON.parse(JSON.stringify(other.view)) as ProjectState; v.meta.director = 'Kowalska'; other.local(v);
    await wait(40);
    expect(getSt().meta.director).toBe('Kowalska');
    expect(getSt().meta.title).toBe('Nowy tytuł');
    other.close();
  });
  it('cofnij dotyczy tylko moich zmian', async () => {
    const other = await setup();
    mutate((st) => { st.meta.company = 'Moja'; });
    await wait(900);                                    // koniec serii
    const v = JSON.parse(JSON.stringify(other.view)) as ProjectState; v.meta.producer = 'Cudza'; other.local(v);
    await wait(40);
    expect(useCollab.getState().canUndo).toBe(true);
    undo(); await wait(40);
    expect(getSt().meta.company).toBe('');
    expect(getSt().meta.producer).toBe('Cudza');
    expect(useCollab.getState().canRedo).toBe(true);
    redo(); await wait(40);
    expect(getSt().meta.company).toBe('Moja');
    other.close();
  });
  it('rola „Podgląd” nie pozwala zmieniać projektu', async () => {
    const other = await setup('viewer');
    mutate((st) => { st.meta.title = 'Hak'; });
    await wait(40);
    expect(getSt().meta.title).toBe('Film');
    expect(H.srv.ops.length).toBe(0);
    expect(useCollab.getState().status).toBe('readonly');
    other.close();
  });
  it('zmiana tytułu aktualizuje zaszyfrowany tytuł projektu na liście', async () => {
    const other = await setup();
    mutate((st) => { st.meta.title = 'Inny tytuł'; });
    await wait(1200);
    expect(H.renamed).toEqual(['Inny tytuł']);
    other.close();
  });
  it('zapisuje pamięć podręczną i zamknięcie czyści stan', async () => {
    const other = await setup();
    mutate((st) => { st.meta.company = 'X'; });
    await flushCloud();
    expect(H.store.get('p1')).toBeTruthy();
    await closeCloud();
    expect(isCloud()).toBe(false);
    other.close();
  });
});
