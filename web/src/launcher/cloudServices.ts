/* Chmura jako dostawca tożsamości i źródło projektów okna startowego (rejestruje się tylko, gdy program ma wbudowany adres chmury). */
import { T } from '../domain/i18n';
import { cloudConfigured, currentUser, listProjects, signOut } from '../collab/cloud';
import { registerIdentity, registerSource, type IdentityProvider, type ProjectSource } from './services';

export const cloudIdentity: IdentityProvider = {
  id: 'cloud',
  label: () => T('Konto w chmurze'),
  capabilities: { signIn: true, signOut: true, editProfile: true },
  async current() {
    const u = await currentUser();
    return u ? { id: u.id, name: u.name || u.email, role: u.position || undefined, email: u.email, provider: 'cloud', avatar: u.avatar || undefined } : null;
  },
  signOut: () => signOut(),
};

export const cloudSource: ProjectSource = {
  id: 'cloud',
  label: () => T('Chmura'),
  capabilities: { create: true, collaborate: true, offline: true },
  visible: (a) => a?.provider === 'cloud',
  async list() {
    return (await listProjects()).map((p) => ({ id: p.id, title: p.title, updatedAt: p.updatedAt, source: 'cloud' as const, enc: true, role: p.role, locked: p.locked, shared: { owner: p.ownerName, members: p.members, online: 0 } }));
  },
};

export function installCloudServices(): void { if (cloudConfigured()) { registerIdentity(cloudIdentity); registerSource(cloudSource); } }
