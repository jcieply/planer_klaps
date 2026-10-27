// @ts-nocheck
/* Moduł przeniesiony z wersji 1.x (logika bez zmian). */
import { T, T_ } from './i18n';
import { Zip } from './zip';
import { Core } from './core';
import { decodeText, loadScript } from './files';
/* ===== TABELE: odczyt XLSX / CSV / XLS (import shotlisty) i rozpoznawanie kolumn ===== */
const Table = (() => {
  const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  const unxml = (s) => String(s || '').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => (e[0] === '#' ? String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : +e.slice(1)) : ENT[e.toLowerCase()]));
  const textOf = (xml) => { let out = ''; xml.replace(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g, (m, t) => { out += t; return m; }); return unxml(out); };
  const colIndex = (ref) => { const m = /^([A-Z]+)/.exec(ref || ''); if (!m) return -1; let n = 0; for (const ch of m[1]) n = n * 26 + (ch.charCodeAt(0) - 64); return n - 1; };
  const numStr = (v) => { const n = +v; if (!isFinite(n)) return String(v); return Number.isInteger(n) ? String(n) : String(Math.round(n * 1e9) / 1e9); };

  /* ---------- XLSX ---------- */
  async function readXlsx(bytes) {
    const z = Zip.read(bytes);
    const wb = await z.text('xl/workbook.xml');
    if (!wb) throw new Error(T('To nie jest poprawny plik Excel (XLSX).'));
    const rels = (await z.text('xl/_rels/workbook.xml.rels')) || '';
    const relMap = {};
    rels.replace(/<Relationship\b[^>]*>/g, (tag) => { const id = /Id="([^"]+)"/.exec(tag), tg = /Target="([^"]+)"/.exec(tag); if (id && tg) relMap[id[1]] = tg[1]; return tag; });
    const sst = [];
    const ss = await z.text('xl/sharedStrings.xml');
    if (ss) ss.replace(/<si>([\s\S]*?)<\/si>/g, (m, inner) => { sst.push(textOf(inner)); return m; });
    const sheets = [];
    const list = [];
    wb.replace(/<sheet\b[^>]*>/g, (tag) => { const nm = /name="([^"]*)"/.exec(tag), rid = /r:id="([^"]+)"/.exec(tag) || /\bid="([^"]+)"/.exec(tag); list.push({ name: unxml(nm ? nm[1] : 'Arkusz'), rid: rid ? rid[1] : '' }); return tag; });
    for (let i = 0; i < list.length; i++) {
      let target = relMap[list[i].rid] || `worksheets/sheet${i + 1}.xml`;
      target = target.replace(/^\/?xl\//, '').replace(/^\//, '');
      const xml = await z.text('xl/' + target);
      if (!xml) continue;
      const rows = [];
      xml.replace(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g, (m, ra, body) => {
        const rn = /\br="(\d+)"/.exec(ra);
        const ri = rn ? +rn[1] - 1 : rows.length;
        const row = [];
        (body || '').replace(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g, (mc, ca, cb) => {
          const ref = /\br="([A-Z]+\d+)"/.exec(ca), t = /\bt="([^"]+)"/.exec(ca);
          const ci = ref ? colIndex(ref[1]) : row.length;
          const type = t ? t[1] : 'n';
          const vm = /<v>([\s\S]*?)<\/v>/.exec(cb || '');
          let v = '';
          if (type === 's') v = vm ? sst[+vm[1]] || '' : '';
          else if (type === 'inlineStr') v = textOf(cb || '');
          else if (type === 'b') v = vm ? (vm[1] === '1' ? 'TRUE' : 'FALSE') : '';
          else if (type === 'str' || type === 'e') v = vm ? unxml(vm[1]) : '';
          else v = vm ? { n: +vm[1], s: numStr(vm[1]) } : '';
          row[ci] = v;
          return mc;
        });
        rows[ri] = row;
        return m;
      });
      for (let r = 0; r < rows.length; r++) rows[r] = rows[r] || [];
      sheets.push({ name: list[i].name, rows: rows.map((r) => Array.from(r, (c) => (c == null ? '' : c))) });
    }
    if (!sheets.length) throw new Error(T('W pliku nie znaleziono arkuszy z danymi.'));
    return sheets;
  }

  /* ---------- CSV / TSV ---------- */
  function parseCsv(text) {
    text = String(text || '').replace(/^﻿/, '');
    const first = text.split(/\r?\n/).find((l) => l.trim()) || '';
    const counts = [';', ',', '\t', '|'].map((d) => [d, first.split(d).length - 1]).sort((a, b) => b[1] - a[1]);
    const D = counts[0][1] > 0 ? counts[0][0] : ',';
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"' && cell === '') q = true;
      else if (ch === D) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((c) => String(c).trim() !== ''));
  }

  /* ---------- XLS (stary format Excela): czytnik SheetJS ładowany na żądanie ---------- */
  const SHEETJS = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
  async function readXls(bytes) {
    if (!window.XLSX) {
      try { await loadScript(SHEETJS); } catch (e) { throw new Error(T('Nie udało się wczytać modułu do starych plików XLS. Zapisz plik w Excelu jako XLSX albo CSV i spróbuj ponownie.')); }
    }
    if (!window.XLSX) throw new Error(T('Nie udało się wczytać modułu do starych plików XLS. Zapisz plik w Excelu jako XLSX albo CSV i spróbuj ponownie.'));
    const wb = window.XLSX.read(bytes, { type: 'array' });
    return wb.SheetNames.map((n) => ({ name: n, rows: window.XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: '' }).map((r) => r.map((c) => (typeof c === 'number' ? { n: c, s: numStr(c) } : c == null ? '' : String(c)))) }));
  }

  async function readFile(file) {
    const name = (file.name || '').toLowerCase();
    const buf = new Uint8Array(await file.arrayBuffer());
    const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
    const isOle = buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0;
    let sheets;
    if (isZip || /\.xlsx$|\.xlsm$/.test(name)) sheets = await readXlsx(buf);
    else if (isOle || /\.xls$/.test(name)) sheets = await readXls(buf);
    else if (/\.(csv|tsv|txt)$/.test(name) || !name.includes('.')) sheets = [{ name: 'CSV', rows: parseCsv(decodeText(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))) }];
    else throw new Error(T('Nieobsługiwany format pliku. Wybierz XLSX, XLS albo CSV.'));
    sheets = sheets.map((s) => ({ name: s.name, rows: s.rows.filter((r) => r.some((c) => cellStr(c).trim() !== '')) })).filter((s) => s.rows.length);
    if (!sheets.length) throw new Error(T('Plik nie zawiera danych.'));
    return { file: file.name, sheets };
  }
  const cellStr = (c) => (c && typeof c === 'object' ? c.s : String(c == null ? '' : c));

  /* ---------- kolumny shotlisty ---------- */
  const FIELDS = [
    ['scene', T_('Scena'), ['sc', 'scena', 'scene', 'nr sceny', 'numer sceny', 'scene no', 'scene number', 'scene nr', 'sc nr', 'sc no']],
    ['shot', T_('Ujęcie'), ['ujecie', 'uj', 'shot', 'nr ujecia', 'numer ujecia', 'shot no', 'shot number', 'shot nr', 'setup', 'ujecie nr']],
    ['type', T_('Typ planu'), ['typ planu', 'plan', 'typ', 'wielkosc planu', 'shot type', 'shot size', 'size', 'framing', 'kadr', 'type']],
    ['desc', T_('Opis'), ['opis', 'description', 'akcja', 'action', 'opis ujecia', 'shot description', 'tresc', 'subject']],
    ['lens', T_('Obiektyw'), ['obiektyw', 'lens', 'ogniskowa', 'focal length', 'focal', 'mm']],
    ['grip', 'Grip', ['grip', 'mocowanie', 'ruch kamery', 'camera movement', 'movement', 'support', 'rig', 'sprzet', 'ruch', 'camera support', 'kamera']],
    ['eta', 'ETA', ['eta', 'czas', 'czas realizacji', 'time', 'duration', 'est time', 'estimated time', 'min', 'minuty', 'czas min']],
    ['cast', T_('Aktorzy'), ['aktorzy', 'obsada', 'cast', 'postacie', 'postac', 'characters', 'actors', 'talent', 'aktor']],
    ['site', T_('Lokacja'), ['lokacja', 'lokalizacja', 'location', 'obiekt', 'plan zdjeciowy', 'set', 'miejsce', 'lokacje', 'locations']],
    ['notes', T_('Uwagi'), ['uwagi', 'notes', 'note', 'komentarz', 'comments', 'uwagi dodatkowe', 'info']],
  ];
  const norm = (s) => cellStr(s).toLowerCase().replace(/ł/g, 'l').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[#.:()\[\]/_\-–]+/g, ' ').replace(/\s+/g, ' ').trim();
  function scoreHeader(h) {
    const n = norm(h); if (!n) return {};
    const out = {};
    FIELDS.forEach(([k, , syn]) => {
      let best = 0;
      syn.forEach((x) => {
        if (n === x) best = Math.max(best, 3);
        else if (n.split(' ').includes(x) || (x.includes(' ') && n.includes(x))) best = Math.max(best, x.length > 3 ? 2 : 1);
      });
      if (best) out[k] = best;
    });
    return out;
  }
  /** wiersz nagłówka: pierwszy z co najmniej dwiema rozpoznanymi kolumnami (w pierwszych 15 wierszach) */
  function findHeader(rows) {
    let best = 0, bestN = 0;
    for (let r = 0; r < Math.min(15, rows.length); r++) {
      const n = rows[r].filter((c) => Object.keys(scoreHeader(c)).length).length;
      if (n > bestN) { bestN = n; best = r; }
      if (n >= 4) break;
    }
    return bestN >= 2 ? best : 0;
  }
  function guessMap(header) {
    const cand = [];
    header.forEach((h, ci) => Object.entries(scoreHeader(h)).forEach(([k, sc]) => cand.push({ k, ci, sc })));
    cand.sort((a, b) => b.sc - a.sc || a.ci - b.ci);
    const map = {}, used = new Set();
    cand.forEach(({ k, ci }) => { if (map[k] == null && !used.has(ci)) { map[k] = ci; used.add(ci); } });
    FIELDS.forEach(([k]) => { if (map[k] == null) map[k] = -1; });
    return map;
  }

  const TYPE_WORDS = [
    ['DET', ['det', 'detal', 'detail', 'ecu', 'xcu', 'extreme close', 'bardzo duze zblizenie', 'makro', 'insert']],
    ['MCU', ['mcu', 'polzblizenie', 'medium close', 'med close', 'srednie zblizenie']],
    ['CU', ['cu', 'zblizenie', 'close up', 'closeup', 'close', 'duze zblizenie', 'bcu']],
    ['MFS', ['mfs', 'amerykanski', 'plan amerykanski', 'cowboy', 'medium full', 'american', 'mls', 'medium long']],
    ['MS', ['ms', 'sredni', 'plan sredni', 'medium', 'mid', 'med']],
    ['FS', ['fs', 'pelny', 'plan pelny', 'full', 'full shot', 'ls', 'long shot', 'cala postac']],
    ['WS', ['ws', 'ogolny', 'plan ogolny', 'wide', 'wide shot', 'els', 'ews', 'establishing', 'totalny', 'total', 'plan totalny', 'master']],
  ];
  function typeCode(v) {
    const n = norm(v); if (!n) return '';
    for (const [code, words] of TYPE_WORDS) if (words.includes(n)) return code;
    for (const [code, words] of TYPE_WORDS) if (words.some((w) => w.length > 2 && n.includes(w))) return code;
    return null;
  }
  const sceneKey = (v) => cellStr(v).toUpperCase().replace(/^\s*(SC\.?|SCENA|SCENE|NR)\s*/, '').replace(/\s+/g, '').replace(/\.$/, '');
  function etaOf(c) {
    if (c && typeof c === 'object') { const n = c.n; if (n > 0 && n < 1) return Core.fmtHM(Math.round(n * 1440)); return c.s; }
    return cellStr(c).trim();
  }

  /** mapowanie wierszy na ujęcia (bez zmiany stanu): { shots, newScenes, matched, skipped } */
  function preview(st, rows, headerRow, map, o = {}) {
    const get = (r, k) => (map[k] >= 0 ? r[map[k]] : '');
    const sk = new Map(st.scenes.map((s) => [sceneKey(s.num), s]));
    const out = [], newScenes = new Map();
    let matched = 0, skipped = 0, noScene = 0;
    rows.slice(headerRow + 1).forEach((r) => {
      const vals = {};
      FIELDS.forEach(([k]) => { vals[k] = k === 'eta' ? etaOf(get(r, k)) : cellStr(get(r, k)).trim(); });
      if (!FIELDS.some(([k]) => k !== 'scene' && vals[k]) && !vals.scene) { skipped++; return; }
      if (!vals.desc && !vals.type && !vals.shot && !vals.lens && !vals.grip && !vals.eta) { skipped++; return; }
      const key = sceneKey(vals.scene);
      let sc = key ? sk.get(key) : null, isNew = false;
      if (sc) matched++;
      else if (key && o.create !== false) { isNew = true; if (!newScenes.has(key)) newScenes.set(key, { num: cellStr(vals.scene).trim().replace(/^\s*(sc\.?|scena|scene|nr)\s*/i, ''), site: vals.site }); }
      else noScene++;
      let type = vals.type ? typeCode(vals.type) : '';
      let desc = vals.desc;
      if (type === null) { desc = [vals.type, desc].filter(Boolean).join(' – '); type = ''; }
      if (vals.notes) desc = desc ? `${desc} (${vals.notes})` : vals.notes;
      out.push({ sceneKey: key, sceneId: sc ? sc.id : '', isNew, num: sc ? sc.num : key ? (newScenes.get(key) || {}).num : '', shot: vals.shot, type, desc, lens: vals.lens, grip: vals.grip, eta: vals.eta, cast: vals.cast, site: vals.site });
    });
    return { shots: out, newScenes: [...newScenes.values()], matched, skipped, noScene };
  }

  /** zapis do projektu: dopisanie albo zastąpienie shotlisty, opcjonalnie nowe sceny */
  function apply(st, pv, o = {}) {
    const keyMap = new Map(st.scenes.map((s) => [sceneKey(s.num), s]));
    pv.newScenes.forEach((ns) => {
      const key = sceneKey(ns.num);
      if (keyMap.has(key)) return;
      const sc = { id: Core.uid(), num: ns.num, ie: 'INT', place: ns.site || '', site: ns.site || '', tod: 'DAY', eighths: 8, page: null, synopsis: '', notes: T('Scena dodana z importu shotlisty'), cast: [], elements: {}, text: '', heading: '' };
      st.scenes.push(sc); keyMap.set(key, sc);
      if (sc.site && !st.sites[sc.site]) st.sites[sc.site] = Core.siteEntry();
    });
    if (o.mode === 'replace') {
      st.shots = [];
      Object.values(st.sheets || {}).forEach((sh) => { if (Array.isArray(sh.srows)) sh.srows = sh.srows.filter((r) => r.kind !== 'shot'); });
    }
    const cm = Core.castMap(st);
    let n = 0;
    pv.shots.forEach((x) => {
      const sc = x.sceneKey ? keyMap.get(x.sceneKey) : null;
      const shot = { id: Core.uid(), sceneId: sc ? sc.id : '', shot: x.shot || (sc ? Core.nextShotNo(st, sc.id) : ''), type: x.type || '', desc: !sc && x.sceneKey ? `[${T('Sc.')} ${x.sceneKey}] ${x.desc || ''}`.trim() : x.desc || '', lens: x.lens || '', grip: x.grip || '', eta: x.eta || '',
        cast: x.cast || (sc ? sc.cast.map((id) => (cm.get(id) || {}).name).filter(Boolean).join(', ') : ''), site: x.site || (sc ? sc.site || sc.place || '' : '') };
      st.shots.push(shot); n++;
    });
    return n;
  }

  return { readFile, parseCsv, readXlsx, FIELDS, findHeader, guessMap, preview, apply, cellStr, typeCode, norm };
})();
export { Table };
