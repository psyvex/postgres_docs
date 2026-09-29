'use client';

import { motion, useReducedMotion } from 'motion/react';
import { PgBadge } from '@/components/brand/Marks';
import { WL_BLUE, WL_BOTTOM, WL_NAVY, WL_TOP } from '@/components/brand/paths';

const SIZE = 300; // stage size (px); the mark itself is ~45% of it

/**
 * Centre of the hero universe: the Webelight mark as a live "database core".
 * No plate or border — a soft halo, two counter-rotating energy arcs, halves that breathe
 * apart and back together, and the PostgreSQL badge floating at its lower right.
 */
export function HeroCore() {
  const still = useReducedMotion();
  const spin = (duration: number, dir = 1) => (still ? {} : { animate: { rotate: 360 * dir }, transition: { duration, repeat: Infinity, ease: 'linear' as const } });
  const breathe = (dy: number) => (still ? {} : { animate: { y: [0, dy, 0] }, transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const } });

  return (
    <div className="relative grid place-items-center" style={{ width: SIZE, height: SIZE }}>
      {/* halo */}
      <div
        className="absolute inset-[12%] rounded-full blur-2xl"
        style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--brand) 32%, transparent), transparent 70%)' }}
      />

      {/* energy arcs */}
      <motion.svg className="absolute inset-[6%]" viewBox="0 0 100 100" {...spin(9)}>
        <defs>
          <linearGradient id="core-arc-a" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={WL_BLUE} stopOpacity="0.95" />
            <stop offset="0.55" stopColor={WL_BLUE} stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="none" stroke="url(#core-arc-a)" strokeWidth="2.2" strokeLinecap="round" strokeDasharray="120 182" />
      </motion.svg>
      <motion.svg className="absolute inset-[16%]" viewBox="0 0 100 100" {...spin(14, -1)}>
        <defs>
          <linearGradient id="core-arc-b" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="var(--accent)" stopOpacity="0.8" />
            <stop offset="0.5" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="none" stroke="url(#core-arc-b)" strokeWidth="2" strokeLinecap="round" strokeDasharray="90 212" />
      </motion.svg>

      {/* the mark: halves breathe apart; a light edge keeps navy visible on dark themes */}
      <svg width={SIZE * 0.46} height={SIZE * 0.46} viewBox="-4 -6 92 96" overflow="visible" className="relative drop-shadow-[0_10px_24px_rgba(0,137,255,0.25)]">
        <motion.path d={WL_TOP} fill={WL_BLUE} {...breathe(-2.6)} />
        <motion.path d={WL_BOTTOM} fill={WL_NAVY} stroke="var(--mark-edge)" strokeWidth={1.2} {...breathe(2.6)} />
        {!still && (
          <motion.path
            d={WL_TOP}
            fill="none"
            stroke="#fff"
            strokeWidth={1.6}
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="0.12 0.88"
            animate={{ strokeDashoffset: [0, -1], y: [0, -2.6, 0] }}
            transition={{ strokeDashoffset: { duration: 3, repeat: Infinity, ease: 'linear' }, y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' } }}
            style={{ filter: 'drop-shadow(0 0 3px rgba(255,255,255,.9))' }}
          />
        )}
      </svg>

      {/* PostgreSQL badge: fixed at the lower right of the mark, gently floating (no rotation) */}
      <motion.div className="absolute" style={{ left: '62%', top: '60%' }} {...(still ? {} : { animate: { y: [0, -4, 0] }, transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' as const, delay: 0.4 } })}>
        <PgBadge size={40} style={{ display: 'block', filter: 'drop-shadow(0 6px 14px rgba(51,103,145,.45))' }} />
      </motion.div>
    </div>
  );
}
