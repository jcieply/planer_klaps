/* Każdy tekst interfejsu T('…') / T_('…') ma tłumaczenie angielskie z tymi samymi zmiennymi {x}. */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { I18N } from '../../src/domain/i18n';
import '../../src/domain/en';

const SRC = path.resolve(__dirname, '../../src');
const SKIP = new Set(['en.js', 'i18n.js', 'sample.js', 'fonts.js']);
function files(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return files(p);
    return /\.(tsx?|js)$/.test(d.name) && !d.name.endsWith('.d.ts') && !SKIP.has(d.name) ? [p] : [];
  });
}
const unq = (s: string) => s.replace(/\\'/g, "'").replace(/\\\\/g, '\\');
const ALLOWED = ['Prelight', 'Grip', 'Steadicam', 'Catering', 'Transport', 'DOOD', 'Gaffer', 'E-mail'];

describe('tłumaczenia', () => {
  const keys = new Map<string, string>(), plurals = new Set<string>();
  for (const f of files(SRC)) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bT_?\('((?:[^'\\]|\\.)*)'/g)) keys.set(unq(m[1]), path.relative(SRC, f));
    for (const m of src.matchAll(/\b(?:pl|Core\.pl|plN)\([^,()]+(?:\([^()]*\))?[^,()]*,\s*'([^']*)',\s*'([^']*)',\s*'([^']*)'\)/g)) plurals.add(m[1]);
  }
  const EN = (I18N as any).EN as Record<string, string>, PLURAL = (I18N as any).PLURAL as Record<string, unknown>;
  it('każdy klucz ma wersję angielską', () => {
    const miss = [...keys.keys()].filter((k) => EN[k] == null && !/^[A-Z0-9 \-–/().]+$/.test(k) && !ALLOWED.includes(k));
    if (process.env.I18N_DUMP) fs.writeFileSync(process.env.I18N_DUMP, JSON.stringify(miss, null, 1));
    expect(miss.map((k) => `${keys.get(k)}: ${k}`)).toEqual([]);
  });
  it('liczba mnoga ma odmianę angielską', () => {
    expect([...plurals].filter((k) => !PLURAL[k])).toEqual([]);
  });
  it('zmienne {x} zgadzają się w obu językach', () => {
    const bad = [...keys.keys()].filter((k) => EN[k] != null).filter((k) => (k.match(/\{\w+\}/g) || []).sort().join() !== (EN[k].match(/\{\w+\}/g) || []).sort().join());
    expect(bad).toEqual([]);
  });
});
