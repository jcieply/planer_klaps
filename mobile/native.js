/* ===== Klaps Planer na iOS (Capacitor): projekty jako pliki w Dokumentach aplikacji, eksporty przez arkusz udostępniania ===== */
(() => {
  const C = window.Capacitor;
  if (!C || !C.isNativePlatform || !C.isNativePlatform()) return;
  const FS = C.registerPlugin('Filesystem');
  const Share = C.registerPlugin('Share');
  const DIR = 'DOCUMENTS', ROOT = 'Projekty';
  const SAFE = /^[A-Za-z0-9_-]{1,80}$/;
  const fileOf = (id) => { if (!SAFE.test(String(id))) throw new Error('Niepoprawny identyfikator projektu'); return ROOT + '/' + id + '.klaps.json'; };
  let ready = null;
  const ensure = () => ready || (ready = FS.mkdir({ path: ROOT, directory: DIR, recursive: true }).catch(() => null));
  const exists = (path) => FS.stat({ path, directory: DIR }).then(() => true, () => false);
  const readJson = async (path) => JSON.parse((await FS.readFile({ path, directory: DIR, encoding: 'utf8' })).data);
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const safeName = (n) => String(n || 'plik').replace(/[\\/:*?"<>|]/g, '_');

  window.klapsDesktop = {
    platform: 'ios',
    pdfjsBase: 'vendor/pdfjs/',
    store: {
      async list() {
        await ensure();
        const r = await FS.readdir({ path: ROOT, directory: DIR });
        const out = [];
        for (const f of r.files || []) {
          const name = typeof f === 'string' ? f : f.name;
          if (!name || !name.endsWith('.klaps.json')) continue;
          try { const o = await readJson(ROOT + '/' + name); if (o && o.meta && o.id) out.push(o.meta); } catch (e) { /* uszkodzony plik pomijamy */ }
        }
        return out;
      },
      async save(id, meta, plan, script, media) {
        await ensure();
        const path = fileOf(id), tmp = path + '.tmp';
        await FS.writeFile({ path: tmp, directory: DIR, encoding: 'utf8', data: JSON.stringify({ format: 'klaps-planer', version: 2, id, meta, plan, script, media: media || '{}' }) });
        if (await exists(path)) {
          try { await FS.deleteFile({ path: path.replace(/\.klaps\.json$/, '.bak'), directory: DIR }); } catch (e) { /* brak kopii */ }
          await FS.rename({ from: path, to: path.replace(/\.klaps\.json$/, '.bak'), directory: DIR });
        }
        await FS.rename({ from: tmp, to: path, directory: DIR });
        return true;
      },
      async load(id) {
        const path = fileOf(id);
        if (!(await exists(path))) return null;
        const o = await readJson(path);
        return { plan: o.plan, script: o.script, media: o.media || '' };
      },
      async remove(id) {
        const path = fileOf(id);
        if (await exists(path)) await FS.deleteFile({ path, directory: DIR });
        return true;
      },
    },
    /** PDF / Excel / kopia .json: zapis do pamięci podręcznej i systemowy arkusz „Udostępnij” (Zapisz w Plikach, AirDrop, Mail…) */
    async saveFile(name, data) {
      const u8 = typeof data === 'string' ? new TextEncoder().encode(data) : data instanceof Uint8Array ? data : new Uint8Array(data);
      const path = 'eksport/' + safeName(name);
      await FS.writeFile({ path, directory: 'CACHE', data: b64(u8), recursive: true });
      const { uri } = await FS.getUri({ path, directory: 'CACHE' });
      try { await Share.share({ title: name, url: uri, dialogTitle: name }); }
      catch (e) { if (/cancel/i.test(String(e && (e.message || e)))) return { canceled: true }; throw e; }
      return { canceled: false };
    },
    onMenu() { /* brak menu na iOS */ },
  };
  document.documentElement.classList.add('native-ios');
})();
