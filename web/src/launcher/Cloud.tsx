/* Chmura w oknie startowym: konto (rejestracja, logowanie, profil ze zdjęciem), dołączanie kodem i panel zarządzania projektem
   (osoby, role, kody zaproszeń). Cała treść projektów jest szyfrowana – serwer widzi tylko osoby, role i czasy. */
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { T } from '../domain/i18n';
import { ICONS } from '../lib/icons';
import * as cloud from '../collab/cloud';
import type { CloudProject, CloudUser, InviteRow, Member, Role } from '../collab/cloud';

const ic = (n: keyof typeof ICONS) => <span className="ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[n] }} />;
export const ROLE_LABEL: Record<Role, string> = { owner: 'Właściciel', editor: 'Edytor', viewer: 'Podgląd' };
const initials = (t: string) => (t.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('') || '·').toUpperCase();
const msg = (e: unknown) => (e && (e as Error).message ? (e as Error).message : String(e));

export function Avatar({ name, src, color, size = 36 }: { name: string; src?: string; color?: string; size?: number }) {
  return src ? <img className="lc-pic" src={src} alt="" width={size} height={size} style={{ width: size, height: size }} />
    : <span className="lc-pic ph" aria-hidden="true" style={{ width: size, height: size, background: color || '#25272C', fontSize: size * 0.38 }}>{initials(name)}</span>;
}
function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return <div className="lc-modal" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className={'lc-dlg' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
      <header><h3>{title}</h3><button type="button" className="lc-ico dk" aria-label={T('Zamknij')} onClick={onClose}>{ic('x')}</button></header>
      {children}
    </div>
  </div>;
}

/* ---------- konto ---------- */
export function AccountModal({ user, onClose, onChanged }: { user: CloudUser | null; onClose: () => void; onChanged: () => void }) {
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(user?.email || '');
  const [pass, setPass] = useState('');
  const [name, setName] = useState(user?.name || '');
  const [pos, setPos] = useState(user?.position || '');
  const [pic, setPic] = useState(user?.avatar || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [note, setNote] = useState('');
  const file = useRef<HTMLInputElement>(null);
  const pick = async (f?: File) => { if (!f) return; try { setPic(await cloud.avatarFromFile(f)); } catch { setErr(T('Nie udało się wczytać zdjęcia.')); } };
  const run = async (fn: () => Promise<void>) => { setBusy(true); setErr(''); setNote(''); try { await fn(); } catch (e) { setErr(msg(e)); } finally { setBusy(false); } };

  if (user) return <Modal title={T('Twoje konto')} onClose={onClose}>
    <form className="lc-dform" onSubmit={(e: FormEvent) => { e.preventDefault(); void run(async () => { await cloud.saveProfile({ name, position: pos, avatar: pic }); onChanged(); onClose(); }); }}>
      <div className="lc-pic-row"><Avatar name={name || user.email} src={pic} color={user.color} size={72} />
        <div className="lc-col"><button type="button" className="lc-btn" onClick={() => file.current?.click()}>{T('Wybierz zdjęcie')}</button>{pic && <button type="button" className="lc-btn ghost" onClick={() => setPic('')}>{T('Usuń zdjęcie')}</button>}
          <input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} /></div></div>
      <label className="lc-f"><span>{T('Imię i nazwisko')}</span><input className="lc-inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus /></label>
      <label className="lc-f"><span>{T('Stanowisko')}</span><input className="lc-inp" value={pos} onChange={(e) => setPos(e.target.value)} maxLength={80} placeholder={T('np. Kierownik produkcji')} /></label>
      <p className="lc-hint">{user.email}</p>
      {err && <p className="lc-err" role="alert">{err}</p>}
      <div className="lc-row sp"><button type="button" className="lc-btn" data-act="cloud-signout" onClick={() => void run(async () => { await cloud.signOut(); onChanged(); onClose(); })}>{T('Wyloguj')}</button>
        <button className="lc-btn pri" type="submit" disabled={busy || name.trim().length < 2}>{T('Zapisz')}</button></div>
    </form>
  </Modal>;

  const up = mode === 'up';
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (up) {
        if (name.trim().length < 2) throw new Error(T('Wpisz imię i nazwisko (co najmniej 2 znaki).'));
        const r = await cloud.signUp(email, pass, { name, position: pos, avatar: pic });
        if (r.needsConfirm) { setNote(T('Konto utworzone. Kliknij link potwierdzający w wiadomości e-mail, a potem zaloguj się.')); setMode('in'); return; }
      } else await cloud.signIn(email, pass);
      onChanged(); onClose();
    });
  };
  return <Modal title={up ? T('Załóż konto w chmurze') : T('Zaloguj się do chmury')} onClose={onClose}>
    <form className="lc-dform" onSubmit={submit}>
      <p className="lc-sub">{up ? T('Konto pozwala pracować z innymi nad jednym projektem. Treść projektów jest szyfrowana – nie widzi jej nawet serwer.') : T('Użyj konta, które założono w Klaps Planer.')}</p>
      {up && <div className="lc-pic-row"><Avatar name={name || '?'} src={pic} size={56} />
        <div className="lc-col"><button type="button" className="lc-btn" onClick={() => file.current?.click()}>{T('Dodaj zdjęcie (opcjonalnie)')}</button><input ref={file} type="file" accept="image/*" hidden onChange={(e) => void pick(e.target.files?.[0])} /></div></div>}
      {up && <div className="lc-two"><label className="lc-f"><span>{T('Imię i nazwisko')}</span><input className="lc-inp" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoComplete="name" /></label>
        <label className="lc-f"><span>{T('Stanowisko')}</span><input className="lc-inp" value={pos} onChange={(e) => setPos(e.target.value)} maxLength={80} placeholder={T('np. Kierownik produkcji')} /></label></div>}
      <label className="lc-f"><span>{T('Adres e-mail')}</span><input className="lc-inp" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoFocus required /></label>
      <label className="lc-f"><span>{T('Hasło')}</span><input className="lc-inp" type="password" value={pass} onChange={(e) => setPass(e.target.value)} autoComplete={up ? 'new-password' : 'current-password'} minLength={8} required /></label>
      {note && <p className="lc-ok" role="status">{note}</p>}
      {err && <p className="lc-err" role="alert">{err}</p>}
      <div className="lc-row sp">
        <button type="button" className="lc-btn ghost" data-act="cloud-switch" onClick={() => { setMode(up ? 'in' : 'up'); setErr(''); }}>{up ? T('Mam już konto') : T('Załóż konto')}</button>
        <button className="lc-btn pri" type="submit" data-act="cloud-submit" disabled={busy}>{up ? T('Utwórz konto') : T('Zaloguj')}</button></div>
      {!up && <button type="button" className="lc-link" onClick={() => void run(async () => { if (!email.trim()) throw new Error(T('Wpisz adres e-mail.')); await cloud.resetPassword(email); setNote(T('Wysłano wiadomość z linkiem do zmiany hasła.')); })}>{T('Nie pamiętam hasła')}</button>}
    </form>
  </Modal>;
}

/* ---------- dołączanie kodem ---------- */
export function JoinModal({ onClose, onJoined }: { onClose: () => void; onJoined: (id: string, role: Role) => void }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async (e: FormEvent) => { e.preventDefault(); setBusy(true); setErr(''); try { const r = await cloud.redeemInvite(code); onJoined(r.id, r.role); onClose(); } catch (x) { setErr(msg(x)); setBusy(false); } };
  return <Modal title={T('Dołącz do projektu')} onClose={onClose}>
    <form className="lc-dform" onSubmit={go}>
      <p className="lc-sub">{T('Wklej kod zaproszenia od właściciela projektu. Kod zawiera też klucz szyfrowania, więc zachowaj go w tajemnicy.')}</p>
      <label className="lc-f"><span>{T('Kod zaproszenia')}</span><textarea className="lc-inp code" value={code} onChange={(e) => setCode(e.target.value)} rows={3} spellCheck={false} placeholder="KLAPS-XXXXX-XXXXX-…" autoFocus data-act="join-code" /></label>
      {err && <p className="lc-err" role="alert">{err}</p>}
      <div className="lc-row"><button className="lc-btn pri" type="submit" data-act="join-go" disabled={busy || code.trim().length < 20}>{T('Dołącz')}</button><button type="button" className="lc-btn" onClick={onClose}>{T('Anuluj')}</button></div>
    </form>
  </Modal>;
}

/* ---------- panel zarządzania ---------- */
const copy = async (s: string) => { try { await navigator.clipboard.writeText(s); return true; } catch { return false; } };
const when = (ts: number | null, lang: string) => (ts ? new Date(ts).toLocaleString(lang, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export function Manage({ me, lang, initial, onBack, onOpen, onJoin }: { me: CloudUser; lang: string; initial?: string; onBack: () => void; onOpen: (p: CloudProject) => void; onJoin: () => void }) {
  const [list, setList] = useState<CloudProject[] | null>(null);
  const [sel, setSel] = useState<string | undefined>(initial);
  const [err, setErr] = useState('');
  const load = useCallback(async () => { try { const l = await cloud.listProjects(); setList(l); setSel((s) => s && l.some((p) => p.id === s) ? s : l[0]?.id); } catch (e) { setErr(msg(e)); setList([]); } }, []);
  useEffect(() => { void load(); }, [load]);
  const cur = list?.find((p) => p.id === sel);
  return <div className="lc-manage">
    <header className="lc-head"><button type="button" className="lc-back" data-act="manage-back" onClick={onBack}>{ic('left')}{T('Projekty')}</button><h2>{T('Zarządzanie')}</h2>
      <button type="button" className="lc-btn" data-act="manage-join" onClick={onJoin}>{ic('link')}{T('Dołącz kodem')}</button></header>
    {err && <p className="lc-err" role="alert">{err}</p>}
    {list === null ? <div className="lc-empty"><span className="lc-spin" /></div>
      : !list.length ? <div className="lc-empty"><p>{T('Nie masz jeszcze projektów w chmurze. Utwórz projekt w zakładce „Chmura” albo dołącz kodem zaproszenia.')}</p></div>
      : <div className="lc-mgrid">
        <ul className="lc-mlist">{list.map((p) => <li key={p.id}><button type="button" aria-pressed={p.id === sel} data-act="manage-pick" data-id={p.id} onClick={() => setSel(p.id)}><b>{p.title}</b><small>{T(ROLE_LABEL[p.role])} · {p.members}</small></button></li>)}</ul>
        {cur ? <Detail key={cur.id} p={cur} me={me} lang={lang} onChanged={load} onOpen={() => onOpen(cur)} onJoin={onJoin} /> : null}
      </div>}
  </div>;
}

function Detail({ p, me, lang, onChanged, onOpen, onJoin }: { p: CloudProject; me: CloudUser; lang: string; onChanged: () => Promise<void>; onOpen: () => void; onJoin: () => void }) {
  const [tab, setTab] = useState<'people' | 'invites' | 'project'>('people');
  const owner = p.role === 'owner';
  return <section className="lc-mdet" aria-label={p.title}>
    <div className="lc-mtitle"><h3>{p.title}</h3>{!p.locked && <button type="button" className="lc-btn pri" data-act="manage-open" onClick={onOpen}>{T('Otwórz')}{ic('right')}</button>}</div>
    {p.locked ? <div className="lc-lockbox"><p>{T('Ten projekt jest zaszyfrowany, a na tym komputerze nie ma jego klucza. Wpisz kod zaproszenia, aby go odblokować.')}</p><button type="button" className="lc-btn pri" onClick={onJoin}>{T('Wpisz kod zaproszenia')}</button></div> : <>
      <div className="lc-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'people'} data-act="tab-people" onClick={() => setTab('people')}>{T('Osoby')}</button>
        {owner && <button type="button" role="tab" aria-selected={tab === 'invites'} data-act="tab-invites" onClick={() => setTab('invites')}>{T('Zaproszenia')}</button>}
        <button type="button" role="tab" aria-selected={tab === 'project'} data-act="tab-project" onClick={() => setTab('project')}>{T('Projekt')}</button>
      </div>
      {tab === 'people' && <People p={p} me={me} onChanged={onChanged} />}
      {tab === 'invites' && owner && <Invites p={p} lang={lang} />}
      {tab === 'project' && <ProjectTab p={p} onChanged={onChanged} />}
    </>}
  </section>;
}

function People({ p, me, onChanged }: { p: CloudProject; me: CloudUser; onChanged: () => Promise<void> }) {
  const [rows, setRows] = useState<Member[] | null>(null);
  const [err, setErr] = useState('');
  const owner = p.role === 'owner';
  const load = useCallback(async () => { try { setRows(await cloud.members(p.id)); } catch (e) { setErr(msg(e)); } }, [p.id]);
  useEffect(() => { void load(); }, [load]);
  const act = async (fn: () => Promise<void>) => { setErr(''); try { await fn(); await load(); await onChanged(); } catch (e) { setErr(msg(e)); } };
  return <div>
    {err && <p className="lc-err" role="alert">{err}</p>}
    {rows === null ? <div className="lc-empty"><span className="lc-spin" /></div> : <ul className="lc-people">{rows.map((m) => <li key={m.id} data-user={m.id}>
      <Avatar name={m.name} src={m.avatar} color={m.color} size={38} />
      <span className="lc-pt"><b>{m.name}{m.id === me.id && <em>{T('Ty')}</em>}</b><small>{m.position || T('Bez stanowiska')}</small></span>
      {owner && m.role !== 'owner' ? <select className="lc-sel" value={m.role} aria-label={T('Rola')} data-act="member-role" onChange={(e) => void act(() => cloud.setRole(p.id, m.id, e.target.value as 'editor' | 'viewer'))}>
        <option value="editor">{T('Edytor')}</option><option value="viewer">{T('Podgląd')}</option></select> : <span className={'lc-role ' + m.role}>{T(ROLE_LABEL[m.role])}</span>}
      {owner && m.role !== 'owner' && <span className="lc-mact">
        <button type="button" className="lc-ico dk" title={T('Przekaż własność')} aria-label={T('Przekaż własność')} onClick={() => { if (confirm(T('Przekazać własność projektu osobie {n}? Stracisz uprawnienia właściciela.', { n: m.name }))) void act(() => cloud.transferOwner(p.id, m.id)); }}>{ic('shield')}</button>
        <button type="button" className="lc-ico dk" title={T('Usuń z projektu')} aria-label={T('Usuń z projektu')} data-act="member-remove" onClick={() => { if (confirm(T('Usunąć osobę {n} z projektu?', { n: m.name }))) void act(() => cloud.removeMember(p.id, m.id)); }}>{ic('trash')}</button></span>}
    </li>)}</ul>}
    <p className="lc-hint">{T('Role: Edytor zmienia plan, Podgląd tylko czyta. Właściciel zarządza osobami i kodami.')}</p>
    {owner && <p className="lc-hint">{T('Po usunięciu osoby warto zmienić klucz projektu (zakładka „Projekt”).')}</p>}
  </div>;
}

function Invites({ p, lang }: { p: CloudProject; lang: string }) {
  const [rows, setRows] = useState<InviteRow[] | null>(null);
  const [role, setRole] = useState<'editor' | 'viewer'>('editor');
  const [hours, setHours] = useState(168);
  const [uses, setUses] = useState(0);
  const [fresh, setFresh] = useState('');
  const [copied, setCopied] = useState('');
  const [err, setErr] = useState('');
  const load = useCallback(async () => { try { setRows(await cloud.invites(p.id)); } catch (e) { setErr(msg(e)); setRows([]); } }, [p.id]);
  useEffect(() => { void load(); }, [load]);
  const make = async () => { setErr(''); try { setFresh(await cloud.createInvite(p.id, role, hours, uses)); await load(); } catch (e) { setErr(msg(e)); } };
  const cp = async (c: string) => { if (await copy(c)) { setCopied(c); setTimeout(() => setCopied(''), 1500); } };
  const state = (r: InviteRow) => r.revoked ? T('unieważniony') : r.expiresAt && r.expiresAt < Date.now() ? T('wygasł') : r.maxUses && r.uses >= r.maxUses ? T('wykorzystany') : T('aktywny');
  return <div>
    <div className="lc-inv-new">
      <label className="lc-f"><span>{T('Rola')}</span><select className="lc-sel" value={role} onChange={(e) => setRole(e.target.value as 'editor' | 'viewer')} data-act="inv-role"><option value="editor">{T('Edytor')}</option><option value="viewer">{T('Podgląd')}</option></select></label>
      <label className="lc-f"><span>{T('Ważny')}</span><select className="lc-sel" value={hours} onChange={(e) => setHours(+e.target.value)}><option value={24}>{T('24 godziny')}</option><option value={168}>{T('7 dni')}</option><option value={720}>{T('30 dni')}</option><option value={0}>{T('bez limitu')}</option></select></label>
      <label className="lc-f"><span>{T('Użyć')}</span><select className="lc-sel" value={uses} onChange={(e) => setUses(+e.target.value)}><option value={1}>1</option><option value={5}>5</option><option value={0}>{T('bez limitu')}</option></select></label>
      <button type="button" className="lc-btn pri" data-act="inv-create" onClick={() => void make()}>{ic('plus')}{T('Utwórz kod')}</button>
    </div>
    {fresh && <div className="lc-code" data-act="inv-fresh"><code>{fresh}</code><button type="button" className="lc-btn" onClick={() => void cp(fresh)}>{copied === fresh ? T('Skopiowano') : T('Kopiuj')}</button></div>}
    {err && <p className="lc-err" role="alert">{err}</p>}
    <ul className="lc-invs">{(rows || []).map((r) => <li key={r.id}>
      <span className="lc-pt"><b>{T(r.role === 'editor' ? 'Edytor' : 'Podgląd')} · {state(r)}</b><small>{T('użyto {u}', { u: r.uses + (r.maxUses ? '/' + r.maxUses : '') })} · {r.expiresAt ? T('do {d}', { d: when(r.expiresAt, lang) }) : T('bez terminu')}</small></span>
      {r.code && !r.revoked && <button type="button" className="lc-btn sm2" onClick={() => void cp(r.code!)}>{copied === r.code ? T('Skopiowano') : T('Kopiuj')}</button>}
      {!r.revoked && <button type="button" className="lc-btn sm2" data-act="inv-revoke" onClick={() => void cloud.revokeInvite(r.id).then(load).catch((e) => setErr(msg(e)))}>{T('Unieważnij')}</button>}
    </li>)}</ul>
    <p className="lc-hint">{T('Kod zawiera klucz szyfrowania projektu. Przekazuj go tylko zaufanym osobom (najlepiej komunikatorem), a po użyciu unieważnij.')}</p>
  </div>;
}

/** zmiana klucza szyfrowania projektu (właściciel): po usunięciu osoby albo gdy kod zaproszenia mógł wyciec */
function KeyBox({ p }: { p: CloudProject }) {
  const [plan, setPlan] = useState<cloud.KeyPlan | null>(null);
  const [step, setStep] = useState<'idle' | 'sure' | 'busy' | 'done'>('idle');
  const [res, setRes] = useState<{ delivered: number; withoutDevice: string[] } | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { void cloud.keyPlan(p.id).then(setPlan).catch(() => undefined); }, [p.id, step]);
  const go = async () => { setStep('busy'); setErr(''); try { setRes(await cloud.rotateKey(p.id)); setStep('done'); } catch (e) { setErr(msg(e)); setStep('idle'); } };
  return <div className="lc-keybox" data-keybox>
    <h4>{T('Klucz szyfrowania')}</h4>
    <p className="lc-hint">{T('Zmień klucz, gdy usuniesz osobę z projektu albo kod zaproszenia mógł trafić w niepowołane ręce. Dane zostają, a stary klucz i wszystkie dotychczasowe kody przestają działać.')}</p>
    {plan && <p className="lc-hint">{plan.withoutDevice.length ? T('Nowy klucz dostaną automatycznie: {n} os. Nowego kodu zaproszenia będą potrzebować: {names} (nie otworzyły jeszcze projektu w tej wersji programu).', { n: plan.people - plan.withoutDevice.length, names: plan.withoutDevice.join(', ') }) : T('Nowy klucz dostaną automatycznie wszystkie osoby z projektu ({n}).', { n: plan.people })}</p>}
    {err && <p className="lc-err" role="alert">{err}</p>}
    {step === 'done' && res && <p className="lc-ok" role="status" data-key-done>{T('Gotowe. Klucz zmieniony, przekazano go na {n} urządzeń.', { n: res.delivered })}{res.withoutDevice.length ? ' ' + T('Wyślij nowy kod zaproszenia: {names}.', { names: res.withoutDevice.join(', ') }) : ''}</p>}
    {step === 'sure' ? <div className="lc-row"><button className="lc-btn bad" data-act="key-rotate-yes" onClick={() => void go()}>{T('Tak, zmień klucz')}</button><button className="lc-btn" onClick={() => setStep('idle')}>{T('Anuluj')}</button></div>
      : <button className="lc-btn" data-act="key-rotate" disabled={step === 'busy'} onClick={() => setStep('sure')}>{step === 'busy' ? T('Zmieniam klucz…') : T('Zmień klucz projektu')}</button>}
  </div>;
}

function ProjectTab({ p, onChanged }: { p: CloudProject; onChanged: () => Promise<void> }) {
  const [title, setTitle] = useState(p.title);
  const [err, setErr] = useState('');
  const [sure, setSure] = useState(false);
  const act = async (fn: () => Promise<void>) => { setErr(''); try { await fn(); await onChanged(); } catch (e) { setErr(msg(e)); } };
  return <div className="lc-dform">
    {p.role !== 'viewer' && <form className="lc-row" onSubmit={(e) => { e.preventDefault(); void act(() => cloud.renameProject(p.id, title.trim() || p.title)); }}>
      <input className="lc-inp" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={120} aria-label={T('Tytuł filmu')} /><button className="lc-btn" type="submit" disabled={!title.trim() || title === p.title}>{T('Zmień tytuł')}</button></form>}
    {err && <p className="lc-err" role="alert">{err}</p>}
    {p.role === 'owner' && <KeyBox p={p} />}
    <div className="lc-danger">
      {p.role === 'owner' ? (sure
        ? <><p>{T('Usunąć projekt dla wszystkich osób? Tego nie można cofnąć.')}</p><div className="lc-row"><button className="lc-btn bad" data-act="project-delete-yes" onClick={() => void act(() => cloud.deleteProject(p.id))}>{T('Tak, usuń projekt')}</button><button className="lc-btn" onClick={() => setSure(false)}>{T('Anuluj')}</button></div></>
        : <button className="lc-btn bad" data-act="project-delete" onClick={() => setSure(true)}>{ic('trash')}{T('Usuń projekt')}</button>)
        : <button className="lc-btn bad" data-act="project-leave" onClick={() => { if (confirm(T('Opuścić projekt? Stracisz do niego dostęp, dopóki ktoś nie zaprosi Cię ponownie.'))) void act(() => cloud.leaveProject(p.id)); }}>{T('Opuść projekt')}</button>}
    </div>
  </div>;
}
