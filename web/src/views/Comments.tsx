/* Komentarze przy scenach i dniach oraz panel wszystkich komentarzy z wzmiankami (@Imię Nazwisko). Tylko w projektach z chmury. */
import { useEffect, useState } from 'react';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import type { Comment } from '../domain/model';
import { mutate, useProject } from '../state/project';
import { setUI, useUI } from '../state/ui';
import { useCollab } from '../collab/session';
import * as cloud from '../collab/cloud';
import { countOpen, makeComment, markSeen, refDay, refScene, seenAt, threadOf, unreadMentions } from '../collab/comments';
import { dayLabel } from '../lib/format';
import { Btn, Drawer, Icon, Seg, cx } from '../components/ui';

const fmtAt = (t: number) => { const d = new Date(t); return `${Core.fmtDM(d.toISOString().slice(0, 10))} ${d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}`; };

/** pole dodawania komentarza z przyciskami wzmianek */
export function Composer({ refKey, parent, onDone, autoFocus }: { refKey: string; parent?: string; onDone?: () => void; autoFocus?: boolean }) {
  const cc = useCollab();
  const [text, setText] = useState('');
  if (!cc.me || cc.role === 'viewer') return null;
  const me = cc.me;
  const send = () => {
    const t = text.trim(); if (!t) return;
    const c = makeComment({ by: me.id, name: me.name, ref: refKey, text: t, people: cc.people, parent });
    mutate((x) => { (x.comments = x.comments || []).push(c); });
    setText(''); onDone?.();
  };
  const others = cc.people.filter((p) => p.id !== me.id);
  return <div className="cm-new">
    <textarea className="inp" rows={parent ? 2 : 3} value={text} autoFocus={autoFocus} data-act="comment-text" aria-label={parent ? T('Odpowiedź') : T('Nowy komentarz')} placeholder={parent ? T('Odpowiedz…') : T('Napisz komentarz. Wspomnij osobę zapisem @Imię Nazwisko.')}
      onChange={(e) => setText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } }} />
    <div className="cm-row">
      {others.slice(0, 8).map((p) => <button type="button" key={p.id} className="chip cm-m" data-act="comment-mention" onClick={() => setText((v) => (v && !/\s$/.test(v) ? v + ' ' : v) + '@' + p.name + ' ')}>@{p.name}</button>)}
      <Btn sm v="primary" act="comment-send" disabled={!text.trim()} onClick={send} style={{ marginLeft: 'auto' }}>{parent ? T('Odpowiedz') : T('Dodaj komentarz')}</Btn></div></div>;
}

/** treść komentarza ze zaznaczonymi wzmiankami */
function Body({ c }: { c: Comment }) {
  const people = useCollab((s) => s.people);
  const names = people.filter((p) => c.mentions.includes(p.id)).map((p) => '@' + p.name).sort((a, b) => b.length - a.length);
  if (!names.length) return <>{c.text}</>;
  const re = new RegExp('(' + names.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'gi');
  return <>{c.text.split(re).map((part, i) => (i % 2 ? <b key={i} className="cm-at">{part}</b> : part))}</>;
}

function Item({ c, nested }: { c: Comment; nested: boolean }) {
  const cc = useCollab();
  const [reply, setReply] = useState(false);
  const canEdit = cc.role !== 'viewer';
  const mine = cc.me?.id === c.by, mayDel = mine || cc.role === 'owner';
  const person = cc.people.find((p) => p.id === c.by);
  return <div className={cx('cm', nested && 'cm-re', c.done && 'cm-done')} data-comment={c.id}>
    <div className="cm-h"><b>{person?.name || c.name || T('Ktoś')}</b><span className="muted small">{fmtAt(c.at)}</span>{c.done && <span className="chip">{T('Załatwione')}</span>}</div>
    <div className="cm-t"><Body c={c} /></div>
    {canEdit && <div className="cm-a">
      {!nested && <Btn sm v="ghost" act="comment-reply" onClick={() => setReply((v) => !v)}>{T('Odpowiedz')}</Btn>}
      {!nested && <Btn sm v="ghost" act="comment-done" onClick={() => mutate((x) => { const k = (x.comments || []).find((y) => y.id === c.id); if (k) k.done = !k.done; })}>{c.done ? T('Otwórz ponownie') : T('Oznacz jako załatwione')}</Btn>}
      {mayDel && <Btn sm v="ghost danger" act="comment-del" onClick={() => mutate((x) => { x.comments = (x.comments || []).filter((y) => y.id !== c.id && y.parent !== c.id); })}>{T('Usuń')}</Btn>}</div>}
    {reply && <Composer refKey={c.ref} parent={c.id} autoFocus onDone={() => setReply(false)} />}
  </div>;
}

/** wątek komentarzy przy scenie, dniu itp. */
export function Thread({ refKey, title }: { refKey: string; title?: string }) {
  const active = useCollab((s) => s.active);
  const st = useProject((s) => s.st)!;
  if (!active) return null;
  const list = threadOf(st, refKey);
  return <section className="cm-box" data-thread={refKey}><h4>{title || T('Komentarze')}{list.length > 0 && <span className="chip" style={{ marginLeft: 8 }}>{list.length}</span>}</h4>
    {list.map((c) => <Item key={c.id} c={c} nested={!!c.parent && list.some((x) => x.id === c.parent)} />)}
    {!list.length && <p className="muted small" style={{ margin: '0 0 8px' }}>{T('Brak komentarzy.')}</p>}
    <Composer refKey={refKey} /></section>;
}

/** licznik otwartych wątków (znaczek przy scenie, dniu) */
export function CommentDot({ refKey }: { refKey: string }) {
  const active = useCollab((s) => s.active);
  const st = useProject((s) => s.st)!;
  const n = active ? countOpen(st, refKey) : 0;
  return n ? <span className="cm-dot" title={T('Komentarze: {n}', { n })} data-comments={n}><Icon n="chat" />{n}</span> : null;
}

/** przycisk w pasku: liczba nieprzeczytanych wzmianek i otwarcie panelu */
export function CommentsButton() {
  const cc = useCollab();
  const st = useProject((s) => s.st);
  useUI((s) => s.comments);
  if (!cc.active || !cc.me || !cc.id || !st) return null;
  const n = unreadMentions(st, cc.me.id, seenAt(cc.id, cc.me.id)).length;
  const open = (st.comments || []).filter((c) => !c.parent && !c.done).length;
  return <button type="button" className="btn ghost icon cm-btn" data-act="comments-open" aria-label={T('Komentarze')} title={T('Komentarze')} onClick={() => setUI((s) => { s.comments = true; })}>
    <Icon n="chat" />{(n > 0 || open > 0) && <b className={cx('cm-badge', n > 0 && 'hot')} data-unread={n}>{n || open}</b>}</button>;
}

function refLabel(st: NonNullable<ReturnType<typeof useProject.getState>['st']>, ref: string): string {
  if (ref.startsWith('scene:')) { const s = st.scenes.find((x) => x.id === ref.slice(6)); return s ? T('Scena {n}', { n: s.num }) + (s.place ? ' · ' + s.place : '') : T('Scena (usunięta)'); }
  if (ref.startsWith('day:')) { const d = st.days.find((x) => x.id === ref.slice(4)); return d ? dayLabel(d, Core.dayNumbers(st)) : T('Dzień (usunięty)'); }
  return T('Ogólne');
}
function openRef(ref: string) {
  if (ref.startsWith('scene:')) setUI((s) => { s.comments = false; s.drawer = ref.slice(6); });
  else if (ref.startsWith('day:')) setUI((s) => { s.comments = false; s.csDay = ref.slice(4); s.tab = 'callsheet'; s.drawer = null; });
}


/** dziennik zmian: kto i co zmienił (wpisy odszyfrowane na tym komputerze) */
function ActivityLog() {
  const cc = useCollab();
  const [rows, setRows] = useState<cloud.ActivityRow[] | null>(null);
  const [err, setErr] = useState('');
  const load = async () => { if (!cc.id) return; try { setRows(await cloud.activity(cc.id)); setErr(''); } catch (e) { setErr((e as Error).message); } };
  useEffect(() => { void load(); const t = setInterval(() => void load(), 15000); return () => clearInterval(t); }, [cc.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const day = (t: number) => { const d = new Date(t); return `${Core.fmtDM(d.toISOString().slice(0, 10))}.${d.getFullYear()}`; };
  let last = '';
  return <div data-log>
    <div className="row" style={{ marginBottom: 8 }}><span className="muted small">{T('Ostatnie zmiany w projekcie. Wpisy są szyfrowane – serwer ich nie czyta.')}</span><Btn sm v="ghost" act="log-refresh" style={{ marginLeft: 'auto' }} onClick={() => void load()}>{T('Odśwież')}</Btn></div>
    {err && <div className="notice warn"><div><Icon n="warn" /></div><div>{err}</div></div>}
    {rows && !rows.length && <p className="muted">{T('Dziennik jest pusty. Zmiany pojawią się tu po chwili od zapisu.')}</p>}
    {(rows || []).map((r) => { const p = cc.people.find((x) => x.id === r.by), d = day(r.at), head = d !== last; last = d;
      return <div key={r.id}>{head && <h4 className="cm-day">{d}</h4>}
        <div className="log-row" data-log-row><span className="log-t">{new Date(r.at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span>
          <span className="log-p" style={{ borderColor: p?.color }}>{p?.avatar ? <img src={p.avatar} alt="" /> : <b style={{ background: p?.color || 'var(--ink-3)' }}>{(p?.name || '?').slice(0, 1)}</b>}</span>
          <div><b>{p?.name || T('Ktoś')}</b><ul>{r.items.map((i, k) => <li key={k}>{i}</li>)}</ul></div></div></div>; })}
  </div>;
}

export function CommentsPanel() {
  const open = useUI((s) => s.comments);
  const cc = useCollab();
  const st = useProject((s) => s.st);
  const [f, setF] = useState<'open' | 'me' | 'all'>('open');
  const [view, setView] = useState<'comments' | 'log'>('comments');
  const close = () => { if (cc.id && cc.me) markSeen(cc.id, cc.me.id); setUI((s) => { s.comments = false; }); };
  const me = cc.me?.id || '';
  const all = st?.comments || [];
  const roots = all.filter((c) => !c.parent).slice().sort((a, b) => b.at - a.at);
  const shown = roots.filter((c) => (f === 'all' ? true : f === 'me' ? c.mentions.includes(me) || all.some((r) => r.parent === c.id && r.mentions.includes(me)) : !c.done));
  return <Drawer open={open && cc.active} onClose={close} label={T('Komentarze')}>
    <div className="drawer-h"><div className="ttl">{T('Współpraca')}</div><Btn sm act="drawer-close" aria-label={T('Zamknij')} onClick={close}><Icon n="x" /></Btn></div>
    <div className="drawer-b">
      <Seg value={view} act="collab-view" label={T('Widok')} items={[['comments', T('Komentarze')], ['log', T('Dziennik zmian')]]} onChange={setView} className="cm-views" />
      {view === 'log' ? <ActivityLog /> : <>
      <Seg value={f} act="cm-filter" label={T('Filtr komentarzy')} items={[['open', T('Otwarte')], ['me', T('Wspomniano mnie')], ['all', T('Wszystkie')]]} onChange={setF} />
      {st && shown.map((c) => <div key={c.id} className="cm-card" data-ref={c.ref}>
        <button type="button" className="numlink" data-act="comment-goto" onClick={() => openRef(c.ref)}>{refLabel(st, c.ref)}</button>
        <Item c={c} nested={false} />
        {threadOf(st, c.ref).filter((x) => x.parent === c.id).map((x) => <Item key={x.id} c={x} nested />)}</div>)}
      {!shown.length && <p className="muted">{T('Brak komentarzy w tym widoku.')}</p>}
      <section className="cm-box"><h4>{T('Nowy komentarz ogólny')}</h4><Composer refKey="general" /></section></>}
    </div></Drawer>;
}
export { refDay, refScene };
