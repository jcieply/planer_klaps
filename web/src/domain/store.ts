/* ===== ZAPIS PROJEKTÓW =====
   Kolejność: aplikacja na komputer/iPhone (pliki) → baza artefaktu claude.ai → IndexedDB → localStorage → pamięć.
   Projekt zapisuje się w trzech częściach: plan (bez tekstu scenariusza), tekst scenariusza i mapki.
   Projekt zaszyfrowany (E2E) zapisuje części jako koperty AES-GCM – wszędzie leżą wyłącznie szyfrogramy. */
import { idbTable, openIdb } from './idb';
import { T } from './i18n';
import { Core } from './core';
import { Vault } from './vault';
import type { ProjectMeta, ProjectState } from './model';
import { writeEncrypted, writePlain } from './klapsfile';

export interface Raw { plan: string; script: string; media: string }
type Key = { key: CryptoKey; salt: string; iter: number };
interface Backend { name: Mode; list(): Promise<ProjectMeta[]>; save(id: string, raw: Raw, meta: ProjectMeta): Promise<void>; load(id: string): Promise<Raw | null>; remove(id: string): Promise<void> }
export type Mode = 'desktop' | 'db' | 'idb' | 'local' | 'memory';

const CHUNK = 60000;
const hash = (s: string | null | undefined) => { s = String(s || ''); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; };
const lsGet = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k: string, v: string) => { try { localStorage.setItem(k, v); return true; } catch { return false; } };
const lsDel = (k: string) => { try { localStorage.removeItem(k); } catch { /* brak */ } };

/* ---------- IndexedDB: bez limitu 5 MB localStorage ---------- */
interface ProjectRow extends Raw { id: string; meta: ProjectMeta; updatedAt: number }

/* ---------- historia wersji (migawki) ---------- */
export interface SnapMeta { id: string; pid: string; at: number; label: string; auto: boolean; title: string; scenes: number | null; days: number | null; enc: boolean; size: number; h: string }
interface SnapRow extends SnapMeta { raw: Raw }
interface SnapBackend { list(pid: string): Promise<SnapMeta[]>; put(row: SnapRow): Promise<void>; get(id: string): Promise<SnapRow | null>; del(id: string): Promise<void> }
const strip = (r: SnapRow): SnapMeta => { const { raw, ...m } = r; void raw; return m; };

function desktopBackend(): Backend | null {
  const d = typeof window !== 'undefined' && window.klapsDesktop && (window.klapsDesktop.store as any);
  if (!d) return null;
  return {
    name: 'desktop',
    list: () => d.list(),
    save: (id, raw, meta) => d.save(id, meta, raw.plan, raw.script, raw.media),
    load: async (id) => { const o = await d.load(id); return o ? { plan: o.plan, script: o.script || '', media: o.media || '' } : null; },
    remove: (id) => d.remove(id),
  };
}
/** zapis długiego tekstu w kawałkach (dokumenty bazy artefaktu mają limit rozmiaru) */
async function writeParts(db: any, base: string, name: string, str: string, prev: number) {
  const n = Math.max(1, Math.ceil(str.length / CHUNK));
  for (let i = 0; i < n; i++) await db.doc(`${base}/parts/${name}-${i}`).set({ d: str.slice(i * CHUNK, (i + 1) * CHUNK) });
  for (let i = n; i < (prev || 0); i++) await db.doc(`${base}/parts/${name}-${i}`).delete();
  return n;
}
async function readParts(db: any, base: string, name: string, n: number) {
  let s = '';
  for (let i = 0; i < (n || 0); i++) { const c = await db.doc(`${base}/parts/${name}-${i}`).get(); s += c.exists ? c.data().d : ''; }
  return s;
}
function claudeDbSnaps(db: any): SnapBackend {
  return {
    async list(pid) { const snap = await db.collection('snaps').get(); return snap.docs.map((d: any) => Object.assign({ id: d.id }, d.data())).filter((m: SnapMeta) => m.pid === pid).map((m: any) => { delete m.parts; return m as SnapMeta; }); },
    async put(row) {
      const base = 'snaps/' + row.id, parts: Record<string, number> = {};
      for (const name of ['plan', 'script'] as const) parts[name] = await writeParts(db, base, name, row.raw[name], 0);
      await db.doc(base).set(Object.assign(strip(row), { parts }));
    },
    async get(id) {
      const d = await db.doc('snaps/' + id).get(); if (!d.exists) return null;
      const m = d.data(), p = m.parts || {};
      const raw = { plan: await readParts(db, 'snaps/' + id, 'plan', p.plan), script: await readParts(db, 'snaps/' + id, 'script', p.script), media: '{}' };
      delete m.parts;
      return Object.assign({ id }, m, { raw });
    },
    async del(id) {
      const d = await db.doc('snaps/' + id).get(); const p = d.exists ? d.data().parts || {} : {};
      for (const name of ['plan', 'script']) for (let i = 0; i < (p[name] || 0); i++) await db.doc(`snaps/${id}/parts/${name}-${i}`).delete();
      await db.doc('snaps/' + id).delete();
    },
  };
}
function idbSnaps(db: IDBDatabase): SnapBackend {
  const t = idbTable<SnapRow>(db, 'snapshots');
  return { list: async (pid) => (await t.byIndex('pid', pid)).map(strip), put: (row) => t.put(row), get: async (id) => (await t.get(id)) || null, del: (id) => t.del(id) };
}
function memorySnaps(): SnapBackend {
  const m = new Map<string, SnapRow>();
  return { list: async (pid) => [...m.values()].filter((r) => r.pid === pid).map(strip), put: async (r) => { m.set(r.id, r); }, get: async (id) => m.get(id) || null, del: async (id) => { m.delete(id); } };
}

function claudeDbBackend(db: any): Backend {
  const lastHash = new Map<string, Record<string, string>>();
  const writePart = (id: string, name: string, str: string, prev: number) => writeParts(db, 'projects/' + id, name, str, prev);
  return {
    name: 'db',
    async list() { const snap = await db.collection('projects').get(); return snap.docs.map((d: any) => Object.assign({ id: d.id }, d.data())); },
    async save(id, raw, meta) {
      const lh = lastHash.get(id) || {};
      const cur = await db.doc('projects/' + id).get();
      const old = cur.exists ? cur.data().parts || {} : {};
      const next: Record<string, { n: number; h?: string }> = {};
      for (const name of ['plan', 'script', 'media'] as const) next[name] = { n: (old[name] || {}).n || 0, h: (old[name] || {}).h };
      for (const name of ['plan', 'script', 'media'] as const) {
        const h = hash(raw[name]);
        if (lh[name] === h && next[name].h === h) continue;
        next[name] = { n: await writePart(id, name, raw[name], next[name].n), h };
        lh[name] = h;
      }
      await db.doc('projects/' + id).set(Object.assign({}, meta, { parts: next }));
      lastHash.set(id, lh);
    },
    async load(id) {
      const d = await db.doc('projects/' + id).get();
      if (!d.exists) return null;
      const p = d.data().parts || {};
      const read = async (name: string) => { const info = p[name]; return info && info.n ? readParts(db, 'projects/' + id, name, info.n) : ''; };
      const raw = { plan: await read('plan'), script: await read('script'), media: await read('media') };
      if (!raw.plan) return null;
      lastHash.set(id, { plan: hash(raw.plan), script: hash(raw.script), media: hash(raw.media) });
      return raw;
    },
    async remove(id) {
      lastHash.delete(id);
      const d = await db.doc('projects/' + id).get();
      const p = d.exists ? d.data().parts || {} : {};
      for (const name of ['plan', 'script', 'media']) for (let i = 0; i < ((p[name] || {}).n || 0); i++) await db.doc(`projects/${id}/parts/${name}-${i}`).delete();
      await db.doc('projects/' + id).delete();
    },
  };
}
function idbBackend(db: IDBDatabase): Backend {
  const t = idbTable<ProjectRow>(db, 'projects');
  return {
    name: 'idb',
    list: async () => (await t.all()).map((r) => r.meta),
    save: (id, raw, meta) => t.put({ id, meta, updatedAt: meta.updatedAt, plan: raw.plan, script: raw.script, media: raw.media }),
    load: async (id) => { const r = await t.get(id); return r ? { plan: r.plan, script: r.script, media: r.media } : null; },
    remove: (id) => t.del(id),
  };
}
function localBackend(): Backend {
  return {
    name: 'local',
    list: async () => { try { return JSON.parse(lsGet('klaps.idx') || '[]'); } catch { return []; } },
    async save(id, raw, meta) {
      if (!lsSet('klaps.p.' + id, JSON.stringify(raw))) throw new Error(T('Pamięć przeglądarki jest pełna. Usuń zbędne mapki albo zapisz kopię projektu do pliku.'));
      let idx: ProjectMeta[] = []; try { idx = JSON.parse(lsGet('klaps.idx') || '[]'); } catch { idx = []; }
      idx = idx.filter((x) => x.id !== id); idx.push(meta);
      lsSet('klaps.idx', JSON.stringify(idx));
    },
    load: async (id) => { const s = lsGet('klaps.p.' + id); if (!s) return null; const o = JSON.parse(s); return { plan: o.plan, script: o.script || '', media: o.media || '' }; },
    async remove(id) { lsDel('klaps.p.' + id); try { lsSet('klaps.idx', JSON.stringify(JSON.parse(lsGet('klaps.idx') || '[]').filter((x: ProjectMeta) => x.id !== id))); } catch { /* brak */ } },
  };
}
function memoryBackend(): Backend {
  const mem = new Map<string, { meta: ProjectMeta; raw: Raw }>();
  return {
    name: 'memory',
    list: async () => [...mem.values()].map((m) => m.meta),
    save: async (id, raw, meta) => { mem.set(id, { meta, raw: { ...raw } }); },
    load: async (id) => { const m = mem.get(id); return m ? { ...m.raw } : null; },
    remove: async (id) => { mem.delete(id); },
  };
}

/** przeniesienie projektów z localStorage (wersje 1.x) do IndexedDB – jednorazowo */
async function migrateLocalToIdb(target: Backend) {
  if (lsGet('klaps.migrated.idb')) return 0;
  let idx: ProjectMeta[] = []; try { idx = JSON.parse(lsGet('klaps.idx') || '[]'); } catch { idx = []; }
  let n = 0;
  for (const m of idx) {
    const s = lsGet('klaps.p.' + m.id); if (!s) continue;
    const o = JSON.parse(s);
    await target.save(m.id, { plan: o.plan, script: o.script || '', media: o.media || '' }, m);
    n++;
  }
  // dopiero po udanym przeniesieniu wszystkich projektów zwalniamy miejsce
  for (const m of idx) lsDel('klaps.p.' + m.id);
  lsDel('klaps.idx');
  lsSet('klaps.migrated.idb', String(Date.now()));
  return n;
}

function createStore() {
  let be: Backend = memoryBackend();
  let snaps: SnapBackend = memorySnaps();
  const keys = new Map<string, Key>();
  const encCache = new Map<string, Record<string, [string, string]>>();
  const titles = new Map<string, string>();

  async function init(): Promise<Mode> {
    const d = desktopBackend();
    if (d) be = d; // historia wersji aplikacji na komputer/iPhone trafia do IndexedDB widoku aplikacji
    try {
      if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') {
        const db = await Promise.race([window.claude.use('db'), new Promise((res) => setTimeout(() => res(null), 12000))]);
        if (db) { be = claudeDbBackend(db); snaps = claudeDbSnaps(db); return be.name; }
      }
    } catch { /* dalej */ }
    try {
      if (typeof indexedDB !== 'undefined') {
        const db = await openIdb();
        snaps = idbSnaps(db);
        if (!d) { be = idbBackend(db); await migrateLocalToIdb(be); }
        return be.name;
      }
    } catch { /* np. tryb prywatny bez IndexedDB */ }
    if (d) return be.name;
    try { localStorage.setItem('klaps.t', '1'); localStorage.removeItem('klaps.t'); be = localBackend(); } catch { be = memoryBackend(); }
    return be.name;
  }

  function split(st: ProjectState): Raw {
    const texts: Record<string, string> = {};
    const scenes = st.scenes.map((s) => { const c: any = Object.assign({}, s); texts[s.id] = c.text; delete c.text; return c; });
    const plan: any = Object.assign({}, st, { scenes });
    delete plan.media;
    return { plan: JSON.stringify(plan), script: JSON.stringify(texts), media: JSON.stringify(st.media || {}) };
  }
  function join(planStr: string, scriptStr: string, mediaStr: string): ProjectState {
    const st = JSON.parse(planStr);
    const texts = scriptStr ? JSON.parse(scriptStr) : {};
    st.scenes.forEach((s: any) => { s.text = texts[s.id] || ''; });
    if (mediaStr) { try { st.media = JSON.parse(mediaStr); } catch { st.media = st.media || {}; } }
    return Core.normalize(st);
  }
  const summary = (id: string, st: ProjectState): ProjectMeta => ({ id, title: st.meta.title || '', updatedAt: Date.now(), scenes: st.scenes.length, days: st.days.filter((d) => d.kind === 'shoot').length, demo: !!st.demo });
  function metaFromRaw(id: string, raw: Raw): ProjectMeta {
    if (Vault.isEnc(raw.plan)) return { id, title: '', enc: true, updatedAt: Date.now(), scenes: null, days: null, demo: false };
    try { const st = JSON.parse(raw.plan); return { id, title: (st.meta && st.meta.title) || '', updatedAt: Date.now(), scenes: (st.scenes || []).length, days: (st.days || []).filter((d: any) => (d.kind || 'shoot') === 'shoot').length, demo: !!st.demo }; }
    catch { return { id, title: '', updatedAt: Date.now(), demo: false }; }
  }

  async function sealPart(id: string, name: string, plain: string) {
    const k = keys.get(id)!;
    const c = encCache.get(id) || {};
    const h = hash(plain);
    if (c[name] && c[name][0] === h && Vault.head(c[name][1]).salt === k.salt) return c[name][1];
    const env = await Vault.seal(k, plain, name);
    c[name] = [h, env]; encCache.set(id, c);
    return env;
  }
  async function encrypt(id: string, parts: Raw): Promise<Raw> {
    const media = JSON.parse(parts.media || '{}'), out: Record<string, string> = {};
    for (const mid of Object.keys(media)) out[mid] = await sealPart(id, 'media:' + mid, JSON.stringify(media[mid]));
    return { plan: await sealPart(id, 'plan', parts.plan), script: await sealPart(id, 'script', parts.script), media: JSON.stringify(out) };
  }
  async function decrypt(id: string, raw: Raw): Promise<Raw> {
    const k = keys.get(id);
    if (!k) { const e: any = new Error(T('Projekt jest zaszyfrowany. Podaj hasło, aby go otworzyć.')); e.locked = true; throw e; }
    const c: Record<string, [string, string]> = {};
    const openPart = async (name: string, env: string) => { const p = await Vault.open(k, env, name); c[name] = [hash(p), env]; return p; };
    const plan = await openPart('plan', raw.plan);
    const script = Vault.isEnc(raw.script) ? await openPart('script', raw.script) : raw.script || '{}';
    const mediaRaw = JSON.parse(raw.media || '{}'), media: Record<string, unknown> = {};
    const ids = Object.keys(mediaRaw);
    for (const mid of ids) {
      const v = mediaRaw[mid];
      try { media[mid] = typeof v === 'string' && Vault.isEnc(v) ? JSON.parse(await openPart('media:' + mid, v)) : v; } catch (e: any) { if (e.badKey && mid === ids[0]) throw e; }
    }
    encCache.set(id, c);
    return { plan, script, media: JSON.stringify(media) };
  }

  async function list(): Promise<ProjectMeta[]> {
    const out = (await be.list()).map((m) => (m.enc && titles.has(m.id) ? Object.assign({}, m, { title: titles.get(m.id)! }) : m));
    return out.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }
  async function saveRaw(id: string, raw: Raw, meta?: ProjectMeta) { meta = meta || metaFromRaw(id, raw); await be.save(id, raw, meta); return meta; }
  const loadRaw = (id: string) => be.load(id);

  async function save(id: string, st: ProjectState): Promise<ProjectMeta> {
    let raw = split(st);
    let meta = summary(id, st);
    if (keys.has(id)) {
      raw = await encrypt(id, raw);
      titles.set(id, meta.title);
      meta = { id, title: '', enc: true, updatedAt: meta.updatedAt, scenes: null, days: null, demo: false };
    }
    await saveRaw(id, raw, meta);
    return keys.has(id) ? Object.assign({}, meta, { title: titles.get(id)! }) : meta;
  }
  async function load(id: string): Promise<ProjectState | null> {
    let raw = await loadRaw(id);
    if (!raw) return null;
    if (Vault.isEnc(raw.plan)) raw = await decrypt(id, raw);
    else keys.delete(id);
    const st = join(raw.plan, raw.script, raw.media);
    if (keys.has(id)) titles.set(id, st.meta.title || '');
    return st;
  }
  async function remove(id: string) { keys.delete(id); encCache.delete(id); titles.delete(id); await be.remove(id); await removeSnapshots(id); }

  const isEncrypted = (id: string) => keys.has(id);
  async function unlock(id: string, password: string) {
    const raw = await loadRaw(id);
    if (!raw || !Vault.isEnc(raw.plan)) return true;
    keys.set(id, await Vault.unlock(password, raw.plan, 'plan'));
    return true;
  }
  function lock(id: string) { keys.delete(id); encCache.delete(id); }
  async function encryptProject(id: string, st: ProjectState, password: string) {
    const old = keys.get(id) || null, k = await Vault.create(password);
    keys.set(id, k); encCache.delete(id);
    const meta = await save(id, st);
    await rekeySnapshots(id, old, k); // historia wersji też tylko jako szyfrogram (nowym hasłem)
    return meta;
  }
  async function decryptProject(id: string, st: ProjectState) {
    const old = keys.get(id) || null;
    keys.delete(id); encCache.delete(id); titles.delete(id);
    const meta = await save(id, st);
    await rekeySnapshots(id, old, null);
    return meta;
  }

  /* ---------- historia wersji ---------- */
  async function withKey<R>(k: Key, fn: (tmp: string) => Promise<R>) {
    const tmp = '__k' + Math.random().toString(36).slice(2);
    keys.set(tmp, k);
    try { return await fn(tmp); } finally { keys.delete(tmp); encCache.delete(tmp); }
  }
  const sealRaw = (k: Key, raw: Raw) => withKey(k, (tmp) => encrypt(tmp, raw));
  const openRaw = (k: Key, raw: Raw) => withKey(k, (tmp) => decrypt(tmp, raw));
  const KEEP_AUTO = 30, KEEP_MANUAL = 60;
  async function snapshots(pid: string): Promise<SnapMeta[]> { return (await snaps.list(pid)).sort((a, b) => b.at - a.at); }
  /** zapis wersji projektu (bez mapek – te zostają w projekcie); w zaszyfrowanym projekcie tylko szyfrogram */
  async function snapshot(pid: string, st: ProjectState, label: string, auto: boolean): Promise<SnapMeta | null> {
    const parts = split(st);
    const plain: Raw = { plan: parts.plan, script: parts.script, media: '{}' };
    const h = hash(plain.plan + '|' + plain.script);
    const prev = (await snapshots(pid))[0];
    if (auto && prev && prev.h === h) return null; // nic się nie zmieniło od ostatniej wersji
    const k = keys.get(pid);
    const raw = k ? await sealRaw(k, plain) : plain;
    const row: SnapRow = { id: pid + '~' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), pid, at: Date.now(), label, auto, title: k ? '' : st.meta.title || '', scenes: st.scenes.length, days: st.days.filter((d) => d.kind === 'shoot').length, enc: !!k, size: raw.plan.length + raw.script.length, h, raw };
    await snaps.put(row);
    await pruneSnapshots(pid);
    return strip(row);
  }
  async function pruneSnapshots(pid: string) {
    const list = await snapshots(pid);
    const autos = list.filter((x) => x.auto), manual = list.filter((x) => !x.auto);
    for (const x of [...autos.slice(KEEP_AUTO), ...manual.slice(KEEP_MANUAL)]) await snaps.del(x.id);
  }
  /** stan projektu z wybranej wersji (mapki pochodzą z bieżącego projektu) */
  async function snapshotState(id: string): Promise<ProjectState> {
    const row = await snaps.get(id);
    if (!row) throw new Error(T('Nie znaleziono tej wersji projektu.'));
    let raw = row.raw;
    if (Vault.isEnc(raw.plan)) {
      const k = keys.get(row.pid);
      if (!k) { const e: any = new Error(T('Projekt jest zaszyfrowany. Podaj hasło, aby go otworzyć.')); e.locked = true; throw e; }
      try { raw = await openRaw(k, raw); } catch (e: any) { if (e && e.badKey) throw new Error(T('Ta wersja jest zabezpieczona wcześniejszym hasłem projektu i nie da się jej odczytać.')); throw e; }
    }
    return join(raw.plan, raw.script, '');
  }
  const removeSnapshot = (id: string) => snaps.del(id);
  async function removeSnapshots(pid: string) { for (const x of await snaps.list(pid)) await snaps.del(x.id); }
  async function rekeySnapshots(pid: string, from: Key | null, to: Key | null) {
    for (const m of await snaps.list(pid)) {
      const row = await snaps.get(m.id); if (!row) continue;
      try {
        const plain = Vault.isEnc(row.raw.plan) ? (from ? await openRaw(from, row.raw) : null) : row.raw;
        if (!plain) { await snaps.del(row.id); continue; } // nie da się odczytać – usuwamy, nie zostawiamy jawnych danych
        const raw = to ? await sealRaw(to, { plan: plain.plan, script: plain.script, media: '{}' }) : { plan: plain.plan, script: plain.script, media: '{}' };
        let title = row.title;
        if (!to) { try { title = JSON.parse(plain.plan).meta.title || ''; } catch { title = ''; } }
        await snaps.put(Object.assign({}, row, { raw, enc: !!to, title: to ? '' : title, size: raw.plan.length + raw.script.length }));
      } catch { await snaps.del(row.id); }
    }
  }
  function shareKey(fromId: string, toId: string) { const k = keys.get(fromId); if (k) keys.set(toId, k); }
  async function exportFile(id: string, st: ProjectState) {
    if (!keys.has(id)) return JSON.stringify(st);
    const raw = await encrypt(id, split(st));
    return JSON.stringify({ klaps: 'encrypted-project', v: 1, plan: raw.plan, script: raw.script, media: raw.media });
  }
  /** plik projektu .klaps (zaszyfrowany projekt – tylko szyfrogram) */
  async function exportKlaps(id: string, st: ProjectState) {
    const parts = split(st);
    return keys.has(id) ? writeEncrypted(await encrypt(id, parts)) : writePlain(st, parts);
  }
  const isEncryptedFile = (o: any) => !!(o && o.klaps === 'encrypted-project' && Vault.isEnc(o.plan));
  async function openEncryptedFile(o: Raw, password: string) {
    const k = await Vault.unlock(password, o.plan, 'plan');
    const tmp = '__file';
    keys.set(tmp, k);
    try { const raw = await decrypt(tmp, o); return { st: join(raw.plan, raw.script, raw.media), key: k as Key }; }
    finally { keys.delete(tmp); encCache.delete(tmp); }
  }
  function adoptKey(id: string, k: Key) { keys.set(id, k); encCache.delete(id); }

  return {
    init, list, save, load, remove, split, join, loadRaw, saveRaw, metaFromRaw, hash,
    isEncrypted, unlock, lock, encryptProject, decryptProject, shareKey, exportFile, exportKlaps, isEncryptedFile, openEncryptedFile, adoptKey,
    snapshots, snapshot, snapshotState, removeSnapshot, removeSnapshots, sealRaw, openRaw, keyOf: (id: string) => keys.get(id) || null,
    get mode(): Mode { return be.name; },
    /** do testów: wymuszenie zapisu w pamięci */
    useMemory() { be = memoryBackend(); snaps = memorySnaps(); },
  };
}
export const Store = createStore();
