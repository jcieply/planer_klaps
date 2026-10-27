import { describe, expect, it } from 'vitest';
import { Core } from '../../src/domain/core';
import { countOpen, makeComment, newMentions, parseMentions, refScene, threadOf, unreadMentions } from '../../src/collab/comments';

const people = [{ id: 'u1', name: 'Anna Nowak' }, { id: 'u2', name: 'Borys Lis' }, { id: 'u3', name: 'Borys' }];

describe('komentarze i wzmianki', () => {
  it('rozpoznaje wzmianki, dłuższe imię ma pierwszeństwo, wielkość liter nie ma znaczenia', () => {
    expect(parseMentions('hej @Anna Nowak i @borys lis, sprawdźcie', people).sort()).toEqual(['u1', 'u2']);
    expect(parseMentions('bez wzmianek, tylko Anna', people)).toEqual([]);
  });
  it('autor nie wspomina sam siebie; odpowiedzi trafiają pod wątek', () => {
    const st = Core.normalize({}) as any;
    const a = makeComment({ by: 'u1', name: 'Anna Nowak', ref: refScene('s1'), text: '@Anna Nowak @Borys Lis', people, now: 10 });
    expect(a.mentions).toEqual(['u2']);
    const r = makeComment({ by: 'u2', name: 'Borys Lis', ref: refScene('s1'), text: 'ok', people, parent: a.id, now: 20 });
    const other = makeComment({ by: 'u2', name: 'Borys Lis', ref: refScene('s2'), text: 'inna scena', people, now: 15 });
    st.comments.push(r, other, a);
    expect(threadOf(st, refScene('s1')).map((c: any) => c.text)).toEqual(['@Anna Nowak @Borys Lis', 'ok']);
    expect(countOpen(st, refScene('s1'))).toBe(1);
    a.done = true;
    expect(countOpen(st, refScene('s1'))).toBe(0);
  });
  it('nieprzeczytane wzmianki i nowe wzmianki między stanami', () => {
    const prev = Core.normalize({}) as any;
    const next = Core.normalize({}) as any;
    const c = makeComment({ by: 'u1', name: 'Anna', ref: 'general', text: '@Borys Lis zerknij', people, now: 100 });
    next.comments.push(c);
    expect(newMentions(prev, next, 'u2').map((x) => x.id)).toEqual([c.id]);
    expect(newMentions(prev, next, 'u1')).toEqual([]);
    expect(newMentions(next, next, 'u2')).toEqual([]);
    expect(unreadMentions(next, 'u2', 50).length).toBe(1);
    expect(unreadMentions(next, 'u2', 100).length).toBe(0);
  });
  it('normalizacja zachowuje komentarze i odrzuca śmieci', () => {
    const st = Core.normalize({ comments: [{ id: 'a', text: 'x' }, null, { text: 'bez id' }] }) as any;
    expect(st.comments.length).toBe(1);
    expect(st.comments[0]).toMatchObject({ id: 'a', ref: 'general', mentions: [], done: false });
  });
});
