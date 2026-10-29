/* Most do aplikacji na komputer (Electron): typy i dostęp do window.klapsDesktop (electron/preload.js).
   W przeglądarce mostu nie ma – wszystkie funkcje tego pliku wtedy zwracają „brak” zamiast rzucać błędem. */

export type Source = 'local' | (string & {});
/** co użytkownik wybrał w oknie startowym */
export type LaunchIntent =
  | { type: 'open'; source: Source; id: string }
  | { type: 'create'; source: Source; title: string; template: 'empty' | 'demo' };

export interface DesktopProfile {
  v: 1;
  id: string;
  name: string;
  role: string;
  createdAt: number;
  lastOpenedAt: number;
  /** miejsce na przyszłe konto w chmurze: dziś zawsze „local” */
  account: { provider: string; email?: string };
  prefs: { showLauncher: boolean; lastProject: string | null };
}
export interface LicenseStatus { active: boolean; revoked?: boolean; id?: string; label?: string; at?: number; hint?: string }
export interface LicenseResult { ok: boolean; reason?: 'empty' | 'format' | 'unknown'; id?: string }
export interface DesktopSession { account: { id: string; name: string; provider: string } | null; source: Source; mode: 'local' | 'cloud' }

export interface KlapsDesktop {
  platform: string;
  version: string;
  pdfjsBase: string;
  windowKind: 'launcher' | 'main';
  store: {
    list(): Promise<any[]>;
    save(id: string, meta: unknown, plan: string, script: string, media: string): Promise<boolean>;
    load(id: string): Promise<{ plan: string; script: string; media: string } | null>;
    remove(id: string): Promise<boolean>;
  };
  saveFile(name: string, data: Uint8Array | string): Promise<{ canceled?: boolean; path?: string } | undefined>;
  onMenu(f: (action: string, payload?: any) => void): void;
  /** aplikacja prosi o natychmiastowy zapis (zamknięcie okna, wyjście z programu); odpowiedź = obietnica */
  onFlush(f: () => Promise<void> | void): void;
  profile: {
    get(): Promise<DesktopProfile | null>;
    set(p: { name: string; role?: string }): Promise<DesktopProfile>;
    setPrefs(p: Partial<DesktopProfile['prefs']>): Promise<DesktopProfile>;
  };
  launcher: {
    launch(intent: LaunchIntent): Promise<{ ok: boolean; error?: string }>;
    show(): Promise<void>;
    quit(): Promise<void>;
  };
  /** sekrety tego komputera (klucze projektów, sesja chmury) – szyfrowane przez system */
  secrets: { get(n: string): Promise<string | null>; set(n: string, v: string): Promise<boolean>; remove(n: string): Promise<boolean>; info(): Promise<{ secure: boolean }> };
  /** licencja programu na tym urządzeniu (brak w starszych wersjach mostu) */
  license?: { status(): Promise<LicenseStatus>; activate(key: string): Promise<LicenseResult> };
  /** okno główne zgłasza, że narysowało projekt – dopiero wtedy znika okno startowe */
  ready(): void;
  session(): Promise<DesktopSession>;
}
declare global { interface Window { klapsDesktop?: KlapsDesktop } }

export const desktop = (): KlapsDesktop | null => (typeof window !== 'undefined' && window.klapsDesktop) || null;

/** zamiar przekazany głównemu oknu w adresie (?open=ID albo ?create=Tytuł&template=demo) */
export function intentFromUrl(search: string = typeof location !== 'undefined' ? location.search : ''): LaunchIntent | null {
  const q = new URLSearchParams(search);
  const source = q.get('source') || 'local';
  const open = q.get('open');
  if (open) return { type: 'open', source, id: open };
  const create = q.get('create');
  if (create !== null) return { type: 'create', source, title: create, template: q.get('template') === 'demo' ? 'demo' : 'empty' };
  return null;
}
export function intentToQuery(i: LaunchIntent): string {
  const q = new URLSearchParams();
  q.set('source', i.source);
  if (i.type === 'open') q.set('open', i.id); else { q.set('create', i.title); q.set('template', i.template); }
  return '?' + q.toString();
}
