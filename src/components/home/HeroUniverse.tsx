'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion, useTime, useTransform } from 'motion/react';
import clsx from 'clsx';
import { ArrowRight } from 'lucide-react';
import { topics } from '@/content/registry';
import { HeroCore } from './HeroCore';
import { Icon, type IconName } from '@/components/icons';
import { highlightSql } from '@/lib/sql/highlight';

/** One signature line per topic, typed into the spotlight card. Topics without one fall back to their tagline. */
const SIGNATURE: Record<string, string> = {
  'row-level-security': 'CREATE POLICY tenant_read ON tasks USING (org_id = current_org_id());',
  'roles-and-privileges': 'GRANT SELECT (id, name) ON members TO app_anon;',
  'functions-and-procedures': 'CREATE FUNCTION assign_task(bigint, int) RETURNS tasks LANGUAGE plpgsql …',
  triggers: 'CREATE TRIGGER tasks_audit AFTER UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION audit_row();',
  'production-security': "ALTER ROLE api_service SET statement_timeout = '15s';",
};

const CENTER = { x: 50, y: 42 }; // % of the scene
const INNER = { rx: 33, ry: 30 };
const OUTER = { rx: 46, ry: 41 };
const SPOTLIGHT_MS = 3600;
/** Fraction of the centre→node distance covered by the core, so beams start at its edge. */
const CORE_EDGE = 0.42;
const edge = (n: { x: number; y: number }) => ({ x: CENTER.x + (n.x - CENTER.x) * CORE_EDGE, y: CENTER.y + (n.y - CENTER.y) * CORE_EDGE });
/** Curved link from the core's edge to a node: quadratic Bézier bowed sideways for a softer, orbital feel. */
function arc(n: { x: number; y: number }) {
  const s = edge(n);
  const mx = (s.x + n.x) / 2;
  const my = (s.y + n.y) / 2;
  const dx = n.x - s.x;
  const dy = n.y - s.y;
  const bow = 0.28;
  return `M ${s.x} ${s.y} Q ${mx - dy * bow} ${my + dx * bow} ${n.x} ${n.y}`;
}

function onEllipse(i: number, n: number, r: { rx: number; ry: number }, offsetDeg: number) {
  const a = ((offsetDeg + (360 / n) * i) * Math.PI) / 180;
  return { x: CENTER.x + r.rx * Math.cos(a), y: CENTER.y + r.ry * Math.sin(a) };
}

/**
 * Home hero: the lab as a small universe. The Postgres Lab mark is the core, ready topics orbit
 * close, planned topics orbit further out. A spotlight tours the ready topics, sending query
 * packets from the core and typing each topic's signature SQL.
 */
export function HeroUniverse() {
  const ready = topics.filter((t) => t.status === 'ready');
  const planned = topics.filter((t) => t.status === 'planned');
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);
  const [typed, setTyped] = useState(0);

  const topic = ready[active];
  const line = SIGNATURE[topic.slug] ?? topic.tagline;
  const nodes = ready.map((t, i) => ({ t, ...onEllipse(i, ready.length, INNER, -90) }));
  const moons = planned.map((t, i) => ({ t, ...onEllipse(i, planned.length, OUTER, -90 + 180 / planned.length) }));
  const target = nodes[active];

  // Auto-tour (paused while the user hovers a node).
  useEffect(() => {
    if (hovering) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % ready.length), SPOTLIGHT_MS);
    return () => clearTimeout(t);
  }, [active, hovering, ready.length]);

  // Typewriter for the signature line.
  useEffect(() => setTyped(0), [active]);
  useEffect(() => {
    if (typed >= line.length) return;
    const t = setTimeout(() => setTyped((n) => n + 2), 18);
    return () => clearTimeout(t);
  }, [typed, line.length]);

  return (
    <div data-sketch-avoid className="relative mx-auto aspect-square w-full max-w-[min(720px,calc(100vh-7rem))]">

      {/* orbits, beam and packets */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <motion.ellipse cx={CENTER.x} cy={CENTER.y} rx={INNER.rx} ry={INNER.ry} fill="none" stroke="var(--brand)" strokeOpacity={0.55} strokeWidth={1.5} strokeDasharray="1.2 1.2" vectorEffect="non-scaling-stroke" animate={{ strokeDashoffset: [0, -24] }} transition={{ duration: 12, repeat: Infinity, ease: 'linear' }} />
        <motion.ellipse cx={CENTER.x} cy={CENTER.y} rx={OUTER.rx} ry={OUTER.ry} fill="none" stroke="var(--muted)" strokeOpacity={0.4} strokeWidth={1.2} strokeDasharray="0.6 1.6" vectorEffect="non-scaling-stroke" animate={{ strokeDashoffset: [0, 24] }} transition={{ duration: 20, repeat: Infinity, ease: 'linear' }} />
        {/* active link: a curved arc draws itself from the core, then a comet streak runs along it */}
        <g key={`link-${active}`}>
          <motion.path
            d={arc(target)}
            fill="none"
            stroke="var(--brand)"
            strokeOpacity={0.16}
            strokeWidth={7}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.path
            d={arc(target)}
            fill="none"
            stroke="url(#link-gradient)"
            strokeWidth={2}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
          <motion.path
            d={arc(target)}
            fill="none"
            stroke="#fff"
            strokeWidth={3}
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray="0.1 0.9"
            initial={{ strokeDashoffset: 0.1, opacity: 0 }}
            animate={{ strokeDashoffset: [0.1, -0.9], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.1, delay: 0.5, repeat: Infinity, repeatDelay: 0.5, ease: 'easeInOut' }}
            style={{ filter: 'drop-shadow(0 0 4px var(--brand))' }}
          />
        </g>
        <defs>
          <linearGradient id="link-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
      </svg>

      {/* core */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%` }}>
        <HeroCore />
      </div>

      {/* planned topics: outer moons orbit slowly along the outer ring (icons stay upright) */}
      {moons.map(({ t }, i) => (
        <Moon key={t.slug} index={i} count={moons.length} title={t.title} icon={t.icon} />
      ))}

      {/* ready topics: inner planets */}
      {nodes.map(({ t, x, y }, i) => {
        const on = i === active;
        return (
          <Link
            key={t.slug}
            href={`/learn/${t.slug}`}
            onMouseEnter={() => {
              setHovering(true);
              setActive(i);
            }}
            onMouseLeave={() => setHovering(false)}
            className="absolute -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${x}%`, top: `${y}%` }}
            aria-label={t.title}
          >
            <motion.div animate={{ scale: on ? 1.18 : 1, y: on ? 0 : [0, -3, 0] }} transition={on ? { type: 'spring', stiffness: 400, damping: 18 } : { duration: 3 + i * 0.4, repeat: Infinity }} className="flex flex-col items-center gap-1">
              <span className="relative">
                {on && (
                  <motion.span
                    key={`pulse-${active}`}
                    className="absolute inset-0 rounded-2xl border-2 border-brand"
                    initial={{ scale: 1, opacity: 0.7 }}
                    animate={{ scale: 1.7, opacity: 0 }}
                    transition={{ duration: 1.2, delay: 0.55, repeat: Infinity, repeatDelay: 0.4, ease: 'easeOut' }}
                  />
                )}
              <span className={clsx('relative grid h-14 w-14 place-items-center rounded-2xl border-2 shadow-card transition-colors', on ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-brand')}>
                <Icon name={t.icon} size={28} />
              </span>
              </span>
              <span className={clsx('whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold shadow-card transition-colors', on ? 'bg-brand text-on-brand' : 'bg-surface text-muted')}>{t.title}</span>
            </motion.div>
          </Link>
        );
      })}

      {/* spotlight card */}
      <div className="absolute inset-x-[8%] bottom-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={topic.slug}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="rounded-2xl border border-line/70 bg-surface/75 p-3 shadow-card backdrop-blur-md"
          >
            <div className="flex items-center gap-2 text-xs font-bold">
              <Icon name={topic.icon} size={16} className="text-brand" /> {topic.title}
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[10px] text-brand">{topic.track}</span>
              <Link href={`/learn/${topic.slug}`} className="ml-auto flex items-center gap-1 text-[11px] text-brand hover:underline">
                Open lesson <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <pre className="mt-2 overflow-hidden whitespace-pre-wrap break-words rounded-xl bg-code-bg px-3 py-2 font-mono text-[11.5px] leading-relaxed text-code-text">
              {highlightSql(line.slice(0, typed))}
              <motion.span className="ml-px inline-block h-3 w-[2px] translate-y-0.5 bg-code-text" animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} />
            </pre>
            <div className="mt-2 flex gap-1">
              {ready.map((t, i) => (
                <span key={t.slug} className={clsx('h-1 flex-1 overflow-hidden rounded-full bg-line')}>
                  {i === active && !hovering && <motion.span className="block h-full bg-brand" initial={{ width: '0%' }} animate={{ width: '100%' }} transition={{ duration: SPOTLIGHT_MS / 1000, ease: 'linear' }} />}
                  {(i < active || (i === active && hovering)) && <span className="block h-full w-full bg-brand" />}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/** Degrees per second for the outer ring; slow enough to read as ambient motion. */
const MOON_SPEED = 4;

function Moon({ index, count, title, icon }: { index: number; count: number; title: string; icon: IconName }) {
  const still = useReducedMotion();
  const time = useTime();
  const base = -90 + 180 / count + (360 / count) * index;
  const angle = useTransform(time, (ms) => ((base + (still ? 0 : (ms / 1000) * MOON_SPEED)) * Math.PI) / 180);
  const left = useTransform(angle, (a) => `${CENTER.x + OUTER.rx * Math.cos(a)}%`);
  const top = useTransform(angle, (a) => `${CENTER.y + OUTER.ry * Math.sin(a)}%`);
  return (
    <motion.div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left, top }} title={`${title} · coming soon`}>
      <div className="grid h-9 w-9 place-items-center rounded-full border border-dashed border-line bg-surface/80 text-muted opacity-70">
        <Icon name={icon} size={16} />
      </div>
    </motion.div>
  );
}
