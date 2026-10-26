/* ===== APLIKACJA: plan pracy, shotlista, ekipa, transport, kosztorys ===== */
const tin = (bind, id, val, o = {}) => `<input class="inp${o.cls ? ' ' + o.cls : ''}" type="text" value="${esc(val == null ? '' : val)}"${o.ph != null ? ` placeholder="${esc(o.ph)}"` : ''} data-bind="${bind}" data-id="${esc(id)}"${o.time ? ' data-time="1" inputmode="numeric" maxlength="5"' : ''}${o.dur ? ' data-dur="1" inputmode="numeric" maxlength="8"' : ''}${o.render ? ' data-render="1"' : ''}${o.list ? ` list="${o.list}"` : ''}${o.mode ? ` inputmode="${o.mode}"` : ''}${o.title ? ` title="${esc(o.title)}"` : ''} aria-label="${esc(o.label || '')}">`;
const tsel = (bind, id, options, cur, label) => `<select class="inp" data-bind="${bind}" data-id="${esc(id)}" aria-label="${esc(label || '')}">${options.map(([v, l]) => opt(v, l, cur)).join('')}</select>`;
const exportBtns = (prefix, enabled) => `<button class="btn" data-act="${prefix}-pdf" ${enabled ? '' : 'disabled'}>${ICON.dl} PDF</button><button class="btn" data-act="${prefix}-xlsx" ${enabled ? '' : 'disabled'}>${ICON.dl} Excel</button>`;
/** dni pracy (zdjęciowe i specjalne) do list wyboru */
const workOptions = () => { const nums = Core.dayNumbers(S); return S.days.filter((d) => d.kind !== 'off').map((d) => [d.id, dayLabel(d, nums)]); };
const noDays = (title) => pageH(title, '') + `<div class="card"><div class="empty"><h3>${T('Najpierw dodaj dni zdjęciowe')}</h3><p>${T('Ten widok korzysta z dni zdjęciowych z kalendarzówki. Możesz je ułożyć automatycznie ze scen albo dodać puste dni i uzupełniać ręcznie.')}</p><div class="row" style="justify-content:center"><button class="btn primary big" data-act="day-add-stay">${ICON.plus} ${T('Dodaj dzień zdjęciowy')}</button><button class="btn big" data-act="tab" data-tab="schedule">${T('Przejdź do kalendarzówki')}</button></div></div></div>`;
const normTime = (v) => {
  const s = String(v || '').trim().replace(/[.,;]/g, ':');
  if (!s) return '';
  let m = /^(\d{1,2}):(\d{1,2})$/.exec(s);
  if (!m) { m = /^(\d{1,2})(\d{2})$/.exec(s) || /^(\d{1,2})$/.exec(s); if (m && !m[2]) m = [s, m[1], '0']; }
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return String(h).padStart(2, '0') + ':' + String(mi).padStart(2, '0');
};

/* ================= PLAN PRACY ================= */
const tarea = (bind, id, val, o = {}) => `<textarea class="inp cell${o.cls ? ' ' + o.cls : ''}" rows="${o.rows || 2}" data-bind="${bind}" data-id="${esc(id)}"${o.ph != null ? ` placeholder="${esc(o.ph)}"` : ''} aria-label="${esc(o.label || '')}">${esc(val == null ? '' : val)}</textarea>`;
const ROW_PRESETS = [[T_('Zbiórka ekipy'), 30], [T_('Charakteryzacja i kostiumy'), 60], [T_('Omówienie techniczne'), 15], [T_('Próba'), 20], [T_('Przejazd'), 30], [T_('Przerwa na obiad'), 45], [T_('Przerwa techniczna / przebudowa'), 30], [T_('Koniec zdjęć w lokacji'), 0], [T_('Koniec zdjęć'), 0], [T_('Rozładunek sprzętu'), 30]];

function renderCallsheet() {
  const days = S.days.filter((d) => d.kind === 'shoot'), nums = Core.dayNumbers(S);
  if (!days.length) return noDays(T('Plan pracy'));
  let day = days.find((d) => d.id === UI.csDay);
  if (!day) { day = days[0]; UI.csDay = day.id; }
  const id = day.id;
  const sh = Core.syncSheet(S, id), cm = Core.castMap(S);
  const mode = sh.mode === 'shots' ? 'shots' : 'calendar';
  const rows = Core.callRows(S, day);
  const times = Core.dayTimes(S, day);
  const hrs = Core.hoursCheck(S).get(id);
  const scs = Core.sheetScenes(S, day);
  const castIds = Core.sheetCastIds(S, day);
  const catRow = Core.catering(S).days.find((x) => x.id === id);
  const field = (label, key, ph, time) => `<label class="field"><span class="lbl">${label}</span>${tin('sheet.' + key, id, sh[key], { time, ph, render: time && key === 'crewCall', label })}</label>`;
  const right = `<label class="field"><span class="lbl">${T('Dzień zdjęciowy')}</span><select class="inp" data-act-change="cs-day">${days.map((d) => opt(d.id, dayLabel(d, nums) + ' · ' + Core.dayName(d.date), day.id)).join('')}</select></label>${exportBtns('cs-export', true)}`;
  const last = rows.length - 1;
  const trs = rows.map((r, i) => {
    const key = id + '|' + r.id, sceneLike = r.kind !== 'custom';
    const sc = r.sceneId ? sceneById(r.sceneId) : null;
    const attr = sc ? ` class="${kcls(sc)}${r.kind === 'shot' ? ' shot-row' : ''}" style="background:var(--sb);color:var(--s-ink)"` : ' class="cu"';
    const prep = tin('row.prep', key, r.prepSet && r.prep ? Core.fmtHM(r.prep) : '', { dur: true, ph: '0:00', cls: 'tm', label: T('Przestawka przed pozycją'), title: T('Przestawka / przygotowanie przed tą pozycją (h:mm albo minuty)') });
    const durAuto = !r.durSet && r.durDef != null;
    const dur = tin('row.dur', key, r.durSet ? Core.fmtHM(r.dur) : '', { dur: true, ph: r.durDef != null ? Core.fmtHM(r.durDef) : '0:00', cls: 'tm' + (durAuto ? ' auto' : ''), label: T('Czas realizacji'), title: durAuto ? T('Z ETA shotlisty. Wpisz własny czas, aby go zmienić.') : T('Czas realizacji (h:mm albo minuty)') });
    const from = `<div class="tcell">${tin('row.fix', key, r.fix, { time: true, ph: r.from, cls: 'tm' + (r.fixed ? ' fixed' : '') + (r.overlap ? ' clash' : ''), label: T('Stała godzina rozpoczęcia'), title: r.fixed ? T('Stała godzina. Usuń ją, aby godzina liczyła się sama.') : T('Godzina liczy się sama. Wpisz ją tylko dla pozycji o stałej porze (np. obiad 13:00).') })}${r.fixed ? `<small class="pin">${ICON.pin}${r.overlap ? T('kolizja') : r.gap ? T('czekanie {d}', { d: Core.fmtHM(r.gap) }) : T('stała')}</small>` : ''}</div>`;
    const to = `<b class="num to">${esc(r.to)}</b>${r.nextDay ? '<small class="nd">+1</small>' : ''}`;
    const prepRow = r.prep ? `<tr class="prep-row"><td></td><td></td><td class="num muted">${esc(Core.minToTime(r.fromMin - r.prep))}</td><td class="num muted">${esc(r.from)}</td><td colspan="7" class="muted small">${T('Przestawka / przygotowanie')} · ${esc(Core.fmtHM(r.prep))}</td></tr>` : '';
    return prepRow + `<tr${attr}><td style="width:70px">${prep}</td><td style="width:70px">${dur}</td><td style="width:84px">${from}</td><td style="width:58px" class="c">${to}</td><td style="width:62px">${tin('row.num', key, r.num, { cls: 'sc', ph: sceneLike ? '' : '–', label: T('Numer sceny') })}</td><td style="width:70px">${tin('row.shot', key, r.shot, { cls: 'shot', ph: '–', label: T('Ujęcie') })}</td><td style="min-width:230px">${tarea('row.desc', key, r.desc, { ph: sceneLike ? '' : T('np. przerwa na obiad, koniec zdjęć…'), label: T('Opis pozycji'), rows: 3 })}</td><td style="min-width:90px">${tin('row.cast', key, r.cast, { label: T('Obsada') })}</td><td style="min-width:160px">${tarea('row.camera', key, r.camera, { ph: T('mocowania, obiektywy…'), label: T('Elementy kamerowe'), rows: 3 })}</td><td style="min-width:160px">${tarea('row.notes', key, r.notes, { ph: T('uwagi'), label: T('Uwagi'), rows: 3 })}</td><td style="width:96px"><div class="rowact"><button class="btn sm ghost" data-act="row-up" data-id="${id}" data-rid="${r.id}" ${i === 0 ? 'disabled' : ''} aria-label="${T('Wyżej')}">${ICON.up}</button><button class="btn sm ghost" data-act="row-down" data-id="${id}" data-rid="${r.id}" ${i === last ? 'disabled' : ''} aria-label="${T('Niżej')}">${ICON.down}</button><button class="btn sm ghost danger" data-act="row-del" data-id="${id}" data-rid="${r.id}" aria-label="${T('Usuń pozycję')}">${ICON.trash}</button></div></td></tr>`;
  }).join('');
  const missing = mode === 'calendar' ? Core.dayStats(S, day).scenes.filter((s) => !sh.rows.some((r) => r.kind === 'scene' && r.sceneId === s.id)).length : 0;
  const castRows = castIds.map((cid) => {
    const c = cm.get(cid); if (!c) return '';
    const cc = sh.cast[cid] || {}, key = id + '|' + cid;
    return `<tr><td class="num"><b>${c.id}</b></td><td><b>${esc(c.name)}</b></td><td>${esc(c.actor)}</td><td>${tin('sheetcast.call', key, cc.call || '', { time: true, ph: day.call || '', cls: 'tm', label: T('Zbiórka') + ' ' + c.name })}</td><td>${tin('sheetcast.makeup', key, cc.makeup || '', { time: true, cls: 'tm', label: T('Charakteryzacja') + ' ' + c.name })}</td><td>${tin('sheetcast.onset', key, cc.onset || '', { time: true, cls: 'tm', label: T('Na plan') + ' ' + c.name })}</td><td class="small">${esc(scs.filter((s) => s.cast.includes(cid)).map((s) => s.num).join(', '))}</td><td>${tin('sheetcast.note', key, cc.note || '', { ph: T('uwagi, kostium…'), label: T('Uwagi') + ' ' + c.name })}</td></tr>`;
  }).join('');
  const trips = Core.transportData(S, day.id).trips;
  const contacts = sh.contacts.map((c, i) => `<tr><td>${tin('contact.role', id + '|' + i, c.role, { ph: T('funkcja'), label: T('Funkcja') })}</td><td>${tin('contact.name', id + '|' + i, c.name, { ph: T('imię i nazwisko'), label: T('Imię i nazwisko') })}</td><td>${tin('contact.phone', id + '|' + i, c.phone, { ph: T('telefon'), mode: 'tel', label: T('Telefon') })}</td><td style="width:44px"><button class="btn sm ghost danger" data-act="contact-del" data-id="${id}" data-i="${i}" aria-label="${T('Usuń kontakt')}">${ICON.trash}</button></td></tr>`).join('');
  const crewOpts = (S.crew.length ? `<optgroup label="${T('Ekipa')}">${S.crew.map((c) => opt(c.id, Core.crewName(c) + (c.role ? ' · ' + c.role : ''), '')).join('')}</optgroup>` : '')
    + (castIds.length ? `<optgroup label="${T('Obsada dnia')}">${castIds.map((cid) => cm.get(cid)).filter(Boolean).map((c) => opt('cast:' + c.id, `${c.id} ${c.name}${c.actor ? ' · ' + c.actor : ''}`, '')).join('')}</optgroup>` : '');
  const autoLoc = typeof sh.locations !== 'string';
  const maxW = (+S.meta.maxWorkH || 12) * 60;
  const workCls = times && times.known ? (times.work > maxW ? 'bad' : times.work > maxW - 60 ? 'warn' : 'ok') : '';
  const alerts = hrs ? hrs.alerts : [];
  const sumBar = `<div class="cs-sum"><span><span class="lbl">${T('Zbiórka')}</span><b class="num">${esc(Core.minToTime(times ? times.start : Core.dayStart(S, day, sh)))}</b></span><span><span class="lbl">${T('Koniec')}</span><b class="num">${times && times.known ? esc(Core.clock(times.end)) : '—'}</b></span><span class="${workCls}"><span class="lbl">${T('Czas pracy')}</span><b class="num">${times && times.known ? esc(Core.fmtDur(times.work)) : '—'}</b><small>${T('limit {n} h', { n: +S.meta.maxWorkH || 12 })}</small></span>${hrs && hrs.restBefore != null ? `<span class="${hrs.restBefore < (+S.meta.minRestH || 11) * 60 ? 'bad' : 'ok'}"><span class="lbl">${T('Odpoczynek przed')}</span><b class="num">${hrs.restBefore < 0 ? '—' : esc(Core.fmtDur(hrs.restBefore))}</b><small>${T('min. {n} h', { n: +S.meta.minRestH || 11 })}</small></span>` : ''}</div>`;
  const modeSeg = `<div class="seg mode-seg" role="group" aria-label="${T('Źródło harmonogramu')}"><button data-act="cs-mode" data-id="${id}" data-v="calendar" aria-pressed="${mode === 'calendar'}">${T('Z kalendarzówki')}</button><button data-act="cs-mode" data-id="${id}" data-v="shots" aria-pressed="${mode === 'shots'}">${T('Z shotlisty')}</button></div>`;
  const presetSel = `<select class="inp mini" data-act-change="row-preset" data-id="${id}" aria-label="${T('Dodaj pozycję do harmonogramu')}"><option value="">${T('+ Dodaj pozycję…')}</option>${ROW_PRESETS.map(([x], i) => opt(String(i), T(x), '')).join('')}<option value="__custom">${T('Własna pozycja…')}</option></select>`;
  const tools = mode === 'calendar'
    ? `${presetSel}${missing ? `<button class="btn sm" data-act="row-restore" data-id="${id}" title="${T('Dodaje wiersze usuniętych scen tego dnia')}">${T('Przywróć {n}', { n: plN(missing, 'scenę', 'sceny', 'scen') })}</button>` : ''}`
    : `${presetSel}<button class="btn sm${UI.csPick ? ' on' : ''}" data-act="cs-pick-toggle" aria-expanded="${!!UI.csPick}">${T('Wybierz ujęcia z shotlisty')}</button><button class="btn sm ghost" data-act="cs-rebuild" data-id="${id}" title="${T('Układa harmonogram od nowa z ujęć scen tego dnia')}">${T('Odbuduj z kalendarzówki')}</button>`;
  return pageH(T('Plan pracy'), T('Call sheet dla wybranego dnia. Wpisujesz czas realizacji i przestawki, a godziny liczą się same od zbiórki ekipy. Harmonogram możesz budować ze scen z kalendarzówki albo z ujęć z shotlisty.'), right) +
    (alerts.length ? `<div class="notice bad cs-alerts"><div>${ICON.warn}</div><div><b>${T('Ostrzeżenia czasu pracy')}</b><ul>${alerts.map((a) => `<li>${esc(a.text)}</li>`).join('')}</ul></div></div>` : '') +
    `<div class="card" style="margin-bottom:16px"><div class="card-h"><h2>${T('Dzień {n}', { n: nums.get(day.id) })}</h2><span class="muted">${esc(Core.fmtDatePL(day.date))}</span><span class="chip" style="margin-left:auto">${plN(scs.length, 'scena', 'sceny', 'scen')} · ${Core.fmtEighths(scs.reduce((a, s) => a + s.eighths, 0))} ${T('str.')}</span>${catRow && catRow.total ? `<button class="chip acc chip-btn" data-act="crew-cat-open" title="${T('Raport cateringowy')}">${esc(Core.cateringLine(catRow))}</button>` : ''}</div>
    <div class="card-b"><div class="fgrid cs-grid">${field(T('Zbiórka ekipy'), 'crewCall', day.call || 'hh:mm', true)}${field(T('Wschód słońca'), 'sunrise', 'hh:mm', true)}${field(T('Zachód słońca'), 'sunset', 'hh:mm', true)}
      <label class="field" style="grid-column:span 2"><span class="lbl">${T('Prognoza pogody')}</span>${tin('sheet.weather', id, sh.weather, { ph: T('np. zachmurzenie, 8°C, deszcz po południu'), label: T('Prognoza pogody') })}</label>
      <label class="field" style="grid-column:span 2"><span class="lbl">${T('Szpital / pogotowie')}</span>${tin('sheet.hospital', id, sh.hospital, { ph: T('adres i telefon najbliższego szpitala'), label: T('Szpital') })}</label></div></div></div>
    <div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${T('Harmonogram dnia')}</h3>${modeSeg}<div class="row" style="margin-left:auto">${tools}</div></div>
    ${sumBar}
    ${mode === 'shots' && UI.csPick ? renderShotPicker(day) : ''}
    ${trs ? `<div class="tbl-wrap" style="border:0;border-radius:0" data-scroll-id="cs-tbl"><table class="tbl sched-tbl"><thead><tr><th title="${T('Przestawka / przygotowanie przed pozycją')}">${T('Przest.')}</th><th>${T('Czas')}</th><th>${T('Od')}</th><th>${T('Do')}</th><th>${T('Sc.')}</th><th>${T('Ujęcie')}</th><th>${T('Opis / plan')}</th><th>${T('Obsada')}</th><th>${T('Elementy kamerowe')}</th><th>${T('Uwagi')}</th><th></th></tr></thead><tbody>${trs}</tbody></table></div>` : `<div class="empty"><p>${mode === 'shots' ? T('Harmonogram jest pusty. Wybierz ujęcia z shotlisty albo dodaj pozycję.') : T('Harmonogram jest pusty. Dodaj pozycję albo sceny do tego dnia w kalendarzówce.')}</p></div>`}
    <p class="small muted" style="margin:0;padding:8px 14px 12px">${T('<b>Przest.</b> to przestawka lub przygotowanie przed pozycją, <b>Czas</b> to czas realizacji (h:mm albo minuty). Godzina „Od” liczy się sama; wpisz ją tylko dla pozycji o stałej porze, np. obiadu. Szare czasy pochodzą z ETA w shotliście.')}</p></div>
    <div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${T('Obsada i zbiórki')}</h3><span class="muted small">${T('pusta zbiórka = zbiórka ekipy z kalendarzówki')}</span></div>
    ${castRows ? `<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>${T('Nr')}</th><th>${T('Postać')}</th><th>${T('Aktor / aktorka')}</th><th>${T('Zbiórka')}</th><th>${T('Charakteryzacja')}</th><th>${T('Na plan')}</th><th>${T('Sceny')}</th><th>${T('Uwagi')}</th></tr></thead><tbody>${castRows}</tbody></table></div>` : `<div class="empty"><p>${T('W scenach tego dnia nie ma postaci.')}</p></div>`}</div>
    <div class="imp-grid" style="margin-bottom:16px"><div class="card"><div class="card-h"><h3>${T('Lokacje i transport')}</h3><button class="btn sm" style="margin-left:auto" data-act="tab" data-tab="transport">${T('Edytuj kursy')}</button></div><div class="card-b">
      <label class="field"><span class="lbl">${T('Lokacje i adresy')} ${autoLoc ? `<span class="muted small">${T('(z kalendarzówki)')}</span>` : `<button class="btn sm ghost" data-act="cs-loc-reset" data-id="${id}">${T('przywróć automatyczne')}</button>`}</span><textarea class="inp" rows="3" data-bind="sheet.locations" data-id="${id}" placeholder="${T('obiekt – adres, dojazd, parking')}">${esc(Core.locationsText(S, day))}</textarea></label>
      <div class="lbl" style="margin-top:12px">${T('Kursy tego dnia')} <span class="muted small">${T('(edycja w zakładce Transport)')}</span></div><div class="small">${trips.map((t) => `<div style="margin-bottom:4px"><b class="num">${esc(t.time || '--:--')}</b> · ${esc(t.vehicle ? t.vehicle.name : T('bez pojazdu'))} · ${esc([t.from, t.to].filter(Boolean).join(' → '))}${t.who ? ' · ' + esc(t.who) : ''}</div>`).join('') || `<span class="muted">${T('Brak kursów.')}</span>`}</div>
      <label class="field" style="margin-top:10px"><span class="lbl">${T('Dodatkowe informacje o transporcie i parkingu')}</span>${tin('sheet.transportNote', id, sh.transportNote, { ph: T('np. parking dla ekipy przy bramie B'), label: T('Informacje o transporcie') })}</label></div></div>
    <div class="card"><div class="card-h"><h3>${T('Ważne kontakty')}</h3><div class="row" style="margin-left:auto">${crewOpts ? `<select class="inp mini" data-act-change="contact-from-crew" data-id="${id}" aria-label="${T('Dodaj kontakt z ekipy lub obsady')}"><option value="">${T('Dodaj z ekipy lub obsady…')}</option>${crewOpts}</select>` : ''}<button class="btn sm" data-act="contact-add" data-id="${id}">${ICON.plus} ${T('Dodaj')}</button></div></div>
      ${contacts ? `<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><tbody>${contacts}</tbody></table></div>` : `<div class="empty"><p>${T('Dodaj kierownika produkcji, II reżysera, lekarza… Osoby z zakładki Ekipa dodasz jednym kliknięciem.')}</p></div>`}</div></div>
    ${renderMaps(id, sh)}
    <div class="card"><div class="card-h"><h3>${T('Elementy kamerowe i uwagi')}</h3></div><div class="card-b fgrid" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
      <label class="field"><span class="lbl">${T('Elementy kamerowe dnia')}</span><textarea class="inp" rows="3" data-bind="sheet.cameraNotes" data-id="${id}" placeholder="${T('mocowania, sprzęt, obiektywy, szczególne wymagania')}">${esc(sh.cameraNotes)}</textarea></label>
      <label class="field"><span class="lbl">${T('Uwagi do dnia (z kalendarzówki)')}</span><textarea class="inp" rows="3" data-bind="day.note" data-id="${id}">${esc(day.note)}</textarea></label>
      <label class="field"><span class="lbl">${T('Dodatkowe uwagi na plan pracy')}</span><textarea class="inp" rows="3" data-bind="sheet.notes" data-id="${id}" placeholder="${T('zgody, bezpieczeństwo, parking, catering…')}">${esc(sh.notes)}</textarea></label></div></div>`;
}

/** wybór ujęć z shotlisty do harmonogramu (tryb shotlisty) */
function renderShotPicker(day) {
  const sh = Core.syncSheet(S, day.id);
  const inRows = new Set((sh.srows || []).filter((r) => r.kind === 'shot').map((r) => r.shotId));
  const used = Core.shotDays(S);
  const nums = Core.dayNumbers(S);
  const byScene = new Map();
  S.shots.forEach((x) => { if (!byScene.has(x.sceneId)) byScene.set(x.sceneId, []); byScene.get(x.sceneId).push(x); });
  if (!S.shots.length) return `<div class="picker"><div class="empty" style="padding:18px"><p>${T('Shotlista jest pusta. Dodaj ujęcia w zakładce Shotlista, a potem wybierz je tutaj.')}</p><button class="btn" data-act="tab" data-tab="shotlist">${T('Przejdź do shotlisty')}</button></div></div>`;
  const dayScenes = day.sceneIds.filter((sid) => byScene.has(sid));
  const other = S.scenes.map((s) => s.id).filter((sid) => byScene.has(sid) && !day.sceneIds.includes(sid));
  if (byScene.has('')) other.push('');
  const group = (sid) => {
    const sc = sceneById(sid), xs = byScene.get(sid) || [];
    const all = xs.every((x) => inRows.has(x.id));
    return `<div class="pk-grp"><div class="pk-h">${sc ? `<span class="pk-sc ${kcls(sc)}">${esc(sc.num)}</span> ${esc(sc.place || sc.site || '')}` : `<span class="pk-sc">–</span> ${T('Ujęcia bez sceny')}`}<button class="btn sm ghost" data-act="cs-scene-shots" data-id="${day.id}" data-sid="${esc(sid)}" data-on="${all ? 0 : 1}">${all ? T('Usuń wszystkie') : T('Dodaj wszystkie')}</button></div>
      <div class="pk-list">${xs.map((x) => { const on = inRows.has(x.id); const elsewhere = (used.get(x.id) || []).filter((t) => t !== Core.dayTag(day, nums)); return `<button class="pk-shot${on ? ' on' : ''}" data-act="cs-shot-toggle" data-id="${day.id}" data-xid="${x.id}" aria-pressed="${on}"><b>${esc(x.shot || '–')}</b>${x.type ? `<span class="pk-t">${esc(x.type)}</span>` : ''}<span class="pk-d">${esc(x.desc || T('bez opisu'))}</span>${x.eta ? `<span class="pk-e">${esc(x.eta)}</span>` : ''}${elsewhere.length ? `<span class="pk-u" title="${T('Ujęcie jest też w planie innego dnia')}">${esc(elsewhere.join(', '))}</span>` : ''}</button>`; }).join('')}</div></div>`;
  };
  return `<div class="picker"><div class="pk-top"><b>${T('Ujęcia z shotlisty')}</b><span class="muted small">${T('Kliknij ujęcie, aby dodać je do harmonogramu albo usunąć.')}</span></div>
    ${dayScenes.length ? `<div class="pk-sec">${T('Sceny tego dnia w kalendarzówce')}</div>${dayScenes.map(group).join('')}` : `<p class="small muted" style="margin:6px 0">${T('Sceny tego dnia nie mają jeszcze ujęć w shotliście.')}</p>`}
    ${other.length ? `<button class="btn sm ghost pk-more" data-act="cs-pick-all">${UI.csPickAll ? T('Ukryj pozostałe sceny') : T('Pokaż ujęcia z innych scen ({n})', { n: other.length })}</button>${UI.csPickAll ? `<div class="pk-sec">${T('Pozostałe sceny')}</div>${other.map(group).join('')}` : ''}` : ''}</div>`;
}

/** mapki lokacji i dojazdu (JPG/PNG), trafiają do PDF planu pracy */
function renderMaps(dayId, sh) {
  const maps = (sh.maps || []).filter((m) => S.media[m.media]);
  return `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${T('Mapki i dojazd')}</h3><span class="chip">${maps.length}</span><span class="muted small">${T('JPG lub PNG, trafiają do PDF planu pracy')}</span>
    <button class="btn sm" style="margin-left:auto" data-act="map-pick" data-id="${dayId}">${ICON.img} ${T('Dodaj mapkę')}</button><input type="file" id="map-in" accept="image/png,image/jpeg,.jpg,.jpeg,.png" multiple hidden data-id="${dayId}"></div>
    <div class="card-b maps" data-drop-img="${dayId}">${maps.length ? maps.map((m) => { const im = S.media[m.media]; return `<figure class="map"><img src="${mediaSrc(m.media)}" alt="${esc(m.caption || im.name || T('Mapka'))}" loading="lazy"><figcaption><input class="inp" value="${esc(m.caption || '')}" placeholder="${T('podpis, np. dojazd do bazy, parking')}" data-bind="map.caption" data-id="${dayId}|${m.id}" aria-label="${T('Podpis mapki')}"><button class="btn sm ghost danger" data-act="map-del" data-id="${dayId}" data-mid="${m.id}" aria-label="${T('Usuń mapkę')}">${ICON.trash}</button></figcaption></figure>`; }).join('') : `<div class="map-empty">${ICON.img}<span>${T('Przeciągnij tu zrzut mapy z dojazdem, planem bazy albo parkingiem, albo użyj przycisku „Dodaj mapkę”.')}</span></div>`}</div></div>`;
}

/* ================= SHOTLISTA ================= */
function renderShotlist() {
  const f = UI.shF.scene && S.scenes.some((s) => s.id === UI.shF.scene) ? UI.shF.scene : '';
  const all = Core.shotRows(S), rows = all.filter((x) => !f || x.sceneId === f);
  const sceneOpts = [['', T('— bez sceny —')]].concat(S.scenes.map((s) => [s.id, `${s.num} · ${s.place || s.site || ''}`.trim()]));
  const typeOpts = [['', '—']].concat(Core.SHOT_TYPES.map(([k]) => [k, k]));
  const totalEta = rows.reduce((a, x) => a + (x.etaMin || 0), 0);
  const used = Core.shotDays(S);
  const legend = `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${T('Legenda typów planu')}</h3><span class="muted small">${T('skróty w kolumnie „Typ planu”')}</span></div><div class="card-b"><div class="legend-shots">${Core.SHOT_TYPES.map(([k, n, d]) => `<div><b>${k}</b><strong>${esc(T(n))}</strong> <span>– ${esc(T(d))}</span></div>`).join('')}</div></div></div>`;
  const dl = `<datalist id="dl-lens">${['14 mm', '18 mm', '24 mm', '35 mm', '50 mm', '85 mm', '100 mm', '135 mm', 'Zoom 24–70', 'Zoom 70–200'].map((x) => `<option value="${x}">`).join('')}</datalist><datalist id="dl-grip">${[T('Statyw'), T('Z ręki'), 'Steadicam', 'Gimbal', 'Dolly', 'Slider', T('Dźwig / jib'), T('Kamera w aucie')].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
  const trs = rows.map((x) => {
    const sc = sceneById(x.sceneId);
    const attr = sc ? ` class="${kcls(sc)}" style="background:var(--sb);color:var(--s-ink)"` : '';
    const u = used.get(x.id);
    return `<tr${attr}><td style="min-width:190px">${tsel('shot.sceneId', x.id, sceneOpts, x.sceneId, T('Scena'))}${u ? `<div class="small used">${T('w planie: {d}', { d: esc(u.join(', ')) })}</div>` : ''}</td><td style="width:78px">${tin('shot.shot', x.id, x.shot, { cls: 'shot', ph: '1', label: T('Ujęcie') })}</td><td style="width:92px">${tsel('shot.type', x.id, typeOpts, x.type, T('Typ planu'))}</td><td style="min-width:240px">${tarea('shot.desc', x.id, x.desc, { ph: T('co jest w kadrze, ruch kamery'), label: T('Opis ujęcia'), rows: 3 })}</td><td style="min-width:100px">${tin('shot.lens', x.id, x.lens, { list: 'dl-lens', ph: '35 mm', label: T('Obiektyw') })}</td><td style="min-width:110px">${tin('shot.grip', x.id, x.grip, { list: 'dl-grip', ph: T('statyw'), label: 'Grip' })}</td><td style="width:90px">${tin('shot.eta', x.id, x.eta, { ph: '20 min', label: 'ETA', render: true })}</td><td style="min-width:140px">${tin('shot.cast', x.id, x.cast, { ph: T('aktorzy w kadrze'), label: T('Aktorzy') })}</td><td style="min-width:180px">${tin('shot.site', x.id, x.site, { ph: T('lokacja'), list: 'dl-places', label: T('Lokacja') })}</td><td style="width:96px"><div class="rowact"><button class="btn sm ghost" data-act="shot-up" data-id="${x.id}" aria-label="${T('Wyżej')}">${ICON.up}</button><button class="btn sm ghost" data-act="shot-down" data-id="${x.id}" aria-label="${T('Niżej')}">${ICON.down}</button><button class="btn sm ghost danger" data-act="shot-del" data-id="${x.id}" aria-label="${T('Usuń ujęcie')}">${ICON.trash}</button></div></td></tr>`;
  }).join('');
  const places = `<datalist id="dl-places">${sitesList().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
  const right = `<label class="field"><span class="lbl">${T('Scena')}</span><select class="inp" data-act-change="sh-scene">${opt('', T('Wszystkie sceny'), f)}${S.scenes.map((s) => opt(s.id, `${s.num} · ${s.place || s.site || ''}`.trim(), f)).join('')}</select></label><button class="btn" data-act="shot-add">${ICON.plus} ${T('Dodaj ujęcie')}</button>${exportBtns('shot-export', S.shots.length > 0)}`;
  return pageH(T('Shotlista'), T('Lista ujęć do zdjęć. Wybierz scenę, a aktorzy i lokacja uzupełnią się ze sceny, każde pole możesz zmienić. ETA wpisz w minutach (20) albo jako 0:20. ETA podpowiada też czas realizacji w Planie pracy.'), right) + dl + places + legend +
    `<div class="card"><div class="card-h"><h3>${T('Ujęcia')}</h3><span class="chip">${rows.length}</span>${totalEta ? `<span class="chip acc">${T('ETA razem {d}', { d: esc(Core.fmtDur(totalEta)) })}</span>` : ''}</div>
    ${trs ? `<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl sched-tbl"><thead><tr><th>${T('Scena')}</th><th>${T('Ujęcie')}</th><th>${T('Typ planu')}</th><th>${T('Opis')}</th><th>${T('Obiektyw')}</th><th>Grip</th><th>ETA</th><th>${T('Aktorzy')}</th><th>${T('Lokacja')}</th><th></th></tr></thead><tbody>${trs}</tbody></table></div>` : `<div class="empty"><p>${S.shots.length ? T('Ta scena nie ma jeszcze ujęć.') : T('Nie ma jeszcze ujęć. Dodaj pierwsze i wybierz scenę.')}</p><button class="btn primary" data-act="shot-add">${ICON.plus} ${T('Dodaj ujęcie')}</button></div>`}</div>`;
}

/* ================= EKIPA ================= */
function renderCrew() {
  const v = UI.crewView || 'list';
  const work = S.days.filter((d) => d.kind !== 'off');
  const seg = `<div class="seg" role="tablist" aria-label="${T('Widok ekipy')}"><button data-act="crew-view" data-v="list" aria-pressed="${v === 'list'}">${T('Lista')}</button><button data-act="crew-view" data-v="days" aria-pressed="${v === 'days'}">${T('Dni pracy')}</button><button data-act="crew-view" data-v="catering" aria-pressed="${v === 'catering'}">${T('Catering')}</button></div>`;
  const right = v === 'catering'
    ? `${seg}${exportBtns('cat-export', work.length > 0)}`
    : `${seg}<button class="btn" data-act="crew-add">${ICON.plus} ${T('Dodaj osobę')}</button>${exportBtns('crew-export', S.crew.length > 0)}`;
  const sub = v === 'days' ? T('Zaznacz, w które dni pracuje każda osoba. Bez zmian osoba pracuje we wszystkie dni zdjęciowe; dni specjalne (prelight, budowa, przerzut) zaznacz ręcznie. Na tej podstawie liczy się catering.')
    : v === 'catering' ? T('Raport cateringowy: ile posiłków każdej diety potrzeba w kolejne dni pracy. Liczy się z dni pracy i diet ekipy oraz (opcjonalnie) aktorów z planu dnia.')
      : T('Lista ekipy filmowej. W tabeli są dane podstawowe, a rozwinięcie „Szczegóły” zawiera e-mail, umowę, stawkę, nocleg, dietę, transport i dni pracy. Eksport PDF zawiera tylko dane podstawowe, więc możesz go wysłać razem z planem pracy.');
  const head = pageH(T('Ekipa'), sub, right);
  if (v === 'days') return head + renderCrewDays(work);
  if (v === 'catering') return head + renderCatering();
  const f = UI.crewF, q = f.q.trim().toLowerCase();
  const list = S.crew.filter((c) => (!f.dept || Core.deptKey(c) === f.dept) && (!q || [c.first, c.last, c.dept, c.role, c.phone, c.email, c.notes].join(' ').toLowerCase().includes(q)));
  const groups = Core.crewGroups({ crew: list });
  const allDepts = Core.crewGroups({ crew: S.crew });
  const lodging = S.crew.filter((c) => c.lodging === 'Tak').length, diets = S.crew.filter((c) => (c.dietType && c.dietType !== 'meat') || c.dietNote).length;
  const nums = Core.dayNumbers(S);
  const dl = `<datalist id="dl-depts">${Core.DEPTS.map((x) => `<option value="${esc(T(x))}">`).join('')}</datalist><datalist id="dl-contract">${Core.CONTRACTS.map((x) => `<option value="${esc(T(x))}">`).join('')}</datalist><datalist id="dl-ctrans">${[T('Własny'), T('Bus produkcji'), T('Ciężarówka techniczna'), T('Zorganizowany dojazd')].map((x) => `<option value="${esc(x)}">`).join('')}</datalist>`;
  const body = groups.map((g) => `<tr class="grp-row"><td colspan="6">${esc(g.dept)} · ${g.list.length}</td></tr>` + g.list.map((c) => {
    const open = UI.crewOpen.has(c.id);
    const nm = Core.crewName(c) || T('osoba');
    const nDays = work.filter((d) => Core.crewWorks(c, d)).length;
    const main = `<tr><td style="min-width:120px">${tin('crew.first', c.id, c.first, { ph: T('imię'), label: T('Imię') })}</td><td style="min-width:130px">${tin('crew.last', c.id, c.last, { ph: T('nazwisko'), label: T('Nazwisko') })}</td><td style="min-width:130px">${tin('crew.dept', c.id, c.dept, { ph: T('pion'), list: 'dl-depts', render: true, label: T('Pion') })}</td><td style="min-width:150px">${tin('crew.role', c.id, c.role, { ph: T('funkcja'), label: T('Funkcja') })}</td><td style="min-width:130px">${tin('crew.phone', c.id, c.phone, { ph: T('telefon'), mode: 'tel', label: T('Telefon') })}</td><td style="width:170px"><div class="rowact">${c.dietType && c.dietType !== 'meat' ? `<span class="diet-tag" title="${esc(Core.dietLabel(c.dietType))}">${esc(Core.dietLabel(c.dietType, true))}</span>` : ''}<button class="btn sm${open ? '' : ' ghost'}" data-act="crew-toggle" data-id="${c.id}" aria-expanded="${open}" aria-label="${T('Szczegóły: {n}', { n: esc(nm) })}">${open ? T('Zwiń') : T('Szczegóły')}</button><button class="btn sm ghost danger" data-act="crew-del" data-id="${c.id}" aria-label="${T('Usuń: {n}', { n: esc(nm) })}">${ICON.trash}</button></div></td></tr>`;
    if (!open) return main;
    const fld = (label, key, o) => `<label class="field"><span class="lbl">${label}</span>${tin('crew.' + key, c.id, c[key], Object.assign({ label: label + ' – ' + nm }, o))}</label>`;
    const dayChips = work.map((d) => `<button class="day-chip${Core.crewWorks(c, d) ? ' on' : ''}${d.kind !== 'shoot' ? ' sp' : ''}" data-act="crew-day" data-id="${c.id}" data-day="${d.id}" aria-pressed="${Core.crewWorks(c, d)}" title="${esc(Core.fmtDatePL(d.date))}">${esc(Core.dayTag(d, nums))}<small>${esc(Core.fmtDM(d.date))}</small></button>`).join('');
    return main + `<tr class="crew-det"><td colspan="6"><div class="fgrid">${fld('E-mail', 'email', { ph: 'imie@domena.pl', mode: 'email' })}${fld(T('Typ umowy'), 'contract', { list: 'dl-contract', ph: T('np. umowa o dzieło') })}${fld(T('Stawka'), 'rate', { ph: T('np. 800 zł / dzień') })}<label class="field"><span class="lbl">${T('Nocleg')}</span>${tsel('crew.lodging', c.id, [['', '—'], ['Tak', T('Tak')], ['Nie', T('Nie')]], c.lodging, T('Nocleg') + ' – ' + nm)}</label><label class="field"><span class="lbl">${T('Dieta')}</span>${tsel('crew.dietType', c.id, Core.DIETS.map(([k, l]) => [k, T(l)]), c.dietType || 'meat', T('Dieta') + ' – ' + nm)}</label>${fld(T('Alergie / uwagi do diety'), 'dietNote', { ph: T('np. orzechy, celiakia') })}${fld(T('Transport'), 'transport', { list: 'dl-ctrans', ph: T('własny / bus produkcji') })}
      <div class="field" style="grid-column:1/-1"><span class="lbl">${T('Dni pracy')} <span class="muted small">${T('{a} z {b}', { a: nDays, b: work.length })}${Core.crewDefaultDays(c) ? ' · ' + T('wszystkie dni zdjęciowe') : ''}</span></span><div class="day-chips">${dayChips || `<span class="muted small">${T('Brak dni w kalendarzówce.')}</span>`}${work.length ? `<button class="btn sm ghost" data-act="crew-days-all" data-id="${c.id}" data-v="shoot">${T('Wszystkie zdjęciowe')}</button><button class="btn sm ghost" data-act="crew-days-all" data-id="${c.id}" data-v="all">${T('Wszystkie')}</button><button class="btn sm ghost" data-act="crew-days-all" data-id="${c.id}" data-v="none">${T('Żadne')}</button>` : ''}</div></div>
      <label class="field" style="grid-column:1/-1"><span class="lbl">${T('Uwagi')}</span><textarea class="inp" rows="2" data-bind="crew.notes" data-id="${c.id}" aria-label="${T('Uwagi')} – ${esc(nm)}">${esc(c.notes)}</textarea></label></div></td></tr>`;
  }).join('')).join('');
  const chips = allDepts.length > 1 ? `<div class="chips" style="margin-bottom:12px"><button class="dept-chip" data-act="crew-dept" data-d="" aria-pressed="${!f.dept}">${T('Wszyscy')} · ${S.crew.length}</button>${allDepts.map((g) => `<button class="dept-chip" data-act="crew-dept" data-d="${esc(g.key)}" aria-pressed="${f.dept === g.key}">${esc(g.dept)} · ${g.list.length}</button>`).join('')}</div>` : '';
  return head + dl +
    `<div class="card" style="margin-bottom:16px"><div class="card-b"><div class="stats"><div class="stat"><b>${S.crew.length}</b><span>${pl(S.crew.length, 'osoba', 'osoby', 'osób')}</span></div><div class="stat"><b>${allDepts.length}</b><span>${pl(allDepts.length, 'pion', 'piony', 'pionów')}</span></div><div class="stat"><b>${lodging}</b><span>${T('potrzebuje noclegu')}</span></div><div class="stat"><b>${diets}</b><span>${T('z dietą specjalną')}</span></div></div></div></div>` +
    (S.crew.length ? `<div class="toolbar"><input class="inp search" id="crew-q" type="search" placeholder="${T('Szukaj: imię, nazwisko, funkcja, telefon…')}" value="${esc(f.q)}" aria-label="${T('Szukaj w ekipie')}"><span class="muted small" style="margin-left:auto">${T('<b class="num">{a}</b> z {b}', { a: list.length, b: S.crew.length })}</span></div>${chips}
    <div class="tbl-wrap"><table class="tbl"><thead><tr><th>${T('Imię')}</th><th>${T('Nazwisko')}</th><th>${T('Pion')}</th><th>${T('Funkcja')}</th><th>${T('Telefon')}</th><th></th></tr></thead><tbody>${body || `<tr><td colspan="6" class="muted" style="padding:20px">${T('Nikt nie pasuje do filtrów.')}</td></tr>`}</tbody></table></div>`
      : `<div class="card"><div class="empty"><h3>${T('Nie dodano jeszcze ekipy')}</h3><p>${T('Dodaj osoby z poszczególnych pionów: reżyserii, produkcji, zdjęć, dźwięku i innych.')}</p><button class="btn primary big" data-act="crew-add">${ICON.plus} ${T('Dodaj pierwszą osobę')}</button></div></div>`);
}

/** siatka: osoby × dni pracy */
function renderCrewDays(work) {
  if (!work.length) return `<div class="card"><div class="empty"><h3>${T('Brak dni pracy')}</h3><p>${T('Dodaj dni zdjęciowe albo dni specjalne w kalendarzówce.')}</p><button class="btn primary" data-act="tab" data-tab="schedule">${T('Przejdź do kalendarzówki')}</button></div></div>`;
  if (!S.crew.length) return `<div class="card"><div class="empty"><h3>${T('Nie dodano jeszcze ekipy')}</h3><button class="btn primary big" data-act="crew-add">${ICON.plus} ${T('Dodaj pierwszą osobę')}</button></div></div>`;
  const nums = Core.dayNumbers(S);
  const head = work.map((d) => `<th class="dcol${d.kind !== 'shoot' ? ' sp sp-' + d.kind : ''}" title="${esc(Core.fmtDatePL(d.date))}"><span>${esc(Core.dayTag(d, nums))}</span><small>${esc(Core.fmtDM(d.date))}</small><button class="mini-all" data-act="crew-col" data-day="${d.id}" title="${T('Zaznacz lub odznacz wszystkich tego dnia')}" aria-label="${T('Zaznacz lub odznacz wszystkich tego dnia')}">±</button></th>`).join('');
  const body = Core.crewGroups(S).map((g) => `<tr class="grp-row"><td colspan="${work.length + 2}">${esc(g.dept)} · ${g.list.length}</td></tr>` + g.list.map((c) => {
    const n = work.filter((d) => Core.crewWorks(c, d)).length;
    return `<tr><td class="l sticky-l"><b>${esc(Core.crewName(c) || T('(bez nazwiska)'))}</b><div class="muted small">${esc(c.role || '')}</div></td>${work.map((d) => { const on = Core.crewWorks(c, d); return `<td class="dcell"><button class="tick${on ? ' on' : ''}" data-act="crew-day" data-id="${c.id}" data-day="${d.id}" aria-pressed="${on}" aria-label="${esc((Core.crewName(c) || '') + ' · ' + Core.dayTag(d, nums))}">${on ? '✓' : ''}</button></td>`; }).join('')}<td class="num"><b>${n}</b></td></tr>`;
  }).join('')).join('');
  const tot = work.map((d) => `<td class="num"><b>${S.crew.filter((c) => Core.crewWorks(c, d)).length}</b></td>`).join('');
  return `<div class="tbl-wrap" data-scroll-id="crew-days"><table class="tbl crew-days"><thead><tr><th class="l sticky-l" style="background:var(--surface-3)">${T('Osoba')}</th>${head}<th>${T('Dni')}</th></tr></thead><tbody>${body}<tr class="tot"><td class="l sticky-l">${T('Osób danego dnia')}</td>${tot}<td></td></tr></tbody></table></div>
    <div class="legend"><span><i class="tick-lg on">✓</i> ${T('pracuje')}</span><span><i class="tick-lg"></i> ${T('nie pracuje')}</span><span><i class="tick-lg sp"></i> ${T('dzień specjalny (prelight, budowa, przerzut)')}</span></div>`;
}

/** raport cateringowy */
function renderCatering() {
  const cat = Core.catering(S);
  if (!cat.days.length) return `<div class="card"><div class="empty"><h3>${T('Brak dni pracy')}</h3><p>${T('Dodaj dni zdjęciowe albo dni specjalne w kalendarzówce.')}</p></div></div>`;
  const keys = cat.keys;
  const castOn = S.catering.cast !== false;
  const rows = cat.days.map((d) => `<tr${d.kind !== 'shoot' ? ' class="sp-row"' : ''}><td class="l"><b>${esc(d.tag)}</b><div class="muted small">${esc(Core.fmtDM(d.date))} ${esc(d.date ? Core.DAYS_SHORT[Core.dow(d.date)] : '')}</div></td>${keys.map((k) => `<td class="num${d.counts[k] ? '' : ' zero'}">${d.counts[k] || '·'}</td>`).join('')}<td class="num">${d.crew}</td><td class="num">${castOn && d.kind === 'shoot' ? d.cast : '—'}</td><td style="width:84px"><input class="inp tm" type="number" min="0" step="1" value="${esc(S.catering.extra[d.id] || '')}" placeholder="0" data-bind="catx.n" data-id="${d.id}" data-render="1" aria-label="${T('Dodatkowe porcje')} ${esc(d.tag)}"></td><td class="num tot"><b>${d.total}</b></td></tr>`).join('');
  const notes = [];
  cat.days.forEach((d) => d.notes.forEach((x) => notes.push(`<tr><td><b>${esc(d.tag)}</b></td><td>${esc(x.who)}</td><td>${esc(x.diet)}</td><td>${esc(x.note)}</td></tr>`)));
  return `<div class="card" style="margin-bottom:16px"><div class="card-b"><div class="stats"><div class="stat"><b>${cat.total}</b><span>${T('posiłków razem')}</span></div>${keys.filter((k) => cat.sum[k]).map((k) => `<div class="stat"><b>${cat.sum[k]}</b><span>${esc(Core.dietLabel(k))}</span></div>`).join('')}</div>
      <label class="chk" style="margin-top:12px"><input type="checkbox" data-act-change="cat-cast" ${castOn ? 'checked' : ''}> ${T('Doliczaj aktorów z planu dnia (dieta aktora ustawiana w zakładce Obsada)')}</label></div></div>
    <div class="tbl-wrap" style="margin-bottom:16px"><table class="tbl cat-tbl"><thead><tr><th>${T('Dzień')}</th>${keys.map((k) => `<th class="c">${esc(Core.dietLabel(k, true))}</th>`).join('')}<th class="c">${T('Ekipa')}</th><th class="c">${T('Aktorzy')}</th><th class="c" title="${T('np. statyści, goście; liczone jako standardowe')}">${T('Dodatkowe')}</th><th class="c">${T('Razem')}</th></tr></thead><tbody>${rows}<tr class="tot"><td><b>${T('RAZEM')}</b></td>${keys.map((k) => `<td class="num"><b>${cat.sum[k]}</b></td>`).join('')}<td class="num">${cat.days.reduce((a, d) => a + d.crew, 0)}</td><td class="num">${cat.days.reduce((a, d) => a + d.cast, 0)}</td><td class="num">${cat.days.reduce((a, d) => a + d.extra, 0)}</td><td class="num"><b>${cat.total}</b></td></tr></tbody></table></div>
    <div class="card"><div class="card-h"><h3>${T('Diety specjalne i alergie')}</h3><span class="chip">${notes.length}</span></div>${notes.length ? `<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>${T('Dzień')}</th><th>${T('Osoba')}</th><th>${T('Dieta')}</th><th>${T('Uwagi')}</th></tr></thead><tbody>${notes.join('')}</tbody></table></div>` : `<div class="empty"><p>${T('Brak diet specjalnych i alergii w dniach pracy.')}</p></div>`}</div>`;
}

/* ================= TRANSPORT ================= */
function renderTransport() {
  const dayOpts = workOptions();
  if (!dayOpts.length) return noDays(T('Transport'));
  const f = UI.trDay && dayOpts.some((x) => x[0] === UI.trDay) ? UI.trDay : '';
  const tv = S.transport.vehicles, vOpts = [['', T('bez pojazdu')]].concat(tv.map((v) => [v.id, v.name || T('(bez nazwy)')]));
  const trips = S.transport.trips.filter((t) => !f || t.dayId === f);
  const siteDl = `<datalist id="dl-places">${sitesList().map((x) => `<option value="${esc(x)}">`).join('')}${Object.values(S.sites).map((x) => x.address).filter(Boolean).map((x) => `<option value="${esc(x)}">`).join('')}</datalist><datalist id="dl-who">${S.cast.map((c) => `<option value="${esc(c.name)}${c.actor ? ' (' + esc(c.actor) + ')' : ''}">`).join('')}<option value="${T('Ekipa')}"><option value="${T('Sprzęt')}"></datalist>`;
  const vtypes = Core.VEHICLE_TYPES.map((x) => [x, T(x)]);
  const vrows = tv.map((v) => `<tr><td>${tin('veh.name', v.id, v.name, { ph: T('np. Bus 1'), label: T('Nazwa pojazdu') })}</td><td>${tsel('veh.type', v.id, vtypes, v.type, T('Typ pojazdu'))}</td><td>${tin('veh.plate', v.id, v.plate, { ph: T('nr rej.'), label: T('Numer rejestracyjny') })}</td><td>${tin('veh.driver', v.id, v.driver, { ph: T('kierowca'), label: T('Kierowca') })}</td><td>${tin('veh.phone', v.id, v.phone, { ph: T('telefon'), mode: 'tel', label: T('Telefon kierowcy') })}</td><td>${tin('veh.note', v.id, v.note, { ph: T('uwagi'), label: T('Uwagi') })}</td><td style="width:44px"><button class="btn sm ghost danger" data-act="veh-del" data-id="${v.id}" aria-label="${T('Usuń pojazd')}">${ICON.trash}</button></td></tr>`).join('');
  const trows = trips.map((t) => `<tr><td style="min-width:130px">${tsel('trip.dayId', t.id, dayOpts, t.dayId, T('Dzień'))}</td><td style="width:84px">${tin('trip.time', t.id, t.time, { time: true, ph: 'hh:mm', cls: 'tm', label: T('Godzina odjazdu') })}</td><td style="min-width:130px">${tsel('trip.vehicleId', t.id, vOpts, t.vehicleId, T('Pojazd'))}</td><td>${tin('trip.from', t.id, t.from, { ph: T('skąd (adres zbiórki)'), list: 'dl-places', label: T('Skąd') })}</td><td>${tin('trip.to', t.id, t.to, { ph: T('dokąd (lokacja)'), list: 'dl-places', label: T('Dokąd') })}</td><td>${tin('trip.who', t.id, t.who, { ph: T('aktor, ekipa, sprzęt'), list: 'dl-who', label: T('Kto lub co') })}</td><td>${tin('trip.note', t.id, t.note, { ph: T('uwagi'), label: T('Uwagi') })}</td><td style="width:44px"><button class="btn sm ghost danger" data-act="trip-del" data-id="${t.id}" aria-label="${T('Usuń kurs')}">${ICON.trash}</button></td></tr>`).join('');
  const right = `<label class="field"><span class="lbl">${T('Pokaż')}</span><select class="inp" data-act-change="tr-day">${opt('', T('Wszystkie dni'), f)}${dayOpts.map(([v, l]) => opt(v, l, f)).join('')}</select></label>${exportBtns('tr-export', trips.length > 0 || tv.length > 0)}`;
  return pageH(T('Plan transportów'), T('Pojazdy, kierowcy i kursy przypisane do dni zdjęciowych i dni specjalnych (np. przerzutu). Skąd i dokąd podpowiadają obiekty oraz adresy z zakładki Lokacje. Eksport sortuje kursy według dnia i godziny.'), right) + siteDl +
    `<div class="card" style="margin-bottom:16px"><div class="card-h"><h3>${T('Pojazdy i kierowcy')}</h3><span class="chip">${tv.length}</span><button class="btn sm" style="margin-left:auto" data-act="veh-add">${ICON.plus} ${T('Dodaj pojazd')}</button></div>
    ${vrows ? `<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>${T('Pojazd')}</th><th>${T('Typ')}</th><th>${T('Nr rej.')}</th><th>${T('Kierowca')}</th><th>${T('Telefon')}</th><th>${T('Uwagi')}</th><th></th></tr></thead><tbody>${vrows}</tbody></table></div>` : `<div class="empty"><p>${T('Dodaj busy, auta osobowe, ciężarówki techniczne i przypisz kierowców.')}</p></div>`}</div>
    <div class="card"><div class="card-h"><h3>${T('Kursy i zadania transportowe')}</h3><span class="chip">${trips.length}</span><button class="btn sm" style="margin-left:auto" data-act="trip-add">${ICON.plus} ${T('Dodaj kurs')}</button></div>
    ${trows ? `<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>${T('Dzień')}</th><th>${T('Godz.')}</th><th>${T('Pojazd')}</th><th>${T('Skąd')}</th><th>${T('Dokąd')}</th><th>${T('Kto / co')}</th><th>${T('Uwagi')}</th><th></th></tr></thead><tbody>${trows}</tbody></table></div>` : `<div class="empty"><p>${T('Brak kursów. Dodaj przejazd ekipy, odbiór aktora albo transport sprzętu.')}</p></div>`}</div>`;
}

/* ================= KOSZTORYS ================= */
function renderBudget() {
  const bd = Core.budgetData(S), dayOpts = [['', '—']].concat(workOptions()), siteOpts = [['', '—']].concat(sitesList().map((x) => [x, x]));
  const total = bd.est || 0;
  const over = bd.act && bd.dev > 0;
  const cur = PREFS.lang === 'en' ? 'PLN' : 'zł';
  const sumRows = bd.cats.map((c) => `<tr><td><b>${esc(c.label)}</b></td><td class="num" style="text-align:right">${Core.fmtMoney(c.est)}</td><td class="num" style="text-align:right">${c.act ? Core.fmtMoney(c.act) : '—'}</td><td class="num" style="text-align:right;${c.act && c.dev > 0 ? 'color:var(--bad);font-weight:600' : ''}">${c.act ? Core.fmtMoney(c.dev) : '—'}</td><td style="min-width:120px"><div class="load" style="background:var(--surface-3)"><i style="width:${total ? Math.round((c.est / total) * 100) : 0}%;background:var(--accent)"></i></div><span class="muted small">${total ? Math.round((c.est / total) * 100) : 0}%</span></td></tr>`).join('');
  const cards = bd.cats.map((c) => {
    const rows = c.items.map((i) => `<tr><td style="min-width:200px">${tin('bud.name', i.id, i.name, { ph: T('nazwa pozycji'), label: T('Pozycja') })}</td><td style="min-width:120px">${tsel('bud.dayId', i.id, dayOpts, i.dayId, T('Dzień'))}</td><td style="min-width:140px">${tsel('bud.site', i.id, siteOpts, i.site, T('Obiekt'))}</td><td style="width:120px">${tin('bud.est', i.id, S.budget.items.find((x) => x.id === i.id).est, { mode: 'decimal', ph: '0,00', cls: 'amt', render: true, label: T('Koszt planowany') })}</td><td style="width:120px">${tin('bud.act', i.id, S.budget.items.find((x) => x.id === i.id).act, { mode: 'decimal', ph: '0,00', cls: 'amt', render: true, label: T('Koszt rzeczywisty') })}</td><td class="num" style="text-align:right;width:110px;${i.act && i.act > i.est ? 'color:var(--bad)' : ''}">${i.act ? Core.fmtMoney(i.act - i.est) : '—'}</td><td style="width:44px"><button class="btn sm ghost danger" data-act="bud-del" data-id="${i.id}" aria-label="${T('Usuń pozycję')}">${ICON.trash}</button></td></tr>`).join('');
    return `<div class="card" style="margin-bottom:14px"><div class="card-h"><h3>${esc(c.label)}</h3><span class="chip">${c.items.length}</span><span class="num" style="margin-left:auto"><b>${Core.fmtMoney(c.est)}</b> <span class="muted small">${T('plan')}</span> · <b>${c.act ? Core.fmtMoney(c.act) : '—'}</b> <span class="muted small">${T('rzecz.')}</span></span><button class="btn sm" data-act="bud-add" data-cat="${c.key}">${ICON.plus} ${T('Dodaj pozycję')}</button></div>
      ${rows ? `<div class="tbl-wrap" style="border:0;border-radius:0"><table class="tbl"><thead><tr><th>${T('Pozycja')}</th><th>${T('Dzień')}</th><th>${T('Obiekt')}</th><th style="text-align:right">${T('Planowany ({c})', { c: cur })}</th><th style="text-align:right">${T('Rzeczywisty ({c})', { c: cur })}</th><th style="text-align:right">${T('Różnica')}</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}</div>`;
  }).join('');
  return pageH(T('Kosztorys'), T('Budżet podzielony na piony produkcyjne. Wpisz koszt planowany, a po zakupie rzeczywisty. Sumy liczą się same. Pozycję możesz powiązać z dniem zdjęciowym lub obiektem.'), exportBtns('bud-export', S.budget.items.length > 0)) +
    `<div class="card" style="margin-bottom:16px"><div class="card-b"><div class="stats"><div class="stat"><b class="num">${Core.fmtMoney(bd.est)}</b><span>${T('planowany')}</span></div><div class="stat"><b class="num">${bd.act ? Core.fmtMoney(bd.act) : '—'}</b><span>${T('rzeczywisty')}</span></div><div class="stat"><b class="num" style="${over ? 'color:var(--bad)' : ''}">${bd.act ? Core.fmtMoney(bd.dev) : '—'}</b><span>${T('różnica na rozliczonych pozycjach')}</span></div><div class="stat"><b class="num">${S.budget.items.length}</b><span>${T('pozycji')}</span></div></div></div>
    <div class="tbl-wrap" style="border:0;border-top:1px solid var(--line-2);border-radius:0 0 10px 10px"><table class="tbl"><thead><tr><th>${T('Pion')}</th><th style="text-align:right">${T('Planowany')}</th><th style="text-align:right">${T('Rzeczywisty')}</th><th style="text-align:right">${T('Różnica')}</th><th>${T('Udział w budżecie')}</th></tr></thead><tbody>${sumRows}</tbody></table></div></div>` + cards;
}
