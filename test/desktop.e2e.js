/* Test warstwy desktopowej w Chromium: prawdziwy electron/store.js podłączony jako window.klapsDesktop. */
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const store = require('../electron/store');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-e2e-'));
const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-out-'));
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--no-sandbox', '--allow-file-access-from-files'] });
  const ctx = await b.newContext({ viewport: { width: 1360, height: 860 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(String(e)));
  await ctx.exposeFunction('__list', () => store.list(dir));
  await ctx.exposeFunction('__save', (id, m, p, s, md) => store.save(dir, id, m, p, s, md));
  await ctx.exposeFunction('__load', (id) => store.load(dir, id));
  await ctx.exposeFunction('__remove', (id) => store.remove(dir, id));
  await ctx.exposeFunction('__file', (name, arr) => { fs.writeFileSync(path.join(outDir, name), Buffer.from(arr)); return { canceled: false }; });
  await ctx.addInitScript(() => {
    window.klapsDesktop = { pdfjsBase: 'x/', store: { list: () => window.__list(), save: (...a) => window.__save(...a), load: (i) => window.__load(i), remove: (i) => window.__remove(i) },
      saveFile: (n, d) => window.__file(n, Array.from(d instanceof Uint8Array ? d : new TextEncoder().encode(d))), onMenu: (fn) => { window.__menu = fn; } };
  });
  const url = 'file:///tmp/claude-0/dk/index.html';
  await page.goto(url);
  await page.waitForSelector('.tabs, nav, [data-act="tab"]', { timeout: 15000 });
  await page.waitForTimeout(1500);
  let files = fs.readdirSync(dir).filter((f) => f.endsWith('.klaps.json'));
  assert.strictEqual(files.length, 1, 'projekt demo zapisany jako plik');
  const saved = JSON.parse(fs.readFileSync(path.join(dir, files[0]), 'utf8'));
  assert.ok(saved.meta.title && saved.plan.length > 1000);
  // przeładowanie: projekt wraca z plików
  await page.reload(); await page.waitForSelector('[data-act="tab"]'); await page.waitForTimeout(800);
  assert.ok((await page.textContent('body')).includes('Ostatni pociąg do Zalesia'), 'projekt wczytany z pliku');
  assert.strictEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.klaps.json')).length, 1, 'bez duplikatu po przeładowaniu');
  // mapka (część media) zapisana w pliku i odczytana po przeładowaniu
  await page.evaluate(() => { const d = S.days.find((x) => x.kind === 'shoot'); Core.addMap(S, d.id, { data: 'QUJD'.repeat(400), w: 10, h: 10, caption: 'Baza' }); commit(); });
  await page.waitForTimeout(1500);
  const f0 = fs.readdirSync(dir).find((f) => f.endsWith('.klaps.json'));
  assert.ok(JSON.parse(JSON.parse(fs.readFileSync(path.join(dir, f0), 'utf8')).media).constructor === Object, 'media w pliku');
  await page.reload(); await page.waitForSelector('[data-act="tab"]'); await page.waitForTimeout(800);
  assert.ok(await page.evaluate(() => Object.keys(S.media).length === 1 && Object.values(S.sheets).some((sh) => (sh.maps || []).length === 1)), 'mapka wraca po ponownym otwarciu');
  // menu: nowy projekt
  await page.evaluate(() => window.__menu('new-project')); await page.waitForTimeout(1200);
  assert.strictEqual(fs.readdirSync(dir).filter((f) => f.endsWith('.klaps.json')).length, 2, 'nowy projekt = nowy plik');
  // menu: eksport JSON przez dialog zapisu
  await page.evaluate(() => window.__menu('export-json')); await page.waitForTimeout(800);
  const js = fs.readdirSync(outDir).filter((f) => f.endsWith('.json'));
  assert.strictEqual(js.length, 1); JSON.parse(fs.readFileSync(path.join(outDir, js[0]), 'utf8'));
  // eksport PDF/XLSX z zakładki Eksport
  await page.click('[data-act="tab"][data-id="export"], [data-tab="export"]').catch(async () => { await page.getByText('Eksport', { exact: true }).first().click(); });
  await page.waitForTimeout(500);
  const btns = await page.$$eval('button[data-act]', (e) => e.map((x) => x.dataset.act).filter((a) => /export|pdf|xlsx/i.test(a)));
  console.log('akcje eksportu:', btns.join(','));
  for (const act of btns.filter((a) => /^export-(pdf|xlsx)/.test(a)).slice(0, 2)) { await page.click(`button[data-act="${act}"]`); await page.waitForTimeout(4000); }
  const outs = fs.readdirSync(outDir); console.log('pliki:', outs.join(', '));
  const pdf = outs.find((f) => f.endsWith('.pdf')); if (pdf) assert.ok(fs.readFileSync(path.join(outDir, pdf)).slice(0, 4).toString() === '%PDF');
  const xl = outs.find((f) => f.endsWith('.xlsx')); if (xl) assert.ok(fs.readFileSync(path.join(outDir, xl)).slice(0, 2).toString() === 'PK');
  assert.deepStrictEqual(errs, [], 'błędy JS: ' + errs.join('|'));
  console.log('desktop e2e: OK'); await b.close();
})().catch((e) => { console.error('BŁĄD', e.message); process.exit(1); });
