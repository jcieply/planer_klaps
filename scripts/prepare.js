/* Buduje katalog app/: aplikacja webowa + pdf.js + czcionki (wszystko lokalnie, działa offline). */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const out = path.join(root, 'app');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'pdfjs'), { recursive: true });

execFileSync(process.execPath, ['build.js'], { cwd: path.join(root, 'web'), env: Object.assign({}, process.env, { DESKTOP_OUT: out }), stdio: 'inherit' });

const nm = (p) => path.join(root, 'node_modules', p);
// pdf.js
for (const f of ['pdf.min.js', 'pdf.worker.min.js']) fs.copyFileSync(nm('pdfjs-dist/build/' + f), path.join(out, 'vendor', 'pdfjs', f));
// czcionki (tylko łacińskie rozszerzone + podstawowe – polskie znaki są w latin-ext)
const want = [
  ['barlow-condensed', [500, 600, 700]],
  ['courier-prime', [400]],
  ['ibm-plex-sans', [400, 500, 600]]
];
const RANGE = { latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' };
const names = { 'barlow-condensed': 'Barlow Condensed', 'courier-prime': 'Courier Prime', 'ibm-plex-sans': 'IBM Plex Sans' };
let css = '';
for (const [pkg, weights] of want) {
  for (const w of weights) for (const sub of ['latin', 'latin-ext']) {
    const fn = `${pkg}-${sub}-${w}-normal.woff2`;
    const src = nm(`@fontsource/${pkg}/files/${fn}`);
    if (!fs.existsSync(src)) { console.warn('brak czcionki', fn); continue; }
    fs.copyFileSync(src, path.join(out, 'fonts', fn));
    css += `@font-face{font-family:'${names[pkg]}';font-style:normal;font-weight:${w};font-display:swap;src:url(${fn}) format('woff2');unicode-range:${RANGE[sub]};}\n`;
  }
}
fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'), css);
console.log('app/ gotowe:', fs.readdirSync(out).join(', '));
