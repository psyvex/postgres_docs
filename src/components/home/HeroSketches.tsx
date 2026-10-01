'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';

/**
 * Ephemeral "notebook" sketches that draw themselves across the hero, hold, then fade,
 * inspired by the portfolio's PatternCanvas (notes, code, graphs, routes), with Postgres content.
 * Sketches only spawn in empty space: any element marked `data-sketch-avoid` is kept clear.
 */
const NOTES: [string, string][] = [
  ['RLS: default deny', 'no policy → 0 rows'],
  ['SECURITY DEFINER', 'pin search_path!'],
  ['MVCC', 'readers never block writers'],
  ['EXPLAIN first', 'then add the index'],
  ['GRANT to groups', 'never to people'],
  ['WITH CHECK', 'guards the writes'],
  ["set_config(…, true)", 'pool-safe identity'],
  ['BEFORE trigger', 'can rewrite NEW'],
  ['VACUUM', 'reclaims dead tuples'],
  ['JSONB + GIN', 'fast @> lookups'],
  ['owner bypasses RLS', 'unless FORCE'],
  ['app ≠ superuser', 'least privilege'],
];

const SQL = [
  'CREATE INDEX ON tasks USING gin (tags);',
  'VACUUM (ANALYZE) tasks;',
  'ALTER TABLE tasks FORCE ROW LEVEL SECURITY;',
  'SELECT * FROM pg_stat_activity;',
  'REVOKE CREATE ON SCHEMA public FROM PUBLIC;',
  'BEGIN ISOLATION LEVEL SERIALIZABLE;',
  'SET LOCAL statement_timeout = \'5s\';',
];

type Kind = 'note' | 'sql' | 'code' | 'tree' | 'route';
type Sketch = { id: number; kind: Kind; x: number; y: number; tilt: number; payload: number };

const GRID = 48;
const SIZE: Record<Kind, { w: number; h: number }> = {
  note: { w: 230, h: 80 },
  sql: { w: 330, h: 30 },
  code: { w: 180, h: 110 },
  tree: { w: 150, h: 100 },
  route: { w: 200, h: 90 },
};
const KINDS: Kind[] = ['note', 'note', 'note', 'sql', 'sql', 'code', 'tree', 'route'];
const MAX_ALIVE = 5;
const LIFE_MS = 4200;

let nextId = 1;

export function HeroSketches() {
  const still = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const [sketches, setSketches] = useState<Sketch[]>([]);

  useEffect(() => {
    if (still) return;
    const spawn = () => {
      const el = host.current;
      if (!el) return;
      const box = el.getBoundingClientRect();
      const blocked = [...(el.parentElement?.querySelectorAll<HTMLElement>('[data-sketch-avoid]') ?? [])].map((n) => {
        const r = n.getBoundingClientRect();
        return { l: r.left - box.left - 16, t: r.top - box.top - 16, r: r.right - box.left + 16, b: r.bottom - box.top + 16 };
      });
      setSketches((alive) => {
        if (alive.length >= MAX_ALIVE) return alive;
        const kind = KINDS[Math.floor(Math.random() * KINDS.length)];
        const { w, h } = SIZE[kind];
        const taken = [...blocked, ...alive.map((s) => ({ l: s.x - 12, t: s.y - 12, r: s.x + SIZE[s.kind].w + 12, b: s.y + SIZE[s.kind].h + 12 }))];
        // Try a few grid-snapped spots; give up quietly if the hero is crowded.
        for (let attempt = 0; attempt < 24; attempt++) {
          const x = Math.round((Math.random() * (box.width - w - 32) + 16) / GRID) * GRID;
          const y = Math.round((Math.random() * (box.height - h - 32) + 16) / GRID) * GRID;
          const hit = taken.some((b) => x < b.r && x + w > b.l && y < b.b && y + h > b.t);
          if (!hit && x >= 0 && y >= 0) {
            const payload = kind === 'note' ? Math.floor(Math.random() * NOTES.length) : kind === 'sql' ? Math.floor(Math.random() * SQL.length) : Math.floor(Math.random() * 1000);
            return [...alive, { id: nextId++, kind, x, y, tilt: (Math.random() - 0.5) * 6, payload }];
          }
        }
        return alive;
      });
    };
    spawn();
    const timer = setInterval(spawn, 1100);
    return () => clearInterval(timer);
  }, [still]);

  const remove = (id: number) => setSketches((s) => s.filter((x) => x.id !== id));

  return (
    <div ref={host} aria-hidden className="pointer-events-none absolute inset-0 -z-[5] overflow-hidden">
      <AnimatePresence>
        {sketches.map((s) => (
          <motion.div
            key={s.id}
            className="absolute"
            style={{ left: s.x, top: s.y, rotate: s.tilt }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1, y: [0, -6] }}
            exit={{ opacity: 0, filter: 'blur(3px)', transition: { duration: 0.9 } }}
            transition={{ opacity: { duration: 0.3 }, y: { duration: LIFE_MS / 1000, ease: 'linear' } }}
            onAnimationComplete={() => setTimeout(() => remove(s.id), 200)}
          >
            <SketchBody sketch={s} />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

const draw = (delay = 0, duration = 1.2) => ({ initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration, delay, ease: 'easeInOut' as const } });

function SketchBody({ sketch }: { sketch: Sketch }) {
  switch (sketch.kind) {
    case 'note': {
      const [a, b] = NOTES[sketch.payload];
      return (
        <div className="relative pl-12 font-hand text-[22px] leading-[1.05] text-brand/60">
          <svg className="absolute left-0 top-1" width="44" height="30" viewBox="0 0 44 30" fill="none">
            <motion.path d="M42 14 C 30 2, 14 4, 4 20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...draw(0, 0.7)} />
            <motion.path d="M4 20 L 3 11 M4 20 L 12 17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" {...draw(0.6, 0.3)} />
          </svg>
          <Reveal delay={0.2}>{a}</Reveal>
          <Reveal delay={0.9} className="text-accent/70">{b}</Reveal>
          <svg className="mt-0.5" width="150" height="8" viewBox="0 0 150 8">
            <motion.path d="M2 5 Q 40 1 75 4 T 148 3" stroke="var(--accent)" strokeOpacity="0.5" strokeWidth="1.6" fill="none" strokeLinecap="round" {...draw(1.5, 0.6)} />
          </svg>
        </div>
      );
    }
    case 'sql':
      return <Typed text={SQL[sketch.payload]} />;
    case 'code':
      return (
        <div className="flex flex-col gap-2.5">
          {[0.9, 0.6, 0.75, 0.4, 0.8, 0.5].map((w, i) => (
            <motion.span
              key={i}
              className="block h-[5px] rounded-full"
              style={{ marginLeft: [0, 18, 18, 36, 18, 0][i], background: i === 0 || i === 4 ? 'color-mix(in srgb, var(--brand) 45%, transparent)' : 'color-mix(in srgb, var(--muted) 30%, transparent)' }}
              initial={{ width: 0 }}
              animate={{ width: w * 160 }}
              transition={{ duration: 0.45, delay: i * 0.18, ease: 'easeOut' }}
            />
          ))}
        </div>
      );
    case 'tree':
      return (
        <svg width="150" height="100" viewBox="0 0 150 100" fill="none" className="text-brand/45">
          {['M75 16 L35 56', 'M75 16 L115 56', 'M35 56 L15 90', 'M35 56 L55 90', 'M115 56 L95 90', 'M115 56 L135 90'].map((d, i) => (
            <motion.path key={d} d={d} stroke="currentColor" strokeWidth="1.4" {...draw(0.15 * i, 0.5)} />
          ))}
          {[[75, 16], [35, 56], [115, 56], [15, 90], [55, 90], [95, 90], [135, 90]].map(([cx, cy], i) => (
            <motion.rect key={i} x={cx - 9} y={cy - 6} width="18" height="12" rx="3" fill="var(--bg)" stroke="currentColor" strokeWidth="1.4" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.12 * i, type: 'spring', stiffness: 400, damping: 18 }} />
          ))}
          <motion.text x="92" y="10" className="font-hand" fontSize="15" fill="var(--accent)" fillOpacity="0.6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}>
            b-tree
          </motion.text>
        </svg>
      );
    case 'route':
      return (
        <svg width="200" height="90" viewBox="0 0 200 90" fill="none">
          <motion.path d="M8 70 C 50 70, 50 20, 100 20 S 150 70, 190 40" stroke="var(--brand)" strokeOpacity="0.45" strokeWidth="1.6" strokeDasharray="5 6" {...draw(0, 1.3)} />
          <motion.path d="M190 40 l -9 1 m 9 -1 l -4 8" stroke="var(--brand)" strokeOpacity="0.55" strokeWidth="1.6" strokeLinecap="round" {...draw(1.2, 0.25)} />
          {[[8, 70, 'app'], [100, 20, 'pg'], [190, 40, 'rows']].map(([cx, cy, label], i) => (
            <g key={i}>
              <motion.circle cx={cx as number} cy={cy as number} r="4" fill="var(--brand)" fillOpacity="0.5" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4 * i }} />
              <motion.text x={(cx as number) - 8} y={(cy as number) + 20} className="font-hand" fontSize="14" fill="var(--muted)" initial={{ opacity: 0 }} animate={{ opacity: 0.8 }} transition={{ delay: 0.4 * i + 0.2 }}>
                {label}
              </motion.text>
            </g>
          ))}
        </svg>
      );
  }
}

/** Left-to-right handwriting reveal. */
function Reveal({ children, delay, className = '' }: { children: React.ReactNode; delay: number; className?: string }) {
  return (
    <motion.div className={`whitespace-nowrap ${className}`} initial={{ clipPath: 'inset(0 100% 0 0)' }} animate={{ clipPath: 'inset(0 0% 0 0)' }} transition={{ duration: 0.7, delay, ease: 'easeOut' }}>
      {children}
    </motion.div>
  );
}

function Typed({ text }: { text: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (n >= text.length) return;
    const t = setTimeout(() => setN((v) => v + 1), 32);
    return () => clearTimeout(t);
  }, [n, text.length]);
  return (
    <div className="whitespace-nowrap font-mono text-[12.5px] text-brand/55">
      <span className="text-accent/60">$ </span>
      {text.slice(0, n)}
      <span className="ml-0.5 inline-block h-3 w-[2px] translate-y-0.5 animate-pulse bg-brand/50" />
    </div>
  );
}
