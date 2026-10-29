/* Test prawdziwej aplikacji w Electronie (Linux: xvfb-run -a npm run e2e): okno startowe → profil → projekt → przejście → zapis → ponowne uruchomienie. */
const { _electron: electron } = require('playwright-core');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');

const data = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-data-'));
const projects = fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-proj-'));
const shots = process.env.KLAPS_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-shots-'));
fs.mkdirSync(shots, { recursive: true });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, what, ms = 15000) => { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (e) { /* jeszcze nie */ } if (Date.now() - t > ms) throw new Error('Timeout: ' + what); await sleep(120); } };
const projectFiles = () => fs.readdirSync(projects).filter((f) => f.endsWith('.klaps.json'));
const titleOf = (f) => JSON.parse(fs.readFileSync(path.join(projects, f), 'utf8')).meta.title;

function watch(page, tag) {
  page.on('pageerror', (e) => errors.push(`${tag}: ${e}`));
  page.on('console', (m) => { if (m.type() === 'error' || /Content Security Policy/i.test(m.text())) errors.push(`${tag} console: ${m.text()}`); });
}
async function start() {
  const app = await electron.launch({ args: ['--no-sandbox', path.join(__dirname, '..')], env: Object.assign({}, process.env, { KLAPS_DATA_DIR: data, KLAPS_PROJECTS_DIR: projects, KLAPS_FORCE_LAUNCHER: '1' }) });
  app.on('window', (p) => watch(p, 'okno'));
  return app;
}
const pageBy = async (app, re) => until(() => app.windows().find((w) => re.test(w.url())), 'okno ' + re);
const shot = (p, n) => p.screenshot({ path: path.join(shots, n + '.png') });
async function closeApp(app) {
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.close())).catch(() => {});
  await Promise.race([app.waitForEvent('close'), sleep(8000)]);
  await app.close().catch(() => {});
}

(async () => {
  /* ===== 1. pierwsze uruchomienie: formularz profilu ===== */
  let app = await start();
  let lc = await pageBy(app, /launcher\.html/);
  watch(lc, 'launcher');
  await lc.waitForSelector('#lc-name', { timeout: 20000 });
  const size = await lc.evaluate(() => [innerWidth, innerHeight]);
  assert.deepStrictEqual(size, [880, 540], 'małe okno startowe 880×540, jest ' + size);
  assert.strictEqual(app.windows().length, 1, 'na starcie tylko okno startowe');
  assert.strictEqual(await lc.evaluate(() => window.klapsDesktop.windowKind), 'launcher');
  await sleep(1200); await shot(lc, '1-welcome');
  await lc.click('[data-act="welcome-go"]');
  await lc.waitForSelector('#lc-err');
  await lc.fill('#lc-name', 'Jan Kowalski'); await lc.fill('#lc-role', 'Reżyser');
  await lc.click('[data-act="welcome-go"]');
  await lc.waitForSelector('.lc-hello h1');
  assert.strictEqual((await lc.textContent('.lc-hello h1')).trim(), 'Cześć, Jan Kowalski');
  const prof = JSON.parse(fs.readFileSync(path.join(data, 'profile.json'), 'utf8'));
  assert.strictEqual(prof.name, 'Jan Kowalski'); assert.strictEqual(prof.role, 'Reżyser'); assert.strictEqual(prof.account.provider, 'local');
  await lc.waitForSelector('[data-act="launcher-new-empty"]'); await sleep(500); await shot(lc, '2-home-empty');

  /* ===== 2. nowy projekt → płynne przejście do programu ===== */
  await lc.click('[data-act="launcher-new-empty"]');
  await lc.fill('#lc-title', 'Mój film'); await sleep(300); await shot(lc, '3-new');
  await lc.click('[data-act="launcher-create"]');
  let mp = await pageBy(app, /index\.html/);
  await mp.waitForSelector('.shell', { timeout: 30000 });
  await until(() => app.windows().length === 1, 'okno startowe znika po przejściu');
  assert.strictEqual(await mp.evaluate(() => window.klapsDesktop.windowKind), 'main');
  await until(() => projectFiles().length === 1, 'plik projektu');
  assert.strictEqual(titleOf(projectFiles()[0]), 'Mój film');
  const sess = await mp.evaluate(() => window.klapsDesktop.session());
  assert.strictEqual(sess.account.name, 'Jan Kowalski'); assert.strictEqual(sess.mode, 'local');
  // menu boczne: zalogowany użytkownik zamiast przełącznika projektów (projekt zmienia się tylko w oknie startowym)
  await mp.waitForSelector('.who');
  assert.ok((await mp.textContent('.who')).includes('Jan Kowalski'), 'w menu bocznym widać zalogowanego użytkownika');
  assert.strictEqual(await mp.locator('#proj-sel, select[data-act-change="proj-switch"]').count(), 0, 'brak przełącznika projektów w programie');
  // okna Ustawienia i Historia otwierają się i zamykają bez błędów
  await mp.click('[data-act="history-open"]'); await mp.waitForSelector('.hist'); await mp.keyboard.press('Escape'); await mp.waitForSelector('.hist', { state: 'detached' });
  await mp.click('[data-act="settings-open"]'); await mp.waitForSelector('input[data-bind="meta.title"]'); await mp.keyboard.press('Escape'); await mp.waitForSelector('.modal', { state: 'detached' });
  // wątek roboczy (blob) działa pod CSP programu, a zakładki ładowane przy pierwszym otwarciu wczytują się z klaps://
  assert.strictEqual(await mp.evaluate(() => new Promise((res) => {
    try { const w = new Worker(URL.createObjectURL(new Blob(['postMessage(7)'], { type: 'text/javascript' }))); w.onmessage = (e) => res(e.data); w.onerror = () => res('error'); setTimeout(() => res('timeout'), 5000); }
    catch (e) { res('throw ' + e.message); }
  })), 7, 'wątek roboczy działa w oknie programu');
  for (const t of ['board', 'schedule', 'callsheet', 'shotlist', 'budget', 'export', 'home']) {
    await mp.click(`.side .nav-i[data-tab="${t}"]`);
    await mp.waitForSelector(`.side .nav-i[data-tab="${t}"][aria-current="page"]`);
    await mp.waitForSelector('.view-loading', { state: 'detached', timeout: 10000 });
  }
  await sleep(600); await shot(mp, '4-main');

  /* ===== 3. zmiana w projekcie i natychmiastowe zamknięcie okna (zapis nie może zginąć) ===== */
  await mp.click('[data-act="settings-open"]');
  const inp = await mp.waitForSelector('input[data-bind="meta.title"]');
  await inp.fill('Zmieniony film');
  await sleep(150);
  await closeApp(app);
  await until(() => projectFiles().length === 1 && titleOf(projectFiles()[0]) === 'Zmieniony film', 'zapis przy zamknięciu okna', 8000);
  assert.ok(!fs.readdirSync(projects).some((f) => f.endsWith('.tmp')), 'bez plików tymczasowych');

  /* ===== 4. ponowne uruchomienie: powitanie z imieniem i lista projektów ===== */
  app = await start();
  lc = await pageBy(app, /launcher\.html/); watch(lc, 'launcher');
  await lc.waitForSelector('.lc-proj', { timeout: 20000 });
  assert.strictEqual((await lc.textContent('.lc-hello h1')).trim(), 'Cześć, Jan Kowalski');
  assert.ok((await lc.textContent('.lc-proj')).includes('Zmieniony film'));
  await sleep(600); await shot(lc, '5-home-list');
  // wyszukiwarka
  await lc.fill('.lc-search input', 'xyz'); await lc.waitForSelector('.lc-empty'); await lc.fill('.lc-search input', 'zmien');
  await lc.waitForSelector('.lc-proj');
  await lc.click('.lc-proj');
  mp = await pageBy(app, /index\.html/);
  await mp.waitForSelector('.shell', { timeout: 30000 });
  await until(() => app.windows().length === 1, 'okno startowe znika');
  assert.strictEqual(projectFiles().length, 1, 'otwarcie nie tworzy duplikatu');
  assert.ok((await mp.textContent('body')).includes('Zmieniony film'), 'wczytano wybrany projekt');

  /* ===== 5. powrót do okna startowego i projekt przykładowy ===== */
  await mp.evaluate(() => window.klapsDesktop.launcher.show());
  lc = await until(() => app.windows().find((w) => /launcher\.html/.test(w.url())), 'okno startowe wróciło'); watch(lc, 'launcher2');
  await until(() => !app.windows().some((w) => /index\.html/.test(w.url())), 'okno programu zamknięte');
  await lc.waitForSelector('[data-act="launcher-new"]');
  await lc.click('[data-act="launcher-new"]');
  await lc.click('[data-act="tpl-demo"]');
  await lc.fill('#lc-title', '');
  await lc.click('[data-act="launcher-create"]');
  mp = await pageBy(app, /index\.html/);
  await mp.waitForSelector('.shell', { timeout: 30000 });
  await until(() => projectFiles().length === 2, 'drugi projekt');
  assert.ok(projectFiles().map(titleOf).includes('Ostatni pociąg do Zalesia'), 'projekt przykładowy z własnym tytułem scenariusza');
  await sleep(800); await shot(mp, '6-demo');

  await closeApp(app);
  assert.deepStrictEqual(errors, [], 'błędy w oknach:\n' + errors.join('\n'));
  console.log('electron e2e: OK');
})().catch((e) => { console.error('BŁĄD', e.stack || e.message); console.error(errors.join('\n')); process.exit(1); });
