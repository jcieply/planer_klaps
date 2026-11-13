import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { checkKey, normalizeKey, keyHint } from '../../src/lib/license';

const require = createRequire(import.meta.url);
const node = require('../../../electron/license.js');
const { testLicense } = require('../../../test/license-fixture.js');

describe('klucz licencyjny (Android / przeglądarka)', () => {
  const t = testLicense();
  it('poprawny klucz działa, błędny jest odrzucany z powodem', async () => {
    expect((await checkKey(t.key, t.keys)).ok).toBe(true);
    expect(await checkKey('KLAPS-00000-00000-00000-00000', t.keys)).toEqual({ ok: false, reason: 'unknown' });
    expect(await checkKey('KLAPS-2026-7Q4M-PROD', t.keys)).toEqual({ ok: false, reason: 'format' });
    expect(await checkKey('  ', t.keys)).toEqual({ ok: false, reason: 'empty' });
    expect(keyHint(t.key)).toBe(t.key.slice(0, 11) + '…' + t.key.slice(-5));
  });
  it('wycofany klucz testowy z 2.7.0 i klucz spoza listy nie pasują do wbudowanej listy', async () => {
    expect((await checkKey('KLAPS-2026-7Q4M-PROD')).ok).toBe(false);
    expect((await checkKey(t.key)).ok).toBe(false);
  });
  it('ta sama normalizacja i ten sam wynik co w programie na komputer', async () => {
    for (const k of [' ' + t.key.toLowerCase().replace(/-/g, '–') + ' ', t.key.replace(/-/g, ' '), t.key.replace(/-/g, '_'), 'klaps-oil00-00000-00000-0000u', 'abc']) {
      expect(normalizeKey(k)).toBe(node.normalize(k));
      expect((await checkKey(k, t.keys)).ok).toBe(node.check(k, t.keys).ok);
    }
    expect(normalizeKey(t.key.replace(/-/g, ' '))).toBe(t.key);
  });
});
