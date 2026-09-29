'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useInView } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Icon } from '@/components/icons';
import { highlightSql } from '@/lib/sql/highlight';
import { Reveal, SectionHeading } from './Reveal';

const QUESTION = 'Members should only update tasks assigned to them. Write the policy.';
const ANSWER_TEXT = 'Use USING to pick the rows they may target, and WITH CHECK so they can’t reassign a task away from themselves:';
const ANSWER_SQL = `CREATE POLICY own_tasks_update ON tasks
  FOR UPDATE TO app_member
  USING (assignee_id = (SELECT current_member_id()))
  WITH CHECK (assignee_id = (SELECT current_member_id()));`;

const FEATURES = [
  { title: 'Explain', copy: 'Step-by-step walkthrough of any query, with security implications.' },
  { title: 'Fix', copy: 'Turns a Postgres error into a cause and a corrected statement.' },
  { title: 'Ask', copy: 'Questions answered with your live schema as context.' },
  { title: 'Autocomplete', copy: 'Ghost-text SQL suggestions as you type in the playground.' },
];

/** Scripted chat showing the Claude assistant; types itself when scrolled into view. */
export function AiDemo() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const [q, setQ] = useState(0);
  const [a, setA] = useState(0);
  const [s, setS] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (q < QUESTION.length) {
      const t = setTimeout(() => setQ((n) => n + 2), 22);
      return () => clearTimeout(t);
    }
    if (a < ANSWER_TEXT.length) {
      const t = setTimeout(() => setA((n) => n + 3), a === 0 ? 600 : 16);
      return () => clearTimeout(t);
    }
    if (s < ANSWER_SQL.length) {
      const t = setTimeout(() => setS((n) => n + 4), 14);
      return () => clearTimeout(t);
    }
  }, [inView, q, a, s]);

  return (
    <section className="py-16">
      <SectionHeading eyebrow="AI assistant · Claude" title={<>Stuck? <span className="text-brand">Ask the lab.</span></>} copy="Optional Claude integration that knows your schema. Explain queries, fix errors, or ask anything about Postgres." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <Reveal>
          <div ref={ref} className="space-y-4 rounded-3xl border border-line bg-surface/70 p-5 shadow-card backdrop-blur">
            <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-brand px-4 py-3 text-sm text-on-brand">
              {QUESTION.slice(0, q)}
              {q < QUESTION.length && <Caret />}
            </div>
            {q >= QUESTION.length && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md border border-accent/25 bg-accent-soft/40 px-4 py-3 text-sm">
                  {a === 0 ? (
                    <span className="flex gap-1 py-1">
                      {[0, 1, 2].map((i) => (
                        <motion.span key={i} className="h-1.5 w-1.5 rounded-full bg-accent" animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }} />
                      ))}
                    </span>
                  ) : (
                    <>
                      <p>{ANSWER_TEXT.slice(0, a)}</p>
                      {a >= ANSWER_TEXT.length && (
                        <pre className="mt-3 overflow-x-auto rounded-xl bg-code-bg p-3 font-mono text-[12.5px] leading-relaxed text-code-text">
                          {highlightSql(ANSWER_SQL.slice(0, s))}
                          {s < ANSWER_SQL.length && <Caret />}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} index={i}>
              <div className="h-full rounded-2xl border border-line bg-surface/70 p-4 shadow-card transition hover:-translate-y-0.5 hover:border-accent">
                <div className="flex items-center gap-2 font-display text-lg font-bold">
                  <Icon name="sparkle" className="text-accent" /> {f.title}
                </div>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.copy}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Caret() {
  return <span className="ml-0.5 inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-current" />;
}
