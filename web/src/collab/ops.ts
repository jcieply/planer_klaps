/* Operacje na stanie projektu: różnica (diff) i zastosowanie (apply).
 *
 * Stan to drzewo JSON. Tablice obiektów z polem `id` są traktowane jak uporządkowane mapy (wstaw / usuń / przenieś po id),
 * dzięki czemu dwie osoby dodające różne sceny, dni czy pozycje budżetu nie nadpisują się nawzajem. Pozostałe wartości
 * (teksty, liczby, tablice liczb) są zmieniane w całości – wygrywa ostatnia zatwierdzona zmiana (jak w arkuszu).
 * `apply` jest deterministyczne i tolerancyjne: operacja na usuniętym elemencie jest po cichu pomijana, więc wszyscy
 * klienci stosując te same operacje w tej samej kolejności dostają identyczny stan. */

export type Step = string; // 'k:<klucz>' – pole obiektu, 'i:<id>' – element tablicy z id
export type Op =
  | { t: 'set'; p: Step[]; v: unknown }
  | { t: 'del'; p: Step[] }
  | { t: 'ins'; p: Step[]; v: { id: string | number }; after: string | null }
  | { t: 'rm'; p: Step[]; id: string }
  | { t: 'mv'; p: Step[]; id: string; after: string | null };

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === 'object' && x !== null && !Array.isArray(x);
const BAD = new Set(['__proto__', 'constructor', 'prototype']);
const k = (key: string): Step => 'k:' + key;
const i = (id: string): Step => 'i:' + id;
const idOf = (x: unknown): string | null => {
  if (!isObj(x)) return null;
  const id = x.id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : null;
};
/** tablica jest „kluczowana”, gdy każdy element to obiekt z unikalnym id (pusta też) */
function keyed(a: unknown[]): boolean {
  const seen = new Set<string>();
  for (const x of a) {
    const id = idOf(x);
    if (id === null || seen.has(id)) return false;
    seen.add(id);
  }
  return true;
}
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let n = 0; n < a.length; n++) if (!deepEqual(a[n], b[n])) return false;
    return true;
  }
  const ka = Object.keys(a as Obj), kb = Object.keys(b as Obj);
  if (ka.length !== kb.length) return false;
  for (const key of ka) if (!(key in (b as Obj)) || !deepEqual((a as Obj)[key], (b as Obj)[key])) return false;
  return true;
}

/* ------------------------------------------------ diff ------------------------------------------------ */
export function diff(a: unknown, b: unknown, path: Step[] = [], out: Op[] = []): Op[] {
  if (a === b) return out;
  if (isObj(a) && isObj(b)) {
    for (const key of Object.keys(a)) if (!(key in b)) out.push({ t: 'del', p: [...path, k(key)] });
    for (const key of Object.keys(b)) {
      if (!(key in a)) out.push({ t: 'set', p: [...path, k(key)], v: b[key] });
      else diff(a[key], b[key], [...path, k(key)], out);
    }
    return out;
  }
  if (Array.isArray(a) && Array.isArray(b) && keyed(a) && keyed(b)) {
    const ia = a as Obj[], ib = b as Obj[];
    const inB = new Set(ib.map((x) => String(x.id)));
    const mapA = new Map(ia.map((x) => [String(x.id), x]));
    for (const x of ia) if (!inB.has(String(x.id))) out.push({ t: 'rm', p: path, id: String(x.id) });
    const cur = ia.map((x) => String(x.id)).filter((id) => inB.has(id));
    for (let n = 0; n < ib.length; n++) {
      const id = String(ib[n].id);
      const after = n === 0 ? null : String(ib[n - 1].id);
      const at = cur.indexOf(id);
      if (at === -1) {
        out.push({ t: 'ins', p: path, v: ib[n] as { id: string | number }, after });
        cur.splice(n, 0, id);
      } else if (at !== n) {
        out.push({ t: 'mv', p: path, id, after });
        cur.splice(at, 1);
        cur.splice(n, 0, id);
      }
    }
    for (const x of ib) { const old = mapA.get(String(x.id)); if (old) diff(old, x, [...path, i(String(x.id))], out); }
    return out;
  }
  if (!deepEqual(a, b)) {
    if (path.length === 0) throw new Error('klaps:root_replace');
    out.push({ t: 'set', p: path, v: b });
  }
  return out;
}

/* ------------------------------------------------ apply ------------------------------------------------ */
function walk(node: unknown, path: Step[], n: number, fn: (x: unknown) => unknown): unknown {
  if (n === path.length) return fn(node);
  const step = path[n];
  if (step.startsWith('k:')) {
    const key = step.slice(2);
    if (BAD.has(key) || !isObj(node) || !Object.prototype.hasOwnProperty.call(node, key)) return node;
    const c = walk(node[key], path, n + 1, fn);
    return c === node[key] ? node : { ...node, [key]: c };
  }
  if (!Array.isArray(node)) return node;
  const id = step.slice(2);
  const at = node.findIndex((x) => idOf(x) === id);
  if (at === -1) return node;
  const c = walk(node[at], path, n + 1, fn);
  if (c === node[at]) return node;
  const copy = node.slice();
  copy[at] = c;
  return copy;
}
function insertAfter(arr: unknown[], item: unknown, after: string | null): unknown[] {
  const copy = arr.slice();
  if (after === null) copy.unshift(item);
  else {
    const at = copy.findIndex((x) => idOf(x) === after);
    if (at === -1) copy.push(item); else copy.splice(at + 1, 0, item);
  }
  return copy;
}
export function applyOp<T>(state: T, op: Op): T {
  try {
    if (op.t === 'set' || op.t === 'del') {
      if (op.p.length === 0) return state;
      const last = op.p[op.p.length - 1];
      if (!last.startsWith('k:')) return state;
      const key = last.slice(2);
      if (BAD.has(key)) return state;
      return walk(state, op.p.slice(0, -1), 0, (parent) => {
        if (!isObj(parent)) return parent;
        if (op.t === 'set') return parent[key] === op.v ? parent : { ...parent, [key]: op.v };
        if (!Object.prototype.hasOwnProperty.call(parent, key)) return parent;
        const { [key]: _gone, ...rest } = parent;
        void _gone;
        return rest;
      }) as T;
    }
    return walk(state, op.p, 0, (arr) => {
      if (!Array.isArray(arr)) return arr;
      if (op.t === 'rm') return arr.some((x) => idOf(x) === op.id) ? arr.filter((x) => idOf(x) !== op.id) : arr;
      if (op.t === 'ins') {
        const id = idOf(op.v);
        if (id === null) return arr;
        const at = arr.findIndex((x) => idOf(x) === id);
        if (at !== -1) { const copy = arr.slice(); copy[at] = op.v; return copy; }
        return insertAfter(arr, op.v, op.after);
      }
      const at = arr.findIndex((x) => idOf(x) === op.id);
      if (at === -1) return arr;
      const item = arr[at];
      return insertAfter(arr.filter((_, n) => n !== at), item, op.after);
    }) as T;
  } catch {
    return state;
  }
}
export function applyOps<T>(state: T, ops: readonly Op[]): T {
  let s = state;
  for (const op of ops) s = applyOp(s, op);
  return s;
}
