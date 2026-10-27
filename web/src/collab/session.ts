/* Otwarty projekt z chmury w oknie głównym: silnik zmian + obecność osób + pamięć podręczna do pracy bez internetu.
   Stan programu (Zustand) pozostaje źródłem prawdy dla ekranów; ten moduł tylko wymienia zmiany z silnikiem. */
import { create } from 'zustand';
import { T } from '../domain/i18n';
import type { ProjectState } from '../domain/model';
import { flags, undoHooks, useProject, history } from '../state/project';
import { toast, useUI } from '../state/ui';
import { desktop } from '../desktop/bridge';
import * as cloud from './cloud';
import type { Member, Role } from './cloud';
import { Engine, type Persisted, type Status } from './engine';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Peer { id: string; name: string; position: string; avatar: string; color: string; tab: string; me: boolean }
interface CollabState { active: boolean; id: string | null; role: Role | null; status: Status; peers: Peer[]; people: Member[]; canUndo: boolean; canRedo: boolean; pending: number; me: cloud.CloudUser | null }
export const useCollab = create<CollabState>(() => ({ active: false, id: null, role: null, status: 'connecting', peers: [], people: [], canUndo: false, canRedo: false, pending: 0, me: null }));
export const isCloud = (): boolean => useCollab.getState().active;
const set = (p: Partial<CollabState>) => useCollab.setState(p);

let eng: Engine<ProjectState> | null = null;
let unsubs: Array<() => void> = [];
let lastLocal = 0;
let persistTimer: ReturnType<typeof setTimeout> | null = null;
let titleTimer: ReturnType<typeof setTimeout> | null = null;
let lastTitle = '';
let channel: RealtimeChannel | null = null;
const clientId = (): string => { try { const k = sessionStorage.getItem('klaps.cid'); if (k) return k; const n = crypto.randomUUID(); sessionStorage.setItem('klaps.cid', n); return n; } catch { return crypto.randomUUID(); } };
const BURST_MS = 700;

function refreshHistory() { set({ canUndo: !!eng?.canUndo, canRedo: !!eng?.canRedo, pending: eng?.pending.length || 0 }); }
function schedulePersist(id: string) {
  if (persistTimer) return;
  persistTimer = setTimeout(() => { persistTimer = null; if (eng) void cloud.cachePut(id, eng.persisted() as Persisted); }, 1200);
}

/** otwiera projekt z chmury i zwraca jego aktualny stan */
export async function openCloud(id: string): Promise<ProjectState> {
  await closeCloud();
  const me = await cloud.currentUser();
  if (!me) throw new Error(T('Zaloguj się do chmury, aby otworzyć ten projekt.'));
  const role = (await cloud.myRole(id).catch(() => null)) || 'viewer';
  const codec = await cloud.codecFor(id);
  const restore = (await cloud.cacheGet<Persisted>(id)) || undefined;
  const e = new Engine<ProjectState>({
    transport: cloud.makeTransport(id), codec, clientId: clientId(), readOnly: role === 'viewer', restore,
    onView: (v) => { flags.remote = true; try { useProject.setState({ st: v as never }); } finally { flags.remote = false; } refreshHistory(); },
    onStatus: (s) => set({ status: s }),
    onError: (err) => { console.warn('[klaps/chmura]', err); },
    onPersist: () => { schedulePersist(id); refreshHistory(); },
  });
  eng = e;
  const view = await e.open();
  lastTitle = view.meta?.title || '';
  set({ active: true, id, role, status: role === 'viewer' ? 'readonly' : 'online', me, canUndo: e.canUndo, canRedo: e.canRedo, pending: e.pending.length });
  flags.ro = role === 'viewer';
  history().pause(); history().clear();
  undoHooks.undo = () => { if (eng?.doUndo()) refreshHistory(); };
  undoHooks.redo = () => { if (eng?.doRedo()) refreshHistory(); };
  unsubs.push(useProject.subscribe((s, prev) => {
    if (!eng || s.pid !== id || !s.st || s.st === prev.st || flags.remote) return;
    const now = Date.now(); const burst = now - lastLocal < BURST_MS; lastLocal = now;
    eng.local(s.st, { burst });
    refreshHistory();
    const t = s.st.meta?.title || '';
    if (t !== lastTitle && useCollab.getState().role !== 'viewer') {
      lastTitle = t;
      if (titleTimer) clearTimeout(titleTimer);
      titleTimer = setTimeout(() => { void cloud.renameProject(id, t || T('Bez tytułu')).catch(() => undefined); }, 1000);
    }
  }));
  void startPresence(id, me);
  void refreshPeople(id, me);
  return view;
}

async function refreshPeople(id: string, me: cloud.CloudUser) {
  try {
    const people = await cloud.members(id);
    set({ people });
    const mine = people.find((p) => p.id === me.id);
    if (!mine) { toast(T('Nie masz już dostępu do tego projektu.'), 'bad'); void closeCloud().then(() => desktop()?.launcher.show()); return; }
    if (mine.role !== useCollab.getState().role) {
      set({ role: mine.role, status: mine.role === 'viewer' ? 'readonly' : 'online' });
      flags.ro = mine.role === 'viewer'; eng?.setReadOnly(mine.role === 'viewer');
      toast(T('Twoja rola w projekcie to teraz: {r}.', { r: mine.role === 'viewer' ? T('Podgląd') : mine.role === 'editor' ? T('Edytor') : T('Właściciel') }));
    }
    publishPeers();
  } catch { /* offline: zostają poprzedni ludzie */ }
}
let presenceState: Record<string, Array<{ tab?: string }>> = {};
function publishPeers() {
  const people = useCollab.getState().people; const me = useCollab.getState().me;
  const peers: Peer[] = [];
  for (const [uid, metas] of Object.entries(presenceState)) {
    const p = people.find((x) => x.id === uid);
    peers.push({ id: uid, name: p?.name || T('Użytkownik'), position: p?.position || '', avatar: p?.avatar || '', color: p?.color || cloud.colorFor(uid), tab: metas[metas.length - 1]?.tab || '', me: uid === me?.id });
  }
  peers.sort((a, b) => Number(b.me) - Number(a.me) || a.name.localeCompare(b.name));
  set({ peers });
}
async function startPresence(id: string, me: cloud.CloudUser) {
  try {
    const sbc = await cloud.client();
    const ch = sbc.channel('pres:' + id, { config: { presence: { key: me.id } } });
    channel = ch;
    ch.on('presence', { event: 'sync' }, () => { presenceState = ch.presenceState() as never; publishPeers(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'klaps_members', filter: 'project_id=eq.' + id }, () => { void refreshPeople(id, me); })
      .subscribe((st) => { if (st === 'SUBSCRIBED') void ch.track({ tab: useUI.getState().tab, at: Date.now() }); });
    let tab = useUI.getState().tab;
    unsubs.push(useUI.subscribe((s) => { if (s.tab !== tab) { tab = s.tab; void ch.track({ tab, at: Date.now() }); } }));
  } catch { /* obecność jest dodatkiem */ }
}

/** zapisz wszystko, co czeka (zamknięcie okna) – najwyżej kilka sekund */
export async function flushCloud(): Promise<void> {
  if (!eng) return;
  const id = useCollab.getState().id!;
  await Promise.race([eng.settle(), new Promise((r) => setTimeout(r, 4000))]);
  await cloud.cachePut(id, eng.persisted());
}
export async function closeCloud(): Promise<void> {
  if (!eng) return;
  const e = eng, id = useCollab.getState().id!;
  try { await flushCloud(); } catch { /* brak */ }
  e.close(); eng = null;
  unsubs.splice(0).forEach((f) => f());
  if (channel) { const ch = channel; channel = null; void cloud.client().then((c) => c.removeChannel(ch)).catch(() => undefined); }
  if (persistTimer) { clearTimeout(persistTimer); persistTimer = null; }
  if (titleTimer) { clearTimeout(titleTimer); titleTimer = null; }
  presenceState = {};
  flags.ro = false; undoHooks.undo = undefined; undoHooks.redo = undefined;
  history().resume();
  set({ active: false, id: null, role: null, peers: [], people: [], status: 'connecting', canUndo: false, canRedo: false, pending: 0 });
  void id;
}
