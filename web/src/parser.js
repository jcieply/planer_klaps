/* ===== PARSER SCENARIUSZA: tekst / Fountain / FDX / DOCX / PDF -> sceny, obsada, ósemki stron ===== */
const Parser = (() => {
  const UC = 'A-ZĄĆĘŁŃÓŚŹŻ';
  const LC = 'a-ząćęłńóśźż';
  const L = '\\p{L}';

  const IE_TOK = '(?:INT\\.?\\s*\\/\\s*EXT|EXT\\.?\\s*\\/\\s*INT|WN\\.?\\s*\\/\\s*ZN|ZN\\.?\\s*\\/\\s*WN|WN\\.?\\s*\\/\\s*PLENER|PLENER\\s*\\/\\s*WN|INT|EXT|I\\s*\\/\\s*E|E\\s*\\/\\s*I|WNĘTRZE|WNETRZE|WEWNĄTRZ|WEWNATRZ|WEWN|WN|ZEWNĘTRZE|ZEWNETRZE|ZEWNĄTRZ|ZEWNATRZ|ZEWN|ZN|PLENERY|PLENER)';
  const HEAD_RE = new RegExp('^\\s*(?:(?:SCENA|SCENE|SC|SCN)\\.?\\s*)?(?:(\\d+[A-Z]?)\\s*[.):\\-–—]*\\s*)?(' + IE_TOK + ')(?!' + L + ')\\.?\\s*(.*)$', 'iu');
  const SCENA_RE = /^\s*(?:SCENA|SCENE|SC\.?)\s*(\d+[A-Z]?)\s*[.:)\-–—]*\s*(.*)$/iu;
  const TODW = 'DZIEŃ|DZIEN|NOC|ŚWITANIE|SWITANIE|ŚWIT|SWIT|ZMIERZCH|WIECZÓR|WIECZOR|WIECZOREM|RANO|RANEK|PORANEK|POPOŁUDNIE|POPOLUDNIE|POŁUDNIE|POLUDNIE|ZMROK|DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|AFTERNOON|NOON|SUNSET|SUNRISE|TWILIGHT|LATER|CONTINUOUS|CONT\'D|CIĄGŁE|CIAGLE|DALEJ|SAME TIME|SAME|MOMENTS LATER';
  const TOD_END = new RegExp('[\\s.,;:\\-–—/]*(?<!' + L + ')(' + TODW + ')(?!' + L + ')(?:\\s*[\\/,]\\s*(?:' + TODW + '))?\\s*(?:\\(([^)]*)\\))?[\\s.]*$', 'iu');
  const NUMC_RE = new RegExp('^\\s*(\\d+[A-Z]?)\\s*[.)]\\s+([' + UC + '0-9][^a-z]{2,70}?)[\\s.,\\-–—/]+(' + TODW + ')\\s*\\.?\\s*$', 'u');

  const TOD_MAP = (w) => {
    w = w.toUpperCase();
    if (/^(DZIEŃ|DZIEN|DAY|RANO|RANEK|PORANEK|POPOŁUDNIE|POPOLUDNIE|POŁUDNIE|POLUDNIE|MORNING|AFTERNOON|NOON)$/.test(w)) return 'DAY';
    if (/^(NOC|NIGHT)$/.test(w)) return 'NIGHT';
    if (/^(ŚWITANIE|SWITANIE|ŚWIT|SWIT|DAWN|SUNRISE)$/.test(w)) return 'DAWN';
    if (/^(ZMIERZCH|WIECZÓR|WIECZOR|WIECZOREM|ZMROK|DUSK|EVENING|SUNSET|TWILIGHT)$/.test(w)) return 'DUSK';
    return 'CONT';
  };
  const IE_MAP = (tok) => {
    const t = tok.toUpperCase().replace(/\s+/g, '').replace(/\./g, '');
    if (/\//.test(t)) return 'INT/EXT';
    if (/^(INT|WN|WNĘTRZE|WNETRZE|WEWN|WEWNĄTRZ|WEWNATRZ)$/.test(t)) return 'INT';
    return 'EXT';
  };

  function parseHeading(text) {
    let s = String(text).trim();
    let forced = false;
    if (/^\.[^.]/.test(s)) { s = s.slice(1).trim(); forced = true; }
    let trailNum = null;
    let m = s.match(/\s+#([\w.\-]+)#\s*$/);
    if (m) { trailNum = m[1]; s = s.slice(0, m.index).trim(); }
    else if ((m = s.match(/\s{2,}(\d+[A-Z]?)\s*$/))) { trailNum = m[1]; s = s.slice(0, m.index).trim(); }
    s = s.replace(/\s{2,}/g, ' ');
    let num = null, ie = '', rest = '', hit = false;
    const hm = s.match(HEAD_RE);
    if (hm) {
      const tokRaw = hm[2];
      const prefixed = hm[1] || /^\s*(?:SCENA|SCENE|SC|SCN)/i.test(s);
      const upperTok = tokRaw === tokRaw.toUpperCase();
      const at = s.toUpperCase().indexOf(tokRaw.toUpperCase());
      const punct = /^\s*[.\-–—:]/.test(s.slice(at + tokRaw.length));
      const todEnd = TOD_END.test(s) && punct && s.length < 90;
      if (upperTok || prefixed || forced || todEnd) {
        hit = true; num = hm[1] || null; ie = IE_MAP(tokRaw); rest = hm[3] || '';
      }
    }
    if (!hit) {
      const sm = s.match(SCENA_RE);
      if (sm) { hit = true; num = sm[1]; ie = ''; rest = sm[2] || ''; }
    }
    if (!hit) {
      const cm = s.match(NUMC_RE);
      if (cm) { hit = true; num = cm[1]; ie = ''; rest = cm[2] + ' ' + cm[3]; }
    }
    if (!hit && forced) { hit = true; rest = s; }
    if (!hit) return null;
    if (!num && trailNum) num = trailNum;
    if (num && trailNum && num.toUpperCase() !== trailNum.toUpperCase() && !/^\d+[A-Z]?$/.test(trailNum)) num = num;
    rest = rest.replace(/^[\s.\-–—:,]+/, '');
    let tod = '', todLabel = '', note = '';
    const tm = rest.match(TOD_END);
    if (tm) {
      todLabel = tm[1].toUpperCase();
      tod = TOD_MAP(tm[1]);
      note = (tm[2] || '').trim();
      rest = rest.slice(0, tm.index);
    }
    rest = rest.replace(/[\s.\-–—:,]+$/, '').trim();
    const segs = rest.split(/\s+[-–—]\s+|\s*\/\s*|,\s+|(?<=\p{L}{4,})\.\s+/u).map((x) => x.trim()).filter(Boolean);
    const place = segs.join(' – ');
    const site = segs[0] || '';
    return { num, ie, place: place.toUpperCase(), site: site.toUpperCase(), tod, todLabel, note, raw: String(text).trim() };
  }

  const STOP = /^(CUT TO|CUT|FADE IN|FADE OUT|FADE TO|DISSOLVE|SMASH CUT|MATCH CUT|WIPE|CIĘCIE|CIECIE|PRZEJŚCIE|PRZEJSCIE|ŚCIEMNIENIE|SCIEMNIENIE|ROZJAŚNIENIE|ROZJASNIENIE|NAPŁYW|NAPLYW|KONIEC|THE END|CIĄG DALSZY|CIAG DALSZY|CONTINUED|CONT'D|MORE|DALEJ|NAPISY|TYTUŁ|TYTUL|SUPER|INSERT|FLASHBACK|WSPOMNIENIE|MONTAŻ|MONTAZ|POWRÓT|POWROT|UWAGA|UWAGI|NOTATKA|TŁO|TLO|CZOŁÓWKA|CZOLOWKA|GENERIC|PRZERWA|ANTRAKT|EPILOG|PROLOG|AKT|CZĘŚĆ|CZESC)\b/u;
  const TRANS_RE = /^(?:>|FADE (?:IN|OUT|TO)|CUT TO|DISSOLVE|SMASH CUT|MATCH CUT|WIPE TO|CIĘCIE|PRZEJŚCIE|ŚCIEMNIENIE|ROZJAŚNIENIE|NAPŁYW|KONIEC)/u;
  const CONT_RE = /^\(?\s*(?:CONTINUED|CONT'D|CIĄG DALSZY|CIAG DALSZY|DALEJ|MORE|CD\.?|C\.D\.?|CIĄG DALSZY NASTĄPI)\s*[:.]?\s*(?:\(?\d+\)?)?\s*\)?$/iu;

  function cueName(s) {
    let t = String(s).trim().replace(/\s*\^$/, '').replace(/^@/, '');
    const base = t.replace(/\s*\([^)]*\)\s*/g, ' ').replace(/[:\s]+$/, '').replace(/\s+/g, ' ').trim();
    if (base.length < 2 || base.length > 36) return null;
    if (base !== base.toUpperCase() || !/[A-ZĄĆĘŁŃÓŚŹŻ]/.test(base)) return null;
    if (/[.!?…,;]$/.test(base) && !/(^|\s)(DR|MGR|PROF|ŚP|KS|ST|SIOSTRA|ŚW)\.$/.test(base)) return null;
    if (/^[\d\W]+$/.test(base)) return null;
    if (STOP.test(base) || TRANS_RE.test(base)) return null;
    if (base.split(' ').length > 4) return null;
    if (/\bTO:?$/.test(base)) return null;
    return base;
  }

  const stripCueName = (n) => n.replace(/[.]+$/, '').trim();

  /* ---------- klasyfikacja linii -> elementy ---------- */
  function classify(lines, opts) {
    const pageW = opts.pageW || 595;
    const nb = lines.filter((l) => !l.blank);
    const xs = nb.map((l) => l.x).filter((x) => x != null);
    let margin = 0, structure = false, cueIndented = false;
    if (xs.length > 20) {
      const hist = new Map();
      for (const x of xs) { const k = Math.round(x / 3) * 3; hist.set(k, (hist.get(k) || 0) + 1); }
      margin = [...hist.entries()].sort((a, b) => b[1] - a[1])[0][0];
      const indented = xs.filter((x) => x - margin > 0.07 * pageW).length;
      structure = indented / xs.length > 0.12;
      if (structure) {
        const capsDeep = nb.filter((l) => l.x != null && l.x - margin > 0.12 * pageW && cueName(l.t)).length;
        cueIndented = capsDeep >= 3;
      }
    }
    const els = [];
    let inDlg = false;
    let prevBlank = true;
    let prevType = 'B';
    for (let i = 0; i < lines.length; i++) {
      const ln = lines[i];
      if (ln.blank) { els.push({ type: 'B', t: '', page: ln.page }); inDlg = false; prevBlank = true; prevType = 'B'; continue; }
      const t = ln.t.replace(/\s+$/, '');
      const s = t.trim();
      if (!s || CONT_RE.test(s)) { continue; }
      const rel = ln.x != null ? ln.x - margin : 0;
      const para = !!ln.para;
      const next = lines[i + 1];
      const nextHas = next && !next.blank && next.t.trim();
      let type = null, name = null;
      const hd = parseHeading(s);
      if (hd && (hd.ie || hd.tod || hd.num) && (s === s.toUpperCase() || hd.ie || /^\.[^.]/.test(s))) {
        type = 'H';
      } else if (TRANS_RE.test(s) && s === s.toUpperCase() && s.length < 40) {
        type = 'T';
      } else if (inDlg) {
        type = /^\(/.test(s) ? 'P' : 'D';
      } else {
        const cn = cueName(s);
        const blankOk = prevBlank || para || prevType === 'H';
        let ok = !!cn && nextHas && blankOk && !parseHeading(next.t);
        if (ok && cueIndented) ok = rel > 0.1 * pageW;
        else if (ok && structure && rel < 0.04 * pageW && nextHas && next.x != null && next.x - margin < 0.04 * pageW) ok = false; // NAPIS CAPS bez wcięcia, a dialog też bez
        if (ok) { type = 'C'; name = cn; }
        else {
          const cm = s.match(new RegExp('^([' + UC + '][' + UC + '0-9 \'\\-.]{1,28}):\\s+(\\S.*)$', 'u'));
          if (cm && cueName(cm[1]) && !parseHeading(s)) {
            els.push({ type: 'C', t: cm[1], name: cueName(cm[1]), page: ln.page, x: ln.x });
            els.push({ type: 'D', t: cm[2], page: ln.page, x: ln.x });
            inDlg = true; prevBlank = false; prevType = 'D';
            continue;
          }
          type = 'A';
        }
      }
      if (type === 'H') inDlg = false;
      if (type === 'C') inDlg = true;
      if (type === 'T' || type === 'A') inDlg = false;
      els.push({ type, t: s, page: ln.page, x: ln.x, name, hd: type === 'H' ? hd : undefined, para });
      prevBlank = false; prevType = type;
    }
    return els;
  }

  /* ---------- składanie scen z elementów ---------- */
  const WIDTH = { A: 60, D: 35, P: 28, C: 36, T: 20, H: 60 };

  function elLines(el) {
    return Math.max(1, Math.ceil(el.t.length / WIDTH[el.type]));
  }

  function assemble(els, opts) {
    const lpp = opts.linesPerPage || 55;
    const per8 = lpp / 8;
    const scenes = [];
    let cur = null;
    const front = [];
    let cum = 0; // skumulowane linie (do szacowania numeru strony)
    let lastNum = 0;
    let pendingBlank = false;
    const seenNums = new Map();

    // wstaw pustą linię po akapitach (tryb akapitowy)
    const flat = [];
    for (let i = 0; i < els.length; i++) {
      flat.push(els[i]);
      const e = els[i], n = els[i + 1];
      if (e.para && e.type !== 'B' && n && n.type !== 'B' && !(['C', 'D', 'P'].includes(e.type) && ['D', 'P'].includes(n.type))) flat.push({ type: 'B', t: '', synthetic: true });
    }

    for (const e of flat) {
      if (e.type === 'H') {
        const hd = e.hd;
        let num = hd.num;
        if (num) { const n = parseInt(num, 10); if (!isNaN(n)) lastNum = n; }
        else { lastNum += 1; num = String(lastNum); }
        if (seenNums.has(num)) opts._dupNums = (opts._dupNums || 0) + 1;
        seenNums.set(num, 1);
        cur = { num, ie: hd.ie, place: hd.place, site: hd.site, tod: hd.tod, todLabel: hd.todLabel, note: hd.note, heading: hd.raw, lines: 2, page: e.page || null, estPage: Math.floor(cum / lpp) + 1, els: [], castSet: new Map(), dlg: 0 };
        scenes.push(cur);
        cum += 2; pendingBlank = false;
        continue;
      }
      if (!cur) { front.push(e); continue; }
      if (e.type === 'B') { pendingBlank = true; continue; }
      if (pendingBlank) { cur.lines += 1; cum += 1; }
      e.afterBlank = pendingBlank;
      pendingBlank = false;
      const n = elLines(e);
      cur.lines += n; cum += n;
      cur.els.push(e);
      if (e.type === 'C') {
        const nm = stripCueName(e.name);
        cur.castSet.set(nm, (cur.castSet.get(nm) || 0) + 1);
        cur.dlg += 1;
      }
    }

    // godz. dnia "ciągłe" dziedziczą po poprzedniej scenie
    let prevTod = 'DAY';
    for (const sc of scenes) {
      if (sc.tod === 'CONT' || !sc.tod) sc.tod = prevTod;
      prevTod = sc.tod;
    }

    // obsada w kolejności pierwszego wystąpienia
    const castMap = new Map();
    for (const sc of scenes) for (const [nm, c] of sc.castSet) {
      if (!castMap.has(nm)) castMap.set(nm, { name: nm, scenes: 0, lines: 0 });
      const cm = castMap.get(nm); cm.scenes += 1; cm.lines += c;
    }
    // postacie wzmiankowane w opisie akcji
    const mode = opts.castFromAction || 'all';
    if (mode !== 'off' && castMap.size) {
      const names = [...castMap.keys()].filter((n) => n.length >= 3);
      const pats = names.map((n) => {
        const esc = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        if (mode === 'caps') return new RegExp('(?<![\\p{L}\\d])' + esc + '(?![\\p{L}\\d])', 'u');
        const stem = /[AEIOUYĄĘaeiouyąę]$/.test(n) && n.length > 4 ? n.slice(0, -1) : n;
        return new RegExp('(?<![\\p{L}\\d])' + stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '[\\p{L}]{0,3}(?![\\p{L}\\d])', 'iu');
      });
      for (const sc of scenes) {
        const action = sc.els.filter((e) => e.type === 'A').map((e) => e.t).join('\n');
        if (!action) continue;
        names.forEach((n, i) => {
          if (!sc.castSet.has(n) && pats[i].test(action)) {
            sc.castSet.set(n, 0);
            castMap.get(n).scenes += 1;
          }
        });
      }
    }
    const castOrder = [];
    const seen = new Set();
    for (const sc of scenes) for (const nm of sc.castSet.keys()) if (!seen.has(nm)) { seen.add(nm); castOrder.push(nm); }

    const out = scenes.map((sc) => {
      const eighths = Math.max(1, Math.round(sc.lines / per8));
      const firstAction = sc.els.find((e) => e.type === 'A');
      let synopsis = '';
      if (firstAction) {
        synopsis = firstAction.t.replace(/\s+/g, ' ');
        // dołącz kolejne linie tego samego akapitu (PDF: linie są zawinięte)
        const idx = sc.els.indexOf(firstAction);
        for (let k = idx + 1; k < sc.els.length && sc.els[k].type === 'A' && synopsis.length < 90 && !sc.els[k].afterBlank && !sc.els[k - 1].para; k++) synopsis += ' ' + sc.els[k].t;
        if (synopsis.length > 140) synopsis = synopsis.slice(0, 140).replace(/\s+\S*$/, '') + '…';
      }
      const text = [sc.heading ? 'H|' + sc.heading : 'H|']
        .concat(sc.els.filter((e) => e.type !== 'B').map((e) => e.type + '|' + e.t)).join('\n');
      return {
        num: sc.num, ie: sc.ie, place: sc.place, site: sc.site, tod: sc.tod, todLabel: sc.todLabel, note: sc.note, heading: sc.heading,
        eighths, page: sc.page, estPage: sc.estPage, synopsis, text,
        castNames: [...sc.castSet.keys()].sort((a, b) => castOrder.indexOf(a) - castOrder.indexOf(b)),
        dlg: sc.dlg,
      };
    });
    return { scenes: out, cast: castOrder.map((n) => castMap.get(n)), front, dupNums: opts._dupNums || 0, totalLines: cum };
  }

  function guessTitle(front) {
    for (const e of front) {
      if (e.type === 'B') continue;
      const t = e.t.replace(/^["„”“]|["„”“]$/g, '').trim();
      if (!t || t.length > 70) continue;
      if (/^(FADE IN|TITLE|TYTUŁ|SCENARIUSZ|SCREENPLAY|NAPISANY|WRITTEN|AUTOR|BY)\b/i.test(t) && t.length < 14) continue;
      return t.replace(/^(?:TITLE|TYTUŁ)\s*:\s*/i, '');
    }
    return '';
  }

  function finalize(els, opts, srcInfo) {
    const res = assemble(els, opts);
    const warnings = [];
    if (!res.scenes.length) warnings.push('Nie wykryto nagłówków scen (np. „WN. KUCHNIA – DZIEŃ”, „INT. KITCHEN - DAY”, „1. PLENER. ULICA. NOC”). Sprawdź format pliku albo dodaj sceny ręcznie.');
    if (res.dupNums) warnings.push(`W ${res.dupNums} scenach numer się powtarza. Numery możesz poprawić w rozpisce.`);
    const totalEighths = res.scenes.reduce((a, s) => a + s.eighths, 0);
    return Object.assign(res, {
      warnings,
      title: (srcInfo && srcInfo.title) || guessTitle(res.front),
      stats: { scenes: res.scenes.length, cast: res.cast.length, eighths: totalEighths, pages: Math.round((totalEighths / 8) * 10) / 10, linesPerPage: opts.linesPerPage || 55, source: (srcInfo && srcInfo.source) || 'tekst' },
    });
  }

  /* ---------- źródła ---------- */
  function cleanFountain(text) {
    text = text.replace(/\r\n?/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\[\[[\s\S]*?\]\]/g, '');
    const lines = text.split('\n');
    let title = '';
    // blok tytułowy Fountain
    let i = 0;
    if (/^\s*(Title|Tytuł|Credit|Author|Authors|Source|Draft date|Date|Contact|Copyright)\s*:/i.test(lines[0] || '')) {
      while (i < lines.length && lines[i].trim() !== '') {
        const m = lines[i].match(/^\s*(?:Title|Tytuł)\s*:\s*(.*)$/i);
        if (m) title = m[1].trim() || (lines[i + 1] || '').trim();
        i++;
      }
    }
    const out = [];
    for (; i < lines.length; i++) {
      let l = lines[i];
      if (/^\s*={3,}\s*$/.test(l)) continue;
      if (/^\s*#{1,6}\s/.test(l)) continue;
      if (/^\s*=\s/.test(l)) continue;
      if (/^\s*~/.test(l)) l = l.replace(/^\s*~/, '');
      if (/^\s*!/.test(l)) l = l.replace(/^\s*!/, '');
      l = l.replace(/^\s*>\s*(.*?)\s*<\s*$/, '$1');
      l = l.replace(/\*\*\*|\*\*|\*|(?<![\w])_(?=\S)|(?<=\S)_(?![\w])/g, '');
      out.push(l);
    }
    return { lines: out, title };
  }

  function fromText(text, opts = {}) {
    const { lines: raw, title } = cleanFountain(String(text));
    const lines = raw.map((l) => {
      const t = l.replace(/\t/g, '    ').replace(/\s+$/, '');
      if (!t.trim()) return { t: '', blank: true, x: null, page: null };
      const x = t.match(/^ */)[0].length * 7.2;
      return { t: t.trim(), x, page: null, blank: false };
    });
    // brak wcięć w ogóle -> traktuj jak brak informacji o układzie
    const anyIndent = lines.some((l) => !l.blank && l.x > 14);
    if (!anyIndent) lines.forEach((l) => { l.x = null; });
    // w czystym tekście bez pustych linii (akapity) – tryb akapitowy
    const blanks = lines.filter((l) => l.blank).length;
    if (blanks < lines.length * 0.08) lines.forEach((l) => { if (!l.blank) l.para = true; });
    const els = classify(lines, Object.assign({ pageW: 595 }, opts));
    return finalize(els, opts, { title, source: 'tekst' });
  }

  function xmlUnescape(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d)).replace(/&amp;/g, '&');
  }

  function fromFdx(xml, opts = {}) {
    const els = [];
    let title = '';
    const body = xml.replace(/<TitlePage[\s\S]*?<\/TitlePage>/, '');
    const tm = xml.match(/<TitlePage[\s\S]*?<\/TitlePage>/);
    if (tm) {
      const tp = [...tm[0].matchAll(/<Text[^>]*>([\s\S]*?)<\/Text>/g)].map((m) => xmlUnescape(m[1]).trim()).filter(Boolean);
      if (tp.length) title = tp[0];
    }
    const re = /<Paragraph\b([^>]*)>([\s\S]*?)<\/Paragraph>/g;
    let m;
    const map = { 'Scene Heading': 'H', Action: 'A', Character: 'C', Dialogue: 'D', Parenthetical: 'P', Transition: 'T', General: 'A', Shot: 'A', 'Cast List': 'A', 'New Act': 'A', 'End of Act': 'A' };
    let lastWasCue = false;
    while ((m = re.exec(body))) {
      const type = (m[1].match(/Type="([^"]*)"/) || [])[1] || 'Action';
      const inner = m[2];
      const text = [...inner.matchAll(/<Text[^>]*>([\s\S]*?)<\/Text>/g)].map((x) => xmlUnescape(x[1])).join('').replace(/\s+/g, ' ').trim();
      if (!text) continue;
      const mt = map[type] || 'A';
      const sp = inner.match(/<SceneProperties[^>]*Page="(\d+)"/);
      const sn = m[1].match(/Number="([^"]*)"/);
      const el = { type: mt, t: text, para: true, page: sp ? +sp[1] : null };
      if (mt === 'H') {
        const hd = parseHeading(text) || { num: null, ie: '', place: text.toUpperCase(), site: text.toUpperCase(), tod: '', todLabel: '', note: '', raw: text };
        if (!hd.num && sn && sn[1]) hd.num = sn[1];
        el.hd = hd;
      }
      if (mt === 'C') { el.name = cueName(text) || text.replace(/\s*\([^)]*\)\s*/g, ' ').trim().toUpperCase(); }
      els.push(el);
    }
    if (!els.some((e) => e.type === 'H')) {
      // FDX bez typów -> spróbuj jako tekst
      const txt = els.map((e) => e.t).join('\n\n');
      return fromText(txt, opts);
    }
    return finalize(els, opts, { title, source: 'Final Draft' });
  }

  function fromDocxXml(xml, opts = {}) {
    const paras = xml.match(/<w:p(?:\s[^>]*)?\/>|<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g) || [];
    const lines = [];
    for (const p of paras) {
      if (/^<w:p(?:\s[^>]*)?\/>$/.test(p)) { lines.push({ t: '', blank: true, x: null, page: null }); continue; }
      let t = '';
      const re = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\/>|<w:br\/>|<w:cr\/>/g;
      let m;
      while ((m = re.exec(p))) t += m[0].startsWith('<w:t') ? xmlUnescape(m[1]) : m[0] === '<w:tab/>' ? '  ' : '\n';
      let x = 0;
      const ind = p.match(/<w:ind[^>]*w:(?:left|start)="(\d+)"/);
      if (ind) x = +ind[1] / 20;
      if (/<w:jc w:val="center"\/>/.test(p) && !x) x = 0.3 * 595;
      for (const part of t.split('\n')) {
        const s = part.replace(/\s+$/g, '');
        if (!s.trim()) { lines.push({ t: '', blank: true, x: null, page: null }); continue; }
        lines.push({ t: s.trim(), x: ind || /<w:jc w:val="center"\/>/.test(p) ? x : 0, page: null, blank: false, para: true });
      }
    }
    // jeśli dokument ma puste akapity – to nie tryb akapitowy
    const blanks = lines.filter((l) => l.blank).length;
    if (blanks > lines.length * 0.15) lines.forEach((l) => { l.para = false; });
    const hasX = lines.some((l) => !l.blank && l.x > 14);
    if (!hasX) lines.forEach((l) => { l.x = null; });
    const els = classify(lines, Object.assign({ pageW: 595 }, opts));
    return finalize(els, opts, { source: 'Word' });
  }

  /** pages: [{ width, height, items:[{s,x,y,w,h}] }] (y rośnie w górę, jak w PDF) */
  function pdfToLines(pages) {
    const out = [];
    const perPage = [];
    pages.forEach((pg, pi) => {
      const items = pg.items.filter((it) => it.s !== undefined && String(it.s).length).slice();
      items.sort((a, b) => b.y - a.y || a.x - b.x);
      const rows = [];
      for (const it of items) {
        const h = it.h || 10;
        let row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(2, h * 0.3));
        if (!row) { row = { y: it.y, items: [] }; rows.push(row); }
        row.items.push(it);
      }
      rows.sort((a, b) => b.y - a.y);
      const lines = [];
      for (const r of rows) {
        r.items.sort((a, b) => a.x - b.x);
        let t = '', lastEnd = null;
        const h = Math.max(...r.items.map((i) => i.h || 10));
        for (const it of r.items) {
          if (lastEnd !== null) {
            const gap = it.x - lastEnd;
            if (gap > h * 1.6) t += '  ';
            else if (gap > h * 0.12 && !/\s$/.test(t) && !/^\s/.test(it.s)) t += ' ';
          }
          t += it.s;
          lastEnd = it.x + (it.w || it.s.length * h * 0.5);
        }
        t = t.replace(/\s+$/, '');
        if (!t.trim()) continue;
        lines.push({ t: t.replace(/^\s+/, ''), x: r.items[0].x, y: r.y, h, page: pi + 1, blank: false });
      }
      // usuń numer strony u góry/dołu
      if (lines.length) {
        const isNum = (l) => /^\(?\d{1,3}\.?\)?\.?$/.test(l.t.trim());
        if (isNum(lines[0])) lines.shift();
        else if (lines.length > 1 && isNum(lines[lines.length - 1]) && lines[lines.length - 1].x > (pg.width || 595) * 0.6) lines.pop();
      }
      perPage.push(lines);
    });
    // typowy odstęp linii
    const gaps = [];
    for (const lines of perPage) for (let i = 1; i < lines.length; i++) { const d = lines[i - 1].y - lines[i].y; if (d > 3 && d < 40) gaps.push(d); }
    gaps.sort((a, b) => a - b);
    const lh = gaps.length ? gaps[Math.floor(gaps.length * 0.3)] : 12;
    const pageLineCounts = [];
    for (const lines of perPage) {
      let cnt = 0;
      lines.forEach((l, i) => {
        if (i > 0) {
          const d = lines[i - 1].y - l.y;
          const n = Math.max(0, Math.round(d / lh) - 1);
          for (let k = 0; k < Math.min(n, 2); k++) out.push({ t: '', blank: true, x: null, page: l.page });
          cnt += 1 + n;
        } else cnt += 1;
        out.push(l);
      });
      pageLineCounts.push(cnt);
    }
    const sorted = pageLineCounts.filter((c) => c > 20).sort((a, b) => a - b);
    // typowa pełna strona: ~80. percentyl (strony ze scen akcji, bez nagłówków i końcówek)
    const lpp = sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.8))] : 55;
    return { lines: out, linesPerPage: Math.max(40, Math.min(70, lpp)), pageCount: pages.length, perPage };
  }

  function fromPdfPages(pages, opts = {}) {
    const { lines, linesPerPage, perPage } = pdfToLines(pages);
    opts = Object.assign({ pageW: (pages[0] && pages[0].width) || 595 }, opts);
    if (!opts.linesPerPage) opts.linesPerPage = linesPerPage;
    const els = classify(lines, opts);
    const res = finalize(els, opts, { source: 'PDF' });
    // numery stron z geometrii PDF
    let offset = opts.pageOffset;
    if (offset == null || offset === 'auto') {
      const firstHeadPage = (els.find((e) => e.type === 'H') || {}).page || 1;
      const p1 = perPage[0] || [];
      offset = firstHeadPage > 1 && p1.length <= 18 && !p1.some((l) => parseHeading(l.t)) ? 1 : 0;
    }
    let idx = 0;
    for (const e of els) if (e.type === 'H') { const sc = res.scenes[idx++]; if (sc) sc.page = Math.max(1, (e.page || 1) - offset); }
    res.stats.pdfPages = pages.length;
    res.stats.pageOffset = offset;
    return res;
  }

  /** Tekst z jednego dokumentu (Word jako czysty tekst, wklejony tekst) */
  return { parseHeading, cueName, fromText, fromFdx, fromDocxXml, fromPdfPages, pdfToLines, classify, assemble, xmlUnescape };
})();
if (typeof module !== 'undefined') module.exports = Parser;
