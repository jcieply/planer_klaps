const P = require('../src/parser.js');
const yes = [
  '1. WN. DOM ANI – KUCHNIA – RANEK',
  '12 PL. PARK - DZIEŃ',
  'WN. KUCHNIA - NOC',
  'INT. APARTMENT - DAY',
  'EXT. STREET – NIGHT',
  'INT./EXT. CAR - MOVING - DAY',
  'I/E. CAR - DAY',
  '3A. WN. SALON – WIECZÓR',
  'SCENA 5. WN. BIURO – DZIEŃ',
  'WNĘTRZE. KUCHNIA – DZIEŃ',
  'PLENER. LAS – ZMIERZCH',
  'ZEW. PODWÓRKO - DZIEŃ',
  'WN. / PL. TARAS - DZIEŃ',
  'WN./PL. TARAS - DZIEŃ',
  '.WYSPA - NOC',
  '7 INT. HALL - NIGHT 7',
  'Wn. kuchnia – dzień',
  '14. PL. DROGA KRAJOWA 7, KILOMETR 54 – NOC 2',
  'PL. PLAC ZAMKOWY – DZIEŃ',
  'WN. KOŚCIÓŁ, ŚWIT',
];
const no = [
  'Wnętrze mieszkania jest ciemne.',
  'PLAC ZAMKOWY JEST PUSTY.',
  'ANIA',
  'MATKA (V.O.)',
  '12',
  'Plener był piękny, ale zimny.',
  'INTERESUJĄCE, PRAWDA?',
  'EXTRA CHEESE',
  'ŚCIĘCIE DO:',
  'WNET ZNIKA.',
  'Ela mnie zaprosiła.',
  'PLUS MINUS',
];
let bad = 0;
for (const s of yes) {
  const h = P.parseHeading(s);
  console.log((h ? 'OK  ' : 'FAIL'), s.padEnd(48), h ? `#${h.num} ${h.ie} | ${h.setName} | loc=${h.loc} | ${h.tod}/${h.dn}${h.storyDay ? ' dz.' + h.storyDay : ''}` : '');
  if (!h) bad++;
}
for (const s of no) {
  const h = P.parseHeading(s);
  console.log((!h ? 'OK  ' : 'FP  '), s.padEnd(48), h ? JSON.stringify(h) : '');
  if (h) bad++;
}
console.log('problemów:', bad);
