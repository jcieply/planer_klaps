/* Zamiar wybrany w oknie startowym (otwórz / utwórz projekt) – sprawdzany w procesie głównym, bo przychodzi z okna. */
const { SAFE } = require('./store');
const SOURCES = ['local', 'cloud'];

function validate(i) {
  if (!i || typeof i !== 'object') return null;
  const source = typeof i.source === 'string' ? i.source : 'local';
  if (!SOURCES.includes(source)) return null;
  if (i.type === 'open') return typeof i.id === 'string' && SAFE.test(i.id) ? { type: 'open', source, id: i.id } : null;
  if (i.type === 'create') {
    const title = String(i.title == null ? '' : i.title).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
    return { type: 'create', source, title, template: i.template === 'demo' ? 'demo' : 'empty' };
  }
  return null;
}
function toQuery(i) {
  const q = new URLSearchParams();
  q.set('source', i.source);
  if (i.type === 'open') q.set('open', i.id); else { q.set('create', i.title); q.set('template', i.template); }
  return '?' + q.toString();
}
module.exports = { validate, toQuery, SOURCES };
