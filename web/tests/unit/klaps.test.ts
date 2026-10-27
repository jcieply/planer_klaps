/* Format .klaps: zapis i odczyt projektu jawnego i zaszyfrowanego, mapki jako pliki obrazów. */
import { describe, expect, it } from 'vitest';
import { Store } from '../../src/domain/store';
import { Core } from '../../src/domain/core';
import { Zip } from '../../src/domain/zip';
import { isKlaps, readKlaps } from '../../src/domain/klapsfile';
import { demoState } from '../../src/domain/demo';

const JPEG = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

describe('plik .klaps', () => {
  it('jawny projekt: zapis i odczyt z mapką', async () => {
    Store.useMemory();
    const st = demoState();
    const day = st.days.find((d) => d.kind === 'shoot')!;
    Core.addMap(st, day.id, { data: JPEG, w: 1, h: 1, name: 'mapa.jpg' });
    const bytes = await Store.exportKlaps('p1', st);
    expect(isKlaps(bytes)).toBe(true);
    const z = Zip.read(bytes);
    expect(z.names).toContain('manifest.json');
    expect(z.names.some((n: string) => /^media\/.+\.jpg$/.test(n))).toBe(true);
    const c = await readKlaps(bytes, Store.join);
    expect(c.kind).toBe('plain');
    if (c.kind !== 'plain') return;
    expect(c.manifest.title).toBe(st.meta.title);
    expect(c.st.scenes.length).toBe(st.scenes.length);
    expect(c.st.scenes[0].text).toBe(st.scenes[0].text);
    expect(Object.values(c.st.media)[0].data).toBe(JPEG);
  });
  it('zaszyfrowany projekt: w pliku tylko szyfrogram, odczyt hasłem', async () => {
    Store.useMemory();
    const st = demoState();
    await Store.encryptProject('p2', st, 'Bardzo-Tajne#2026');
    const bytes = await Store.exportKlaps('p2', st);
    const text = new TextDecoder().decode(bytes);
    expect(text.includes(st.meta.title)).toBe(false);
    const c = await readKlaps(bytes, Store.join);
    expect(c.kind).toBe('encrypted');
    if (c.kind !== 'encrypted') return;
    expect(c.manifest.title).toBeUndefined();
    const { st: back } = await Store.openEncryptedFile(c.raw, 'Bardzo-Tajne#2026');
    expect(back.meta.title).toBe(st.meta.title);
    await expect(Store.openEncryptedFile(c.raw, 'zle-haslo-123')).rejects.toBeTruthy();
  });
  it('odrzuca zwykły ZIP', async () => {
    const z = await Zip.write([{ name: 'a.txt', data: 'x' }]);
    expect(isKlaps(z)).toBe(false);
    await expect(readKlaps(z, Store.join)).rejects.toThrow();
  });
});
