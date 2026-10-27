import { describe, it, expect, beforeAll } from 'vitest';
import '../../src/domain/en';
import { I18N } from '../../src/domain/i18n';
import { Core } from '../../src/domain/core';
import { Parser } from '../../src/domain/parser';
import { SAMPLE_SCRIPT } from '../../src/domain/sample';
import { Table } from '../../src/domain/table';
import { Vault } from '../../src/domain/vault';
import { Store } from '../../src/domain/store';
import { Reports } from '../../src/domain/reports';
import { ProjectFileSchema, EncryptedFileSchema } from '../../src/domain/model';

const demo = () => {
  const st = Core.newState();
  Core.applyImport(st, Parser.fromText(SAMPLE_SCRIPT), { title: 'Test' });
  Core.autoPlan(st, { strategy: 'site', scope: 'all', separateNight: true });
  return st;
};

describe('parser i plan', () => {
  it('rozpoznaje sceny i obsadę z przykładowego scenariusza', () => {
    const p = Parser.fromText(SAMPLE_SCRIPT);
    expect(p.scenes.length).toBe(18);
    expect(p.stats.cast).toBeGreaterThan(5);
  });
  it('plan automatyczny przydziela wszystkie sceny', () => {
    const st = demo();
    expect(Core.scheduleIndex(st).size).toBe(st.scenes.length);
  });
});

describe('godziny pracy i obiad', () => {
  it('liczy godziny z harmonogramu i wykrywa obiad', () => {
    const st = demo();
    const d = st.days.find((x: any) => x.kind === 'shoot')!;
    const sh = Core.syncSheet(st, d.id);
    sh.rows.unshift(Core.customRow('Zbiórka ekipy', 30));
    sh.rows.splice(2, 0, Core.customRow('Przerwa na obiad', 45, 0, '13:00'));
    const l = Core.lunchOf(st, d)!;
    expect(l.from).toBe('13:00');
    expect(l.dur).toBe(45);
    const t = Core.dayTimes(st, d)!;
    expect(t.known).toBe(true);
  });
  it('alarm przy odpoczynku krótszym niż 11 h', () => {
    const st = demo();
    const [a, b] = st.days.filter((x: any) => x.kind === 'shoot');
    Core.syncSheet(st, a.id).rows.push(Core.customRow('Noc', 0, 0, '23:30'));
    Core.syncSheet(st, b.id).crewCall = '06:00';
    const h = Core.hoursCheck(st).get(b.id)!;
    expect(h.alerts.some((x: any) => x.type === 'rest')).toBe(true);
  });
});

describe('stawki w kosztorysie', () => {
  it('rozpoznaje jednostki stawek', () => {
    expect(Core.parseRate('1 800 zł / dzień')).toEqual({ amount: 1800, unit: 'day' });
    expect(Core.parseRate('12.000,00 zł za projekt')).toEqual({ amount: 12000, unit: 'project' });
    expect(Core.parseRate('150 zł/h')).toEqual({ amount: 150, unit: 'hour' });
    expect(Core.parseRate('do ustalenia')).toBeNull();
  });
  it('stawka × dni pracy trafia do pionu Ekipa', () => {
    const st = Core.normalize(demo());
    st.crew.push(Core.newCrew({ first: 'A', last: 'B', rate: '1 000 zł / dzień' }));
    const crew = Core.budgetData(st).cats.find((c: any) => c.key === 'crew')!;
    expect(crew.est).toBe(1000 * st.days.filter((d: any) => d.kind === 'shoot').length);
  });
});

describe('import shotlisty', () => {
  it('CSV ze średnikami i cudzysłowami, mapowanie nagłówków', () => {
    const rows = Table.parseCsv('Scena;Ujęcie;Typ;Opis;Obiektyw\n1;1;Zbliżenie;"Dłoń; bilet";85 mm\n');
    const map = Table.guessMap(rows[0]);
    expect(map.scene).toBe(0); expect(map.lens).toBe(4);
    const pv = Table.preview(demo(), rows, 0, map, {});
    expect(pv.shots[0]).toMatchObject({ type: 'CU', desc: 'Dłoń; bilet', lens: '85 mm' });
  });
});

describe('szyfrowanie i zapis', () => {
  beforeAll(() => Store.useMemory());
  it('koperta AES-GCM: złe hasło odrzucone', async () => {
    const k = await Vault.create('Haslo-Testowe-1');
    const env = await Vault.seal(k, 'tajne', 'plan');
    expect(env.startsWith('KLAPS-E2E1:')).toBe(true);
    await expect(Vault.unlock('zle-haslo', env, 'plan')).rejects.toThrow();
    const k2 = await Vault.unlock('Haslo-Testowe-1', env, 'plan');
    expect(await Vault.open(k2, env, 'plan')).toBe('tajne');
  }, 30000);
  it('projekt zaszyfrowany: w zapisie tylko szyfrogram, po odblokowaniu dane wracają', async () => {
    const st = demo();
    await Store.encryptProject('p1', st, 'Plan-Zdjec-2026');
    const raw = await Store.loadRaw('p1');
    expect(raw!.plan.startsWith('KLAPS-E2E1:')).toBe(true);
    expect(raw!.plan.includes('Test')).toBe(false);
    Store.lock('p1');
    await expect(Store.load('p1')).rejects.toMatchObject({ locked: true });
    await Store.unlock('p1', 'Plan-Zdjec-2026');
    expect((await Store.load('p1'))!.meta.title).toBe('Test');
  }, 30000);
});

describe('walidacja plików (Zod)', () => {
  it('odrzuca plik, który nie jest projektem', () => {
    expect(ProjectFileSchema.safeParse({ foo: 1 }).success).toBe(false);
    expect(ProjectFileSchema.safeParse(demo()).success).toBe(true);
    expect(EncryptedFileSchema.safeParse({ klaps: 'encrypted-project', v: 1, plan: 'x', script: '', media: '' }).success).toBe(false);
  });
});

describe('raporty', () => {
  it('PDF i XLSX powstają (PL i EN)', async () => {
    const st = demo();
    const pdf = await Reports.buildPdf(st, ['calendar', 'callsheet', 'budget']);
    expect(String.fromCharCode(...pdf.slice(0, 5))).toBe('%PDF-');
    I18N.lang = 'en';
    const x = await Reports.buildXlsx(st, ['calendar', 'budget']);
    expect(x[0]).toBe(0x50);
    I18N.lang = 'pl';
  }, 30000);
});
