/* Odczyt JSON z niezaufanego źródła (plik projektu, paczka od współpracownika): klucz "__proto__" jest pomijany,
   żeby późniejsze Object.assign nie podmieniło prototypu obiektu (prototype pollution). */
export function parseJson<T = any>(text: string): T {
  return JSON.parse(text, (k, v) => (k === '__proto__' ? undefined : v)) as T;
}
