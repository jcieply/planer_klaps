/* Animowane logo: klaps otwiera się i zatrzaskuje, plansza błyska. Przy „zmniejszonym ruchu” rysuje się od razu. */
import { useId } from 'react';
import { m, useReducedMotion } from 'motion/react';

export function Logo({ size = 96, pulse = false }: { size?: number; pulse?: boolean }) {
  const id = useId().replace(/:/g, '');
  const calm = useReducedMotion();
  const snap = calm ? { duration: 0 } : { type: 'spring' as const, stiffness: 520, damping: 9, mass: 0.7, delay: 0.55 };
  return <m.svg className="lc-logo" width={size} height={size} viewBox="0 0 120 120" fill="none" role="img" aria-label="Klaps Planer"
    initial={calm ? false : { opacity: 0, scale: 0.86, y: 6 }} animate={{ opacity: 1, scale: pulse ? [1, 1.04, 1] : 1, y: 0 }}
    transition={pulse ? { duration: 1.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}>
    <defs>
      <pattern id={`s${id}`} width="26" height="30" patternUnits="userSpaceOnUse" patternTransform="skewX(-32)">
        <rect width="13" height="30" fill="#F2C230" /><rect x="13" width="13" height="30" fill="#141416" />
      </pattern>
      <clipPath id={`a${id}`}><rect x="12" y="25" width="96" height="19" rx="5" /></clipPath>
      <clipPath id={`b${id}`}><rect x="12" y="46" width="96" height="16" rx="3" /></clipPath>
    </defs>
    {/* plansza */}
    <rect x="12" y="46" width="96" height="64" rx="9" fill="#1E2025" stroke="#363941" strokeWidth="1.5" />
    <g clipPath={`url(#b${id})`}><rect x="0" y="46" width="130" height="16" fill={`url(#s${id})`} /></g>
    <g stroke="#F2C230" strokeWidth="3" strokeLinecap="round" opacity=".9"><path d="M24 78h34M24 91h22" /></g>
    <g stroke="#6A6C73" strokeWidth="3" strokeLinecap="round"><path d="M70 78h22M58 91h34" /></g>
    {/* klaps (ramię na zawiasie po lewej) */}
    <m.g style={{ originX: '12px', originY: '44px' }} initial={calm ? false : { rotate: -27 }} animate={{ rotate: 0 }} transition={snap}>
      <g clipPath={`url(#a${id})`}><rect x="0" y="25" width="130" height="19" fill={`url(#s${id})`} /></g>
      <rect x="12" y="25" width="96" height="19" rx="5" stroke="#363941" strokeWidth="1.5" />
    </m.g>
    <circle cx="12" cy="44" r="3.2" fill="#9A9CA3" />
    {/* błysk w chwili zatrzaśnięcia */}
    {!calm && <m.rect x="12" y="25" width="96" height="85" rx="9" fill="#F2C230" initial={{ opacity: 0 }} animate={{ opacity: [0, 0.28, 0] }} transition={{ delay: 0.62, duration: 0.45, times: [0, 0.2, 1] }} style={{ pointerEvents: 'none' }} />}
  </m.svg>;
}
