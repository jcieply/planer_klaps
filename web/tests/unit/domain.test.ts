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
import { ProjectFileSchema, EncryptedFileSchema } from '../../src/domain/schema';

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
    expect(Core.parseRate('1 800 zł / dzień')).toEqual({ amount: 1800, unit: 'day', cur: 'PLN' });
    expect(Core.parseRate('12.000,00 zł za projekt')).toEqual({ amount: 12000, unit: 'project', cur: 'PLN' });
    expect(Core.parseRate('150 zł/h')).toEqual({ amount: 150, unit: 'hour', cur: 'PLN' })
    expect(Core.parseRate('300 € / dzień')).toEqual({ amount: 300, unit: 'day', cur: 'EUR' })
    expect(Core.parseRate('250 USD za projekt')).toEqual({ amount: 250, unit: 'project', cur: 'USD' })
    expect(Core.parseRate('800 / dzień')).toEqual({ amount: 800, unit: 'day', cur: null });
    expect(Core.parseRate('do ustalenia')).toBeNull();
  });
  it('stawka × dni pracy trafia do pionu Ekipa', () => {
    const st = Core.normalize(demo());
    st.crew.push(Core.newCrew({ first: 'A', last: 'B', rate: '1 000 zł / dzień' }));
    const crew = Core.budgetData(st).cats.find((c: any) => c.key === 'crew')!;
    expect(crew.est).toBe(1000 * st.days.filter((d: any) => d.kind === 'shoot').length);
  });
});

describe('stawka lokacji', () => {
  it('stawka dzienna × dni, w których obiekt jest w planie, trafia do pionu Lokacje', () => {
    const st = Core.normalize(demo());
    const rd = Core.reportData(st);
    const site = rd.sites.find((x: any) => x.days.length)!;
    st.sites[site.site] = Core.siteEntry({ ...st.sites[site.site], rate: '2 000 zł / dzień' });
    const cat = Core.budgetData(st).cats.find((c: any) => c.key === 'site')!;
    expect(cat.est).toBe(2000 * site.days.length);
    expect(cat.items[0].line.kind).toBe('site');
  });
});

describe('waluty', () => {
  const fx = Core.parseNbp([{ effectiveDate: '2026-10-27', rates: [{ code: 'EUR', mid: 4.25 }, { code: 'USD', mid: 3.9 }, { code: 'XXX', mid: 9 }] }])!;
  it('tabela NBP daje kursy tylko znanych walut', () => {
    expect(fx.pln).toEqual({ EUR: 4.25, USD: 3.9 });
    expect(Core.parseNbp({})).toBeNull();
  });
  it('przelicza między walutami przez złotego i zwraca null bez kursu', () => {
    const st = Core.normalize(demo()); st.budget.fx = fx;
    expect(Core.convert(st, 425, 'EUR', 'PLN')).toBeCloseTo(1806.25, 2);
    expect(Core.convert(st, 100, 'EUR', 'USD')).toBeCloseTo(108.97, 2);
    expect(Core.convert(st, 100, 'GBP', 'PLN')).toBeNull();
  });
  it('stawka w obcej walucie jest przeliczana na walutę projektu, suma ma przeliczenie na EUR i USD', () => {
    const st = Core.normalize(demo()); st.budget.fx = fx;
    const n = st.days.filter((d: any) => d.kind === 'shoot').length;
    st.crew.push(Core.newCrew({ first: 'A', last: 'B', rate: '100 € / dzień' }));
    const bd = Core.budgetData(st);
    expect(bd.cats.find((c: any) => c.key === 'crew')!.est).toBeCloseTo(100 * 4.25 * n, 1);
    expect(bd.conv.map((x: any) => x.cur)).toEqual(['EUR', 'USD']);
    expect(bd.conv[0].est).toBeCloseTo(bd.est / 4.25, 2);
    st.budget.currency = 'EUR';
    const be = Core.budgetData(st);
    expect(be.cats.find((c: any) => c.key === 'crew')!.est).toBeCloseTo(100 * n, 1);
    expect(be.conv.map((x: any) => x.cur)).toEqual(['USD']);
    expect(Core.fmtMoney(1234.5)).toBe('1 234,50 €');
    Core.setCurrency('PLN');
  });
});

describe('kalendarzówka z shotlisty', () => {
  it('dzień wypełnia się według czasów ujęć, nie stron', () => {
    const st = Core.normalize(demo());
    st.days = []; st.sheets = {};
    const sc = st.scenes.slice(0, 4);
    st.shots = []; sc.forEach((s: any) => st.shots.push(Core.newShot(st, s.id)));
    st.shots.forEach((x: any) => { x.eta = '3h'; });
    const rest = st.scenes.slice(4).map((s: any) => s.id);
    const n = Core.autoPlan(st, { strategy: 'script', scope: 'unscheduled', separateNight: false, basis: 'shots', hours: 8, move: 0 });
    // 4 sceny po 3 h przy 8 h na dzień dają co najmniej 2 dni tylko dla nich
    expect(n).toBeGreaterThanOrEqual(2);
    expect(st.days.flatMap((d: any) => d.sceneIds).length).toBe(st.scenes.length);
    expect(Core.sceneMinutes(st, sc[0], { move: 10 })).toBe(190);
    expect(Core.scenesWithoutEta(st, st.scenes.filter((s: any) => rest.includes(s.id)))).toBe(rest.length);
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

describe('plan pracy: nagłówek i harmonogram', () => {
  it('kluczowi twórcy: pola projektu, potem funkcje z ekipy', () => {
    const st = Core.normalize(demo());
    st.meta.director = ''; st.meta.dop = ''; st.meta.manager = ''; st.meta.producer = 'Prod X';
    st.crew.push(Core.newCrew({ first: 'Anna', last: 'Reż', role: 'Reżyser' }), Core.newCrew({ first: 'Jan', last: 'Zdj', role: 'Autor zdjęć' }));
    expect(Core.keyPeople(st)).toEqual({ dir: 'Anna Reż', dop: 'Jan Zdj', prod: 'Prod X' });
    st.meta.dop = 'Łukasz Żal'; st.meta.manager = 'Kierownik K';
    expect(Core.keyPeople(st)).toMatchObject({ dop: 'Łukasz Żal', prod: 'Kierownik K' });
  });
  it('opis ujęcia w harmonogramie nie zawiera typu ujęcia (zostaje w shotliście)', () => {
    const st = Core.normalize(demo());
    const d = st.days.find((x: any) => x.kind === 'shoot')!;
    const sc = st.scenes.find((s: any) => d.sceneIds.includes(s.id))!;
    st.shots = [Object.assign(Core.newShot(st, sc.id), { type: 'CU', desc: 'Dłoń na klamce' })];
    Core.setSheetMode(st, d.id, 'shots');
    const row = Core.callRows(st, d).find((r: any) => r.kind === 'shot')!;
    expect(row.desc).toBe('Dłoń na klamce');
  });
});

describe('wersje scenariusza (kolorowe strony)', () => {
  const parsedWith = (fn: (p: any) => void) => { const p = Parser.fromText(SAMPLE_SCRIPT); fn(p); return p; };
  it('kolejne kolory jak w branży, potem „podwójna”', () => {
    expect([0, 1, 2, 3].map((n) => Core.revColorAt(n).key)).toEqual(['white', 'blue', 'pink', 'yellow']);
    expect(Core.revColorAt(9).key).toBe('white2');
    expect(Core.revColor('blue2').name).toBe('Podwójna niebieska');
  });
  it('pierwszy import = biała; nowa wersja = niebieska z listą zmian i wpływem na plan', () => {
    const st = Core.normalize(demo());
    expect(st.revisions!.length).toBe(1);
    expect(st.revisions![0].color).toBe('white');
    expect(st.scenes.every((s: any) => s.rev === st.revisions![0].id && !Core.sceneRev(st, s))).toBe(true);
    const planned = st.days.find((d: any) => d.kind === 'shoot' && d.sceneIds.length >= 2)!;
    const [a, b] = planned.sceneIds.map((id: string) => st.scenes.find((s: any) => s.id === id)!);
    const p = parsedWith((p) => {
      const pa = p.scenes.find((x: any) => x.num === a.num); pa.text += '\nNOWA LINIA DIALOGU.';
      p.scenes = p.scenes.filter((x: any) => x.num !== b.num);
      p.scenes.push(Object.assign({}, p.scenes[0], { num: '99', text: 'Zupełnie nowa scena', heading: 'WN. NOWE – DZIEŃ' }));
    });
    Core.applyImport(st, p, { keep: true });
    const r = Core.revisions(st).at(-1)!;
    expect(r.color).toBe('blue');
    expect(r.changed).toEqual([a.num]);
    expect(r.added).toEqual(['99']);
    expect(r.removed).toEqual([{ num: b.num, dayId: planned.id }]);
    expect(Core.sceneRev(st, st.scenes.find((s: any) => s.num === a.num)!)!.id).toBe(r.id);
    const untouched = st.scenes.find((s: any) => s.num !== a.num && s.num !== '99')!;
    expect(Core.sceneRev(st, untouched)).toBeNull();
    const imp = Core.revisionImpact(st, r).find((x: any) => x.dayId === planned.id)!;
    expect(imp.scenes).toEqual([a.num]);
    expect(imp.removedNums).toEqual([b.num]);
    expect(st.meta.scriptVersion).toBe('Niebieska rewizja');
    Core.applyImport(st, Parser.fromText(SAMPLE_SCRIPT), { keep: true, rev: { label: 'Różowe strony' } });
    expect(Core.revisions(st).at(-1)!).toMatchObject({ color: 'pink', label: 'Różowe strony' });
  });
  it('projekt sprzed rewizji dostaje białą bazę; usunięcie rewizji wraca do poprzedniej; „od nowa” czyści historię', () => {
    const st = Core.normalize(demo());
    st.revisions = []; st.scenes.forEach((s: any) => { delete s.rev; });
    const p = parsedWith((p) => { p.scenes[0].text += ' zmiana'; });
    Core.applyImport(st, p, { keep: true });
    const list = Core.revisions(st);
    expect(list.map((r: any) => r.color)).toEqual(['white', 'blue']);
    const sc = st.scenes[0];
    expect(sc.rev).toBe(list[1].id);
    Core.removeRevision(st, list[1].id);
    expect(sc.rev).toBe(list[0].id);
    Core.applyImport(st, Parser.fromText(SAMPLE_SCRIPT), { keep: false });
    expect(Core.revisions(st).map((r: any) => r.color)).toEqual(['white']);
  });
});
