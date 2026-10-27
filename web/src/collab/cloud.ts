/* Klient chmury (Supabase): konto, projekty, zaproszenia, role. Adres serwera i klucz publiczny (anon) są wpisane w
   program podczas budowania (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY) – użytkownik niczego nie wpisuje.
   Treść projektów jest szyfrowana kluczem projektu, który leży tylko na komputerach osób z dostępem (Keychain/DPAPI). */
import type { SupabaseClient } from '@supabase/supabase-js';
import { T } from '../domain/i18n';
import { desktop } from '../desktop/bridge';
import { decryptBytes, decryptJson, encryptBytes, encryptJson, formatCode, importKey, makeInvite, newKeyBytes, parseInvite, b64, unb64, unb32, type ProjectKey } from './crypto';
import type { Transport, RemoteOp } from './engine';
import { idbTable, openIdb } from '../domain/idb';

const URL_ = (import.meta.env.VITE_SUPABASE_URL as string | undefined) || '';
const KEY_ = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) || '';
/** https zawsze; zwykły http tylko do testów na tym samym komputerze */
export const cloudConfigured = (): boolean => /^(https:\/\/|http:\/\/(127\.0\.0\.1|localhost)[:/])/.test(URL_) && KEY_.length > 20;

export type Role = 'owner' | 'editor' | 'viewer';
export interface CloudUser { id: string; email: string; name: string; position: string; avatar: string; color: string }
export interface CloudProject { id: string; title: string; role: Role; owner: string; ownerName: string; updatedAt: number; members: number; locked: boolean }
export interface Member { id: string; name: string; position: string; avatar: string; color: string; role: Role; addedAt: number }
export interface InviteRow { id: string; role: 'editor' | 'viewer'; createdAt: number; expiresAt: number | null; maxUses: number | null; uses: number; revoked: boolean; code: string | null }

/* ---------- magazyn sesji i kluczy: Keychain/DPAPI w programie, localStorage w przeglądarce (testy) ---------- */
const mem = new Map<string, string>();
const vault = {
  async get(n: string): Promise<string | null> {
    const d = desktop(); if (d?.secrets) return d.secrets.get(n);
    try { return localStorage.getItem('klaps.sec.' + n); } catch { return mem.get(n) ?? null; }
  },
  async set(n: string, v: string): Promise<void> {
    const d = desktop(); if (d?.secrets) { await d.secrets.set(n, v); return; }
    try { localStorage.setItem('klaps.sec.' + n, v); } catch { mem.set(n, v); }
  },
  async remove(n: string): Promise<void> {
    const d = desktop(); if (d?.secrets) { await d.secrets.remove(n); return; }
    try { localStorage.removeItem('klaps.sec.' + n); } catch { mem.delete(n); }
  },
};
let sb: Promise<SupabaseClient> | null = null;
/** klient Supabase ładuje się dopiero przy pierwszym użyciu chmury (okno bez chmury nie płaci za bibliotekę) */
export function client(): Promise<SupabaseClient> {
  if (!cloudConfigured()) return Promise.reject(new Error(T('Chmura nie jest skonfigurowana w tej wersji programu.')));
  return (sb ||= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_, KEY_, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'klaps-auth', storage: { getItem: (k) => vault.get(k), setItem: (k, v) => vault.set(k, v), removeItem: (k) => vault.remove(k) } },
    realtime: { params: { eventsPerSecond: 20 } },
  })));
}

/* ---------- błędy po polsku ---------- */
const MSG: Record<string, string> = {
  'klaps:not_signed_in': 'Zaloguj się, aby korzystać z chmury.', 'klaps:forbidden': 'Nie masz do tego uprawnień.', 'klaps:not_member': 'Nie należysz do tego projektu.',
  'klaps:invalid_invite': 'Kod zaproszenia jest nieprawidłowy, wygasł albo został wykorzystany.', 'klaps:bad_role': 'Niepoprawna rola.', 'klaps:owner_cannot_leave': 'Właściciel nie może opuścić projektu – przekaż go komuś innemu albo usuń projekt.',
  'klaps:avatar_too_large': 'Zdjęcie jest za duże.', 'Invalid login credentials': 'Zły e-mail lub hasło.', 'User already registered': 'Konto z tym adresem już istnieje – zaloguj się.',
  'Email not confirmed': 'Potwierdź adres e-mail (link w wiadomości) i zaloguj się ponownie.',
};
export function explain(e: unknown): Error {
  const m = String((e as { message?: string })?.message || e || '');
  for (const k of Object.keys(MSG)) if (m.includes(k)) return new Error(T(MSG[k]));
  if (/Failed to fetch|NetworkError|fetch failed|Load failed/i.test(m)) return new Error(T('Brak połączenia z chmurą. Sprawdź internet i spróbuj ponownie.'));
  if (/Password should be at least/i.test(m)) return new Error(T('Hasło jest za krótkie (minimum 8 znaków).'));
  if (/rate limit/i.test(m)) return new Error(T('Za dużo prób – odczekaj chwilę.'));
  return new Error(m || T('Operacja w chmurze nie powiodła się.'));
}
async function rpc<R = unknown>(fn: string, args: Record<string, unknown>): Promise<R> {
  const { data, error } = await (await client()).rpc(fn, args);
  if (error) throw explain(error);
  return data as R;
}
async function q<R>(p: PromiseLike<{ data: R | null; error: { message: string } | null }>): Promise<R> {
  const { data, error } = await p;
  if (error) throw explain(error);
  return data as R;
}

/* ---------- konto ---------- */
const palette = ['#e0a526', '#4aa3df', '#d9635b', '#5bb98c', '#a07be0', '#e07bb0', '#7bc4c4', '#c4a77b'];
export const colorFor = (id: string): string => { let h = 0; for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0; return palette[h % palette.length]; };
export async function currentUser(): Promise<CloudUser | null> {
  if (!cloudConfigured()) return null;
  const { data } = await (await client()).auth.getSession();
  const u = data.session?.user; if (!u) return null;
  // bez internetu zostają dane z sesji (imię i stanowisko podane przy zakładaniu konta)
  const rows = await q<any[]>((await client()).from('klaps_profiles').select('*').eq('id', u.id).limit(1)).catch(() => null);
  const r = rows?.[0];
  const meta = (u.user_metadata || {}) as Record<string, string>;
  return { id: u.id, email: u.email || '', name: r?.name || meta.name || '', position: r?.position || meta.position || '', avatar: r?.avatar || '', color: r?.color || colorFor(u.id) };
}
export interface Profile { name: string; position: string; avatar: string }
export async function signUp(email: string, password: string, p: Profile): Promise<{ user: CloudUser | null; needsConfirm: boolean }> {
  const { data, error } = await (await client()).auth.signUp({ email: email.trim(), password, options: { data: { name: p.name, position: p.position } } });
  if (error) throw explain(error);
  if (!data.session) return { user: null, needsConfirm: true };
  await saveProfile(p);
  return { user: await currentUser(), needsConfirm: false };
}
export async function signIn(email: string, password: string): Promise<CloudUser> {
  const { error } = await (await client()).auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw explain(error);
  const u = await currentUser();
  if (!u) throw new Error(T('Nie udało się zalogować.'));
  if (!u.name) { const m = (await (await client()).auth.getUser()).data.user?.user_metadata as Record<string, string> | undefined; if (m?.name) await saveProfile({ name: m.name, position: m.position || '', avatar: '' }); }
  return (await currentUser()) || u;
}
export async function signOut(): Promise<void> {
  const c = await client();
  const me = (await c.auth.getSession()).data.session?.user.id;
  await c.auth.signOut();
  if (me) await vault.remove('cl:' + me);
}
export async function saveProfile(p: Profile): Promise<void> {
  const { data } = await (await client()).auth.getSession();
  const id = data.session?.user.id || '';
  await rpc('klaps_upsert_profile', { p_name: p.name.trim(), p_position: p.position.trim(), p_avatar: p.avatar, p_color: colorFor(id) });
}
export async function resetPassword(email: string): Promise<void> { const { error } = await (await client()).auth.resetPasswordForEmail(email.trim()); if (error) throw explain(error); }

/** zdjęcie → kwadrat 128×128 JPEG (data URL, ok. 6–10 KB) */
export async function avatarFromFile(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const s = Math.min(bmp.width, bmp.height), c = document.createElement('canvas');
  c.width = c.height = 128;
  c.getContext('2d')!.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 128, 128);
  bmp.close?.();
  return c.toDataURL('image/jpeg', 0.82);
}

/* ---------- klucze projektów (tylko na tym komputerze) ---------- */
const keyName = (id: string) => 'pk:' + id;
const keyCache = new Map<string, ProjectKey>();
export async function projectKey(id: string): Promise<ProjectKey | null> {
  const c = keyCache.get(id); if (c) return c;
  const raw = await vault.get(keyName(id)); if (!raw) return null;
  const k = await importKey(unb64(raw)); keyCache.set(id, k); return k;
}
async function storeKey(id: string, bytes: Uint8Array): Promise<ProjectKey> { await vault.set(keyName(id), b64(bytes)); const k = await importKey(bytes); keyCache.set(id, k); return k; }
export async function hasKey(id: string): Promise<boolean> { return !!(await vault.get(keyName(id))); }
export async function forgetKey(id: string): Promise<void> { keyCache.delete(id); await vault.remove(keyName(id)); }
async function needKey(id: string): Promise<ProjectKey> { const k = await projectKey(id); if (!k) throw new Error(T('Brak klucza tego projektu na tym komputerze. Wpisz kod zaproszenia.')); return k; }

/* ---------- projekty ---------- */
/** lista projektów; bez internetu – ostatnia znana lista (w magazynie sekretów systemu) */
export async function listProjects(): Promise<CloudProject[]> {
  const me = (await (await client()).auth.getSession()).data.session?.user.id; if (!me) return [];
  try {
    const out = await listProjectsOnline(me);
    void vault.set('cl:' + me, JSON.stringify(out.slice(0, 60))).catch(() => undefined);
    return out;
  } catch (e) {
    const raw = await vault.get('cl:' + me).catch(() => null);
    if (raw) { try { return JSON.parse(raw) as CloudProject[]; } catch { /* uszkodzona pamięć */ } }
    throw e;
  }
}
async function listProjectsOnline(me: string): Promise<CloudProject[]> {
  const [prj, mem] = await Promise.all([
    q<any[]>((await client()).from('klaps_projects').select('id,owner,title_enc,updated_at')),
    q<any[]>((await client()).from('klaps_members').select('project_id,user_id,role')),
  ]);
  const owners = [...new Set((prj || []).map((p) => p.owner))];
  const profs = owners.length ? await q<any[]>((await client()).from('klaps_profiles').select('id,name').in('id', owners)) : [];
  const names = new Map((profs || []).map((p) => [p.id, p.name as string]));
  const out: CloudProject[] = [];
  for (const p of prj || []) {
    const key = await projectKey(p.id);
    let title = ''; let locked = false;
    if (key) { try { title = (await decryptJson<{ t: string }>(key, p.title_enc)).t; } catch { locked = true; } } else locked = true;
    const ms = (mem || []).filter((m) => m.project_id === p.id);
    out.push({ id: p.id, title: title || T('Projekt zablokowany (wpisz kod zaproszenia)'), role: (ms.find((m) => m.user_id === me)?.role || 'viewer') as Role, owner: p.owner, ownerName: names.get(p.owner) || '', updatedAt: Date.parse(p.updated_at) || 0, members: ms.length, locked });
  }
  return out.sort((a, b) => b.updatedAt - a.updatedAt);
}
/** zakłada projekt w chmurze ze stanu `state` (pusty albo istniejący lokalny); zwraca id */
export async function createProject(title: string, state: unknown): Promise<string> {
  const kb = await newKeyBytes();
  const key = await importKey(kb);
  const id = await rpc<string>('klaps_create_project', { p_title_enc: await encryptJson(key, { t: title }), p_snapshot: await encryptJson(key, state) });
  await storeKey(id, kb);
  return id;
}
export async function renameProject(id: string, title: string): Promise<void> { await rpc('klaps_set_title', { p_project: id, p_title_enc: await encryptJson(await needKey(id), { t: title }) }); }
export async function deleteProject(id: string): Promise<void> { await rpc('klaps_delete_project', { p_project: id }); await forgetKey(id); }
export async function leaveProject(id: string): Promise<void> { const me = (await (await client()).auth.getSession()).data.session!.user.id; await rpc('klaps_remove_member', { p_project: id, p_user: me }); await forgetKey(id); }

/* ---------- osoby, role, zaproszenia ---------- */
export async function members(id: string): Promise<Member[]> {
  const ms = await q<any[]>((await client()).from('klaps_members').select('user_id,role,added_at').eq('project_id', id));
  const ids = (ms || []).map((m) => m.user_id);
  const ps = ids.length ? await q<any[]>((await client()).from('klaps_profiles').select('*').in('id', ids)) : [];
  const by = new Map((ps || []).map((p) => [p.id, p]));
  const rank = { owner: 0, editor: 1, viewer: 2 } as const;
  return (ms || []).map((m) => { const p = by.get(m.user_id) || {}; return { id: m.user_id, name: p.name || T('Użytkownik'), position: p.position || '', avatar: p.avatar || '', color: p.color || colorFor(m.user_id), role: m.role as Role, addedAt: Date.parse(m.added_at) || 0 }; }).sort((a, b) => rank[a.role] - rank[b.role] || a.name.localeCompare(b.name));
}
/* ---------- dziennik zmian ---------- */
export interface ActivityRow { id: number; at: number; by: string; items: string[] }
export async function logActivity(id: string, entries: Array<{ at: number; items: string[] }>): Promise<void> {
  const key = await needKey(id);
  for (const e of entries) await rpc('klaps_log_activity', { p_project: id, p_payload: await encryptJson(key, e) });
}
export async function activity(id: string, limit = 200): Promise<ActivityRow[]> {
  const key = await needKey(id);
  const rows = await q<any[]>((await client()).from('klaps_activity').select('id,author,at,payload').eq('project_id', id).order('id', { ascending: false }).limit(limit));
  const out: ActivityRow[] = [];
  for (const r of rows || []) {
    try { const e = await decryptJson<{ at: number; items: string[] }>(key, r.payload); out.push({ id: Number(r.id), at: Number(e.at) || Date.parse(r.at), by: r.author, items: Array.isArray(e.items) ? e.items.map(String) : [] }); }
    catch { /* wpis z innego klucza lub uszkodzony – pomijamy */ }
  }
  return out;
}
export const setRole = (id: string, user: string, role: 'editor' | 'viewer') => rpc('klaps_set_role', { p_project: id, p_user: user, p_role: role }).then(() => undefined);
export const removeMember = (id: string, user: string) => rpc('klaps_remove_member', { p_project: id, p_user: user }).then(() => undefined);
export const transferOwner = (id: string, user: string) => rpc('klaps_transfer_owner', { p_project: id, p_user: user }).then(() => undefined);

export async function createInvite(id: string, role: 'editor' | 'viewer', hours: number, maxUses: number): Promise<string> {
  const key = await needKey(id);
  const raw = await vault.get(keyName(id)); const kb = unb64(raw!);
  const { code, secret } = await makeInvite(kb);
  await rpc('klaps_create_invite', { p_project: id, p_role: role, p_secret: secret, p_secret_enc: await encryptBytes(key, new TextEncoder().encode(secret)), p_hours: hours, p_max_uses: maxUses });
  return code;
}
export async function invites(id: string): Promise<InviteRow[]> {
  const key = await needKey(id); const kb = unb64((await vault.get(keyName(id)))!);
  const rows = await q<any[]>((await client()).from('klaps_invites').select('*').eq('project_id', id).order('created_at', { ascending: false }));
  const out: InviteRow[] = [];
  for (const r of rows || []) {
    let code: string | null = null;
    try { const secret = new TextDecoder().decode(await decryptBytes(key, r.secret_enc)); const all = new Uint8Array(48); all.set(unb32(secret).subarray(0, 16)); all.set(kb, 16); code = formatCode(all); } catch { /* sekret nie do odczytu */ }
    out.push({ id: r.id, role: r.role, createdAt: Date.parse(r.created_at) || 0, expiresAt: r.expires_at ? Date.parse(r.expires_at) : null, maxUses: r.max_uses, uses: r.uses, revoked: !!r.revoked, code });
  }
  return out;
}
export const revokeInvite = (inviteId: string) => rpc('klaps_revoke_invite', { p_invite: inviteId }).then(() => undefined);
/** dołączenie kodem: serwer sprawdza sekret, a klucz projektu zostaje u nas */
export async function redeemInvite(code: string): Promise<{ id: string; role: Role }> {
  const inv = parseInvite(code);
  if (!inv) throw new Error(T('To nie wygląda na kod zaproszenia. Skopiuj go w całości (zaczyna się od KLAPS-).'));
  const rows = await rpc<{ project_id: string; role: Role }[]>('klaps_redeem_invite', { p_secret: inv.secret });
  const r = Array.isArray(rows) ? rows[0] : (rows as unknown as { project_id: string; role: Role });
  await storeKey(r.project_id, inv.keyBytes);
  return { id: r.project_id, role: r.role };
}

/* ---------- transport silnika (zmiany na żywo przez Realtime) ---------- */
export function makeTransport(projectId: string): Transport {
  let last = 0;
  const pull = async (from: number) => {
    const sbc = await client();
    const out: { snapshot?: { seq: number; payload: string }; ops: RemoteOp[] } = { ops: [] };
    let start = from;
    {
      const s = await q<any[]>(sbc.from('klaps_snapshots').select('seq,payload').eq('project_id', projectId).limit(1));
      const snap = s?.[0];
      if (snap && snap.seq > from) { out.snapshot = { seq: Number(snap.seq), payload: snap.payload }; start = Number(snap.seq); }
    }
    for (;;) {
      const rows = await q<any[]>(sbc.from('klaps_ops').select('seq,client_id,local_seq,payload').eq('project_id', projectId).gt('seq', start).order('seq').limit(200));
      for (const r of rows || []) out.ops.push({ seq: Number(r.seq), clientId: r.client_id, localSeq: Number(r.local_seq), payload: r.payload });
      if (!rows || rows.length < 200) break;
      start = Number(rows[rows.length - 1].seq);
    }
    if (out.ops.length) last = Math.max(last, out.ops[out.ops.length - 1].seq);
    return out;
  };
  return {
    pull,
    async push(clientId, localSeq, payload) { return Number(await rpc<number>('klaps_push_ops', { p_project: projectId, p_client: clientId, p_local: localSeq, p_payload: payload })); },
    async putSnapshot(seq, payload) { await rpc('klaps_put_snapshot', { p_project: projectId, p_seq: seq, p_payload: payload }); },
    subscribe(onOp, onStatus) {
      let stopped = false;
      let remove: (() => void) | null = null;
      void client().then((sbc) => {
        if (stopped) return;
        const ch = sbc.channel('ops:' + projectId + ':' + Math.random().toString(36).slice(2))
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'klaps_ops', filter: 'project_id=eq.' + projectId }, async (ev) => {
            const r = ev.new as { seq: number; client_id: string; local_seq: number; payload?: string };
            if (r.payload) { last = Math.max(last, Number(r.seq)); onOp({ seq: Number(r.seq), clientId: r.client_id, localSeq: Number(r.local_seq), payload: r.payload }); return; }
            try { const p = await pull(last); for (const o of p.ops) onOp(o); } catch { /* następna zmiana lub ponowne połączenie dociągnie */ }
          })
          .subscribe((st) => { if (st === 'SUBSCRIBED') onStatus(true); else if (st === 'CHANNEL_ERROR' || st === 'TIMED_OUT' || st === 'CLOSED') onStatus(false); });
        remove = () => { void sbc.removeChannel(ch); };
      }).catch(() => onStatus(false));
      return () => { stopped = true; remove?.(); };
    },
  };
}
export async function codecFor(projectId: string): Promise<{ enc(v: unknown): Promise<string>; dec<R = unknown>(s: string): Promise<R> }> {
  const key = await needKey(projectId);
  return { enc: (v) => encryptJson(key, v), dec: <R,>(s: string) => decryptJson<R>(key, s) };
}

export async function myRole(projectId: string): Promise<Role | null> {
  const me = (await (await client()).auth.getSession()).data.session?.user.id; if (!me) return null;
  const r = await q<any[]>((await client()).from('klaps_members').select('role').eq('project_id', projectId).eq('user_id', me).limit(1));
  return (r?.[0]?.role as Role) || null;
}
export async function projectTitle(projectId: string): Promise<string> {
  const r = await q<any[]>((await client()).from('klaps_projects').select('title_enc').eq('id', projectId).limit(1));
  const row = r?.[0]; if (!row) return '';
  try { return (await decryptJson<{ t: string }>(await needKey(projectId), row.title_enc)).t; } catch { return ''; }
}
/** pamięć podręczna (IndexedDB) zaszyfrowana kluczem projektu – otwarcie bez internetu */
let dbp: Promise<IDBDatabase> | null = null;
const tbl = async () => idbTable<{ id: string; v: string; at: number }>(await (dbp ||= openIdb()), 'collab');
export async function cacheGet<R>(id: string): Promise<R | null> {
  try { const row = await (await tbl()).get(id); const k = await projectKey(id); return row && k ? await decryptJson<R>(k, row.v) : null; } catch { return null; }
}
export async function cachePut(id: string, v: unknown): Promise<void> {
  try { const k = await projectKey(id); if (!k) return; await (await tbl()).put({ id, v: await encryptJson(k, v), at: Date.now() }); } catch { /* pamięć podręczna jest dodatkiem */ }
}
export async function cacheDrop(id: string): Promise<void> { try { await (await tbl()).del(id); } catch { /* brak */ } }
