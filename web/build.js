const fs = require('fs');
const order = ['fonts.js','zip.js','xlsx.js','pdfdoc.js','parser.js','sample.js','core.js','reports.js','store.js','app1.js','app2.js','app2b.js','app3.js','boot.js'];
let js = order.map((f) => `/* ---- ${f} ---- */\n` + fs.readFileSync('src/' + f, 'utf8')).join('\n');
js = js.replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/style.css', 'utf8');
const head = `<title>Klaps Planer</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Courier+Prime&family=IBM+Plex+Sans:wght@400;500;600&display=swap" rel="stylesheet">
<style>\n${css}\n</style>
<div id="app"></div>
<script>\n${js}\n</script>
`;
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/artifact.html', head);
const hi = head.indexOf('<div id="app">');
fs.writeFileSync('dist/test.html', `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${head.slice(0, hi)}</head><body>${head.slice(hi)}</body></html>`);
fs.writeFileSync('dist/bundle.js', js);
console.log('artifact', head.length, 'bytes');

if (process.env.DESKTOP_OUT) {
  const dk = `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; worker-src 'self' blob:; connect-src 'self' data: blob:">
<title>Klaps Planer</title>
<link rel="stylesheet" href="fonts/fonts.css">
<style>\n${css}\n</style></head><body><div id="app"></div>
<script>\n${js}\n</script></body></html>`;
  fs.mkdirSync(process.env.DESKTOP_OUT, { recursive: true });
  fs.writeFileSync(process.env.DESKTOP_OUT + '/index.html', dk);
  console.log('desktop', dk.length, 'bytes');
}
