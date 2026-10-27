const P = require('../src/parser.js');
const fs = require('fs');
const text = fs.readFileSync(__dirname + '/../src/sample.txt', 'utf8');
const r = P.parseText(text);
console.log('title guess:', JSON.stringify(r.title), 'scenes:', r.scenes.length);
r.scenes.forEach(s => console.log(
  String(s.num).padStart(2), s.ie.padEnd(5), s.dn, (s.tod||'-').padEnd(10), P.fmtEighths(s.eighths).padEnd(5), '| loc:', s.loc.padEnd(26), '| set:', s.setName.padEnd(34), '|', s.chars.join(','), '|', s.desc.slice(0, 50)
));
console.log('cast:', P.buildCast(r.scenes).join(', '));
console.log('total eighths', r.scenes.reduce((a,s)=>a+s.eighths,0), '=', P.fmtEighths(r.scenes.reduce((a,s)=>a+s.eighths,0)));
