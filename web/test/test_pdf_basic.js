global.KlapsFonts = require('../src/fonts.js');
const { Doc } = require('../src/pdf.js');
(async () => {
  const d = new Doc({ landscape: true, title: 'Ostatni autobus – kalendarz zdjęć' });
  d.addPage();
  d.rect(30, 30, 780, 24, { fill: [20, 22, 28] });
  d.text('KALENDARZ ZDJĘĆ – Zażółć gęślą jaźń', 36, 36, { font: 'bold', size: 12, color: [255, 255, 255] });
  d.rect(30, 70, 780, 20, { fill: [255, 240, 160], stroke: [120, 120, 120], lw: 0.4 });
  d.text('1. WN. DOM ANI – KUCHNIA – RANEK; ĄĆĘŁŃÓŚŹŻ ąćęłńóśźż 2/8 ½ № → •', 36, 74, { size: 9 });
  d.line(30, 100, 810, 100, { color: [0, 0, 0], lw: 0.6 });
  const lines = d.wrap('Budzik dzwoni po raz trzeci. Ania stoi przy blacie w piżamie i wpatruje się w ekran telefonu. Za oknem szary listopad. Na stole stoi nietknięta herbata, a w tle gra radio.', 'regular', 9, 200);
  lines.forEach((l, i) => d.text(l, 36, 110 + i * 11, { size: 9 }));
  d.text('Strona 1 / 1', 810, 570, { align: 'right', size: 8, color: [90, 90, 90] });
  const bytes = await d.finish();
  require('fs').writeFileSync(__dirname + '/basic.pdf', bytes);
  console.log('bytes', bytes.length);
})();
