import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import { checkKey, normalizeKey, keyHint } from '../../src/lib/license';

const require = createRequire(import.meta.url);
const node = require('../../../electron/license.js');

describe('klucz licencyjny (Android / przeglądarka)', () => {
  it('klucz testowy działa, błędny jest odrzucany z powodem', async () => {
    expect((await checkKey('KLAPS-2026-7Q4M-PROD')).ok).toBe(true);
    expect(await checkKey('KLAPS-2026-AAAA-PROD')).toEqual({ ok: false, reason: 'unknown' });
    expect(await checkKey('12345')).toEqual({ ok: false, reason: 'format' });
    expect(await checkKey('  ')).toEqual({ ok: false, reason: 'empty' });
    expect(keyHint('klaps-2026-7q4m-prod')).toBe('KLAPS-2026-…PROD');
  });
  it('ta sama normalizacja i ten sam skrót co w programie na komputer', async () => {
    for (const k of [' klaps–2026–7q4m–prod ', 'KLAPS 2026 7Q4M PROD', 'klaps_2026_7q4m_prod']) {
      expect(normalizeKey(k)).toBe(node.normalize(k));
      const a = await checkKey(k), b = node.check(k);
      expect(a.ok).toBe(b.ok);
      if (a.ok && b.ok) expect(a.hash).toBe(b.hash);
    }
  });
});
