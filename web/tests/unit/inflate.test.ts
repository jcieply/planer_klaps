/* Dekompresja w JS zgodna z zlib (bloki stałe, dynamiczne i bez kompresji). */
import { describe, expect, it } from 'vitest';
import zlib from 'node:zlib';
import fs from 'node:fs';
import { inflateRawSync } from '../../src/lib/inflate';

describe('inflate', () => {
  const cases: [string, Uint8Array][] = [
    ['tekst', new TextEncoder().encode('Zażółć gęślą jaźń. '.repeat(500))],
    ['krótki', new TextEncoder().encode('abc')],
    ['losowe', Uint8Array.from({ length: 70000 }, (_, i) => (i * 2654435761) >>> 24)],
    ['plik', new Uint8Array(fs.readFileSync(__dirname + '/../../src/domain/en.js'))],
  ];
  for (const [name, data] of cases) for (const level of [0, 1, 9]) {
    it(`${name}, poziom ${level}`, () => {
      const z = new Uint8Array(zlib.deflateRawSync(data, { level }));
      expect(Buffer.from(inflateRawSync(z)).equals(Buffer.from(data))).toBe(true);
    });
  }
});
