/* ===== RAPORTY: PDF (A4 poziomo) i Excel z kalendarzówką, rozpiską scen, obsadą, lokacjami, DOOD ===== */
const Reports = (() => {
  const b64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
  const PLW = 841.89, PLH = 595.28, MX = 28, MT = 50, MB = 34;
  const C = { ink: '1B2229', mute: '5C6670', line: 'C9CFD5', dark: '26323B', band: 'E4EAEF', off: '8A949D', white: 'FFFFFF', head: 'D5DDE3' };
  const DOOD_BG = { SW: '9AD3A5', W: 'D8EEDC', WF: 'F3B7A3', SWF: 'F7E08A', H: 'E0E3E7' };

  const titleOf = (st) => (st.meta.title || 'Bez tytułu').trim();
  const slug = (s) => String(s).normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/Ł/g, 'L').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '_').slice(0, 50) || 'projekt';
  const fileStem = (st) => `${slug(titleOf(st))}_${Core.todayISO()}`;
  const nowText = () => Core.fmtShort(Core.todayISO());

  const SECTIONS = [
    ['calendar', 'Kalendarzówka (dni zdjęciowe)'],
    ['board', 'Rozpiska scen'],
    ['shotlist', 'Shotlista'],
    ['cast', 'Obsada'],
    ['crew', 'Ekipa'],
    ['sites', 'Lokacje'],
    ['dood', 'Day out of Days (DOOD)'],
    ['callsheet', 'Plany pracy (call sheet)'],
    ['transport', 'Plan transportów'],
    ['budget', 'Kosztorys'],
  ];
  const money = (n) => Core.fmtMoney(n);

  /* ============================== PDF ============================== */
  async function buildPdf(st, sections, opts) {
    opts = opts || {};
    sections = sections || SECTIONS.map((s) => s[0]);
    const data = Core.reportData(st);
    let PW = PLW, PH = PLH, CW = PW - MX * 2;
    const doc = new Pdf.Doc({ pageW: PLW, pageH: PLH, info: { title: titleOf(st) + ' – kalendarz zdjęciowy', author: st.meta.company || st.meta.producer || '' } });
    doc.addFont('regular', b64(KLAPS_FONTS.regular), 'LiberationSans', false);
    doc.addFont('bold', b64(KLAPS_FONTS.bold), 'LiberationSans-Bold', true);

    const ctx = { page: null, y: 0, section: '', labels: [], orient: 'l' };
    const ORIENT = { callsheet: 'p', crew: 'p' };
    const newPage = () => {
      const dims = ctx.orient === 'p' ? [PLH, PLW] : [PLW, PLH];
      PW = dims[0]; PH = dims[1]; CW = PW - MX * 2;
      const p = doc.addPage(PW, PH);
      ctx.page = p;
      ctx.labels.push(ctx.section);
      p.text(MX, 26, titleOf(st).toUpperCase(), { size: 10, bold: true, color: C.ink });
      p.text(PW - MX, 26, ctx.section + '  ·  stan na ' + nowText(), { size: 8, color: C.mute, align: 'right' });
      p.line(MX, 32, PW - MX, 32, { color: C.dark, lw: 1 });
      ctx.y = MT;
    };
    const ensure = (h) => { if (!ctx.page || ctx.y + h > PH - MB) { newPage(); return true; } return false; };
    const startSection = (name, orient) => { ctx.section = name; ctx.orient = orient || 'l'; newPage(); };
    let began = false;
    const begin = (name, orient) => { if (!began) { began = true; return; } startSection(name, orient); };

    const SZ = 8, LH = 10.2, PX = 3, PY = 2.6;
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
        let x = MX;
        cols.forEach((c, i) => {
          const ls = m.lines[i];
          ls.forEach((ln, k) => {
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
      const hm = header ? measure(header) : { h: 0 };
      const first = rows.length ? measure(rows[0]) : { h: 0 };
      if (ensure(hm.h + first.h + (o.keep || 0))) { if (o.contBand) o.contBand(); }
      if (header) drawRow(header, hm);
      for (const r of rows) {
        const m = measure(r);
        if (ctx.y + m.h > PH - MB) { newPage(); if (o.contBand) o.contBand(); if (header) drawRow(header, hm); }
        drawRow(r, m);
      }
    }
    const textBlock = (txt, o = {}) => {
      const size = o.size || 8;
      const ls = doc.wrap(txt, (o.w || CW) - 6, size, o.bold);
      const h = ls.length * size * 1.3 + 4;
      ensure(h);
      ls.forEach((ln, i) => ctx.page.text(MX + 3 + (o.indent || 0), ctx.y + 2 + size * 0.85 + i * size * 1.3, ln, { size, bold: o.bold, color: o.color || C.ink }));
      ctx.y += h;
    };

    const colsSchedule = [
      { w: 36, align: 'center', bold: true }, { w: 36, align: 'center' }, { w: 30, align: 'center' }, { w: 175 }, { w: 278 },
      { w: 90 }, { w: 40, align: 'center' }, { w: 100 },
    ];
    const headSchedule = ['Sc.', 'W/Z', 'D/N', 'Plan / lokacja', 'Opis', 'Obsada', 'Str.', 'Uwagi'];
    const rowSchedule = (r) => ({ cells: [r.num, r.ieLabel, r.todShort, r.place, r.synopsis, r.castText, r.pages, r.notes], bg: r.bg });

    const dayBand = (d, cont) => {
      const h = 21;
      ensure(h + 30);
      const p = ctx.page;
      const off = d.kind === 'off';
      p.rect(MX, ctx.y, CW, h, { fill: off ? C.off : C.dark });
      const lab = off ? 'DZIEŃ WOLNY' : 'DZIEŃ ' + d.no + (cont ? ' (cd.)' : '');
      p.text(MX + 8, ctx.y + 14.5, lab, { size: 11, bold: true, color: C.white });
      const lw = doc.text(lab, 11, true);
      p.text(MX + 8 + lw + 12, ctx.y + 14, Core.fmtDatePL(d.date), { size: 9.5, color: C.white });
      const right = off ? d.note || '' : `Zbiórka ${d.call || '—'}   ·   ${d.rows.length} ${Core.pl(d.rows.length, 'scena', 'sceny', 'scen')}   ·   ${Core.fmtEighths(d.eighths)} str.`;
      p.text(PW - MX - 8, ctx.y + 14, right, { size: 9, color: C.white, align: 'right' });
      ctx.y += h;
    };

    const subhead = (txt) => { ensure(78); ctx.y += 6; ctx.page.text(MX, ctx.y + 8, txt.toUpperCase(), { size: 8, bold: true, color: C.mute }); ctx.page.line(MX, ctx.y + 12, PW - MX, ctx.y + 12, { color: C.dark, lw: 0.8 }); ctx.y += 16; };
    const docBand = (left, mid, right) => {
      ensure(60);
      const p = ctx.page, h = 24;
      p.rect(MX, ctx.y, CW, h, { fill: C.dark });
      p.text(MX + 8, ctx.y + 16.5, left, { size: 12.5, bold: true, color: C.white });
      const lw = doc.text(left, 12.5, true);
      if (mid) p.text(MX + 8 + lw + 14, ctx.y + 16, mid, { size: 10, color: C.white });
      if (right) p.text(PW - MX - 8, ctx.y + 16, right, { size: 10, bold: true, color: C.white, align: 'right' });
      ctx.y += h;
    };

    /* ----- strona tytułowa / info ----- */
    const wantCal = sections.includes('calendar');
    const firstSec = SECTIONS.find((s) => sections.includes(s[0]));
    ctx.section = wantCal ? 'Kalendarzówka' : firstSec[1];
    ctx.orient = ORIENT[firstSec[0]] || 'l';
    newPage();
    const onlyDocs = sections.every((x) => ['callsheet', 'transport', 'crew', 'shotlist'].includes(x));
    if (!onlyDocs) {
      const p = ctx.page;
      p.text(MX, ctx.y + 22, titleOf(st).toUpperCase(), { size: 22, bold: true, color: C.ink });
      p.text(MX, ctx.y + 40, wantCal ? 'KALENDARZ ZDJĘCIOWY' : 'ZESTAWIENIA PRODUKCYJNE', { size: 10, bold: true, color: C.mute });
      ctx.y += 54;
      const t = data.totals;
      const info = [
        ['Reżyser', st.meta.director], ['Producent', st.meta.producer], ['Kierownik produkcji', st.meta.manager], ['Firma produkcyjna', st.meta.company],
        ['Wersja scenariusza', [st.meta.scriptVersion, st.meta.scriptDate && Core.fmtShort(st.meta.scriptDate)].filter(Boolean).join(' · ')],
        ['Okres zdjęć', t.from ? `${Core.fmtShort(t.from)} – ${Core.fmtShort(t.to)}` : 'nie zaplanowano'],
        ['Dni zdjęciowe', String(t.shootDays)], ['Sceny w planie', `${t.planned} z ${t.scenes}`],
        ['Długość scenariusza', `${Core.fmtEighths(t.eighths)} str.`], ['Limit planu dnia', `do ${+st.meta.pagesPerDay} str.`],
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
      // legenda kolorów
      const keys = Object.keys(Core.STRIP);
      let lx = MX;
      keys.forEach((k) => {
        p.rect(lx, ctx.y, 14, 9, { fill: Core.STRIP[k].bg, stroke: '9AA3AB', lw: 0.5 });
        p.text(lx + 19, ctx.y + 7.5, Core.STRIP[k].name, { size: 7.2, color: C.mute });
        lx += 19 + doc.text(Core.STRIP[k].name, 7.2) + 16;
      });
      ctx.y += 22;
    }

    /* ----- kalendarzówka ----- */
    if (wantCal) {
      began = true;
      if (!data.days.length) textBlock('Nie dodano jeszcze dni zdjęciowych. Zaplanuj sceny w zakładce „Kalendarzówka”.', { color: C.mute });
      for (const d of data.days) {
        if (d.kind === 'off') { dayBand(d); ctx.y += 10; continue; }
        dayBand(d);
        const rows = d.rows.map(rowSchedule);
        rows.push({ cells: ['', '', '', `Razem: ${d.rows.length} ${Core.pl(d.rows.length, 'scena', 'sceny', 'scen')}`, d.sites.join(' · '), '', Core.fmtEighths(d.eighths), ''], bg: C.band, bold: true });
        table(colsSchedule, rows, { header: headSchedule, contBand: () => dayBand(d, true), vlines: true });
        if (d.cast.length) textBlock('Obsada dnia: ' + d.cast.map((c) => `${c.id} ${c.name}${c.actor ? ' (' + c.actor + ')' : ''}`).join('   ·   '), { size: 7.8, color: C.ink });
        if (d.note) textBlock('Uwagi: ' + d.note, { size: 7.8, color: C.mute });
        ctx.y += 12;
      }
      if (data.unscheduled.length) {
        ensure(60);
        ctx.page.rect(MX, ctx.y, CW, 21, { fill: C.off });
        ctx.page.text(MX + 8, ctx.y + 14.5, 'SCENY NIEZAPLANOWANE (' + data.unscheduled.length + ')', { size: 11, bold: true, color: C.white });
        ctx.y += 21;
        table(colsSchedule, data.unscheduled.map(rowSchedule), { header: headSchedule, vlines: true });
      }
    }

    /* ----- rozpiska scen ----- */
    if (sections.includes('board')) {
      begin('Rozpiska scen');
      const cols = [{ w: 36, align: 'center', bold: true }, { w: 36, align: 'center' }, { w: 30, align: 'center' }, { w: 180 }, { w: 270 }, { w: 90 }, { w: 40, align: 'center' }, { w: 55, align: 'center' }, { w: 48, align: 'center' }];
      const rows = data.scenes.map((r) => ({ cells: [r.num, r.ieLabel, r.todShort, r.place, r.synopsis, r.castText, r.pages, r.dayNo ? 'D' + r.dayNo : '—', r.page || ''], bg: r.bg }));
      rows.push({ cells: ['', '', '', `Razem: ${data.scenes.length} ${Core.pl(data.scenes.length, 'scena', 'sceny', 'scen')}`, '', '', Core.fmtEighths(data.totals.eighths), '', ''], bg: C.band, bold: true });
      table(cols, rows, { header: ['Sc.', 'W/Z', 'D/N', 'Plan / lokacja', 'Opis', 'Obsada', 'Str.', 'Dzień zdj.', 'Strona'], vlines: true });
    }

    /* ----- shotlista ----- */
    if (sections.includes('shotlist')) {
      begin('Shotlista');
      const sr = Core.shotRows(st);
      if (!sr.length) textBlock('Nie dodano jeszcze ujęć. Uzupełnij je w zakładce „Shotlista”.', { color: C.mute });
      else {
        const rows = sr.map((x) => ({ cells: [x.num, x.shot, x.type, x.desc, x.lens, x.grip, x.eta, x.cast, x.site], bg: x.bg || undefined }));
        const eta = sr.reduce((a, x) => a + (x.etaMin || 0), 0);
        rows.push({ cells: ['', '', '', `Razem: ${sr.length} ${Core.pl(sr.length, 'ujęcie', 'ujęcia', 'ujęć')}`, '', '', eta ? Core.fmtDur(eta) : '', '', ''], bg: C.band, bold: true });
        table([{ w: 40, align: 'center', bold: true }, { w: 44, align: 'center' }, { w: 44, align: 'center', bold: true }, { w: 236 }, { w: 60 }, { w: 80 }, { w: 46, align: 'center' }, { w: 120 }, { w: 115 }],
          rows, { header: ['Sc.', 'Ujęcie', 'Typ planu', 'Opis', 'Obiektyw', 'Grip', 'ETA', 'Aktorzy', 'Lokacja'], vlines: true, keep: 20 });
      }
      subhead('Legenda – typy planu');
      table([{ w: 56, align: 'center', bold: true }, { w: 130, bold: true }, { w: 600 }], Core.SHOT_TYPES.map(([k, n, d]) => ({ cells: [k, n, d] })), { header: ['Skrót', 'Typ planu', 'Opis'], vlines: true, keep: 20 });
    }

    /* ----- obsada ----- */
    if (sections.includes('cast')) {
      begin('Obsada');
      const cols = [{ w: 30, align: 'center', bold: true }, { w: 150, bold: true }, { w: 170 }, { w: 40, align: 'center' }, { w: 50, align: 'center' }, { w: 150 }, { w: 195 }];
      const rows = data.cast.map((c) => ({ cells: [c.id, c.name, c.actor, c.scenes, Core.fmtEighths(c.eighths), c.days.length ? c.days.map((n) => 'D' + n).join(', ') : '—', c.sceneNums.join(', ')] }));
      table(cols, rows, { header: ['Nr', 'Postać', 'Aktor / aktorka', 'Sceny', 'Str.', 'Dni zdjęciowe', 'Numery scen'], vlines: true });
    }

    /* ----- ekipa (A4 pionowo, tylko dane podstawowe) ----- */
    if (sections.includes('crew')) {
      begin('Ekipa', 'p');
      const groups = Core.crewGroups(st);
      const n = st.crew.length;
      docBand('EKIPA FILMOWA', titleOf(st), `${n} ${Core.pl(n, 'osoba', 'osoby', 'osób')}`);
      ctx.y += 6;
      if (!n) textBlock('Nie dodano jeszcze osób do ekipy.', { color: C.mute });
      else {
        const rows = [];
        let k = 0;
        groups.forEach((g) => {
          rows.push({ cells: ['', g.dept.toUpperCase() + ' · ' + g.list.length, '', ''], bg: C.band, bold: true });
          g.list.forEach((c) => { k += 1; rows.push({ cells: [k, Core.crewName(c), c.role, c.phone] }); });
        });
        table([{ w: 28, align: 'center' }, { w: 200, bold: true }, { w: 190 }, { w: 121 }], rows, { header: ['Lp.', 'Imię i nazwisko', 'Funkcja', 'Telefon'], vlines: true, keep: 30, contBand: () => docBand('EKIPA FILMOWA', '(cd.)', '') });
      }
    }

    /* ----- lokacje ----- */
    if (sections.includes('sites')) {
      begin('Lokacje');
      const cols = [{ w: 170, bold: true }, { w: 170 }, { w: 40, align: 'center' }, { w: 50, align: 'center' }, { w: 120 }, { w: 235 }];
      const rows = data.sites.map((s) => ({ cells: [s.site, s.address, s.scenes, Core.fmtEighths(s.eighths), s.days.length ? s.days.map((n) => 'D' + n).join(', ') : '—', s.sceneNums.join(', ')] }));
      table(cols, rows, { header: ['Obiekt', 'Adres / uwagi', 'Sceny', 'Str.', 'Dni zdjęciowe', 'Numery scen'], vlines: true });
    }

    /* ----- DOOD ----- */
    if (sections.includes('dood')) {
      begin('Day out of Days');
      const dd = data.dood;
      if (!dd.days.length) textBlock('Brak dni zdjęciowych. Zaplanuj sceny, aby zobaczyć zestawienie.', { color: C.mute });
      else {
        const nameW = 24 + 105 + 95, dayW = 22, tot = 34;
        const perPage = Math.max(8, Math.floor((CW - nameW - tot * 2) / dayW));
        for (let off = 0; off < dd.days.length; off += perPage) {
          const chunk = dd.days.slice(off, off + perPage);
          const p0 = off === 0;
          if (!p0) startSection('Day out of Days (cd.)');
          const rowH = 15, headH = 34;
          ensure(headH + rowH * 3);
          let p = ctx.page, y = ctx.y;
          const TW = nameW + chunk.length * dayW + tot * 2;
          p.rect(MX, y, TW, headH, { fill: C.head });
          p.text(MX + 4, y + 21, 'Nr', { size: 7.5, bold: true });
          p.text(MX + 28, y + 21, 'Postać', { size: 7.5, bold: true });
          p.text(MX + 133, y + 21, 'Aktor / aktorka', { size: 7.5, bold: true });
          chunk.forEach((d, i) => {
            const cx = MX + nameW + i * dayW + dayW / 2;
            p.text(cx, y + 11, 'D' + d.no, { size: 7.5, bold: true, align: 'center' });
            p.text(cx, y + 20, Core.fmtDM(d.date), { size: 6, color: C.mute, align: 'center' });
            p.text(cx, y + 28, d.date ? Core.DAYS_SHORT[Core.dow(d.date)] : '', { size: 6, color: C.mute, align: 'center' });
          });
          const tx = MX + nameW + chunk.length * dayW;
          p.text(tx + tot / 2, y + 17, 'Dni', { size: 7, bold: true, align: 'center' });
          p.text(tx + tot / 2, y + 27, 'pracy', { size: 7, bold: true, align: 'center' });
          p.text(tx + tot + tot / 2, y + 17, 'Dni', { size: 7, bold: true, align: 'center' });
          p.text(tx + tot + tot / 2, y + 27, 'wstrz.', { size: 7, bold: true, align: 'center' });
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
          [['SW', 'start pracy'], ['W', 'praca'], ['WF', 'koniec pracy'], ['SWF', 'start i koniec jednego dnia'], ['H', 'wstrzymanie (bez grania)']].forEach(([k, label]) => {
            ctx.page.rect(lx, ctx.y, 20, 10, { fill: DOOD_BG[k] });
            ctx.page.text(lx + 10, ctx.y + 7.6, k, { size: 6.4, bold: true, align: 'center' });
            ctx.page.text(lx + 25, ctx.y + 8, label, { size: 7.2, color: C.mute });
            lx += 25 + doc.text(label, 7.2) + 18;
          });
          ctx.y += 16;
        }
      }
    }

    /* ----- plan pracy (call sheet) ----- */
    const csDays = sections.includes('callsheet') ? data.days.filter((d) => d.kind === 'shoot' && (!opts.dayId || d.id === opts.dayId)) : [];
    csDays.forEach((d) => {
      const stDay = st.days.find((x) => x.id === d.id);
      const sh = Core.sheetOf(st, d.id);
      const crows = Core.callRows(st, stDay);
      const label = 'Plan pracy · Dzień ' + d.no;
      if (!began) { began = true; ctx.section = label; } else startSection(label, 'p');
      docBand('PLAN PRACY · DZIEŃ ' + d.no, Core.fmtDatePL(d.date), 'Zbiórka ekipy ' + (sh.crewCall || d.call || '—'));
      const info = [['Zbiórka ekipy', sh.crewCall || d.call, 1], ['Wschód słońca', sh.sunrise, 1], ['Zachód słońca', sh.sunset, 1], ['Sceny w planie', `${d.rows.length} · ${Core.fmtEighths(d.eighths)} str.`, 1],
        ['Pogoda', sh.weather, 2], ['Szpital / pogotowie', sh.hospital, 2]];
      const iw = CW / 4;
      ensure(90);
      ctx.y += 4;
      let col = 0, rowMax = 0;
      info.forEach(([lab, val, span]) => {
        if (col + span > 4) { ctx.y += rowMax; col = 0; rowMax = 0; }
        const x = MX + col * iw;
        ctx.page.text(x + 4, ctx.y + 8, lab.toUpperCase(), { size: 6.6, bold: true, color: C.mute });
        const ls = doc.wrap(val || '—', iw * span - 12, 9).slice(0, 3);
        ls.forEach((ln, k) => ctx.page.text(x + 4, ctx.y + 19 + k * 11, ln, { size: 9, color: val ? C.ink : C.mute }));
        rowMax = Math.max(rowMax, 24 + (ls.length - 1) * 11);
        col += span;
      });
      ctx.y += rowMax + 4;
      subhead('Harmonogram dnia');
      const timeOf = (r) => (r.from && r.to ? r.from + '–' + r.to : r.from || r.to || '');
      const rows = crows.map((r) => ({ cells: [timeOf(r), r.num, r.shot, r.desc, r.cast, r.camera, r.notes], bg: r.kind === 'scene' ? r.bg : C.band, bold: r.kind !== 'scene' }));
      if (!rows.length) textBlock('Harmonogram jest pusty.', { color: C.mute });
      else table([{ w: 62, align: 'center', bold: true }, { w: 28, align: 'center', bold: true }, { w: 34, align: 'center' }, { w: 150 }, { w: 48, align: 'center' }, { w: 90 }, { w: 127 }],
        rows, { header: ['Godz.', 'Sc.', 'Uj.', 'Opis / plan', 'Obsada', 'Elementy kamerowe', 'Uwagi'], vlines: true, keep: 20 });
      if (d.cast.length) {
        subhead('Obsada i zbiórki');
        const crew = d.cast.map((c) => {
          const cc = sh.cast[c.id] || {};
          return { cells: [c.id, c.name, c.actor, cc.call || d.call || '', cc.makeup || '', cc.onset || '', d.rows.filter((r) => r.castIds.includes(c.id)).map((r) => r.num).join(', '), cc.note || ''] };
        });
        table([{ w: 22, align: 'center', bold: true }, { w: 95, bold: true }, { w: 95 }, { w: 42, align: 'center', bold: true }, { w: 48, align: 'center' }, { w: 42, align: 'center' }, { w: 50 }, { w: 145 }],
          crew, { header: ['Nr', 'Postać', 'Aktor / aktorka', 'Zbiórka', 'Charakt.', 'Na plan', 'Sceny', 'Uwagi'], vlines: true, keep: 20 });
      }
      const loc = Core.locationsText(st, stDay);
      if (loc.trim()) { subhead('Lokacje'); textBlock(loc, { size: 8.5 }); }
      const trips = Core.transportData(st, d.id).trips;
      if (trips.length || sh.transportNote) {
        subhead('Transport');
        if (trips.length) table([{ w: 36, align: 'center', bold: true }, { w: 70 }, { w: 85 }, { w: 90 }, { w: 90 }, { w: 90 }, { w: 78 }],
          trips.map((t) => ({ cells: [t.time, t.vehicle ? t.vehicle.name : '', t.vehicle ? [t.vehicle.driver, t.vehicle.phone].filter(Boolean).join(' ') : '', t.from, t.to, t.who, t.note] })),
          { header: ['Godz.', 'Pojazd', 'Kierowca', 'Skąd', 'Dokąd', 'Kto / co', 'Uwagi'], vlines: true, keep: 20 });
        if (sh.transportNote) textBlock(sh.transportNote, { size: 8.5 });
      }
      if (sh.contacts.length) {
        subhead('Ważne kontakty');
        table([{ w: 150, bold: true }, { w: 200 }, { w: 189 }], sh.contacts.map((c) => ({ cells: [c.role, c.name, c.phone] })), { header: ['Funkcja', 'Imię i nazwisko', 'Telefon'], vlines: true, keep: 20 });
      }
      if (sh.cameraNotes) { subhead('Elementy kamerowe'); textBlock(sh.cameraNotes, { size: 8.5 }); }
      const notes = [d.note, sh.notes].filter(Boolean).join('\n');
      if (notes) { subhead('Uwagi'); textBlock(notes, { size: 8.5 }); }
    });

    /* ----- transport ----- */
    if (sections.includes('transport')) {
      begin('Plan transportów', 'l');
      const td = Core.transportData(st, opts.dayId);
      if (!opts.dayId) {
        subhead('Pojazdy i kierowcy');
        if (!td.vehicles.length) textBlock('Nie dodano jeszcze pojazdów.', { color: C.mute });
        else table([{ w: 170, bold: true }, { w: 130 }, { w: 90 }, { w: 170 }, { w: 110 }, { w: 116 }], td.vehicles.map((v) => ({ cells: [v.name, v.type, v.plate, v.driver, v.phone, v.note] })),
          { header: ['Pojazd', 'Typ', 'Nr rej.', 'Kierowca', 'Telefon', 'Uwagi'], vlines: true, keep: 20 });
      }
      const byDay = new Map();
      td.trips.forEach((t) => { if (!byDay.has(t.dayId)) byDay.set(t.dayId, []); byDay.get(t.dayId).push(t); });
      if (!td.trips.length) textBlock('Nie zaplanowano jeszcze kursów.', { color: C.mute });
      byDay.forEach((trips, dayId) => {
        const d = data.days.find((x) => x.id === dayId); if (!d) return;
        ctx.y += 8;
        docBand('DZIEŃ ' + d.no, Core.fmtDatePL(d.date), trips.length + ' ' + Core.pl(trips.length, 'kurs', 'kursy', 'kursów'));
        table([{ w: 46, align: 'center', bold: true }, { w: 130 }, { w: 100 }, { w: 150 }, { w: 150 }, { w: 130 }, { w: 80 }],
          trips.map((t) => ({ cells: [t.time, t.vehicle ? t.vehicle.name : '—', t.vehicle ? [t.vehicle.driver, t.vehicle.phone].filter(Boolean).join(' ') : '', t.from, t.to, t.who, t.note] })),
          { header: ['Godz.', 'Pojazd', 'Kierowca', 'Skąd', 'Dokąd', 'Kto / co', 'Uwagi'], vlines: true, keep: 20, contBand: () => docBand('DZIEŃ ' + d.no + ' (cd.)', Core.fmtDatePL(d.date), '') });
      });
    }

    /* ----- kosztorys ----- */
    if (sections.includes('budget')) {
      begin('Kosztorys');
      const bd = Core.budgetData(st);
      const diff = (dev, a) => (a ? money(dev) : '—');
      subhead('Podsumowanie budżetu');
      const srows = bd.cats.map((c) => ({ cells: [c.label, money(c.est), c.act ? money(c.act) : '—', diff(c.dev, c.act), bd.est ? Math.round((c.est / bd.est) * 100) + '%' : '—'] }));
      srows.push({ cells: ['RAZEM', money(bd.est), bd.act ? money(bd.act) : '—', diff(bd.dev, bd.act), bd.est ? '100%' : '—'], bg: C.band, bold: true });
      table([{ w: 330, bold: true }, { w: 130, align: 'right' }, { w: 130, align: 'right' }, { w: 120, align: 'right' }, { w: 76, align: 'center' }], srows, { header: ['Pion', 'Planowany', 'Rzeczywisty', 'Różnica', 'Udział'], vlines: true, keep: 20 });
      textBlock('Różnica = koszt rzeczywisty minus planowany, liczona tylko dla pozycji z wpisanym kosztem rzeczywistym (wartość dodatnia oznacza przekroczenie).', { size: 7.2, color: C.mute });
      bd.cats.filter((c) => c.items.length).forEach((c) => {
        subhead(c.label);
        const rows = c.items.map((i) => ({ cells: [i.name, i.dayNo ? 'D' + i.dayNo : '', i.site || '', money(i.est), i.act ? money(i.act) : '—', i.act ? money(i.act - i.est) : '—'] }));
        rows.push({ cells: ['Razem: ' + c.label, '', '', money(c.est), c.act ? money(c.act) : '—', diff(c.dev, c.act)], bg: C.band, bold: true });
        table([{ w: 300 }, { w: 60, align: 'center' }, { w: 150 }, { w: 100, align: 'right' }, { w: 100, align: 'right' }, { w: 76, align: 'right' }], rows, { header: ['Pozycja', 'Dzień', 'Obiekt', 'Planowany', 'Rzeczywisty', 'Różnica'], vlines: true, keep: 20 });
      });
    }

    // stopki z numerami stron
    const total = doc.pages.length;
    doc.pages.forEach((pg, i) => {
      pg.line(MX, pg.h - 26, pg.w - MX, pg.h - 26, { color: C.line, lw: 0.5 });
      pg.text(MX, pg.h - 15, [st.meta.company, st.meta.producer && 'Producent: ' + st.meta.producer].filter(Boolean).join('   ·   ') || 'Klaps', { size: 7.5, color: C.mute });
      pg.text(pg.w - MX, pg.h - 15, `Strona ${i + 1} z ${total}`, { size: 7.5, color: C.mute, align: 'right' });
    });
    return await doc.build();
  }

  /* ============================== EXCEL ============================== */
  const sFont = (o) => Object.assign({ sz: 10 }, o);
  const BORDER = { all: 'thin', color: 'C3CAD0' };

  async function buildXlsx(st, sections, opts) {
    opts = opts || {};
    sections = sections || SECTIONS.map((s) => s[0]);
    const data = Core.reportData(st);
    const wb = new Xlsx.Workbook({ title: titleOf(st) + ' – kalendarz zdjęciowy', creator: st.meta.company || 'Klaps', footer: titleOf(st) });
    const hStyle = { b: true, color: 'FFFFFF', bg: '26323B', h: 'center', wrap: true, border: BORDER };
    const titleBlock = (sh, ncols, subtitle) => {
      sh.set(1, 1, titleOf(st).toUpperCase(), { b: true, sz: 16, color: '1B2229' });
      sh.merge(1, 1, 1, ncols); sh.rowHeight(1, 26);
      sh.set(2, 1, subtitle + '  ·  stan na ' + nowText(), { sz: 9, color: '5C6670', b: true });
      sh.merge(2, 1, 2, ncols);
      const info = [st.meta.director && 'Reżyser: ' + st.meta.director, st.meta.producer && 'Producent: ' + st.meta.producer, st.meta.manager && 'Kier. prod.: ' + st.meta.manager, st.meta.scriptVersion && 'Wersja scenariusza: ' + st.meta.scriptVersion].filter(Boolean).join('   ·   ');
      sh.set(3, 1, info, { sz: 9, color: '5C6670' });
      sh.merge(3, 1, 3, ncols);
    };
    const pagesFormula = (cell, val) => ({ f: `IF(${cell}=0,"",IF(INT(${cell}/8)>0,INT(${cell}/8)&" ","")&IF(MOD(${cell},8)>0,MOD(${cell},8)&"/8",""))`, v: Core.fmtEighths(val) === '0' ? '' : Core.fmtEighths(val) });

    /* --- Kalendarzówka --- */
    if (sections.includes('calendar')) {
      const sh = wb.addSheet('Kalendarzówka', { tab: '0D6B73' });
      const widths = [7, 7, 6, 34, 48, 14, 9, 8, 30];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      const N = widths.length;
      titleBlock(sh, N, 'KALENDARZ ZDJĘCIOWY');
      let r = 5;
      const heads = ['Sc.', 'W/Z', 'D/N', 'Plan / lokacja', 'Opis', 'Obsada', 'Str.', 'Ósemki', 'Uwagi'];
      const band = (txt, right, bg) => {
        for (let c = 1; c <= N; c++) sh.set(r, c, null, { bg });
        sh.set(r, 1, txt, { b: true, sz: 12, color: 'FFFFFF', bg });
        sh.merge(r, 1, r, 6);
        if (right) { sh.set(r, 7, right, { color: 'FFFFFF', bg, h: 'right', sz: 10 }); sh.merge(r, 7, r, N); }
        sh.rowHeight(r, 22);
        r++;
      };
      for (const d of data.days) {
        if (d.kind === 'off') { band(`DZIEŃ WOLNY  ·  ${Core.fmtDatePL(d.date)}`, d.note || '', '8A949D'); r++; continue; }
        band(`DZIEŃ ${d.no}  ·  ${Core.fmtDatePL(d.date)}`, `Zbiórka ${d.call || '—'}`, '26323B');
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
        sh.set(r, 4, `Razem: ${d.rows.length} ${Core.pl(d.rows.length, 'scena', 'sceny', 'scen')}`, { b: true, bg: 'E4EAEF', border: BORDER });
        sh.set(r, 5, d.sites.join(' · '), { bg: 'E4EAEF', border: BORDER, wrap: true, sz: 9 });
        if (d.rows.length) {
          sh.set(r, 8, { f: `SUM(H${first}:H${last})`, v: d.eighths }, tot);
          sh.set(r, 7, pagesFormula('H' + r, d.eighths), tot);
        }
        r++;
        if (d.cast.length) { sh.set(r, 1, 'Obsada dnia: ' + d.cast.map((c) => `${c.id} ${c.name}${c.actor ? ' (' + c.actor + ')' : ''}`).join('   ·   '), { sz: 9, wrap: true, v: 'top' }); sh.merge(r, 1, r, N); sh.rowHeight(r, 14 + 12 * Math.floor(d.cast.map((c) => c.name + (c.actor || '')).join('').length / 150)); r++; }
        if (d.note) { sh.set(r, 1, 'Uwagi: ' + d.note, { sz: 9, color: '5C6670', wrap: true }); sh.merge(r, 1, r, N); r++; }
        r++;
      }
      if (data.unscheduled.length) {
        band('SCENY NIEZAPLANOWANE (' + data.unscheduled.length + ')', '', '8A949D');
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
      const sh = wb.addSheet('Rozpiska scen', { tab: 'C9A227', freeze: { row: 5, col: 3 } });
      const widths = [7, 7, 6, 32, 20, 46, 12, 28, 9, 8, 9, 12, 8, 28, 30];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, 'ROZPISKA SCEN');
      const heads = ['Sc.', 'W/Z', 'D/N', 'Plan / lokacja', 'Obiekt', 'Opis', 'Obsada (nr)', 'Obsada', 'Str.', 'Ósemki', 'Dzień zdj.', 'Data', 'Strona', 'Elementy', 'Uwagi'];
      heads.forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      sh.rowHeight(5, 26);
      const dayDate = new Map(data.days.filter((d) => d.kind === 'shoot').map((d) => [d.no, d.date]));
      let r = 6;
      const labelOf = new Map(Core.ELEMENT_CATS);
      data.scenes.forEach((x) => {
        const base = { bg: x.bg, border: BORDER, v: 'center' };
        const el = Object.entries(x.elements).filter(([, v]) => v && v.length).map(([k, v]) => `${labelOf.get(k) || k}: ${v.join(', ')}`).join('; ');
        const vals = [x.num, x.ieLabel, x.todShort, x.place, x.site, x.synopsis, x.castText, x.castNames.join(', '), x.pages, x.eighths, x.dayNo ? 'D' + x.dayNo : '', x.dayNo ? { date: dayDate.get(x.dayNo) } : '', x.page || '', el, x.notes];
        vals.forEach((val, i) => {
          sh.set(r, i + 1, val, Object.assign({}, base, { b: i === 0, h: [0, 1, 2, 8, 9, 10, 11, 12].includes(i) ? 'center' : undefined, wrap: [3, 5, 7, 13, 14].includes(i), fmt: i === 11 ? 'dd.mm.yyyy' : undefined }));
        });
        sh.rowHeight(r, Math.max(16, Math.ceil((x.synopsis || '').length / 52) * 13 + 3));
        r++;
      });
      const tot = { b: true, bg: 'E4EAEF', border: BORDER, h: 'center' };
      for (let c = 1; c <= widths.length; c++) sh.set(r, c, null, tot);
      sh.set(r, 4, `Razem: ${data.scenes.length} ${Core.pl(data.scenes.length, 'scena', 'sceny', 'scen')}`, { b: true, bg: 'E4EAEF', border: BORDER });
      if (data.scenes.length) {
        sh.set(r, 10, { f: `SUM(J6:J${r - 1})`, v: data.totals.eighths }, tot);
        sh.set(r, 9, pagesFormula('J' + r, data.totals.eighths), tot);
        sh.opts.filter = `A5:${Xlsx.colName(widths.length)}${r - 1}`;
      }
      sh.opts.printTitles = '$5:$5';
    }

    /* --- Shotlista --- */
    if (sections.includes('shotlist')) {
      const sh = wb.addSheet('Shotlista', { tab: '7A4FB5', freeze: { row: 5 } });
      const widths = [8, 9, 10, 46, 14, 18, 11, 28, 26];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, 'SHOTLISTA');
      ['Scena', 'Ujęcie', 'Typ planu', 'Opis', 'Obiektyw', 'Grip', 'ETA (min)', 'Aktorzy', 'Lokacja'].forEach((h, i) => sh.set(5, i + 1, h, hStyle));
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
        sh.set(r, 4, `Razem: ${sr.length} ${Core.pl(sr.length, 'ujęcie', 'ujęcia', 'ujęć')}`, { b: true, bg: 'E4EAEF', border: BORDER });
        sh.set(r, 7, { f: `SUM(G6:G${r - 1})`, v: sr.reduce((a, x) => a + (x.etaMin || 0), 0) }, tot);
        sh.opts.filter = `A5:I${r - 1}`;
        r++;
      }
      r += 1;
      sh.set(r, 1, 'LEGENDA – TYPY PLANU', { b: true, sz: 10, color: '5C6670' }); r++;
      Core.SHOT_TYPES.forEach(([k, n, d]) => {
        sh.set(r, 1, k, { b: true, border: BORDER, h: 'center', bg: 'E4EAEF' });
        sh.set(r, 2, n, { b: true, border: BORDER }); sh.set(r, 3, null, { border: BORDER }); sh.merge(r, 2, r, 3);
        sh.set(r, 4, d, { border: BORDER, wrap: true }); for (let c = 5; c <= 9; c++) sh.set(r, c, null, { border: BORDER }); sh.merge(r, 4, r, 9);
        r++;
      });
      sh.opts.printTitles = '$5:$5';
    }

    /* --- Obsada --- */
    if (sections.includes('cast')) {
      const sh = wb.addSheet('Obsada', { tab: '3C7DD9', freeze: { row: 5 } });
      const widths = [6, 26, 28, 8, 9, 10, 26, 46, 30];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, 'OBSADA');
      ['Nr', 'Postać', 'Aktor / aktorka', 'Sceny', 'Ósemki', 'Dni zdj.', 'Dni zdjęciowe', 'Numery scen', 'Uwagi'].forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      let r = 6;
      data.cast.forEach((c) => {
        const b = { border: BORDER, v: 'center' };
        sh.set(r, 1, c.id, Object.assign({}, b, { b: true, h: 'center' }));
        sh.set(r, 2, c.name, Object.assign({}, b, { b: true }));
        sh.set(r, 3, c.actor, b);
        sh.set(r, 4, c.scenes, Object.assign({}, b, { h: 'center' }));
        sh.set(r, 5, c.eighths, Object.assign({}, b, { h: 'center' }));
        sh.set(r, 6, c.days.length, Object.assign({}, b, { h: 'center' }));
        sh.set(r, 7, c.days.map((n) => 'D' + n).join(', '), Object.assign({}, b, { wrap: true }));
        sh.set(r, 8, c.sceneNums.join(', '), Object.assign({}, b, { wrap: true }));
        sh.set(r, 9, c.notes, Object.assign({}, b, { wrap: true }));
        sh.rowHeight(r, Math.max(16, Math.ceil(c.sceneNums.join(', ').length / 48) * 13 + 3));
        r++;
      });
      if (data.cast.length) sh.opts.filter = `A5:I${r - 1}`;
    }

    /* --- Ekipa --- */
    if (sections.includes('crew')) {
      const sh = wb.addSheet('Ekipa', { tab: '2F8F83', freeze: { row: 5 }, portrait: true });
      const widths = [6, 16, 20, 20, 24, 16, 20, 18, 9, 18, 22, 34];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, 'EKIPA FILMOWA');
      ['Lp.', 'Imię', 'Nazwisko', 'Pion', 'Funkcja', 'Telefon', 'Typ umowy', 'Stawka', 'Nocleg', 'Dieta', 'Transport', 'Uwagi'].forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      sh.rowHeight(5, 26);
      let r = 6, k = 0;
      Core.crewGroups(st).forEach((g) => g.list.forEach((c) => {
        k += 1;
        const b = { border: BORDER, v: 'center', wrap: true };
        [k, c.first, c.last, g.dept === 'Bez pionu' ? '' : g.dept, c.role, c.phone, c.contract, c.rate, c.lodging, c.diet, c.transport, c.notes].forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, b, { h: i === 0 || i === 8 ? 'center' : undefined, b: i === 1 || i === 2 })));
        r++;
      }));
      if (k) sh.opts.filter = `A5:L${r - 1}`;
      sh.set(r + 1, 1, 'Arkusz zawiera także dane wewnętrzne (umowy, stawki). Do wysyłki ekipie użyj pliku PDF, który ma tylko dane podstawowe.', { sz: 9, color: '5C6670' });
      sh.opts.printTitles = '$5:$5';
    }

    /* --- Lokacje --- */
    if (sections.includes('sites')) {
      const sh = wb.addSheet('Lokacje', { tab: '3FA062', freeze: { row: 5 } });
      const widths = [32, 34, 8, 9, 22, 46, 38, 28];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, 'LOKACJE');
      ['Obiekt', 'Adres', 'Sceny', 'Ósemki', 'Dni zdjęciowe', 'Numery scen', 'Plany', 'Uwagi'].forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      let r = 6;
      data.sites.forEach((s) => {
        const b = { border: BORDER, v: 'center' };
        sh.set(r, 1, s.site, Object.assign({}, b, { b: true, wrap: true }));
        sh.set(r, 2, s.address, Object.assign({}, b, { wrap: true }));
        sh.set(r, 3, s.scenes, Object.assign({}, b, { h: 'center' }));
        sh.set(r, 4, s.eighths, Object.assign({}, b, { h: 'center' }));
        sh.set(r, 5, s.days.map((n) => 'D' + n).join(', '), Object.assign({}, b, { wrap: true }));
        sh.set(r, 6, s.sceneNums.join(', '), Object.assign({}, b, { wrap: true }));
        sh.set(r, 7, s.places.join('; '), Object.assign({}, b, { wrap: true }));
        sh.set(r, 8, s.notes, Object.assign({}, b, { wrap: true }));
        sh.rowHeight(r, Math.max(16, Math.ceil(s.sceneNums.join(', ').length / 48) * 13 + 3));
        r++;
      });
      if (data.sites.length) sh.opts.filter = `A5:H${r - 1}`;
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
      sh.set(5, 1, 'Nr', hs); sh.set(5, 2, 'Postać', hs); sh.set(5, 3, 'Aktor / aktorka', hs);
      sh.merge(5, 1, 7, 1); sh.merge(5, 2, 7, 2); sh.merge(5, 3, 7, 3);
      for (let r2 = 5; r2 <= 7; r2++) for (let c = 1; c <= 3; c++) if (!(r2 === 5)) sh.set(r2, c, null, hs);
      dd.days.forEach((d, i) => {
        sh.set(5, 4 + i, 'D' + d.no, hs);
        sh.set(6, 4 + i, d.date ? { date: d.date } : '', Object.assign({}, hs, { fmt: 'dd.mm', sz: 8, b: false }));
        sh.set(7, 4 + i, d.date ? Core.DAYS_SHORT[Core.dow(d.date)] : '', Object.assign({}, hs, { sz: 8, b: false }));
      });
      sh.set(5, 4 + n, 'Dni pracy', hs); sh.set(5, 5 + n, 'Dni wstrz.', hs);
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
      sh.set(r, 1, 'SW – start pracy · W – praca · WF – koniec pracy · SWF – start i koniec w jednym dniu · H – wstrzymanie (aktor opłacony, nie gra)', { sz: 9, color: '5C6670' });
      sh.merge(r, 1, r, Math.max(8, 5 + n));
    }

    /* --- Plany pracy --- */
    if (sections.includes('callsheet')) {
      data.days.filter((d) => d.kind === 'shoot' && (!opts.dayId || d.id === opts.dayId)).forEach((d) => {
        const stDay = st.days.find((x) => x.id === d.id);
        const sh = wb.addSheet('Plan pracy D' + d.no, { tab: '0D6B73', portrait: true });
        const widths = [9, 9, 8, 9, 34, 30, 24, 24, 12];
        widths.forEach((w, i) => sh.colWidth(i + 1, w));
        const N = widths.length;
        titleBlock(sh, N, 'PLAN PRACY · DZIEŃ ' + d.no + ' · ' + Core.fmtDatePL(d.date));
        const cs = Core.sheetOf(st, d.id), crows = Core.callRows(st, stDay);
        let r = 5;
        const info = [['Zbiórka ekipy', cs.crewCall || d.call], ['Wschód słońca', cs.sunrise], ['Zachód słońca', cs.sunset], ['Pogoda', cs.weather], ['Szpital / pogotowie', cs.hospital]];
        info.forEach((kv) => { sh.set(r, 1, kv[0], { b: true, sz: 9, color: '5C6670' }); sh.merge(r, 1, r, 3); sh.set(r, 4, kv[1] || '—', { sz: 10, wrap: true }); sh.merge(r, 4, r, N); r++; });
        r++;
        const section = (t) => { for (let c = 1; c <= N; c++) sh.set(r, c, null, { bg: '26323B' }); sh.set(r, 1, t.toUpperCase(), { b: true, color: 'FFFFFF', bg: '26323B', sz: 10 }); sh.merge(r, 1, r, N); sh.rowHeight(r, 18); r++; };
        const head = (arr, spans) => { let c = 1; arr.forEach((h, i) => { sh.set(r, c, h, hStyle); const sp = (spans && spans[i]) || 1; for (let k = 1; k < sp; k++) sh.set(r, c + k, null, hStyle); if (sp > 1) sh.merge(r, c, r, c + sp - 1); c += sp; }); r++; };
        section('Harmonogram dnia');
        head(['Od', 'Do', 'Sc.', 'Ujęcie', 'Opis / plan', 'Obsada', 'Elementy kamerowe', 'Uwagi'], [1, 1, 1, 1, 1, 1, 1, 2]);
        crows.forEach((x) => {
          const scn = x.kind === 'scene', base = { bg: scn ? x.bg : 'E4EAEF', border: BORDER, v: 'center' };
          [x.from, x.to, x.num, x.shot, x.desc, x.cast, x.camera, x.notes].forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, base, { b: i < 3 || !scn, h: [0, 1, 2, 3].includes(i) ? 'center' : undefined, wrap: i >= 4 })));
          sh.set(r, 9, null, base); sh.merge(r, 8, r, 9);
          sh.rowHeight(r, Math.max(16, Math.ceil(Math.max((x.desc || '').length / 38, (x.camera || '').length / 26, (x.notes || '').length / 34, 1)) * 13 + 3)); r++;
        });
        r++;
        if (d.cast.length) {
          section('Obsada i zbiórki');
          head(['Nr', 'Postać', 'Zbiórka', 'Aktor / aktorka', 'Charakteryzacja / na plan / uwagi', 'Sceny'], [1, 2, 1, 1, 1, 3]);
          d.cast.forEach((c) => {
            const cc = cs.cast[c.id] || {}, b = { border: BORDER, v: 'center', wrap: true };
            sh.set(r, 1, c.id, Object.assign({}, b, { b: true, h: 'center' }));
            sh.set(r, 2, c.name, Object.assign({}, b, { b: true })); sh.set(r, 3, null, b); sh.merge(r, 2, r, 3);
            sh.set(r, 4, cc.call || d.call || '', Object.assign({}, b, { b: true, h: 'center' }));
            sh.set(r, 5, c.actor, b);
            sh.set(r, 6, [cc.makeup && 'Charakteryzacja ' + cc.makeup, cc.onset && 'Na plan ' + cc.onset, cc.note].filter(Boolean).join(' · '), b);
            sh.set(r, 7, d.rows.filter((x) => x.castIds.includes(c.id)).map((x) => x.num).join(', '), b); sh.set(r, 8, null, b); sh.set(r, 9, null, b); sh.merge(r, 7, r, 9);
            r++;
          });
          r++;
        }
        const loc = Core.locationsText(st, stDay);
        if (loc.trim()) { section('Lokacje'); sh.set(r, 1, loc, { wrap: true, v: 'top' }); sh.merge(r, 1, r, N); sh.rowHeight(r, 16 + 13 * loc.split('\n').length); r += 2; }
        const trips = Core.transportData(st, d.id).trips;
        if (trips.length) {
          section('Transport');
          head(['Godz.', 'Pojazd', 'Kierowca', 'Skąd → dokąd', 'Kto / co'], [1, 2, 2, 1, 3]);
          trips.forEach((t) => {
            const b = { border: BORDER, wrap: true, v: 'center' };
            sh.set(r, 1, t.time, Object.assign({}, b, { b: true, h: 'center' }));
            sh.set(r, 2, t.vehicle ? t.vehicle.name : '', b); sh.set(r, 3, null, b); sh.merge(r, 2, r, 3);
            sh.set(r, 4, t.vehicle ? [t.vehicle.driver, t.vehicle.phone].filter(Boolean).join(' ') : '', b); sh.set(r, 5, null, b); sh.merge(r, 4, r, 5);
            sh.set(r, 6, [t.from, t.to].filter(Boolean).join(' → '), b);
            sh.set(r, 7, [t.who, t.note].filter(Boolean).join(' · '), b); sh.set(r, 8, null, b); sh.set(r, 9, null, b); sh.merge(r, 7, r, 9);
            r++;
          });
          r++;
        }
        if (cs.contacts.length) {
          section('Ważne kontakty');
          head(['Funkcja', 'Imię i nazwisko', 'Telefon'], [3, 3, 3]);
          cs.contacts.forEach((c) => { const b = { border: BORDER, wrap: true }; [c.role, c.name, c.phone].forEach((v, i) => { sh.set(r, 1 + i * 3, v, Object.assign({}, b, { b: i === 0 })); sh.set(r, 2 + i * 3, null, b); sh.set(r, 3 + i * 3, null, b); sh.merge(r, 1 + i * 3, r, 3 + i * 3); }); r++; });
          r++;
        }
        if (cs.transportNote) { section('Transport – informacje'); sh.set(r, 1, cs.transportNote, { wrap: true, v: 'top' }); sh.merge(r, 1, r, N); r += 2; }
        if (cs.cameraNotes) { section('Elementy kamerowe'); sh.set(r, 1, cs.cameraNotes, { wrap: true, v: 'top' }); sh.merge(r, 1, r, N); sh.rowHeight(r, 16 + 13 * cs.cameraNotes.split('\n').length); r += 2; }
        const notes = [d.note, cs.notes].filter(Boolean).join('\n');
        if (notes) { section('Uwagi'); sh.set(r, 1, notes, { wrap: true, v: 'top' }); sh.merge(r, 1, r, N); sh.rowHeight(r, 16 + 13 * notes.split('\n').length); }
      });
    }

    /* --- Transport --- */
    if (sections.includes('transport')) {
      const td = Core.transportData(st, opts.dayId);
      if (!opts.dayId) {
        const sv = wb.addSheet('Pojazdy', { tab: '8A6D1F', freeze: { row: 5 } });
        [28, 24, 14, 26, 18, 36].forEach((w, i) => sv.colWidth(i + 1, w));
        titleBlock(sv, 6, 'POJAZDY I KIEROWCY');
        ['Pojazd', 'Typ', 'Nr rej.', 'Kierowca', 'Telefon', 'Uwagi'].forEach((h, i) => sv.set(5, i + 1, h, hStyle));
        td.vehicles.forEach((v, k) => [v.name, v.type, v.plate, v.driver, v.phone, v.note].forEach((val, i) => sv.set(6 + k, i + 1, val, { border: BORDER, b: i === 0, wrap: true, v: 'center' })));
      }
      const sh = wb.addSheet('Transport', { tab: '8A6D1F', freeze: { row: 5 } });
      const widths = [7, 12, 8, 26, 22, 28, 28, 30, 30];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, 'PLAN TRANSPORTÓW');
      ['Dzień', 'Data', 'Godz.', 'Pojazd', 'Kierowca', 'Skąd', 'Dokąd', 'Kto / co', 'Uwagi'].forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      td.trips.forEach((t, k) => {
        const r = 6 + k, b = { border: BORDER, wrap: true, v: 'center' };
        const vals = [t.dayNo ? 'D' + t.dayNo : '', t.date ? { date: t.date } : '', t.time, t.vehicle ? t.vehicle.name : '', t.vehicle ? [t.vehicle.driver, t.vehicle.phone].filter(Boolean).join(' ') : '', t.from, t.to, t.who, t.note];
        vals.forEach((val, i) => sh.set(r, i + 1, val, Object.assign({}, b, { h: i < 3 ? 'center' : undefined, b: i === 0 || i === 2, fmt: i === 1 ? 'dd.mm.yyyy' : undefined })));
      });
      if (td.trips.length) sh.opts.filter = `A5:I${5 + td.trips.length}`;
    }

    /* --- Kosztorys --- */
    if (sections.includes('budget')) {
      const bd = Core.budgetData(st);
      const MF = '#,##0.00 "zł"';
      const sh = wb.addSheet('Kosztorys', { tab: 'B5651D', freeze: { row: 5 } });
      const widths = [34, 40, 8, 26, 16, 16, 16, 32];
      widths.forEach((w, i) => sh.colWidth(i + 1, w));
      titleBlock(sh, widths.length, 'KOSZTORYS');
      ['Kategoria', 'Pozycja', 'Dzień', 'Obiekt', 'Planowany', 'Rzeczywisty', 'Różnica', 'Uwagi'].forEach((h, i) => sh.set(5, i + 1, h, hStyle));
      let r = 6;
      const subRows = [];
      bd.cats.forEach((c) => {
        const first = r;
        c.items.forEach((i) => {
          const b = { border: BORDER, v: 'center', wrap: true };
          sh.set(r, 1, c.label, b); sh.set(r, 2, i.name, Object.assign({}, b, { b: true }));
          sh.set(r, 3, i.dayNo ? 'D' + i.dayNo : '', Object.assign({}, b, { h: 'center' })); sh.set(r, 4, i.site || '', b);
          sh.set(r, 5, i.est, Object.assign({}, b, { fmt: MF })); sh.set(r, 6, i.act, Object.assign({}, b, { fmt: MF }));
          sh.set(r, 7, { f: `IF(F${r}=0,"",F${r}-E${r})`, v: i.act ? i.act - i.est : '' }, Object.assign({}, b, { fmt: MF })); sh.set(r, 8, i.note || '', b);
          r++;
        });
        const t = { b: true, bg: 'E4EAEF', border: BORDER };
        for (let k = 1; k <= 8; k++) sh.set(r, k, null, t);
        sh.set(r, 1, 'Razem: ' + c.label, t);
        sh.set(r, 5, { f: c.items.length ? `SUM(E${first}:E${r - 1})` : '0', v: c.est }, Object.assign({}, t, { fmt: MF }));
        sh.set(r, 6, { f: c.items.length ? `SUM(F${first}:F${r - 1})` : '0', v: c.act }, Object.assign({}, t, { fmt: MF }));
        sh.set(r, 7, { f: c.items.length ? `SUM(G${first}:G${r - 1})` : '0', v: c.dev }, Object.assign({}, t, { fmt: MF }));
        subRows.push(r); r++;
      });
      const g = { b: true, bg: '26323B', color: 'FFFFFF', border: BORDER };
      for (let k = 1; k <= 8; k++) sh.set(r, k, null, g);
      sh.set(r, 1, 'RAZEM', g);
      sh.set(r, 5, { f: subRows.map((x) => 'E' + x).join('+'), v: bd.est }, Object.assign({}, g, { fmt: MF }));
      sh.set(r, 6, { f: subRows.map((x) => 'F' + x).join('+'), v: bd.act }, Object.assign({}, g, { fmt: MF }));
      sh.set(r, 7, { f: subRows.map((x) => 'G' + x).join('+'), v: bd.dev }, Object.assign({}, g, { fmt: MF }));
      const grand = r;
      r += 2;
      sh.set(r, 1, 'Różnica = koszt rzeczywisty minus planowany, tylko dla pozycji z wpisanym kosztem rzeczywistym (dodatnia = przekroczenie).', { sz: 9, color: '5C6670' });
      const ss = wb.addSheet('Budżet – podsumowanie', { tab: 'B5651D' });
      [36, 18, 18, 18, 12].forEach((w, i) => ss.colWidth(i + 1, w));
      titleBlock(ss, 5, 'BUDŻET – PODSUMOWANIE PIONÓW');
      ['Pion', 'Planowany', 'Rzeczywisty', 'Różnica', 'Udział'].forEach((h, i) => ss.set(5, i + 1, h, hStyle));
      bd.cats.forEach((c, k) => {
        const rr = 6 + k, b = { border: BORDER, v: 'center' }, sr = subRows[k];
        ss.set(rr, 1, c.label, Object.assign({}, b, { b: true }));
        ss.set(rr, 2, { f: `Kosztorys!E${sr}`, v: c.est }, Object.assign({}, b, { fmt: MF }));
        ss.set(rr, 3, { f: `Kosztorys!F${sr}`, v: c.act }, Object.assign({}, b, { fmt: MF }));
        ss.set(rr, 4, { f: `Kosztorys!G${sr}`, v: c.dev }, Object.assign({}, b, { fmt: MF }));
        ss.set(rr, 5, { f: `IF(Kosztorys!E${grand}=0,0,B${rr}/Kosztorys!E${grand})`, v: bd.est ? c.est / bd.est : 0 }, Object.assign({}, b, { fmt: '0%', h: 'center' }));
      });
      const tr = 6 + bd.cats.length, tt = { b: true, bg: '26323B', color: 'FFFFFF', border: BORDER };
      ss.set(tr, 1, 'RAZEM', tt);
      ss.set(tr, 2, { f: `SUM(B6:B${tr - 1})`, v: bd.est }, Object.assign({}, tt, { fmt: MF }));
      ss.set(tr, 3, { f: `SUM(C6:C${tr - 1})`, v: bd.act }, Object.assign({}, tt, { fmt: MF }));
      ss.set(tr, 4, { f: `SUM(D6:D${tr - 1})`, v: bd.dev }, Object.assign({}, tt, { fmt: MF }));
      ss.set(tr, 5, null, tt);
    }

    return await wb.build();
  }

  return { buildPdf, buildXlsx, SECTIONS, fileStem, slug };
})();
if (typeof module !== 'undefined') module.exports = Reports;
