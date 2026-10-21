/* ===== START ===== */
function bindDesktopMenu() {
  if (!(window.klapsDesktop && window.klapsDesktop.onMenu)) return;
  window.klapsDesktop.onMenu((a) => {
    if (a === 'export-json') exportProjectJson();
    else if (a === 'import-json') { const f = document.getElementById('json-in') || Object.assign(document.createElement('input'), { type: 'file', accept: '.json,application/json' }); f.onchange = () => { if (f.files && f.files[0]) importProjectJson(f.files[0]); }; f.click(); }
    else if (a === 'new-project') { doSave().then(() => newProject('Nowy projekt')); }
  });
}
async function boot() {
  bindEvents();
  bindDesktopMenu();
  appEl().innerHTML = '<div class="boot">Ładowanie…</div>';
  try {
    await Store.init();
    PROJECTS = await Store.list();
  } catch (e) {
    PROJECTS = [];
    try { await Store.init(); } catch (e2) { /* pamięć */ }
  }
  let active = null;
  try { active = localStorage.getItem('klaps.active'); } catch (e) { active = null; }
  const target = PROJECTS.find((p) => p.id === active) || PROJECTS[0];
  if (target) {
    try { await openProject(target.id); return; } catch (e) { /* utwórz nowy */ }
  }
  // pierwsze uruchomienie: projekt z przykładowym scenariuszem
  await newProject('Ostatni pociąg do Zalesia', demoState());
  UI.tab = 'schedule';
  render();
  if (Store.mode === 'memory') toast('Ta przeglądarka nie zachowuje danych. Zapisuj projekt do pliku w zakładce Eksport.', 'bad');
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
}
