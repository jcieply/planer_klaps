import { describe, expect, it } from 'vitest';
import { Core } from '../../src/domain/core';
import { describeChange } from '../../src/collab/activity';
import { Parser } from '../../src/domain/parser';
import { SAMPLE_SCRIPT } from '../../src/domain/sample';

const demo = () => {
  const st = Core.newState();
  Core.applyImport(st, Parser.fromText(SAMPLE_SCRIPT), { title: 'Test' });
  Core.autoPlan(st, { strategy: 'site', scope: 'all', separateNight: true });
  return st;
};

const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));
describe('dziennik zmian: opisy różnic', () => {
  it('zmiana pola sceny, dodanie i usunięcie', () => {
    const a = Core.normalize(demo()) as any;
    const b = clone(a);
    b.scenes[0].synopsis = 'Nowy opis';
    expect(describeChange(a, b)).toEqual([`Scena ${a.scenes[0].num}: zmieniono (opis)`]);
    const c = clone(b);
    c.scenes.pop();
    const rm = describeChange(b, c);
    expect(rm).toEqual([`Scena ${b.scenes[b.scenes.length - 1].num}: usunięto`]);
    c.shots.push(Core.newShot(c, c.scenes[0].id));
    expect(describeChange(b, c).some((x) => x.startsWith('Ujęcie') && x.endsWith('dodano'))).toBe(true);
  });
  it('brak zmian = pusty opis; limit liczby pozycji', () => {
    const a = Core.normalize(demo()) as any;
    expect(describeChange(a, clone(a))).toEqual([]);
    const b = clone(a);
    b.scenes.forEach((s: any) => { s.notes = 'x'; });
    expect(describeChange(a, b, 3).length).toBeLessThanOrEqual(3);
  });
});
