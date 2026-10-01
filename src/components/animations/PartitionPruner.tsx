'use client';

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { Play, RotateCcw } from 'lucide-react';
import { DemoFrame, Segmented } from '@/components/docs/Callout';

// Row counts measured in this lab's PGlite (PostgreSQL 18) against the 12-partition events_p table
// the lesson builds, via `SELECT count(*) FROM ONLY <partition>`:
//   parent (events_p)               pg_table_size = 0 bytes : the parent stores nothing
//   Jan 10198  Feb 9541  Mar 10199  Apr 9870  May 10199  Jun 9871
//   Jul 10199  Aug 10199  Sep 9870  Oct 10175  Nov 9840  Dec 9840   (total 120,001)
// The partitions are NOT equal: the generator spreads rows over 365 day-offsets and 2024 is a leap
// year, so February is short and the 31-day months are long. Real archives are never uniform either,
// which is why this demo shows the measured counts instead of a tidy 10,000.
//   created_at = 2024-06-15    330 rows, plan = Aggregate -> Seq Scan on events_p_2024_06
//   created_at >= 2024-11-01   Nov + Dec opened (9,840 + 9,840 rows); with a DEFAULT partition the
//                              plan grows to three branches, because Postgres cannot prove the
//                              default is empty for that range.
//   no WHERE clause          120,001 rows, plan = Aggregate -> Append over 12 Seq Scans
// With pruning disabled the June query grows to 12 Seq Scans, each carrying the Filter.
const ROWS = [10198, 9541, 10199, 9870, 10199, 9871, 10199, 10199, 9870, 10175, 9840, 9840];
const TOTAL = 120001;
const STEP_MS = 750;
const LAST = 4;

// Locale-safe grouping: the default locale renders 120000 as "1,20,000", which React reports as a
// hydration mismatch on every prerendered lesson page.
const n = (v: number) => v.toLocaleString('en-US');

type QueryKey = 'day' | 'range' | 'all';

type Route = {
  sql: string;
  /** Indexes into MONTHS that the planner opens. */
  open: number[];
  /** Rows the opened partitions physically contain. */
  scanned: number;
  /** What the count(*) actually returns. */
  matched: string;
  verdict: string;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const QUERIES: Record<QueryKey, Route> = {
  day: {
    sql: "SELECT count(*) FROM events_p\nWHERE created_at = DATE '2024-06-15';",
    open: [5],
    scanned: 9871,
    matched: '330',
    verdict:
      'One partition opened, eleven never touched. The predicate names a single day, so the planner keeps only June — whose bounds are a superset of that day. 9,871 rows read; count(*) answers 330.',
  },
  range: {
    sql: "SELECT count(*) FROM events_p\nWHERE created_at >= DATE '2024-11-01';",
    open: [10, 11],
    scanned: 19680,
    matched: '19,680',
    verdict:
      'November and December overlap the range, so both stay — 19,680 rows read. Everything before November is provably disjoint and is dropped. Add a DEFAULT partition and the plan grows to three branches: Postgres cannot prove an unbounded partition is empty.',
  },
  all: {
    sql: 'SELECT count(*) FROM events_p;',
    open: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    scanned: 120001,
    matched: '120,001',
    verdict:
      'No predicate on the partition key, so nothing can be proved disjoint: all twelve partitions open. Partitioning buys you nothing for this query.',
  },
};

const TICKS = [
  'Query arrives at the planner.',
  'Bounds of each partition are compared to the predicate.',
  'Provably-disjoint partitions are dropped from the plan.',
  'The surviving partitions are scanned.',
  'Rows returned.',
];

export function PartitionPruner() {
  const [q, setQ] = useState<QueryKey>('day');
  const [stage, setStage] = useState(-1);

  const s = QUERIES[q];
  const running = stage >= 0 && stage < LAST;
  const pruned = stage >= 2;
  const scanning = stage >= 3;

  useEffect(() => {
    if (!running) return;
    const t = setTimeout(() => setStage((v) => v + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [running, stage]);

  // Controls reset state inline, an effect-based reset would flash the previous run's frame.
  const openRows = pruned ? s.scanned : TOTAL;

  return (
    <DemoFrame
      title="Partition pruning"
      icon="partitioning"
      subtitle="12 monthly partitions · 120,001 rows · parent stores 0 bytes · Feb is 9,541"
      controls={
        <>
          <Segmented
            value={q}
            onChange={(v) => {
              setQ(v);
              setStage(-1);
            }}
            options={[
              { value: 'day', label: 'One day' },
              { value: 'range', label: 'Range' },
              { value: 'all', label: 'No filter' },
            ]}
          />
          <button
            onClick={() => setStage((v) => (v < 0 ? 0 : v))}
            disabled={stage >= 0}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-brand disabled:opacity-40"
          >
            <Play size={12} /> Run
          </button>
          <button
            onClick={() => setStage(-1)}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </>
      }
      footer={
        <span>
          {stage < 0
            ? 'Press Run to hand the query to the planner.'
            : TICKS[Math.min(stage, TICKS.length - 1)]}
          {stage >= LAST && (
            <span className="block text-muted">{s.verdict}</span>
          )}
        </span>
      }
    >
      <div className="space-y-4">
        {/* The query the planner is looking at */}
        <pre className="overflow-x-auto rounded-xl bg-code-bg px-3 py-2.5 font-mono text-xs leading-relaxed text-code-text">
          {s.sql}
        </pre>

        {/* The twelve partitions */}
        <div className="grid grid-cols-6 gap-2" aria-hidden="true">
          {MONTHS.map((m, i) => {
            const isOpen = !pruned || s.open.includes(i);
            return (
              <motion.div
                key={m}
                animate={{ opacity: isOpen ? 1 : 0.25 }}
                transition={{ duration: 0.35 }}
                className={clsx(
                  'rounded-lg border-2 px-2 py-2 text-center',
                  isOpen
                    ? scanning
                      ? 'border-brand bg-brand-soft'
                      : 'border-line bg-surface-2'
                    : 'border-line bg-surface-2',
                )}
              >
                <div className="font-display text-xs font-bold">{m}</div>
                <div className="font-mono text-[10px] text-muted">
                  {isOpen ? n(ROWS[i]) : 'skipped'}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* The plan, which is what EXPLAIN actually prints */}
        <div className="rounded-xl border border-line bg-surface-2 px-3 py-2.5">
          <div className="font-mono text-xs leading-relaxed">
            <div>Aggregate</div>
            {pruned ? (
              s.open.length === 1 ? (
                <div className="pl-4">Seq Scan on events_p_2024_06</div>
              ) : (
                <>
                  <div className="pl-4">Append</div>
                  {s.open.map((i) => (
                    <div key={i} className="pl-8">
                      Seq Scan on events_p_2024_{String(i + 1).padStart(2, '0')}
                    </div>
                  ))}
                </>
              )
            ) : (
              <>
                <div className="pl-4">Append</div>
                {MONTHS.map((_, i) => (
                  <div key={i} className="pl-8 opacity-50">
                    Seq Scan on events_p_2024_{String(i + 1).padStart(2, '0')}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* The numbers, also as text for anyone who cannot see the grid */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
          <span>
            <span className="font-mono font-bold text-brand">
              {(pruned ? s.open.length : 12).toString()}
            </span>{' '}
            of <span className="font-mono">12</span> partitions opened
          </span>
          <span>
            <span className="font-mono font-bold text-brand">{n(openRows)}</span> rows read
          </span>
          {scanning && (
            <span>
              <span className="font-mono font-bold text-good">{s.matched}</span> — what count(*) returns
            </span>
          )}
          <span className="ml-auto font-mono text-[10px] text-muted">
            non-uniform per-partition counts · measured
          </span>
        </div>
      </div>
    </DemoFrame>
  );
}
