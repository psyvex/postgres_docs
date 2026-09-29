'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Play } from 'lucide-react';
import { Icon, type IconName } from '@/components/icons';
import { DemoFrame, Segmented, Toggle } from '@/components/docs/Callout';

type Op = 'INSERT' | 'UPDATE' | 'DELETE';
type Row = { id: number; title: string; status: string; updated_at: string } | null;

const STAGES = [
  { id: 'stmt', label: 'Statement', icon: 'statement' },
  { id: 'before', label: 'BEFORE ROW trigger', icon: 'clean' },
  { id: 'check', label: 'Constraints', icon: 'constraint' },
  { id: 'write', label: 'Write to table', icon: 'write' },
  { id: 'after', label: 'AFTER ROW trigger', icon: 'audit' },
  { id: 'commit', label: 'Commit', icon: 'commit' },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

const SCENARIOS: Record<Op, { sql: string; old: Row; incoming: Row; cleaned: Row }> = {
  INSERT: {
    sql: "INSERT INTO tasks (title, …) VALUES ('  ship it!!  ', …)",
    old: null,
    incoming: { id: 8, title: '  ship it!!  ', status: 'todo', updated_at: '—' },
    cleaned: { id: 8, title: 'ship it!!', status: 'todo', updated_at: 'now()' },
  },
  UPDATE: {
    sql: "UPDATE tasks SET status = 'done' WHERE id = 1",
    old: { id: 1, title: 'Design fuel tank', status: 'doing', updated_at: '09:00' },
    incoming: { id: 1, title: 'Design fuel tank', status: 'done', updated_at: '09:00' },
    cleaned: { id: 1, title: 'Design fuel tank', status: 'done', updated_at: 'now()' },
  },
  DELETE: {
    sql: 'DELETE FROM tasks WHERE id = 3',
    old: { id: 3, title: 'Fix landing page typo', status: 'done', updated_at: '08:12' },
    incoming: null,
    cleaned: null,
  },
};

export function TriggerPipeline() {
  const [op, setOp] = useState<Op>('UPDATE');
  const [skip, setSkip] = useState(false);
  const [fail, setFail] = useState(false);
  const [stage, setStage] = useState(-1);

  const s = SCENARIOS[op];
  // Which stage the row stops at: BEFORE returning NULL skips the row; an AFTER exception rolls everything back.
  const stopAt = skip && op !== 'DELETE' ? 1 : fail ? 4 : STAGES.length - 1;
  const done = stage >= stopAt;

  useEffect(() => setStage(-1), [op, skip, fail]);
  useEffect(() => {
    if (stage < 0 || stage >= stopAt) return;
    const t = setTimeout(() => setStage((x) => x + 1), 900);
    return () => clearTimeout(t);
  }, [stage, stopAt]);

  const newRow = stage >= 1 && !(skip && op !== 'DELETE') ? s.cleaned : s.incoming;

  return (
    <DemoFrame
      icon="triggers"
      title="Follow one row through the trigger pipeline"
      subtitle="BEFORE triggers can change NEW (or cancel the row). AFTER triggers see the final row — perfect for audit logs."
      controls={
        <>
          <Segmented value={op} onChange={setOp} options={(['INSERT', 'UPDATE', 'DELETE'] as Op[]).map((v) => ({ value: v, label: v }))} />
          <Toggle on={skip} onChange={setSkip} label="BEFORE returns NULL" tone="bad" />
          <Toggle on={fail} onChange={setFail} label="AFTER raises error" tone="bad" />
        </>
      }
      footer={
        !done || stage < 0
          ? 'All of this happens inside ONE transaction with the statement.'
          : skip && op !== 'DELETE'
            ? 'The BEFORE trigger returned NULL → Postgres silently skipped this row. No error, 0 rows affected.'
            : fail
              ? 'An exception anywhere rolls back the whole statement — the write AND the audit row disappear together.'
              : 'Committed: the row was cleaned by BEFORE and recorded by AFTER, atomically.'
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button onClick={() => setStage(0)} className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand shadow-card">
          <Play className="h-4 w-4" /> Run
        </button>
        <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">{s.sql}</code>
      </div>

      <div className="relative grid grid-cols-3 gap-2 md:grid-cols-6">
        {STAGES.map((st, i) => {
          const reached = stage >= i && i <= stopAt;
          const isStop = done && i === stopAt && stopAt !== STAGES.length - 1;
          const rolledBack = done && fail && i >= 3 && i <= 4;
          return (
            <motion.div
              key={st.id}
              animate={{ scale: stage === i ? 1.05 : 1, opacity: reached ? 1 : 0.4 }}
              className={clsx(
                'relative rounded-2xl border p-3 text-center',
                isStop || rolledBack ? 'border-bad/40 bg-bad-soft' : reached ? 'border-good/40 bg-good-soft' : 'border-line bg-surface-2',
              )}
            >
              <div className={clsx('flex justify-center', isStop || rolledBack ? 'text-bad' : reached ? 'text-good' : 'text-muted')}>
                <Icon name={isStop ? (skip ? 'skip' : 'burst') : rolledBack ? 'rollback' : st.icon} size={28} />
              </div>
              <div className="mt-1 text-[11px] font-bold leading-tight">{st.label}</div>
              {stage === i && <motion.div layoutId="trigger-token" className="absolute -top-2 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-brand shadow-card" />}
            </motion.div>
          );
        })}
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <RowPanel label="OLD" row={s.old} tone="muted" />
        <RowPanel label="NEW" row={newRow} tone="brand" changed={stage >= 1 && !skip && op !== 'DELETE'} />
        <div className="rounded-2xl border border-line bg-surface-2 p-3">
          <div className="mb-2 flex items-center gap-1 text-xs font-bold"><Icon name="audit" className="text-accent" /> audit_log</div>
          <AnimatePresence>
            {stage >= 4 && !fail && !(skip && op !== 'DELETE') && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="rounded-lg bg-surface p-2 font-mono text-[11px]">
                op={op} row_id={(s.cleaned ?? s.old)?.id} changed_by=current_user
              </motion.div>
            )}
          </AnimatePresence>
          {(stage < 4 || fail || skip) && <div className="text-[11px] text-muted">{fail && done ? 'rolled back — nothing logged' : 'empty'}</div>}
        </div>
      </div>
    </DemoFrame>
  );
}

function RowPanel({ label, row, tone, changed }: { label: string; row: Row; tone: 'muted' | 'brand'; changed?: boolean }) {
  return (
    <div className={clsx('rounded-2xl border p-3', tone === 'brand' ? 'border-brand/40 bg-brand-soft/60' : 'border-line bg-surface-2')}>
      <div className="mb-2 font-mono text-xs font-bold">{label}</div>
      {row ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[12px]">
          {Object.entries(row).map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-muted">{k}</dt>
              <motion.dd key={String(v)} initial={changed ? { backgroundColor: 'rgba(255,200,0,0.5)' } : false} animate={{ backgroundColor: 'rgba(255,200,0,0)' }} transition={{ duration: 1.2 }} className="rounded px-1">
                {String(v)}
              </motion.dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="font-mono text-xs text-muted">NULL</div>
      )}
    </div>
  );
}
