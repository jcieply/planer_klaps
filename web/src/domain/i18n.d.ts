/* Tłumaczenia interfejsu: klucze to teksty polskie. */
export declare const I18N: { lang: 'pl' | 'en'; add(dict: Record<string, string>, plurals?: Record<string, unknown>): void; EN: Record<string, string>; PLURAL: Record<string, unknown>; withLang<R>(lang: string, fn: () => R): R; [k: string]: any };
export declare function T(key: string, vars?: Record<string, unknown>): string;
export declare function T_(key: string): string;
