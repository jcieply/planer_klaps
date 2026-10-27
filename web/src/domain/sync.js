// @ts-nocheck
/* Moduł przeniesiony z wersji 1.x (logika bez zmian). */
import { T } from './i18n';
import { Core } from './core';
import { Vault } from './vault';
import { Store } from './store';
/* ===== SYNCHRONIZACJA: projekty między urządzeniami (Mac, iPhone) przez Supabase (REST, bez dodatkowych bibliotek) =====
   Tabela klaps_projects: jeden wiersz na projekt (plan, tekst scenariusza, lista mapek).
   Tabela klaps_media: jedna mapka na wiersz (obrazy wysyłane tylko raz).
   Konflikt (ten sam projekt zmieniony na dwóch urządzeniach): wersja z serwera trafia do projektu,
   a wersja z tego urządzenia zostaje zapisana jako kopia „(konflikt – urządzenie)”. Nic nie przepada. */
const Sync = (() => {
  const CFG_KEY = 'klaps.sync';
  const T_PROJ = 'klaps_projects', T_MEDIA = 'klaps_media';
  let cfg = null;
  let busy = false, again = false, timer = null, tick = null;
  const status = { state: 'off', at: 0, error: '' }; // off | idle | busy | error
  const listeners = [];
  /** zaczepy aplikacji: isDirty(id), onRemote(id), onList(), toast(msg, kind) */
  const hooks = {};

  const hash = (s) => { s = String(s || ''); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; };
  const load = () => { try { cfg = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) { cfg = null; } cfg = Object.assign({ url: '', key: '', email: '', session: null, device: defaultDevice(), state: {} }, cfg || {}); return cfg; };
  const save = () => { try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* brak miejsca */ } };
  function defaultDevice() {
    const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
    return /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Macintosh|Mac OS/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'urządzenie';
  }
  const emit = () => listeners.forEach((f) => { try { f(status); } catch (e) { /* brak */ } });
  const set = (state, error) => { status.state = state; if (error !== undefined) status.error = error; if (state === 'idle') status.at = Date.now(); emit(); };
  /** synchronizacja działa w aplikacjach (Mac, iOS) i w zwykłej przeglądarce; w podglądzie claude.ai nie */
  const available = () => typeof window !== 'undefined' && !(window.claude && typeof window.claude.use === 'function');
  const configured = () => !!(cfg && cfg.url && cfg.key);
  const loggedIn = () => !!(configured() && cfg.session && cfg.session.access_token);
  const base = () => cfg.url.replace(/\/+$/, '');

  /* ---------- HTTP ---------- */
  async function http(method, path, body, o = {}) {
    const headers = { apikey: cfg.key, 'Content-Type': 'application/json' };
    if (!o.noAuth && cfg.session) headers.Authorization = 'Bearer ' + cfg.session.access_token;
    if (o.prefer) headers.Prefer = o.prefer;
    let res;
    try { res = await fetch(base() + path, { method, headers, body: body == null ? undefined : JSON.stringify(body) }); }
    catch (e) { throw new Error(T('Brak połączenia z serwerem synchronizacji.')); }
    const txt = await res.text();
    let data = null; try { data = txt ? JSON.parse(txt) : null; } catch (e) { data = txt; }
    if (!res.ok) {
      const msg = (data && (data.msg || data.message || data.error_description || data.error)) || ('HTTP ' + res.status);
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return data;
  }
  async function token() {
    if (!cfg.session) throw new Error(T('Zaloguj się, aby synchronizować.'));
    if (cfg.session.expires_at && Date.now() / 1000 > cfg.session.expires_at - 90) await refresh();
  }
  async function refresh() {
    const d = await http('POST', '/auth/v1/token?grant_type=refresh_token', { refresh_token: cfg.session.refresh_token }, { noAuth: true });
    setSession(d);
  }
  function setSession(d) {
    cfg.session = { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at || Math.round(Date.now() / 1000) + (d.expires_in || 3600), user: { id: d.user && d.user.id, email: d.user && d.user.email } };
    save();
  }
  /** zapytanie do bazy z odświeżeniem sesji przy 401 */
  async function api(method, path, body, prefer) {
    await token();
    try { return await http(method, path, body, { prefer }); }
    catch (e) {
      if (e.status === 401) { await refresh(); return http(method, path, body, { prefer }); }
      throw e;
    }
  }

  /* ---------- konto ---------- */
  async function login(url, key, email, password, create) {
    load();
    cfg.url = String(url || '').trim(); cfg.key = String(key || '').trim(); cfg.email = String(email || '').trim();
    if (!/^https?:\/\//.test(cfg.url) || !cfg.key) throw new Error(T('Podaj adres projektu Supabase i klucz publiczny (anon).'));
    save();
    if (create) {
      const d = await http('POST', '/auth/v1/signup', { email: cfg.email, password }, { noAuth: true });
      if (!d || !d.access_token) return 'confirm';
      setSession(d);
    } else {
      const d = await http('POST', '/auth/v1/token?grant_type=password', { email: cfg.email, password }, { noAuth: true });
      setSession(d);
    }
    cfg.state = {}; save();
    start();
    await syncAll();
    return 'ok';
  }
  function logout() {
    load(); cfg.session = null; cfg.state = {}; save();
    stop(); set('off', '');
  }
  function setDevice(name) { load(); cfg.device = String(name || '').trim() || defaultDevice(); save(); }

  /* ---------- części projektu (postać zapisana: przy szyfrowaniu E2E wyłącznie szyfrogramy) ---------- */
  const parts = (raw) => {
    let media = {}; try { media = JSON.parse(raw.media || '{}') || {}; } catch (e) { media = {}; }
    const mediaIds = Object.keys(media).sort();
    return { plan: raw.plan, script: raw.script || '', mediaIds, media, enc: typeof Vault !== 'undefined' && Vault.isEnc(raw.plan), h: { plan: hash(raw.plan), script: hash(raw.script), media: hash(mediaIds.join(',')) } };
  };
  const changed = (s, p) => !s || !s.h || s.h.plan !== p.h.plan || s.h.script !== p.h.script || s.h.media !== p.h.media;
  const titleOf = (p) => { if (p.enc) return ''; try { return (JSON.parse(p.plan).meta || {}).title || ''; } catch (e) { return ''; } };

  async function pushMedia(projId, p, s) {
    const sent = new Set((s && !!s.enc === p.enc && s.sentMedia) || []);
    for (const id of p.mediaIds) {
      if (sent.has(id)) continue;
      const m = p.media[id];
      const row = typeof m === 'string' ? { id, project: projId, meta: JSON.stringify({ enc: 1 }), data: m } : { id, project: projId, meta: JSON.stringify({ mime: m.mime, w: m.w, h: m.h, name: m.name }), data: m.data };
      await api('POST', `/rest/v1/${T_MEDIA}`, [row], 'resolution=merge-duplicates,return=minimal');
      sent.add(id);
    }
    return [...sent].filter((id) => p.mediaIds.includes(id));
  }
  async function push(id, raw, s, remote) {
    const p = parts(raw);
    const sentMedia = await pushMedia(id, p, s);
    const row = { id, title: titleOf(p), updated_at: Date.now(), device: cfg.device, deleted: false, media_ids: p.mediaIds };
    if (!remote || !s || s.h.plan !== p.h.plan) row.plan = p.plan;
    if (!remote || !s || s.h.script !== p.h.script) row.script = p.script;
    await api('POST', `/rest/v1/${T_PROJ}`, [row], 'resolution=merge-duplicates,return=minimal');
    cfg.state[id] = { base: row.updated_at, h: p.h, sentMedia, enc: p.enc };
  }
  async function pull(id) {
    const rows = await api('GET', `/rest/v1/${T_PROJ}?id=eq.${encodeURIComponent(id)}&select=id,title,updated_at,plan,script,media_ids`);
    const r = rows && rows[0]; if (!r || !r.plan) return null;
    const ids = r.media_ids || [];
    const media = {};
    if (ids.length) {
      const ms = await api('GET', `/rest/v1/${T_MEDIA}?id=in.(${ids.map(encodeURIComponent).join(',')})&select=id,meta,data`);
      (ms || []).forEach((m) => {
        let meta = {}; try { meta = JSON.parse(m.meta || '{}'); } catch (e) { meta = {}; }
        media[m.id] = meta.enc ? m.data : { mime: meta.mime || 'image/jpeg', w: meta.w, h: meta.h, name: meta.name || '', data: m.data };
      });
    }
    const raw = { plan: r.plan, script: r.script || '', media: JSON.stringify(media) };
    return { raw, updated_at: r.updated_at, mediaIds: Object.keys(media) };
  }
  /** zapis lokalny wersji z serwera; jeśli to otwarty projekt – podmiana na ekranie */
  async function applyLocal(id, got) {
    await Store.saveRaw(id, got.raw);
    const p = parts(got.raw);
    cfg.state[id] = { base: got.updated_at, h: p.h, sentMedia: got.mediaIds, enc: p.enc };
    if (hooks.onRemote) await hooks.onRemote(id);
  }

  /* ---------- pełna synchronizacja ---------- */
  async function syncAll() {
    if (!available() || !loggedIn()) return;
    if (busy) { again = true; return; }
    busy = true; set('busy');
    try {
      const remote = await api('GET', `/rest/v1/${T_PROJ}?select=id,title,updated_at,deleted,device`);
      const rmap = new Map((remote || []).map((r) => [r.id, r]));
      const local = await Store.list();
      const lmap = new Map(local.map((m) => [m.id, m]));
      // projekt otwarty z niezapisanymi zmianami synchronizujemy dopiero po zapisie
      const dirty = (id) => !!(hooks.isDirty && hooks.isDirty(id));
      for (const m of local) {
        if (dirty(m.id)) continue;
        const r = rmap.get(m.id), s = cfg.state[m.id];
        if (m.demo && !r) continue; // przykładowego projektu nie wysyłamy
        const raw = await Store.loadRaw(m.id); if (!raw) continue;
        const p = parts(raw);
        if (!r) { if (!s) await push(m.id, raw, null, null); else if (changed(s, p)) await push(m.id, raw, s, null); else { await Store.remove(m.id); delete cfg.state[m.id]; } continue; }
        if (r.deleted) {
          if (s && !changed(s, p)) { await Store.remove(m.id); delete cfg.state[m.id]; }
          else await push(m.id, raw, s, r);
          continue;
        }
        if (s && r.updated_at === s.base) { if (changed(s, p)) await push(m.id, raw, s, r); continue; }
        // na serwerze jest nowsza wersja
        if (s && !changed(s, p)) { const got = await pull(m.id); if (got) await applyLocal(m.id, got); continue; }
        const got = await pull(m.id);
        if (!got) { await push(m.id, raw, s, r); continue; }
        const gp = parts(got.raw);
        if (gp.h.plan === p.h.plan && gp.h.script === p.h.script) { cfg.state[m.id] = { base: got.updated_at, h: p.h, sentMedia: got.mediaIds, enc: p.enc }; continue; }
        // konflikt: zachowaj obie wersje
        const copyId = Core.uid();
        let copyRaw = raw;
        if (!p.enc) {
          try { const pl = JSON.parse(raw.plan); pl.meta = pl.meta || {}; pl.meta.title = (pl.meta.title || T('Bez tytułu')) + ' ' + T('(konflikt – {d})', { d: cfg.device }); copyRaw = Object.assign({}, raw, { plan: JSON.stringify(pl) }); } catch (e) { copyRaw = raw; }
        } else Store.shareKey(m.id, copyId);
        await Store.saveRaw(copyId, copyRaw);
        await push(copyId, copyRaw, null, null);
        await applyLocal(m.id, got);
        if (hooks.toast) hooks.toast(T('Projekt „{t}” zmieniono na dwóch urządzeniach. Twoja wersja jest zapisana jako osobny projekt z dopiskiem „konflikt”.', { t: titleOf(gp) || m.title || '' }), 'bad');
      }
      for (const r of remote || []) {
        if (lmap.has(r.id) || r.deleted) continue;
        const got = await pull(r.id);
        if (got) await applyLocal(r.id, got);
      }
      save();
      if (hooks.onList) await hooks.onList();
      set('idle', '');
    } catch (e) {
      set('error', e && e.message ? e.message : String(e));
    } finally {
      busy = false;
      if (again) { again = false; setTimeout(syncAll, 500); }
    }
  }
  /** wywoływane po każdym zapisie lokalnym */
  function touch() { if (!available() || !loggedIn()) return; clearTimeout(timer); timer = setTimeout(syncAll, 3000); }
  /** projekt usunięty na tym urządzeniu: znacznik usunięcia na serwerze */
  async function removed(id) {
    if (!available() || !loggedIn() || !cfg.state[id]) return;
    try { await api('PATCH', `/rest/v1/${T_PROJ}?id=eq.${encodeURIComponent(id)}`, { deleted: true, updated_at: Date.now(), device: cfg.device }, 'return=minimal'); delete cfg.state[id]; save(); }
    catch (e) { set('error', e.message); }
  }
  function start() {
    load();
    if (!available() || !loggedIn()) { set('off', ''); return; }
    stop();
    tick = setInterval(syncAll, 45000);
    set('idle', status.error);
    syncAll();
  }
  function stop() { clearInterval(tick); tick = null; clearTimeout(timer); }
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && tick) syncAll(); });
    if (typeof window !== 'undefined') window.addEventListener('online', () => { if (tick) syncAll(); });
  }

  /** skrypt bazy do wklejenia w Supabase → SQL Editor */
  const SQL = `-- Klaps Planer: tabele synchronizacji (uruchom raz w Supabase → SQL Editor)
create table if not exists public.klaps_projects (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null default '',
  updated_at bigint not null default 0,
  device text not null default '',
  deleted boolean not null default false,
  plan text,
  script text,
  media_ids text[] not null default '{}'
);
create table if not exists public.klaps_media (
  id text primary key,
  owner uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project text not null,
  meta text not null default '{}',
  data text not null
);
alter table public.klaps_projects enable row level security;
alter table public.klaps_media enable row level security;
drop policy if exists "klaps: własne projekty" on public.klaps_projects;
create policy "klaps: własne projekty" on public.klaps_projects for all using (owner = auth.uid()) with check (owner = auth.uid());
drop policy if exists "klaps: własne mapki" on public.klaps_media;
create policy "klaps: własne mapki" on public.klaps_media for all using (owner = auth.uid()) with check (owner = auth.uid());
`;

  load();
  return {
    available, configured, loggedIn, login, logout, setDevice, start, stop, syncAll, touch, removed, status, SQL,
    get cfg() { return load(); },
    onChange(f) { listeners.push(f); return () => { const i = listeners.indexOf(f); if (i >= 0) listeners.splice(i, 1); }; },
    setHooks(h) { Object.assign(hooks, h); },
  };
})();
export { Sync };
