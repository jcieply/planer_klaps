/* Test mostu iOS (mobile/native.js) z atrapą Capacitora: zapis projektów w plikach, mapki, eksport przez „Udostępnij”. */
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), path = require('path'), assert = require('assert'), http = require('http');
const DK = '/tmp/claude-0/dk-ios';
fs.rmSync(DK, { recursive: true, force: true }); fs.mkdirSync(DK, { recursive: true });
require('child_process').execFileSync(process.execPath, ['build.js'], { cwd: path.join(__dirname, '..', 'web'), env: Object.assign({}, process.env, { DESKTOP_OUT: DK }) });
let html = fs.readFileSync(DK + '/index.html', 'utf8');
const at = html.indexOf('<script>');
html = html.slice(0, at) + '<script src="mockcap.js"></script><script src="native.js"></script>\n' + html.slice(at);
fs.writeFileSync(DK + '/index.html', html);
fs.copyFileSync(path.join(__dirname, '..', 'mobile', 'native.js'), DK + '/native.js');
fs.writeFileSync(DK + '/mockcap.js', `(() => {
  const K = 'mockfs:'; const db = () => JSON.parse(localStorage.getItem(K) || '{}'); const put = (o) => localStorage.setItem(K, JSON.stringify(o));
  const key = (o) => o.directory + '/' + o.path;
  window.__shared = [];
  const FS = {
    async mkdir() { return {}; },
    async writeFile(o) { const d = db(); d[key(o)] = o.data; put(d); return { uri: 'file:///' + key(o) }; },
    async readFile(o) { const d = db(); if (!(key(o) in d)) throw new Error('File does not exist'); return { data: d[key(o)] }; },
    async readdir(o) { const p = o.directory + '/' + o.path + '/'; return { files: Object.keys(db()).filter((k) => k.startsWith(p)).map((k) => ({ name: k.slice(p.length) })) }; },
    async stat(o) { if (!(key(o) in db())) throw new Error('missing'); return {}; },
    async deleteFile(o) { const d = db(); if (!(key(o) in d)) throw new Error('missing'); delete d[key(o)]; put(d); },
    async rename(o) { const d = db(); const a = o.directory + '/' + o.from, b = o.directory + '/' + o.to; d[b] = d[a]; delete d[a]; put(d); },
    async getUri(o) { return { uri: 'file:///' + key(o) }; },
  };
  const Share = { async share(o) { const d = db(); window.__shared.push({ title: o.title, url: o.url, size: (d[o.url.replace('file:///', '')] || '').length }); return {}; } };
  window.Capacitor = { isNativePlatform: () => true, registerPlugin: (n) => (n === 'Filesystem' ? FS : Share) };
})();`);
const srv = http.createServer((q, s) => { const f = path.join(DK, decodeURIComponent(q.url.split('?')[0]) === '/' ? 'index.html' : decodeURIComponent(q.url.split('?')[0])); if (fs.existsSync(f)) { s.setHeader('content-type', f.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript'); s.end(fs.readFileSync(f)); } else { s.statusCode = 404; s.end(); } });
(async () => {
  await new Promise((r) => srv.listen(8771, r));
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto('http://localhost:8771/');
  await page.waitForSelector('[data-act="tab"]'); await page.waitForTimeout(1200);
  assert.strictEqual(await page.evaluate(() => Store.mode), 'desktop', 'tryb zapisu w plikach');
  assert.ok(await page.evaluate(() => document.documentElement.classList.contains('native-ios')));
  let files = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockfs:'))));
  assert.ok(files.some((f) => /^DOCUMENTS\/Projekty\/.+\.klaps\.json$/.test(f)), 'projekt zapisany jako plik: ' + files.join(','));
  await page.evaluate(() => { const d = S.days.find((x) => x.kind === 'shoot'); Core.addMap(S, d.id, { data: 'QUJD'.repeat(300), w: 10, h: 10, caption: 'Baza' }); S.meta.title = 'Test iOS'; commit(); });
  await page.waitForTimeout(1500);
  files = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockfs:'))));
  assert.ok(files.some((f) => f.endsWith('.bak')), 'kopia poprzedniej wersji (.bak)');
  await page.reload(); await page.waitForSelector('[data-act="tab"]'); await page.waitForTimeout(1000);
  assert.ok(await page.evaluate(() => S.meta.title === 'Test iOS' && Object.keys(S.media).length === 1), 'projekt i mapka wracają po ponownym uruchomieniu');
  await page.click('.tab[data-tab="export"]');
  await page.click('[data-act="export-pdf"]');
  await page.waitForFunction(() => window.__shared.length >= 1, null, { timeout: 15000 });
  await page.click('[data-act="export-json"]');
  await page.waitForFunction(() => window.__shared.length >= 2, null, { timeout: 15000 });
  const sh = await page.evaluate(() => window.__shared);
  assert.ok(/\.pdf$/.test(sh[0].title) && sh[0].size > 10000, 'PDF przekazany do arkusza Udostępnij (' + sh[0].size + ')');
  assert.ok(/\.json$/.test(sh[1].title), 'kopia .json przez Udostępnij');
  assert.ok(await page.evaluate(() => /gotow/.test((UI.toast || {}).msg || '')), 'komunikat po zapisie');
  await page.evaluate(() => deleteProject());
  await page.waitForTimeout(800);
  files = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('mockfs:'))).filter((f) => f.endsWith('.klaps.json')));
  assert.strictEqual(files.length, 1, 'usunięcie projektu usuwa plik (zostaje nowy pusty)');
  await page.screenshot({ path: '/tmp/claude-0/shots/ios_mock.png' });
  assert.deepStrictEqual(errs, []);
  console.log('ios e2e: OK'); await b.close(); srv.close();
})().catch((e) => { console.error('BŁĄD', e.message); process.exit(1); });
