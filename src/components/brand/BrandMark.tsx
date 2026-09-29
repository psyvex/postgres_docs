'use client';

import { motion, type Transition } from 'motion/react';
import { PgBadge } from './Marks';
import { WL_BLUE, WL_BOTTOM, WL_NAVY, WL_TOP, WL_VIEWBOX } from './paths';

type Mode = 'static' | 'once' | 'loop';

/**
 * Official lab mark — "Draw & Fill": the Webelight wave draws itself, fills with brand colour,
 * then the PostgreSQL badge stamps on.
 *   static → final frame (logos, favicon source)
 *   once   → plays the intro and stays on the final frame (header, splash)
 *   loop   → faint ghost always visible; the draw/fill pass repeats on top and the badge bounces (loaders)
 */
export function BrandMark({ size = 40, mode = 'static', title = 'Postgres Lab' }: { size?: number; mode?: Mode; title?: string }) {
  const looping = mode === 'loop';
  const halves = [
    { d: WL_TOP, c: WL_BLUE },
    { d: WL_BOTTOM, c: WL_NAVY },
  ];

  const drawTransition = (i: number): Transition =>
    looping
      ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut', times: [0, 0.4, 0.6, 0.85, 1], delay: i * 0.12 }
      : { pathLength: { duration: 0.9, ease: 'easeInOut', delay: i * 0.12 }, fillOpacity: { duration: 0.45, delay: 0.75 + i * 0.12 } };

  const badgeTransition: Transition = looping
    ? { duration: 2.4, repeat: Infinity, ease: 'easeOut', times: [0, 0.55, 0.62, 0.7, 1] }
    : { delay: 1.15, type: 'spring', stiffness: 420, damping: 14 };

  return (
    <span role="img" aria-label={title} className="relative inline-block shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={WL_VIEWBOX} overflow="visible">
        {/* Dark themes get a white plate so the navy half of the Webelight mark stays visible. */}
        <circle cx="42" cy="42" r="44" fill="var(--mark-plate)" />
        {/* Loop mode keeps a faint ghost of the mark so the loader is never blank, even on frame 0. */}
        {looping && halves.map(({ d, c }, i) => <path key={`ghost-${i}`} d={d} fill={c} opacity={0.18} />)}
        {halves.map(({ d, c }, i) =>
          mode === 'static' ? (
            <path key={i} d={d} fill={c} />
          ) : (
            <motion.path
              key={i}
              d={d}
              fill={c}
              stroke={c}
              strokeWidth={1.4}
              initial={{ pathLength: 0, fillOpacity: 0 }}
              animate={looping ? { pathLength: [0, 1, 1, 1, 0], fillOpacity: [0, 0, 1, 1, 0] } : { pathLength: 1, fillOpacity: 1 }}
              transition={drawTransition(i)}
            />
          ),
        )}
      </svg>
      <motion.span
        className="absolute"
        style={{ right: -size * 0.08, bottom: -size * 0.06 }}
        initial={mode === 'once' ? { scale: 0, rotate: -40 } : false}
        animate={looping ? { scale: [1, 1, 1.18, 0.96, 1], rotate: [0, 0, -10, 4, 0] } : { scale: 1, rotate: 0 }}
        transition={badgeTransition}
      >
        <PgBadge size={size * 0.44} style={{ display: 'block', filter: 'drop-shadow(0 1px 1.5px rgb(0 0 0 / 0.25))' }} />
      </motion.span>
    </span>
  );
}

/** Looping mark with an optional caption — use wherever something is loading. */
export function BrandLoader({ label, size = 56, className = '' }: { label?: string; size?: number; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={`flex flex-col items-center justify-center gap-3 text-sm text-muted ${className}`}>
      <BrandMark size={size} mode="loop" />
      {label && <span className="font-semibold">{label}</span>}
    </div>
  );
}
