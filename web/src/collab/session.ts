/* Otwarty projekt z chmury w oknie głównym: silnik zmian + obecność osób + pamięć podręczna do pracy bez internetu.
   Stan programu (Zustand) pozostaje źródłem prawdy dla ekranów; ten moduł tylko wymienia zmiany z silnikiem. */
import { create } from 'zustand';
import { T } from '../domain/i18n';
import type { ProjectState } from '../domain/model';
import { flags, undoHooks, useProject, history } from '../state/project';
import { setUI, toast, useUI } from '../state/ui';
import { desktop } from '../desktop/bridge';
import * as cloud from './cloud';
import { newMentions, seenAt, unreadMentions } from './comments';
import { describeChange, type LogEntry } from './activity';
import type { Member, Role } from './cloud';
import { Engine, type Persisted, type Status } from './engine';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Focus { k: 'scene' | 'day' | 'crew' | 'cast' | 'site'; id: string }
export interface Peer { id: string; name: string; position: string; avatar: string; color: string; tab: string; me: boolean; focus: Focus | null }
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
const BURST_MS = 700;
interface Cached { p: Persisted; role: Role; clientId: string; log?: LogEntry[] }
let cid0 = '';
let notifyOn = false;
function snapshotCache(): Cached { return { p: eng!.persisted(), role: (useCollab.getState().role || 'viewer') as Role, clientId: cid0, log: logQ.slice(-50) }; }

/* dziennik zmian: opisy własnych zmian czekają w kolejce (także w pamięci offline) i wysyłają się zbiorczo co kilka sekund */
let logQ: LogEntry[] = [];
let logTimer: ReturnType<typeof setTimeout> | null = null;
let logBusy = false;
function queueLog(id: string, items: string[]) {
  if (!items.length || useCollab.getState().role === 'viewer') return;
  const last = logQ[logQ.length - 1];
  if (last && Date.now() - last.at < 4000) { for (const i of items) if (!last.items.includes(i) && last.items.length < 12) last.items.push(i); }
  else logQ.push({ at: Date.now(), items: items.slice(0, 12) });
  schedulePersist(id);
  if (!logTimer) logTimer = setTimeout(() => { logTimer = null; void flushLog(id); }, 4500);
}
export async function flushLog(id: string): Promise<void> {
  if (logBusy || !logQ.length) return;
  logBusy = true;
  try {
    while (logQ.length) { const e = logQ[0]; await cloud.logActivity(id, [e]); logQ.shift(); }
  } catch { if (!logTimer && eng) logTimer = setTimeout(() => { logTimer = null; void flushLog(id); }, 15000); }
  finally { logBusy = false; }
}

/** powiadomienie o nowej wzmiance o mnie: komunikat w programie, a gdy okno jest w tle – także systemowe */
function notifyMentions(prev: ProjectState | null, next: ProjectState, me: string) {
  const list = newMentions(prev, next, me);
  for (const c of list.slice(0, 3)) {
    const body = `${c.name || T('Ktoś')}: ${c.text.slice(0, 140)}`;
    toast(T('Wzmianka w komentarzu') + ' – ' + body, '', { label: T('Pokaż'), run: () => setUI((x) => { x.comments = true; }) });
    try { if (typeof document !== 'undefined' && document.hidden && typeof Notification !== 'undefined') new Notification(T('Klaps Planer – wzmianka'), { body }); } catch { /* brak powiadomień systemowych */ }
  }
}

function refreshHistory() { set({ canUndo: !!eng?.canUndo, canRedo: !!eng?.canRedo, pending: eng?.pending.length || 0 }); }
function schedulePersist(id: string) {
  if (persistTimer) return;
  persistTimer = setTimeout(() => { persistTimer = null; if (eng) void cloud.cachePut(id, snapshotCache()); }, 1200);
}

/** właściciel zmienił klucz projektu: odbierz nowy klucz z „skrzynki” tego urządzenia i dociągnij zmiany */
let keyBusy = false;
async function onKeys(id: string) {
  if (keyBusy || !eng) return;
  keyBusy = true;
  try {
    const r = await cloud.syncKeys(id);
    if (r.updated) { toast(T('Właściciel zmienił klucz projektu. Odebrano nowy klucz.')); eng?.resync(); }
    else if (!r.have) toast(T('Właściciel zmienił klucz projektu, a to urządzenie nie ma jeszcze nowego. Wpisz nowy kod zaproszenia (Dołącz do projektu).'), 'bad');
  } catch { /* bez internetu spróbujemy po powrocie połączenia */ } finally { keyBusy = false; }
}

/** otwiera projekt z chmury i zwraca jego aktualny stan */
export async function openCloud(id: string): Promise<ProjectState> {
  await closeCloud();
  const me = await cloud.currentUser();
  if (!me) throw new Error(T('Zaloguj się do chmury, aby otworzyć ten projekt.'));
  await cloud.ensureDevice().catch(() => undefined);
  const ks = await cloud.syncKeys(id).catch(() => null);   // bez internetu zostaje klucz, który mamy
  if (ks && !ks.have) throw new Error(T('Właściciel zmienił klucz projektu, a to urządzenie nie ma jeszcze nowego. Wpisz nowy kod zaproszenia (Dołącz do projektu).'));
  const codec = await cloud.codecFor(id);
  const cached = (await cloud.cacheGet<Cached>(id)) || undefined;
  // rola z serwera; bez internetu – ostatnia znana (z pamięci podręcznej); bez niczego nie wiemy, czy wolno edytować
  const role: Role | null = (await cloud.myRole(id).catch(() => null)) || cached?.role || null;
  if (!role) throw new Error(T('Brak połączenia z chmurą. Sprawdź internet i spróbuj ponownie.'));
  const restore = cached?.p;
  logQ = (cached?.log || []).slice();
  // ten sam identyfikator klienta po ponownym uruchomieniu: serwer rozpozna już wysłane paczki i nie zastosuje ich drugi raz
  const cid = cached?.clientId || crypto.randomUUID();
  const e = new Engine<ProjectState>({
    transport: cloud.makeTransport(id), codec, clientId: cid, readOnly: role === 'viewer', restore,
    onView: (v) => { lastTitle = (v as ProjectState).meta?.title || lastTitle; if (notifyOn) notifyMentions(useProject.getState().st, v as ProjectState, me.id); flags.remote = true; try { useProject.setState({ st: v as never }); } finally { flags.remote = false; } refreshHistory(); },
    onStatus: (s) => { set({ status: s }); if (s === 'online') void flushLog(id); },
    onError: (err) => { console.warn('[klaps/chmura]', err); if ((err as { code?: string })?.code === 'klaps:stale_key') void onKeys(id); },
    onNeedKey: () => { void onKeys(id); },
    onPersist: () => { schedulePersist(id); refreshHistory(); },
  });
  eng = e; cid0 = cid;
  notifyOn = false;
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
    queueLog(id, describeChange(prev.st as ProjectState, s.st as ProjectState));
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
  notifyOn = true;
  const unread = unreadMentions(view, me.id, seenAt(id, me.id)).length;
  if (unread) toast(T('Wzmianki o Tobie w komentarzach: {n}', { n: unread }), '', { label: T('Pokaż'), run: () => setUI((x) => { x.comments = true; }) });
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
let presenceState: Record<string, Array<{ tab?: string; focus?: Focus | null }>> = {};
/** co teraz otwieram: scena w szufladzie, dzień w planie pracy albo rozwinięty wiersz ekipy, obsady, lokacji (miękka blokada: tylko informacja dla innych) */
export function focusOf(u: ReturnType<typeof useUI.getState>): Focus | null {
  if (u.drawer) return { k: 'scene', id: u.drawer };
  if (u.tab === 'callsheet' && u.csDay) return { k: 'day', id: u.csDay };
  if (u.tab === 'crew' && u.crewOpen.length) return { k: 'crew', id: u.crewOpen[u.crewOpen.length - 1] };
  if (u.tab === 'cast' && u.castOpen.length) return { k: 'cast', id: String(u.castOpen[u.castOpen.length - 1]) };
  if (u.tab === 'sites' && u.siteOpen.length) return { k: 'site', id: u.siteOpen[u.siteOpen.length - 1] };
  return null;
}
const focusKey = (f: Focus | null) => (f ? f.k + ':' + f.id : '');
function publishPeers() {
  const people = useCollab.getState().people; const me = useCollab.getState().me;
  const peers: Peer[] = [];
  for (const [uid, metas] of Object.entries(presenceState)) {
    const p = people.find((x) => x.id === uid);
    peers.push({ id: uid, name: p?.name || T('Użytkownik'), position: p?.position || '', avatar: p?.avatar || '', color: p?.color || cloud.colorFor(uid), tab: metas[metas.length - 1]?.tab || '', focus: metas[metas.length - 1]?.focus || null, me: uid === me?.id });
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'klaps_keyboxes', filter: 'project_id=eq.' + id }, () => { void onKeys(id); })
      .subscribe((st) => { if (st === 'SUBSCRIBED') void ch.track({ tab: useUI.getState().tab, focus: focusOf(useUI.getState()), at: Date.now() }); });
    let tab = useUI.getState().tab, fk = focusKey(focusOf(useUI.getState()));
    unsubs.push(useUI.subscribe((s) => { const f = focusOf(s), k = focusKey(f); if (s.tab !== tab || k !== fk) { tab = s.tab; fk = k; void ch.track({ tab, focus: f, at: Date.now() }); } }));
  } catch { /* obecność jest dodatkiem */ }
}

/** zapisz wszystko, co czeka (zamknięcie okna) – najwyżej kilka sekund */
export async function flushCloud(): Promise<void> {
  if (!eng) return;
  const id = useCollab.getState().id!;
  await Promise.race([eng.settle(), new Promise((r) => setTimeout(r, 4000))]);
  await cloud.cachePut(id, snapshotCache());
}
export async function closeCloud(): Promise<void> {
  if (!eng) return;
  const e = eng, id = useCollab.getState().id!;
  try { await flushCloud(); } catch { /* brak */ }
  try { await flushLog(id); } catch { /* zostaje w pamięci offline */ }
  if (logTimer) { clearTimeout(logTimer); logTimer = null; }
  try { await cloud.cachePut(id, snapshotCache()); } catch { /* brak */ }
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
