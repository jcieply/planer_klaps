/* Pogoda dla planu pracy: położenie z adresu lokacji (geokodowanie Open-Meteo), prognoza dnia (Open-Meteo, bez klucza API)
   oraz wschód i zachód słońca liczone lokalnie (działa także dla dat poza zasięgiem prognozy). */
import { T, T_ } from '../domain/i18n';
import { Core } from '../domain/core';
import type { Day, Geo, ProjectState, Weather } from '../domain/model';

const GEO_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FC_URL = 'https://api.open-meteo.com/v1/forecast';
export const FORECAST_DAYS = 16;

/* ---------- wschód i zachód słońca (algorytm „Almanac for Computers”, dokładność ok. 1–2 min) ---------- */
const rad = Math.PI / 180;
const norm = (v: number, m: number) => ((v % m) + m) % m;
function sunUT(lat: number, lon: number, y: number, mo: number, d: number, rising: boolean): number | null {
  const N = Math.floor((Date.UTC(y, mo - 1, d) - Date.UTC(y, 0, 0)) / 864e5);
  const lngHour = lon / 15;
  const t = N + ((rising ? 6 : 18) - lngHour) / 24;
  const M = 0.9856 * t - 3.289;
  const L = norm(M + 1.916 * Math.sin(M * rad) + 0.02 * Math.sin(2 * M * rad) + 282.634, 360);
  let RA = norm(Math.atan(0.91764 * Math.tan(L * rad)) / rad, 360);
  RA = (RA + (Math.floor(L / 90) * 90 - Math.floor(RA / 90) * 90)) / 15;
  const sinDec = 0.39782 * Math.sin(L * rad), cosDec = Math.cos(Math.asin(sinDec));
  const cosH = (Math.cos(90.833 * rad) - sinDec * Math.sin(lat * rad)) / (cosDec * Math.cos(lat * rad));
  if (cosH > 1 || cosH < -1) return null; // dzień albo noc polarna
  const H = (rising ? 360 - Math.acos(cosH) / rad : Math.acos(cosH) / rad) / 15;
  const Tm = H + RA - 0.06571 * t - 6.622;
  return norm(Tm - lngHour, 24);
}
const hhmm = (d: Date, tz?: string) => d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
/** wschód i zachód słońca jako „gg:mm” w strefie czasowej urządzenia (albo podanej) */
export function sunTimes(lat: number, lon: number, iso: string, tz?: string): { sunrise: string; sunset: string } {
  const [y, mo, d] = iso.split('-').map(Number);
  const f = (rising: boolean) => { const ut = sunUT(lat, lon, y, mo, d, rising); return ut == null ? '' : hhmm(new Date(Date.UTC(y, mo - 1, d) + ut * 3600e3), tz); };
  return { sunrise: f(true), sunset: f(false) };
}

/* ---------- opisy pogody (kody WMO) ---------- */
const WMO: [number[], string, string][] = [
  [[0], T_('Bezchmurnie'), '☀'], [[1], T_('Przeważnie słonecznie'), '🌤'], [[2], T_('Częściowe zachmurzenie'), '⛅'], [[3], T_('Pochmurno'), '☁'],
  [[45, 48], T_('Mgła'), '🌫'], [[51, 53, 55], T_('Mżawka'), '🌦'], [[56, 57], T_('Marznąca mżawka'), '🌧'],
  [[61, 63], T_('Deszcz'), '🌧'], [[65], T_('Ulewny deszcz'), '🌧'], [[66, 67], T_('Marznący deszcz'), '🌧'],
  [[71, 73], T_('Śnieg'), '🌨'], [[75, 77], T_('Intensywny śnieg'), '❄'], [[80, 81], T_('Przelotne opady deszczu'), '🌦'], [[82], T_('Gwałtowne ulewy'), '⛈'],
  [[85, 86], T_('Przelotne opady śniegu'), '🌨'], [[95], T_('Burza'), '⛈'], [[96, 99], T_('Burza z gradem'), '⛈'],
];
export function wmo(code: number | null): { label: string; icon: string } {
  const r = code == null ? null : WMO.find((x) => x[0].includes(code));
  return r ? { label: T(r[1]), icon: r[2] } : { label: '', icon: '' };
}
/** tekst do planu pracy, np. „⛅ Częściowe zachmurzenie, 6–11°C, opady 40% (1,2 mm), wiatr do 25 km/h (porywy 45)” */
export function weatherText(w: Weather): string {
  const o = wmo(w.code), n = (x: number) => String(Math.round(x));
  const parts = [o.icon ? `${o.icon} ${o.label}` : o.label];
  if (w.tmin != null && w.tmax != null) parts.push(`${n(w.tmin)}–${n(w.tmax)}°C`);
  if (w.pp != null) parts.push(T('opady {p}%', { p: n(w.pp) }) + (w.psum ? ` (${String(Math.round(w.psum * 10) / 10).replace('.', ',')} mm)` : ''));
  if (w.wind != null) parts.push(T('wiatr do {v} km/h', { v: n(w.wind) }) + (w.gust != null && w.gust > w.wind + 10 ? ' ' + T('(porywy {v})', { v: n(w.gust) }) : ''));
  return parts.filter(Boolean).join(', ');
}

/* ---------- miejsce prognozy ---------- */
/** miejscowość z adresu „ul. Kolejowa 1, 05-500 Zalesie” → „Zalesie” */
export function localityOf(address: string): string {
  const parts = String(address || '').split(/[,\n]/).map((x) => x.trim()).filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i].replace(/\b\d{2}-\d{3}\b/, '').replace(/^(ul\.|al\.|pl\.|os\.)\s.*$/i, '').trim();
    if (p && !/\d/.test(p) && !/^(polska|poland)$/i.test(p)) return p;
  }
  return '';
}
/** współrzędne wpisane ręcznie, np. „52.23, 21.01” */
export function parseCoords(s: string): Geo | null {
  const m = /^\s*(-?\d{1,2}(?:[.,]\d+)?)\s*[,; ]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*$/.exec(String(s || ''));
  if (!m) return null;
  const lat = +m[1].replace(',', '.'), lon = +m[2].replace(',', '.');
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat, lon, label: `${lat.toFixed(3)}, ${lon.toFixed(3)}` } : null;
}
export interface PlaceRef { site: string; query: string; geo: Geo | null }
/** skąd brać pogodę dla dnia: pierwsza lokacja dnia z adresem, a gdy jej brak – miejscowość bazy produkcji */
export function placeFor(st: ProjectState, day: Day): PlaceRef | null {
  const sites = Core.sheetScenes(st, day).map((s) => s.site || s.place).filter(Boolean);
  if (day.kind !== 'shoot' && day.site) sites.unshift(day.site);
  for (const k of [...new Set(sites)]) {
    const o = st.sites[k];
    if (!o) continue;
    if (o.geo) return { site: k, query: o.geoQuery || '', geo: o.geo };
    const q = (o.geoQuery || '').trim() || localityOf(o.address) || '';
    if (q) return { site: k, query: q, geo: parseCoords(q) };
  }
  const base = (st.meta.baseCity || '').trim();
  return base ? { site: '', query: base, geo: parseCoords(base) } : null;
}

/* ---------- sieć ---------- */
async function getJson(url: string): Promise<any> {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } catch (e: any) {
    throw new Error(T('Nie udało się połączyć z serwisem pogody (open-meteo.com). Sprawdź połączenie z internetem.') + (e && e.message && !/abort/i.test(e.message) ? ` (${e.message})` : ''));
  } finally { clearTimeout(t); }
}
export async function geocode(query: string, lang = 'pl'): Promise<Geo> {
  const coords = parseCoords(query);
  if (coords) return coords;
  const d = await getJson(`${GEO_URL}?name=${encodeURIComponent(query)}&count=1&language=${lang}&format=json`);
  const r = d && d.results && d.results[0];
  if (!r) throw new Error(T('Nie znaleziono miejscowości „{q}”. Wpisz w szczegółach lokacji miejscowość albo współrzędne (np. 52.23, 21.01).', { q: query }));
  return { lat: r.latitude, lon: r.longitude, label: [r.name, r.admin1, r.country_code].filter(Boolean).join(', ') };
}
/** dni od dziś (ujemne – przeszłość) */
export const daysFromToday = (iso: string) => Core.dayIndex(iso) - Core.dayIndex(Core.todayISO());
export async function forecast(geo: Geo, iso: string): Promise<Weather> {
  const sun = sunTimes(geo.lat, geo.lon, iso);
  const base: Weather = { at: Date.now(), date: iso, place: geo.label, lat: geo.lat, lon: geo.lon, code: null, tmin: null, tmax: null, pp: null, psum: null, wind: null, gust: null, sunrise: sun.sunrise, sunset: sun.sunset, text: '' };
  const ahead = daysFromToday(iso);
  if (ahead > FORECAST_DAYS - 1 || ahead < -60) return base; // poza zasięgiem prognozy – tylko słońce
  const q = `latitude=${geo.lat}&longitude=${geo.lon}&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,sunrise,sunset&timezone=auto&start_date=${iso}&end_date=${iso}`;
  const d = await getJson(`${FC_URL}?${q}`);
  const v = (k: string) => (d && d.daily && Array.isArray(d.daily[k]) && d.daily[k][0] != null ? d.daily[k][0] : null);
  const time = (s: string | null) => (s && /T(\d\d:\d\d)/.test(s) ? /T(\d\d:\d\d)/.exec(s)![1] : '');
  const w: Weather = { ...base, code: v('weather_code'), tmin: v('temperature_2m_min'), tmax: v('temperature_2m_max'), pp: v('precipitation_probability_max'), psum: v('precipitation_sum'), wind: v('wind_speed_10m_max'), gust: v('wind_gusts_10m_max'), sunrise: time(v('sunrise')) || sun.sunrise, sunset: time(v('sunset')) || sun.sunset };
  w.text = weatherText(w);
  return w;
}
