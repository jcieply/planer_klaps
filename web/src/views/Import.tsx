/* Scenariusz: wczytanie pliku lub tekstu, podgląd analizy i utworzenie rozpiski. */
import { useRef, useState } from 'react';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import { mutate, useProject } from '../state/project';
import { goTab, setUI, useUI } from '../state/ui';
import { applyImportNow, handlePaste, handleScriptFile, loadSample, reparse } from '../state/actions';
import { kcls, plN, sitesList } from '../lib/format';
import { Btn, Field, PageHead, Select, Stat, cx } from '../components/ui';

export function Import() {
  const st = useProject((s) => s.st)!;
  const imp = useUI((s) => s.imp);
  const paste = useUI((s) => s.paste);
  const pasteText = useUI((s) => s.pasteText);
  const fileRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const head = <PageHead title={T('Scenariusz')} sub={T('Wczytaj scenariusz, a Klaps rozpozna sceny, obsadę i długość w ósemkach stron. Scenariusz nie jest wymagany: możesz też zacząć od pustego projektu i dodawać sceny ręcznie.')} />;
  if (imp.status === 'reading') return <>{head}<div className="card"><div className="card-b"><b>{imp.file}</b><div className="muted" id="imp-progress">{imp.progress || ''}</div></div></div></>;
  const err = imp.status === 'error' ? <div className="notice bad"><div><b>{T('Nie udało się odczytać pliku')}{imp.file ? ' „' + imp.file + '”' : ''}.</b><br />{imp.error}</div></div> : null;
  if (imp.parsed) return <>{head}{err}<Review /></>;
  const eighths = st.scenes.reduce((a, s) => a + s.eighths, 0);
  return <>{head}{err}
    {st.scenes.length > 0 && <div className="card" style={{ marginBottom: 16 }}><div className="card-h"><h2>{T('Aktualny scenariusz')}</h2><span className="muted small">{st.meta.scriptFile || ''}</span><div className="right" style={{ marginLeft: 'auto' }}><Btn act="tab" data-tab="board" onClick={() => goTab('board')}>{T('Przejdź do rozpiski')}</Btn></div></div>
      <div className="card-b"><div className="stats"><Stat v={st.scenes.length} l={T('scen')} /><Stat v={Core.fmtEighths(eighths)} l={T('stron')} /><Stat v={st.cast.length} l={T('postaci')} /><Stat v={sitesList(st).length} l={T('obiektów')} /></div>
        <p className="muted small" style={{ margin: '12px 0 0' }}>{T('Nowa wersja scenariusza? Wczytaj ją poniżej. Klaps zachowa opisy, elementy i plan dla scen o tych samych numerach.')}</p></div></div>}
    <div className="imp-grid"><div>
      <div className={cx('drop', over && 'over')} id="drop-zone" data-drop-file=""
        onDragOver={(e) => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); setOver(true); } }}
        onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver(false); }}
        onDrop={(e) => { e.preventDefault(); e.stopPropagation(); setOver(false); const f = e.dataTransfer.files[0]; if (f) void handleScriptFile(f); }}>
        <h2>{st.scenes.length ? T('Wczytaj nową wersję') : T('Przeciągnij scenariusz tutaj')}</h2>
        <p dangerouslySetInnerHTML={{ __html: T('Klaps czyta teksty scenariuszy z nagłówkami scen w stylu <b>WN. KUCHNIA – DZIEŃ</b> albo <b>INT. KITCHEN – DAY</b>.') }} />
        <div className="fmt"><span>PDF</span><span>FDX</span><span>FOUNTAIN</span><span>DOCX</span><span>TXT</span></div><br />
        <Btn v="primary" big act="pick-file" icon="file" onClick={() => fileRef.current?.click()}>{T('Wybierz plik')}</Btn>
        <input ref={fileRef} type="file" id="file-in" accept=".pdf,.fdx,.fountain,.txt,.text,.md,.docx,.doc,.rtf" hidden onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleScriptFile(f); }} />
      </div>
      <div className="card" style={{ marginTop: 16 }}><div className="card-h"><h3>{T('Wklej tekst')}</h3><span className="muted small">{T('gdy scenariusz masz w innym programie')}</span><Btn sm style={{ marginLeft: 'auto' }} act="paste-toggle" aria-expanded={paste} onClick={() => setUI((s) => { s.paste = !s.paste; })}>{paste ? T('Zwiń') : T('Rozwiń')}</Btn></div>
        {paste && <div className="card-b"><textarea id="paste-text" className="inp paste" placeholder={T('Wklej tutaj scenariusz…')} spellCheck={false} autoFocus value={pasteText} onChange={(e) => { const v = e.target.value; setUI((s) => { s.pasteText = v; }); }} />
          <div className="row" style={{ marginTop: 10 }}><Btn v="primary" act="paste-go" onClick={handlePaste}>{T('Analizuj tekst')}</Btn></div></div>}
      </div></div>
      <div className="card"><div className="card-h"><h3>{T('Co Klaps rozpoznaje')}</h3></div><div className="card-b small">
        <p style={{ marginTop: 0 }} dangerouslySetInnerHTML={{ __html: T('<b>Nagłówki scen:</b> <code>1. WN. DOM ANNY – KUCHNIA – DZIEŃ</code>, <code>SCENA 12. PLENER. ULICA. NOC</code>, <code>INT./EXT. CAR – DUSK</code>.') }} />
        <p dangerouslySetInnerHTML={{ __html: T('<b>Obsada:</b> z wielkich liter nad dialogami (<code>ANNA</code>, <code>MARTA (V.O.)</code>) oraz z imion w opisach akcji.') }} />
        <p dangerouslySetInnerHTML={{ __html: T('<b>Długość sceny:</b> liczona w ósemkach strony, jak w Movie Magic. Z PDF-a dokładnie, z innych plików szacunkowo. Każdą wartość poprawisz ręcznie.') }} />
        <p style={{ marginBottom: 0 }}><b>{T('Brak pliku pod ręką?')}</b></p>
        <div className="row" style={{ marginTop: 8 }}><Btn act="load-sample" onClick={loadSample}>{T('Wczytaj przykładowy scenariusz')}</Btn>{!st.scenes.length && <Btn v="primary" act="start-empty" onClick={() => { goTab('board'); window.scrollTo(0, 0); }}>{T('Zacznij bez scenariusza')}</Btn>}</div>
      </div></div></div>
  </>;
}

function Review() {
  const st = useProject((s) => s.st)!;
  const imp = useUI((s) => s.imp);
  const p = imp.parsed, ps = p.stats;
  const hasScenes = st.scenes.length > 0;
  const isPdf = imp.raw && imp.raw.kind === 'pdf';
  return <div className="imp-grid">
    <div className="card"><div className="card-h"><h2>{T('Wynik analizy')}</h2><span className="muted small">{imp.file} · {T(ps.source)}</span></div><div className="card-b">
      {(p.warnings || []).map((w: any, i: number) => <div key={i} className="notice warn"><div>{T(w.text || w, w.v)}</div></div>)}
      <div className="stats" style={{ marginBottom: 14 }}><Stat v={ps.scenes} l={T('scen')} /><Stat v={Core.fmtEighths(ps.eighths)} l={T('stron')} /><Stat v={ps.cast} l={T('postaci')} /><Stat v={new Set(p.scenes.map((s: any) => s.site)).size} l={T('obiektów')} /></div>
      {p.scenes.length > 0 && <div className="preview"><table><thead><tr><th>{T('Sc.')}</th><th>{T('W/Z')}</th><th>{T('Plan')}</th><th>{T('D/N')}</th><th>{T('Str.')}</th><th>{T('Obsada')}</th></tr></thead>
        <tbody>{p.scenes.map((s: any, i: number) => <tr key={i} className={kcls(s)} style={{ background: 'var(--sb)', color: 'var(--s-ink)' }}><td><b>{s.num}</b></td><td>{Core.IE_LABEL[s.ie] || '—'}</td><td>{s.place || '—'}</td><td>{(Core.TOD[s.tod] || {}).short || ''}</td><td className="num">{Core.fmtEighths(s.eighths)}</td><td>{s.castNames.join(', ')}</td></tr>)}</tbody></table></div>}
    </div></div>
    <div className="card"><div className="card-h"><h3>{T('Ustawienia importu')}</h3></div><div className="card-b" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Field label={T('Postacie wzmiankowane w opisach akcji')}>
        <Select value={st.meta.castMode || 'all'} data-act-change="imp-castmode" options={[['all', T('Tak, także odmienione imiona (zalecane)')], ['caps', T('Tak, tylko zapisane WIELKIMI LITERAMI')], ['off', T('Nie, tylko postacie mówiące')]]} onChange={(v) => { mutate((s) => { s.meta.castMode = v; }); try { reparse(); } catch { /* zostaw */ } }} />
        <span className="muted small">{T('Dzięki temu postać, która w scenie milczy, też trafia do planu.')}</span></Field>
      {isPdf ? <div className="small muted">{T('Strony PDF policzone z układu tekstu: {n} na stronę', { n: plN(ps.linesPerPage, 'wiersz', 'wiersze', 'wierszy') })}{ps.pageOffset ? ', ' + T('pominięto stronę tytułową') : ''}.</div>
        : <Field label={T('Wiersze na stronę scenariusza')}><input className="inp" type="number" min={30} max={80} defaultValue={st.meta.linesPerPage || 55} data-act-change="imp-lpp" onBlur={(e) => { const n = Math.max(30, Math.min(80, +e.target.value || 55)); e.target.value = String(n); mutate((s) => { s.meta.linesPerPage = n; }); try { reparse(); } catch { /* zostaw */ } }} onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} /><span className="muted small">{T('Ten plik nie ma układu stron, więc długość scen jest szacowana. Standard to 55 wierszy.')}</span></Field>}
      {hasScenes && <div className="field"><span className="lbl">{T('W projekcie są już sceny')}</span>
        <label className="opt" style={{ border: 0, padding: '4px 0' }}><input type="radio" name="keep" value="1" data-act-change="imp-keep" checked={!!imp.keep} onChange={() => setUI((s) => { s.imp.keep = true; })} /><div><b>{T('Zachowaj dane scen o tych samych numerach')}</b><span>{T('opisy, elementy, uwagi i plan dni (nowa wersja scenariusza)')}</span></div></label>
        <label className="opt" style={{ border: 0, padding: '4px 0' }}><input type="radio" name="keep" value="0" data-act-change="imp-keep" checked={!imp.keep} onChange={() => setUI((s) => { s.imp.keep = false; })} /><div><b>{T('Zacznij od nowa')}</b><span>{T('usuwa dotychczasowe opisy i plan dni zdjęciowych')}</span></div></label></div>}
      <div className="row"><Btn v="primary" big act="imp-apply" disabled={!p.scenes.length} onClick={applyImportNow}>{hasScenes ? T('Zastosuj nową wersję') : T('Utwórz rozpiskę scen')}</Btn><Btn act="imp-cancel" onClick={() => setUI((s) => { s.imp = { status: 'idle' }; })}>{T('Anuluj')}</Btn></div>
    </div></div></div>;
}
