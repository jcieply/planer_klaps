/* Wersja 2.1: raport dzienny, pogoda, pamięć wyników, historia wersji. */
import { describe, expect, it } from 'vitest';
import { Core } from '../../src/domain/core';
import { Store } from '../../src/domain/store';
import { Reports } from '../../src/domain/reports';
import { demoState } from '../../src/domain/demo';
import { localityOf, parseCoords, sunTimes, weatherText } from '../../src/lib/weather';
import type { ProjectState } from '../../src/domain/model';

const shootDays = (st: ProjectState) => st.days.filter((d) => d.kind === 'shoot');

describe('raport dzienny', () => {
  it('liczy nakręcone strony, status scen i nadgodziny', () => {
    const st = demoState();
    const d = shootDays(st)[0];
    const r = Core.ensureDpr(st, d.id);
    const [a, b, c] = d.sceneIds;
    r.scenes[a] = { status: 'done', eighths: null, setups: '4', note: '' };
    r.scenes[b] = { status: 'part', eighths: 1, setups: '2', note: '' };
    r.scenes[c] = { status: 'none', eighths: null, setups: '', note: '' };
    r.crewCall = '06:00'; r.crewWrap = '19:30';
    const s = Core.dprSummary(st, d);
    const sm = Core.sceneMap(st);
    expect(s.shot).toBe(sm.get(a)!.eighths + 1);
    expect(s.scenesDone).toBe(1); expect(s.scenesPart).toBe(1); expect(s.scenesNone).toBe(1);
    expect(s.setups).toBe(6);
    expect(s.actual.work).toBe(13 * 60 + 30);
    expect(s.overtime).toBe(90);
    expect(Core.shotProgress(st).doneScenes.has(a)).toBe(true);
  });
  it('przenosi sceny nienakręcone na następny dzień, a raport je zachowuje', () => {
    const st = demoState();
    const [d1, d2] = shootDays(st);
    const r = Core.ensureDpr(st, d1.id);
    const sid = d1.sceneIds[0];
    r.scenes[sid] = { status: 'none', eighths: null, setups: '', note: '' };
    expect(Core.moveUnshot(st, d1.id, '__next')).toBe(1);
    expect(d2.sceneIds[0]).toBe(sid);
    expect(d1.sceneIds.includes(sid)).toBe(false);
    const s = Core.dprSummary(st, d1);
    expect(s.rows.find((x) => x.scene.id === sid)!.moved).toBe(true);
  });
  it('rzeczywiste godziny z raportu sprawdzają odpoczynek', () => {
    const st = demoState();
    const [d1, d2] = shootDays(st);
    d2.date = Core.addDays(d1.date, 1);
    const r = Core.ensureDpr(st, d1.id);
    r.crewCall = '07:00'; r.crewWrap = '23:30';
    const h = Core.hoursCheck(st).get(d2.id)!;
    expect(h.alerts.some((x) => x.type === 'rest')).toBe(true);
    expect(Core.hoursCheck(st).get(d1.id)!.actual).toBe(true);
    // dni bez raportu (np. prelight) liczą się dalej z planu
    const pre = st.days.find((d) => d.kind === 'prelight')!;
    expect(Core.hoursCheck(st).get(pre.id)!.actual).toBe(false);
    expect(Core.hoursCheck(st).get(pre.id)!.work).toBe(480);
  });
  it('PDF i XLSX raportu', async () => {
    const st = demoState();
    const d = shootDays(st)[0];
    Core.ensureDpr(st, d.id).scenes[d.sceneIds[0]] = { status: 'done', eighths: null, setups: '3', note: 'ok' };
    const pdf = await Reports.buildPdf(st, ['dpr'], { dayId: d.id });
    expect(new TextDecoder('latin1').decode(pdf.subarray(0, 5))).toBe('%PDF-');
    const x = await Reports.buildXlsx(st, ['dpr']);
    expect(x[0]).toBe(0x50);
  });
});

describe('pogoda', () => {
  it('wschód i zachód słońca (Warszawa, 21 czerwca)', () => {
    const t = sunTimes(52.23, 21.01, '2026-06-21', 'Europe/Warsaw');
    const m = (s: string) => +s.slice(0, 2) * 60 + +s.slice(3);
    expect(Math.abs(m(t.sunrise) - (4 * 60 + 14))).toBeLessThanOrEqual(4);
    expect(Math.abs(m(t.sunset) - (21 * 60 + 1))).toBeLessThanOrEqual(4);
  });
  it('miejscowość z adresu i współrzędne', () => {
    expect(localityOf('ul. Kolejowa 1, 05-500 Zalesie')).toBe('Zalesie');
    expect(localityOf('Krakowskie Przedmieście 5\n00-068 Warszawa')).toBe('Warszawa');
    expect(parseCoords('52.23, 21.01')).toEqual({ lat: 52.23, lon: 21.01, label: '52.230, 21.010' });
    expect(parseCoords('Zakopane')).toBeNull();
  });
  it('opis prognozy', () => {
    const w = { at: 0, date: '2026-11-02', place: 'X', lat: 0, lon: 0, code: 61, tmin: 3.4, tmax: 8.6, pp: 70, psum: 2.25, wind: 22, gust: 48, sunrise: '', sunset: '', text: '' };
    expect(weatherText(w)).toBe('🌧 Deszcz, 3–9°C, opady 70% (2,3 mm), wiatr do 22 km/h (porywy 48)');
  });
});

describe('pamięć wyników', () => {
  it('zatwierdzony stan liczy się raz, zmieniany w miejscu – zawsze od nowa', () => {
    const st = demoState();
    const before = Core.memoStats.hit;
    Core.hoursCheck(st); Core.hoursCheck(st);
    expect(Core.memoStats.hit).toBe(before);
    Core.commitState(st);
    const a = Core.hoursCheck(st), b = Core.hoursCheck(st);
    expect(a).toBe(b);
    expect(Core.memoStats.hit).toBeGreaterThan(before);
    Core.releaseState(st);
    expect(Core.hoursCheck(st)).not.toBe(a);
  });
});

describe('historia wersji', () => {
  it('zapisuje, pomija niezmienione automatyczne, przywraca i szyfruje', async () => {
    Store.useMemory();
    const st = demoState();
    await Store.save('h1', st);
    expect(await Store.snapshot('h1', st, 'A', true)).not.toBeNull();
    expect(await Store.snapshot('h1', st, 'B', true)).toBeNull();
    const st2 = Core.normalize(JSON.parse(JSON.stringify(st)));
    st2.meta.title = 'Zmieniony';
    await Store.snapshot('h1', st2, 'Ręczna', false);
    const list = await Store.snapshots('h1');
    expect(list.map((x) => x.label)).toEqual(['Ręczna', 'A']);
    const back = await Store.snapshotState(list[1].id);
    expect(back.meta.title).toBe(st.meta.title);
    await Store.encryptProject('h1', st2, 'Tajne-Haslo#2026');
    const enc = await Store.snapshots('h1');
    expect(enc.every((x) => x.enc && x.title === '')).toBe(true);
    expect((await Store.snapshotState(enc[0].id)).meta.title).toBe('Zmieniony');
    await Store.remove('h1');
    expect(await Store.snapshots('h1')).toEqual([]);
  });
});
