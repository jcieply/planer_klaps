// @ts-nocheck
/* Moduł przeniesiony z wersji 1.x (logika bez zmian). */
import { I18N, T, T_ } from './i18n';
import { Xlsx } from './xlsx';
import { Pdf } from './pdfdoc';
import { KLAPS_FONTS, loadFonts } from './fonts';
import { ensureEn } from './enpack';
import { Core } from './core';
import { SECTIONS, secLabel, slug, titleOf, fileStem } from './reportmeta';
/* ===== RAPORTY: PDF (A4) i Excel: kalendarzówka, rozpiska, shotlista, obsada, ekipa, catering, lokacje, DOOD, plany pracy, transport, kosztorys ===== */
const Reports = (() => {
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const PLW = 841.89, PLH = 595.28, MX = 28, MT = 50, MB = 34;
  const C = { ink: '1B2229', mute: '5C6670', line: 'C9CFD5', dark: '26323B', band: 'E4EAEF', off: '8A949D', white: 'FFFFFF', head: 'D5DDE3', prep: 'F2F4F6', warn: 'FFF0D3' };
  const DOOD_BG = { SW: '9AD3A5', W: 'D8EEDC', WF: 'F3B7A3', SWF: 'F7E08A', H: 'E0E3E7' };

  const nowText = () => Core.fmtShort(Core.todayISO());
  /** język dokumentów: ustawienie projektu albo język interfejsu */
  const docLang = (st, opts) => (opts && opts.lang) || st.meta.docLang || I18N.lang;


  const money = (n) => Core.fmtMoney(n);
  const H = (arr) => arr.map((x) => T(x));
  const hm = (r) => (r.dur || r.fixed ? `${r.from}–${r.to}` : r.from);

  /* ============================== PDF ============================== */
  async function buildPdf(st, sections, opts) {
    Core.setCurrency(st.budget && st.budget.currency);
    opts = opts || {};
    await loadFonts();
    if (docLang(st, opts) === 'en') await ensureEn();
    const doc = I18N.withLang(docLang(st, opts), () => composePdf(st, sections || SECTIONS.map((s) => s[0]), opts));
    return await doc.build();
  }
  function composePdf(st, sections, opts) {
    const data = Core.reportData(st);
    const nums = Core.dayNumbers(st);
    let PW = PLW, PH = PLH, CW = PW - MX * 2;
    const doc = new Pdf.Doc({ pageW: PLW, pageH: PLH, info: { title: titleOf(st) + ' – ' + T('kalendarz zdjęciowy'), author: st.meta.company || st.meta.producer || '' } });
    doc.addFont('regular', KLAPS_FONTS.regular, 'LiberationSans', false);
    doc.addFont('bold', KLAPS_FONTS.bold, 'LiberationSans-Bold', true);

    const ctx = { page: null, y: 0, section: '', orient: 'l' };
    const ORIENT = { callsheet: 'p', crew: 'p', catering: 'p', dpr: 'p' };
    const newPage = () => {
      const dims = ctx.orient === 'p' ? [PLH, PLW] : [PLW, PLH];
      PW = dims[0]; PH = dims[1]; CW = PW - MX * 2;
      const p = doc.addPage(PW, PH);
      ctx.page = p;
      p.text(MX, 26, titleOf(st).toUpperCase(), { size: 10, bold: true, color: C.ink });
      p.text(PW - MX, 26, ctx.section + '  ·  ' + T('stan na {d}', { d: nowText() }), { size: 8, color: C.mute, align: 'right' });
      p.line(MX, 32, PW - MX, 32, { color: C.dark, lw: 1 });
      ctx.y = MT;
    };
    const ensure = (h) => { if (!ctx.page || ctx.y + h > PH - MB) { newPage(); return true; } return false; };
    const startSection = (name, orient) => { ctx.section = name; ctx.orient = orient || 'l'; newPage(); };
    let began = false;
    const begin = (name, orient) => { if (!began) { began = true; return; } startSection(name, orient); };

    const SZ = 8, PX = 3, PY = 2.6;
    /** rysuje tabelę; cols:[{w,align,bold}], rows:[{cells,bg,bold,color,size}] */
    function table(cols, rows, o = {}) {
      const measure = (r) => {
        let h = 0;
        const lines = r.cells.map((t, i) => {
          const ls = doc.wrap(t == null ? '' : String(t), cols[i].w - PX * 2, r.size || SZ, r.bold || cols[i].bold);
          h = Math.max(h, ls.length * ((r.size || SZ) * 1.27) + PY * 2);
          return ls;
        });
        return { lines, h: Math.max(h, r.minH || 0) };
      };
      const drawRow = (r, m) => {
        const p = ctx.page;
        const size = r.size || SZ;
        if (r.bg) p.rect(MX, ctx.y, CW, m.h, { fill: r.bg });
        if (r.cellBg) { let cx0 = MX; cols.forEach((c, i) => { if (r.cellBg[i]) p.rect(cx0 + 1.5, ctx.y + 1.5, c.w - 3, m.h - 3, { fill: r.cellBg[i] }); cx0 += c.w; }); }
        let x = MX;
        cols.forEach((c, i) => {
          m.lines[i].forEach((ln, k) => {
            const tx = c.align === 'right' ? x + c.w - PX : c.align === 'center' ? x + c.w / 2 : x + PX;
            p.text(tx, ctx.y + PY + size * 0.85 + k * size * 1.27, ln, { size, bold: r.bold || c.bold, color: r.color || C.ink, align: c.align || 'left' });
          });
          x += c.w;
        });
        p.line(MX, ctx.y + m.h, MX + CW, ctx.y + m.h, { color: o.rule || C.line, lw: 0.4 });
        if (o.vlines) { let vx = MX; cols.forEach((c) => { p.line(vx, ctx.y, vx, ctx.y + m.h, { color: C.line, lw: 0.3 }); vx += c.w; }); p.line(MX + CW, ctx.y, MX + CW, ctx.y + m.h, { color: C.line, lw: 0.3 }); }
        ctx.y += m.h;
      };
      const header = o.header ? { cells: o.header, bg: C.head, bold: true, size: 7.5 } : null;
      const hm0 = header ? measure(header) : { h: 0 };
      const first = rows.length ? measure(rows[0]) : { h: 0 };
      if (ensure(hm0.h + first.h + (o.keep || 0))) { if (o.contBand) o.contBand(); }
      if (header) drawRow(header, hm0);
      for (const r of rows) {
        const m = measure(r);
        if (ctx.y + m.h > PH - MB) { newPage(); if (o.contBand) o.contBand(); if (header) drawRow(header, hm0); }
        drawRow(r, m);
      }
    }
    const textBlock = (txt, o = {}) => {
      const size = o.size || 8;
      const ls = doc.wrap(txt, (o.w || CW) - 6, size, o.bold);
      for (let i = 0; i < ls.length; i++) {
        if (ensure(size * 1.3 + 4) && i) { /* ciąg dalszy na nowej stronie */ }
        ctx.page.text(MX + 3 + (o.indent || 0), ctx.y + 2 + size * 0.85, ls[i], { size, bold: o.bold, color: o.color || C.ink });
        ctx.y += size * 1.3;
      }
      ctx.y += 4;
    };

    const colsSchedule = [{ w: 36, align: 'center', bold: true }, { w: 36, align: 'center' }, { w: 30, align: 'center' }, { w: 175 }, { w: 278 }, { w: 90 }, { w: 40, align: 'center' }, { w: 100 }];
    const headSchedule = H(['Sc.', 'W/Z', 'D/N', 'Plan / lokacja', 'Opis', 'Obsada', 'Str.', 'Uwagi']);
    const rowSchedule = (r) => ({ cells: [r.num, r.ieLabel, r.todShort, r.place, r.synopsis, r.castText, r.pages, r.notes], bg: r.bg });

    const dayBand = (d, cont) => {
      const h = 21;
      ensure(h + 30);
      const p = ctx.page;
      p.rect(MX, ctx.y, CW, h, { fill: Core.KIND_BG[d.kind] || C.dark });
      const lab = d.title.toUpperCase() + (cont ? ' ' + T('(cd.)') : '');
      p.text(MX + 8, ctx.y + 14.5, lab, { size: 11, bold: true, color: C.white });
      const lw = doc.text(lab, 11, true);
      p.text(MX + 8 + lw + 12, ctx.y + 14, Core.fmtDatePL(d.date), { size: 9.5, color: C.white });
      let right;
      if (d.kind === 'shoot') right = `${T('Zbiórka')} ${d.call || '—'}   ·   ${d.rows.length} ${Core.pl(d.rows.length, 'scena', 'sceny', 'scen')}   ·   ${Core.fmtEighths(d.eighths)} ${T('str.')}`;
      else if (d.kind === 'off') right = d.note || '';
      else right = [d.call && (d.end ? `${d.call}–${d.end}` : `${T('Start')} ${d.call}`), d.site].filter(Boolean).join('   ·   ');
      if (right) p.text(PW - MX - 8, ctx.y + 14, doc.wrap(right, CW * 0.45, 9)[0], { size: 9, color: C.white, align: 'right' });
      ctx.y += h;
    };
    const subhead = (txt) => { ensure(78); ctx.y += 6; ctx.page.text(MX, ctx.y + 8, txt.toUpperCase(), { size: 8, bold: true, color: C.mute }); ctx.page.line(MX, ctx.y + 12, PW - MX, ctx.y + 12, { color: C.dark, lw: 0.8 }); ctx.y += 16; };
    const docBand = (left, mid, right, fill) => {
      ensure(60);
      const p = ctx.page, h = 24;
      p.rect(MX, ctx.y, CW, h, { fill: fill || C.dark });
      p.text(MX + 8, ctx.y + 16.5, left, { size: 12.5, bold: true, color: C.white });
      const lw = doc.text(left, 12.5, true);
      if (mid) p.text(MX + 8 + lw + 14, ctx.y + 16, mid, { size: 10, color: C.white });
      if (right) p.text(PW - MX - 8, ctx.y + 16, right, { size: 10, bold: true, color: C.white, align: 'right' });
      ctx.y += h;
    };

    /** pasek dnia planu pracy: tytuł i data po lewej, kluczowi twórcy (DIR · DOP · PROD) po prawej.
        Gdy nazwiska nie mieszczą się obok daty, pasek ma drugi wiersz – nazwiska nigdy nie są obcinane. */
    const callBand = (left, mid, kp) => {
      ensure(70);
      const parts = [['DIR', kp.dir], ['DOP', kp.dop], ['PROD', kp.prod]].filter((x) => x[1]);
      const lw = doc.text(left, 12.5, true), used = 8 + lw + 14 + doc.text(mid, 10, false) + 18;
      const gap = 14;
      const measure = (sz) => parts.map(([l, n]) => [l, n, doc.text(l, sz - 1.8, true), doc.text(n, sz, true)]);
      const width = (m) => m.reduce((a, x) => a + x[2] + 4 + x[3], 0) + gap * Math.max(0, m.length - 1);
      let size = 9.5, m = measure(size);
      while (width(m) > CW - used - 8 && size > 8) { size -= 0.5; m = measure(size); }
      const one = !parts.length || width(m) <= CW - used - 8;
      if (!one) { size = 9.5; m = measure(size); while (width(m) > CW - 16 && size > 6.5) { size -= 0.5; m = measure(size); } }
      const p = ctx.page, h = one ? 24 : 40;
      p.rect(MX, ctx.y, CW, h, { fill: C.dark });
      p.text(MX + 8, ctx.y + 16.5, left, { size: 12.5, bold: true, color: C.white });
      p.text(MX + 8 + lw + 14, ctx.y + 16, mid, { size: 10, color: C.white });
      const base = ctx.y + (one ? 16 : 33);
      let x = PW - MX - 8;
      for (let k = m.length - 1; k >= 0; k--) {
        const [l, n, lw2, nw] = m[k];
        p.text(x, base, n, { size, bold: true, color: C.white, align: 'right' });
        x -= nw + 4;
        p.text(x, base, l, { size: size - 1.8, bold: true, color: 'AEB8C2', align: 'right' });
        x -= lw2 + gap;
      }
      ctx.y += h;
    };

    /* ----- strona tytułowa / info ----- */
    const wantCal = sections.includes('calendar');
    const firstSec = SECTIONS.find((s) => sections.includes(s[0])) || SECTIONS[0];
    ctx.section = wantCal ? T('Kalendarzówka') : secLabel(firstSec[0]);
    ctx.orient = ORIENT[firstSec[0]] || 'l';
    newPage();
    const onlyDocs = sections.every((x) => ['callsheet', 'dpr', 'transport', 'crew', 'shotlist', 'catering'].includes(x));
    if (!onlyDocs) {
      const p = ctx.page;
      p.text(MX, ctx.y + 22, titleOf(st).toUpperCase(), { size: 22, bold: true, color: C.ink });
      p.text(MX, ctx.y + 40, wantCal ? T('KALENDARZ ZDJĘCIOWY') : T('ZESTAWIENIA PRODUKCYJNE'), { size: 10, bold: true, color: C.mute });
      ctx.y += 54;
      const t = data.totals;
      const info = [
        [T('Reżyser'), st.meta.director], [T('Producent'), st.meta.producer], [T('Kierownik produkcji'), st.meta.manager], [T('Firma produkcyjna'), st.meta.company],
        [T('Wersja scenariusza'), [st.meta.scriptVersion, st.meta.scriptDate && Core.fmtShort(st.meta.scriptDate)].filter(Boolean).join(' · ')],
        [T('Okres zdjęć'), t.from ? `${Core.fmtShort(t.from)} – ${Core.fmtShort(t.to)}` : T('nie zaplanowano')],
        [T('Dni zdjęciowe'), String(t.shootDays)], [T('Dni specjalne'), t.specialDays ? String(t.specialDays) : ''], [T('Sceny w planie'), T('{a} z {b}', { a: t.planned, b: t.scenes })],
        [T('Długość scenariusza'), `${Core.fmtEighths(t.eighths)} ${T('str.')}`], [T('Limit planu dnia'), T('do {n} str.', { n: +st.meta.pagesPerDay })],
      ].filter((x) => x[1]);
      const colW = CW / 2;
      const rowsN = Math.ceil(info.length / 2);
      info.forEach((kv, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        const x = MX + col * colW, y = ctx.y + row * 15;
        p.text(x, y + 10, kv[0].toUpperCase(), { size: 6.8, bold: true, color: C.mute });
        p.text(x + 118, y + 10, kv[1], { size: 9, color: C.ink });
      });
      ctx.y += rowsN * 15 + 8;
      let lx = MX;
      Object.keys(Core.STRIP).forEach((k) => {
        p.rect(lx, ctx.y, 14, 9, { fill: Core.STRIP[k].bg, stroke: '9AA3AB', lw: 0.5 });
        p.text(lx + 19, ctx.y + 7.5, Core.STRIP[k].name, { size: 7.2, color: C.mute });
        lx += 19 + doc.text(Core.STRIP[k].name, 7.2) + 16;
      });
      ctx.y += 22;
    }

    /* ----- kalendarzówka ----- */
    if (wantCal) {
      began = true;
      if (!data.days.length) textBlock(T('Nie dodano jeszcze dni zdjęciowych. Zaplanuj sceny w zakładce „Kalendarzówka”.'), { color: C.mute });
      for (const d of data.days) {
        if (d.kind !== 'shoot') {
          dayBand(d);
          if (d.kind !== 'off' && d.note) textBlock(d.note, { size: 7.8, color: C.mute });
          ctx.y += 8; continue;
        }
        dayBand(d);
        const rows = d.rows.map(rowSchedule);
        rows.push({ cells: ['', '', '', `${T('Razem')}: ${d.rows.length} ${Core.pl(d.rows.length, 'scena', 'sceny', 'scen')}`, d.sites.join(' · '), '', Core.fmtEighths(d.eighths), ''], bg: C.band, bold: true });
        table(colsSchedule, rows, { header: headSchedule, contBand: () => dayBand(d, true), vlines: true });
        if (d.cast.length) textBlock(T('Obsada dnia') + ': ' + d.cast.map((c) => `${c.id} ${c.name}${c.actor ? ' (' + c.actor + ')' : ''}`).join('   ·   '), { size: 7.8, color: C.ink });
        if (d.note) textBlock(T('Uwagi') + ': ' + d.note, { size: 7.8, color: C.mute });
        ctx.y += 12;
      }
      if (data.unscheduled.length) {
        ensure(60);
        ctx.page.rect(MX, ctx.y, CW, 21, { fill: C.off });
        ctx.page.text(MX + 8, ctx.y + 14.5, T('SCENY NIEZAPLANOWANE ({n})', { n: data.unscheduled.length }), { size: 11, bold: true, color: C.white });
        ctx.y += 21;
        table(colsSchedule, data.unscheduled.map(rowSchedule), { header: headSchedule, vlines: true });
      }
    }

    /* ----- rozpiska scen ----- */
    if (sections.includes('board')) {
      begin(T('Rozpiska scen'));
      const anyRev = data.scenes.some((r) => r.rev);
      const cols = [{ w: 36, align: 'center', bold: true }, { w: 36, align: 'center' }, { w: 30, align: 'center' }, { w: 180 }, { w: anyRev ? 236 : 270 }, { w: 90 }, { w: 40, align: 'center' }, { w: 55, align: 'center' }, { w: 48, align: 'center' }];
      if (anyRev) cols.splice(1, 0, { w: 34, align: 'center', bold: true });
      const revCell = (r) => (r.rev ? 'R' + r.rev.n : '');
      const rows = data.scenes.map((r) => {
        const cells = [r.num, r.ieLabel, r.todShort, r.place, r.synopsis, r.castText, r.pages, r.dayNo ? 'D' + r.dayNo : '—', r.page || ''];
        if (anyRev) cells.splice(1, 0, revCell(r));
        return { cells, bg: r.bg, cellBg: anyRev && r.rev ? { 1: r.rev.bg } : null };
      });
      const tot = ['', '', '', `${T('Razem')}: ${data.scenes.length} ${Core.pl(data.scenes.length, 'scena', 'sceny', 'scen')}`, '', '', Core.fmtEighths(data.totals.eighths), '', ''];
      if (anyRev) tot.splice(1, 0, '');
      rows.push({ cells: tot, bg: C.band, bold: true });
      const hdr = ['Sc.', 'W/Z', 'D/N', 'Plan / lokacja', 'Opis', 'Obsada', 'Str.', 'Dzień zdj.', 'Strona'];
      if (anyRev) hdr.splice(1, 0, 'Rew.');
      table(cols, rows, { header: H(hdr), vlines: true });
      if (anyRev) {
        const revs = Core.revisions(st).filter((r) => r.n > 0 && st.scenes.some((sc) => sc.rev === r.id));
        ensure(30); ctx.y += 8;
        let lx = MX;
        ctx.page.text(lx, ctx.y + 8, T('Rewizje scenariusza:'), { size: 7.5, bold: true, color: C.mute }); lx += doc.text(T('Rewizje scenariusza:'), 7.5, true) + 10;
        revs.forEach((r) => {
          const c = Core.revColor(r.color), lab = `R${r.n}  ${Core.revName(r)}${r.date ? '  ' + Core.fmtShort(r.date) : ''}`, w = doc.text(lab, 7.5, false) + 12;
          if (lx + w > PW - MX) { ctx.y += 14; lx = MX; }
          ctx.page.rect(lx, ctx.y, w, 11, { fill: c.bg, stroke: c.dot, lw: 0.6 });
          ctx.page.text(lx + 6, ctx.y + 8, lab, { size: 7.5, color: C.ink });
          lx += w + 6;
        });
        ctx.y += 16;
      }
    }

    /* ----- shotlista ----- */
    if (sections.includes('shotlist')) {
      begin(T('Shotlista'));
      const sr = Core.shotRows(st);
      if (!sr.length) textBlock(T('Nie dodano jeszcze ujęć. Uzupełnij je w zakładce „Shotlista”.'), { color: C.mute });
      else {
        const rows = sr.map((x) => ({ cells: [x.num, x.shot, x.type, x.desc, x.lens, x.grip, x.eta, x.cast, x.site], bg: x.bg || undefined }));
        const eta = sr.reduce((a, x) => a + (x.etaMin || 0), 0);
        rows.push({ cells: ['', '', '', `${T('Razem')}: ${sr.length} ${Core.pl(sr.length, 'ujęcie', 'ujęcia', 'ujęć')}`, '', '', eta ? Core.fmtDur(eta) : '', '', ''], bg: C.band, bold: true });
        table([{ w: 40, align: 'center', bold: true }, { w: 44, align: 'center' }, { w: 44, align: 'center', bold: true }, { w: 236 }, { w: 60 }, { w: 80 }, { w: 46, align: 'center' }, { w: 120 }, { w: 115 }],
          rows, { header: H(['Sc.', 'Ujęcie', 'Typ planu', 'Opis', 'Obiektyw', 'Grip', 'ETA', 'Aktorzy', 'Lokacja']), vlines: true, keep: 20 });
      }
      subhead(T('Legenda – typy planu'));
      table([{ w: 56, align: 'center', bold: true }, { w: 130, bold: true }, { w: 600 }], Core.SHOT_TYPES.map(([k, n, d]) => ({ cells: [k, T(n), T(d)] })), { header: H(['Skrót', 'Typ planu', 'Opis']), vlines: true, keep: 20 });
    }

    /* ----- obsada ----- */
    if (sections.includes('cast')) {
      begin(T('Obsada'));
      const cols = [{ w: 30, align: 'center', bold: true }, { w: 140, bold: true }, { w: 150 }, { w: 105 }, { w: 40, align: 'center' }, { w: 50, align: 'center' }, { w: 120 }, { w: CW - 635 }];
      const rows = data.cast.map((c) => ({ cells: [c.id, c.name, c.actor, c.phone, c.scenes, Core.fmtEighths(c.eighths), c.days.length ? c.days.map((n) => 'D' + n).join(', ') : '—', c.sceneNums.join(', ')] }));
      table(cols, rows, { header: H(['Nr', 'Postać', 'Aktor / aktorka', 'Telefon', 'Sceny', 'Str.', 'Dni zdjęciowe', 'Numery scen']), vlines: true });
    }

    /* ----- ekipa (A4 pionowo, tylko dane podstawowe) ----- */
    if (sections.includes('crew')) {
      begin(T('Ekipa'), 'p');
      const groups = Core.crewGroups(st);
      const n = st.crew.length;
      docBand(T('EKIPA FILMOWA'), titleOf(st), `${n} ${Core.pl(n, 'osoba', 'osoby', 'osób')}`);
      ctx.y += 6;
      if (!n) textBlock(T('Nie dodano jeszcze osób do ekipy.'), { color: C.mute });
      else {
        const rows = [];
        let k = 0;
        groups.forEach((g) => {
          rows.push({ cells: ['', g.dept.toUpperCase() + ' · ' + g.list.length, '', ''], bg: C.band, bold: true });
          g.list.forEach((c) => { k += 1; rows.push({ cells: [k, Core.crewName(c), c.role, c.phone] }); });
        });
        table([{ w: 28, align: 'center' }, { w: 200, bold: true }, { w: 190 }, { w: 121 }], rows, { header: H(['Lp.', 'Imię i nazwisko', 'Funkcja', 'Telefon']), vlines: true, keep: 30, contBand: () => docBand(T('EKIPA FILMOWA'), T('(cd.)'), '') });
      }
    }

    /* ----- catering (A4 pionowo) ----- */
    if (sections.includes('catering')) {
      begin(T('Catering'), 'p');
      const cat = Core.catering(st);
      docBand(T('CATERING'), titleOf(st), T('{n} posiłków', { n: cat.total }));
      ctx.y += 6;
      if (!cat.days.length) textBlock(T('Brak dni pracy w kalendarzówce.'), { color: C.mute });
      else {
        const keys = cat.keys.filter((k) => k === 'meat' || cat.sum[k] > 0);
        const fixedW = 74 + 58 + 50;
        const dw = Math.min(70, (CW - fixedW) / keys.length);
        const cols = [{ w: 74, bold: true }, { w: 58, align: 'center' }].concat(keys.map(() => ({ w: dw, align: 'center' }))).concat([{ w: CW - fixedW - dw * keys.length + 50, align: 'center', bold: true }]);
        const rows = cat.days.map((d) => ({ cells: [d.tag, Core.fmtDM(d.date) + ' ' + (d.date ? Core.DAYS_SHORT[Core.dow(d.date)] : '')].concat(keys.map((k) => d.counts[k] || '')).concat([d.total]), bg: d.kind === 'shoot' ? undefined : C.prep }));
        rows.push({ cells: [T('RAZEM'), ''].concat(keys.map((k) => cat.sum[k] || '')).concat([cat.total]), bg: C.band, bold: true });
        table(cols, rows, { header: [T('Dzień'), T('Data')].concat(keys.map((k) => Core.dietLabel(k, true))).concat([T('Razem')]), vlines: true, keep: 20 });
        textBlock(T('Liczba posiłków = ekipa pracująca danego dnia (zakładka Ekipa → Dni pracy){cast}, plus dodatkowe porcje.', { cast: st.catering.cast !== false ? T(' oraz aktorzy z planu dnia') : '' }), { size: 7.2, color: C.mute });
        const notes = [];
        cat.days.forEach((d) => d.notes.forEach((x) => notes.push({ cells: [d.tag, x.who, x.diet, x.note] })));
        if (notes.length) {
          subhead(T('Diety specjalne i alergie'));
          table([{ w: 74, bold: true }, { w: 170, bold: true }, { w: 120 }, { w: CW - 364 }], notes, { header: H(['Dzień', 'Osoba', 'Dieta', 'Uwagi']), vlines: true, keep: 20 });
        }
      }
    }

    /* ----- lokacje ----- */
    if (sections.includes('sites')) {
      begin(T('Lokacje'));
      const cols = [{ w: 100, bold: true }, { w: 150 }, { w: 120 }, { w: 80 }, { w: 125 }, { w: 66, align: 'center', bold: true }, { w: 52, align: 'center' }, { w: CW - 693 }];
      const rows = data.sites.map((s) => ({
        cells: [s.site === '(bez nazwy)' ? T('(bez nazwy)') : s.site, [s.realName, s.address].filter(Boolean).join('\n'), [s.owner, s.ownerContact].filter(Boolean).join('\n'), s.power ? Core.powerLabel(s.power) : '', [s.toilet && T('WC: {t}', { t: s.toilet }), s.camp && T('Camp: {t}', { t: s.camp })].filter(Boolean).join('\n'), s.contract ? Core.contractLabel(s.contract) : '', (s.days.length ? s.days.map((n) => 'D' + n).join(', ') : '—') + '\n' + T('{n} sc.', { n: s.scenes }), s.notes],
      }));
      table(cols, rows, { header: H(['Obiekt', 'Nazwa i adres', 'Właściciel / kontakt', 'Zasilanie', 'Toaleta / camp', 'Umowa', 'Dni / sceny', 'Uwagi']), vlines: true });
    }

    /* ----- DOOD ----- */
    if (sections.includes('dood')) {
      begin('Day out of Days');
      const dd = data.dood;
      if (!dd.days.length) textBlock(T('Brak dni zdjęciowych. Zaplanuj sceny, aby zobaczyć zestawienie.'), { color: C.mute });
      else {
        const nameW = 24 + 105 + 95, dayW = 22, tot = 34;
        const perPage = Math.max(8, Math.floor((CW - nameW - tot * 2) / dayW));
        for (let off = 0; off < dd.days.length; off += perPage) {
          const chunk = dd.days.slice(off, off + perPage);
          if (off > 0) startSection('Day out of Days ' + T('(cd.)'));
          const rowH = 15, headH = 34;
          ensure(headH + rowH * 3);
          let p = ctx.page, y = ctx.y;
          const TW = nameW + chunk.length * dayW + tot * 2;
          p.rect(MX, y, TW, headH, { fill: C.head });
          p.text(MX + 4, y + 21, T('Nr'), { size: 7.5, bold: true });
          p.text(MX + 28, y + 21, T('Postać'), { size: 7.5, bold: true });
          p.text(MX + 133, y + 21, T('Aktor / aktorka'), { size: 7.5, bold: true });
          chunk.forEach((d, i) => {
            const cx = MX + nameW + i * dayW + dayW / 2;
            p.text(cx, y + 11, 'D' + d.no, { size: 7.5, bold: true, align: 'center' });
            p.text(cx, y + 20, Core.fmtDM(d.date), { size: 6, color: C.mute, align: 'center' });
            p.text(cx, y + 28, d.date ? Core.DAYS_SHORT[Core.dow(d.date)] : '', { size: 6, color: C.mute, align: 'center' });
          });
          const tx = MX + nameW + chunk.length * dayW;
          p.text(tx + tot / 2, y + 17, T('Dni'), { size: 7, bold: true, align: 'center' });
          p.text(tx + tot / 2, y + 27, T('pracy'), { size: 7, bold: true, align: 'center' });
          p.text(tx + tot + tot / 2, y + 17, T('Dni'), { size: 7, bold: true, align: 'center' });
          p.text(tx + tot + tot / 2, y + 27, T('wstrz.'), { size: 7, bold: true, align: 'center' });
          ctx.y += headH;
          dd.rows.forEach((r) => {
            if (ctx.y + rowH > PH - MB - 34) { newPage(); }
            p = ctx.page; y = ctx.y;
            p.text(MX + 4, y + 10.5, r.id, { size: 8, bold: true });
            p.text(MX + 28, y + 10.5, doc.wrap(r.name, 100, 8, true)[0], { size: 8, bold: true });
            p.text(MX + 133, y + 10.5, doc.wrap(r.actor || '', 88, 8)[0], { size: 8 });
            chunk.forEach((d, i) => {
              const code = r.codes[off + i];
              const x = MX + nameW + i * dayW;
              if (code) { p.rect(x + 0.5, y + 0.5, dayW - 1, rowH - 1, { fill: DOOD_BG[code] }); p.text(x + dayW / 2, y + 10.3, code, { size: 6.6, bold: true, align: 'center', color: C.ink }); }
            });
            p.text(tx + tot / 2, y + 10.5, String(r.work), { size: 8, bold: true, align: 'center' });
            p.text(tx + tot + tot / 2, y + 10.5, String(r.hold), { size: 8, align: 'center' });
            p.line(MX, y + rowH, MX + TW, y + rowH, { color: C.line, lw: 0.4 });
            ctx.y += rowH;
          });
          ctx.y += 8;
          ensure(40);
          let lx = MX;
          [['SW', T('start pracy')], ['W', T('praca')], ['WF', T('koniec pracy')], ['SWF', T('start i koniec jednego dnia')], ['H', T('wstrzymanie (bez grania)')]].forEach(([k, label]) => {
            ctx.page.rect(lx, ctx.y, 20, 10, { fill: DOOD_BG[k] });
            ctx.page.text(lx + 10, ctx.y + 7.6, k, { size: 6.4, bold: true, align: 'center' });
            ctx.page.text(lx + 25, ctx.y + 8, label, { size: 7.2, color: C.mute });
            lx += 25 + doc.text(label, 7.2) + 18;
          });
          ctx.y += 16;
        }
      }
    }

    /* ----- plan pracy (call sheet, A4 pionowo) ----- */
    const csDays = sections.includes('callsheet') ? data.days.filter((d) => d.kind === 'shoot' && (!opts.dayId || d.id === opts.dayId)) : [];
    csDays.forEach((d) => {
      const stDay = st.days.find((x) => x.id === d.id);
      const sh = Core.sheetOf(st, d.id);
      const crows = Core.callRows(st, stDay);
      const times = Core.dayTimes(st, stDay);
      const label = T('Plan pracy · Dzień {n}', { n: d.no });
      if (!began) { began = true; ctx.section = label; } else startSection(label, 'p');
      const call = sh.crewCall || d.call;
      const lunch = Core.lunchOf(st, stDay);
      callBand(T('PLAN PRACY · DZIEŃ {n}', { n: d.no }), Core.fmtDatePL(d.date), Core.keyPeople(st));
      const scs = Core.sheetScenes(st, stDay);
      const info = [[T('Zbiórka ekipy'), call, 1, 'big'], [T('Obiad'), lunch ? lunch.label : '', 1, true], [T('Przewidywany koniec'), times && times.known ? Core.clock(times.end) : '', 1], [T('Czas pracy'), times && times.known ? Core.fmtDur(times.work) : '', 1],
        [T('Sceny w planie'), `${scs.length} · ${Core.fmtEighths(scs.reduce((a, s) => a + s.eighths, 0))} ${T('str.')}`, 1], [T('Wschód słońca'), sh.sunrise, 1], [T('Zachód słońca'), sh.sunset, 1], [T('Pogoda'), sh.weather, 1],
        [T('Szpital / pogotowie'), sh.hospital, 4]];
      const iw = CW / 4;
      ensure(120);
      ctx.y += 4;
      let col = 0, rowMax = 0;
      info.forEach(([lab, val, span, hl]) => {
        if (col + span > 4) { ctx.y += rowMax; col = 0; rowMax = 0; }
        const x = MX + col * iw;
        if (hl === true && val) ctx.page.rect(x + 1, ctx.y + 1, iw * span - 4, 26, { fill: C.warn });
        ctx.page.text(x + 4, ctx.y + 8, lab.toUpperCase(), { size: 6.6, bold: true, color: C.mute });
        const ls = doc.wrap(val || '—', iw * span - 12, hl ? 12 : 9).slice(0, 3);
        ls.forEach((ln, k) => ctx.page.text(x + 4, ctx.y + (hl ? 21 : 19) + k * 11, ln, hl ? { size: 12, bold: true, color: val ? C.ink : C.mute } : { size: 9, color: val ? C.ink : C.mute }));
        rowMax = Math.max(rowMax, (hl ? 29 : 24) + (ls.length - 1) * 11);
        col += span;
      });
      ctx.y += rowMax + 4;
      if (sh.contacts.length) {
        subhead(T('Ważne kontakty'));
        table([{ w: 150, bold: true }, { w: 200 }, { w: CW - 350 }], sh.contacts.map((c) => ({ cells: [c.role, c.name, c.phone] })), { header: H(['Funkcja', 'Imię i nazwisko', 'Telefon']), vlines: true, keep: 20 });
      }
      subhead(T('Harmonogram dnia'));
      const rows = [];
      crows.forEach((r) => {
        if (r.prep) rows.push({ cells: [`${Core.minToTime(r.fromMin - r.prep)}–${r.from}`, '', '', T('Przestawka / przygotowanie'), '', '', ''], bg: C.prep, color: C.mute, size: 7 });
        rows.push({ cells: [hm(r), r.num, r.shot, r.desc, r.cast, r.camera, r.notes], bg: r.kind === 'custom' ? C.band : r.bg, bold: r.kind === 'custom' });
      });
      if (!rows.length) textBlock(T('Harmonogram jest pusty.'), { color: C.mute });
      else table([{ w: 58, align: 'center', bold: true }, { w: 26, align: 'center', bold: true }, { w: 30, align: 'center' }, { w: 158 }, { w: 58, align: 'center' }, { w: 96 }, { w: CW - 426 }],
        rows, { header: H(['Godz.', 'Sc.', 'Uj.', 'Opis / plan', 'Obsada', 'Elementy kamerowe', 'Uwagi']), vlines: true, keep: 20 });
      const castIds = Core.sheetCastIds(st, stDay), cm = Core.castMap(st);
      if (castIds.length) {
        subhead(T('Obsada i zbiórki'));
        const crew = castIds.map((id) => cm.get(id)).filter(Boolean).map((c) => {
          const cc = sh.cast[c.id] || {};
          return { cells: [c.id, c.name, c.actor, cc.call || d.call || '', cc.makeup || '', cc.onset || '', scs.filter((s) => s.cast.includes(c.id)).map((s) => s.num).join(', '), cc.note || ''] };
        });
        table([{ w: 22, align: 'center', bold: true }, { w: 95, bold: true }, { w: 95 }, { w: 42, align: 'center', bold: true }, { w: 48, align: 'center' }, { w: 42, align: 'center' }, { w: 50 }, { w: CW - 394 }],
          crew, { header: H(['Nr', 'Postać', 'Aktor / aktorka', 'Zbiórka', 'Charakt.', 'Na plan', 'Sceny', 'Uwagi']), vlines: true, keep: 20 });
      }
      const loc = Core.locationsText(st, stDay);
      if (loc.trim()) { subhead(T('Lokacje')); textBlock(loc, { size: 8.5 }); }
      const trips = Core.transportData(st, d.id).trips;
      if (trips.length || sh.transportNote) {
        subhead(T('Transport'));
        if (trips.length) table([{ w: 36, align: 'center', bold: true }, { w: 70 }, { w: 85 }, { w: 90 }, { w: 90 }, { w: 90 }, { w: CW - 461 }],
          trips.map((t) => ({ cells: [t.time, t.vehicle ? t.vehicle.name : '', t.vehicle ? [t.vehicle.driver, t.vehicle.phone].filter(Boolean).join(' ') : '', t.from, t.to, t.who, t.note] })),
          { header: H(['Godz.', 'Pojazd', 'Kierowca', 'Skąd', 'Dokąd', 'Kto / co', 'Uwagi']), vlines: true, keep: 20 });
        if (sh.transportNote) textBlock(sh.transportNote, { size: 8.5 });
      }
      if (sh.cameraNotes) { subhead(T('Elementy kamerowe')); textBlock(sh.cameraNotes, { size: 8.5 }); }
      const notes = [d.note, sh.notes].filter(Boolean).join('\n');
      if (notes) { subhead(T('Uwagi')); textBlock(notes, { size: 8.5 }); }
      // mapki lokacji i dojazdu
      const maps = (sh.maps || []).filter((m) => st.media[m.media]);
      if (maps.length) {
        subhead(T('Mapki i dojazd'));
        maps.forEach((m) => {
          const im = st.media[m.media];
          let bytes;
          try { bytes = b64(im.data); } catch (e) { return; }
          doc.addImage(m.media, bytes, im.w, im.h);
          const maxH = 330;
          let w = CW, h = (CW * im.h) / im.w;
          if (h > maxH) { h = maxH; w = (maxH * im.w) / im.h; }
          const capLines = m.caption ? doc.wrap(m.caption, CW - 6, 8.5) : [];
          if (ctx.y + h + capLines.length * 11 + 10 > PH - MB) newPage();
          const x = MX + (CW - w) / 2;
          ctx.page.image(m.media, x, ctx.y, w, h);
          ctx.page.rect(x, ctx.y, w, h, { stroke: C.line, lw: 0.6 });
          ctx.y += h + 4;
          capLines.forEach((ln) => { ctx.page.text(MX + CW / 2, ctx.y + 8, ln, { size: 8.5, color: C.ink, align: 'center' }); ctx.y += 11; });
          ctx.y += 10;
        });
      }
    });

    /* ----- raporty dzienne (A4 pionowo) ----- */
    const STATUS_TXT = { done: T('Nakręcona'), part: T('Częściowo'), none: T('Nie nakręcona') };
    const signedMin = (plan, actual) => {
      const a = Core.timeToMin(plan), b = Core.timeToMin(actual);
      if (a == null || b == null) return '';
      let d = b - a; if (d < -720) d += 1440; else if (d > 720) d -= 1440;
      return d === 0 ? '0:00' : (d > 0 ? '+' : '−') + Core.fmtHM(Math.abs(d));
    };
    const dprDays = sections.includes('dpr') ? data.days.filter((d) => d.kind === 'shoot' && (opts.dayId ? d.id === opts.dayId : !!(st.dpr && st.dpr[d.id]))) : [];
    if (sections.includes('dpr') && !dprDays.length) { begin(T('Raporty dzienne'), 'p'); textBlock(T('Nie ma jeszcze raportów dziennych. Uzupełnij je w zakładce „Raport dzienny” po dniu zdjęciowym.'), { color: C.mute }); }
    dprDays.forEach((d) => {
      const stDay = st.days.find((x) => x.id === d.id);
      const r = Core.dprOf(st, d.id), s = Core.dprSummary(st, stDay);
      const label = T('Raport dzienny · Dzień {n}', { n: d.no });
      if (!began) { began = true; ctx.section = label; } else startSection(label, 'p');
      docBand(T('RAPORT DZIENNY · DZIEŃ {n}', { n: d.no }), Core.fmtDatePL(d.date), T('Nakręcono {a} z {b} str.', { a: Core.fmtEighths(s.shot), b: Core.fmtEighths(s.planned) }) + (r.closed ? '' : '   ·   ' + T('wersja robocza')));
      const pct = s.cum.total ? Math.round((s.cum.shot / s.cum.total) * 100) : 0;
      const info = [
        [T('Sceny nakręcone'), `${s.scenesDone} / ${s.rows.length}` + (s.scenesPart ? ' · ' + T('{n} częściowo', { n: s.scenesPart }) : ''), 1, true],
        [T('Strony'), `${Core.fmtEighths(s.shot)} / ${Core.fmtEighths(s.planned)}`, 1, true],
        [T('Ujęcia'), s.setups ? String(s.setups) : '', 1],
        [T('Statyści'), r.extras, 1],
        [T('Czas pracy'), s.actual.work != null ? Core.fmtDur(s.actual.work) + (s.overtime ? ' (' + T('nadgodziny {d}', { d: Core.fmtDur(s.overtime) }) + ')' : '') : '', 2, !!s.overtime],
        [T('Postęp zdjęć'), `${pct}% · ${Core.fmtEighths(s.cum.shot)} / ${Core.fmtEighths(s.cum.total)} ${T('str.')} · ` + (s.cum.delta === 0 ? T('zgodnie z planem') : s.cum.delta < 0 ? T('opóźnienie {e} str.', { e: Core.fmtEighths(-s.cum.delta) }) : T('wyprzedzenie {e} str.', { e: Core.fmtEighths(s.cum.delta) })), 2],
      ];
      const iw = CW / 4;
      ensure(90); ctx.y += 4;
      let col = 0, rowMax = 0;
      info.forEach(([lab, val, span, hl]) => {
        if (col + span > 4) { ctx.y += rowMax; col = 0; rowMax = 0; }
        const x = MX + col * iw;
        if (hl && val) ctx.page.rect(x + 1, ctx.y + 1, iw * span - 4, 26, { fill: C.warn });
        ctx.page.text(x + 4, ctx.y + 8, lab.toUpperCase(), { size: 6.6, bold: true, color: C.mute });
        const ls = doc.wrap(val || '—', iw * span - 12, 10).slice(0, 2);
        ls.forEach((ln, k) => ctx.page.text(x + 4, ctx.y + 20 + k * 11, ln, { size: 10, bold: !!hl, color: val ? C.ink : C.mute }));
        rowMax = Math.max(rowMax, 26 + (ls.length - 1) * 11);
        col += span;
      });
      ctx.y += rowMax + 4;
      subhead(T('Godziny: plan i rzeczywistość'));
      const lunchPlan = s.plan.lunch ? s.plan.lunch.split('–')[0] : '';
      table([{ w: 170, bold: true }, { w: 110, align: 'center' }, { w: 110, align: 'center', bold: true }, { w: CW - 390, align: 'center' }], [
        { cells: [T('Zbiórka ekipy'), s.plan.call, r.crewCall, signedMin(s.plan.call, r.crewCall)] },
        { cells: [T('Pierwsze ujęcie'), s.plan.firstShot, r.firstShot, signedMin(s.plan.firstShot, r.firstShot)] },
        { cells: [T('Obiad'), s.plan.lunch, [r.lunchFrom, r.lunchTo].filter(Boolean).join('–'), signedMin(lunchPlan, r.lunchFrom)] },
        { cells: [T('Koniec zdjęć (kamera)'), s.plan.wrap, r.camWrap, signedMin(s.plan.wrap, r.camWrap)] },
        { cells: [T('Koniec pracy ekipy'), s.plan.wrap, r.crewWrap, signedMin(s.plan.wrap, r.crewWrap)] },
      ], { header: H(['Pozycja', 'Plan', 'Rzeczywistość', 'Różnica']), vlines: true, keep: 20 });
      subhead(T('Sceny'));
      const srows = s.rows.map((x) => ({ cells: [x.scene.num, (x.scene.place || x.scene.site || '') + (x.moved ? ' (' + T('przeniesiona') + ')' : ''), Core.fmtEighths(x.planned), STATUS_TXT[x.status] || '—', x.shot ? Core.fmtEighths(x.shot) : '—', x.setups || '', x.note], bg: Core.stripBg(x.scene) }));
      srows.push({ cells: ['', T('Razem'), Core.fmtEighths(s.planned), '', Core.fmtEighths(s.shot), s.setups || '', ''], bg: C.band, bold: true });
      if (s.rows.length) table([{ w: 30, align: 'center', bold: true }, { w: 150 }, { w: 36, align: 'center' }, { w: 70, align: 'center', bold: true }, { w: 50, align: 'center' }, { w: 36, align: 'center' }, { w: CW - 372 }],
        srows, { header: H(['Sc.', 'Plan / lokacja', 'Str.', 'Status', 'Nakręcono', 'Uj.', 'Uwagi']), vlines: true, keep: 20 });
      else textBlock(T('Ten dzień nie ma scen w planie.'), { color: C.mute });
      const cm = Core.castMap(st);
      const castRows = Object.entries(r.cast || {}).map(([cid, cc]) => ({ c: cm.get(+cid), cc })).filter((x) => x.c && (x.cc.arrive || x.cc.onSet || x.cc.wrap || x.cc.note));
      if (castRows.length) {
        subhead(T('Obsada'));
        table([{ w: 24, align: 'center', bold: true }, { w: 110, bold: true }, { w: 110 }, { w: 50, align: 'center' }, { w: 50, align: 'center' }, { w: 50, align: 'center' }, { w: CW - 394 }],
          castRows.map(({ c, cc }) => ({ cells: [c.id, c.name, c.actor, cc.arrive || '', cc.onSet || '', cc.wrap || '', cc.note || ''] })),
          { header: H(['Nr', 'Postać', 'Aktor / aktorka', 'Przyjazd', 'Na planie', 'Koniec', 'Uwagi']), vlines: true, keep: 20 });
      }
      [[T('Opóźnienia i przestoje'), r.delays], [T('Wypadki i zdarzenia BHP'), r.incidents], [T('Sprzęt (awarie, braki, zwroty)'), r.equipment], [T('Uwagi ogólne'), r.notes]].forEach(([h, txt]) => { if (txt) { subhead(h); textBlock(txt, { size: 8.5 }); } });
      ensure(50); ctx.y += 22;
      ctx.page.line(MX, ctx.y, MX + 200, ctx.y, { color: C.mute, lw: 0.6 });
      ctx.page.text(MX, ctx.y + 10, T('Kierownik produkcji') + (st.meta.manager ? ': ' + st.meta.manager : ''), { size: 7.5, color: C.mute });
      ctx.page.line(PW - MX - 200, ctx.y, PW - MX, ctx.y, { color: C.mute, lw: 0.6 });
      ctx.page.text(PW - MX - 200, ctx.y + 10, T('II reżyser'), { size: 7.5, color: C.mute });
      ctx.y += 18;
    });

    /* ----- transport ----- */
    if (sections.includes('transport')) {
      begin(T('Plan transportów'), 'l');
      const td = Core.transportData(st, opts.dayId);
      if (!opts.dayId) {
        subhead(T('Pojazdy i kierowcy'));
        if (!td.vehicles.length) textBlock(T('Nie dodano jeszcze pojazdów.'), { color: C.mute });
        else table([{ w: 170, bold: true }, { w: 130 }, { w: 90 }, { w: 170 }, { w: 110 }, { w: 116 }], td.vehicles.map((v) => ({ cells: [v.name, T(v.type), v.plate, v.driver, v.phone, v.note] })),
          { header: H(['Pojazd', 'Typ', 'Nr rej.', 'Kierowca', 'Telefon', 'Uwagi']), vlines: true, keep: 20 });
      }
      const byDay = new Map();
      td.trips.forEach((t) => { if (!byDay.has(t.dayId)) byDay.set(t.dayId, []); byDay.get(t.dayId).push(t); });
      if (!td.trips.length) textBlock(T('Nie zaplanowano jeszcze kursów.'), { color: C.mute });
      byDay.forEach((trips, dayId) => {
        const d = data.days.find((x) => x.id === dayId); if (!d) return;
        ctx.y += 8;
        const band = () => docBand(d.title.toUpperCase(), Core.fmtDatePL(d.date), trips.length + ' ' + Core.pl(trips.length, 'kurs', 'kursy', 'kursów'), Core.KIND_BG[d.kind]);
        band();
        table([{ w: 46, align: 'center', bold: true }, { w: 130 }, { w: 100 }, { w: 150 }, { w: 150 }, { w: 130 }, { w: 80 }],
          trips.map((t) => ({ cells: [t.time, t.vehicle ? t.vehicle.name : '—', t.vehicle ? [t.vehicle.driver, t.vehicle.phone].filter(Boolean).join(' ') : '', t.from, t.to, t.who, t.note] })),
          { header: H(['Godz.', 'Pojazd', 'Kierowca', 'Skąd', 'Dokąd', 'Kto / co', 'Uwagi']), vlines: true, keep: 20, contBand: () => docBand(d.title.toUpperCase() + ' ' + T('(cd.)'), Core.fmtDatePL(d.date), '', Core.KIND_BG[d.kind]) });
      });
    }

    /* ----- kosztorys ----- */
    if (sections.includes('budget')) {
      begin(T('Kosztorys'));
      const bd = Core.budgetData(st);
      const diff = (dev, a) => (a ? money(dev) : '—');
      subhead(T('Podsumowanie budżetu'));
      const srows = bd.cats.map((c) => ({ cells: [c.label, money(c.est), c.act ? money(c.act) : '—', diff(c.dev, c.act), bd.est ? Math.round((c.est / bd.est) * 100) + '%' : '—'] }));
      srows.push({ cells: [T('RAZEM'), money(bd.est), bd.act ? money(bd.act) : '—', diff(bd.dev, bd.act), bd.est ? '100%' : '—'], bg: C.band, bold: true });
      table([{ w: 330, bold: true }, { w: 130, align: 'right' }, { w: 130, align: 'right' }, { w: 120, align: 'right' }, { w: 76, align: 'center' }], srows, { header: H(['Pion', 'Planowany', 'Rzeczywisty', 'Różnica', 'Udział']), vlines: true, keep: 20 });
      const fxs = bd.conv.filter((x) => x.est != null);
      if (fxs.length) { const fi = Core.fxInfo(st); textBlock(T('Przeliczenie planu:') + ' ' + fxs.map((x) => Core.fmtMoney(x.est, x.cur)).join('  ·  ') + (fi ? '  (' + T('kursy {s} z dnia {d}', { s: fi.src || 'NBP', d: fi.date || '—' }) + ')' : ''), { size: 7.8, color: C.mute }); }
      textBlock(T('Różnica = koszt rzeczywisty minus planowany, liczona tylko dla pozycji z wpisanym kosztem rzeczywistym (wartość dodatnia oznacza przekroczenie).'), { size: 7.2, color: C.mute });
      bd.cats.filter((c) => c.items.length).forEach((c) => {
        subhead(c.label);
        const rows = c.items.map((i) => ({ cells: [i.name, i.dayTag || '', i.site || '', money(i.est), i.act ? money(i.act) : '—', i.act ? money(i.act - i.est) : '—'] }));
        rows.push({ cells: [T('Razem') + ': ' + c.label, '', '', money(c.est), c.act ? money(c.act) : '—', diff(c.dev, c.act)], bg: C.band, bold: true });
        table([{ w: 300 }, { w: 60, align: 'center' }, { w: 150 }, { w: 100, align: 'right' }, { w: 100, align: 'right' }, { w: 76, align: 'right' }], rows, { header: H(['Pozycja', 'Dzień', 'Obiekt', 'Planowany', 'Rzeczywisty', 'Różnica']), vlines: true, keep: 20 });
      });
    }

    // stopki z numerami stron
    const total = doc.pages.length;
    doc.pages.forEach((pg, i) => {
      pg.line(MX, pg.h - 26, pg.w - MX, pg.h - 26, { color: C.line, lw: 0.5 });
      pg.text(MX, pg.h - 15, [st.meta.company, st.meta.producer && T('Producent') + ': ' + st.meta.producer].filter(Boolean).join('   ·   ') || 'Klaps', { size: 7.5, color: C.mute });
      pg.text(pg.w - MX, pg.h - 15, T('Strona {i} z {n}', { i: i + 1, n: total }), { size: 7.5, color: C.mute, align: 'right' });
    });
    return doc;
  }

  /* ============================== EXCEL ============================== */
  const BORDER = { all: 'thin', color: 'C3CAD0' };

  async function buildXlsx(st, sections, opts) {
    Core.setCurrency(st.budget && st.budget.currency);
    if (docLang(st, opts || {}) === 'en') await ensureEn();
    opts = opts || {};
    const wb = I18N.withLang(docLang(st, opts), () => composeXlsx(st, sections || SECTIONS.map((s) => s[0]), opts));
    return await wb.build();
  }
  function composeXlsx(st, sections, opts) {
    const data = Core.reportData(st);
    const nums = Core.dayNumbers(st);
    const wb = new Xlsx.Workbook({ title: titleOf(st) + ' – ' + T('kalendarz zdjęciowy'), creator: st.meta.company || 'Klaps', footer: titleOf(st) });
    const hStyle = { b: true, color: 'FFFFFF', bg: '26323B', h: 'center', wrap: true, border: BORDER };
    const titleBlock = (sh, ncols, subtitle) => {
      sh.set(1, 1, titleOf(st).toUpperCase(), { b: true, sz: 16, color: '1B2229' });
      sh.merge(1, 1, 1, ncols); sh.rowHeight(1, 26);
      sh.set(2, 1, subtitle + '  ·  ' + T('stan na {d}', { d: nowText() }), { sz: 9, color: '5C6670', b: true });
      sh.merge(2, 1, 2, ncols);
      const info = [st.meta.director && T('Reżyser') + ': ' + st.meta.director, st.meta.producer && T('Producent') + ': ' + st.meta.producer, st.meta.manager && T('Kier. prod.') + ': ' + st.meta.manager, st.meta.scriptVersion && T('Wersja scenariusza') + ': ' + st.meta.scriptVersion].filter(Boolean).join('   ·   ');
      sh.set(3, 1, info, { sz: 9, color: '5C6670' });
      sh.merge(3, 1, 3, ncols);
    };
    const pagesFormula = (cell, val) => ({ f: `IF(${cell}=0,"",IF(INT(${cell}/8)>0,INT(${cell}/8)&" ","")&IF(MOD(${cell},8)>0,MOD(${cell},8)&"/8",""))`, v: Core.fmtEighths(val) === '0' ? '' : Core.fmtEighths(val) });
    const sheetName = (s) => T(s).slice(0, 31);

    /* --- Kalendarzówka --- */
    if (sections.includes('calendar')) {
      const sh = wb.addSheet(sheetName('Kalendarzówka'), { tab: '0D6B73' });
      const widths = [7, 7, 6, 34, 48, 14, 9, 8, 30];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      const N = widths.length;
      titleBlock(sh, N, T('KALENDARZ ZDJĘCIOWY'));
      let r = 5;
      const heads = H(['Sc.', 'W/Z', 'D/N', 'Plan / lokacja', 'Opis', 'Obsada', 'Str.', 'Ósemki', 'Uwagi']);
      const band = (txt, right, bg) => {
        for (let c = 1; c <= N; c++) sh.set(r, c, null, { bg });
        sh.set(r, 1, txt, { b: true, sz: 12, color: 'FFFFFF', bg });
        sh.merge(r, 1, r, 6);
        if (right) { sh.set(r, 7, right, { color: 'FFFFFF', bg, h: 'right', sz: 10 }); sh.merge(r, 7, r, N); }
        sh.rowHeight(r, 22);
        r++;
      };
      for (const d of data.days) {
        if (d.kind !== 'shoot') {
          const right = d.kind === 'off' ? d.note || '' : [d.call && (d.end ? `${d.call}–${d.end}` : `${T('Start')} ${d.call}`), d.site].filter(Boolean).join('  ·  ');
          band(`${d.title.toUpperCase()}  ·  ${Core.fmtDatePL(d.date)}`, right, Core.KIND_BG[d.kind]);
          if (d.kind !== 'off' && d.note) { sh.set(r, 1, d.note, { sz: 9, color: '5C6670', wrap: true }); sh.merge(r, 1, r, N); r++; }
          r++; continue;
        }
        band(`${d.title.toUpperCase()}  ·  ${Core.fmtDatePL(d.date)}`, `${T('Zbiórka')} ${d.call || '—'}`, '26323B');
        heads.forEach((h, i) => sh.set(r, i + 1, h, hStyle));
        r++;
        const first = r;
        for (const x of d.rows) {
          const base = { bg: x.bg, border: BORDER, v: 'center' };
          sh.set(r, 1, x.num, Object.assign({}, base, { b: true, h: 'center' }));
          sh.set(r, 2, x.ieLabel, Object.assign({}, base, { h: 'center' }));
          sh.set(r, 3, x.todShort, Object.assign({}, base, { h: 'center' }));
          sh.set(r, 4, x.place, Object.assign({}, base, { wrap: true }));
          sh.set(r, 5, x.synopsis, Object.assign({}, base, { wrap: true }));
          sh.set(r, 6, x.castText, Object.assign({}, base, { wrap: true }));
          sh.set(r, 7, x.pages, Object.assign({}, base, { h: 'center' }));
          sh.set(r, 8, x.eighths, Object.assign({}, base, { h: 'center' }));
          sh.set(r, 9, x.notes, Object.assign({}, base, { wrap: true }));
          const lines = Math.max(1, Math.ceil((x.synopsis || '').length / 52), Math.ceil((x.place || '').length / 36));
          sh.rowHeight(r, Math.max(16, lines * 13 + 3));
          r++;
        }
        const last = r - 1;
        const tot = { b: true, bg: 'E4EAEF', border: BORDER, h: 'center' };
        for (let c = 1; c <= N; c++) sh.set(r, c, null, tot);
        sh.set(r, 4, `${T('Razem')}: ${d.rows.length} ${Core.pl(d.rows.length, 'scena', 'sceny', 'scen')}`, { b: true, bg: 'E4EAEF', border: BORDER });
        sh.set(r, 5, d.sites.join(' · '), { bg: 'E4EAEF', border: BORDER, wrap: true, sz: 9 });
        if (d.rows.length) {
          sh.set(r, 8, { f: `SUM(H${first}:H${last})`, v: d.eighths }, tot);
          sh.set(r, 7, pagesFormula('H' + r, d.eighths), tot);
        }
        r++;
        if (d.cast.length) { sh.set(r, 1, T('Obsada dnia') + ': ' + d.cast.map((c) => `${c.id} ${c.name}${c.actor ? ' (' + c.actor + ')' : ''}`).join('   ·   '), { sz: 9, wrap: true, v: 'top' }); sh.merge(r, 1, r, N); sh.rowHeight(r, 14 + 12 * Math.floor(d.cast.map((c) => c.name + (c.actor || '')).join('').length / 150)); r++; }
        if (d.note) { sh.set(r, 1, T('Uwagi') + ': ' + d.note, { sz: 9, color: '5C6670', wrap: true }); sh.merge(r, 1, r, N); r++; }
        r++;
      }
      if (data.unscheduled.length) {
        band(T('SCENY NIEZAPLANOWANE ({n})', { n: data.unscheduled.length }), '', '8A949D');
        heads.forEach((h, i) => sh.set(r, i + 1, h, hStyle));
        r++;
        for (const x of data.unscheduled) {
          const base = { bg: x.bg, border: BORDER, v: 'center' };
          [x.num, x.ieLabel, x.todShort, x.place, x.synopsis, x.castText, x.pages, x.eighths, x.notes].forEach((val, i) => {
            sh.set(r, i + 1, val, Object.assign({}, base, { wrap: i === 3 || i === 4 || i === 5 || i === 8, h: [0, 1, 2, 6, 7].includes(i) ? 'center' : undefined, b: i === 0 }));
          });
          r++;
        }
      }
      sh.opts.printTitles = '$1:$2';
    }

    /* --- Rozpiska scen --- */
    if (sections.includes('board')) {
      const sh = wb.addSheet(sheetName('Rozpiska scen'), { tab: 'C9A227', freeze: { row: 5, col: 3 } });
      const widths = [7, 7, 6, 32, 20, 46, 12, 28, 9, 8, 9, 12, 8, 28, 30, 20];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, T('ROZPISKA SCEN'));
      H(['Sc.', 'W/Z', 'D/N', 'Plan / lokacja', 'Obiekt', 'Opis', 'Obsada (nr)', 'Obsada', 'Str.', 'Ósemki', 'Dzień zdj.', 'Data', 'Strona', 'Elementy', 'Uwagi', 'Rewizja']).forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      sh.rowHeight(5, 26);
      const dayDate = new Map(data.days.filter((d) => d.kind === 'shoot').map((d) => [d.no, d.date]));
      let r = 6;
      const labelOf = new Map(Core.ELEMENT_CATS.map(([k, l]) => [k, T(l)]));
      data.scenes.forEach((x) => {
        const base = { bg: x.bg, border: BORDER, v: 'center' };
        const el = Object.entries(x.elements).filter(([, v]) => v && v.length).map(([k, v]) => `${labelOf.get(k) || k}: ${v.join(', ')}`).join('; ');
        const vals = [x.num, x.ieLabel, x.todShort, x.place, x.site, x.synopsis, x.castText, x.castNames.join(', '), x.pages, x.eighths, x.dayNo ? 'D' + x.dayNo : '', x.dayNo ? { date: dayDate.get(x.dayNo) } : '', x.page || '', el, x.notes];
        vals.forEach((val, i) => {
          sh.set(r, i + 1, val, Object.assign({}, base, { b: i === 0, h: [0, 1, 2, 8, 9, 10, 11, 12].includes(i) ? 'center' : undefined, wrap: [3, 5, 7, 13, 14].includes(i), fmt: i === 11 ? 'dd.mm.yyyy' : undefined }));
        });
        sh.set(r, 16, x.rev ? `R${x.rev.n} ${x.rev.name}` : '', Object.assign({}, base, { bg: x.rev ? x.rev.bg : x.bg, wrap: true }));
        sh.rowHeight(r, Math.max(16, Math.ceil((x.synopsis || '').length / 52) * 13 + 3));
        r++;
      });
      const tot = { b: true, bg: 'E4EAEF', border: BORDER, h: 'center' };
      for (let c = 1; c <= widths.length; c++) sh.set(r, c, null, tot);
      sh.set(r, 4, `${T('Razem')}: ${data.scenes.length} ${Core.pl(data.scenes.length, 'scena', 'sceny', 'scen')}`, { b: true, bg: 'E4EAEF', border: BORDER });
      if (data.scenes.length) {
        sh.set(r, 10, { f: `SUM(J6:J${r - 1})`, v: data.totals.eighths }, tot);
        sh.set(r, 9, pagesFormula('J' + r, data.totals.eighths), tot);
        sh.opts.filter = `A5:${Xlsx.colName(widths.length)}${r - 1}`;
      }
      sh.opts.printTitles = '$5:$5';
    }

    /* --- Shotlista --- */
    if (sections.includes('shotlist')) {
      const sh = wb.addSheet(sheetName('Shotlista'), { tab: '7A4FB5', freeze: { row: 5 } });
      const widths = [8, 9, 10, 46, 14, 18, 11, 28, 26];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, T('SHOTLISTA'));
      H(['Scena', 'Ujęcie', 'Typ planu', 'Opis', 'Obiektyw', 'Grip', 'ETA (min)', 'Aktorzy', 'Lokacja']).forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      sh.rowHeight(5, 26);
      const sr = Core.shotRows(st);
      let r = 6;
      sr.forEach((x) => {
        const base = { bg: x.bg || undefined, border: BORDER, v: 'center' };
        const eta = x.etaMin != null ? x.etaMin : x.eta;
        [x.num, x.shot, x.type, x.desc, x.lens, x.grip, eta, x.cast, x.site].forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, base, { b: i === 0 || i === 2, h: [0, 1, 2, 6].includes(i) ? 'center' : undefined, wrap: [3, 7, 8].includes(i) })));
        sh.rowHeight(r, Math.max(16, Math.ceil((x.desc || '').length / 50) * 13 + 3));
        r++;
      });
      if (sr.length) {
        const tot = { b: true, bg: 'E4EAEF', border: BORDER, h: 'center' };
        for (let c = 1; c <= widths.length; c++) sh.set(r, c, null, tot);
        sh.set(r, 4, `${T('Razem')}: ${sr.length} ${Core.pl(sr.length, 'ujęcie', 'ujęcia', 'ujęć')}`, { b: true, bg: 'E4EAEF', border: BORDER });
        sh.set(r, 7, { f: `SUM(G6:G${r - 1})`, v: sr.reduce((a, x) => a + (x.etaMin || 0), 0) }, tot);
        sh.opts.filter = `A5:I${r - 1}`;
        r++;
      }
      r += 1;
      sh.set(r, 1, T('LEGENDA – TYPY PLANU'), { b: true, sz: 10, color: '5C6670' }); r++;
      Core.SHOT_TYPES.forEach(([k, n, d]) => {
        sh.set(r, 1, k, { b: true, border: BORDER, h: 'center', bg: 'E4EAEF' });
        sh.set(r, 2, T(n), { b: true, border: BORDER }); sh.set(r, 3, null, { border: BORDER }); sh.merge(r, 2, r, 3);
        sh.set(r, 4, T(d), { border: BORDER, wrap: true }); for (let c = 5; c <= 9; c++) sh.set(r, c, null, { border: BORDER }); sh.merge(r, 4, r, 9);
        r++;
      });
      sh.opts.printTitles = '$5:$5';
    }

    /* --- Obsada (wszystkie dane aktorów, także wewnętrzne) --- */
    if (sections.includes('cast')) {
      const sh = wb.addSheet(sheetName('Obsada'), { tab: '3C7DD9', freeze: { row: 5, col: 2 } });
      const widths = [6, 22, 24, 16, 26, 20, 18, 9, 16, 22, 22, 8, 8, 9, 22, 34, 30];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, T('OBSADA'));
      H(['Nr', 'Postać', 'Aktor / aktorka', 'Telefon', 'E-mail', 'Typ umowy', 'Stawka', 'Nocleg', 'Dieta', 'Uwagi do diety', 'Transport', 'Sceny', 'Ósemki', 'Dni zdj.', 'Dni zdjęciowe', 'Numery scen', 'Uwagi']).forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      sh.rowHeight(5, 26);
      let r = 6;
      data.cast.forEach((c) => {
        const b = { border: BORDER, v: 'center', wrap: true };
        [c.id, c.name, c.actor, c.phone, c.email, c.contract, c.rate, c.lodging ? T(c.lodging) : '', Core.dietLabel(c.diet), c.dietNote, c.transport, c.scenes, c.eighths, c.days.length, c.days.map((n) => 'D' + n).join(', '), c.sceneNums.join(', '), c.notes]
          .forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, b, { b: i < 2, h: [0, 7, 11, 12, 13].includes(i) ? 'center' : undefined })));
        sh.rowHeight(r, Math.max(16, Math.ceil(Math.max(c.sceneNums.join(', ').length / 34, (c.notes || '').length / 30, 1)) * 13 + 3));
        r++;
      });
      if (data.cast.length) sh.opts.filter = `A5:Q${r - 1}`;
      sh.set(r + 1, 1, T('Arkusz zawiera także dane wewnętrzne (umowy, stawki). Do wysyłki użyj pliku PDF, który ma tylko dane podstawowe.'), { sz: 9, color: '5C6670' });
      sh.opts.printTitles = '$5:$5';
    }

    /* --- Ekipa (wszystkie dane, także wewnętrzne) i dni pracy --- */
    if (sections.includes('crew')) {
      const sh = wb.addSheet(sheetName('Ekipa'), { tab: '2F8F83', freeze: { row: 5 }, portrait: true });
      const widths = [6, 16, 20, 20, 24, 16, 26, 20, 18, 9, 20, 24, 22, 14, 34];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, T('EKIPA FILMOWA'));
      H(['Lp.', 'Imię', 'Nazwisko', 'Pion', 'Funkcja', 'Telefon', 'E-mail', 'Typ umowy', 'Stawka', 'Nocleg', 'Dieta', 'Uwagi do diety', 'Transport', 'Dni pracy', 'Uwagi']).forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      sh.rowHeight(5, 26);
      let r = 6, k = 0;
      const work = st.days.filter((d) => d.kind !== 'off');
      Core.crewGroups(st).forEach((g) => g.list.forEach((c) => {
        k += 1;
        const b = { border: BORDER, v: 'center', wrap: true };
        const nDays = work.filter((d) => Core.crewWorks(c, d)).length;
        [k, c.first, c.last, g.key === '__none' ? '' : g.dept, c.role, c.phone, c.email, c.contract, c.rate, c.lodging ? T(c.lodging) : '', Core.dietLabel(c.dietType), c.dietNote, c.transport, nDays, c.notes].forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, b, { h: i === 0 || i === 9 || i === 13 ? 'center' : undefined, b: i === 1 || i === 2 })));
        r++;
      }));
      if (k) sh.opts.filter = `A5:O${r - 1}`;
      sh.set(r + 1, 1, T('Arkusz zawiera także dane wewnętrzne (umowy, stawki). Do wysyłki ekipie użyj pliku PDF, który ma tylko dane podstawowe.'), { sz: 9, color: '5C6670' });
      sh.opts.printTitles = '$5:$5';
      if (work.length && st.crew.length) {
        const sd = wb.addSheet(sheetName('Dni pracy ekipy'), { tab: '2F8F83', freeze: { row: 7, col: 3 } });
        sd.colWidth(1, 24); sd.colWidth(2, 20);
        work.forEach((d, i) => sd.colWidth(3 + i, 7.5));
        sd.colWidth(3 + work.length, 9);
        titleBlock(sd, Math.max(4, 3 + work.length), T('DNI PRACY EKIPY'));
        const hs = { b: true, bg: 'D5DDE3', h: 'center', border: BORDER, wrap: true };
        sd.set(5, 1, T('Imię i nazwisko'), hs); sd.set(5, 2, T('Funkcja'), hs); sd.merge(5, 1, 6, 1); sd.merge(5, 2, 6, 2); sd.set(6, 1, null, hs); sd.set(6, 2, null, hs);
        work.forEach((d, i) => {
          sd.set(5, 3 + i, Core.dayTag(d, nums), Object.assign({}, hs, { bg: d.kind === 'shoot' ? 'D5DDE3' : 'EADFF5', sz: 8 }));
          sd.set(6, 3 + i, d.date ? { date: d.date } : '', Object.assign({}, hs, { fmt: 'dd.mm', sz: 8, b: false }));
        });
        sd.set(5, 3 + work.length, T('Razem'), hs); sd.merge(5, 3 + work.length, 6, 3 + work.length); sd.set(6, 3 + work.length, null, hs);
        let rr = 7;
        Core.crewGroups(st).forEach((g) => g.list.forEach((c) => {
          const b = { border: BORDER, v: 'center' };
          sd.set(rr, 1, Core.crewName(c), Object.assign({}, b, { b: true })); sd.set(rr, 2, c.role, b);
          work.forEach((d, i) => sd.set(rr, 3 + i, Core.crewWorks(c, d) ? 'X' : null, Object.assign({}, b, { h: 'center', b: true, bg: Core.crewWorks(c, d) ? 'D8EEDC' : undefined })));
          sd.set(rr, 3 + work.length, { f: `COUNTIF(C${rr}:${Xlsx.colName(2 + work.length)}${rr},"X")`, v: work.filter((d) => Core.crewWorks(c, d)).length }, Object.assign({}, b, { h: 'center', b: true }));
          rr++;
        }));
        const tt = { b: true, bg: 'E4EAEF', border: BORDER, h: 'center' };
        sd.set(rr, 1, T('Osób danego dnia'), Object.assign({}, tt, { h: undefined })); sd.set(rr, 2, null, tt);
        work.forEach((d, i) => { const col = Xlsx.colName(3 + i); sd.set(rr, 3 + i, { f: `COUNTIF(${col}7:${col}${rr - 1},"X")`, v: st.crew.filter((c) => Core.crewWorks(c, d)).length }, tt); });
        sd.set(rr, 3 + work.length, null, tt);
      }
    }

    /* --- Catering --- */
    if (sections.includes('catering')) {
      const cat = Core.catering(st);
      const sh = wb.addSheet(sheetName('Catering'), { tab: 'C2410C', freeze: { row: 5 }, portrait: true });
      const keys = cat.keys;
      const widths = [12, 12, 12].concat(keys.map(() => 11)).concat([10, 10, 10, 11]);
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, T('CATERING – POSIŁKI WEDŁUG DIET'));
      const heads = [T('Dzień'), T('Data'), T('Dzień tyg.')].concat(keys.map((k) => Core.dietLabel(k, true))).concat([T('Ekipa'), T('Aktorzy'), T('Dodatkowe'), T('Razem')]);
      heads.forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      sh.rowHeight(5, 30);
      let r = 6;
      const c0 = 4, cT = 4 + keys.length + 3;
      cat.days.forEach((d) => {
        const b = { border: BORDER, v: 'center', h: 'center', bg: d.kind === 'shoot' ? undefined : 'F2F4F6' };
        sh.set(r, 1, d.tag, Object.assign({}, b, { b: true }));
        sh.set(r, 2, d.date ? { date: d.date } : '', Object.assign({}, b, { fmt: 'dd.mm.yyyy' }));
        sh.set(r, 3, d.date ? Core.DAYS_SHORT[Core.dow(d.date)] : '', b);
        keys.forEach((k, i) => sh.set(r, c0 + i, d.counts[k], b));
        sh.set(r, c0 + keys.length, d.crew, b); sh.set(r, c0 + keys.length + 1, d.cast, b); sh.set(r, c0 + keys.length + 2, d.extra, b);
        sh.set(r, cT, { f: `SUM(${Xlsx.colName(c0)}${r}:${Xlsx.colName(c0 + keys.length - 1)}${r})`, v: d.total }, Object.assign({}, b, { b: true }));
        r++;
      });
      if (cat.days.length) {
        const tt = { b: true, bg: '26323B', color: 'FFFFFF', border: BORDER, h: 'center' };
        for (let c = 1; c <= cT; c++) sh.set(r, c, null, tt);
        sh.set(r, 1, T('RAZEM'), tt);
        const vals = keys.map((k) => cat.sum[k]).concat([cat.days.reduce((x, d) => x + d.crew, 0), cat.days.reduce((x, d) => x + d.cast, 0), cat.days.reduce((x, d) => x + d.extra, 0), cat.total]);
        for (let c = c0; c <= cT; c++) { const col = Xlsx.colName(c); sh.set(r, c, { f: `SUM(${col}6:${col}${r - 1})`, v: vals[c - c0] }, tt); }
        r += 2;
      }
      sh.set(r, 1, T('Liczba posiłków = ekipa pracująca danego dnia (zakładka Ekipa → Dni pracy){cast}, plus dodatkowe porcje.', { cast: st.catering.cast !== false ? T(' oraz aktorzy z planu dnia') : '' }), { sz: 9, color: '5C6670' }); r += 2;
      const notes = [];
      cat.days.forEach((d) => d.notes.forEach((x) => notes.push([d.tag, x.who, x.diet, x.note])));
      if (notes.length) {
        sh.set(r, 1, T('DIETY SPECJALNE I ALERGIE'), { b: true, sz: 10, color: '5C6670' }); r++;
        H(['Dzień', 'Osoba', 'Dieta', 'Uwagi']).forEach((h, i) => { sh.set(r, [1, 2, 4, 6][i], h, hStyle); });
        sh.set(r, 3, null, hStyle); sh.merge(r, 2, r, 3); sh.set(r, 5, null, hStyle); sh.merge(r, 4, r, 5);
        for (let c = 7; c <= cT; c++) sh.set(r, c, null, hStyle); sh.merge(r, 6, r, cT);
        r++;
        notes.forEach((n) => {
          const b = { border: BORDER, wrap: true, v: 'center' };
          sh.set(r, 1, n[0], Object.assign({}, b, { b: true, h: 'center' })); sh.set(r, 2, n[1], Object.assign({}, b, { b: true })); sh.set(r, 3, null, b); sh.merge(r, 2, r, 3);
          sh.set(r, 4, n[2], b); sh.set(r, 5, null, b); sh.merge(r, 4, r, 5);
          sh.set(r, 6, n[3], b); for (let c = 7; c <= cT; c++) sh.set(r, c, null, b); sh.merge(r, 6, r, cT);
          r++;
        });
      }
    }

    /* --- Lokacje --- */
    if (sections.includes('sites')) {
      const sh = wb.addSheet(sheetName('Lokacje'), { tab: '3FA062', freeze: { row: 5, col: 1 } });
      const widths = [24, 28, 32, 24, 22, 20, 26, 28, 18, 8, 9, 16, 30, 32, 40];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, T('LOKACJE'));
      H(['Obiekt', 'Rzeczywista nazwa', 'Adres', 'Właściciel / osoba kontaktowa', 'Kontakt do właściciela', 'Zasilanie', 'Lokalizacja toalety', 'Lokalizacja campu / bazy', 'Status umowy', 'Sceny', 'Ósemki', 'Dni zdjęciowe', 'Numery scen', 'Plany', 'Inne informacje / uwagi']).forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      sh.rowHeight(5, 30);
      const CBG = { signed: 'DDF3E5', sent: 'FFF0D3', negotiation: 'FFF0D3', unsigned: 'FDE4E1', refused: 'FDE4E1' };
      let r = 6;
      data.sites.forEach((s) => {
        const b = { border: BORDER, v: 'center', wrap: true };
        const vals = [s.site === '(bez nazwy)' ? T('(bez nazwy)') : s.site, s.realName, s.address, s.owner, s.ownerContact, s.power ? Core.powerLabel(s.power) : '', s.toilet, s.camp, s.contract ? Core.contractLabel(s.contract) : '', s.scenes, s.eighths, s.days.map((n) => 'D' + n).join(', '), s.sceneNums.join(', '), s.places.join('; '), s.notes];
        vals.forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, b, { b: i === 0 || i === 8, h: [9, 10].includes(i) ? 'center' : undefined, bg: i === 8 ? CBG[s.contract] : undefined })));
        sh.rowHeight(r, Math.max(16, Math.ceil(Math.max((s.notes || '').length / 38, (s.address || '').length / 30, (s.camp || '').length / 26, 1)) * 13 + 3));
        r++;
      });
      if (data.sites.length) sh.opts.filter = `A5:O${r - 1}`;
      sh.opts.printTitles = '$5:$5';
    }

    /* --- DOOD --- */
    if (sections.includes('dood')) {
      const dd = data.dood;
      const n = dd.days.length;
      const sh = wb.addSheet('DOOD', { tab: 'D9534F', freeze: { row: 7, col: 3 } });
      sh.colWidth(1, 6); sh.colWidth(2, 24); sh.colWidth(3, 24);
      for (let i = 0; i < n; i++) sh.colWidth(4 + i, 5.5);
      sh.colWidth(4 + n, 8); sh.colWidth(5 + n, 9);
      titleBlock(sh, Math.max(5 + n, 8), 'DAY OUT OF DAYS');
      const hs = { b: true, bg: 'D5DDE3', h: 'center', border: BORDER };
      sh.set(5, 1, T('Nr'), hs); sh.set(5, 2, T('Postać'), hs); sh.set(5, 3, T('Aktor / aktorka'), hs);
      sh.merge(5, 1, 7, 1); sh.merge(5, 2, 7, 2); sh.merge(5, 3, 7, 3);
      for (let r2 = 6; r2 <= 7; r2++) for (let c = 1; c <= 3; c++) sh.set(r2, c, null, hs);
      dd.days.forEach((d, i) => {
        sh.set(5, 4 + i, 'D' + d.no, hs);
        sh.set(6, 4 + i, d.date ? { date: d.date } : '', Object.assign({}, hs, { fmt: 'dd.mm', sz: 8, b: false }));
        sh.set(7, 4 + i, d.date ? Core.DAYS_SHORT[Core.dow(d.date)] : '', Object.assign({}, hs, { sz: 8, b: false }));
      });
      sh.set(5, 4 + n, T('Dni pracy'), hs); sh.set(5, 5 + n, T('Dni wstrz.'), hs);
      sh.merge(5, 4 + n, 7, 4 + n); sh.merge(5, 5 + n, 7, 5 + n);
      for (let r2 = 6; r2 <= 7; r2++) { sh.set(r2, 4 + n, null, hs); sh.set(r2, 5 + n, null, hs); }
      let r = 8;
      dd.rows.forEach((row) => {
        const b = { border: BORDER, v: 'center' };
        sh.set(r, 1, row.id, Object.assign({}, b, { b: true, h: 'center' }));
        sh.set(r, 2, row.name, Object.assign({}, b, { b: true }));
        sh.set(r, 3, row.actor, b);
        row.codes.forEach((code, i) => sh.set(r, 4 + i, code || null, { border: BORDER, h: 'center', b: !!code, sz: 8, bg: code ? DOOD_BG[code] : undefined }));
        if (n) {
          const rng = `${Xlsx.colName(4)}${r}:${Xlsx.colName(3 + n)}${r}`;
          sh.set(r, 4 + n, { f: `COUNTIF(${rng},"*W*")`, v: row.work }, { border: BORDER, h: 'center', b: true });
          sh.set(r, 5 + n, { f: `COUNTIF(${rng},"H")`, v: row.hold }, { border: BORDER, h: 'center' });
        }
        r++;
      });
      r++;
      sh.set(r, 1, T('SW – start pracy · W – praca · WF – koniec pracy · SWF – start i koniec w jednym dniu · H – wstrzymanie (aktor opłacony, nie gra)'), { sz: 9, color: '5C6670' });
      sh.merge(r, 1, r, Math.max(8, 5 + n));
    }

    /* --- Plany pracy --- */
    if (sections.includes('callsheet')) {
      data.days.filter((d) => d.kind === 'shoot' && (!opts.dayId || d.id === opts.dayId)).forEach((d) => {
        const stDay = st.days.find((x) => x.id === d.id);
        const sh = wb.addSheet(sheetName(T('Plan pracy D{n}', { n: d.no })), { tab: '0D6B73', portrait: true });
        const widths = [9, 9, 8, 10, 40, 26, 24, 24];
        widths.forEach((w, i) => sh.colWidth(i + 1, w));
        const N = widths.length;
        titleBlock(sh, N, T('PLAN PRACY · DZIEŃ {n}', { n: d.no }) + ' · ' + Core.fmtDatePL(d.date));
        const cs = Core.sheetOf(st, d.id), crows = Core.callRows(st, stDay), times = Core.dayTimes(st, stDay);
        let r = 5;
        const kp = Core.keyPeople(st);
        const info = [[T('Zbiórka ekipy'), cs.crewCall || d.call], [T('Przewidywany koniec'), times && times.known ? Core.clock(times.end) + '  (' + T('czas pracy') + ' ' + Core.fmtDur(times.work) + ')' : ''], [T('Wschód słońca'), cs.sunrise], [T('Zachód słońca'), cs.sunset], [T('Pogoda'), cs.weather], [T('Szpital / pogotowie'), cs.hospital]];
        const lunch = Core.lunchOf(st, stDay);
        info.splice(1, 0, [T('Obiad'), lunch ? lunch.label : '']);
        const people = [['DIR', kp.dir], ['DOP', kp.dop], ['PROD', kp.prod]].filter((x) => x[1]).map((x) => x[0] + ' ' + x[1]).join('   ·   ');
        if (people) info.unshift([T('Kluczowi twórcy'), people]);
        info.forEach((kv) => { const hl = kv[0] === T('Obiad') && kv[1]; sh.set(r, 1, kv[0], { b: true, sz: 9, color: '5C6670' }); sh.merge(r, 1, r, 3); sh.set(r, 4, kv[1] || '—', hl ? { sz: 12, b: true, bg: 'FFF0D3' } : { sz: 10, wrap: true }); sh.merge(r, 4, r, N); r++; });
        r++;
        const section = (t) => { for (let c = 1; c <= N; c++) sh.set(r, c, null, { bg: '26323B' }); sh.set(r, 1, t.toUpperCase(), { b: true, color: 'FFFFFF', bg: '26323B', sz: 10 }); sh.merge(r, 1, r, N); sh.rowHeight(r, 18); r++; };
        const head = (arr, spans) => { let c = 1; arr.forEach((h, i) => { sh.set(r, c, h, hStyle); const sp = (spans && spans[i]) || 1; for (let k = 1; k < sp; k++) sh.set(r, c + k, null, hStyle); if (sp > 1) sh.merge(r, c, r, c + sp - 1); c += sp; }); r++; };
        if (cs.contacts.length) {
          section(T('Ważne kontakty'));
          const sp = [3, 3, 2];
          head(H(['Funkcja', 'Imię i nazwisko', 'Telefon']), sp);
          cs.contacts.forEach((c) => { const b = { border: BORDER, wrap: true }; let c0 = 1; [c.role, c.name, c.phone].forEach((v, i) => { sh.set(r, c0, v, Object.assign({}, b, { b: i === 0 })); for (let k = 1; k < sp[i]; k++) sh.set(r, c0 + k, null, b); sh.merge(r, c0, r, c0 + sp[i] - 1); c0 += sp[i]; }); r++; });
          r++;
        }
        section(T('Harmonogram dnia'));
        head(H(['Od', 'Do', 'Sc.', 'Ujęcie', 'Opis / plan', 'Obsada', 'Elementy kamerowe', 'Uwagi']));
        crows.forEach((x) => {
          if (x.prep) {
            const pb = { bg: 'F2F4F6', border: BORDER, v: 'center', color: '5C6670', sz: 9 };
            [Core.minToTime(x.fromMin - x.prep), x.from, '', '', T('Przestawka / przygotowanie'), '', '', ''].forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, pb, { h: i < 4 ? 'center' : undefined })));
            r++;
          }
          const custom = x.kind === 'custom', base = { bg: custom ? 'E4EAEF' : x.bg, border: BORDER, v: 'center' };
          [x.from, x.dur || x.fixed ? x.to : '', x.num, x.shot, x.desc, x.cast, x.camera, x.notes].forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, base, { b: i < 2 || i === 2 || custom, h: i < 4 ? 'center' : undefined, wrap: i >= 4 })));
          sh.rowHeight(r, Math.max(16, Math.ceil(Math.max((x.desc || '').length / 44, (x.camera || '').length / 26, (x.notes || '').length / 26, 1)) * 13 + 3)); r++;
        });
        r++;
        const castIds = Core.sheetCastIds(st, stDay), cm = Core.castMap(st), scs = Core.sheetScenes(st, stDay);
        if (castIds.length) {
          section(T('Obsada i zbiórki'));
          head(H(['Nr', 'Postać', 'Zbiórka', 'Aktor / aktorka', 'Charakteryzacja / na plan / uwagi', 'Sceny']), [1, 2, 1, 1, 2, 1]);
          castIds.map((id) => cm.get(id)).filter(Boolean).forEach((c) => {
            const cc = cs.cast[c.id] || {}, b = { border: BORDER, v: 'center', wrap: true };
            sh.set(r, 1, c.id, Object.assign({}, b, { b: true, h: 'center' }));
            sh.set(r, 2, c.name, Object.assign({}, b, { b: true })); sh.set(r, 3, null, b); sh.merge(r, 2, r, 3);
            sh.set(r, 4, cc.call || d.call || '', Object.assign({}, b, { b: true, h: 'center' }));
            sh.set(r, 5, c.actor, b);
            sh.set(r, 6, [cc.makeup && T('Charakteryzacja') + ' ' + cc.makeup, cc.onset && T('Na plan') + ' ' + cc.onset, cc.note].filter(Boolean).join(' · '), b); sh.set(r, 7, null, b); sh.merge(r, 6, r, 7);
            sh.set(r, 8, scs.filter((s) => s.cast.includes(c.id)).map((s) => s.num).join(', '), b);
            r++;
          });
          r++;
        }
        const loc = Core.locationsText(st, stDay);
        if (loc.trim()) { section(T('Lokacje')); sh.set(r, 1, loc, { wrap: true, v: 'top' }); sh.merge(r, 1, r, N); sh.rowHeight(r, 16 + 13 * loc.split('\n').length); r += 2; }
        const trips = Core.transportData(st, d.id).trips;
        if (trips.length) {
          section(T('Transport'));
          head(H(['Godz.', 'Pojazd', 'Kierowca', 'Skąd → dokąd', 'Kto / co']), [1, 2, 2, 2, 1]);
          trips.forEach((t) => {
            const b = { border: BORDER, wrap: true, v: 'center' };
            sh.set(r, 1, t.time, Object.assign({}, b, { b: true, h: 'center' }));
            sh.set(r, 2, t.vehicle ? t.vehicle.name : '', b); sh.set(r, 3, null, b); sh.merge(r, 2, r, 3);
            sh.set(r, 4, t.vehicle ? [t.vehicle.driver, t.vehicle.phone].filter(Boolean).join(' ') : '', b); sh.set(r, 5, null, b); sh.merge(r, 4, r, 5);
            sh.set(r, 6, [t.from, t.to].filter(Boolean).join(' → '), b); sh.set(r, 7, null, b); sh.merge(r, 6, r, 7);
            sh.set(r, 8, [t.who, t.note].filter(Boolean).join(' · '), b);
            r++;
          });
          r++;
        }
        if (cs.transportNote) { section(T('Transport – informacje')); sh.set(r, 1, cs.transportNote, { wrap: true, v: 'top' }); sh.merge(r, 1, r, N); r += 2; }
        if (cs.cameraNotes) { section(T('Elementy kamerowe')); sh.set(r, 1, cs.cameraNotes, { wrap: true, v: 'top' }); sh.merge(r, 1, r, N); sh.rowHeight(r, 16 + 13 * cs.cameraNotes.split('\n').length); r += 2; }
        const notes = [d.note, cs.notes].filter(Boolean).join('\n');
        if (notes) { section(T('Uwagi')); sh.set(r, 1, notes, { wrap: true, v: 'top' }); sh.merge(r, 1, r, N); sh.rowHeight(r, 16 + 13 * notes.split('\n').length); r += 2; }
        if ((cs.maps || []).length) { sh.set(r, 1, T('Mapki ({n}) są dołączone do pliku PDF planu pracy.', { n: cs.maps.length }), { sz: 9, color: '5C6670' }); sh.merge(r, 1, r, N); }
      });
    }

    /* --- Raporty dzienne --- */
    if (sections.includes('dpr')) {
      const STATUS_TXT = { done: T('Nakręcona'), part: T('Częściowo'), none: T('Nie nakręcona') };
      data.days.filter((d) => d.kind === 'shoot' && (opts.dayId ? d.id === opts.dayId : !!(st.dpr && st.dpr[d.id]))).forEach((d) => {
        const stDay = st.days.find((x) => x.id === d.id);
        const r = Core.dprOf(st, d.id), s = Core.dprSummary(st, stDay);
        const sh = wb.addSheet(sheetName(T('Raport D{n}', { n: d.no })), { tab: '1B7A45', portrait: true });
        const widths = [8, 30, 9, 14, 11, 8, 34];
        widths.forEach((w, i) => sh.colWidth(i + 1, w));
        const N = widths.length;
        titleBlock(sh, N, T('RAPORT DZIENNY · DZIEŃ {n}', { n: d.no }) + ' · ' + Core.fmtDatePL(d.date));
        let r0 = 5;
        const section = (t) => { for (let c = 1; c <= N; c++) sh.set(r0, c, null, { bg: '26323B' }); sh.set(r0, 1, t.toUpperCase(), { b: true, color: 'FFFFFF', bg: '26323B', sz: 10 }); sh.merge(r0, 1, r0, N); sh.rowHeight(r0, 18); r0++; };
        const kv = (k, v) => { sh.set(r0, 1, k, { b: true, sz: 9, color: '5C6670' }); sh.merge(r0, 1, r0, 2); sh.set(r0, 3, v == null || v === '' ? '—' : v, { sz: 10, wrap: true }); sh.merge(r0, 3, r0, N); r0++; };
        kv(T('Nakręcono'), `${Core.fmtEighths(s.shot)} / ${Core.fmtEighths(s.planned)} ${T('str.')} · ${T('sceny')} ${s.scenesDone}/${s.rows.length}`);
        kv(T('Ujęcia'), s.setups || '');
        kv(T('Statyści'), r.extras);
        kv(T('Czas pracy'), s.actual.work != null ? Core.fmtDur(s.actual.work) + (s.overtime ? ' (' + T('nadgodziny {d}', { d: Core.fmtDur(s.overtime) }) + ')' : '') : '');
        kv(T('Postęp zdjęć'), `${Core.fmtEighths(s.cum.shot)} / ${Core.fmtEighths(s.cum.total)} ${T('str.')}`);
        r0++;
        section(T('Godziny: plan i rzeczywistość'));
        const head = (arr) => { arr.forEach((h, i) => sh.set(r0, i + 1, h, hStyle)); r0++; };
        head(H(['Pozycja', '', 'Plan', 'Rzeczywistość']));
        [[T('Zbiórka ekipy'), s.plan.call, r.crewCall], [T('Pierwsze ujęcie'), s.plan.firstShot, r.firstShot], [T('Obiad'), s.plan.lunch, [r.lunchFrom, r.lunchTo].filter(Boolean).join('–')], [T('Koniec zdjęć (kamera)'), s.plan.wrap, r.camWrap], [T('Koniec pracy ekipy'), s.plan.wrap, r.crewWrap]].forEach(([a, b, c]) => {
          const bd = { border: BORDER };
          sh.set(r0, 1, a, Object.assign({ b: true }, bd)); sh.set(r0, 2, null, bd); sh.merge(r0, 1, r0, 2);
          sh.set(r0, 3, b || '', Object.assign({ h: 'center' }, bd)); sh.set(r0, 4, c || '', Object.assign({ h: 'center', b: true }, bd)); r0++;
        });
        r0++;
        section(T('Sceny'));
        head(H(['Sc.', 'Plan / lokacja', 'Str.', 'Status', 'Nakręcono', 'Uj.', 'Uwagi']));
        s.rows.forEach((x) => {
          const b = { border: BORDER, bg: Core.stripBg(x.scene), v: 'center', wrap: true };
          [x.scene.num, (x.scene.place || x.scene.site || '') + (x.moved ? ' (' + T('przeniesiona') + ')' : ''), Core.fmtEighths(x.planned), STATUS_TXT[x.status] || '', x.shot ? Core.fmtEighths(x.shot) : '', x.setups || '', x.note].forEach((v, i) => sh.set(r0, i + 1, v, Object.assign({}, b, { h: [0, 2, 3, 4, 5].includes(i) ? 'center' : undefined, b: i === 0 || i === 3 })));
          r0++;
        });
        r0++;
        [[T('Opóźnienia i przestoje'), r.delays], [T('Wypadki i zdarzenia BHP'), r.incidents], [T('Sprzęt (awarie, braki, zwroty)'), r.equipment], [T('Uwagi ogólne'), r.notes]].forEach(([h, txt]) => {
          if (!txt) return;
          section(h); sh.set(r0, 1, txt, { wrap: true, v: 'top' }); sh.merge(r0, 1, r0, N); sh.rowHeight(r0, 16 + 13 * String(txt).split('\n').length); r0 += 2;
        });
      });
    }

    /* --- Transport --- */
    if (sections.includes('transport')) {
      const td = Core.transportData(st, opts.dayId);
      if (!opts.dayId) {
        const sv = wb.addSheet(sheetName('Pojazdy'), { tab: '8A6D1F', freeze: { row: 5 } });
        [28, 24, 14, 26, 18, 36].forEach((w, i) => sv.colWidth(i + 1, w));
        titleBlock(sv, 6, T('POJAZDY I KIEROWCY'));
        H(['Pojazd', 'Typ', 'Nr rej.', 'Kierowca', 'Telefon', 'Uwagi']).forEach((h, i) => sv.set(5, i + 1, h, hStyle));
        td.vehicles.forEach((v, k) => [v.name, T(v.type), v.plate, v.driver, v.phone, v.note].forEach((val, i) => sv.set(6 + k, i + 1, val, { border: BORDER, b: i === 0, wrap: true, v: 'center' })));
      }
      const sh = wb.addSheet(sheetName('Transport'), { tab: '8A6D1F', freeze: { row: 5 } });
      const widths = [10, 12, 8, 26, 22, 28, 28, 30, 30];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, T('PLAN TRANSPORTÓW'));
      H(['Dzień', 'Data', 'Godz.', 'Pojazd', 'Kierowca', 'Skąd', 'Dokąd', 'Kto / co', 'Uwagi']).forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      td.trips.forEach((t, k) => {
        const r = 6 + k, b = { border: BORDER, wrap: true, v: 'center' };
        const vals = [t.dayTag, t.date ? { date: t.date } : '', t.time, t.vehicle ? t.vehicle.name : '', t.vehicle ? [t.vehicle.driver, t.vehicle.phone].filter(Boolean).join(' ') : '', t.from, t.to, t.who, t.note];
        vals.forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, b, { h: i < 3 ? 'center' : undefined, b: i === 0 || i === 2, fmt: i === 1 ? 'dd.mm.yyyy' : undefined })));
      });
      if (td.trips.length) sh.opts.filter = `A5:I${5 + td.trips.length}`;
    }

    /* --- Kosztorys --- */
    if (sections.includes('budget')) {
      const bd = Core.budgetData(st);
      const MF = '#,##0.00 "' + (I18N.lang === 'en' ? bd.cur : Core.CURRENCIES[bd.cur].sym) + '"';
      const kname = sheetName('Kosztorys');
      const ref = `'${kname.replace(/'/g, "''")}'`;
      const sh = wb.addSheet(kname, { tab: 'B5651D', freeze: { row: 5 } });
      const widths = [34, 40, 10, 26, 16, 16, 16, 32];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, T('KOSZTORYS'));
      H(['Kategoria', 'Pozycja', 'Dzień', 'Obiekt', 'Planowany', 'Rzeczywisty', 'Różnica', 'Uwagi']).forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      let r = 6;
      const subRows = [];
      bd.cats.forEach((c) => {
        const first = r;
        c.items.forEach((i) => {
          const b = { border: BORDER, v: 'center', wrap: true };
          sh.set(r, 1, c.label, b); sh.set(r, 2, i.name, Object.assign({}, b, { b: true }));
          sh.set(r, 3, i.dayTag || '', Object.assign({}, b, { h: 'center' })); sh.set(r, 4, i.site || '', b);
          sh.set(r, 5, i.est, Object.assign({}, b, { fmt: MF })); sh.set(r, 6, i.act, Object.assign({}, b, { fmt: MF }));
          sh.set(r, 7, { f: `IF(F${r}=0,"",F${r}-E${r})`, v: i.act ? i.act - i.est : '' }, Object.assign({}, b, { fmt: MF })); sh.set(r, 8, i.note || '', b);
          r++;
        });
        const t = { b: true, bg: 'E4EAEF', border: BORDER };
        for (let k = 1; k <= 8; k++) sh.set(r, k, null, t);
        sh.set(r, 1, T('Razem') + ': ' + c.label, t);
        sh.set(r, 5, { f: c.items.length ? `SUM(E${first}:E${r - 1})` : '0', v: c.est }, Object.assign({}, t, { fmt: MF }));
        sh.set(r, 6, { f: c.items.length ? `SUM(F${first}:F${r - 1})` : '0', v: c.act }, Object.assign({}, t, { fmt: MF }));
        sh.set(r, 7, { f: c.items.length ? `SUM(G${first}:G${r - 1})` : '0', v: c.dev }, Object.assign({}, t, { fmt: MF }));
        subRows.push(r); r++;
      });
      const g = { b: true, bg: '26323B', color: 'FFFFFF', border: BORDER };
      for (let k = 1; k <= 8; k++) sh.set(r, k, null, g);
      sh.set(r, 1, T('RAZEM'), g);
      sh.set(r, 5, { f: subRows.map((x) => 'E' + x).join('+'), v: bd.est }, Object.assign({}, g, { fmt: MF }));
      sh.set(r, 6, { f: subRows.map((x) => 'F' + x).join('+'), v: bd.act }, Object.assign({}, g, { fmt: MF }));
      sh.set(r, 7, { f: subRows.map((x) => 'G' + x).join('+'), v: bd.dev }, Object.assign({}, g, { fmt: MF }));
      const grand = r;
      r += 2;
      sh.set(r, 1, T('Różnica = koszt rzeczywisty minus planowany, tylko dla pozycji z wpisanym kosztem rzeczywistym (dodatnia = przekroczenie).'), { sz: 9, color: '5C6670' });
      bd.conv.filter((x) => x.est != null).forEach((x) => {
        r += 1;
        const fm = '#,##0.00 "' + (I18N.lang === 'en' ? x.cur : Core.CURRENCIES[x.cur].sym) + '"', k = Core.plnPer(st, bd.cur) / Core.plnPer(st, x.cur);
        sh.set(r, 1, T('Plan po przeliczeniu na {c}', { c: x.cur }), { b: true });
        sh.set(r, 5, { f: `E${grand}*${k}`, v: x.est }, { b: true, fmt: fm });
        sh.set(r, 6, { f: `F${grand}*${k}`, v: x.act }, { b: true, fmt: fm });
      });
      const ss = wb.addSheet(sheetName('Budżet – podsumowanie'), { tab: 'B5651D' });
      [36, 18, 18, 18, 12].forEach((w, i) => ss.colWidth(i + 1, w));
      titleBlock(ss, 5, T('BUDŻET – PODSUMOWANIE PIONÓW'));
      H(['Pion', 'Planowany', 'Rzeczywisty', 'Różnica', 'Udział']).forEach((h, i) => ss.set(5, i + 1, h, hStyle));
      bd.cats.forEach((c, k) => {
        const rr = 6 + k, b = { border: BORDER, v: 'center' }, sr = subRows[k];
        ss.set(rr, 1, c.label, Object.assign({}, b, { b: true }));
        ss.set(rr, 2, { f: `${ref}!E${sr}`, v: c.est }, Object.assign({}, b, { fmt: MF }));
        ss.set(rr, 3, { f: `${ref}!F${sr}`, v: c.act }, Object.assign({}, b, { fmt: MF }));
        ss.set(rr, 4, { f: `${ref}!G${sr}`, v: c.dev }, Object.assign({}, b, { fmt: MF }));
        ss.set(rr, 5, { f: `IF(${ref}!E${grand}=0,0,B${rr}/${ref}!E${grand})`, v: bd.est ? c.est / bd.est : 0 }, Object.assign({}, b, { fmt: '0%', h: 'center' }));
      });
      const tr = 6 + bd.cats.length, tt = { b: true, bg: '26323B', color: 'FFFFFF', border: BORDER };
      ss.set(tr, 1, T('RAZEM'), tt);
      ss.set(tr, 2, { f: `SUM(B6:B${tr - 1})`, v: bd.est }, Object.assign({}, tt, { fmt: MF }));
      ss.set(tr, 3, { f: `SUM(C6:C${tr - 1})`, v: bd.act }, Object.assign({}, tt, { fmt: MF }));
      ss.set(tr, 4, { f: `SUM(D6:D${tr - 1})`, v: bd.dev }, Object.assign({}, tt, { fmt: MF }));
      ss.set(tr, 5, null, tt);
    }

    return wb;
  }

  return { buildPdf, buildXlsx, SECTIONS, secLabel, fileStem, slug };
})();
export { Reports };
