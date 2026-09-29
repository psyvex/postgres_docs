'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { animate, motion, useInView, useReducedMotion } from 'motion/react';
import { useRef } from 'react';
import { ArrowRight, Terminal } from 'lucide-react';

export type HeroStat = { label: string; value: number; suffix?: string };

const rise = {
  hidden: { opacity: 0, y: 18 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.55, ease: [0.22, 1, 0.36, 1] as const } }),
};

/** Left column of the home hero: eyebrow, two-tone title, handwritten note, CTAs and count-up stats. */
export function HeroIntro({ stats, firstLesson }: { stats: HeroStat[]; firstLesson: string }) {
  return (
    <div className="relative z-10">
      <motion.p data-sketch-avoid variants={rise} initial="hidden" animate="show" custom={0} className="mb-5 flex w-fit items-center gap-2 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-good opacity-60" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-good" />
        </span>
        PostgreSQL 18 · live in your browser
      </motion.p>

      <motion.h1 data-sketch-avoid variants={rise} initial="hidden" animate="show" custom={1} className="w-fit font-display text-[clamp(3rem,6.2vw,6.5rem)] font-extrabold leading-[0.92] tracking-[-0.045em]">
        Learn Postgres
        <span className="block text-brand">by breaking it</span>
        <span className="block text-muted/70">safely.</span>
      </motion.h1>

      <motion.p data-sketch-avoid variants={rise} initial="hidden" animate="show" custom={2} className="mt-6 max-w-[56ch] text-lg leading-relaxed text-muted">
        An interactive handbook for developers: security, functions, triggers and beyond, explained with animations and runnable examples on a real database, in your browser or against your local server.
      </motion.p>

      <motion.p data-sketch-avoid
        variants={rise}
        initial="hidden"
        animate="show"
        custom={3}
        className="mt-4 w-fit -rotate-2 font-hand text-2xl text-accent"
        style={{ textShadow: '0 0 18px color-mix(in srgb, var(--accent) 18%, transparent)' }}
      >
        real Postgres, in your tab — go on, break it.
      </motion.p>

      <motion.div data-sketch-avoid variants={rise} initial="hidden" animate="show" custom={4} className="mt-8 flex w-fit flex-wrap gap-3">
        <Link
          href={firstLesson}
          className="group flex min-h-[52px] items-center gap-2 rounded-2xl px-6 font-bold text-on-brand transition-transform duration-200 hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, color-mix(in srgb, var(--brand), white 18%), var(--brand))',
            boxShadow: '0 16px 36px -10px color-mix(in srgb, var(--brand) 55%, transparent)',
          }}
        >
          Start learning <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
        <Link href="/playground" className="flex min-h-[52px] items-center gap-2 rounded-2xl border border-line bg-surface/60 px-6 font-bold backdrop-blur transition hover:-translate-y-0.5 hover:border-brand">
          <Terminal className="h-4 w-4 text-brand" /> Open the playground
        </Link>
      </motion.div>

      <motion.div data-sketch-avoid variants={rise} initial="hidden" animate="show" custom={5} className="mt-10 grid max-w-2xl grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <Stat key={s.label} {...s} />
        ))}
      </motion.div>
    </div>
  );
}

function Stat({ label, value, suffix }: HeroStat) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const still = useReducedMotion();
  const [shown, setShown] = useState(still ? value : 0);

  // Count up once when the stat scrolls into view.
  useEffect(() => {
    if (!inView || still) return;
    const controls = animate(0, value, { duration: 1.3, ease: [0.22, 1, 0.36, 1], onUpdate: (v) => setShown(Math.round(v)) });
    return () => controls.stop();
  }, [inView, still, value]);

  return (
    <div ref={ref} className="group rounded-2xl border border-line bg-surface/60 p-4 shadow-card backdrop-blur transition hover:-translate-y-0.5 hover:border-brand">
      <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted">{label}</div>
      <div className="mt-2 font-display text-3xl font-extrabold tracking-tight text-text transition-colors group-hover:text-brand">
        {shown}
        {suffix && <span className="text-lg text-muted">{suffix}</span>}
      </div>
    </div>
  );
}
