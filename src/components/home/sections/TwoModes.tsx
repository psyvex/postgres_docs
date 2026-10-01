'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import clsx from 'clsx';
import { Database, HardDrive, Laptop, Wifi, WifiOff } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { Reveal, SectionHeading } from './Reveal';

type Mode = 'browser' | 'live';

const COPY: Record<Mode, { title: string; points: string[] }> = {
  browser: {
    title: 'Browser: PGlite',
    points: ['PostgreSQL 18 compiled to WebAssembly', 'Saved on this device (IndexedDB)', 'No server, no install, works offline', 'Reset to demo data in one click'],
  },
  live: {
    title: 'Live: your local Postgres',
    points: ['Connects to localhost only (safe by default)', 'Load the demo schema with one click', 'Every example and animation runs against it', 'Password stays in memory, never stored'],
  },
};

/** Interactive comparison of the two database modes, with an animated connection diagram. */
export function TwoModes() {
  const [mode, setMode] = useState<Mode>('browser');
  const [auto, setAuto] = useState(true);
  const still = useReducedMotion();

  // Auto-toggle until the visitor picks one.
  useEffect(() => {
    if (!auto || still) return;
    const t = setTimeout(() => setMode((m) => (m === 'browser' ? 'live' : 'browser')), 5000);
    return () => clearTimeout(t);
  }, [mode, auto, still]);

  const pick = (m: Mode) => {
    setAuto(false);
    setMode(m);
  };

  return (
    <section className="py-16">
      <SectionHeading eyebrow="Two databases, one lab" title={<>Real Postgres, <span className="text-brand">wherever you are.</span></>} copy="Start instantly in the browser, or point the lab at your own server. Every lesson works the same." />
      <Reveal>
        <div className="grid items-stretch gap-6 overflow-hidden rounded-3xl border border-line bg-surface/70 p-4 shadow-card backdrop-blur sm:p-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <div className="flex flex-col">
            <div className="flex w-fit rounded-full border border-line bg-bg p-1">
              {(['browser', 'live'] as Mode[]).map((m) => (
                <button key={m} onClick={() => pick(m)} className={clsx('relative flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-bold transition-colors', mode === m ? 'text-on-brand' : 'text-muted hover:text-text')}>
                  {mode === m && <motion.span layoutId="mode-pill" className="absolute inset-0 rounded-full bg-brand" transition={{ type: 'spring', stiffness: 400, damping: 30 }} />}
                  <span className="relative flex items-center gap-1.5">
                    {m === 'browser' ? <HardDrive className="h-4 w-4" /> : <Database className="h-4 w-4" />}
                    {m === 'browser' ? 'Browser' : 'Live'}
                  </span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="wait">
              <motion.div key={mode} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.25 }} className="mt-6">
                <h3 className="font-display text-2xl font-bold">{COPY[mode].title}</h3>
                <ul className="mt-4 space-y-2.5">
                  {COPY[mode].points.map((p, i) => (
                    <motion.li key={p} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.07 }} className="flex items-start gap-2 text-sm">
                      <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand" /> {p}
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            </AnimatePresence>
          </div>

          <div className="relative min-h-[300px] overflow-hidden rounded-2xl border border-line bg-bg" style={{ backgroundImage: 'radial-gradient(var(--line) 1px, transparent 1px)', backgroundSize: '20px 20px' }}>
            <AnimatePresence mode="wait">
              {mode === 'browser' ? <BrowserDiagram key="b" /> : <LiveDiagram key="l" />}
            </AnimatePresence>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function BrowserDiagram() {
  return (
    <motion.div className="absolute inset-0 grid place-items-center p-6" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        <div className="flex items-center gap-2 border-b border-line bg-surface-2 px-3 py-2">
          <span className="h-2 w-2 rounded-full bg-bad/70" />
          <span className="h-2 w-2 rounded-full bg-warn/70" />
          <span className="h-2 w-2 rounded-full bg-good/70" />
          <span className="ml-2 flex-1 rounded-md bg-bg px-2 py-0.5 font-mono text-[11px] text-muted">postgres-lab · this tab</span>
          <WifiOff className="h-3.5 w-3.5 text-muted" />
        </div>
        <div className="relative flex items-center justify-around gap-4 p-6">
          <Box label="Lesson" sub="SQL runs" />
          <Packets horizontal />
          <div className="relative grid place-items-center">
            <motion.span className="absolute h-24 w-24 rounded-full bg-brand/15" animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.2, 0.7] }} transition={{ duration: 2.4, repeat: Infinity }} />
            <BrandMark size={58} />
            <span className="mt-2 font-mono text-[11px] font-bold text-brand">PGlite · WASM</span>
          </div>
          <Packets horizontal />
          <Box label="IndexedDB" sub="on this device" />
        </div>
      </div>
    </motion.div>
  );
}

function LiveDiagram() {
  return (
    <motion.div className="absolute inset-0 flex items-center justify-around gap-2 p-6" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}>
      <div className="flex flex-col items-center gap-2">
        <span className="grid h-16 w-16 place-items-center rounded-2xl border border-line bg-surface shadow-card">
          <Laptop className="h-8 w-8 text-brand" />
        </span>
        <span className="text-xs font-bold">Postgres Lab</span>
      </div>
      <div className="flex flex-1 flex-col items-center">
        <span className="mb-1 font-mono text-[10px] text-muted">/api/db/query</span>
        <Packets horizontal />
        <span className="mt-1 flex items-center gap-1 font-mono text-[10px] text-good"><Wifi className="h-3 w-3" /> localhost only</span>
      </div>
      <div className="flex flex-col items-center gap-2">
        <span className="relative grid h-24 w-24 place-items-center rounded-full border-2 border-brand/40 bg-surface shadow-card">
          <motion.span className="absolute inset-0 rounded-full border-2 border-brand" animate={{ scale: [1, 1.35], opacity: [0.6, 0] }} transition={{ duration: 1.8, repeat: Infinity }} />
          <Database className="h-10 w-10 text-brand" />
        </span>
        <span className="font-mono text-[11px] font-bold">localhost:5432</span>
      </div>
    </motion.div>
  );
}

function Box({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-line bg-bg px-3 py-2 text-center">
      <span className="text-xs font-bold">{label}</span>
      <span className="text-[10px] text-muted">{sub}</span>
    </div>
  );
}

/** Dots flowing along a connector. */
function Packets({ horizontal }: { horizontal?: boolean }) {
  const still = useReducedMotion();
  return (
    <div className={clsx('relative', horizontal ? 'h-[2px] w-full min-w-10 flex-1' : 'h-10 w-[2px]')} style={{ background: 'repeating-linear-gradient(90deg, var(--line) 0 6px, transparent 6px 10px)' }}>
      {!still &&
        [0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute -top-[3px] h-2 w-2 rounded-full bg-brand shadow-[0_0_8px_var(--brand)]"
            initial={{ left: '0%', opacity: 0 }}
            animate={{ left: ['0%', '100%'], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.53, ease: 'easeInOut' }}
          />
        ))}
    </div>
  );
}
