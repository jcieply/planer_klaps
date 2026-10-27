/* Usługi okna startowego. To jest miejsce, w którym dopisuje się logowanie i chmurę:
   – IdentityProvider  = skąd wiemy, kim jest użytkownik (dziś: profil lokalny na tym komputerze),
   – ProjectSource     = skąd bierzemy listę projektów (dziś: folder na tym komputerze).
   Nowy dostawca rejestruje się jednym wywołaniem (registerIdentity / registerSource) i okno startowe samo
   pokaże przycisk logowania, zakładkę „Chmura”, znaczniki „współdzielony” itd. – bez zmian w interfejsie.
   Opis kroków: docs/LAUNCHER.md. */
import { T } from '../domain/i18n';
import { desktop, type DesktopProfile, type LaunchIntent, type Source } from '../desktop/bridge';
import type { ProjectMeta } from '../domain/model';

export interface Account { id: string; name: string; role?: string; email?: string; provider: string; avatar?: string }

export interface IdentityProvider {
  id: string;
  /** nazwa pokazywana pod imieniem, np. „Konto lokalne” */
  label(): string;
  capabilities: { signIn: boolean; signOut: boolean; editProfile: boolean };
  current(): Promise<Account | null>;
  /** edycja profilu (imię, stanowisko) – dla konta lokalnego i jako pierwszy krok konfiguracji */
  setProfile?(p: { name: string; role?: string }): Promise<Account>;
  /** logowanie (chmura): zwraca konto albo rzuca błąd z czytelnym komunikatem */
  signIn?(credentials?: unknown): Promise<Account>;
  signOut?(): Promise<void>;
}

export interface ProjectEntry extends Pick<ProjectMeta, 'id' | 'title' | 'updatedAt' | 'scenes' | 'days' | 'enc' | 'demo'> {
  source: Source;
  /** projekt współdzielony (chmura): właściciel i liczba osób, które mają go teraz otwarty */
  shared?: { owner: string; members: number; online: number };
  /** moja rola w projekcie współdzielonym; `locked` = brak klucza na tym komputerze (trzeba wpisać kod zaproszenia) */
  role?: 'owner' | 'editor' | 'viewer';
  locked?: boolean;
}

export interface ProjectSource {
  id: Source;
  label(): string;
  capabilities: { create: boolean; collaborate: boolean; offline: boolean };
  /** czy źródło ma być widoczne dla tego konta (np. chmura dopiero po zalogowaniu) */
  visible(account: Account | null): boolean;
  list(account: Account | null): Promise<ProjectEntry[]>;
}

/* ---------- rejestr ---------- */
const identities = new Map<string, IdentityProvider>();
const sources = new Map<string, ProjectSource>();
export function registerIdentity(p: IdentityProvider) { identities.set(p.id, p); }
export function registerSource(s: ProjectSource) { sources.set(s.id, s); }
export const allIdentities = () => [...identities.values()];
export const allSources = () => [...sources.values()];
export const getSource = (id: string) => sources.get(id) || null;
/** dostawca tożsamości: pierwszy, który zna zalogowanego użytkownika; lokalny jest zawsze ostatnią deską ratunku */
export async function resolveAccount(): Promise<{ account: Account | null; provider: IdentityProvider | null }> {
  for (const p of identities.values()) {
    if (p.id === 'local') continue;
    const a = await p.current().catch(() => null);
    if (a) return { account: a, provider: p };
  }
  const local = identities.get('local') || null;
  return { account: local ? await local.current().catch(() => null) : null, provider: local };
}

/* ---------- dostawcy lokalni (aplikacja na komputer) ---------- */
const toAccount = (p: DesktopProfile): Account => ({ id: p.id, name: p.name, role: p.role || undefined, email: p.account?.email, provider: 'local' });

export const localIdentity: IdentityProvider = {
  id: 'local',
  label: () => T('Konto lokalne'),
  capabilities: { signIn: false, signOut: false, editProfile: true },
  async current() { const d = desktop(); const p = d ? await d.profile.get() : null; return p ? toAccount(p) : null; },
  async setProfile(p) {
    const d = desktop(); if (!d) throw new Error(T('Profil można zapisać tylko w aplikacji na komputer.'));
    return toAccount(await d.profile.set(p));
  },
};

export const localSource: ProjectSource = {
  id: 'local',
  label: () => T('Ten komputer'),
  capabilities: { create: true, collaborate: false, offline: true },
  visible: () => true,
  async list() {
    const d = desktop(); if (!d) return [];
    const rows = (await d.store.list()) as ProjectMeta[];
    return rows.filter((m) => m && m.id).map((m) => ({ id: m.id, title: m.title, updatedAt: m.updatedAt || 0, scenes: m.scenes ?? null, days: m.days ?? null, enc: !!m.enc, demo: !!m.demo, source: 'local' as const }));
  },
};

export function installDefaultServices() { registerIdentity(localIdentity); registerSource(localSource); }

/* ---------- uruchomienie wybranego projektu ---------- */
export async function launch(intent: LaunchIntent): Promise<void> {
  const d = desktop(); if (!d) throw new Error(T('To okno działa tylko w aplikacji na komputer.'));
  const r = await d.launcher.launch(intent);
  if (!r.ok) throw new Error(r.error || T('Nie udało się otworzyć projektu.'));
}
