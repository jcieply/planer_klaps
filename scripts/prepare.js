/* Buduje katalog app/: aplikacja webowa + pdf.js + czcionki (wszystko lokalnie, działa offline). */
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const root = path.join(__dirname, '..');
const IOS = process.argv.includes('ios');
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

// ---- iOS (Capacitor): rdzeń Capacitora + most natywny przed kodem aplikacji ----
if (IOS) {
  const cands = ['@capacitor/core/dist/capacitor.js', '@capacitor/core/dist/capacitor.min.js'];
  const core = cands.map((c) => nm(c)).find((f) => fs.existsSync(f));
  if (!core) { console.error('Nie znaleziono @capacitor/core/dist/capacitor.js – uruchom npm install'); process.exit(1); }
  fs.copyFileSync(core, path.join(out, 'vendor', 'capacitor.js'));
  fs.copyFileSync(path.join(root, 'mobile', 'native.js'), path.join(out, 'native.js'));
  const ip = path.join(out, 'index.html');
  let html = fs.readFileSync(ip, 'utf8');
  html = html.replace('content="width=device-width,initial-scale=1"', 'content="width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover"');
  const at = html.indexOf('<script>');
  html = html.slice(0, at) + '<script src="vendor/capacitor.js"></script><script src="native.js"></script>\n' + html.slice(at);
  fs.writeFileSync(ip, html);
  console.log('app/ przygotowane dla iOS');
}
