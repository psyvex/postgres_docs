'use client';

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { hangRope, litness, pose, stepRope, type Point } from './rig';

/**
 * A wall sconce fixed to the left or right edge of its nearest positioned ancestor: a wall plate, a
 * short horizontal arm, a shade tilted into the room, and a pull cord that switches it. The beam sets
 * `--lit` (0..1) on every `[data-lit]` element in that ancestor, so cards brighten by how far inside
 * the light they sit.
 *
 * The colour is `--lamp-c`, set by the host (not here) so the cards it lights can use it too.
 *
 * Only the cord moves (it is a verlet chain, so it sways when pulled); the beam is fixed. Per-frame
 * work is written straight to the DOM from one rAF loop that sleeps while the host is off screen.
 * Reduced motion: the cord hangs straight and the switch still works, without the flicker.
 */

type Shade = 'dome' | 'cone';

const SHADES: Record<Shade, { w: number; h: number; body: React.ReactNode }> = {
  dome: {
    w: 84,
    h: 46,
    body: (
      <>
        <path d="M6 42 C6 12 78 12 78 42 Z" className="fill-[var(--lamp-metal)] stroke-[var(--lamp-edge)]" />
        <ellipse className="lamp-bulb" cx="42" cy="42" rx="20" ry="5" />
      </>
    ),
  },
  cone: {
    w: 70,
    h: 56,
    body: (
      <>
        <path d="M26 4 H44 L66 52 H4 Z" className="fill-[var(--lamp-metal)] stroke-[var(--lamp-edge)]" />
        <ellipse className="lamp-bulb" cx="35" cy="52" rx="20" ry="4" />
      </>
    ),
  },
};

const ROPE_POINTS = 7;
const ROPE_SEG = 9;
const ARM = 46;
/** How far the shade tips into the room from straight down, in radians. */
const TILT = 0.62;

export type WallLampProps = {
  /** Which wall of the host the sconce is fixed to. */
  wall: 'left' | 'right';
  /** Height of the wall plate from the host's top, in px. */
  top: number;
  shade: Shade;
  /** Beam half-angle in radians. */
  alpha: number;
  /** Accessible name for the pull cord. */
  label: string;
  className?: string;
  /** A small scene placed where the beam lands, `focusY` px down the host; it plays only while lit. */
  focus?: React.ReactNode;
  focusY?: number;
};

export function WallLamp({ wall, top, shade, alpha, label, className, focus, focusY = 320 }: WallLampProps) {
  const still = useReducedMotion() ?? false;
  const [on, setOn] = useState(false);
  const [flicker, setFlicker] = useState(false);
  const layer = useRef<HTMLDivElement>(null);
  const arm = useRef<SVGLineElement>(null);
  const plate = useRef<SVGRectElement>(null);
  const rope = useRef<SVGPolylineElement>(null);
  const shadeEl = useRef<HTMLDivElement>(null);
  const cone = useRef<HTMLDivElement>(null);
  const wash = useRef<HTMLDivElement>(null);
  const knob = useRef<HTMLButtonElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  // Live values the loop reads without re-subscribing.
  const live = useRef({ on: false, held: false });
  useEffect(() => {
    live.current.on = on;
  }, [on]);
  const sh = SHADES[shade];
  const th = wall === 'left' ? TILT : -TILT;

  const toggle = (next?: boolean) => {
    setOn((was) => {
      const v = next ?? !was;
      if (v && !was && !still) {
        setFlicker(true);
        window.setTimeout(() => setFlicker(false), 700);
      }
      return v;
    });
  };

  // Switch on once, when the room comes into view.
  useEffect(() => {
    const host = layer.current?.parentElement;
    if (!host) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          toggle(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(host);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [still]);

  useEffect(() => {
    const host = layer.current?.parentElement;
    if (!host) return;
    let W = 0;
    let H = 0;
    let cards: { el: HTMLElement; x: number; y: number; top: number }[] = [];
    const measure = () => {
      const r = host.getBoundingClientRect();
      W = r.width;
      H = r.height;
      cards = [...host.querySelectorAll<HTMLElement>('[data-lit]')].map((el) => {
        const c = el.getBoundingClientRect();
        return { el, x: c.left - r.left + c.width / 2, y: c.top - r.top + c.height / 2, top: c.top - r.top };
      });
    };
    measure();
    const wallX = () => (wall === 'left' ? 0 : W);
    const armEnd = () => wallX() + (wall === 'left' ? ARM : -ARM);
    const p0 = pose(armEnd(), 0, th, sh.w, sh.h, top);
    const pts: Point[] = hangRope(ROPE_POINTS, ROPE_SEG, p0.ax, p0.ay);
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    document.fonts?.ready.then(measure);

    let prev = performance.now();
    let raf = 0;
    let visible = true;
    const vis = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
    vis.observe(host);

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible) {
        prev = now;
        return;
      }
      const dt = Math.min(0.033, (now - prev) / 1000);
      prev = now;
      const s = live.current;
      const p = pose(armEnd(), 0, th, sh.w, sh.h, top);
      if (still && !s.held) {
        pts.forEach((q, i) => {
          q.x = q.px = p.ax;
          q.y = q.py = p.ay + i * ROPE_SEG;
        });
      } else {
        stepRope(pts, ROPE_SEG, p.ax, p.ay, dt, s.held);
      }

      const deg = (-th * 180) / Math.PI;
      arm.current?.setAttribute('x1', String(wallX()));
      arm.current?.setAttribute('y1', String(top));
      arm.current?.setAttribute('x2', String(p.sx));
      arm.current?.setAttribute('y2', String(p.sy));
      plate.current?.setAttribute('x', String(wall === 'left' ? 0 : W - 8));
      if (shadeEl.current) shadeEl.current.style.transform = `translate(${p.sx}px,${p.sy}px) rotate(${deg}deg)`;
      if (cone.current) {
        // Long enough to fade out (the mask) just before the section's bottom edge along the beam.
        const reach = Math.max(80, (H - p.my) / Math.cos(th));
        // Wide enough for the wedge plus its soft edges; the gradient, not the box, draws the shape.
        const half = Math.tan(Math.min(1.2, alpha * 1.3)) * reach;
        const cs = cone.current.style;
        cs.width = `${half * 2}px`;
        cs.height = `${reach}px`;
        cs.marginLeft = `${-half}px`;
        cs.transform = `translate(${p.mx}px,${p.my - 4}px) rotate(${deg}deg)`;
      }
      rope.current?.setAttribute('points', pts.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' '));
      const tail = pts[pts.length - 1];
      if (knob.current) knob.current.style.transform = `translate(${tail.x}px,${tail.y + 8}px)`;
      if (spot.current) {
        // Where the beam crosses `focusY`, kept a margin inside the host: the section clips, and a scene
        // cut by the wall reads as a bug, not a composition.
        const half = spot.current.offsetWidth / 2;
        // …and clear of the cards it lights: the scene ends 32 px above the first one, never on it.
        const firstCard = cards.reduce((m, c) => Math.min(m, c.top), Infinity);
        const fy = Math.min(focusY, firstCard - spot.current.offsetHeight / 2 - 32);
        const fx = Math.max(half + 24, Math.min(W - half - 24, p.mx + (fy - p.my) * Math.tan(th)));
        spot.current.style.transform = `translate(${fx}px,${fy}px) translate(-50%,-50%)`;
      }
      if (wash.current && W) {
        const hitX = p.mx + (H * 0.6 - p.my) * Math.tan(th);
        wash.current.style.setProperty('--lamp-hx', `${((hitX / W) * 100).toFixed(1)}%`);
      }
      for (const c of cards) {
        const lit = s.on ? litness(c.x, c.y, p.mx, p.my, th, alpha) : 0;
        c.el.style.setProperty('--lit', lit.toFixed(3));
      }
    };
    raf = requestAnimationFrame(frame);

    // The cord's knob: a tap, or a pull past 22 px, flips the switch.
    const k = knob.current;
    let pull: null | { y0: number; max: number; moved: boolean } = null;
    const kDown = (e: PointerEvent) => {
      k?.setPointerCapture(e.pointerId);
      pull = { y0: e.clientY, max: 0, moved: false };
      live.current.held = true;
    };
    const kMove = (e: PointerEvent) => {
      if (!pull) return;
      const r = host.getBoundingClientRect();
      const tail = pts[pts.length - 1];
      tail.x = tail.px = e.clientX - r.left;
      tail.y = tail.py = e.clientY - r.top;
      pull.max = Math.max(pull.max, e.clientY - pull.y0);
      if (Math.abs(e.clientY - pull.y0) > 4) pull.moved = true;
    };
    const kUp = () => {
      if (pull && (!pull.moved || pull.max > 22)) toggle();
      pull = null;
      live.current.held = false;
    };
    k?.addEventListener('pointerdown', kDown);
    k?.addEventListener('pointermove', kMove);
    k?.addEventListener('pointerup', kUp);
    k?.addEventListener('pointercancel', kUp);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      vis.disconnect();
      k?.removeEventListener('pointerdown', kDown);
      k?.removeEventListener('pointermove', kMove);
      k?.removeEventListener('pointerup', kUp);
      k?.removeEventListener('pointercancel', kUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wall, top, alpha, still, shade, focusY]);

  return (
    // No z-index on this layer, so the beam (-z) falls behind the section's content while the fixture
    // and cord (z 3..5) stay in front; the host is `isolate`, so nothing escapes the section.
    <div ref={layer} className={clsx('lamp pointer-events-none absolute inset-0', on && 'lamp-on', flicker && 'lamp-flicker', className)}>
      <div ref={wash} aria-hidden className="lamp-wash absolute inset-0 -z-[1]" />
      <svg aria-hidden className="absolute inset-0 z-[3] h-full w-full overflow-visible">
        <rect ref={plate} x="0" y={top - 14} width="8" height="28" rx="2" className="fill-[var(--lamp-metal-2)]" />
        <line ref={arm} x1="0" y1="0" x2="0" y2="0" className="stroke-[var(--lamp-metal-2)]" strokeWidth={3} strokeLinecap="round" />
        <polyline ref={rope} fill="none" className="stroke-[var(--lamp-rope)]" strokeWidth={1.4} strokeLinecap="round" />
      </svg>
      <div
        ref={cone}
        aria-hidden
        className="lamp-cone absolute left-0 top-0 -z-[1] origin-top"
        style={{ '--lamp-a': `${((alpha * 180) / Math.PI).toFixed(2)}deg` } as React.CSSProperties}
      >
        {!still && Array.from({ length: 12 }, (_, i) => <span key={i} className="lamp-mote" style={{ '--i': i, left: `${30 + ((i * 37) % 40)}%`, top: `${8 + ((i * 53) % 40)}%` } as React.CSSProperties} />)}
      </div>
      <div ref={shadeEl} aria-hidden className="absolute left-0 top-0 z-[4] origin-top" style={{ marginLeft: -sh.w / 2 }}>
        <svg width={sh.w} height={sh.h} viewBox={`0 0 ${sh.w} ${sh.h}`} className="block overflow-visible">
          {sh.body}
        </svg>
      </div>
      {focus && (
        <div ref={spot} aria-hidden className="lamp-focus absolute left-0 top-0 z-[1]">
          {focus}
        </div>
      )}
      <button
        ref={knob}
        type="button"
        aria-label={label}
        aria-pressed={on}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggle();
          }
        }}
        className="lamp-knob pointer-events-auto absolute left-0 top-0 z-[5] -ml-[15px] -mt-[15px] grid h-[30px] w-[30px] cursor-grab touch-none place-items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--lamp-c)]"
      />
    </div>
  );
}
