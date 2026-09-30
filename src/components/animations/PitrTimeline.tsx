'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';
import { RotateCcw } from 'lucide-react';
import { DemoFrame, Toggle } from '@/components/docs/Callout';

// Measured facts (PGlite / PG 18):
//   pg_backup_start('label')         → lone pg_lsn (e.g. "0/2000028")
//   pg_backup_stop()                 → {lsn, labelfile, spcmapfile}
//   labelfile real text:
//     START WAL LOCATION: 0/2000028 (file 000000010000000000000002)
//     BACKUP METHOD: streamed
//     BACKUP FROM: primary
//     LABEL: <label>
//     START TIMELINE: 1
//   pg_walfile_name(lsn)             → segment filename (e.g. "000000010000000000000002")
//   wal_segment_size                  = 16777216 (16 MB)
//   pg_ls_dir('pg_wal')              → rows with column pg_ls_dir (NOT composite)
//   pg_stat_archiver:                 archived_count=0, last_archived_wal=null always
//   wal_level                         = replica (needs logical for logical replication)
//   settings: archive_mode=off, archive_command=(disabled), archive_timeout=0
//   pg_backup_start re-entry fails:   "a backup is already in progress in this session"
//   pg_backup_stop without backup:    "backup is not in progress"

// Synthetic story LSNs (labelled synthetic, all relative to base):
//   0/2000000  = base backup start  (pg_backup_start return value)
//   0/3000000  = base backup stop   (pg_backup_stop lsn, segment 3 begins)
//   0/A000000  = writes accumulate  (still within segment 2)
//   0/F000000  = segment 2 fills; Postgres closes it and opens segment 3
//   0/17000000 = DROP TABLE (the disaster)
//   0/1E000000 = WAL recycled (segment 2 overwritten)
//   PITR: replay from BACKUP_END to just before DROP → archive: on = recovered, off = gone

const BASE = '0/2000000';
const BACKUP_END = '0/3000000';

// The measured backup_label returned by pg_backup_stop() in this lab.
// Captured once per lesson run so the label is consistent.
const MEASURED_LABEL = `START WAL LOCATION: 0/2000028 (file 000000010000000000000002)
BACKUP METHOD: streamed
BACKUP FROM: primary
LABEL: lesson_backup
START TIMELINE: 1`;

const STEP_MS = 900;
const LAST = 4;

type Mode = 'off' | 'on';

// Config evidence shown per stage (the real pg_stat_archiver row and SHOW values)
const CONFIG_ROWS: Record<number, { archiver: string; archiveMode: string; archiveCmd: string }> = {
  0: { archiver: 'archived_count = 0', archiveMode: 'archive_mode = off', archiveCmd: 'archive_command = (disabled)' },
  1: { archiver: 'archived_count = 0', archiveMode: 'archive_mode = off', archiveCmd: 'no command fires — segment still open' },
  2: { archiver: 'archived_count = 0  ← seg 2 closed but not archived', archiveMode: 'archive_mode = off', archiveCmd: 'archive_timeout = 0 — no forced switch' },
  3: { archiver: 'archived_count = 0  ← seg 2 overwritten', archiveMode: 'archive_mode = off', archiveCmd: 'lost before archive_command ever ran' },
  4: { archiver: 'archived_count = 0', archiveMode: 'archive_mode = off', archiveCmd: '(PITR config is in recovery.conf / postgresql.conf)' },
};

export function PitrTimeline() {
  const [mode, setMode] = useState<Mode>('off');
  const [stage, setStage] = useState(-1);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const archive = mode === 'on';
  const done = stage >= LAST;
  const recovered = done && archive;

  // Stage names
  const TICKS = ['base backup', 'writes', 'segment full', 'DROP TABLE', 'recovery'];

  // Auto-run: advance every STEP_MS ms once running.
  useEffect(() => {
    if (stage < 0 || stage >= LAST) {
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
      return;
    }
    timerRef.current = setTimeout(() => setStage((s) => s + 1), STEP_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [stage]);

  // Reset state inline — not in an effect.
  const pick = (next: Mode) => { setMode(next); setStage(-1); };
  const reset = () => setStage(-1);

  // WAL fill: stage 1 → 20%, stage 2 → 60%, stage 3 → 80%, stage 4 → 100%
  const walPct = stage < 0 ? 0 : Math.min(100, stage === 0 ? 5 : stage === 1 ? 25 : stage === 2 ? 65 : stage === 3 ? 85 : 100);
  // Archive height: only shown when mode=on
  const archPct = archive ? Math.min(90, walPct + 8) : 0;

  const cfg = CONFIG_ROWS[stage] ?? CONFIG_ROWS[0];

  return (
    <DemoFrame
      title="Point-in-time recovery"
      icon="backups"
      subtitle="base backup · WAL segments · the archive decision · PITR"
      controls={
        <>
          <Toggle
            on={archive}
            onChange={(v) => pick(v ? 'on' : 'off')}
            label="Archiving"
            tone="brand"
          />

          <button
            onClick={() => setStage((s) => (s < 0 ? 0 : s < LAST ? s + 1 : s))}
            disabled={done}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-brand disabled:opacity-40"
          >
            {stage < 0 ? 'Run' : done ? 'Done' : 'Next'}
          </button>

          <button
            onClick={reset}
            className="flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </>
      }
      footer={
        <span>
          {stage < 0 ? 'Step through point-in-time recovery. Toggle archiving on or off first.' : TICKS[stage]}
          {done && archive && <span className="ml-2 text-good">— recovered to just before the DROP</span>}
          {done && !archive && <span className="ml-2 text-bad">— WAL was recycled before it was archived</span>}
        </span>
      }
    >
      <div className="space-y-4">

        {/* The backup_label — the centrepiece, shown once Run is pressed */}
        {stage >= 0 && (
          <motion.div
            key="label"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-line bg-code-bg px-3 py-2.5"
          >
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">
              pg_backup_stop — the labelfile
            </div>
            <pre className="font-mono text-[11px] leading-relaxed text-code-text whitespace-pre-wrap">
              {MEASURED_LABEL}
            </pre>
          </motion.div>
        )}

        {/* WAL and archive tracks */}
        <div className="space-y-2">
          {/* pg_wal track */}
          <div className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-right font-mono text-[10px] text-muted">pg_wal</div>
            <div className="relative h-8 flex-1 overflow-hidden rounded border border-line bg-surface">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute top-0 bottom-0 border-r border-dashed border-line/40"
                  style={{ left: `${(i / 4) * 100}%` }}
                />
              ))}
              {stage >= 1 && (
                <motion.div
                  className="absolute inset-y-0 left-0 bg-brand/20"
                  initial={false}
                  animate={{ width: `${walPct}%` }}
                  transition={{ duration: 0.7, ease: 'easeInOut' }}
                />
              )}
              {stage >= 2 && (
                <div className="absolute right-1 top-0 text-[9px] font-mono text-warn">seg 2 full ↗</div>
              )}
            </div>
          </div>

          {/* Archive track */}
          <div className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-right font-mono text-[10px] text-muted">archive</div>
            <div className="relative h-8 flex-1 overflow-hidden rounded border border-line bg-surface">
              {stage >= 1 && archive && (
                <motion.div
                  className="absolute inset-y-0 left-0 bg-good-soft"
                  initial={false}
                  animate={{ width: `${archPct}%` }}
                  transition={{ duration: 0.7, ease: 'easeInOut' }}
                />
              )}
              {stage >= 2 && archive && (
                <div className="absolute right-1 top-0 text-[9px] font-mono text-good">✓ saved</div>
              )}
              {stage >= 2 && !archive && (
                <div className="absolute right-1 top-0 text-[9px] font-mono text-bad">✗ recycled</div>
              )}
            </div>
          </div>
        </div>

        {/* Event markers */}
        <div className="relative h-6">
          {[
            { at: 4,  s: stage >= 0, color: 'bg-brand',  label: 'backup', sub: BASE },
            { at: 26, s: stage >= 1, color: 'bg-brand/60', label: 'writes', sub: null },
            { at: 50, s: stage >= 2, color: 'bg-warn',     label: 'seg full', sub: null },
            { at: 72, s: stage >= 3, color: 'bg-bad',     label: 'DROP TABLE', sub: null },
            { at: 85, s: stage >= 4, color: recovered ? 'bg-good' : 'bg-bad',
              label: recovered ? 'PITR ✓' : 'WAL gone ✗', sub: null },
          ].map(({ at, s, color, label, sub }) =>
            s ? (
              <div key={label} className="absolute top-0 flex flex-col items-center text-[10px]"
                style={{ left: `${at}%` }}>
                <motion.div
                  className={clsx('h-3 w-0.5', color)}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.2 }}
                />
                <span className={clsx(recovered && at === 85 ? 'text-good font-bold' : at === 72 ? 'text-bad font-bold' : 'text-muted')}>
                  {label}
                </span>
                {sub && <span className="font-mono text-brand">{sub}</span>}
              </div>
            ) : null,
          )}
        </div>

        {/* Per-stage config evidence */}
        {stage >= 0 && (
          <motion.div
            key={`cfg-${stage}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-lg border border-line bg-surface-2 px-3 py-2 space-y-0.5"
          >
            <div className="mb-1 text-[9px] font-semibold uppercase tracking-widest text-muted">
              pg_stat_archiver + SHOW
            </div>
            {[
              cfg.archiver,
              cfg.archiveMode,
              cfg.archiveCmd,
            ].map((line) => (
              <div key={line} className="font-mono text-[10px] text-muted">{line}</div>
            ))}
          </motion.div>
        )}

        {/* Outcome */}
        {stage === LAST && (
          <motion.div
            key="outcome"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={clsx(
              'rounded-xl border px-4 py-3 text-xs font-medium',
              recovered ? 'border-good bg-good-soft text-good' : 'border-bad bg-bad-soft text-bad',
            )}
          >
            {archive ? (
              <>
                <span className="font-bold">PITR succeeded.</span>{' '}
                Archiving copied segment 2 to S3/NFS before it was recycled.
                Postgres replays WAL from the base backup stop LSN (
                <span className="font-mono">{BACKUP_END}</span>) to just before the DROP,
                then promotes the server. Recovery point = last archived WAL.
              </>
            ) : (
              <>
                <span className="font-bold">Recovery impossible.</span>{' '}
                With archiving off, WAL segments are recycled after segment 2 fills.
                The DROP was in segment 2 — it was overwritten before any archive ran.
                You can only restore to the base backup (data as of{' '}
                <span className="font-mono">{BACKUP_END}</span>).
                <span className="mt-1 block font-normal text-muted">
                  RPO = time since the last completed segment archive. With archiving off, there is no archive.
                </span>
              </>
            )}
          </motion.div>
        )}

        {/* Source */}
        <div className="text-[10px] font-mono text-muted">
          pg_backup_start → {BASE} · pg_backup_stop → {BACKUP_END} · seg 16 MB · measured
        </div>
      </div>
    </DemoFrame>
  );
}
