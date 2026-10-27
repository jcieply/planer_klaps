/* Powłoka aplikacji: menu boczne (zwijane w zakładkach roboczych), pasek górny, dolne zakładki na telefonie, komunikaty. */
import { CommentsButton } from './Comments';
import { desktop } from '../desktop/bridge';
import { initialsOf, useDesktopProfile } from '../desktop/profile';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, m as motion } from 'motion/react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { T, T_ } from '../domain/i18n';
import { Core } from '../domain/core';
import { Store } from '../domain/store';
import { Sync } from '../domain/sync';
import { useProject, undo, redo } from '../state/project';
import { goTab, setUI, useUI, type Tab } from '../state/ui';
import { isDark, usePrefs } from '../state/prefs';
import { lockCurrent, switchProject } from '../state/actions';
import { sitesList } from '../lib/format';
import { BottomSheet, Btn, Icon, Tip, cx } from '../components/ui';
import type { IconName } from '../lib/icons';
import { useStore } from 'zustand';
import { useCollab } from '../collab/session';
import type { ProjectMeta } from '../domain/model';

export const NAV: [Tab, string, IconName, string][] = [
  ['home', T_('Pulpit'), 'home', ''],
  ['import', T_('Scenariusz'), 'script', T_('Przygotowanie')], ['board', T_('Rozpiska scen'), 'strips', T_('Przygotowanie')], ['schedule', T_('Kalendarzówka'), 'cal', T_('Przygotowanie')], ['shotlist', T_('Shotlista'), 'cam', T_('Przygotowanie')], ['dood', 'DOOD', 'grid', T_('Przygotowanie')],
  ['callsheet', T_('Plan pracy'), 'sheet', T_('Produkcja')], ['dpr', T_('Raport dzienny'), 'report', T_('Produkcja')], ['cast', T_('Obsada'), 'person', T_('Produkcja')], ['crew', T_('Ekipa'), 'people', T_('Produkcja')], ['sites', T_('Lokacje'), 'mapPin', T_('Produkcja')], ['transport', T_('Transport'), 'truck', T_('Produkcja')], ['budget', T_('Kosztorys'), 'wallet', T_('Produkcja')],
  ['export', T_('Eksport'), 'export', T_('Dokumenty')],
];
const BOTTOM: [Tab, string, IconName][] = [['home', T_('Pulpit'), 'home'], ['schedule', T_('Kalendarz'), 'cal'], ['callsheet', T_('Plan pracy'), 'sheet'], ['crew', T_('Ekipa'), 'people']];

function useCounts() {
  const st = useProject((s) => s.st)!;
  return useMemo(() => ({
    board: st.scenes.length, schedule: st.days.filter((d) => d.kind === 'shoot').length, cast: st.cast.length, sites: sitesList(st).length, transport: st.transport.trips.length,
    budget: Core.budgetData(st).cats.reduce((a: number, c: any) => a + c.items.length, 0), crew: st.crew.length, shotlist: st.shots.length, home: (st.todos || []).filter((x) => !x.done).length || null,
  } as Record<string, number | null>), [st]);
}

/** status zapisu i synchronizacji */
export function SaveBadge() {
  const save = useProject((s) => s.save);
  const cc = useCollab();
  if (cc.active) {
    const m: [string, string] = cc.status === 'offline' ? ['is-mem', cc.pending ? T('Offline · {n} zmian czeka', { n: cc.pending }) : T('Offline')] : cc.status === 'readonly' ? ['', T('Tylko podgląd')] : cc.pending ? ['is-busy', T('Wysyłam…')] : ['', T('Zsynchronizowano')];
    return <span id="save-badge" className={cx('save', m[0])} title={T('Projekt w chmurze – zmiany trafiają do zespołu na żywo')}><i />{m[1]}</span>;
  }
  const map: Record<string, [string, string]> = { saved: ['', T('Zapisano')], busy: ['is-busy', T('Zapisuję…')], err: ['is-err', T('Błąd zapisu')], mem: ['is-mem', T('Tylko w tej sesji')] };
  const m = map[save] || map.saved;
  return <span id="save-badge" className={cx('save', m[0])} title={save === 'mem' ? T('Ta przeglądarka nie zachowuje danych. Użyj „Zapisz projekt (.json)” w zakładce Eksport.') : ''}><i />{m[1]}</span>;
}
export function useSyncStatus() {
  const [, force] = useState(0);
  useEffect(() => Sync.onChange(() => force((x) => x + 1)), []);
  return Sync.status;
}
function SyncBadge() {
  const st = useSyncStatus();
  if (!(Sync.available() && Sync.loggedIn())) return null;
  const hm = st.at ? new Date(st.at).toTimeString().slice(0, 5) : '';
  const map: Record<string, [string, string]> = { busy: ['is-busy', T('Synchronizuję…')], idle: ['', hm ? T('Zsynchronizowano {t}', { t: hm }) : T('Synchronizacja włączona')], error: ['is-err', T('Błąd synchronizacji')], off: ['is-mem', T('Synchronizacja wyłączona')] };
  const m = map[st.state] || map.off;
  return <button id="sync-badge" type="button" className={cx('save sync', m[0])} data-act="sync-now" title={st.state === 'error' ? st.error : ''} onClick={() => Sync.syncAll()}><i />{m[1]}</button>;
}

function ProjectSelect({ id, label }: { id: string; label?: boolean }) {
  const { projects, pid, st } = useProject();
  const list: ProjectMeta[] = projects.some((p) => p.id === pid) ? projects : [{ id: pid!, title: st ? st.meta.title : '', updatedAt: 0, demo: st?.demo } as ProjectMeta].concat(projects);
  const locale = usePrefs((p) => p.lang) === 'en' ? 'en-GB' : 'pl-PL';
  return <>
    {label && <label className="lbl" htmlFor={id}>{T('Projekt')}</label>}
    <select id={id} className="inp" value={pid || ''} data-act-change="proj-switch" aria-label={T('Projekt')} onChange={(e) => { void switchProject(e.target.value); }}>
      {list.map((p) => <option key={p.id} value={p.id}>{(p.id === pid && st ? st.meta.title : p.title) || (p.enc ? T('Zaszyfrowany projekt') + (p.updatedAt ? ' · ' + new Date(p.updatedAt).toLocaleDateString(locale) : '') : T('Bez tytułu'))}</option>)}
      <option value="__new">{T('+ Nowy projekt')}</option>
    </select>
  </>;
}

function Side() {
  const tab = useUI((s) => s.tab);
  const st = useProject((s) => s.st)!, pid = useProject((s) => s.pid)!;
  useProject((s) => s.projects); // znacznik E2E po zmianie szyfrowania
  const sidePin = usePrefs((p) => p.sidePin), setPrefs = usePrefs((p) => p.setPrefs);
  const cnt = useCounts();
  const me0 = useDesktopProfile();
  const cc = useCollab();
  const me = cc.active && cc.me ? { name: cc.me.name || cc.me.email, role: cc.me.position, avatar: cc.me.avatar } : me0;
  const rail = tab !== 'home' && !sidePin;
  const enc = Store.isEncrypted(pid);
  const initials = (st.meta.title || T('Bez tytułu')).split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
  let grp: string | null = null;
  const items: ReactNode[] = [];
  NAV.forEach(([k, l, ic, g]) => {
    if (g !== grp) { grp = g; if (g) items.push(<div key={'g' + g} className="nav-g"><span className="fade">{T(g)}</span></div>); }
    items.push(<button key={k} type="button" className="nav-i" data-act="tab" data-tab={k} aria-current={tab === k ? 'page' : undefined} onClick={(e) => { if (e.detail) e.currentTarget.blur(); goTab(k); window.scrollTo(0, 0); }}>
      <Icon n={ic} /><span className="fade nav-t">{T(l)}</span>{cnt[k] != null && <span className="cnt fade">{cnt[k]}</span>}
    </button>);
  });
  return <aside className={cx('side', rail && 'rail')} aria-label={T('Moduły projektu')}><div className="side-in">
    <div className="side-brand"><Icon n="clap" /><span className="fade">Klaps</span><small className="fade">{T('Planer')}</small></div>
    {desktop() ? <div className="side-proj side-user"><span className="side-pj" aria-hidden="true">{initialsOf(me?.name || '')}</span><div className="fade side-pf">
      <div className="who" data-id="who">{(me as { avatar?: string } | null)?.avatar ? <img className="who-av img" src={(me as { avatar?: string }).avatar} alt="" /> : <span className="who-av" aria-hidden="true">{initialsOf(me?.name || '')}</span>}
        <span className="who-t"><small>{T('Zalogowano jako')}</small><b>{me ? me.name : '…'}</b><em>{[me?.role, cc.active ? T('Konto w chmurze') : T('Konto lokalne')].filter(Boolean).join(' · ')}</em></span></div>
      <div className="side-tags">{st.demo && <span className="tag" title={T('Projekt demonstracyjny z przykładowym scenariuszem')}>{T('Przykład')}</span>}{enc && <button type="button" className="tag tag-enc" data-act="sec-open" title={T('Projekt zaszyfrowany end-to-end')} onClick={() => setUI((s) => { s.settings = true; })}><Icon n="shield" /> E2E</button>}</div></div></div>
    : <div className="side-proj"><span className="side-pj" aria-hidden="true">{initials}</span><div className="fade side-pf"><ProjectSelect id="proj-sel" label />
      <div className="side-tags">{st.demo && <span className="tag" title={T('Projekt demonstracyjny z przykładowym scenariuszem')}>{T('Przykład')}</span>}{enc && <button type="button" className="tag tag-enc" data-act="sec-open" title={T('Projekt zaszyfrowany end-to-end')} onClick={() => setUI((s) => { s.settings = true; })}><Icon n="shield" /> E2E</button>}</div></div></div>}
    <nav className="side-nav" aria-label={T('Widoki')}>{items}</nav>
    <div className="side-foot"><div className="side-st"><SaveBadge /><SyncBadge /></div>
      <button type="button" className="side-pin" data-act="side-pin" aria-pressed={sidePin} title={sidePin ? T('Zwijaj menu w zakładkach roboczych') : T('Przypnij rozwinięte menu')} aria-label={sidePin ? T('Zwijaj menu w zakładkach roboczych') : T('Przypnij rozwinięte menu')} onClick={() => setPrefs({ sidePin: !sidePin })}><Icon n={sidePin ? 'unpin' : 'pinSide'} /></button></div>
  </div></aside>;
}

const TAB_NAME = Object.fromEntries(NAV.map(([k, l]) => [k, l])) as Record<string, string>;
/** osoby, które mają teraz otwarty ten sam projekt (obecność na żywo) */
function CollabBar() {
  const cc = useCollab();
  if (!cc.active) return null;
  const roleTxt = cc.role === 'viewer' ? T('Podgląd') : cc.role === 'owner' ? T('Właściciel') : T('Edytor');
  return <div className="collab" data-id="collab" role="group" aria-label={T('Osoby w projekcie')}>
    {cc.role === 'viewer' && <span className="collab-ro" title={T('Masz rolę „Podgląd” – nie możesz zmieniać projektu.')}>{T('Tylko podgląd')}</span>}
    <span className="collab-st" data-st={cc.status} title={cc.status === 'offline' ? T('Brak połączenia – zmiany zapisują się lokalnie i wyślą się po powrocie internetu.') : T('Połączono · Twoja rola: {r}', { r: roleTxt })} />
    <span className="collab-av">{cc.peers.slice(0, 6).map((p) => <Tip key={p.id} label={`${p.name}${p.me ? ' (' + T('Ty') + ')' : ''}${p.position ? ' · ' + p.position : ''}${p.tab && TAB_NAME[p.tab] ? ' — ' + T(TAB_NAME[p.tab]) : ''}`}>
      <span className="collab-p" data-user={p.id} style={{ borderColor: p.color }}>{p.avatar ? <img src={p.avatar} alt="" /> : <b style={{ background: p.color }}>{initialsOf(p.name)}</b>}</span></Tip>)}
      {cc.peers.length > 6 && <span className="collab-more">+{cc.peers.length - 6}</span>}</span>
    <CommentsButton />
  </div>;
}

function Topbar() {
  const tab = useUI((s) => s.tab);
  const st = useProject((s) => s.st)!, pid = useProject((s) => s.pid)!;
  const { lang, theme, setPrefs } = usePrefs();
  useProject((s) => s.projects);
  const temporal = useStore(useProject.temporal);
  const dark = isDark(theme);
  const cur = NAV.find((x) => x[0] === tab);
  const enc = Store.isEncrypted(pid);
  const cc = useCollab();
  const canUndo = cc.active ? cc.canUndo : temporal.pastStates.length > 0, canRedo = cc.active ? cc.canRedo : temporal.futureStates.length > 0;
  return <header className="topbar"><div className="topbar-in gut">
    <div className="m-brand"><Icon n="clap" /></div>
    <div className="crumb"><span className="crumb-p">{st.meta.title || T('Bez tytułu')}</span><span className="crumb-s">/</span><b>{cur ? T(cur[1]) : ''}</b></div>
    {!desktop() && <div className="proj m-only"><ProjectSelect id="proj-sel-m" /></div>}
    <div className="actions">
      <CollabBar />
      <div className="undo-g">
        <Tip label={T('Cofnij') + ' (Ctrl+Z)'}><Btn v="ghost" className="icon" act="undo" aria-label={T('Cofnij')} disabled={!canUndo} onClick={() => undo()}><Icon n="undo" /></Btn></Tip>
        <Tip label={T('Ponów') + ' (Ctrl+Shift+Z)'}><Btn v="ghost" className="icon" act="redo" aria-label={T('Ponów')} disabled={!canRedo} onClick={() => redo()}><Icon n="redo" /></Btn></Tip>
      </div>
      <Tip label={T('Historia wersji')}><Btn v="ghost" className="icon" act="history-open" aria-label={T('Historia wersji')} onClick={() => setUI((s) => { s.history = true; s.more = false; })}><Icon n="history" /></Btn></Tip>
      {enc && <Tip label={T('Zablokuj projekt')}><Btn v="ghost" className="icon" act="sec-lock" aria-label={T('Zablokuj projekt')} onClick={() => { void lockCurrent(); }}><Icon n="lock" /></Btn></Tip>}
      <Tip label={T('Zmień język interfejsu')}><Btn v="ghost" className="icon" act="lang-toggle" aria-label={T('Zmień język interfejsu')} onClick={() => setPrefs({ lang: lang === 'en' ? 'pl' : 'en' })}><b className="lang-b">{lang === 'en' ? 'EN' : 'PL'}</b></Btn></Tip>
      <Tip label={dark ? T('Przełącz na jasny motyw') : T('Przełącz na ciemny motyw')}><Btn v="ghost" className="icon" act="theme-toggle" aria-label={dark ? T('Przełącz na jasny motyw') : T('Przełącz na ciemny motyw')} onClick={() => setPrefs({ theme: dark ? 'light' : 'dark' })}><Icon n={dark ? 'sun' : 'moon'} /></Btn></Tip>
      <Tip label={T('Ustawienia')}><Btn v="ghost" className="icon" act="settings-open" aria-label={T('Ustawienia')} onClick={() => setUI((s) => { s.settings = true; s.confirmDel = false; s.more = false; })}><Icon n="cog" /></Btn></Tip>
      <Btn v="primary" act="tab" data-tab="export" icon="dl" onClick={() => goTab('export')}><span className="lbl-d">{T('Eksport')}</span></Btn>
    </div>
  </div></header>;
}

function BottomNav() {
  const tab = useUI((s) => s.tab), more = useUI((s) => s.more);
  const cnt = useCounts();
  const inMore = !BOTTOM.some(([k]) => k === tab);
  return <>
    <nav className="bnav" aria-label={T('Główne zakładki')}>
      {BOTTOM.map(([k, l, ic]) => <button key={k} type="button" data-act="tab" data-tab={k} aria-current={tab === k ? 'page' : undefined} onClick={() => { goTab(k); window.scrollTo(0, 0); }}><Icon n={ic} /><span>{T(l)}</span></button>)}
      <button type="button" data-act="more-open" aria-current={inMore ? 'page' : undefined} aria-expanded={more} onClick={() => setUI((s) => { s.more = !s.more; })}><Icon n="more" /><span>{T('Więcej')}</span></button>
    </nav>
    <BottomSheet open={more} onClose={() => setUI((s) => { s.more = false; })} label={T('Wszystkie moduły')}>
      <div className="sheet-grid">
        {NAV.map(([k, l, ic]) => <button key={k} type="button" className="sheet-i" data-act="tab" data-tab={k} aria-current={tab === k ? 'page' : undefined} onClick={() => { goTab(k); window.scrollTo(0, 0); }}><Icon n={ic} /><span>{T(l)}</span>{cnt[k] ? <small>{cnt[k]}</small> : null}</button>)}
        <button type="button" className="sheet-i" data-act="history-open" onClick={() => setUI((s) => { s.history = true; s.more = false; })}><Icon n="history" /><span>{T('Historia wersji')}</span></button>
        <button type="button" className="sheet-i" data-act="settings-open" onClick={() => setUI((s) => { s.settings = true; s.more = false; })}><Icon n="cog" /><span>{T('Ustawienia')}</span></button>
      </div>
    </BottomSheet>
  </>;
}

export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  return <div id="toast-root"><AnimatePresence>{toasts.map((t) => (
    <motion.div key={t.id} className={cx('toast', t.kind)} role="status" style={{ x: '-50%' }} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ duration: 0.3 }}>
      {t.msg}{t.action && <button type="button" onClick={t.action.run}>{t.action.label}</button>}
    </motion.div>))}</AnimatePresence></div>;
}
export function Busy() {
  const busy = useUI((s) => s.busy);
  return <AnimatePresence>{busy && <motion.div className="busy" role="status" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><div><span className="spin" aria-hidden="true" />{busy}</div></motion.div>}</AnimatePresence>;
}

/** skróty klawiszowe: cofnij / ponów poza polami tekstowymi */
function useShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      const k = e.key.toLowerCase();
      if (k !== 'z' && k !== 'y') return;
      const a = document.activeElement as HTMLElement | null;
      if (a && (a.tagName === 'TEXTAREA' || (a.tagName === 'INPUT' && !['checkbox', 'radio', 'button'].includes((a as HTMLInputElement).type)) || a.isContentEditable)) return;
      e.preventDefault();
      if (k === 'y' || e.shiftKey) redo(); else undo();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
}

export function Shell({ children }: { children: ReactNode }) {
  const tab = useUI((s) => s.tab);
  const pid = useProject((s) => s.pid);
  useShortcuts();
  return <Tooltip.Provider>
    <div className="shell"><Side /><div className="col"><Topbar />
      <motion.main key={tab + pid} className="gut view" id="view" tabIndex={-1} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease: [0.2, 0.7, 0.2, 1] }}>{children}</motion.main>
    </div></div>
    <BottomNav />
  </Tooltip.Provider>;
}
