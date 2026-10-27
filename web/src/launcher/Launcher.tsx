/* Okno startowe w stylu launcherów Adobe: logo, powitanie, wybór projektu. Pierwsze uruchomienie = krótki formularz profilu. */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { T } from '../domain/i18n';
import { ICONS } from '../lib/icons';
import { plN } from '../lib/format';
import { usePrefs } from '../state/prefs';
import { desktop, type DesktopProfile } from '../desktop/bridge';
import { Logo } from './Logo';
import { allIdentities, allSources, launch, resolveAccount, type Account, type IdentityProvider, type ProjectEntry, type ProjectSource } from './services';

type View = 'boot' | 'welcome' | 'home' | 'new';
const ic = (n: keyof typeof ICONS) => <span className="ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[n] }} />;
const ROLES = ['Reżyser', 'Producent', 'Kierownik produkcji', 'II reżyser', 'Asystent planu', 'Operator', 'Scenarzysta'];
const TILES = ['#F2C230', '#6FB5E8', '#8FCB7C', '#E59A86', '#B79AE0', '#E6BB85'];

const initials = (t: string) => (t.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '·').toUpperCase();
const tint = (id: string) => { let h = 0; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return TILES[h % TILES.length]; };
export function ago(ts: number, lang: string, now = Date.now()): string {
  if (!ts) return '';
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const s = Math.round((ts - now) / 1000), a = Math.abs(s);
  if (a < 45) return rtf.format(0, 'second');
  if (a < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (a < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  if (a < 7 * 86400) return rtf.format(Math.round(s / 86400), 'day');
  return new Date(ts).toLocaleDateString(lang, { day: 'numeric', month: 'short', year: new Date(ts).getFullYear() === new Date(now).getFullYear() ? undefined : 'numeric' });
}

export function Launcher() {
  const lang = usePrefs((p) => p.lang);
  const [view, setView] = useState<View>('boot');
  const [profile, setProfile] = useState<DesktopProfile | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [identity, setIdentity] = useState<IdentityProvider | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [error, setError] = useState('');
  const d = desktop();

  const refresh = useCallback(async () => {
    const p = d ? await d.profile.get() : null;
    setProfile(p);
    const r = await resolveAccount();
    setAccount(r.account); setIdentity(r.provider);
    return p;
  }, [d]);
  useEffect(() => { void refresh().then((p) => setView(p ? 'home' : 'welcome')).catch(() => setView('welcome')); }, [refresh]);

  const open = async (intent: Parameters<typeof launch>[0], label: string) => {
    setError(''); setOpening(label);
    try { await launch(intent); }
    catch (e: any) { setOpening(null); setError(e && e.message ? e.message : String(e)); }
  };
  const calm = useReducedMotion();
  const first = view === 'welcome';

  return <div className={'lc' + (opening ? ' opening' : '')} lang={lang}>
    <aside className="lc-brand">
      <div className="lc-film" aria-hidden="true" />
      <Logo size={first ? 112 : 84} pulse={!!opening} />
      <m.div className="lc-word" initial={calm ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}>
        <b>Klaps</b><span>{T('Planer')}</span></m.div>
      <div className="lc-grow" />
      <AnimatePresence mode="wait" initial={false}>
        {view === 'home' && profile ? <m.div key="hi" className="lc-hello" initial={calm ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.35, delay: 0.1 }}>
          <small>{T('Miło Cię widzieć')}</small>
          <h1>{T('Cześć, {name}', { name: profile.name })}</h1>
          <Who account={account} identity={identity} profile={profile} onChanged={refresh} />
        </m.div> : <m.p key="tag" className="lc-tag" initial={calm ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ delay: 0.3 }}>
          {T('Planowanie zdjęć: od scenariusza do planu dnia.')}</m.p>}
      </AnimatePresence>
      <div className="lc-ver">v{d?.version || ''}</div>
    </aside>

    <main className="lc-main">
      <button type="button" className="lc-x" aria-label={T('Zamknij')} data-act="launcher-quit" onClick={() => void d?.launcher.quit()}>{ic('x')}</button>
      <AnimatePresence mode="wait" initial={false}>
        {opening ? <Opening key="op" label={opening} />
          : view === 'welcome' ? <m.div key="w" className="lc-pane" {...fade(calm)}><Welcome onDone={async () => { await refresh(); setView('home'); }} /></m.div>
          : view === 'new' ? <m.div key="n" className="lc-pane" {...fade(calm)}><NewProject onBack={() => { setError(''); setView('home'); }} onCreate={(title, template) => void open({ type: 'create', source: 'local', title, template }, title)} error={error} /></m.div>
          : view === 'home' ? <m.div key="h" className="lc-pane" {...fade(calm)}><Home profile={profile} lang={lang} error={error} onNew={() => { setError(''); setView('new'); }} onOpen={(e) => void open({ type: 'open', source: e.source, id: e.id }, e.title)} /></m.div>
          : <m.div key="b" className="lc-pane" {...fade(calm)} />}
      </AnimatePresence>
    </main>
  </div>;
}
const fade = (calm: boolean | null) => ({ initial: calm ? false as const : { opacity: 0, x: 14 }, animate: { opacity: 1, x: 0 }, exit: { opacity: 0, x: -10 }, transition: { duration: 0.22, ease: [0.2, 0.7, 0.2, 1] as [number, number, number, number] } });

/* ---------- konto (miejsce na logowanie) ---------- */
function Who({ account, identity, profile, onChanged }: { account: Account | null; identity: IdentityProvider | null; profile: DesktopProfile; onChanged: () => Promise<unknown> }) {
  const [edit, setEdit] = useState(false);
  const [name, setName] = useState(profile.name);
  const [role, setRole] = useState(profile.role);
  const caps = identity?.capabilities;
  const others = allIdentities().filter((p) => p.capabilities.signIn);
  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return;
    await identity?.setProfile?.({ name, role }); await onChanged(); setEdit(false);
  };
  if (edit) return <form className="lc-who-edit" onSubmit={save}>
    <input className="lc-inp sm" value={name} onChange={(e) => setName(e.target.value)} aria-label={T('Imię i nazwisko')} autoFocus maxLength={80} />
    <input className="lc-inp sm" value={role} onChange={(e) => setRole(e.target.value)} aria-label={T('Stanowisko (opcjonalnie)')} placeholder={T('Stanowisko (opcjonalnie)')} maxLength={80} list="lc-roles" />
    <div className="lc-row"><button className="lc-btn pri sm" type="submit" disabled={name.trim().length < 2}>{T('Zapisz')}</button><button className="lc-btn sm" type="button" onClick={() => { setName(profile.name); setRole(profile.role); setEdit(false); }}>{T('Anuluj')}</button></div>
  </form>;
  return <div className="lc-who">
    <span className="lc-av" aria-hidden="true">{initials(account?.name || profile.name)}</span>
    <span className="lc-who-t"><b>{profile.role || T('Użytkownik')}</b><small>{identity ? identity.label() : T('Konto lokalne')}</small></span>
    <span className="lc-who-a">
      {caps?.editProfile && <button type="button" className="lc-ico" data-act="profile-edit" aria-label={T('Zmień imię i nazwisko')} title={T('Zmień imię i nazwisko')} onClick={() => setEdit(true)}>{ic('edit')}</button>}
      {/* miejsce na przyszłe logowanie: pojawia się samo, gdy zarejestrowano dostawcę z signIn */}
      {others.map((p) => <button key={p.id} type="button" className="lc-ico" data-act={'signin-' + p.id} aria-label={T('Zaloguj się')} title={T('Zaloguj się')} onClick={() => void p.signIn?.().then(onChanged)}>{ic('person')}</button>)}
    </span>
  </div>;
}

/* ---------- pierwsze uruchomienie ---------- */
function Welcome({ onDone }: { onDone: () => Promise<void> }) {
  const { lang, theme, setPrefs } = usePrefs();
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) { setErr(T('Wpisz imię i nazwisko (co najmniej 2 znaki).')); return; }
    setBusy(true);
    try { await desktop()?.profile.set({ name, role }); await onDone(); }
    catch (x: any) { setErr(x && x.message ? x.message : String(x)); setBusy(false); }
  };
  return <form className="lc-form" onSubmit={submit} noValidate>
    <h2>{T('Witaj w Klaps Planer')}</h2>
    <p className="lc-sub">{T('Zacznijmy od Twojego imienia. Zobaczysz je w oknie startowym. Dane zostają na tym komputerze.')}</p>
    <div className="lc-two">
      <label className="lc-f"><span>{T('Imię i nazwisko')}</span>
        <input className="lc-inp" id="lc-name" value={name} autoFocus maxLength={80} autoComplete="name" placeholder="Anna Nowak" onChange={(e) => { setName(e.target.value); setErr(''); }} aria-invalid={!!err} aria-describedby={err ? 'lc-err' : undefined} /></label>
      <label className="lc-f"><span>{T('Stanowisko (opcjonalnie)')}</span>
        <input className="lc-inp" id="lc-role" value={role} maxLength={80} list="lc-roles" placeholder={T('np. Kierownik produkcji')} onChange={(e) => setRole(e.target.value)} /></label>
    </div>
    <datalist id="lc-roles">{ROLES.map((r) => <option key={r} value={T(r)} />)}</datalist>
    <div className="lc-prefs">
      <div className="lc-f"><span>{T('Język interfejsu')}</span><div className="lc-seg" role="group">{(['pl', 'en'] as const).map((l) => <button key={l} type="button" aria-pressed={lang === l} data-act="wl-lang" data-v={l} onClick={() => setPrefs({ lang: l })}>{l === 'pl' ? 'Polski' : 'English'}</button>)}</div></div>
      <div className="lc-f"><span>{T('Motyw')}</span><div className="lc-seg" role="group">{([['dark', T('Ciemny')], ['light', T('Jasny')], ['auto', T('Systemowy')]] as const).map(([k, l]) => <button key={k} type="button" aria-pressed={theme === k} data-act="wl-theme" data-v={k} onClick={() => setPrefs({ theme: k })}>{l}</button>)}</div></div>
    </div>
    {err && <p id="lc-err" className="lc-err" role="alert">{err}</p>}
    <button className="lc-btn pri lg" type="submit" data-act="welcome-go" disabled={busy}>{T('Zaczynamy')}{ic('right')}</button>
  </form>;
}

/* ---------- lista projektów ---------- */
function Home({ profile, lang, error, onNew, onOpen }: { profile: DesktopProfile | null; lang: string; error: string; onNew: () => void; onOpen: (e: ProjectEntry) => void }) {
  const [rows, setRows] = useState<ProjectEntry[] | null>(null);
  const [q, setQ] = useState('');
  const [srcId, setSrcId] = useState('local');
  const [account, setAccount] = useState<Account | null>(null);
  const [sources, setSources] = useState<ProjectSource[]>([]);
  const listRef = useRef<HTMLUListElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [showAtStart, setShowAtStart] = useState(profile?.prefs.showLauncher !== false);

  useEffect(() => {
    let live = true;
    void (async () => {
      const a = (await resolveAccount()).account;
      const vis = allSources().filter((s) => s.visible(a));
      if (!live) return;
      setAccount(a); setSources(vis);
    })();
    return () => { live = false; };
  }, []);
  useEffect(() => {
    const s = sources.find((x) => x.id === srcId) || sources[0];
    if (!s) return;
    let live = true; setRows(null);
    s.list(account).then((r) => { if (live) setRows(r.sort((a, b) => b.updatedAt - a.updatedAt)); }).catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [sources, srcId, account]);

  const shown = useMemo(() => (rows || []).filter((r) => !q.trim() || r.title.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  const key = (e: KeyboardEvent) => {
    const btns = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('button.lc-proj') || [])];
    const i = btns.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); (btns[i + 1] || btns[0])?.focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (i <= 0) search.current?.focus(); else btns[i - 1].focus(); }
    else if (e.key === '/' && document.activeElement !== search.current) { e.preventDefault(); search.current?.focus(); }
  };
  return <div className="lc-home" onKeyDown={key}>
    <header className="lc-head">
      <h2>{T('Projekty')}</h2>
      <button type="button" className="lc-btn pri" data-act="launcher-new" onClick={onNew}>{ic('plus')}{T('Nowy projekt')}</button>
    </header>
    {sources.length > 1 && <div className="lc-tabs" role="tablist">{sources.map((s) => <button key={s.id} type="button" role="tab" aria-selected={s.id === srcId} data-act={'src-' + s.id} onClick={() => setSrcId(s.id)}>{s.label()}</button>)}</div>}
    <div className="lc-search">{ic('eye')}<input ref={search} className="lc-inp bare" value={q} placeholder={T('Szukaj projektu…')} aria-label={T('Szukaj projektu…')} onChange={(e) => setQ(e.target.value)}
      onKeyDown={(e) => { if (e.key === 'Enter' && shown[0]) onOpen(shown[0]); }} /></div>
    {error && <p className="lc-err" role="alert">{error}</p>}
    <div className="lc-list-w">
      {rows === null ? <div className="lc-empty" role="status"><span className="lc-spin" />{T('Wczytuję projekt…')}</div>
        : !rows.length ? <div className="lc-empty"><p>{T('Nie masz jeszcze żadnego projektu.')}</p><button type="button" className="lc-btn pri" data-act="launcher-new-empty" onClick={onNew}>{ic('plus')}{T('Utwórz pierwszy projekt')}</button></div>
        : !shown.length ? <div className="lc-empty"><p>{T('Nic nie pasuje do „{q}”.', { q })}</p></div>
        : <ul className="lc-list" ref={listRef}>{shown.map((p, i) => <m.li key={p.source + p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 8) * 0.03, duration: 0.25 }}>
          <button type="button" className="lc-proj" data-act="launcher-open" data-id={p.id} onClick={() => onOpen(p)}>
            <span className="lc-tile" style={{ background: tint(p.id) }} aria-hidden="true">{initials(p.title)}</span>
            <span className="lc-pt"><b>{p.title || T('Bez tytułu')}{p.enc && <i className="lc-lock" title={T('Projekt zaszyfrowany')}>{ic('lock')}</i>}{p.demo && <em>{T('Przykład')}</em>}</b>
              <small>{[p.scenes != null ? plN(p.scenes, 'scena', 'sceny', 'scen') : '', p.days != null ? plN(p.days, 'dzień', 'dni', 'dni') : '', ago(p.updatedAt, lang)].filter(Boolean).join(' · ')}</small></span>
            {p.shared && <span className="lc-share">{ic('people')}{p.shared.online}</span>}
            <span className="lc-go" aria-hidden="true">{ic('right')}</span>
          </button></m.li>)}</ul>}
    </div>
    <footer className="lc-foot"><label className="lc-chk"><input type="checkbox" checked={showAtStart} data-act="show-at-start" onChange={(e) => { setShowAtStart(e.target.checked); void desktop()?.profile.setPrefs({ showLauncher: e.target.checked }); }} /><span>{T('Pokazuj to okno przy uruchomieniu')}</span></label></footer>
  </div>;
}

/* ---------- nowy projekt ---------- */
function NewProject({ onBack, onCreate, error }: { onBack: () => void; onCreate: (title: string, template: 'empty' | 'demo') => void; error: string }) {
  const [title, setTitle] = useState('');
  const [tpl, setTpl] = useState<'empty' | 'demo'>('empty');
  useEffect(() => { const h = (e: globalThis.KeyboardEvent) => { if (e.key === 'Escape') onBack(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onBack]);
  const submit = (e: FormEvent) => { e.preventDefault(); onCreate(title.trim() || (tpl === 'demo' ? '' : T('Nowy projekt')), tpl); };
  return <form className="lc-form" onSubmit={submit}>
    <button type="button" className="lc-back" data-act="launcher-back" onClick={onBack}>{ic('left')}{T('Projekty')}</button>
    <h2>{T('Nowy projekt')}</h2>
    <label className="lc-f"><span>{T('Tytuł filmu')}</span><input className="lc-inp" id="lc-title" value={title} autoFocus maxLength={120} placeholder={tpl === 'demo' ? 'Ostatni pociąg do Zalesia' : T('np. Ostatni pociąg do Zalesia')} onChange={(e) => setTitle(e.target.value)} /></label>
    <div className="lc-f"><span>{T('Zacznij od')}</span>
      <div className="lc-cards" role="group">
        <button type="button" aria-pressed={tpl === 'empty'} data-act="tpl-empty" onClick={() => setTpl('empty')}><b>{T('Pustego projektu')}</b><small>{T('Wczytasz scenariusz albo dodasz sceny ręcznie.')}</small></button>
        <button type="button" aria-pressed={tpl === 'demo'} data-act="tpl-demo" onClick={() => setTpl('demo')}><b>{T('Przykładu')}</b><small>{T('Gotowy scenariusz z planem, by obejrzeć program w działaniu.')}</small></button>
      </div></div>
    {error && <p className="lc-err" role="alert">{error}</p>}
    <button className="lc-btn pri lg" type="submit" data-act="launcher-create">{T('Utwórz i otwórz')}{ic('right')}</button>
  </form>;
}

/* ---------- przejście do okna głównego ---------- */
function Opening({ label }: { label: string }) {
  return <m.div className="lc-pane lc-opening" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }} role="status" aria-live="polite">
    <p>{T('Otwieram')}</p><h2>{label || T('Projekt')}</h2><div className="lc-bar" aria-hidden="true"><i /></div>
  </m.div>;
}
