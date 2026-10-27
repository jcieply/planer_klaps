// @ts-nocheck
/* Moduł przeniesiony z wersji 1.x (logika bez zmian). */
import { Zip } from './zip';
/* ===== PDF: minimalny generator z osadzoną czcionką TrueType (Unicode, polskie znaki) ===== */
const Pdf = (() => {
  const enc = new TextEncoder();

  class TTF {
    constructor(bytes) {
      this.bytes = bytes;
      const dv = (this.dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength));
      const n = dv.getUint16(4);
      this.t = {};
      for (let i = 0; i < n; i++) {
        const o = 12 + i * 16;
        const tag = String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
        this.t[tag] = { off: dv.getUint32(o + 8), len: dv.getUint32(o + 12) };
      }
      const head = this.t.head.off;
      this.upm = dv.getUint16(head + 18);
      this.bbox = [dv.getInt16(head + 36), dv.getInt16(head + 38), dv.getInt16(head + 40), dv.getInt16(head + 42)];
      const hhea = this.t.hhea.off;
      this.ascent = dv.getInt16(hhea + 4);
      this.descent = dv.getInt16(hhea + 6);
      this.nHM = dv.getUint16(hhea + 34);
      this.hmtx = this.t.hmtx.off;
      this.numGlyphs = dv.getUint16(this.t.maxp.off + 4);
      this.capHeight = Math.round(this.ascent * 0.7);
      if (this.t['OS/2'] && this.t['OS/2'].len >= 90) {
        const v = dv.getUint16(this.t['OS/2'].off);
        if (v >= 2) this.capHeight = dv.getInt16(this.t['OS/2'].off + 88) || this.capHeight;
      }
      this._cmap();
    }
    _cmap() {
      const dv = this.dv, base = this.t.cmap.off;
      const nt = dv.getUint16(base + 2);
      let best = null;
      for (let i = 0; i < nt; i++) {
        const plat = dv.getUint16(base + 4 + i * 8), encId = dv.getUint16(base + 6 + i * 8), off = dv.getUint32(base + 8 + i * 8);
        const fmt = dv.getUint16(base + off);
        const score = plat === 3 && encId === 10 && fmt === 12 ? 4 : plat === 3 && encId === 1 && fmt === 4 ? 3 : plat === 0 && fmt === 4 ? 2 : plat === 0 && fmt === 12 ? 2 : 0;
        if (score && (!best || score > best.score)) best = { score, off: base + off, fmt };
      }
      this.map = new Map();
      if (!best) throw new Error('Czcionka bez tablicy cmap Unicode');
      const o = best.off;
      if (best.fmt === 4) {
        const segX2 = dv.getUint16(o + 6), seg = segX2 / 2;
        const endO = o + 14, startO = endO + segX2 + 2, deltaO = startO + segX2, rangeO = deltaO + segX2;
        for (let s = 0; s < seg; s++) {
          const end = dv.getUint16(endO + s * 2), start = dv.getUint16(startO + s * 2), delta = dv.getInt16(deltaO + s * 2), ro = dv.getUint16(rangeO + s * 2);
          for (let c = start; c <= end && c !== 0xffff; c++) {
            let g;
            if (ro === 0) g = (c + delta) & 0xffff;
            else {
              const gi = rangeO + s * 2 + ro + (c - start) * 2;
              g = dv.getUint16(gi);
              if (g) g = (g + delta) & 0xffff;
            }
            if (g) this.map.set(c, g);
          }
        }
      } else {
        const ng = dv.getUint32(o + 12);
        for (let i = 0; i < ng; i++) {
          const sc = dv.getUint32(o + 16 + i * 12), ec = dv.getUint32(o + 20 + i * 12), sg = dv.getUint32(o + 24 + i * 12);
          for (let c = sc; c <= ec; c++) this.map.set(c, sg + (c - sc));
        }
      }
    }
    adv(gid) {
      const i = gid < this.nHM ? gid : this.nHM - 1;
      return this.dv.getUint16(this.hmtx + i * 4);
    }
    gid(cp) {
      let g = this.map.get(cp);
      if (g) return g;
      // typowe zamienniki
      const alt = { 0xa0: 0x20, 0x2011: 0x2d, 0x2212: 0x2d, 0x2192: 0x3e, 0x2713: 0x78, 0x25cf: 0x2022 }[cp];
      if (alt && this.map.get(alt)) return this.map.get(alt);
      return this.map.get(0x3f) || 0;
    }
  }

  class Font {
    constructor(key, ttf, name, bold) {
      this.key = key; this.ttf = ttf; this.name = name; this.bold = bold;
      this.used = new Map(); // gid -> codepoint
      this.wcache = new Map();
    }
    width(str, size) {
      let w = 0;
      for (const ch of String(str)) {
        const cp = ch.codePointAt(0);
        let a = this.wcache.get(cp);
        if (a === undefined) { a = this.ttf.adv(this.ttf.gid(cp)); this.wcache.set(cp, a); }
        w += a;
      }
      return (w * size) / this.ttf.upm;
    }
    encode(str) {
      let hex = '';
      for (const ch of String(str)) {
        const cp = ch.codePointAt(0);
        const g = this.ttf.gid(cp);
        if (!this.used.has(g)) this.used.set(g, cp > 0xffff ? 0x3f : cp);
        hex += g.toString(16).padStart(4, '0');
      }
      return hex;
    }
  }

  const rgb = (hex) => {
    const h = String(hex || '000000').replace('#', '');
    return [0, 2, 4].map((i) => (parseInt(h.slice(i, i + 2), 16) / 255).toFixed(3)).join(' ');
  };
  const num = (n) => (Math.round(n * 100) / 100).toString();

  class Page {
    constructor(doc, w, h) { this.doc = doc; this.ops = []; this.used = new Set(); this.w = w || doc.pageW; this.h = h || doc.pageH; }
    text(x, y, str, o = {}) {
      str = String(str);
      if (!str) return;
      const f = this.doc.fonts[o.bold ? 'bold' : 'regular'];
      const size = o.size || 9;
      if (o.align === 'right') x -= f.width(str, size);
      else if (o.align === 'center') x -= f.width(str, size) / 2;
      this.ops.push(`BT /${f.key} ${num(size)} Tf ${rgb(o.color)} rg 1 0 0 1 ${num(x)} ${num(this.h - y)} Tm <${f.encode(str)}> Tj ET`);
    }
    rect(x, y, w, h, o = {}) {
      if (o.fill) this.ops.push(`${rgb(o.fill)} rg ${num(x)} ${num(this.h - y - h)} ${num(w)} ${num(h)} re f`);
      if (o.stroke) this.ops.push(`${rgb(o.stroke)} RG ${num(o.lw || 0.5)} w ${num(x)} ${num(this.h - y - h)} ${num(w)} ${num(h)} re S`);
    }
    /** obraz JPEG dodany wcześniej przez doc.addImage(); x, y = lewy górny róg */
    image(key, x, y, w, h) {
      const im = this.doc.images[key]; if (!im) return;
      this.used.add(key);
      this.ops.push(`q ${num(w)} 0 0 ${num(h)} ${num(x)} ${num(this.h - y - h)} cm /${im.name} Do Q`);
    }
    line(x1, y1, x2, y2, o = {}) {
      this.ops.push(`${rgb(o.color || '999999')} RG ${num(o.lw || 0.5)} w ${o.dash ? '[2 2] 0 d' : '[] 0 d'} ${num(x1)} ${num(this.h - y1)} m ${num(x2)} ${num(this.h - y2)} l S`);
    }
  }

  class Doc {
    constructor(o = {}) {
      this.pageW = o.pageW || 841.89; this.pageH = o.pageH || 595.28;
      this.fonts = {}; this.pages = []; this.info = o.info || {}; this.images = {};
    }
    /** rejestruje obraz JPEG (bajty pliku, szerokość i wysokość w pikselach) */
    addImage(key, bytes, w, h) {
      if (!this.images[key]) this.images[key] = { name: 'Im' + (Object.keys(this.images).length + 1), bytes, w, h, gray: false };
      return key;
    }
    addFont(slot, bytes, name, bold) {
      this.fonts[slot] = new Font('F' + (Object.keys(this.fonts).length + 1), new TTF(bytes), name, bold);
    }
    addPage(w, h) { const p = new Page(this, w, h); this.pages.push(p); return p; }
    text(str, size, bold) { return this.fonts[bold ? 'bold' : 'regular'].width(str, size); }
    /** zawijanie tekstu do szerokości; zwraca tablicę linii */
    wrap(str, maxW, size, bold) {
      const f = this.fonts[bold ? 'bold' : 'regular'];
      const out = [];
      for (const para of String(str == null ? '' : str).split('\n')) {
        const words = para.split(/\s+/).filter(Boolean);
        let cur = '';
        const flush = () => { if (cur) out.push(cur); cur = ''; };
        if (!words.length) { out.push(''); continue; }
        for (let wd of words) {
          // rozbij zbyt długie słowa
          while (f.width(wd, size) > maxW) {
            let k = wd.length;
            while (k > 1 && f.width(wd.slice(0, k), size) > maxW) k--;
            if (cur) flush();
            out.push(wd.slice(0, k));
            wd = wd.slice(k);
          }
          const trial = cur ? cur + ' ' + wd : wd;
          if (f.width(trial, size) <= maxW) cur = trial;
          else { flush(); cur = wd; }
        }
        flush();
      }
      return out.length ? out : [''];
    }

    async build() {
      const chunks = [];
      let pos = 0;
      const offsets = [];
      const push = (u8) => { chunks.push(u8); pos += u8.length; };
      const str = (s) => push(enc.encode(s));
      const fontSlots = Object.keys(this.fonts);
      // numeracja obiektów
      let next = 3;
      const pageObjs = this.pages.map(() => ({ page: next++, content: next++ }));
      const fontObjs = {};
      for (const slot of fontSlots) { fontObjs[slot] = { type0: next++, cid: next++, desc: next++, file: next++, uni: next++ }; }
      const imgKeys = Object.keys(this.images).filter((k) => this.pages.some((pg) => pg.used.has(k)));
      const imgObjs = {};
      for (const k of imgKeys) imgObjs[k] = next++;
      const infoObj = next++;
      const total = next;

      const objDict = (n, dict) => { offsets[n] = pos; str(`${n} 0 obj\n${dict}\nendobj\n`); };
      const objStream = async (n, dict, bytes, compress) => {
        let data = bytes, filt = '';
        if (compress) { const z = await Zip.zlibDeflate(bytes); if (z && z.length < bytes.length) { data = z; filt = '/Filter /FlateDecode '; } }
        offsets[n] = pos;
        str(`${n} 0 obj\n<< ${dict}${filt}/Length ${data.length} >>\nstream\n`);
        push(data);
        str('\nendstream\nendobj\n');
      };

      str('%PDF-1.5\n%\xE2\xE3\xCF\xD3\n');
      objDict(1, '<< /Type /Catalog /Pages 2 0 R >>');
      objDict(2, `<< /Type /Pages /Kids [${pageObjs.map((p) => p.page + ' 0 R').join(' ')}] /Count ${this.pages.length} >>`);
      const fontRes = fontSlots.map((s) => `/${this.fonts[s].key} ${fontObjs[s].type0} 0 R`).join(' ');
      for (let i = 0; i < this.pages.length; i++) {
        const po = pageObjs[i];
        const xo = [...this.pages[i].used].filter((k) => imgObjs[k]).map((k) => `/${this.images[k].name} ${imgObjs[k]} 0 R`).join(' ');
        objDict(po.page, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${num(this.pages[i].w)} ${num(this.pages[i].h)}] /Resources << /Font << ${fontRes} >>${xo ? ` /XObject << ${xo} >>` : ''} >> /Contents ${po.content} 0 R >>`);
        await objStream(po.content, '', enc.encode(this.pages[i].ops.join('\n')), true);
      }
      for (const slot of fontSlots) {
        const f = this.fonts[slot], o = fontObjs[slot], t = f.ttf;
        const sc = 1000 / t.upm;
        const base = 'KLAPSA+' + f.name.replace(/\s/g, '');
        objDict(o.type0, `<< /Type /Font /Subtype /Type0 /BaseFont /${base} /Encoding /Identity-H /DescendantFonts [${o.cid} 0 R] /ToUnicode ${o.uni} 0 R >>`);
        const gids = [...f.used.keys()].sort((a, b) => a - b);
        const W = gids.map((g) => `${g} [${Math.round(t.adv(g) * sc)}]`).join(' ');
        objDict(o.cid, `<< /Type /Font /Subtype /CIDFontType2 /BaseFont /${base} /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${o.desc} 0 R /DW 1000 /W [${W}] /CIDToGIDMap /Identity >>`);
        objDict(o.desc, `<< /Type /FontDescriptor /FontName /${base} /Flags 32 /FontBBox [${t.bbox.map((v) => Math.round(v * sc)).join(' ')}] /ItalicAngle 0 /Ascent ${Math.round(t.ascent * sc)} /Descent ${Math.round(t.descent * sc)} /CapHeight ${Math.round(t.capHeight * sc)} /StemV ${f.bold ? 140 : 80} /FontFile2 ${o.file} 0 R >>`);
        await objStream(o.file, `/Length1 ${t.bytes.length} `, t.bytes, true);
        // ToUnicode
        const pairs = gids.map((g) => [g, f.used.get(g)]);
        let cm = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
        for (let i = 0; i < pairs.length; i += 100) {
          const part = pairs.slice(i, i + 100);
          cm += `${part.length} beginbfchar\n` + part.map(([g, cp]) => `<${g.toString(16).padStart(4, '0')}> <${cp.toString(16).padStart(4, '0')}>`).join('\n') + '\nendbfchar\n';
        }
        cm += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
        await objStream(o.uni, '', enc.encode(cm), false);
      }
      for (const k of imgKeys) {
        const im = this.images[k];
        await objStream(imgObjs[k], `/Type /XObject /Subtype /Image /Width ${im.w} /Height ${im.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode `, im.bytes, false);
      }
      const hex16 = (s) => 'FEFF' + Array.from(String(s)).map((ch) => ch.charCodeAt(0).toString(16).padStart(4, '0')).join('');
      const d = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      objDict(infoObj, `<< /Title <${hex16(this.info.title || '')}> /Author <${hex16(this.info.author || '')}> /Producer (Klaps) /CreationDate (D:${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}) >>`);
      const xrefPos = pos;
      let xr = `xref\n0 ${total}\n0000000000 65535 f \n`;
      for (let n = 1; n < total; n++) xr += String(offsets[n]).padStart(10, '0') + ' 00000 n \n';
      xr += `trailer\n<< /Size ${total} /Root 1 0 R /Info ${infoObj} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;
      str(xr);
      const out = new Uint8Array(pos);
      let p = 0;
      for (const c of chunks) { out.set(c, p); p += c.length; }
      return out;
    }
  }
  return { Doc, TTF };
})();
export { Pdf };
