/* Historia wersji projektu: automatyczne kopie co 30 minut pracy, kopie przed ryzykownymi operacjami i wersje zapisane ręcznie. */
import { useCallback, useEffect, useState } from 'react';
import { T } from '../domain/i18n';
import { Store, type SnapMeta } from '../domain/store';
import { Reports } from '../domain/reports';
import { MIME, saveFile } from '../domain/files';
import { KLAPS_EXT } from '../domain/klapsfile';
import { useProject } from '../state/project';
import { setUI, toast, useUI } from '../state/ui';
import { AUTO_SNAPSHOT_MIN, restoreSnapshot, snapshotNow } from '../state/actions';
import { usePrefs } from '../state/prefs';
import { plN } from '../lib/format';
import { Btn, Icon, Modal, cx } from '../components/ui';
import { confirmTwice } from '../components/common';

export function History() {
  const open = useUI((s) => s.history);
  return <Modal open={open} onClose={() => setUI((s) => { s.history = false; })} act="history-close" title={T('Historia wersji')} className="narrow-w">{open ? <HistoryBody /> : null}</Modal>;
}

function HistoryBody() {
  const pid = useProject((s) => s.pid)!;
  const lang = usePrefs((p) => p.lang);
  const [list, setList] = useState<SnapMeta[] | null>(null);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState('');
  const reload = useCallback(() => { Store.snapshots(pid).then(setList, () => setList([])); }, [pid]);
  useEffect(reload, [reload]);
  const locale = lang === 'en' ? 'en-GB' : 'pl-PL';
  const when = (t: number) => {
    const d = new Date(t), today = new Date();
    const day = d.toDateString() === today.toDateString() ? T('dziś') : d.toDateString() === new Date(Date.now() - 864e5).toDateString() ? T('wczoraj') : d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: d.getFullYear() === today.getFullYear() ? undefined : 'numeric' });
    return `${day}, ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  };
  const run = async (key: string, fn: () => Promise<unknown>) => { setBusy(key); try { await fn(); } catch (e: any) { toast(e && e.message ? e.message : String(e), 'bad'); } setBusy(''); reload(); };
  const download = (m: SnapMeta) => run('dl:' + m.id, async () => {
    const st = await Store.snapshotState(m.id);
    st.media = { ...(useProject.getState().st?.media || {}) };
    const d = new Date(m.at), stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}_${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`;
    const fname = `${Reports.slug(st.meta.title || T('Bez tytułu'))}_${T('wersja')}_${stamp}.${KLAPS_EXT}`;
    const r = await saveFile(fname, await Store.exportKlaps(pid, st), MIME.klaps);
    if (r === 'saved') toast(T('Plik {f} gotowy do pobrania.', { f: fname }));
  });
  return <div className="card-b hist">
    <p className="small muted" style={{ marginTop: 0 }}>{T('Klaps zapisuje wersję projektu automatycznie co {n} minut pracy oraz przed importem scenariusza lub shotlisty, ułożeniem planu od nowa i przywróceniem wersji. Wersje są przechowywane na tym urządzeniu (bez mapek, które zostają w projekcie); w zaszyfrowanym projekcie tylko jako szyfrogram.', { n: AUTO_SNAPSHOT_MIN })}</p>
    <form className="row hist-new" onSubmit={(e) => { e.preventDefault(); void run('new', async () => { await snapshotNow(name.trim()); setName(''); }); }}>
      <input className="inp grow" id="hist-name" value={name} placeholder={T('Nazwa wersji, np. przed spotkaniem z reżyserem')} aria-label={T('Nazwa wersji')} onChange={(e) => setName(e.target.value)} maxLength={80} />
      <Btn v="primary" type="submit" act="hist-save" icon="history" disabled={busy === 'new'}>{T('Zapisz wersję teraz')}</Btn>
    </form>
    {list == null ? <div className="muted small"><span className="spin" aria-hidden="true" /> {T('Wczytuję…')}</div>
      : list.length === 0 ? <div className="empty small"><p>{T('Nie ma jeszcze zapisanych wersji. Pierwsza powstanie automatycznie przy kolejnym zapisie.')}</p></div>
        : <ul className="hist-list">{list.map((m, i) => <li key={m.id} className={cx('hist-i', m.auto && 'auto')} data-sid={m.id}>
          <div className="hist-m"><b>{T(m.label)}</b>{i === 0 && <span className="chip acc">{T('najnowsza')}</span>}
            <span className="small muted">{when(m.at)}{m.scenes != null ? ' · ' + plN(m.scenes, 'scena', 'sceny', 'scen') : ''}{m.days != null ? ' · ' + plN(m.days, 'dzień zdjęciowy', 'dni zdjęciowe', 'dni zdjęciowych') : ''}{m.enc ? ' · E2E' : ''}</span></div>
          <div className="rowact">
            <Btn sm act="hist-restore" data-id={m.id} disabled={!!busy} onClick={() => {
              if (!confirmTwice('restore:' + m.id)) { toast(T('Kliknij jeszcze raz „Przywróć”, aby wrócić do tej wersji. Bieżący stan zostanie najpierw zapisany w historii.'), 'bad'); return; }
              void run('r:' + m.id, () => restoreSnapshot(m.id));
            }}>{busy === 'r:' + m.id ? T('Przywracam…') : T('Przywróć')}</Btn>
            <Btn sm v="ghost" act="hist-dl" data-id={m.id} disabled={!!busy} aria-label={T('Pobierz tę wersję jako plik .klaps')} title={T('Pobierz tę wersję jako plik .klaps')} onClick={() => void download(m)}><Icon n="dl" /></Btn>
            <Btn sm v="ghost danger" act="hist-del" data-id={m.id} disabled={!!busy} aria-label={T('Usuń wersję')} title={T('Usuń wersję')} onClick={() => void run('d:' + m.id, () => Store.removeSnapshot(m.id))}><Icon n="trash" /></Btn>
          </div></li>)}</ul>}
  </div>;
}
