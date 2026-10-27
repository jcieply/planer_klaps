// @ts-nocheck
/* Moduł przeniesiony z wersji 1.x (logika bez zmian). */
import { Zip } from './zip';
/* ===== XLSX: minimalny generator skoroszytów (style, scalanie, formuły, zamrażanie, druk) ===== */
const Xlsx = (() => {
  const esc = (s) => String(s).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  function colName(c) {
    let s = '';
    while (c > 0) { const m = (c - 1) % 26; s = String.fromCharCode(65 + m) + s; c = Math.floor((c - 1) / 26); }
    return s;
  }
  const ref = (r, c) => colName(c) + r;
  const argb = (hex) => 'FF' + String(hex).replace('#', '').toUpperCase();

  function dateSerial(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return Math.round((Date.UTC(y, m - 1, d) - Date.UTC(1899, 11, 30)) / 86400000);
  }

  class Styles {
    constructor() {
      this.fonts = ['<font><sz val="10"/><color rgb="FF1A1A1A"/><name val="Calibri"/><family val="2"/></font>'];
      this.fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
      this.borders = ['<border><left/><right/><top/><bottom/><diagonal/></border>'];
      this.numFmts = [];
      this.xfs = ['<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'];
      this.cache = new Map();
      this.fontIdx = new Map(); this.fillIdx = new Map(); this.borderIdx = new Map(); this.fmtIdx = new Map();
    }
    _font(s) {
      const x = `<font>${s.b ? '<b/>' : ''}${s.i ? '<i/>' : ''}<sz val="${s.sz || 10}"/><color rgb="${argb(s.color || '1A1A1A')}"/><name val="${s.font || 'Calibri'}"/><family val="2"/></font>`;
      if (!this.fontIdx.has(x)) { this.fontIdx.set(x, this.fonts.length); this.fonts.push(x); }
      return this.fontIdx.get(x);
    }
    _fill(bg) {
      if (!bg) return 0;
      const x = `<fill><patternFill patternType="solid"><fgColor rgb="${argb(bg)}"/><bgColor indexed="64"/></patternFill></fill>`;
      if (!this.fillIdx.has(x)) { this.fillIdx.set(x, this.fills.length); this.fills.push(x); }
      return this.fillIdx.get(x);
    }
    _border(b) {
      if (!b) return 0;
      // b: {all:'thin', color:'BBBBBB'} lub {top:'medium', bottom:'thin', ...}
      const col = argb(b.color || 'B8BEC4');
      const side = (name) => {
        const st = b[name] || b.all;
        return st ? `<${name} style="${st}"><color rgb="${col}"/></${name}>` : `<${name}/>`;
      };
      const x = `<border>${side('left')}${side('right')}${side('top')}${side('bottom')}<diagonal/></border>`;
      if (!this.borderIdx.has(x)) { this.borderIdx.set(x, this.borders.length); this.borders.push(x); }
      return this.borderIdx.get(x);
    }
    _fmt(f) {
      if (!f) return 0;
      const builtin = { '0': 1, '0.00': 2, '#,##0': 3, '0%': 9 };
      if (builtin[f]) return builtin[f];
      if (!this.fmtIdx.has(f)) { this.fmtIdx.set(f, 164 + this.numFmts.length); this.numFmts.push(f); }
      return this.fmtIdx.get(f);
    }
    get(s) {
      if (!s) return 0;
      const key = JSON.stringify(s);
      if (this.cache.has(key)) return this.cache.get(key);
      const fontId = this._font(s), fillId = this._fill(s.bg), borderId = this._border(s.border), fmtId = this._fmt(s.fmt);
      const al = (s.h || s.v || s.wrap || s.indent)
        ? `<alignment${s.h ? ` horizontal="${s.h}"` : ''} vertical="${s.v || 'center'}"${s.wrap ? ' wrapText="1"' : ''}${s.indent ? ` indent="${s.indent}"` : ''}/>` : '';
      const xf = `<xf numFmtId="${fmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1"${al ? ' applyAlignment="1">' + al + '</xf>' : '/>'}`;
      const idx = this.xfs.length;
      this.xfs.push(xf);
      this.cache.set(key, idx);
      return idx;
    }
    xml() {
      return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
        (this.numFmts.length ? `<numFmts count="${this.numFmts.length}">${this.numFmts.map((f, i) => `<numFmt numFmtId="${164 + i}" formatCode="${esc(f)}"/>`).join('')}</numFmts>` : '') +
        `<fonts count="${this.fonts.length}">${this.fonts.join('')}</fonts>` +
        `<fills count="${this.fills.length}">${this.fills.join('')}</fills>` +
        `<borders count="${this.borders.length}">${this.borders.join('')}</borders>` +
        `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
        `<cellXfs count="${this.xfs.length}">${this.xfs.join('')}</cellXfs>` +
        `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    }
  }

  class Sheet {
    constructor(name, opts = {}) {
      this.name = String(name).replace(/[\[\]:*?\/\\]/g, ' ').slice(0, 31);
      this.opts = opts;
      this.rows = new Map();
      this.merges = [];
      this.cols = {};
      this.heights = {};
      this.maxR = 0; this.maxC = 0;
    }
    set(r, c, v, style) {
      let row = this.rows.get(r);
      if (!row) { row = new Map(); this.rows.set(r, row); }
      row.set(c, { v, style });
      if (r > this.maxR) this.maxR = r;
      if (c > this.maxC) this.maxC = c;
    }
    style(r, c, style) { this.set(r, c, null, style); }
    merge(r1, c1, r2, c2) { this.merges.push(`${ref(r1, c1)}:${ref(r2, c2)}`); }
    colWidth(c, w) { this.cols[c] = w; }
    rowHeight(r, h) { this.heights[r] = h; }
  }

  class Workbook {
    constructor(meta = {}) { this.sheets = []; this.styles = new Styles(); this.sst = []; this.sstIdx = new Map(); this.meta = meta; }
    addSheet(name, opts) { const s = new Sheet(name, opts); this.sheets.push(s); return s; }
    _str(s) {
      s = String(s);
      if (!this.sstIdx.has(s)) { this.sstIdx.set(s, this.sst.length); this.sst.push(s); }
      return this.sstIdx.get(s);
    }
    _sheetXml(sh) {
      const o = sh.opts;
      let x = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`;
      x += `<sheetPr>${o.tab ? `<tabColor rgb="${argb(o.tab)}"/>` : ''}<pageSetUpPr fitToPage="1"/></sheetPr>`;
      x += `<dimension ref="A1:${ref(Math.max(sh.maxR, 1), Math.max(sh.maxC, 1))}"/>`;
      let pane = '';
      if (o.freeze) {
        const fr = o.freeze.row || 0, fc = o.freeze.col || 0;
        const tl = ref(fr + 1, fc + 1);
        const active = fr && fc ? 'bottomRight' : fr ? 'bottomLeft' : 'topRight';
        pane = `<pane${fc ? ` xSplit="${fc}"` : ''}${fr ? ` ySplit="${fr}"` : ''} topLeftCell="${tl}" activePane="${active}" state="frozen"/>`;
      }
      x += `<sheetViews><sheetView workbookViewId="0" showGridLines="${o.grid ? 1 : 0}"${o.zoom ? ` zoomScale="${o.zoom}"` : ''}>${pane}</sheetView></sheetViews>`;
      x += `<sheetFormatPr defaultRowHeight="15"/>`;
      const colKeys = Object.keys(sh.cols).map(Number).sort((a, b) => a - b);
      if (colKeys.length) x += '<cols>' + colKeys.map((c) => `<col min="${c}" max="${c}" width="${sh.cols[c]}" customWidth="1"/>`).join('') + '</cols>';
      x += '<sheetData>';
      const rowNums = [...new Set([...sh.rows.keys(), ...Object.keys(sh.heights).map(Number)])].sort((a, b) => a - b);
      for (const r of rowNums) {
        const row = sh.rows.get(r);
        const ht = sh.heights[r];
        x += `<row r="${r}"${ht ? ` ht="${ht}" customHeight="1"` : ''}>`;
        if (row) {
          const cs = [...row.keys()].sort((a, b) => a - b);
          for (const c of cs) {
            const { v, style } = row.get(c);
            const s = this.styles.get(style);
            const a = ref(r, c);
            const sAttr = s ? ` s="${s}"` : '';
            if (v === null || v === undefined || v === '') x += `<c r="${a}"${sAttr}/>`;
            else if (typeof v === 'number') x += `<c r="${a}"${sAttr}><v>${v}</v></c>`;
            else if (typeof v === 'boolean') x += `<c r="${a}"${sAttr} t="b"><v>${v ? 1 : 0}</v></c>`;
            else if (typeof v === 'object' && v.date) x += `<c r="${a}"${sAttr}><v>${dateSerial(v.date)}</v></c>`;
            else if (typeof v === 'object' && v.f) {
              if (typeof v.v === 'string') x += `<c r="${a}"${sAttr} t="str"><f>${esc(v.f)}</f><v>${esc(v.v)}</v></c>`;
              else x += `<c r="${a}"${sAttr}><f>${esc(v.f)}</f>${v.v !== undefined ? `<v>${v.v}</v>` : ''}</c>`;
            } else x += `<c r="${a}"${sAttr} t="s"><v>${this._str(v)}</v></c>`;
          }
        }
        x += '</row>';
      }
      x += '</sheetData>';
      if (o.filter) x += `<autoFilter ref="${o.filter}"/>`;
      if (sh.merges.length) x += `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join('')}</mergeCells>`;
      x += `<printOptions horizontalCentered="1"/><pageMargins left="0.4" right="0.4" top="0.55" bottom="0.6" header="0.3" footer="0.3"/>`;
      x += `<pageSetup paperSize="9" orientation="${o.portrait ? 'portrait' : 'landscape'}" fitToWidth="1" fitToHeight="0"/>`;
      x += `<headerFooter><oddFooter>${esc('&L' + (this.meta.footer || '') + '&CStrona &P z &N&R&A')}</oddFooter></headerFooter>`;
      x += '</worksheet>';
      return x;
    }
    async build() {
      const sheetXmls = this.sheets.map((s) => this._sheetXml(s));
      const files = [];
      files.push({ name: '[Content_Types].xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${this.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>` });
      files.push({ name: '_rels/.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>` });
      const now = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
      files.push({ name: 'docProps/core.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${esc(this.meta.title || '')}</dc:title><dc:creator>${esc(this.meta.creator || 'Klaps')}</dc:creator><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created></cp:coreProperties>` });
      files.push({ name: 'docProps/app.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Klaps</Application></Properties>` });
      const defNames = [];
      this.sheets.forEach((s, i) => { if (s.opts.printTitles) defNames.push(`<definedName name="_xlnm.Print_Titles" localSheetId="${i}">'${s.name.replace(/'/g, "''")}'!${s.opts.printTitles}</definedName>`); });
      files.push({ name: 'xl/workbook.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><workbookPr/><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="28800" windowHeight="16000"/></bookViews><sheets>${this.sheets.map((s, i) => `<sheet name="${esc(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets>${defNames.length ? '<definedNames>' + defNames.join('') + '</definedNames>' : ''}<calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>` });
      files.push({ name: 'xl/_rels/workbook.xml.rels', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${this.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${this.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${this.sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>` });
      sheetXmls.forEach((x, i) => files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: x }));
      files.push({ name: 'xl/styles.xml', data: this.styles.xml() });
      files.push({ name: 'xl/sharedStrings.xml', data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${this.sst.length}" uniqueCount="${this.sst.length}">${this.sst.map((s) => `<si><t xml:space="preserve">${esc(s)}</t></si>`).join('')}</sst>` });
      return await Zip.write(files);
    }
  }

  return { Workbook, colName, ref, esc };
})();
export { Xlsx };
