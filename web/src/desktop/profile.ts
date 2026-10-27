/* Profil zalogowanego użytkownika (aplikacja na komputer): imię i nazwisko z pierwszego uruchomienia. */
import { useEffect, useState } from 'react';
import { desktop, type DesktopProfile } from './bridge';

let cache: DesktopProfile | null | undefined;
export function useDesktopProfile(): DesktopProfile | null {
  const [p, setP] = useState<DesktopProfile | null>(cache ?? null);
  useEffect(() => {
    const d = desktop();
    if (!d || cache !== undefined) return;
    let live = true;
    d.profile.get().then((v) => { cache = v; if (live) setP(v); }, () => { cache = null; });
    return () => { live = false; };
  }, []);
  return p;
}
export const initialsOf = (name: string) => (name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '·').toUpperCase();
