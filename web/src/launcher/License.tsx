/* Aktywacja programu kluczem licencyjnym – pierwszy krok okna startowego na nowym urządzeniu. */
import { useState, type FormEvent } from 'react';
import { T } from '../domain/i18n';
import { ICONS } from '../lib/icons';
import { usePrefs } from '../state/prefs';
import { desktop, type LicenseStatus } from '../desktop/bridge';

const ic = (n: keyof typeof ICONS) => <span className="ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[n] }} />;

export function LicenseStep({ status, onDone }: { status: LicenseStatus | null; onDone: () => Promise<void> }) {
  const { lang, setPrefs } = usePrefs();
  const [key, setKey] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const api = desktop()?.license;
    if (!api) return;
    setBusy(true); setErr('');
    try {
      const r = await api.activate(key);
      if (r.ok) { await onDone(); return; }
      setErr(r.reason === 'empty' ? T('Wpisz klucz licencyjny.')
        : r.reason === 'format' ? T('To nie wygląda na klucz Klaps Planer. Klucz ma postać KLAPS-RRRR-XXXX-XXXX.')
          : T('Odmowa dostępu: ten klucz licencyjny jest nieprawidłowy. Sprawdź, czy został przepisany bez błędów.'));
    } catch (x: any) { setErr(x && x.message ? x.message : String(x)); }
    setBusy(false);
  };
  return <form className="lc-form lc-lic" onSubmit={submit} noValidate>
    <div className="lc-lic-ic" aria-hidden="true">{ic('lock')}</div>
    <h2>{T('Aktywacja programu')}</h2>
    <p className="lc-sub">{T('Wpisz klucz licencyjny, który otrzymałeś razem z programem. Na tym urządzeniu podajesz go tylko raz.')}</p>
    {status?.revoked && <p className="lc-err" role="alert">{T('Klucz zapisany na tym urządzeniu nie jest już ważny. Wpisz nowy klucz.')}</p>}
    <label className="lc-f"><span>{T('Klucz licencyjny')}</span>
      <input className={'lc-inp lc-key' + (err ? ' bad' : '')} id="lc-key" value={key} autoFocus maxLength={40} autoComplete="off" spellCheck={false} autoCapitalize="characters" inputMode="text"
        placeholder="KLAPS-RRRR-XXXX-XXXX" aria-invalid={!!err} aria-describedby={err ? 'lc-lic-err' : undefined}
        onChange={(e) => { setKey(e.target.value.toUpperCase()); setErr(''); }} /></label>
    {err && <p id="lc-lic-err" className="lc-err" role="alert">{err}</p>}
    <div className="lc-row lc-lic-go">
      <button className="lc-btn pri lg" type="submit" data-act="license-go" disabled={busy || !key.trim()}>{busy ? T('Sprawdzam…') : T('Aktywuj')}{!busy && ic('right')}</button>
      <div className="lc-seg" role="group" aria-label={T('Język interfejsu')}>{(['pl', 'en'] as const).map((l) => <button key={l} type="button" aria-pressed={lang === l} data-act="lic-lang" data-v={l} onClick={() => setPrefs({ lang: l })}>{l.toUpperCase()}</button>)}</div>
    </div>
    <p className="lc-note">{T('Nie masz klucza? Skontaktuj się z osobą, od której otrzymałeś program.')}</p>
  </form>;
}
