/* Chmura w prawdziwej aplikacji (Electron, xvfb): dwie osoby = dwa uruchomienia programu z osobnymi danymi.
   Konto, projekt w chmurze, kod zaproszenia, praca na żywo, role, utrata sieci. Sztuczny Supabase na prawdziwym Postgresie (web/tests/cloud).
   Wymaga aplikacji zbudowanej z VITE_SUPABASE_URL=http://127.0.0.1:54399 (npm run prepare-app) – patrz .github/workflows/ci.yml. */
const { _electron: electron } = require('playwright-core');
const fs = require('fs'), os = require('os'), path = require('path'), assert = require('assert');
const fake = require('../web/tests/cloud/fake-supabase.cjs');

const shots = process.env.KLAPS_SHOTS || fs.mkdtempSync(path.join(os.tmpdir(), 'klaps-shots-'));
fs.mkdirSync(shots, { recursive: true });
const errors = [];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, what, ms = 20000) => { const t = Date.now(); for (;;) { try { const v = await fn(); if (v) return v; } catch (e) { /* jeszcze nie */ } if (Date.now() - t > ms) throw new Error('Timeout: ' + what); await sleep(120); } };
const watch = (page, tag) => {
  page.on('pageerror', (e) => errors.push(`${tag}: ${e}`));
  page.on('console', (m) => { const t = m.text(); if ((m.type() === 'error' && !/ERR_CONNECTION|ERR_EMPTY_RESPONSE|Failed to load resource|WebSocket|fetch/i.test(t)) || /Content Security Policy/i.test(t)) errors.push(`${tag} console: ${t}`); });
};
const log = (m) => console.log('  ' + m);

async function person(tag) {
  const data = fs.mkdtempSync(path.join(os.tmpdir(), `klaps-${tag}-data-`));
  const projects = fs.mkdtempSync(path.join(os.tmpdir(), `klaps-${tag}-proj-`));
  const env = Object.assign({}, process.env, { KLAPS_DATA_DIR: data, KLAPS_PROJECTS_DIR: projects, KLAPS_FORCE_LAUNCHER: '1', KLAPS_E2E_CLOUD: '1' });
  const p = { tag, data, projects, app: null };
  p.start = async () => {
    p.app = await electron.launch({ args: ['--no-sandbox', path.join(__dirname, '..')], env });
    p.app.on('window', (w) => watch(w, tag));
    return p;
  };
  p.page = (re) => until(() => p.app.windows().find((w) => re.test(w.url())), `${tag}: okno ${re}`, 30000);
  p.launcher = () => p.page(/launcher\.html/);
  p.main = async () => { const m = await p.page(/index\.html/); await m.waitForSelector('.shell', { timeout: 30000 }); return m; };
  p.close = async () => {
    await p.app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().forEach((w) => w.close())).catch(() => {});
    await Promise.race([p.app.waitForEvent('close'), sleep(8000)]);
    await p.app.close().catch(() => {});
  };
  return p;
}
async function firstRun(p, name, role) {
  const lc = await p.launcher(); watch(lc, p.tag + '/launcher');
  await lc.waitForSelector('#lc-name', { timeout: 30000 });
  await lc.fill('#lc-name', name); await lc.fill('#lc-role', role);
  await lc.click('[data-act="welcome-go"]');
  await lc.waitForSelector('.lc-hello h1');
  return lc;
}
async function signUp(lc, name, pos, email, pass) {
  await lc.click('[data-act="launcher-signin"]');
  await lc.click('[data-act="cloud-switch"]');
  const d = lc.locator('.lc-dlg');
  await d.getByLabel('Imię i nazwisko').fill(name); await d.getByLabel('Stanowisko').fill(pos);
  await d.locator('input[type=email]').fill(email); await d.locator('input[type=password]').fill(pass);
  await lc.click('[data-act="cloud-submit"]');
  await lc.waitForSelector('[data-act="src-cloud"]', { timeout: 30000 });
}

(async () => {
  const srv = await fake.start({ port: 54399 });
  const anna = await person('anna'), borys = await person('borys');
  try {
    /* ===== Anna: konto, projekt w chmurze ===== */
    log('Anna: konto i projekt w chmurze');
    await anna.start();
    let lc = await firstRun(anna, 'Anna Lokalna', 'Producent');
    await lc.waitForSelector('[data-act="launcher-signin"]', { timeout: 20000 });
    await signUp(lc, 'Anna Nowak', 'Kierownik produkcji', 'anna@film.pl', 'haslo-anny-1');
    assert.ok((await lc.textContent('.lc-hello h1')).includes('Anna Nowak'), 'powitanie z konta w chmurze');
    await lc.click('[data-act="src-cloud"]');
    await lc.waitForSelector('[data-act="launcher-new-empty"]');
    await lc.click('[data-act="launcher-new"]');
    await lc.click('[data-act="where-cloud"]');
    await lc.fill('#lc-title', 'Film w chmurze');
    await lc.click('[data-act="launcher-create"]');
    let mp = await anna.main();
    await mp.waitForSelector('[data-id="collab"]', { timeout: 30000 });
    assert.ok((await mp.textContent('.who')).includes('Anna Nowak'), 'panel użytkownika pokazuje konto z chmury');
    assert.ok(!fs.readdirSync(anna.projects).some((f) => f.endsWith('.klaps.json')), 'projekt chmurowy nie trafia do plików lokalnych');
    await mp.click('[data-act="settings-open"]');
    await mp.fill('input[data-bind="meta.title"]', 'Film w chmurze (Anna)');
    await sleep(1500);
    await mp.keyboard.press('Escape');
    const secrets = JSON.parse(fs.readFileSync(path.join(anna.data, 'secrets.json'), 'utf8'));
    assert.ok(Object.keys(secrets.items).some((k) => k.startsWith('pk:')), 'klucz projektu zapisany w magazynie sekretów');
    assert.ok(Object.keys(secrets.items).some((k) => /auth/.test(k)), 'sesja logowania w magazynie sekretów (nie w localStorage)');
    await mp.screenshot({ path: path.join(shots, 'c1-anna-main.png') });

    /* ===== Anna: zarządzanie, kod zaproszenia ===== */
    log('Anna: kod zaproszenia');
    await mp.evaluate(() => window.klapsDesktop.launcher.show());
    lc = await until(() => anna.app.windows().find((w) => /launcher\.html/.test(w.url())), 'launcher wrócił'); watch(lc, 'anna/launcher2');
    await lc.waitForSelector('[data-act="launcher-manage"]', { timeout: 30000 });
    await lc.click('[data-act="launcher-manage"]');
    await lc.click('[data-act="tab-invites"]');
    await lc.click('[data-act="inv-create"]');
    await lc.waitForSelector('[data-act="inv-fresh"] code');
    const code = (await lc.textContent('[data-act="inv-fresh"] code')).trim();
    assert.ok(/^KLAPS-/.test(code) && code.length > 60, 'kod zaproszenia');
    await lc.screenshot({ path: path.join(shots, 'c2-anna-zaproszenie.png') });

    /* ===== Borys: konto i dołączenie ===== */
    log('Borys: dołącza kodem');
    await borys.start();
    let lb = await firstRun(borys, 'Borys Lokalny', 'Operator');
    await signUp(lb, 'Borys Lis', 'Operator kamery', 'borys@film.pl', 'haslo-borysa-1');
    await lb.click('[data-act="launcher-join"]');
    await lb.fill('[data-act="join-code"]', code);
    await lb.click('[data-act="join-go"]');
    await lb.waitForSelector('[data-act="launcher-open"]', { timeout: 30000 });
    assert.ok((await lb.textContent('.lc-list')).includes('Film w chmurze (Anna)'), 'tytuł odszyfrowany kluczem z kodu');
    await lb.click('[data-act="launcher-open"]');
    const mb = await borys.main();
    await mb.waitForSelector('[data-id="collab"]');
    assert.ok((await mb.textContent('.crumb-p')).includes('Film w chmurze (Anna)'), 'Borys widzi stan projektu');

    /* ===== Anna wraca do projektu: praca na żywo ===== */
    log('praca na żywo');
    await lc.click('[data-act="manage-back"]');
    await lc.click('[data-act="src-cloud"]');
    await lc.waitForSelector('[data-act="launcher-open"]');
    await lc.click('[data-act="launcher-open"]');
    mp = await anna.main();
    await until(async () => (await mp.locator('[data-user]').count()) >= 2 && (await mb.locator('[data-user]').count()) >= 2, 'obie osoby widzą dwie osoby online', 30000);
    await mb.click('[data-act="settings-open"]');
    await mb.fill('input[data-bind="meta.call"]', '06:30');
    await mp.click('[data-act="settings-open"]');
    await until(async () => (await mp.inputValue('input[data-bind="meta.call"]')) === '06:30', 'zmiana Borysa u Anny', 20000);
    await mp.fill('input[data-bind="meta.title"]', 'Tytuł od Anny');
    await until(async () => (await mb.textContent('.crumb-p')).includes('Tytuł od Anny'), 'zmiana Anny u Borysa', 20000);
    await mb.screenshot({ path: path.join(shots, 'c3-borys-na-zywo.png') });
    await mp.keyboard.press('Escape'); await mb.keyboard.press('Escape');

    /* ===== utrata sieci i powrót ===== */
    log('utrata sieci');
    srv.setDown(true);
    await mb.click('[data-act="settings-open"]');
    await mb.fill('input[data-bind="meta.call"]', '09:15');
    await mb.keyboard.press('Escape');
    await until(async () => /Offline/.test(await mb.textContent('#save-badge')), 'status offline', 40000);
    srv.setDown(false);
    await until(async () => { await mp.click('[data-act="settings-open"]').catch(() => {}); const v = await mp.inputValue('input[data-bind="meta.call"]').catch(() => ''); await mp.keyboard.press('Escape').catch(() => {}); return v === '09:15'; }, 'zmiana offline dotarła do Anny', 90000);

    /* ===== rola Podgląd na żywo ===== */
    log('rola Podgląd');
    await mp.evaluate(() => window.klapsDesktop.launcher.show());
    lc = await until(() => anna.app.windows().find((w) => /launcher\.html/.test(w.url())), 'launcher Anny'); watch(lc, 'anna/launcher3');
    await lc.waitForSelector('[data-act="launcher-manage"]', { timeout: 30000 });
    await lc.click('[data-act="launcher-manage"]');
    await lc.waitForFunction(() => document.querySelectorAll('.lc-people li').length === 2);
    await lc.selectOption('.lc-people li:nth-child(2) select', 'viewer');
    await mb.waitForSelector('.collab-ro', { timeout: 30000 });
    await lc.selectOption('.lc-people li:nth-child(2) select', 'editor');
    await mb.waitForFunction(() => !document.querySelector('.collab-ro'), null, { timeout: 30000 });

    /* ===== zamknięcie okna zapisuje do chmury ===== */
    log('zamknięcie okna');
    await mb.click('[data-act="settings-open"]');
    await mb.fill('input[data-bind="meta.title"]', 'Tytuł zamknięcia');
    await sleep(100);
    await borys.close();
    const titleEnc = await srv.sql(`select count(*) from klaps_ops`);
    assert.ok(+titleEnc >= 4, 'zmiany zapisane w dzienniku chmury');
    await anna.close();
    assert.deepStrictEqual(errors, [], 'błędy w oknach:\n' + errors.join('\n'));
    console.log('electron cloud e2e: OK');
  } catch (e) {
    console.error('BŁĄD', e.stack || e.message); console.error(errors.join('\n'));
    process.exitCode = 1;
  } finally {
    await Promise.all([anna.app && anna.close(), borys.app && borys.close()].filter(Boolean)).catch(() => {});
    await srv.stop();
    process.exit(process.exitCode || 0);
  }
})();
