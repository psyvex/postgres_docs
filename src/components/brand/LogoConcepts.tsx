'use client';

import { motion, type Transition } from 'motion/react';
import { ElephantAt, PgBadge, WebelightMark } from './Marks';
import { PG_BLUE, WL_BLUE, WL_BOTTOM, WL_NAVY, WL_TOP, WL_VIEWBOX } from './paths';

/**
 * Ten animated logo concepts built from the Webelight symbol and the PostgreSQL elephant. Each is self-contained and loops,
 * so it can serve as a loader; the first frame / last frame doubles as a static logo.
 */
type ConceptProps = { size?: number };

const loop = (duration: number, extra: Transition = {}): Transition => ({ duration, repeat: Infinity, ease: 'easeInOut', ...extra });

/* 1 · Draw & Fill, outlines draw, halves fill, elephant badge stamps in. Best as intro/splash. */
export function DrawFill({ size = 160 }: ConceptProps) {
  const t = loop(4, { times: [0, 0.35, 0.55, 0.85, 1] });
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={WL_VIEWBOX} overflow="visible">
        {[{ d: WL_TOP, c: WL_BLUE }, { d: WL_BOTTOM, c: WL_NAVY }].map(({ d, c }, i) => (
          <motion.path
            key={i}
            d={d}
            stroke={c}
            strokeWidth={1.4}
            animate={{ pathLength: [0, 1, 1, 1, 0], fillOpacity: [0, 0, 1, 1, 0] }}
            fill={c}
            transition={{ ...t, delay: i * 0.15 }}
          />
        ))}
      </svg>
      <motion.div className="absolute" style={{ right: -size * 0.06, bottom: -size * 0.04 }} animate={{ scale: [0, 0, 0, 1.15, 1, 1, 0], rotate: [-40, -40, -40, 8, 0, 0, 0] }} transition={loop(4, { times: [0, 0.4, 0.55, 0.65, 0.72, 0.9, 1] })}>
        <PgBadge size={size * 0.42} />
      </motion.div>
    </div>
  );
}

/* 2 · Tide, the two halves breathe like waves; elephant floats on the navy sea. Best as loader. */
export function Tide({ size = 160 }: ConceptProps) {
  return (
    <svg width={size} height={size} viewBox={WL_VIEWBOX} overflow="visible">
      <motion.path d={WL_TOP} fill={WL_BLUE} animate={{ y: [0, -2.5, 0], rotate: [0, -2, 0] }} style={{ originX: '50%', originY: '50%' }} transition={loop(1.6)} />
      <motion.g animate={{ y: [0, 2.5, 0], rotate: [0, 2, 0] }} style={{ originX: '50%', originY: '50%' }} transition={loop(1.6)}>
        <path d={WL_BOTTOM} fill={WL_NAVY} />
        <motion.g animate={{ y: [0, -1.5, 0], rotate: [-4, 4, -4] }} transition={loop(1.6)} style={{ originX: '50%', originY: '50%' }}>
          <ElephantAt x={30} y={53} s={24} />
        </motion.g>
      </motion.g>
    </svg>
  );
}

/* 3 · Open Vault, the mark splits open and the elephant rises out of it. Loader or reveal. */
export function OpenVault({ size = 160 }: ConceptProps) {
  const t = loop(3, { times: [0, 0.3, 0.7, 1] });
  return (
    <svg width={size} height={size} viewBox="-10 -16 104 116" overflow="visible">
      <motion.g animate={{ scale: [0.2, 1, 1, 0.2], opacity: [0, 1, 1, 0] }} style={{ originX: '50%', originY: '50%' }} transition={t}>
        <circle cx="42" cy="44" r="15" fill={PG_BLUE} />
        <ElephantAt x={32} y={34} s={20} />
      </motion.g>
      <motion.path d={WL_TOP} fill={WL_BLUE} animate={{ y: [0, -16, -16, 0], rotate: [0, -8, -8, 0] }} transition={t} />
      <motion.path d={WL_BOTTOM} fill={WL_NAVY} animate={{ y: [0, 16, 16, 0], rotate: [0, 6, 6, 0] }} transition={t} />
    </svg>
  );
}

/* 4 · Orbit, the elephant circles the Webelight world like a satellite. Loader. */
export function Orbit({ size = 160 }: ConceptProps) {
  const badge = size * 0.28;
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <motion.div animate={{ rotate: [0, -6, 0, 6, 0] }} transition={loop(4)}>
        <WebelightMark size={size * 0.62} />
      </motion.div>
      <motion.div className="absolute inset-0" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
        <motion.div className="absolute left-1/2" style={{ top: 0, marginLeft: -badge / 2 }} animate={{ rotate: -360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
          <PgBadge size={badge} />
        </motion.div>
      </motion.div>
      <div className="pointer-events-none absolute rounded-full border border-dashed" style={{ inset: badge / 2, borderColor: `${WL_BLUE}55` }} />
    </div>
  );
}

/* 5 · Coin Flip, one coin, two faces. Loader, social avatar. */
export function CoinFlip({ size = 160 }: ConceptProps) {
  const face = 'absolute inset-0 grid place-items-center rounded-full [backface-visibility:hidden]';
  return (
    <div style={{ width: size, height: size, perspective: size * 4 }}>
      <motion.div className="relative h-full w-full [transform-style:preserve-3d]" animate={{ rotateY: [0, 0, 180, 180, 360] }} transition={loop(3.2, { times: [0, 0.3, 0.5, 0.8, 1] })}>
        <div className={face} style={{ background: '#fff', boxShadow: `inset 0 0 0 ${size * 0.03}px ${WL_BLUE}33` }}>
          <WebelightMark size={size * 0.72} />
        </div>
        <div className={face} style={{ transform: 'rotateY(180deg)' }}>
          <PgBadge size={size} />
        </div>
      </motion.div>
    </div>
  );
}

/* 6 · Merge, both marks roll in and lock together with a "×". Intro / lockup for slides. */
export function Merge({ size = 160 }: ConceptProps) {
  const s = size * 0.46;
  const t = loop(3.6, { times: [0, 0.3, 0.8, 1] });
  return (
    <div className="flex items-center justify-center" style={{ width: size * 1.3, height: size }}>
      <motion.div animate={{ x: [-size, 0, 0, -size], rotate: [-360, 0, 0, -360], opacity: [0, 1, 1, 0] }} transition={t}>
        <WebelightMark size={s} />
      </motion.div>
      <motion.span className="mx-1 font-display font-extrabold" style={{ fontSize: s * 0.45, color: WL_BLUE }} animate={{ scale: [0, 0, 1.3, 1, 1, 0], opacity: [0, 0, 1, 1, 1, 0] }} transition={loop(3.6, { times: [0, 0.28, 0.36, 0.42, 0.8, 1] })}>
        ×
      </motion.span>
      <motion.div animate={{ x: [size, 0, 0, size], rotate: [360, 0, 0, 360], opacity: [0, 1, 1, 0] }} transition={t}>
        <PgBadge size={s} />
      </motion.div>
    </div>
  );
}

/* 7 · Pulse, "live connection": sonar rings ripple out of the mark. Loader, connection status. */
export function Pulse({ size = 160 }: ConceptProps) {
  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="absolute rounded-full border-2"
          style={{ width: size * 0.6, height: size * 0.6, borderColor: i % 2 ? PG_BLUE : WL_BLUE }}
          animate={{ scale: [1, 1.7], opacity: [0.7, 0] }}
          transition={{ duration: 2.1, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
        />
      ))}
      <motion.svg width={size * 0.6} height={size * 0.6} viewBox={WL_VIEWBOX} animate={{ scale: [1, 1.05, 1] }} transition={loop(0.7)}>
        <path d={WL_TOP} fill={WL_BLUE} />
        <path d={WL_BOTTOM} fill={WL_NAVY} />
        <ElephantAt x={30} y={53} s={24} />
      </motion.svg>
    </div>
  );
}

/* 8 · Data Drop, rows fall into the wave and the database "swallows" them. Loader for queries. */
export function DataDrop({ size = 160 }: ConceptProps) {
  return (
    <svg width={size} height={size} viewBox="-6 -40 96 128" overflow="visible">
      {[0, 1, 2].map((i) => (
        <motion.rect
          key={i}
          x={30}
          width={24}
          height={6}
          rx={3}
          fill={i === 1 ? PG_BLUE : WL_BLUE}
          animate={{ y: [-40, 36], opacity: [0, 1, 1, 0], scaleX: [1, 1, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.5, ease: 'easeIn', times: [0, 0.2, 0.8, 1] }}
        />
      ))}
      <motion.g animate={{ scaleY: [1, 0.96, 1], y: [0, 1.5, 0] }} style={{ originX: '50%', originY: '100%' }} transition={loop(0.5)}>
        <path d={WL_TOP} fill={WL_BLUE} />
        <path d={WL_BOTTOM} fill={WL_NAVY} />
        <ElephantAt x={30} y={53} s={24} />
      </motion.g>
    </svg>
  );
}

/* 9 · Light Trace, "we-be-light": a beam of light runs along the wave. Hero/branding, subtle loader. */
export function LightTrace({ size = 160 }: ConceptProps) {
  return (
    <svg width={size} height={size} viewBox={WL_VIEWBOX} overflow="visible">
      <defs>
        <filter id="wl-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.6" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <path d={WL_TOP} fill={WL_BLUE} />
      <path d={WL_BOTTOM} fill={WL_NAVY} />
      <ElephantAt x={30} y={53} s={24} />
      {[WL_TOP, WL_BOTTOM].map((d, i) => (
        <motion.path
          key={i}
          d={d}
          fill="none"
          stroke="#fff"
          strokeWidth={2}
          strokeLinecap="round"
          filter="url(#wl-glow)"
          pathLength={1}
          strokeDasharray="0.14 0.86"
          animate={{ strokeDashoffset: i ? [1, 0] : [0, -1] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'linear' }}
        />
      ))}
    </svg>
  );
}

/* 10 · DB Stack, the mark becomes the lid of a database cylinder that stacks itself. Loader. */
export function DbStack({ size = 160 }: ConceptProps) {
  const disc = (i: number) => ({ y: [-60, 0, 0, 0, -60], opacity: [0, 1, 1, 1, 0] , transition: loop(3.2, { times: [0, 0.18 + i * 0.1, 0.5, 0.85, 1] }) });
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" overflow="visible">
      {[2, 1, 0].map((i) => {
        const y = 40 + i * 16;
        const a = disc(2 - i);
        return (
          <motion.g key={i} animate={{ y: a.y, opacity: a.opacity }} transition={a.transition}>
            <rect x="18" y={y} width="64" height="14" fill={i % 2 ? WL_BLUE : WL_NAVY} />
            <ellipse cx="50" cy={y + 14} rx="32" ry="8" fill={i % 2 ? WL_BLUE : WL_NAVY} />
            <ellipse cx="50" cy={y} rx="32" ry="8" fill={i % 2 ? '#3aa3ff' : '#223a57'} />
          </motion.g>
        );
      })}
      <motion.g animate={{ y: [-40, -40, 0, 0, -40], opacity: [0, 0, 1, 1, 0], scale: [0.6, 0.6, 1, 1, 0.6] }} style={{ originX: '50%', originY: '50%' }} transition={loop(3.2, { times: [0, 0.5, 0.62, 0.85, 1] })}>
        <g transform="translate(33 6) scale(0.4)">
          <path d={WL_TOP} fill={WL_BLUE} />
          <path d={WL_BOTTOM} fill={WL_NAVY} />
        </g>
      </motion.g>
      <motion.g animate={{ opacity: [0, 0, 1, 1, 0], scale: [0, 0, 1, 1, 0] }} style={{ originX: '50%', originY: '50%' }} transition={loop(3.2, { times: [0, 0.55, 0.65, 0.85, 1] })}>
        <ElephantAt x={40} y={64} s={20} />
      </motion.g>
    </svg>
  );
}

export const CONCEPTS = [
  { id: 1, name: 'Draw & Fill', Component: DrawFill, uses: ['Splash / intro', 'Slide opener'], idea: 'The Webelight wave draws itself, fills with brand color, then the Postgres elephant stamps its badge on.' },
  { id: 2, name: 'Tide', Component: Tide, uses: ['Loader', 'Idle state'], idea: 'Both halves breathe like waves; the elephant floats on the navy sea. Calm, continuous.' },
  { id: 3, name: 'Open Vault', Component: OpenVault, uses: ['Loader', 'Page reveal'], idea: 'The mark splits open like a vault and the Postgres elephant rises out: “your data, inside Webelight”.' },
  { id: 4, name: 'Orbit', Component: Orbit, uses: ['Loader', 'Connecting…'], idea: 'The elephant circles the Webelight world like a satellite, and the planet sways gently.' },
  { id: 5, name: 'Coin Flip', Component: CoinFlip, uses: ['Loader', 'Avatar', 'Favicon (static face)'], idea: 'One coin, two faces: Webelight on one side, Postgres on the other.' },
  { id: 6, name: 'Merge', Component: Merge, uses: ['Branding lockup', 'Slides / title'], idea: 'Both marks roll in from opposite sides and lock together with a ×.' },
  { id: 7, name: 'Pulse', Component: Pulse, uses: ['Loader', 'Live DB status'], idea: 'Sonar rings ripple out of the mark: a live connection heartbeat. Could power the Live-DB indicator.' },
  { id: 8, name: 'Data Drop', Component: DataDrop, uses: ['Query loader', 'Run button'], idea: 'Rows drop into the wave and the database gulps them down. Made for “running query…”.' },
  { id: 9, name: 'Light Trace', Component: LightTrace, uses: ['Hero branding', 'Subtle loader', 'Favicon (static)'], idea: '“We-be-light”: a beam of light runs along the wave edges; the elephant rests in the navy bowl.' },
  { id: 10, name: 'DB Stack', Component: DbStack, uses: ['Loader', 'Seeding / reset'], idea: 'Brand-colored disks stack into a database cylinder, the Webelight mark caps it, and the elephant appears.' },
] as const;
