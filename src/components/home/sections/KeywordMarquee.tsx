'use client';

import { motion, useReducedMotion } from 'motion/react';
import { Icon, type IconName } from '@/components/icons';

const ITEMS: { label: string; icon: IconName }[] = [
  { label: 'Row-Level Security', icon: 'rls' },
  { label: 'GRANT / REVOKE', icon: 'roles' },
  { label: 'PL/pgSQL', icon: 'functions' },
  { label: 'Triggers', icon: 'trigger' },
  { label: 'SECURITY DEFINER', icon: 'production' },
  { label: 'MVCC', icon: 'mvcc' },
  { label: 'JSONB', icon: 'jsonb' },
  { label: 'EXPLAIN ANALYZE', icon: 'indexes' },
  { label: 'Partitioning', icon: 'partitioning' },
  { label: 'Backups & PITR', icon: 'backups' },
  { label: 'PostgreSQL 18', icon: 'postgres' },
];

/** Endless strip of Postgres features; two rows scrolling in opposite directions. */
export function KeywordMarquee() {
  const still = useReducedMotion();
  const row = (reverse: boolean) => (
    <div className="flex overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <motion.div
        className="flex shrink-0 gap-3 pr-3"
        animate={still ? undefined : { x: reverse ? ['-50%', '0%'] : ['0%', '-50%'] }}
        transition={{ duration: 38, repeat: Infinity, ease: 'linear' }}
      >
        {[...ITEMS, ...ITEMS].map((it, i) => (
          <span key={i} className="flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface/70 px-4 py-2 text-sm font-semibold text-muted shadow-card backdrop-blur">
            <Icon name={it.icon} size={16} className="text-brand" /> {it.label}
          </span>
        ))}
      </motion.div>
    </div>
  );
  return (
    <section aria-label="Topics covered" className="-mx-4 space-y-3 py-6 sm:-mx-8 xl:-mx-12">
      {row(false)}
      {row(true)}
    </section>
  );
}
