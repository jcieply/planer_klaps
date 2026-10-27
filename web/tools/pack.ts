/* Zasoby pakowane przy budowaniu (DEFLATE + base64): słownik angielski i fonty PDF.
   W aplikacji rozpakowują się dopiero wtedy, gdy są potrzebne. */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { Plugin } from 'vite';

const root = path.resolve(__dirname, '..');
const pack = (buf: Buffer) => zlib.deflateRawSync(buf, { level: 9 }).toString('base64');

/** słownik EN z src/domain/en.js (wywołania I18N.add) */
export function enDictionary() {
  const code = fs.readFileSync(path.join(root, 'src/domain/en.js'), 'utf8').replace(/^\s*import .*$/m, '');
  const en: Record<string, string> = {}, plural: Record<string, unknown> = {};
  new Function('I18N', code)({ add: (d: Record<string, string>, p: Record<string, unknown>) => { Object.assign(en, d || {}); Object.assign(plural, p || {}); } });
  return { en, plural };
}
function fonts() {
  const code = fs.readFileSync(path.join(root, 'tools/fonts.source.js'), 'utf8').replace(/export\s*\{[^}]*\};?/, '').replace(/^\s*\/\/.*$/gm, '');
  const f = new Function(code + '\nreturn KLAPS_FONTS;')() as { regular: string; bold: string };
  const r = Buffer.from(f.regular, 'base64'), b = Buffer.from(f.bold, 'base64');
  return { b64: pack(Buffer.concat([r, b])), regular: r.length, bold: b.length };
}

export function klapsPack(): Plugin {
  const ids: Record<string, () => string> = {
    'virtual:klaps-en': () => `export default ${JSON.stringify(pack(Buffer.from(JSON.stringify(enDictionary()))))};`,
    'virtual:klaps-fonts': () => `export default ${JSON.stringify(fonts())};`,
  };
  return {
    name: 'klaps-pack',
    resolveId(id) { return ids[id] ? '\0' + id : null; },
    load(id) { const k = id.startsWith('\0') ? id.slice(1) : ''; return ids[k] ? ids[k]() : null; },
    configureServer(server) { server.watcher.add(path.join(root, 'src/domain/en.js')); },
  };
}
