'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Play, RotateCcw } from 'lucide-react';
import { DemoFrame, Segmented, Toggle } from '@/components/docs/Callout';
import { Icon } from '@/components/icons';

// The transaction ids are synthetic, and they have to be: this demo's whole point is a race between
// two sessions, and the lab gives you exactly one connection. They are in the 750s/760s because that
// is where a fresh PGlite session really lives, this lesson's `SELECT pg_current_snapshot()` measures
// `755:755:`, its rollback block reads `xmin = 760` before the update and `765` inside it, and its
// bloat blocks run the ids up into the 770s.
// The visibility rule this animates is the one the lesson states: a version is visible when the
// transaction that wrote it was committed and not in flight at your snapshot, and no committed
// transaction has deleted it. No timings are claimed, stage durations are presentation, not fact.
type Mode = 'rc' | 'rr';

const ROW_ID = 1;
const OLD_TOTAL = '52.50';
const NEW_TOTAL = '999.00';
const BORN_XID = 752; // who created the live version
const B_XID = 757; // session B, the writer
const A_XID = 760; // session A, you
const A_XID_NEXT = 761; // your next statement under READ COMMITTED
const TICKS = [748, 749, 750, 751, BORN_XID, 753, 754, 755, 756, B_XID, A_XID, A_XID_NEXT, 762, 763];
const STEP_MS = 850;
const LAST = 5;

const SNAP_B_INFLIGHT = `${A_XID}:${A_XID}:${B_XID}`; // your snapshot lists 757 as still running
const SNAP_RC = `${A_XID_NEXT}:${A_XID_NEXT}:`; // empty xip, measured format
const SNAP_RR = SNAP_B_INFLIGHT;

// Stages 0-1 are the same story in every configuration; from stage 2 the line depends on both the
// reader's level and on what session B did, so the footer is a function and not a lookup table.
function footer(mode: Mode, stage: number, bCommits: boolean): string {
  if (stage === -1) return 'Two sessions, one row. Session B is closed; id 1 reads 52.50, stamped xmin 752. Press Run.';
  if (stage === 0) return 'Session B: UPDATE writes a second version of the row, stamped xmin 757. Nothing is committed.';
  if (stage === 1) return 'You open a transaction and read. Snapshot 760:760:757 says “757 is still running” — you read 52.50.';
  if (!bCommits) {
    if (stage === 2) return 'Session B rolls back. 757 never happened, so nothing has to be undone in your snapshot.';
    if (stage <= 4) return 'Both levels read 52.50: an aborted transaction is in nobody’s snapshot, so its write never surfaces.';
    return 'An abort is invisible by construction — no snapshot ever contained the write, so nobody saw it and nobody has to unsee it.';
  }
  if (stage === 2) {
    return mode === 'rc'
      ? 'Session B commits. 757 is now a fact, and it is a fact your next statement is allowed to hear.'
      : 'Session B commits. 757 is now a fact — but your snapshot was taken before it, and it is not moving.';
  }
  if (mode === 'rc') {
    if (stage === 3) return 'READ COMMITTED re-snapshots every statement: 761:761: — 757 is behind you. You read 999.00.';
    return stage === 4
      ? 'The old version is dead to everyone. No open snapshot is holding the horizon, so vacuum can take it.'
      : 'Read committed = a new photograph for every statement. The same SELECT twice can answer twice.';
  }
  if (stage === 3) return 'REPEATABLE READ keeps 760:760:757. 757 is still listed as in flight, so you read 52.50 again.';
  return stage === 4
    ? 'Your open snapshot is backend_xmin: the vacuum horizon. The old version cannot be reclaimed while you read.'
    : 'Repeatable read = one photograph for the whole transaction. Consistent reads, and a pinned vacuum horizon.';
}

type Verdict = { label: string; tone: 'good' | 'bad' | 'warn' };

/** What session A's current SELECT displays, or null when A has not run one yet. */
function readA(mode: Mode, stage: number, bCommits: boolean): string | null {
  if (stage < 1) return null;
  if (stage < 3) return OLD_TOTAL; // B is in flight (or aborted): never visible to A
  if (!bCommits) return OLD_TOTAL; // an aborted write never becomes visible to anybody
  return mode === 'rc' ? NEW_TOTAL : OLD_TOTAL;
}

/** Your snapshot as text at this stage, in pg_current_snapshot()'s own format. */
function snapshotA(mode: Mode, stage: number): string | null {
  if (stage < 1) return null;
  if (stage < 3) return SNAP_B_INFLIGHT;
  return mode === 'rc' ? SNAP_RC : SNAP_RR;
}

function verdict(mode: Mode, bCommits: boolean): Verdict {
  if (!bCommits) return { label: 'aborted: the new version was never visible to anyone', tone: 'bad' };
  return mode === 'rc' ? { label: 'read committed: the new version is visible', tone: 'good' } : { label: 'repeatable read: the old version is still yours', tone: 'warn' };
}

export function MvccExplainer() {
  const [mode, setMode] = useState<Mode>('rc');
  const [bCommits, setBCommits] = useState(true);
  const [stage, setStage] = useState(-1);

  const running = stage >= 0 && stage < LAST;
  const done = stage >= LAST;

  // Control changes reset the run inline, an effect here would cost an extra render on every click.
  const pick = (next: Mode) => {
    setMode(next);
    setStage(-1);
  };
  const toggleWriter = (v: boolean) => {
    setBCommits(v);
    setStage(-1);
  };

  useEffect(() => {
    if (stage < 0 || stage >= LAST) return;
    const t = setTimeout(() => setStage((x) => x + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [stage]);

  const bWritten = stage >= 0;
  const bSettled = stage >= 2;
  const snapshot = snapshotA(mode, stage);
  const answer = readA(mode, stage, bCommits);
  const v = verdict(mode, bCommits);

  return (
    <DemoFrame
      icon="mvcc"
      title="One row, two sessions, one committed UPDATE"
      subtitle="The isolation levels only differ when somebody else writes. So this is somebody else writing."
      controls={
        <>
          <Segmented
            value={mode}
            onChange={pick}
            options={[
              { value: 'rc', label: 'read committed' },
              { value: 'rr', label: 'repeatable read' },
            ]}
          />
          <Toggle on={bCommits} onChange={toggleWriter} label={bCommits ? 'session B commits' : 'session B aborts'} tone={bCommits ? 'good' : 'bad'} />
        </>
      }
      footer={<span className="font-mono">{footer(mode, stage, bCommits)}</span>}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setStage(0)}
          disabled={running}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand shadow-card disabled:opacity-50"
        >
          {done ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />} Run
        </button>
        <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">SELECT total FROM orders WHERE id = {ROW_ID}</code>
        {done && (
          <button onClick={() => setStage(-1)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      {/* The xid ruler. Bulk visual = plain spans; the ids it draws are also written out below. */}
      <div className="mb-4 rounded-2xl border border-line bg-surface-2 p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
          <span className="flex items-center gap-1.5">
            <Icon name="mvcc" size={14} className="text-brand" /> the transaction clock
          </span>
          <span className="font-mono text-[11px] font-normal text-muted">
            born {BORN_XID} · writer {B_XID} · you {A_XID}
          </span>
        </div>
        <div aria-hidden className="flex items-end gap-1">
          {TICKS.map((t) => {
            const isWriter = t === B_XID;
            const isYou = t === A_XID;
            const isBorn = t === BORN_XID;
            const past = snapshot !== null && t < Number(snapshot.split(':')[0]);
            return (
              <span key={t} className="flex flex-1 flex-col items-center gap-1">
                <span
                  className={clsx(
                    'w-full rounded-[3px] transition-all duration-500',
                    isWriter ? 'h-8 bg-warn' : isYou ? 'h-8 bg-brand' : isBorn ? 'h-6 bg-good' : 'h-3 bg-line',
                  )}
                />
                <span className={clsx('font-mono text-[9px]', isWriter || isYou || isBorn ? 'text-text' : 'text-muted')}>{t}</span>
                <span className={clsx('h-1 w-full rounded-full transition-colors', past ? 'bg-line/60' : 'bg-transparent')} />
              </span>
            );
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
          <Legend cls="bg-good">the xid that made the row you know</Legend>
          <Legend cls="bg-warn">session B, the writer</Legend>
          <Legend cls="bg-brand">your snapshot’s watermark</Legend>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Session
          icon="write"
          name="Session B"
          role="the writer"
          steps={[
            { label: 'BEGIN; UPDATE orders SET total = 999.00 WHERE id = 1;', on: stage >= 0, note: bSettled ? (bCommits ? 'COMMIT — 757 is history' : 'ROLLBACK — 757 never happened') : 'in flight, xid 757' },
            { label: bCommits ? 'COMMIT;' : 'ROLLBACK;', on: bSettled, tone: bCommits ? 'good' : 'bad', note: bSettled ? (bCommits ? 'the new version is now visible to new snapshots' : 'the new version is reclaimable at once') : 'waiting' },
          ]}
        />
        <Session
          icon="eye"
          name="Session A"
          role="you, the reader"
          steps={[
            { label: 'BEGIN; SELECT total FROM orders WHERE id = 1;', on: stage >= 1, note: answer === null ? 'not open yet' : `snapshot ${SNAP_B_INFLIGHT} → ${OLD_TOTAL}` },
            { label: 'SELECT total FROM orders WHERE id = 1;', on: stage >= 3, note: stage >= 3 ? `snapshot ${snapshot} → ${answer}` : 'not run yet' },
          ]}
          answer={answer}
        />
      </div>

      {/* The two versions of the one row, and what your snapshot makes of them. */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Version
          total={OLD_TOTAL}
          born={BORN_XID}
          killed={bWritten ? B_XID : null}
          state={
            !bWritten
              ? { label: 'live', tone: 'good' }
              : stage >= 3 && bCommits && mode === 'rc'
                ? { label: 'dead — 757 committed behind your snapshot', tone: 'bad' }
                : { label: bCommits && stage >= 2 ? 'live to you: 757 is in your snapshot’s xip' : 'live', tone: 'good' }
          }
        />
        <Version
          total={NEW_TOTAL}
          born={B_XID}
          killed={null}
          state={
            !bWritten
              ? { label: 'does not exist yet', tone: 'muted' as const }
              : !bSettled
                ? { label: 'in flight — invisible to every snapshot', tone: 'warn' }
                : !bCommits
                  ? { label: 'born dead — 757 aborted', tone: 'bad' }
                  : stage >= 3 && mode === 'rc'
                    ? { label: 'live — visible to snapshots taken after 757', tone: 'good' }
                    : { label: 'invisible to you: 757 is in your snapshot’s xip', tone: 'warn' }
          }
        />
      </div>

      {stage >= 4 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-4 rounded-2xl border border-line bg-surface-2 px-4 py-3 text-sm">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-bold text-muted">
            <Icon name="clean" size={14} /> vacuum horizon
          </div>
          {bCommits ? (
            mode === 'rc' ? (
              <>Your read finished, so nothing is holding <code className="font-mono text-[12px]">backend_xmin</code>. The horizon is {A_XID_NEXT} and the old version is reclaimable.</>
            ) : (
              <>Your transaction is still open at snapshot {A_XID}, so <code className="font-mono text-[12px]">backend_xmin = {A_XID}</code>. Vacuum cannot reclaim the version you are standing on — long-running reads are how bloat survives a healthy autovacuum.</>
            )
          ) : (
            <>The rolled-back version was never visible to anyone, so it is reclaimable immediately. The live row was never deleted: an aborted <code className="font-mono text-[12px]">xmax</code> does not kill anything.</>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={clsx(
              'mt-4 rounded-2xl border px-4 py-3 text-sm',
              v.tone === 'good' ? 'border-good/30 bg-good-soft' : v.tone === 'bad' ? 'border-bad/30 bg-bad-soft' : 'border-warn/30 bg-warn-soft',
            )}
          >
            <b>Session A reads {answer}.</b> {v.label}. Two sessions, one row, one committed write — that is the
            minimum scene in which the isolation levels disagree.
          </motion.div>
        )}
      </AnimatePresence>
    </DemoFrame>
  );
}

function Legend({ cls, children }: { cls: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={clsx('h-2.5 w-2.5 rounded-[3px]', cls)} /> {children}
    </span>
  );
}

function Session({ icon, name, role, steps, answer }: { icon: 'write' | 'eye'; name: string; role: string; steps: { label: string; on: boolean; note?: string; tone?: 'good' | 'bad' }[]; answer?: string | null }) {
  return (
    <div className="rounded-2xl border border-line bg-surface-2 p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs font-bold">
          <Icon name={icon} size={14} className="text-brand" /> {name}
          <span className="font-normal text-muted">· {role}</span>
        </span>
        {answer !== undefined && (
          <span className={clsx('rounded-full px-2 py-0.5 font-mono text-[11px] font-bold', answer === null ? 'bg-surface text-muted' : 'bg-brand-soft text-brand')}>
            {answer === null ? '—' : answer}
          </span>
        )}
      </div>
      <ol className="space-y-2">
        {steps.map((s) => (
          <li key={s.label} className={clsx('transition-opacity', s.on ? 'opacity-100' : 'opacity-40')}>
            <code className="block rounded-lg bg-surface px-2 py-1 font-mono text-[11px]">{s.label}</code>
            {s.note && (
              <span className={clsx('mt-0.5 block text-[11px]', s.tone === 'good' ? 'text-good' : s.tone === 'bad' ? 'text-bad' : 'text-muted')}>{s.note}</span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function Version({ total, born, killed, state }: { total: string; born: number; killed: number | null; state: { label: string; tone: 'good' | 'bad' | 'warn' | 'muted' } }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-sm font-bold">total = {total}</span>
        <span className="font-mono text-[11px] text-muted">
          xmin {born} · xmax {killed ?? 0}
        </span>
      </div>
      <div
        className={clsx(
          'mt-2 flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold',
          state.tone === 'good' ? 'bg-good-soft text-good' : state.tone === 'bad' ? 'bg-bad-soft text-bad' : state.tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-surface-2 text-muted',
        )}
      >
        <Icon name={state.tone === 'good' ? 'eye' : state.tone === 'bad' ? 'trash' : 'warn'} size={12} /> {state.label}
      </div>
    </div>
  );
}
