/* ===== ZAPIS PROJEKTÓW: pliki (aplikacja na komputer) -> db (artefakt) -> localStorage -> pamięć ===== */
const Store = (() => {
  const CHUNK = 60000;
  let mode = 'memory';
  let db = null;
  const mem = new Map();
  const lastHash = new Map(); // projectId -> {plan, script}

  const hash = (s) => { let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return s.length + ':' + h; };
  const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  const lsDel = (k) => { try { localStorage.removeItem(k); } catch (e) { /* brak */ } };

  const desk = () => (typeof window !== 'undefined' && window.klapsDesktop && window.klapsDesktop.store) || null;

  async function init() {
    if (desk()) { mode = 'desktop'; return mode; }
    try {
      if (typeof window !== 'undefined' && window.claude && typeof window.claude.use === 'function') {
        db = await Promise.race([window.claude.use('db'), new Promise((res) => setTimeout(() => res(null), 12000))]);
      }
    } catch (e) { db = null; }
    if (db) mode = 'db';
    else {
      try { localStorage.setItem('klaps.t', '1'); localStorage.removeItem('klaps.t'); mode = 'local'; } catch (e) { mode = 'memory'; }
    }
    return mode;
  }

  function split(st) {
    const texts = {};
    const scenes = st.scenes.map((s) => { const c = Object.assign({}, s); texts[s.id] = c.text; delete c.text; return c; });
    const plan = Object.assign({}, st, { scenes });
    delete plan.media;
    return { plan: JSON.stringify(plan), script: JSON.stringify(texts), media: JSON.stringify(st.media || {}) };
  }
  function join(planStr, scriptStr, mediaStr) {
    const st = JSON.parse(planStr);
    const texts = scriptStr ? JSON.parse(scriptStr) : {};
    st.scenes.forEach((s) => { s.text = texts[s.id] || ''; });
    if (mediaStr) { try { st.media = JSON.parse(mediaStr); } catch (e) { st.media = st.media || {}; } }
    return Core.normalize(st);
  }
  const summary = (id, st) => ({ id, title: st.meta.title || '', updatedAt: Date.now(), scenes: st.scenes.length, days: st.days.filter((d) => d.kind === 'shoot').length, demo: !!st.demo });

  async function list() {
    if (mode === 'desktop') return (await desk().list()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    if (mode === 'db') {
      const snap = await db.collection('projects').get();
      return snap.docs.map((d) => Object.assign({ id: d.id }, d.data())).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }
    if (mode === 'local') { try { return (JSON.parse(lsGet('klaps.idx') || '[]')).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)); } catch (e) { return []; } }
    return [...mem.values()].map((m) => m.meta).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async function writePart(id, name, str, prev) {
    const n = Math.max(1, Math.ceil(str.length / CHUNK));
    for (let i = 0; i < n; i++) await db.doc(`projects/${id}/parts/${name}-${i}`).set({ d: str.slice(i * CHUNK, (i + 1) * CHUNK) });
    for (let i = n; i < (prev || 0); i++) await db.doc(`projects/${id}/parts/${name}-${i}`).delete();
    return n;
  }

  async function save(id, st) {
    const parts = split(st);
    const meta = summary(id, st);
    const lh = lastHash.get(id) || {};
    if (mode === 'desktop') {
      await desk().save(id, meta, parts.plan, parts.script, parts.media);
      return meta;
    }
    if (mode === 'db') {
      const cur = await db.doc('projects/' + id).get();
      const old = cur.exists ? cur.data().parts || {} : {};
      const next = {};
      for (const name of ['plan', 'script', 'media']) next[name] = { n: (old[name] || {}).n || 0, h: (old[name] || {}).h };
      for (const name of ['plan', 'script', 'media']) {
        const h = hash(parts[name]);
        if (lh[name] === h && next[name].h === h) continue;
        next[name] = { n: await writePart(id, name, parts[name], next[name].n), h };
        lh[name] = h;
      }
      await db.doc('projects/' + id).set(Object.assign({}, meta, { parts: next }));
    } else if (mode === 'local') {
      if (!lsSet('klaps.p.' + id, JSON.stringify({ plan: parts.plan, script: parts.script, media: parts.media }))) throw new Error(T('Pamięć przeglądarki jest pełna. Usuń zbędne mapki albo zapisz kopię projektu do pliku.'));
      let idx = []; try { idx = JSON.parse(lsGet('klaps.idx') || '[]'); } catch (e) { idx = []; }
      idx = idx.filter((x) => x.id !== id); idx.push(meta);
      lsSet('klaps.idx', JSON.stringify(idx));
    } else {
      mem.set(id, { meta, plan: parts.plan, script: parts.script, media: parts.media });
    }
    lastHash.set(id, lh);
    return meta;
  }

  async function load(id) {
    if (mode === 'desktop') {
      const o = await desk().load(id); if (!o) return null;
      return join(o.plan, o.script, o.media);
    }
    if (mode === 'db') {
      const d = await db.doc('projects/' + id).get();
      if (!d.exists) return null;
      const p = d.data().parts || {};
      const read = async (name) => {
        const info = p[name]; if (!info || !info.n) return '';
        let s = '';
        for (let i = 0; i < info.n; i++) { const c = await db.doc(`projects/${id}/parts/${name}-${i}`).get(); s += c.exists ? c.data().d : ''; }
        return s;
      };
      const plan = await read('plan'), script = await read('script'), media = await read('media');
      lastHash.set(id, { plan: hash(plan), script: hash(script), media: hash(media) });
      return join(plan, script, media);
    }
    if (mode === 'local') {
      const raw = lsGet('klaps.p.' + id); if (!raw) return null;
      const o = JSON.parse(raw);
      lastHash.set(id, { plan: hash(o.plan), script: hash(o.script), media: hash(o.media || '') });
      return join(o.plan, o.script, o.media);
    }
    const m = mem.get(id);
    return m ? join(m.plan, m.script, m.media) : null;
  }

  async function remove(id) {
    lastHash.delete(id);
    if (mode === 'desktop') { await desk().remove(id); return; }
    if (mode === 'db') {
      const d = await db.doc('projects/' + id).get();
      const p = d.exists ? d.data().parts || {} : {};
      for (const name of ['plan', 'script', 'media']) for (let i = 0; i < ((p[name] || {}).n || 0); i++) await db.doc(`projects/${id}/parts/${name}-${i}`).delete();
      await db.doc('projects/' + id).delete();
    } else if (mode === 'local') {
      lsDel('klaps.p.' + id);
      try { lsSet('klaps.idx', JSON.stringify(JSON.parse(lsGet('klaps.idx') || '[]').filter((x) => x.id !== id))); } catch (e) { /* brak */ }
    } else mem.delete(id);
  }

  return { init, list, save, load, remove, get mode() { return mode; }, split, join };
})();
if (typeof module !== 'undefined') module.exports = Store;
