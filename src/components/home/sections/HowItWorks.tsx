'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useInView } from 'motion/react';
import { useRef } from 'react';
import clsx from 'clsx';
import { Icon, type IconName } from '@/components/icons';
import { highlightSql } from '@/lib/sql/highlight';
import { Reveal, SectionHeading } from './Reveal';

const STEPS: { icon: IconName; title: string; copy: string }[] = [
  { icon: 'note', title: 'Read', copy: 'Short, practical explanations with analogies, version notes and links to the official PostgreSQL docs.' },
  { icon: 'statement', title: 'Run', copy: 'Every example is live. Pick a persona — Alice, Bob, anonymous — and run it against a real database.' },
  { icon: 'burst', title: 'Break', copy: 'Turn RLS off, grant too much, forget WITH CHECK. See exactly how things fail, then fix them.' },
];

// A real moment from the RLS lesson, replayed line by line.
const SCRIPT: { kind: 'cmd' | 'ok' | 'err' | 'note'; text: string; step: number }[] = [
  { kind: 'note', text: '-- as Alice (org 1)', step: 0 },
  { kind: 'cmd', text: "INSERT INTO tasks (org_id, project_id, title) VALUES (2, 3, 'Sneaky task');", step: 1 },
  { kind: 'err', text: 'ERROR: new row violates row-level security policy for table "tasks"', step: 2 },
  { kind: 'note', text: '-- WITH CHECK (org_id = current_org_id()) did its job', step: 2 },
  { kind: 'cmd', text: "INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'Paint the rocket');", step: 1 },
  { kind: 'ok', text: 'INSERT 0 1', step: 1 },
];

export function HowItWorks() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.4 });
  const [lines, setLines] = useState(0);

  useEffect(() => {
    if (!inView) return;
    const t = setTimeout(() => setLines((n) => (n >= SCRIPT.length + 3 ? 0 : n + 1)), lines >= SCRIPT.length ? 1400 : 1100);
    return () => clearTimeout(t);
  }, [inView, lines]);

  const activeStep = SCRIPT[Math.min(lines, SCRIPT.length) - 1]?.step ?? 0;

  return (
    <section className="py-16">
      <SectionHeading eyebrow="How it works" title={<>Read it. Run it. <span className="text-brand">Break it.</span></>} copy="Every lesson follows the same loop, so the concept sticks." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="space-y-3">
          {STEPS.map((s, i) => (
            <Reveal key={s.title} index={i}>
              <div className={clsx('flex gap-4 rounded-2xl border p-5 transition-all duration-500', activeStep === i ? 'border-brand bg-surface shadow-card' : 'border-line bg-surface/50')}>
                <span className={clsx('grid h-12 w-12 shrink-0 place-items-center rounded-xl transition-colors duration-500', activeStep === i ? 'bg-brand text-on-brand' : 'bg-brand-soft text-brand')}>
                  <Icon name={s.icon} size={24} />
                </span>
                <div>
                  <div className="flex items-center gap-2 font-display text-xl font-bold">
                    <span className="font-mono text-xs text-muted">0{i + 1}</span> {s.title}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted">{s.copy}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal index={1}>
          <div ref={ref} className="h-full overflow-hidden rounded-3xl border border-line bg-code-bg shadow-card">
            <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3 text-xs text-code-text/60">
              <span className="h-2.5 w-2.5 rounded-full bg-bad/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-warn/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-good/70" />
              <span className="ml-2 font-mono">lab=# Row-Level Security · USING vs WITH CHECK</span>
            </div>
            <div className="min-h-[300px] space-y-2 p-5 font-mono text-[13px] leading-relaxed">
              <AnimatePresence initial={false}>
                {SCRIPT.slice(0, lines).map((l, i) => (
                  <motion.div
                    key={`${i}-${l.text}`}
                    initial={{ opacity: 0, x: -8 }}
                    animate={l.kind === 'err' ? { opacity: 1, x: [8, -6, 4, 0] } : { opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35 }}
                    className={clsx(
                      l.kind === 'cmd' && 'text-code-text',
                      l.kind === 'ok' && 'text-good',
                      l.kind === 'err' && 'rounded-lg bg-bad/15 px-2 py-1 text-bad',
                      l.kind === 'note' && 'text-code-text/45 italic',
                    )}
                  >
                    {l.kind === 'cmd' ? (
                      <>
                        <span className="text-accent">lab=# </span>
                        {highlightSql(l.text)}
                      </>
                    ) : (
                      l.text
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
              <span className="inline-block h-4 w-2 animate-pulse bg-code-text/70 align-middle" />
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
