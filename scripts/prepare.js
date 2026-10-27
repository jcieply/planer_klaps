/* Buduje katalog app/ dla Electrona: program i okno startowe (web/ → vite, tryb „desktop”) + pdf.js i czcionki lokalnie (offline). */
const fs = require('fs');
const path = require('path');
const { execFileSync, execSync } = require('child_process');
const root = path.join(__dirname, '..');
const web = path.join(root, 'web');
const out = path.join(root, 'app');
const nm = (p) => path.join(root, 'node_modules', p);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';

if (!fs.existsSync(path.join(web, 'node_modules', 'vite'))) {
  console.log('Instaluję pakiety aplikacji (web/)…');
  execSync(npm + ' install --no-audit --no-fund', { cwd: web, stdio: 'inherit', shell: true });
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'pdfjs'), { recursive: true });

const vite = path.join(web, 'node_modules', 'vite', 'bin', 'vite.js');
execFileSync(process.execPath, [vite, 'build', '--mode', 'desktop'], { cwd: web, env: Object.assign({}, process.env, { DESKTOP_OUT: out }), stdio: 'inherit' });
// vite czyści katalog wyjściowy – odtwarzamy podkatalogi
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
fs.mkdirSync(path.join(out, 'vendor', 'pdfjs'), { recursive: true });

// pdf.js (czytnik scenariuszy PDF)
for (const f of ['pdf.min.js', 'pdf.worker.min.js']) fs.copyFileSync(nm('pdfjs-dist/build/' + f), path.join(out, 'vendor', 'pdfjs', f));
// czcionki: łacińskie i środkowoeuropejskie (polskie znaki są w latin-ext)
const want = [
  ['barlow-condensed', [500, 600, 700]],
  ['courier-prime', [400]],
  ['ibm-plex-sans', [400, 500, 600]],
  ['ibm-plex-mono', [400, 500, 600]],
];
const RANGE = { latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD', 'latin-ext': 'U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF' };
const names = { 'barlow-condensed': 'Barlow Condensed', 'courier-prime': 'Courier Prime', 'ibm-plex-sans': 'IBM Plex Sans', 'ibm-plex-mono': 'IBM Plex Mono' };
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
for (const f of ['index.html', 'launcher.html']) if (!fs.existsSync(path.join(out, f))) { console.error('Brak ' + f + ' w app/'); process.exit(1); }
console.log('app/ gotowe:', fs.readdirSync(out).join(', '));
