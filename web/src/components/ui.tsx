/* Podstawowe elementy interfejsu: ikony, pola edycji (zapis przy pisaniu z łączeniem zmian), przyciski, okna. */
import { forwardRef, startTransition, useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type ButtonHTMLAttributes } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as Tooltip from '@radix-ui/react-tooltip';
import { AnimatePresence, m as motion } from 'motion/react';
import { ICONS, type IconName } from '../lib/icons';
import { T } from '../domain/i18n';
import { Core } from '../domain/core';
import { normTime } from '../lib/format';
import { toast } from '../state/ui';

export const cx = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ');

/** ikona SVG (span z display:contents – svg zachowuje się jak bezpośrednie dziecko) */
export function Icon({ n }: { n: IconName }) {
  return <span className="ic" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[n] }} />;
}

/* ---------- pola edycji ----------
   Pole trzyma wartość lokalnie podczas pisania, a do projektu zapisuje ją po krótkiej przerwie i przy wyjściu z pola.
   Dzięki temu pisanie jest płynne, a „Cofnij” cofa całe słowo, a nie pojedyncze litery. */
type Commit = (v: string) => void;
function useBuffered(value: string, onCommit: Commit, delay = 100) {
  const [v, setV] = useState(value);
  const focused = useRef(false), timer = useRef<ReturnType<typeof setTimeout> | null>(null), last = useRef(value);
  const cur = useRef(value), commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => { if (!focused.current && value !== last.current) { setV(value); last.current = value; cur.current = value; } }, [value]);
  const flush = (x: string) => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } if (x !== last.current) { last.current = x; commit.current(x); } };
  // zamknięcie okna lub szuflady w trakcie pisania nie gubi ostatnich znaków
  useEffect(() => () => { if (cur.current !== last.current) flush(cur.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return {
    v,
    onChange: (x: string) => { setV(x); cur.current = x; if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => flush(x), delay); },
    onFocus: () => { focused.current = true; },
    onBlur: (x: string) => { focused.current = false; flush(x); },
  };
}

type InpProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & { value: string | number | null | undefined; onCommit: Commit; bind?: string; bid?: string | number; label?: string };
/** pole tekstowe zapisywane w trakcie pisania */
export function TextInput({ value, onCommit, bind, bid, label, className, ...rest }: InpProps) {
  const b = useBuffered(value == null ? '' : String(value), onCommit);
  return <input type="text" {...rest} className={cx('inp', className)} value={b.v} aria-label={label || rest['aria-label']} data-bind={bind} data-id={bid != null ? String(bid) : undefined}
    onChange={(e) => b.onChange(e.target.value)} onFocus={b.onFocus} onBlur={(e) => b.onBlur(e.target.value)}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); rest.onKeyDown?.(e); }} />;
}
type TaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange'> & { value: string | null | undefined; onCommit: Commit; bind?: string; bid?: string | number; label?: string };
export function TextArea({ value, onCommit, bind, bid, label, className, ...rest }: TaProps) {
  const b = useBuffered(value || '', onCommit);
  return <textarea {...rest} className={cx('inp', className)} value={b.v} aria-label={label || rest['aria-label']} data-bind={bind} data-id={bid != null ? String(bid) : undefined}
    onChange={(e) => b.onChange(e.target.value)} onFocus={b.onFocus} onBlur={(e) => b.onBlur(e.target.value)} />;
}
/** pole zatwierdzane przy wyjściu (godzina, czas, liczby) – walidacja przed zapisem */
function useOnBlur(value: string, onUnmount?: (v: string) => void) {
  const [v, setV0] = useState(value);
  const focused = useRef(false), cur = useRef(value), dirty = useRef(false), um = useRef(onUnmount);
  um.current = onUnmount;
  useEffect(() => { if (!focused.current) { setV0(value); cur.current = value; dirty.current = false; } }, [value]);
  useEffect(() => () => { if (dirty.current && um.current) um.current(cur.current); }, []);
  const setV = (x: string) => { setV0(x); cur.current = x; dirty.current = focused.current; };
  return { v, setV, focused, done: () => { dirty.current = false; } };
}
/** godzina gg:mm – „7.30”, „730” i „7” poprawiają się same */
export function TimeInput({ value, onCommit, bind, bid, label, className, ...rest }: InpProps) {
  const s = useOnBlur(value == null ? '' : String(value), (x) => { const n = normTime(x); if (n != null && n !== (value || '')) onCommit(n); });
  return <input type="text" inputMode="numeric" maxLength={5} {...rest} className={cx('inp', className)} value={s.v} aria-label={label} data-bind={bind} data-id={bid != null ? String(bid) : undefined} data-time="1"
    onFocus={() => { s.focused.current = true; }} onChange={(e) => s.setV(e.target.value)}
    onBlur={(e) => {
      s.focused.current = false; s.done();
      const n = normTime(e.target.value);
      if (n === null) { toast(T('Wpisz godzinę w formacie gg:mm, np. 7:30.'), 'bad'); s.setV(value == null ? '' : String(value)); return; }
      s.setV(n); if (n !== (value || '')) onCommit(n);
    }}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}
/** czas trwania (h:mm albo minuty) */
export function DurInput({ value, onCommit, bind, bid, label, className, ...rest }: InpProps) {
  const s = useOnBlur(value == null ? '' : String(value), (x) => { const t = x.trim(); if ((t === '' || Core.etaMin(t) != null) && t !== String(value || '')) onCommit(t); });
  return <input type="text" inputMode="numeric" maxLength={8} {...rest} className={cx('inp', className)} value={s.v} aria-label={label} data-bind={bind} data-id={bid != null ? String(bid) : undefined} data-dur="1"
    onFocus={() => { s.focused.current = true; }} onChange={(e) => s.setV(e.target.value)}
    onBlur={(e) => {
      s.focused.current = false; s.done();
      const x = e.target.value.trim();
      if (x !== '' && Core.etaMin(x) == null) { toast(T('Wpisz czas jako h:mm albo w minutach, np. 1:30 lub 45.'), 'bad'); s.setV(value == null ? '' : String(value)); return; }
      if (x !== String(value || '')) onCommit(x);
    }}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}
/** pole zatwierdzane przy wyjściu (np. liczby, nazwa obiektu) */
export function BlurInput({ value, onCommit, bind, bid, label, className, ...rest }: InpProps) {
  const s = useOnBlur(value == null ? '' : String(value), (x) => { if (x !== String(value ?? '')) onCommit(x); });
  return <input type="text" {...rest} className={cx('inp', className)} value={s.v} aria-label={label} data-bind={bind} data-id={bid != null ? String(bid) : undefined}
    onFocus={() => { s.focused.current = true; }} onChange={(e) => s.setV(e.target.value)}
    onBlur={(e) => { s.focused.current = false; s.done(); if (e.target.value !== String(value ?? '')) onCommit(e.target.value); }}
    onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }} />;
}
/** pole „dodaj i Enter” (czyści się po zatwierdzeniu) */
export function AddInput({ onAdd, className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & { onAdd: (v: string) => void }) {
  const [v, setV] = useState('');
  const go = () => { const t = v.trim(); if (t) { onAdd(t); setV(''); } };
  return <input {...rest} className={cx('inp', className)} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); go(); } }} onBlur={go} />;
}
type DataAttrs = { [k: `data-${string}`]: string | number | boolean | undefined };
export function Select({ value, options, onChange, bind, bid, label, className, children, ...rest }: { value: string | number | null | undefined; options: [string | number, string][]; onChange: (v: string) => void; bind?: string; bid?: string | number; label?: string; className?: string; id?: string; disabled?: boolean; children?: ReactNode; style?: React.CSSProperties } & DataAttrs) {
  return <select {...rest} className={cx('inp', className)} value={value == null ? '' : String(value)} aria-label={label} data-bind={bind} data-id={bid != null ? String(bid) : undefined} onChange={(e) => onChange(e.target.value)}>
    {options.map(([v, l]) => <option key={String(v)} value={String(v)}>{l}</option>)}{children}
  </select>;
}
/** lista wyboru „akcji” (np. „Dodaj do dnia…”) – po wyborze wraca do pierwszej pozycji */
export function ActionSelect({ placeholder, options, onPick, className, label, children, ...rest }: { placeholder: string; options: [string, string][]; onPick: (v: string) => void; className?: string; label?: string; children?: ReactNode; style?: React.CSSProperties } & DataAttrs) {
  return <select {...rest} className={className} value="" aria-label={label} onChange={(e) => { const v = e.target.value; if (v) onPick(v); }}>
    <option value="">{placeholder}</option>
    {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}{children}
  </select>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { v?: 'primary' | 'ghost' | 'danger' | 'ghost danger' | ''; sm?: boolean; big?: boolean; icon?: IconName; act?: string };
export const Btn = forwardRef<HTMLButtonElement, BtnProps>(function Btn({ v, sm, big, icon, act, className, children, type, ...rest }, ref) {
  return <button ref={ref} type={type || 'button'} {...rest} data-act={act} className={cx('btn', v, sm && 'sm', big && 'big', className)}>{icon && <Icon n={icon} />}{children}</button>;
});

export function PageHead({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return <div className="page-h"><div><h1>{title}</h1>{sub ? <p>{sub}</p> : null}</div>{right ? <div className="right">{right}</div> : null}</div>;
}
export function ExportBtns({ prefix, enabled, onPdf, onXlsx }: { prefix: string; enabled: boolean; onPdf: () => void; onXlsx: () => void }) {
  return <><Btn act={prefix + '-pdf'} icon="dl" disabled={!enabled} onClick={onPdf}>PDF</Btn><Btn act={prefix + '-xlsx'} icon="dl" disabled={!enabled} onClick={onXlsx}>Excel</Btn></>;
}
export function Seg<V extends string>({ value, items, onChange, label, act, className }: { value: V; items: [V, ReactNode][]; onChange: (v: V) => void; label?: string; act?: string; className?: string }) {
  return <div className={cx('seg', className)} role="group" aria-label={label}>{items.map(([v, l]) => <button type="button" key={v} data-act={act} data-v={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</div>;
}
export function Empty({ title, children }: { title?: ReactNode; children?: ReactNode }) {
  return <div className="empty">{title ? <h3>{title}</h3> : null}{children}</div>;
}
export const Stat = ({ v, l, style }: { v: ReactNode; l: ReactNode; style?: React.CSSProperties }) => <div className="stat"><b className="num" style={style}>{v}</b><span>{l}</span></div>;
export function Field({ label, children, className, style }: { label: ReactNode; children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return <label className={cx('field', className)} style={style}><span className="lbl">{label}</span>{children}</label>;
}
export function Datalist({ id, items }: { id: string; items: string[] }) {
  return <datalist id={id}>{items.map((x) => <option key={x} value={x} />)}</datalist>;
}

/** treść ciężkiego okna rysuje się po pierwszej klatce i w przerywalnym trybie (startTransition) – animacja wejścia nie czeka na treść */
export function Deferred({ children, minHeight = 320 }: { children: ReactNode; minHeight?: number }) {
  const [ready, setReady] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => startTransition(() => setReady(true))); return () => cancelAnimationFrame(id); }, []);
  return ready ? <>{children}</> : <div className="card-b modal-skel" style={{ minHeight }} aria-busy="true"><span className="spin" aria-hidden="true" /></div>;
}

/* ---------- okna (Radix Dialog + animacje Motion) ---------- */
const ease = [0.2, 0.7, 0.2, 1] as const;
export function Modal({ open, onClose, title, className, children, act = 'modal-close', headExtra, describedBy }: { open: boolean; onClose: () => void; title: ReactNode; className?: string; children: ReactNode; act?: string; headExtra?: ReactNode; describedBy?: string }) {
  return <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <AnimatePresence>{open && <Dialog.Portal forceMount>
      <Dialog.Overlay asChild forceMount><motion.div className="scrim" data-act={act} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} /></Dialog.Overlay>
      <Dialog.Content asChild forceMount aria-describedby={describedBy}>
        <motion.div className={cx('modal', className)} exit={{ opacity: 0, transition: { duration: 0.12 } }}>
          <div className="card-h"><Dialog.Title asChild><h2>{title}</h2></Dialog.Title>{headExtra}<Btn sm style={{ marginLeft: 'auto' }} act={act} icon="x" onClick={onClose} aria-label={T('Zamknij')}>{T('Zamknij')}</Btn></div>
          {children}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>}</AnimatePresence>
  </Dialog.Root>;
}
/** szuflada z prawej (szczegóły sceny) */
export function Drawer({ open, onClose, label, children, className }: { open: boolean; onClose: () => void; label: string; children: ReactNode; className?: string }) {
  return <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <AnimatePresence>{open && <Dialog.Portal forceMount>
      <Dialog.Overlay asChild forceMount><motion.div className="scrim" data-act="drawer-close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} /></Dialog.Overlay>
      <Dialog.Content asChild forceMount aria-describedby={undefined}>
        <motion.aside className={cx('drawer', className)} initial={{ x: 40, opacity: 0.4 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 60, opacity: 0, transition: { duration: 0.16 } }} transition={{ duration: 0.3, ease }}>
          <Dialog.Title className="sr">{label}</Dialog.Title>
          {children}
        </motion.aside>
      </Dialog.Content>
    </Dialog.Portal>}</AnimatePresence>
  </Dialog.Root>;
}
/** arkusz od dołu (telefon) */
export function BottomSheet({ open, onClose, label, children }: { open: boolean; onClose: () => void; label: string; children: ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
    <AnimatePresence>{open && <Dialog.Portal forceMount>
      <Dialog.Overlay asChild forceMount><motion.div className="scrim" data-act="more-close" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} /></Dialog.Overlay>
      <Dialog.Content asChild forceMount aria-describedby={undefined}>
        <motion.div className="sheet" initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ duration: 0.32, ease }}>
          <Dialog.Title className="sr">{label}</Dialog.Title>
          <div className="sheet-grip" aria-hidden="true" />{children}
        </motion.div>
      </Dialog.Content>
    </Dialog.Portal>}</AnimatePresence>
  </Dialog.Root>;
}
/** podpowiedź (Radix Tooltip) dla przycisków-ikon */
export function Tip({ label, children }: { label: string; children: ReactNode }) {
  return <Tooltip.Root delayDuration={350}><Tooltip.Trigger asChild>{children}</Tooltip.Trigger><Tooltip.Portal><Tooltip.Content className="tip" sideOffset={6}>{label}<Tooltip.Arrow className="tip-arrow" /></Tooltip.Content></Tooltip.Portal></Tooltip.Root>;
}
