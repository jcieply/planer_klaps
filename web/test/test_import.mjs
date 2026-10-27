import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const P = require('../src/parser.js');
const Z = require('../src/zip.js');
const base = '/opt/npm-tools/node_modules/pdfjs-dist/legacy/build/';
const pdfjs = await import(base + 'pdf.mjs');
pdfjs.GlobalWorkerOptions.workerSrc = base + 'pdf.worker.mjs';

async function pdfPages(file) {
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const pg = await doc.getPage(i);
    const vp = pg.getViewport({ scale: 1 });
    const tc = await pg.getTextContent();
    pages.push({ h: vp.height, items: tc.items.filter(it => 'str' in it).map(it => ({ s: it.str, x: it.transform[4], y: it.transform[5], w: it.width, fs: Math.hypot(it.transform[0], it.transform[1]) || it.height })) });
  }
  return pages;
}
function summary(label, r) {
  const tot = r.scenes.reduce((a, s) => a + s.eighths, 0);
  console.log(`\n== ${label}: ${r.scenes.length} scen, ${P.fmtEighths(tot)} str., tytuł: ${JSON.stringify(r.title)}${r.pageUnits ? ', pageUnits=' + r.pageUnits : ''}`);
  return r.scenes.map(s => `${s.num}|${s.ie}|${s.setName}|${s.tod}|${s.chars.join('+')}`);
}
const txt = P.parseText(fs.readFileSync('test/../src/sample.txt', 'utf8'));
const a = summary('TXT', txt);

const pages = await pdfPages('test/sample.pdf');
const pdf = P.parsePdfPages(pages);
const b = summary('PDF', pdf);
pdf.scenes.forEach(s => console.log(String(s.num).padStart(2), P.fmtEighths(s.eighths).padEnd(5), 'str.', s.page, s.setName.padEnd(36), s.chars.join(',')));

const fdx = P.parseFDX(fs.readFileSync('test/sample.fdx', 'utf8'));
const c = summary('FDX', fdx);

const zip = Z.read(new Uint8Array(fs.readFileSync('test/sample.docx')));
const xml = new TextDecoder().decode(await zip.read('word/document.xml'));
const docx = P.parseParagraphs(P.docxParagraphs(xml));
const d = summary('DOCX', docx);

function diff(name, x) {
  let bad = 0;
  a.forEach((row, i) => { if (row !== x[i]) { bad++; console.log(name, 'różnica', i + 1, '\n  TXT:', row, '\n  ', name + ':', x[i]); } });
  console.log(name, 'zgodnych scen:', a.length - bad, '/', a.length, x.length === a.length ? '' : '(liczba scen różna: ' + x.length + ')');
}
diff('PDF', b); diff('FDX', c); diff('DOCX', d);
