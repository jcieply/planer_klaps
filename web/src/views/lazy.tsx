/* Leniwe ładowanie widoków: każda zakładka to osobny fragment kodu, wczytywany przy pierwszym otwarciu.
   Po starcie programu fragmenty są dociągane w tle (warmViews), więc przełączanie zakładek nie czeka na sieć ani dysk.
   Komponent, którego moduł jest już w pamięci, renderuje się od razu – bez migania zastępczego widoku. */
import { createElement, use, type ComponentType } from 'react';

type Loader = () => Promise<unknown>;
const loaders: Loader[] = [];

export function lazyView<P extends object>(load: () => Promise<ComponentType<P>>): ComponentType<P> & { preload: () => Promise<void> } {
  let comp: ComponentType<P> | null = null;
  let p: Promise<void> | null = null;
  let tries = 0;
  const preload = (): Promise<void> => {
    if (!p) {
      p = load().then((c) => { comp = c; }, (e) => {
        // nieudane wczytanie (np. przerwana aktualizacja plików) – kolejna próba przy następnym renderze
        p = null;
        if (++tries > 2) throw e;
        return preload();
      });
    }
    return p;
  };
  const View = (props: P) => {
    if (!comp) use(preload());
    return createElement(comp!, props);
  };
  loaders.push(preload);
  return Object.assign(View, { preload });
}

/** dociąga wszystkie widoki w tle, gdy przeglądarka jest bezczynna */
export function warmViews(): void {
  const idle = (cb: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(cb, { timeout: 1500 }) : setTimeout(cb, 200));
  let i = 0;
  const next = () => { if (i >= loaders.length) return; const l = loaders[i++]; l().catch(() => undefined).finally(() => idle(next)); };
  idle(next);
}
