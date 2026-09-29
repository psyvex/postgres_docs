'use client';

import { motion } from 'motion/react';

/** Fade-up when scrolled into view. `index` staggers siblings. */
export function Reveal({ children, index = 0, className }: { children: React.ReactNode; index?: number; className?: string }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Section heading with eyebrow, used by every marketing section. */
export function SectionHeading({ eyebrow, title, copy }: { eyebrow: string; title: React.ReactNode; copy?: string }) {
  return (
    <Reveal className="mb-8 max-w-3xl">
      <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand">{eyebrow}</p>
      <h2 className="font-display text-[clamp(2rem,3.6vw,3.2rem)] font-extrabold leading-[1.02] tracking-[-0.03em]">{title}</h2>
      {copy && <p className="mt-3 text-lg leading-relaxed text-muted">{copy}</p>}
    </Reveal>
  );
}
