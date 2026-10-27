// @ts-nocheck
/* Przykładowy projekt (fikcyjne dane) – ten sam co w wersji 1.x. */
import { T } from './i18n';
import { Core } from './core';
import { Parser } from './parser';
import { SAMPLE_SCRIPT } from './sample';

export function demoState() {
  const st = Core.newState();
  const p = Parser.fromText(SAMPLE_SCRIPT);
  Core.applyImport(st, p, { title: p.title, file: T('przykładowy scenariusz') });
  st.meta.title = p.title || 'Ostatni pociąg do Zalesia';
  st.meta.pagesPerDay = 3;
  st.demo = true;
  // dane lokacji (fikcyjne)
  if (st.sites['STACJA KOLEJOWA']) Object.assign(st.sites['STACJA KOLEJOWA'], { realName: T('Dworzec PKP Zalesie'), address: 'ul. Kolejowa 1, 05-500 Zalesie', owner: T('Jan Nowicki, zawiadowca stacji'), ownerContact: '601 400 500, stacja@example.com', power: 'three', toilet: T('Budynek dworca, parter (klucz u zawiadowcy)'), camp: T('Plac przed dworcem, miejsce na 3 busy i catering'), contract: 'signed', notes: T('Zdjęcia na peronie tylko między pociągami: 9:10–10:40 i 12:00–14:30. Parking dla ekipy za budynkiem.') });
  if (st.sites['DOM ANNY']) Object.assign(st.sites['DOM ANNY'], { realName: T('Dom prywatny, rodzina Wiśniewskich'), address: 'ul. Leśna 14, 05-500 Zalesie', owner: 'Teresa Wiśniewska', ownerContact: '602 111 222', power: 'house', toilet: T('Łazienka na piętrze (tylko obsada), toi-toi przy bramie'), camp: T('Łąka za ogrodem, dojazd drogą polną'), contract: 'negotiation', notes: T('Cisza nocna od 22:00, sąsiedzi uprzedzeni. Zabezpieczyć podłogi.') });
  Core.autoPlan(st, { strategy: 'site', scope: 'all', separateNight: true });
  const d1 = st.days[0];
  if (d1) {
    const sh = Core.syncSheet(st, d1.id);
    Object.assign(sh, { crewCall: '06:30', sunrise: '06:41', sunset: '17:52', weather: T('Pochmurno, 9°C, możliwy deszcz po południu'), hospital: T('Szpital Powiatowy, ul. Szpitalna 1, tel. 999'), cameraNotes: T('Kamera A na steadicamie, kamera B na statywie. Obiektywy 24, 35, 50, 85 mm.') });
    sh.contacts.push({ role: T('Kierownik produkcji'), name: 'Ewa Nowak', phone: '600 100 200' }, { role: T('II reżyser'), name: 'Piotr Kowal', phone: '600 100 201' });
    // harmonogram: czasy realizacji i przestawki, godziny liczą się same od zbiórki
    const scRows = sh.rows.filter((r) => r.kind === 'scene');
    const sm = Core.sceneMap(st);
    const rows = [Core.customRow(T('Zbiórka ekipy'), 30), Core.customRow(T('Omówienie techniczne'), 15)];
    scRows.forEach((r, i) => {
      const sc = sm.get(r.sceneId);
      r.dur = Math.max(20, Math.round(((sc ? sc.eighths : 4) * 7.5) / 5) * 5 + 15);
      r.prep = i ? 15 : 10;
      if (i === 0) { r.camera = T('Steadicam, obiektyw 35 mm'); r.notes = T('Światło naturalne, domykamy przed deszczem'); }
      rows.push(r);
    });
    rows.push(Core.customRow(T('Koniec zdjęć'), 0, 15));
    sh.rows = rows;
    // obiad wypada przed pierwszą sceną zaczynającą się po 12:00
    const cr = Core.callRows(st, d1);
    let li = cr.findIndex((r, i) => i > 1 && r.kind !== 'custom' && r.fromMin >= 12 * 60);
    if (li < 0) li = Math.max(2, rows.length - 1);
    rows.splice(li, 0, Core.customRow(T('Przerwa na obiad'), 45));
    const bus = Core.uid(), truck = Core.uid();
    st.transport.vehicles.push({ id: bus, name: 'Bus 1', type: 'Bus', plate: 'WA 12345', driver: 'Adam Kierowca', phone: '500 111 222', note: T('9 miejsc') }, { id: truck, name: T('Ciężarówka techniczna'), type: 'Ciężarówka techniczna', plate: 'WX 9999', driver: 'Jan Grip', phone: '500 333 444', note: '' });
    st.transport.trips.push({ id: Core.uid(), dayId: d1.id, vehicleId: truck, time: '05:00', from: T('Magazyn sprzętu'), to: 'STACJA KOLEJOWA', who: T('Sprzęt oświetleniowy'), note: T('rozładunek o 06:00') }, { id: Core.uid(), dayId: d1.id, vehicleId: bus, time: '05:45', from: 'Hotel Centrum', to: 'STACJA KOLEJOWA', who: T('Ekipa i aktorzy'), note: '' });
    st.budget.items.push({ id: Core.uid(), cat: 'gear', name: T('Wynajem oświetlenia'), est: 4200, act: '', dayId: d1.id, site: '', note: '' }, { id: Core.uid(), cat: 'transport', name: T('Bus 1 z kierowcą (dzień 1)'), est: 900, act: 950, dayId: d1.id, site: 'STACJA KOLEJOWA', note: '' }, { id: Core.uid(), cat: 'reserve', name: T('Rezerwa produkcyjna'), est: 2500, act: '', dayId: '', site: '', note: '' });
    // shotlista pierwszych dwóch scen dnia
    const types = [['WS', T('Establishing, stacja o świcie'), '24 mm', T('Statyw'), '15 min'], ['MS', T('Anna idzie po peronie'), '35 mm', 'Steadicam', '25 min'], ['CU', T('Twarz Anny, wahanie'), '85 mm', T('Statyw'), '20 min']];
    d1.sceneIds.slice(0, 2).forEach((sid) => {
      types.forEach((tp, i) => {
        const x = Core.newShot(st, sid);
        Object.assign(x, { type: tp[0], desc: tp[1], lens: tp[2], grip: tp[3], eta: tp[4], shot: String(i + 1) });
        st.shots.push(x);
      });
    });
    // prelight dzień przed zdjęciami (nie wlicza się do dni zdjęciowych)
    const pre = Core.addDay(st, 'prelight', { call: '09:00', end: '17:00', site: (Core.dayStats(st, d1).sites[0] || ''), note: T('Ustawienie światła na peronie, ekipa oświetleniowa i operator') });
    st.days.unshift(st.days.pop());
    Core.recalcDates(st);
    st.crew.push(
      Core.newCrew({ first: 'Marta', last: 'Wiśniewska', dept: T('Reżyseria'), role: T('Reżyser'), phone: '600 200 301', email: 'marta@example.com', contract: T('Umowa o dzieło'), rate: '12 000 zł / projekt', lodging: 'Tak', dietType: 'veg' }),
      Core.newCrew({ first: 'Piotr', last: 'Kowal', dept: T('Reżyseria'), role: T('II reżyser'), phone: '600 100 201', contract: T('Umowa zlecenie'), rate: '900 zł / dzień' }),
      Core.newCrew({ first: 'Ewa', last: 'Nowak', dept: T('Produkcja'), role: T('Kierownik produkcji'), phone: '600 100 200', email: 'ewa@example.com', contract: T('B2B / faktura'), rate: '1 100 zł / dzień', transport: T('Własny'), extra: [pre.id] }),
      Core.newCrew({ first: 'Tomasz', last: 'Lis', dept: T('Zdjęcia'), role: T('Operator kamery'), phone: '600 200 305', contract: T('B2B / faktura'), rate: '1 800 zł / dzień', lodging: 'Tak', notes: T('Własna kamera'), extra: [pre.id] }),
      Core.newCrew({ first: 'Robert', last: 'Iskra', dept: T('Oświetlenie'), role: T('Gaffer'), phone: '600 200 306', contract: T('Umowa zlecenie'), rate: '1 000 zł / dzień', dietType: 'fish', extra: [pre.id] }),
      Core.newCrew({ first: 'Jan', last: 'Grip', dept: 'Grip', role: 'Grip', phone: '500 333 444', contract: T('Umowa zlecenie'), rate: '600 zł / dzień', transport: T('Ciężarówka techniczna') }),
      Core.newCrew({ first: 'Kasia', last: 'Zalewska', dept: T('Dźwięk'), role: T('Dźwiękowiec'), phone: '600 200 308', contract: T('Umowa o dzieło'), rate: '1 000 zł / dzień', dietType: 'gf', dietNote: T('Celiakia – osobne naczynia') })
    );
    st.catering.extra[d1.id] = 4;
    const td = (text, due, prio, done) => ({ id: Core.uid(), text, due: due || '', prio: prio || '', done: !!done });
    st.todos = [td(T('Podpisać umowę na lokację DOM ANNY'), Core.addDays(d1.date, -3), 'high'), td(T('Zamówić wóz agregatowy na dzień 1'), Core.addDays(d1.date, -5)), td(T('Rozesłać call sheet ekipie dzień wcześniej'), Core.addDays(d1.date, -1)), td(T('Potwierdzić catering i diety'), Core.addDays(d1.date, -2)), td(T('Zebrać zgody na wizerunek statystów'), ''), td(T('Wysłać scenariusz obsadzie'), '', '', true)];
    // dane aktorów (fikcyjne)
    const anna = st.cast.find((c) => c.name === 'ANNA'), hen = st.cast.find((c) => c.name === 'HENRYK');
    if (anna) Object.assign(anna, { actor: 'Joanna Kalinowska', phone: '601 300 100', email: 'joanna@example.com', contract: T('Umowa o dzieło'), rate: '2 500 zł / dzień zdjęciowy', lodging: 'Tak', diet: 'veg', transport: T('Odbiór przez kierowcę produkcji'), notes: T('Agent: Studio Aktor, tel. 22 100 20 30') });
    if (hen) Object.assign(hen, { actor: 'Marek Wolski', phone: '601 300 101', contract: T('Umowa zlecenie'), rate: '1 800 zł / dzień zdjęciowy', dietNote: T('Uczulenie na orzechy') });
  }
  return st;
}
