'use client';

import { useEffect, useRef } from 'react';
import { motion, useReducedMotion } from 'motion/react';

/** Keywords drifting in the background, deliberately faint; decoration, not content. */
const WORDS = [
  { w: 'SELECT', x: 6, y: 14, d: 22 },
  { w: 'GRANT', x: 38, y: 8, d: 26 },
  { w: 'CREATE POLICY', x: 22, y: 88, d: 24 },
  { w: 'RETURNING', x: 46, y: 74, d: 28 },
  { w: 'BEGIN;', x: 3, y: 60, d: 20 },
  { w: 'TRIGGER', x: 90, y: 10, d: 25 },
  { w: 'JSONB', x: 95, y: 64, d: 23 },
  { w: 'EXPLAIN', x: 62, y: 93, d: 27 },
  { w: 'COMMIT;', x: 86, y: 90, d: 21 },
  { w: 'VACUUM', x: 12, y: 36, d: 26 },
];

const NOISE =
  "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * Full-bleed hero background (inspired by the portfolio's control-plane grid):
 * two line grids that drift and follow the cursor, soft glows, orbit arcs from the core,
 * a slow scan line, film grain, and faint drifting SQL keywords.
 */
export function HeroBackdrop({ coreX = 72, coreY = 50 }: { coreX?: number; coreY?: number }) {
  const still = useReducedMotion();
  const root = useRef<HTMLDivElement>(null);

  // Cursor parallax: grids shift a few px toward the pointer (rAF-throttled, CSS variables only).
  useEffect(() => {
    if (still) return;
    const el = root.current;
    if (!el) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const x = (e.clientX / window.innerWidth - 0.5) * 24;
        const y = (e.clientY / window.innerHeight - 0.5) * 24;
        el.style.setProperty('--px', `${x}px`);
        el.style.setProperty('--py', `${y}px`);
      });
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [still]);

  const fade = `radial-gradient(75% 85% at ${coreX}% ${coreY}%, black 25%, transparent 78%)`;

  return (
    <div ref={root} aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" style={{ ['--px' as string]: '0px', ['--py' as string]: '0px' }}>
      {/* fine + coarse line grids */}
      <div className="absolute inset-0" style={{ maskImage: fade, WebkitMaskImage: fade }}>
        <div
          className="hero-grid absolute -inset-[10%]"
          style={{
            backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            transform: 'translate3d(var(--px), var(--py), 0)',
            transition: 'transform 0.6s cubic-bezier(.22,1,.36,1)',
          }}
        />
        <div
          className="hero-grid hero-grid--slow absolute -inset-[20%] opacity-50"
          style={{
            backgroundImage: 'linear-gradient(color-mix(in srgb, var(--brand) 25%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--brand) 25%, transparent) 1px, transparent 1px)',
            backgroundSize: '192px 192px',
            transform: 'translate3d(calc(var(--px) * -0.5), calc(var(--py) * -0.5), 0)',
            transition: 'transform 0.9s cubic-bezier(.22,1,.36,1)',
          }}
        />
      </div>

      {/* soft glows */}
      <motion.div
        className="absolute h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{ left: `${coreX}%`, top: `${coreY}%`, background: 'radial-gradient(circle, color-mix(in srgb, var(--brand) 20%, transparent), transparent 65%)' }}
        animate={still ? undefined : { scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
      />
      <div className="absolute -left-40 -top-20 h-[30rem] w-[30rem] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--accent) 14%, transparent), transparent 65%)' }} />

      {/* orbit arcs radiating from the core */}
      <svg className="absolute inset-0 h-full w-full">
        {[260, 420, 600, 800].map((r, i) => (
          <motion.circle
            key={r}
            cx={`${coreX}%`}
            cy={`${coreY}%`}
            r={r}
            fill="none"
            stroke="var(--brand)"
            strokeOpacity={0.16 - i * 0.03}
            strokeWidth={1}
            strokeDasharray={i % 2 ? '2 10' : '1 6'}
            animate={still ? undefined : { strokeDashoffset: [0, i % 2 ? 120 : -120] }}
            transition={{ duration: 40 + i * 12, repeat: Infinity, ease: 'linear' }}
          />
        ))}
      </svg>

      {/* slow scan line */}
      {!still && (
        <motion.div
          className="absolute inset-x-0 h-40"
          style={{ background: 'linear-gradient(180deg, transparent, color-mix(in srgb, var(--brand) 7%, transparent), transparent)' }}
          initial={{ top: '-20%' }}
          animate={{ top: '110%' }}
          transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* drifting SQL keywords */}
      {WORDS.map(({ w, x, y, d }, i) => (
        <motion.span
          key={w}
          className="absolute select-none font-mono text-[11px] font-semibold tracking-wider text-brand"
          style={{ left: `${x}%`, top: `${y}%`, opacity: 0.12 }}
          animate={still ? undefined : { y: [0, i % 2 ? -18 : 18, 0], x: [0, i % 3 ? 10 : -10, 0], opacity: [0.07, 0.18, 0.07] }}
          transition={{ duration: d, repeat: Infinity, ease: 'easeInOut', delay: i * 0.7 }}
        >
          {w}
        </motion.span>
      ))}

      {/* film grain */}
      <div className="absolute inset-0 opacity-[0.05] mix-blend-multiply dark:mix-blend-overlay dark:opacity-[0.06]" style={{ backgroundImage: NOISE, backgroundSize: '256px 256px' }} />

      {/* fade into the rest of the page */}
      <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-bg" />
    </div>
  );
}
