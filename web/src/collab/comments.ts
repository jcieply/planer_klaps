/* Komentarze i wzmianki: zwykłe dane projektu (st.comments), więc synchronizują się i szyfrują tak samo jak reszta.
   Powiadomienia: lista „do przeczytania” i okienko systemowe, gdy ktoś wspomni Cię w komentarzu (serwer nie widzi treści). */
import type { Comment, ProjectState } from '../domain/model';
import type { Member } from './cloud';

export const refScene = (id: string) => 'scene:' + id;
export const refDay = (id: string) => 'day:' + id;

/** osoby wspomniane w tekście zapisem „@Imię Nazwisko” (dłuższe nazwy mają pierwszeństwo) */
export function parseMentions(text: string, people: Pick<Member, 'id' | 'name'>[]): string[] {
  const out = new Set<string>();
  let low = text.toLowerCase();
  // dłuższe imię najpierw; dopasowany fragment wycinamy, żeby „@Borys Lis” nie liczyło się też jako „@Borys”
  for (const p of [...people].sort((a, b) => b.name.length - a.name.length)) {
    const n = '@' + p.name.trim().toLowerCase();
    if (n.length > 1 && low.includes(n)) { out.add(p.id); low = low.split(n).join(' '); }
  }
  return [...out];
}
export function makeComment(o: { by: string; name: string; ref: string; text: string; people: Pick<Member, 'id' | 'name'>[]; parent?: string; now?: number }): Comment {
  const c: Comment = { id: crypto.randomUUID(), at: o.now ?? Date.now(), by: o.by, name: o.name, ref: o.ref, text: o.text.trim(), mentions: parseMentions(o.text, o.people).filter((id) => id !== o.by), done: false };
  if (o.parent) c.parent = o.parent;
  return c;
}
/** komentarze danego miejsca: główne wątki najpierw, odpowiedzi pod nimi, po czasie */
export function threadOf(st: ProjectState, ref: string): Comment[] {
  const all = (st.comments || []).filter((c) => c.ref === ref).slice().sort((a, b) => a.at - b.at);
  const roots = all.filter((c) => !c.parent || !all.some((x) => x.id === c.parent));
  return roots.flatMap((r) => [r, ...all.filter((x) => x.parent === r.id)]);
}
export const countOpen = (st: ProjectState, ref: string) => (st.comments || []).filter((c) => c.ref === ref && !c.parent && !c.done).length;
/** wzmianki o mnie, których jeszcze nie widziałem */
export const unreadMentions = (st: ProjectState, me: string, seen: number) => (st.comments || []).filter((c) => c.by !== me && c.mentions.includes(me) && c.at > seen && !c.done);
/** nowe komentarze wspominające mnie między dwoma stanami (do powiadomień) */
export function newMentions(prev: ProjectState | null | undefined, next: ProjectState, me: string): Comment[] {
  const had = new Set((prev?.comments || []).map((c) => c.id));
  return (next.comments || []).filter((c) => !had.has(c.id) && c.by !== me && c.mentions.includes(me));
}

const key = (pid: string, uid: string) => `klaps.cseen.${pid}.${uid}`;
export function seenAt(pid: string, uid: string): number { try { return +(localStorage.getItem(key(pid, uid)) || 0); } catch { return 0; } }
export function markSeen(pid: string, uid: string, t = Date.now()) { try { localStorage.setItem(key(pid, uid), String(t)); } catch { /* bez pamięci przeglądarki liczy się od zera */ } }
