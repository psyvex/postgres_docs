'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useAnimationFrame, useMotionValue, useReducedMotion, useTime, useTransform, type MotionValue } from 'motion/react';
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

const CENTER = { x: 50, y: 44 }; // % of the scene
/** A flattened ring reads as an orbit seen at an angle; depth (front/back) comes from sin(angle). */
const INNER = { rx: 38, ry: 25 };
const OUTER = { rx: 47, ry: 33 };
const SPOTLIGHT_MS = 3600;
/** Degrees per second the inner ring turns; paused while a node is hovered. */
const ORBIT_SPEED = 5;
/** Fraction of the centre→node distance covered by the core, so links start at its edge. */
const CORE_EDGE = 0.36;

type P = { x: number; y: number };
const edge = (n: P) => ({ x: CENTER.x + (n.x - CENTER.x) * CORE_EDGE, y: CENTER.y + (n.y - CENTER.y) * CORE_EDGE });
/** Curved link from the core's edge to a node: a quadratic Bézier bowed sideways by `bow`. */
function curve(n: P, bow = 0.22) {
  const s = edge(n);
  const dx = n.x - s.x;
  const dy = n.y - s.y;
  return { s, c: { x: (s.x + n.x) / 2 - dy * bow, y: (s.y + n.y) / 2 + dx * bow }, e: n };
}
const arc = (n: P, bow?: number) => {
  const { s, c, e } = curve(n, bow);
  return `M ${s.x} ${s.y} Q ${c.x} ${c.y} ${e.x} ${e.y}`;
};
function along(n: P, t: number, bow?: number): P {
  const { s, c, e } = curve(n, bow);
  const u = 1 - t;
  return { x: u * u * s.x + 2 * u * t * c.x + t * t * e.x, y: u * u * s.y + 2 * u * t * c.y + t * t * e.y };
}
/** Node `i` of `n` on the ring, turned by `rot` degrees. `depth` is 0 at the back, 1 at the front. */
function onRing(i: number, n: number, rot: number, r = INNER) {
  const a = ((-90 + rot + (360 / n) * i) * Math.PI) / 180;
  return { x: CENTER.x + r.rx * Math.cos(a), y: CENTER.y + r.ry * Math.sin(a), depth: (Math.sin(a) + 1) / 2 };
}

/**
 * Home hero: the lab as a small universe seen at an angle. The Postgres Lab mark is the core; ready
 * topics orbit on a tilted ring that slowly turns, shrinking and fading as they pass behind. A
 * spotlight tours them: an arc links the core to the active topic, query packets flow along it, and
 * the card below types that topic's signature SQL.
 */
export function HeroUniverse() {
  const ready = topics.filter((t) => t.status === 'ready');
  const planned = topics.filter((t) => t.status === 'planned');
  const still = useReducedMotion() ?? false;
  const [active, setActive] = useState(0);
  const [hovering, setHovering] = useState(false);

  const topic = ready[active];
  const line = SIGNATURE[topic.slug] ?? topic.tagline;

  // The ring's turn, as a motion value so nodes, link and packets move without re-rendering.
  const rot = useMotionValue(0);
  const paused = useRef(false);
  useEffect(() => {
    paused.current = hovering || still;
  }, [hovering, still]);
  useAnimationFrame((_, dt) => {
    if (!paused.current) rot.set((rot.get() + (dt / 1000) * ORBIT_SPEED) % 360);
  });
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);
  const target = () => onRing(activeRef.current, ready.length, rot.get());
  const link = useTransform(rot, () => arc(target()));
  // Two faint strands either side of the main link: the query's path reads as a channel, not a wire.
  const strandA = useTransform(rot, () => arc(target(), 0.05));
  const strandB = useTransform(rot, () => arc(target(), 0.4));
  const clock = useTime();
  // Stage width in px: nodes move by transform (compositor only), which needs pixels, not percent.
  const stage = useRef<HTMLDivElement>(null);
  const size = useMotionValue(0);
  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => size.set(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, [size]);

  // Auto-tour (paused while the user hovers a node).
  useEffect(() => {
    if (hovering) return;
    const t = setTimeout(() => setActive((a) => (a + 1) % ready.length), SPOTLIGHT_MS);
    return () => clearTimeout(t);
  }, [active, hovering, ready.length]);


  return (
    <div ref={stage} data-sketch-avoid className="relative mx-auto aspect-square w-full max-w-[min(720px,calc(100vh-7rem))]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="link-gradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="var(--brand)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
          <linearGradient id="lane-g" gradientUnits="userSpaceOnUse" x1={CENTER.x - INNER.rx} y1="0" x2={CENTER.x + INNER.rx} y2="0">
            <stop offset="0" stopColor="var(--accent)" />
            <stop offset="0.5" stopColor="var(--brand)" />
            <stop offset="1" stopColor="var(--accent)" />
          </linearGradient>
          {/* fades shared by both ring layers (ids are document-wide, so the front SVG uses them too) */}
          <radialGradient id="edge-fade-g" gradientUnits="userSpaceOnUse" cx={CENTER.x} cy={CENTER.y} r={INNER.rx + 6} gradientTransform={`translate(0 ${CENTER.y * (1 - TILT)}) scale(1 ${TILT})`}>
            <stop offset="0" stopColor="#fff" />
            <stop offset="0.72" stopColor="#fff" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </radialGradient>
          <mask id="edge-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect width="100" height="100" fill="url(#edge-fade-g)" />
          </mask>
          <linearGradient id="depth-fade-g" gradientUnits="userSpaceOnUse" x1="0" y1={CENTER.y - INNER.ry - 4} x2="0" y2={CENTER.y + INNER.ry}>
            <stop offset="0" stopColor="#fff" stopOpacity="0.2" />
            <stop offset="0.55" stopColor="#fff" stopOpacity="0.85" />
            <stop offset="1" stopColor="#fff" />
          </linearGradient>
          <mask id="depth-fade" maskUnits="userSpaceOnUse" x="0" y="0" width="100" height="100">
            <rect width="100" height="100" fill="url(#depth-fade-g)" />
          </mask>
          <radialGradient id="ring-floor" cx="50%" cy="50%" r="50%">
            <stop offset="0" stopColor="var(--brand)" stopOpacity="0.14" />
            <stop offset="1" stopColor="var(--brand)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* the orbit's floor glow and its ring */}
        <ellipse cx={CENTER.x} cy={CENTER.y} rx={INNER.rx + 4} ry={INNER.ry + 3} fill="url(#ring-floor)" />
        {/* Lane and rings sit under two fades that multiply: `edge-fade` dissolves the outer rim instead of
            ending it in a stroke, and `depth-fade` dims the far side so the near side reads closer. */}
        <g mask="url(#edge-fade)">
          <g mask="url(#depth-fade)">
            {/* the topics' lane: a soft band of light rather than a hairline, which read as a wireframe */}
            <ellipse cx={CENTER.x} cy={CENTER.y} rx={INNER.rx} ry={INNER.ry} fill="none" stroke="url(#lane-g)" strokeOpacity={0.09} strokeWidth={34} vectorEffect="non-scaling-stroke" />
            <ellipse cx={CENTER.x} cy={CENTER.y} rx={INNER.rx} ry={INNER.ry} fill="none" stroke="url(#lane-g)" strokeOpacity={0.12} strokeWidth={12} vectorEffect="non-scaling-stroke" />
            <Rings half="back" />
          </g>
        </g>
        {planned.length > 0 && <ellipse cx={CENTER.x} cy={CENTER.y} rx={OUTER.rx} ry={OUTER.ry} fill="none" stroke="var(--muted)" strokeOpacity={0.35} strokeWidth={1.2} strokeDasharray="0.6 1.6" vectorEffect="non-scaling-stroke" />}
        {/* The active link is a query round trip: a channel of three strands, comets carrying the query out
            to the topic, and result rows (green) streaming back to the core. It fades in rather than draws
            in: a pathLength draw fixes its dash length once, and this path moves every frame. */}
        <motion.path key={`sa-${active}`} d={strandA} fill="none" stroke="var(--brand)" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="0.6 1.2" vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
        <motion.path key={`sb-${active}`} d={strandB} fill="none" stroke="var(--accent)" strokeOpacity={0.25} strokeWidth={1} strokeDasharray="0.6 1.2" vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} />
        <motion.path key={`halo-${active}`} d={link} fill="none" stroke="var(--brand)" strokeOpacity={0.14} strokeWidth={10} strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
        <motion.path key={`line-${active}`} d={link} fill="none" stroke="url(#link-gradient)" strokeWidth={1.6} strokeLinecap="round" vectorEffect="non-scaling-stroke" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
        {!still && (
          <>
            {[0, 1].map((k) => (
              <Comet key={`q${k}`} phase={k / 2} period={1600} clock={clock} at={(t) => along(target(), t)} color="var(--brand)" size={1.1} />
            ))}
            {[0, 1, 2, 3].map((k) => (
              <Comet key={`r${k}`} phase={0.25 + k / 4} period={2200} clock={clock} at={(t) => along(target(), 1 - t, 0.4)} color="var(--good)" size={0.6} />
            ))}
          </>
        )}
      </svg>

      {/* core */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%`, zIndex: 20 }}>
        <HeroCore />
      </div>
      {/* the near half of the rings crosses in front of the core, which is what makes it a planet */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" style={{ zIndex: 25 }} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
        <g mask="url(#edge-fade)">
          <Rings half="front" />
        </g>
      </svg>

      {/* planned topics: outer moons orbit slowly along the outer ring (icons stay upright) */}
      {planned.map((t, i) => (
        <Moon key={t.slug} index={i} count={planned.length} title={t.title} icon={t.icon} />
      ))}

      {/* ready topics on the turning ring */}
      {ready.map((t, i) => (
        <Planet
          key={t.slug}
          index={i}
          count={ready.length}
          rot={rot}
          size={size}
          on={i === active}
          slug={t.slug}
          title={t.title}
          icon={t.icon}
          onEnter={() => {
            setHovering(true);
            setActive(i);
          }}
          onLeave={() => setHovering(false)}
        />
      ))}

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
              <TypedLine line={line} />
              <motion.span className="ml-px inline-block h-3 w-[2px] translate-y-0.5 bg-code-text" animate={{ opacity: [1, 0] }} transition={{ repeat: Infinity, duration: 0.6 }} />
            </pre>
            <div className="mt-2 flex gap-1">
              {ready.map((t, i) => (
                <span key={t.slug} className={clsx('h-1 flex-1 overflow-hidden rounded-full bg-line')}>
                  {i === active && !hovering && <motion.span className="block h-full origin-left bg-brand" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: SPOTLIGHT_MS / 1000, ease: 'linear' }} />}
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

/** The signature line, typed in. Its own component so each keystroke re-renders this line, not the universe. */
function TypedLine({ line }: { line: string }) {
  const [typed, setTyped] = useState(0);
  useEffect(() => {
    if (typed >= line.length) return;
    const t = setTimeout(() => setTyped((n) => n + 2), 18);
    return () => clearTimeout(t);
  }, [typed, line.length]);
  return <>{highlightSql(line.slice(0, typed))}</>;
}

/**
 * Saturn-style rings around the core, filling the space between it and the topic orbit: bands of
 * different width and density with a Cassini-style gap, and ring dust drifting through them. Drawn as
 * two halves: the far half sits behind the core, the near half in front of it. The ratio ry/rx matches
 * the orbit's, so the rings and the orbit read as one tilted plane.
 */
const TILT = INNER.ry / INNER.rx;
const BANDS: { rx: number; w: number; o: number }[] = [
  { rx: 17.5, w: 2, o: 0.14 },
  { rx: 19.5, w: 6, o: 0.2 },
  { rx: 22, w: 9, o: 0.26 },
  { rx: 24.2, w: 2, o: 0.36 },
  // the gap
  { rx: 27.2, w: 7, o: 0.22 },
  { rx: 29.4, w: 2, o: 0.32 },
  { rx: 31.2, w: 4, o: 0.12 },
];
/** Deterministic dust (a golden-angle scatter), so the server and the browser draw the same specks. */
const DUST = Array.from({ length: 42 }, (_, i) => ({ r: 17 + ((i * 7.31) % 15), a: (i * 137.508) % 360, s: 0.18 + (i % 4) * 0.08 }));

function Rings({ half }: { half: 'back' | 'front' }) {
  const id = `rings-${half}`;
  const sweep = half === 'back' ? 1 : 0; // back: left → over the top → right; front: under
  return (
    <g>
      <defs>
        <linearGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" x1={CENTER.x - 32} y1="0" x2={CENTER.x + 32} y2="0">
          <stop offset="0" stopColor="var(--accent)" />
          <stop offset="0.5" stopColor="var(--brand)" />
          <stop offset="1" stopColor="var(--accent)" />
        </linearGradient>
        <clipPath id={`${id}-clip`}>
          {half === 'back' ? <rect x="0" y="0" width="100" height={CENTER.y} /> : <rect x="0" y={CENTER.y} width="100" height={100 - CENTER.y} />}
        </clipPath>
      </defs>
      {BANDS.map((b) => {
        const ry = b.rx * TILT;
        return (
          <path
            key={b.rx}
            d={`M ${CENTER.x - b.rx} ${CENTER.y} A ${b.rx} ${ry} 0 0 ${sweep} ${CENTER.x + b.rx} ${CENTER.y}`}
            fill="none"
            stroke={`url(#${id}-g)`}
            strokeOpacity={half === 'back' ? b.o * 0.75 : b.o}
            strokeWidth={b.w}
            vectorEffect="non-scaling-stroke"
          />
        );
      })}
      {/* dust: a circle of specks turned by CSS, squashed into the ring's plane by the parent's scale */}
      <g clipPath={`url(#${id}-clip)`}>
        <g transform={`translate(${CENTER.x} ${CENTER.y}) scale(1 ${TILT})`}>
          <g className="ring-dust">
            {DUST.map((d, i) => (
              <circle key={i} cx={d.r * Math.cos((d.a * Math.PI) / 180)} cy={d.r * Math.sin((d.a * Math.PI) / 180)} r={d.s} fill={i % 3 ? 'var(--brand)' : 'var(--accent)'} fillOpacity={0.55} />
            ))}
          </g>
        </g>
      </g>
    </g>
  );
}

/** Trail length behind a comet's head, as a fraction of the link. */
const TRAIL = [0, 0.03, 0.06, 0.09, 0.12, 0.15];

/**
 * Something travelling the link: a bright head with a tail of shrinking, fading dots. Easing in and
 * out of each end makes it leave and arrive rather than appear and vanish. Plain circles, no filters:
 * a filter re-rasterises every frame.
 */
function Comet({ phase, period, clock, at, color, size }: { phase: number; period: number; clock: MotionValue<number>; at: (t: number) => P; color: string; size: number }) {
  const t = useTransform(clock, (ms) => {
    const v = (ms / period + phase) % 1;
    return v * v * (3 - 2 * v); // smoothstep
  });
  const opacity = useTransform(t, (v) => Math.min(1, Math.sin(v * Math.PI) * 1.6));
  return (
    <motion.g style={{ opacity }}>
      <CometDot t={t} lag={0} at={at} r={size * 2.4} color={color} alpha={0.16} />
      {TRAIL.map((lag, i) => (
        <CometDot key={lag} t={t} lag={lag} at={at} r={size * (1 - i * 0.14)} color={color} alpha={1 - i * 0.16} />
      ))}
    </motion.g>
  );
}

function CometDot({ t, lag, at, r, color, alpha }: { t: MotionValue<number>; lag: number; at: (t: number) => P; r: number; color: string; alpha: number }) {
  const cx = useTransform(t, (v) => at(Math.max(0, v - lag)).x);
  const cy = useTransform(t, (v) => at(Math.max(0, v - lag)).y);
  return <motion.circle cx={cx} cy={cy} r={r} fill={color} fillOpacity={alpha} />;
}

/** A ready topic on the ring: it follows the turn, and scales and fades with depth. */
function Planet({ index, count, rot, size, on, slug, title, icon, onEnter, onLeave }: { index: number; count: number; rot: MotionValue<number>; size: MotionValue<number>; on: boolean; slug: string; title: string; icon: IconName; onEnter: () => void; onLeave: () => void }) {
  // Anchored at the centre and moved by transform: animating left/top re-lays-out every frame, which
  // was the stutter. The stage is square, so one size serves both axes.
  const x = useTransform([rot, size], ([r, w]: number[]) => ((onRing(index, count, r).x - CENTER.x) / 100) * w);
  const y = useTransform([rot, size], ([r, w]: number[]) => ((onRing(index, count, r).y - CENTER.y) / 100) * w);
  const depth = useTransform(rot, (r) => onRing(index, count, r).depth);
  // The active topic is read, not glanced at: it keeps full size even at the back of the ring.
  const scale = useTransform(depth, (d) => (on ? Math.max(1, 0.72 + d * 0.38) : 0.72 + d * 0.38));
  const opacity = useTransform(depth, (d) => (on ? 1 : 0.45 + d * 0.55));
  // Behind the core when at the back of the ring, in front of it at the front.
  const zIndex = useTransform(depth, (d) => (on ? 40 : d > 0.5 ? 30 : 10));
  return (
    <motion.div className="absolute will-change-transform" style={{ left: `${CENTER.x}%`, top: `${CENTER.y}%`, x, y, zIndex }}>
      <Link href={`/learn/${slug}`} onMouseEnter={onEnter} onMouseLeave={onLeave} onFocus={onEnter} onBlur={onLeave} aria-label={title} title={title} className="block -translate-x-1/2 -translate-y-1/2">
        <motion.div style={{ scale, opacity }} className="relative flex flex-col items-center">
          <motion.span animate={{ scale: on ? 1.2 : 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }} className="relative">
            {on && (
              <motion.span
                className="absolute inset-0 rounded-2xl border-2 border-brand"
                initial={{ scale: 1, opacity: 0.7 }}
                animate={{ scale: 1.7, opacity: 0 }}
                transition={{ duration: 1.2, delay: 0.55, repeat: Infinity, repeatDelay: 0.4, ease: 'easeOut' }}
              />
            )}
            <span className={clsx('relative grid h-12 w-12 place-items-center rounded-2xl border-2 shadow-card transition-colors', on ? 'border-brand bg-brand text-on-brand' : 'border-line bg-surface text-brand')}>
              <Icon name={icon} size={24} />
            </span>
          </motion.span>
          {/* only the active topic is labelled: twelve labels on one ring is noise */}
          <AnimatePresence>
            {on && (
              <motion.span
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute top-full mt-2.5 whitespace-nowrap rounded-full bg-brand px-2.5 py-0.5 text-[11px] font-bold text-on-brand shadow-card"
              >
                {title}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>
      </Link>
    </motion.div>
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
