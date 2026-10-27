/* Ustawienia (aplikacja, szyfrowanie, synchronizacja, projekt), okno haseł i ekran blokady zaszyfrowanego projektu. */
import { useEffect, useRef, useState } from 'react';
import { T, T_ } from '../domain/i18n';
import { Core } from '../domain/core';
import { Store } from '../domain/store';
import { Sync } from '../domain/sync';
import { Vault } from '../domain/vault';
import { mutate, useProject } from '../state/project';
import { setUI, toast, useUI } from '../state/ui';
import { usePrefs } from '../state/prefs';
import { cancelSave, deleteProject, doSave, lockCurrent, newProject, openProject, unlockLocked } from '../state/actions';
import { BlurInput, Btn, Field, Icon, Modal, Seg, TextInput, cx } from '../components/ui';
import { useSyncStatus } from './Shell';
import { DocLang } from './Misc';
import { desktop } from '../desktop/bridge';
import { backToLauncher } from '../desktop/install';

export function Settings() {
  const open = useUI((s) => s.settings);
  const st = useProject((s) => s.st);
  return <Modal open={open && !!st} onClose={() => setUI((s) => { s.settings = false; s.confirmDel = false; })} act="settings-close" title={T('Ustawienia')}>{st ? <SettingsBody /> : null}</Modal>;
}

function SettingsBody() {
  const st0 = useProject((s) => s.st);
  const { lang, theme, setPrefs } = usePrefs();
  const confirmDel = useUI((s) => s.confirmDel);
  if (!st0) return null; // projekt zablokowany w trakcie zamykania okna
  const st = st0;
  const m = st.meta;
  const setMeta = (k: string) => (v: string) => mutate((x) => { (x.meta as any)[k] = v; if (k === 'title') x.demo = false; });
  const setNum = (k: string) => (v: string) => { const n = +String(v).replace(',', '.'); if (n > 0) mutate((x) => { (x.meta as any)[k] = n; }); };
  const f = (label: string, key: string, type?: string) => <Field label={label}>{type === 'date'
    ? <input className="inp" type="date" value={(m as any)[key] || ''} data-bind={'meta.' + key} onChange={(e) => setMeta(key)(e.target.value)} />
    : <TextInput value={(m as any)[key]} bind={'meta.' + key} onCommit={setMeta(key)} />}</Field>;
  const wd = [1, 2, 3, 4, 5, 6, 0];
  return <div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div className="set-sec"><h3>{T('Aplikacja')}</h3><p className="small muted">{T('Te ustawienia dotyczą tego urządzenia i wszystkich projektów.')}</p>
      <div className="row" style={{ gap: 18, alignItems: 'flex-start' }}>
        <div className="field"><span className="lbl">{T('Język interfejsu')}</span><Seg value={lang} act="set-lang" onChange={(v) => setPrefs({ lang: v })} items={[['pl', 'Polski'], ['en', 'English']]} /></div>
        <div className="field"><span className="lbl">{T('Motyw')}</span><Seg value={theme} act="set-theme" onChange={(v) => setPrefs({ theme: v })} items={[['auto', T('Systemowy')], ['light', T('Jasny')], ['dark', T('Ciemny')]]} /></div>
      </div>
      {desktop() && <div className="row" style={{ marginTop: 12, gap: 10 }}><Btn act="to-launcher" icon="left" onClick={() => void backToLauncher()}>{T('Okno startowe')}</Btn><span className="small muted">{T('Zapisuje projekt i wraca do wyboru projektu.')}</span></div>}</div>
    <SecuritySettings />
    <SyncSettings />
    <div className="set-sec"><h3>{T('Projekt')}</h3>
      <div className="fgrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>{f(T('Tytuł filmu'), 'title')}{f(T('Firma produkcyjna'), 'company')}{f(T('Reżyser'), 'director')}{f(T('Producent'), 'producer')}{f(T('Kierownik produkcji'), 'manager')}{f(T('Wersja scenariusza'), 'scriptVersion')}{f(T('Data wersji scenariusza'), 'scriptDate', 'date')}
        <Field label={T('Miejscowość bazy produkcji (pogoda)')}><TextInput value={m.baseCity || ''} bind="meta.baseCity" placeholder={T('gdy lokacja nie ma adresu, np. Warszawa')} onCommit={setMeta('baseCity')} /></Field>
        <Field label={T('Język dokumentów PDF i Excel')}><DocLang /></Field></div></div>
    <div><span className="lbl">{T('Dni robocze ekipy')}</span><div className="wd">{wd.map((n) => <label key={n}><input type="checkbox" data-act-change="wd-toggle" data-n={n} checked={m.weekdays.includes(n)} onChange={(e) => {
      const on = e.target.checked; const set = new Set(m.weekdays);
      if (on) set.add(n); else set.delete(n);
      if (!set.size) { toast(T('Zaznacz przynajmniej jeden dzień roboczy.'), 'bad'); return; }
      mutate((x) => { x.meta.weekdays = [...set].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)); });
    }} />{Core.DAYS_SHORT[n]}</label>)}</div></div>
    <div className="fgrid">
      <Field label={T('Pierwszy dzień zdjęć')}><input className="inp" type="date" value={m.startDate || ''} data-bind="meta.startDate" onChange={(e) => { const v = e.target.value; mutate((x) => { x.meta.startDate = v; if (x.days.length && v) Core.recalcDates(x); }); }} /></Field>
      <Field label={T('Stron na dzień zdjęciowy')}><BlurInput type="number" min={0.5} max={30} step={0.5} value={+m.pagesPerDay} bind="meta.pagesPerDay" data-num="1" onCommit={setNum('pagesPerDay')} /></Field>
      <Field label={T('Zbiórka (dzień)')}><input className="inp" type="time" value={m.call || ''} data-bind="meta.call" onChange={(e) => setMeta('call')(e.target.value)} /></Field>
      <Field label={T('Zbiórka (noc)')}><input className="inp" type="time" value={m.callNight || ''} data-bind="meta.callNight" onChange={(e) => setMeta('callNight')(e.target.value)} /></Field>
    </div>
    <div className="fgrid">
      <Field label={T('Maks. czas pracy (h dziennie)')}><BlurInput type="number" min={1} max={24} step={0.5} value={+m.maxWorkH || 12} bind="meta.maxWorkH" data-num="1" onCommit={setNum('maxWorkH')} /></Field>
      <Field label={T('Min. odpoczynek między dniami (h)')}><BlurInput type="number" min={1} max={24} step={0.5} value={+m.minRestH || 11} bind="meta.minRestH" data-num="1" onCommit={setNum('minRestH')} /></Field>
    </div>
    <p className="small muted" style={{ margin: 0 }}>{T('Limit stron służy do planu automatycznego i ostrzeżeń o przeładowanym dniu. Godziny dnia liczą się w Planie pracy z czasów realizacji. Limity czasu pracy i odpoczynku włączają ostrzeżenia BHP (domyślnie 12 h pracy i 11 h przerwy).')}</p>
    <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14 }}><div className="row">{confirmDel
      ? <><span className="small"><b>{T('Usunąć cały projekt „{t}”?', { t: m.title || T('Bez tytułu') })}</b> {T('Tego nie da się cofnąć.')}</span><Btn v="danger" act="proj-del-yes" onClick={() => void deleteProject()}>{T('Tak, usuń projekt')}</Btn><Btn act="proj-del-no" onClick={() => setUI((s) => { s.confirmDel = false; })}>{T('Anuluj')}</Btn></>
      : <Btn v="danger" act="proj-del" icon="trash" onClick={() => setUI((s) => { s.confirmDel = true; })}>{T('Usuń projekt')}</Btn>}</div></div>
  </div>;
}

/* ---------- szyfrowanie ---------- */
function openPw(kind: 'enable' | 'change' | 'disable') { setUI((s) => { s.settings = false; s.pw = { kind }; }); }
function SecuritySettings() {
  const pid = useProject((s) => s.pid)!;
  useProject((s) => s.projects); // odświeżenie po zmianie szyfrowania
  const enc = Store.isEncrypted(pid);
  if (!Vault.available()) return <div className="set-sec"><h3>{T('Szyfrowanie projektu')}</h3><div className="notice warn"><div><Icon n="warn" /></div><div>{T('Ta przeglądarka nie udostępnia szyfrowania (Web Crypto). Otwórz Klaps przez https albo w aplikacji na Maca lub iPhone’a.')}</div></div></div>;
  return <div className="set-sec" id="sec-sec"><h3>{T('Szyfrowanie projektu (E2E)')}</h3>
    <p className="small muted">{T('Szyfrowanie end-to-end: projekt jest szyfrowany na tym urządzeniu kluczem z Twojego hasła (AES-256-GCM, PBKDF2 600 000 iteracji). W pamięci przeglądarki, w plikach, w kopii .json i na serwerze synchronizacji leżą wyłącznie zaszyfrowane dane. Hasło nie jest nigdzie zapisywane.')}</p>
    {enc ? <><div className="sec-box on"><Icon n="shield" /><div><b>{T('Projekt jest zaszyfrowany')}</b><div className="small muted">{T('Na innym urządzeniu projekt otworzysz po podaniu tego samego hasła.')}</div></div></div>
      <div className="row" style={{ marginTop: 10 }}><Btn act="sec-change" onClick={() => openPw('change')}>{T('Zmień hasło')}</Btn><Btn act="sec-lock" icon="lock" onClick={() => void lockCurrent()}>{T('Zablokuj teraz')}</Btn><Btn v="ghost danger" act="sec-disable" onClick={() => openPw('disable')}>{T('Wyłącz szyfrowanie')}</Btn></div></>
      : <><div className="sec-box"><Icon n="lock" /><div><b>{T('Projekt nie jest zaszyfrowany')}</b><div className="small muted">{T('Zalecane dla scenariuszy objętych NDA i danych osobowych ekipy i obsady.')}</div></div></div>
        <div className="row" style={{ marginTop: 10 }}><Btn v="primary" act="sec-enable" icon="shield" onClick={() => openPw('enable')}>{T('Zaszyfruj projekt hasłem')}</Btn></div></>}
  </div>;
}

const PW_TITLES = { enable: T_('Zaszyfruj projekt'), change: T_('Zmień hasło projektu'), disable: T_('Wyłącz szyfrowanie'), file: T_('Otwórz zaszyfrowaną kopię') };
const PW_LABELS = [T_('za krótkie'), T_('słabe'), T_('średnie'), T_('dobre'), T_('bardzo dobre')];
export function PwDialog() {
  const P = useUI((s) => s.pw);
  return <Modal open={!!P} onClose={() => setUI((s) => { s.pw = null; })} act="pw-close" className="narrow" title={P ? T(PW_TITLES[P.kind]) : ''}>{P ? <PwBody key={P.kind} /> : null}</Modal>;
}
function PwBody() {
  // podczas animacji zamykania okno pokazuje ostatni stan (pw jest już puste)
  const live = useUI((s) => s.pw);
  const lastP = useRef(live);
  if (live) lastP.current = live;
  const P = lastP.current!;
  const [a, setA] = useState(''), [b, setB] = useState(''), [cur, setCur] = useState('');
  const two = P.kind === 'enable' || P.kind === 'change';
  const r1 = useRef<HTMLInputElement>(null), r2 = useRef<HTMLInputElement>(null);
  const s = a ? Vault.strength(a) : 0;
  const lead = { enable: T('Ustal hasło projektu. Będzie potrzebne przy każdym otwarciu projektu i na każdym urządzeniu.'), change: T('Projekt zostanie zaszyfrowany ponownie nowym hasłem. Na innych urządzeniach użyj już nowego hasła.'), disable: T('Projekt będzie zapisywany bez szyfrowania. Podaj obecne hasło, aby potwierdzić.'), file: T('Ta kopia projektu jest zaszyfrowana. Podaj hasło, którym projekt był zabezpieczony.') }[P.kind];
  const fail = (msg: string) => setUI((x) => { if (x.pw) { x.pw.busy = false; x.pw.err = msg; } });
  const busy = (v: boolean) => setUI((x) => { if (x.pw) { x.pw.busy = v; if (v) x.pw.err = ''; } });
  const submit = async () => {
    if (P.busy) return;
    const st = useProject.getState().st!; const pid = useProject.getState().pid!;
    if (two) {
      if (a.length < 8) return fail(T('Hasło musi mieć co najmniej 8 znaków.'));
      if (a !== b) return fail(T('Hasła nie są takie same.'));
      if (Vault.strength(a) < 2) return fail(T('Hasło jest za słabe. Użyj dłuższego hasła albo dodaj cyfry i znaki specjalne.'));
      busy(true);
      try {
        cancelSave();
        const meta = await Store.encryptProject(pid, st, a);
        const list = useProject.getState().projects.slice(); const i = list.findIndex((p) => p.id === pid); if (i >= 0) list[i] = meta; else list.unshift(meta);
        useProject.getState().setProjects(list); useProject.getState().setSave('saved');
        setUI((x) => { x.pw = null; }); Sync.touch();
        toast(P.kind === 'enable' ? T('Projekt jest teraz zaszyfrowany end-to-end.') : T('Hasło projektu zostało zmienione.'));
      } catch (e: any) { fail((e && e.message) || String(e)); }
      return;
    }
    if (!cur) return fail(T('Wpisz hasło.'));
    busy(true);
    try {
      if (P.kind === 'disable') {
        await Store.unlock(pid, cur);
        const meta = await Store.decryptProject(pid, st);
        const list = useProject.getState().projects.slice(); const i = list.findIndex((p) => p.id === pid); if (i >= 0) list[i] = meta;
        useProject.getState().setProjects(list);
        setUI((x) => { x.pw = null; }); Sync.touch();
        toast(T('Szyfrowanie projektu zostało wyłączone.'));
      } else if (P.kind === 'file') {
        const { st: s2, key } = await Store.openEncryptedFile(P.obj, cur);
        setUI((x) => { x.pw = null; });
        await newProject((s2.meta.title || T('Projekt')) + ' ' + T('(kopia)'), Core.normalize(s2), key);
        toast(T('Wczytano zaszyfrowaną kopię projektu. Projekt pozostaje zaszyfrowany tym samym hasłem.'));
      }
    } catch (e: any) { fail(e && e.badKey ? T('Nieprawidłowe hasło.') : (e && e.message) || String(e)); }
  };
  useEffect(() => { setTimeout(() => (two ? r1.current : r2.current)?.focus(), 60); }, [two]);
  const enter = (fn: () => void) => (e: React.KeyboardEvent) => { if (e.key === 'Enter') { e.preventDefault(); fn(); } };
  return <form className="card-b pw-f" onSubmit={(e) => { e.preventDefault(); void submit(); }}>
    <p className="small" style={{ margin: 0 }}>{lead}</p>
    {two ? <>
      <Field label={T('Nowe hasło')}><input ref={r1} id="pw-1" className="inp" type="password" autoComplete="new-password" minLength={8} value={a} onChange={(e) => setA(e.target.value)} onKeyDown={enter(() => r2.current?.focus())} /></Field>
      <div className="pw-meter" id="pw-meter" data-s={a ? Math.max(1, s) : 0} aria-live="polite"><i /><i /><i /><i /><span>{a ? T(PW_LABELS[s]) : T('min. 8 znaków')}</span></div>
      <Field label={T('Powtórz hasło')}><input ref={r2} id="pw-2" className="inp" type="password" autoComplete="new-password" value={b} onChange={(e) => setB(e.target.value)} onKeyDown={enter(() => void submit())} /></Field>
      <div className="notice warn" style={{ margin: 0 }}><div><Icon n="warn" /></div><div className="small" dangerouslySetInnerHTML={{ __html: T('<b>Hasła nie da się odzyskać.</b> Bez niego projektu nie odczyta nikt – także Ty. Zapisz je w menedżerze haseł i zrób kopię projektu (.json).') }} /></div></>
      : <Field label={P.kind === 'file' ? T('Hasło projektu') : T('Obecne hasło')}><input ref={r2} id="pw-cur" className="inp" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} onKeyDown={enter(() => void submit())} /></Field>}
    <div className="lock-err" role="alert">{P.err || ''}</div>
    <div className="row" style={{ justifyContent: 'flex-end' }}><Btn act="pw-close" onClick={() => setUI((x) => { x.pw = null; })}>{T('Anuluj')}</Btn>
      <Btn v={P.kind === 'disable' ? 'danger' : 'primary'} act="pw-go" disabled={P.busy} onClick={() => void submit()}>{P.busy ? <><span className="spin" aria-hidden="true" />{T('Szyfruję…')}</> : { enable: T('Zaszyfruj'), change: T('Zmień hasło'), disable: T('Wyłącz szyfrowanie'), file: T('Otwórz') }[P.kind]}</Btn></div>
  </form>;
}

/* ---------- ekran blokady ---------- */
export function LockScreen() {
  const L = useProject((s) => s.locked)!;
  const projects = useProject((s) => s.projects);
  const [pw, setPw] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!L.busy) setTimeout(() => ref.current?.focus(), 30); }, [L.busy]);
  const others = projects.filter((p) => p.id !== L.id);
  return <div className="lock"><form className="lock-card" onSubmit={(e) => { e.preventDefault(); void unlockLocked(pw); }}>
    <div className="lock-brand"><Icon n="clap" /><span>Klaps</span></div>
    <div className="lock-ic"><Icon n="lock" /></div>
    <h1>{T('Projekt zaszyfrowany')}</h1>
    <p className="muted">{T('Dane tego projektu są zaszyfrowane end-to-end (AES-256). Podaj hasło projektu, aby go otworzyć na tym urządzeniu.')}</p>
    <Field label={T('Hasło projektu')}><input ref={ref} id="lock-pw" className="inp" type="password" autoComplete="current-password" aria-describedby="lock-err" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
    <div id="lock-err" className="lock-err" role="alert">{L.err || ''}</div>
    <Btn v="primary" big type="submit" act="lock-go" disabled={L.busy}>{L.busy ? <><span className="spin" aria-hidden="true" />{T('Sprawdzam…')}</> : T('Odblokuj')}</Btn>
    <div className="lock-alt">{others.length > 0 && <Field label={T('albo otwórz inny projekt')}><select className="inp" data-act-change="lock-switch" value="" onChange={(e) => { const v = e.target.value; if (v) void openProject(v); }}><option value="">—</option>{others.map((p) => <option key={p.id} value={p.id}>{p.title || (p.enc ? T('Zaszyfrowany projekt') : T('Bez tytułu'))}</option>)}</select></Field>}
      <Btn v="ghost" act="lock-new" icon="plus" onClick={() => void newProject(T('Nowy projekt'))}>{T('Nowy projekt')}</Btn></div>
  </form></div>;
}

/* ---------- synchronizacja ---------- */
function SyncSettings() {
  const st = useSyncStatus();
  const busy = useUI((s) => s.syncBusy), err = useUI((s) => s.syncErr);
  const [form, setForm] = useState(() => { const c = Sync.cfg; return { url: c.url || '', key: c.key || '', email: c.email || '', pass: '' }; });
  if (!Sync.available()) return null;
  const c = Sync.cfg;
  const head = <><h3>{T('Synchronizacja')}</h3><p className="small muted">{T('Projekty synchronizują się automatycznie między Twoimi urządzeniami (Mac, iPhone, iPad) przez Twoją bazę Supabase (darmowy plan wystarczy). Zmiany wysyłają się kilka sekund po zapisie, a nowe wersje z innych urządzeń pobierają się co minutę i po powrocie do aplikacji.')}</p></>;
  if (Sync.loggedIn()) {
    const hm = st.at ? new Date(st.at).toTimeString().slice(0, 5) : '—';
    return <div className="set-sec">{head}
      <div className={cx('sync-box', st.state === 'error' ? 'bad' : 'ok')}><div><b>{T('Zalogowano jako {e}', { e: (c.session.user && c.session.user.email) || c.email })}</b><div className="small muted">{c.url}</div></div>
        <div className="small">{st.state === 'error' ? <span className="bad-t">{T('Błąd')}: {st.error}</span> : st.state === 'busy' ? T('Synchronizuję…') : T('Ostatnia synchronizacja: {t}', { t: hm })}</div></div>
      <div className="row" style={{ marginTop: 10, alignItems: 'flex-end' }}><Field label={T('Nazwa tego urządzenia')} style={{ maxWidth: 240 }}><BlurInput id="sync-device" value={c.device} placeholder="Mac, iPhone…" onCommit={(v) => Sync.setDevice(v)} /></Field>
        <Btn v="primary" act="sync-now" onClick={() => Sync.syncAll()}>{T('Synchronizuj teraz')}</Btn><Btn act="sync-logout" onClick={() => { Sync.logout(); toast(T('Wylogowano. Projekty zostają na tym urządzeniu.')); setForm((f) => ({ ...f, pass: '' })); }}>{T('Wyloguj')}</Btn></div></div>;
  }
  const go = (signup: boolean) => {
    setUI((s) => { s.syncBusy = true; s.syncErr = ''; });
    doSave().then(() => Sync.login(form.url, form.key, form.email, form.pass, signup)).then((r: any) => {
      setUI((s) => { s.syncBusy = false; });
      setForm((f) => ({ ...f, pass: '' }));
      if (r === 'confirm') { setUI((s) => { s.syncErr = T('Konto założone. Potwierdź adres e-mail (link w wiadomości od Supabase), a potem kliknij „Zaloguj i synchronizuj”.'); }); return; }
      toast(T('Synchronizacja włączona. Projekty z tego urządzenia trafiają do Twojej bazy.'));
    }).catch((e: any) => setUI((s) => { s.syncBusy = false; s.syncErr = T('Nie udało się połączyć: {e}', { e: e.message }); }));
  };
  const inp = (k: keyof typeof form, label: string, o: { ph?: string; type?: string; ac?: string } = {}) => <Field label={label}><input className="inp" id={'sync-' + k} type={o.type || 'text'} value={form[k]} placeholder={o.ph} autoComplete={o.ac || 'off'} autoCapitalize="off" spellCheck={false} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, [k]: v })); }} /></Field>;
  return <div className="set-sec">{head}
    <div className="fgrid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>{inp('url', T('Adres projektu Supabase (Project URL)'), { ph: 'https://xxxx.supabase.co' })}{inp('key', T('Klucz publiczny (anon / publishable key)'), { ph: 'eyJ…' })}{inp('email', 'E-mail', { type: 'email', ac: 'username' })}{inp('pass', T('Hasło'), { type: 'password', ac: 'current-password' })}</div>
    {err && <div className="notice bad" style={{ margin: '10px 0 0' }}><div>{err}</div></div>}
    <div className="row" style={{ marginTop: 10 }}><Btn v="primary" act="sync-login" disabled={busy} onClick={() => go(false)}>{busy ? T('Łączę…') : T('Zaloguj i synchronizuj')}</Btn><Btn act="sync-signup" disabled={busy} onClick={() => go(true)}>{T('Załóż konto')}</Btn></div>
    <details className="sync-help"><summary>{T('Jak przygotować bazę (ok. 5 minut, jednorazowo)')}</summary>
      <ol className="small"><li>{T('Załóż darmowe konto na supabase.com i utwórz nowy projekt (dowolna nazwa, region np. Frankfurt).')}</li>
        <li>{T('W projekcie otwórz SQL Editor, wklej poniższy skrypt i kliknij Run. Tworzy dwie tabele dostępne tylko dla zalogowanego właściciela.')}</li>
        <li>{T('W Authentication → Sign In / Providers → Email wyłącz „Confirm email” (albo potwierdź adres z maila po założeniu konta).')}</li>
        <li>{T('W Project Settings → API (Data API) skopiuj Project URL oraz klucz anon (publishable) i wklej je powyżej.')}</li>
        <li>{T('Kliknij „Załóż konto”. Na kolejnych urządzeniach wpisz te same dane i kliknij „Zaloguj i synchronizuj”.')}</li></ol>
      <div className="row" style={{ margin: '6px 0' }}><Btn sm act="sync-copy-sql" icon="file" onClick={() => { try { navigator.clipboard.writeText(Sync.SQL).then(() => toast(T('Skrypt SQL skopiowany.')), () => toast(T('Nie udało się skopiować – zaznacz tekst ręcznie.'), 'bad')); } catch { toast(T('Nie udało się skopiować – zaznacz tekst ręcznie.'), 'bad'); } }}>{T('Kopiuj skrypt SQL')}</Btn></div>
      <pre className="sql">{Sync.SQL}</pre></details></div>;
}
