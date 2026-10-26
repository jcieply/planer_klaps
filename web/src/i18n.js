/* ===== JĘZYK: polski (źródłowy) i angielski. Klucz tłumaczenia = tekst polski. ===== */
const I18N = (() => {
  let lang = 'pl';
  const EN = {};      // 'tekst polski' -> 'English text'
  const PLURAL = {};  // 'scena' (forma pojedyncza) -> ['scene', 'scenes']
  const fill = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (v[k] != null ? v[k] : m)) : s);
  /** tłumaczy tekst; {nazwa} zastępuje wartościami z v (wartości nie są escapowane) */
  function t(s, v) {
    // klucz z kontekstem: 'Czas#pdf' (po polsku wyświetla się część przed #)
    const r = lang === 'en' && EN[s] != null ? EN[s] : String(s).replace(/#[a-z]+$/, '');
    return fill(r, v);
  }
  /** polska odmiana liczebnikowa: 1 scena, 2 sceny, 5 scen; po angielsku 1 scene, 2 scenes */
  function plural(n, one, few, many) {
    const a0 = Math.abs(n);
    if (lang === 'en') {
      const e = PLURAL[one];
      if (e) return a0 === 1 ? e[0] : e[1];
    }
    const a = a0 % 10, b = a0 % 100;
    return a0 === 1 ? one : (a >= 2 && a <= 4 && (b < 12 || b > 14)) ? few : many;
  }
  /** uruchamia fn w podanym języku (np. dokument PDF po angielsku przy polskim interfejsie) */
  function withLang(l, fn) {
    const prev = lang;
    lang = l === 'en' ? 'en' : 'pl';
    try { return fn(); } finally { lang = prev; }
  }
  return {
    t, plural, withLang, fill, EN, PLURAL,
    get lang() { return lang; },
    set lang(v) { lang = v === 'en' ? 'en' : 'pl'; },
    add(dict, plurals) { Object.assign(EN, dict || {}); Object.assign(PLURAL, plurals || {}); },
  };
})();
/** znacznik tekstu do tłumaczenia w definicjach (tłumaczony dopiero przy wyświetlaniu przez T()) */
const T_ = (s) => s;
/** tłumaczenie: T('Polski tekst {n}', { n: 3 }) */
const T = (s, v) => I18N.t(s, v);
if (typeof module !== 'undefined') module.exports = I18N;
