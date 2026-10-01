'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import clsx from 'clsx';
import { Play, RotateCcw } from 'lucide-react';
import { DemoFrame, Segmented, Toggle } from '@/components/docs/Callout';
import { Icon } from '@/components/icons';

// Every number below was measured in this lab's PGlite (PostgreSQL 18) against the `events` table
// the lesson builds, with EXPLAIN (ANALYZE, BUFFERS):
//   heap                 1,031 pages (8,248 kB), ~97 rows per page
//   events_user_id_idx      91 pages / 728 kB, ~1,100 keys per leaf page
//   user_id = 7          2,000 rows · index Buffers: read=4 · Heap Blocks: exact=1,031 · filter removed 98,000
//   kind = 'purchase'   25,000 rows · index Buffers: read=23 · Heap Blocks: exact=1,031 · filter removed 75,000
// Timings are deliberately absent: the same seq scan measured 13 ms and 21 ms on two runs of the
// same database, so this demo teaches pages and rows, which do not wobble.
const HEAP_PAGES = 1031;
const ROWS = 100000;
const LEAF_PAGES = 88; // 100,000 keys ÷ ~1,100 per page, from the measured 91-page index
const STEP_MS = 900;
const LAST = 6;

// Grouping must be identical on the server and in the browser: the default locale here renders
// 100000 as "1,00,000", which React reports as a hydration mismatch on every prerendered lesson.
const n = (v: number) => v.toLocaleString('en-US');

type QueryKey = 'user7' | 'purchase';

type Route = {
  sql: string;
  index: string;
  indexPages: number;
  match: number;
  removed: number;
  rootKeys: string[];
  interiorKeys: string[];
  leafKeys: string[];
  hotLeaves: number;
  hotKey: string;
  verdict: string;
};

const QUERIES: Record<QueryKey, Route> = {
  user7: {
    sql: 'SELECT count(*) FROM events WHERE user_id = 7',
    index: 'events_user_id_idx',
    indexPages: 4,
    match: 2000,
    removed: 98000,
    rootKeys: ['25', '50'],
    interiorKeys: ['3', '7', '14', '25', '38', '50'],
    leafKeys: ['6', '7', '7', '7', '8', '9'],
    hotLeaves: 2,
    hotKey: '7',
    verdict:
      'The index read 4 pages, found 2,000 rows — then fetched all 1,031 heap pages to reach them, because user_id is assigned by i % 50 and scatters matches everywhere. It wins by checking 2,000 rows instead of 100,000.',
  },
  purchase: {
    sql: "SELECT count(*) FROM events WHERE kind = 'purchase'",
    index: 'events_kind_idx',
    indexPages: 23,
    match: 25000,
    removed: 75000,
    rootKeys: ['signup', 'view'],
    interiorKeys: ['click', 'purchase', 'signup', 'view'],
    leafKeys: ['click', 'purchase', 'purchase', 'purchase', 'signup', 'view'],
    hotLeaves: 21,
    hotKey: 'purchase',
    verdict:
      'A quarter of the table matches. The index is 23 pages wide, the heap is still all 1,031 pages, and the win nearly evaporates — past ~10–15% of a scattered table, a seq scan is a legitimate answer.',
  },
};

// How far the seq scan has walked at each tick. It finishes exactly when the index route does.
const SEQ_PROGRESS = [0, 0.15, 0.35, 0.55, 0.75, 0.95, 1];

/** Index pages read at a given descent depth: root, then interior, then the matched leaves. */
function indexPagesRead(level: number, s: Route) {
  if (level < 0) return 0;
  if (level === 0) return 1;
  if (level === 1) return 2;
  return s.indexPages;
}

export function ScanRace() {
  const [q, setQ] = useState<QueryKey>('user7');
  const [hasIndex, setHasIndex] = useState(true);
  const [stage, setStage] = useState(-1);

  const s = QUERIES[q];
  const running = stage >= 0 && stage < LAST;
  const done = stage >= LAST;
  const progress = stage < 0 ? 0 : SEQ_PROGRESS[stage];
  const seqPages = Math.round(HEAP_PAGES * progress);
  const seqChecked = Math.round(ROWS * progress);
  const seqKept = Math.round(s.match * progress);
  const level = !hasIndex || stage < 1 ? -1 : Math.min(stage - 1, 2); // 0 root, 1 interior, 2 leaves
  const fetched = hasIndex && stage >= 4;
  const indexPages = indexPagesRead(level, s);

  // Control changes reset the run inline, an effect here would cost an extra render on every click.
  const pick = (next: QueryKey) => {
    setQ(next);
    setStage(-1);
  };
  const toggleIndex = (v: boolean) => {
    setHasIndex(v);
    setStage(-1);
  };

  useEffect(() => {
    if (stage < 0 || stage >= LAST) return;
    const t = setTimeout(() => setStage((x) => x + 1), STEP_MS);
    return () => clearTimeout(t);
  }, [stage]);

  return (
    <DemoFrame
      icon="indexes"
      title="Two routes to the same rows"
      subtitle="Same query, same table, same answer. Watch how many pages each route has to touch."
      controls={
        <>
          <Segmented
            value={q}
            onChange={pick}
            options={[
              { value: 'user7', label: 'user_id = 7' },
              { value: 'purchase', label: "kind = 'purchase'" },
            ]}
          />
          <Toggle on={hasIndex} onChange={toggleIndex} label={hasIndex ? `index on ${s.index}` : 'no index'} tone={hasIndex ? 'good' : 'bad'} />
        </>
      }
      footer={
        <span className="font-mono">
          {stage < 0
            ? `events = ${n(HEAP_PAGES)} pages of 8 kB, ${n(ROWS)} rows. Press Run.`
            : done
              ? hasIndex
                ? s.verdict
                : `No index: ${n(HEAP_PAGES)} pages read, ${n(ROWS)} rows checked, ${n(s.match)} kept — the filter threw ${n(s.removed)} away.`
              : 'Running…'}
        </span>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          onClick={() => setStage(0)}
          disabled={running}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-bold text-on-brand shadow-card disabled:opacity-50"
        >
          {done ? <RotateCcw className="h-4 w-4" /> : <Play className="h-4 w-4" />} Run
        </button>
        <code className="rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">{s.sql}</code>
        {done && (
          <button onClick={() => setStage(-1)} className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <div>
          <Strip label="heap pages the seq scan read" icon="compass" tone="warn" read={seqPages} of={HEAP_PAGES} />
          <Strip label="heap pages the index scan fetched" icon="indexes" tone="brand" read={fetched ? HEAP_PAGES : 0} of={HEAP_PAGES} hint={hasIndex ? undefined : 'no index — nothing to fetch through'} />
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <Legend cls="bg-line">not touched</Legend>
            <Legend cls="bg-warn">read by the seq scan</Legend>
            <Legend cls="bg-brand">fetched by the index</Legend>
          </div>
          <p className="mt-3 text-xs text-muted">
            Each tile is one 8 kB page. For this data the index route opens{' '}
            <b className="text-text">all {n(HEAP_PAGES)} of them too</b> — an index points at rows, it does not move them. Its advantage is in the scoreboard on the right.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-2xl border border-line bg-surface-2 p-3">
            <div className="mb-2 flex items-center justify-between gap-2 text-xs font-bold">
              <span className="flex items-center gap-1.5">
                <Icon name="indexes" size={15} className="text-brand" /> {hasIndex ? s.index : 'no index'}
              </span>
              <span className="font-mono text-[11px] font-normal text-muted">{hasIndex ? `${n(indexPages)} of 91 pages` : '—'}</span>
            </div>
            {hasIndex ? <Tree level={level} s={s} /> : <div className="grid h-[186px] place-items-center rounded-xl border border-dashed border-line text-center text-xs text-muted">No index on this column.<br />The only route is the long one.</div>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Score title="Seq Scan" icon="compass" tone="warn" pages={seqPages} extra={`of ${n(HEAP_PAGES)}`} checked={seqChecked} kept={seqKept} active={stage >= 0} />
            <Score title="Index Scan" icon="indexes" tone="brand" pages={indexPages} extra={hasIndex ? 'of 91' : 'unavailable'} checked={fetched ? s.match : 0} kept={fetched ? s.match : 0} active={fetched} dim={!hasIndex} />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {done && hasIndex && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-4 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3 text-sm">
            <b>{n(s.match)} rows returned by both routes.</b> {s.verdict}
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

/** One row of 1,031 plain divs, coloured by class, 1,031 animated nodes would be the wrong tool. */
function Strip({ label, icon, tone, read, of, hint }: { label: string; icon: 'compass' | 'indexes'; tone: 'warn' | 'brand'; read: number; of: number; hint?: string }) {
  return (
    <div className="mb-3">
      <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-bold">
        <span className="flex items-center gap-1.5">
          <Icon name={icon} size={14} className={tone === 'warn' ? 'text-warn' : 'text-brand'} /> {label}
        </span>
        <span className="font-mono text-[11px] font-normal text-muted">{hint ?? `${n(read)} of ${n(of)}`}</span>
      </div>
      <div aria-hidden className="grid grid-cols-[repeat(auto-fill,minmax(7px,1fr))] gap-[2px]">
        {Array.from({ length: of }, (_, i) => (
          <span key={i} className={clsx('h-[7px] rounded-[2px] transition-colors duration-500', i < read ? (tone === 'warn' ? 'bg-warn' : 'bg-brand') : 'bg-line')} />
        ))}
      </div>
    </div>
  );
}

function Tree({ level, s }: { level: number; s: Route }) {
  return (
    <div className="flex flex-col gap-2">
      <Level n={0} level={level} label="root page" keys={s.rootKeys} hot={s.hotKey} />
      <Arrow on={level >= 1} />
      <Level n={1} level={level} label="interior page" keys={s.interiorKeys} hot={s.hotKey} />
      <Arrow on={level >= 2} />
      <div>
        <Level n={2} level={level} label={`leaf · ${n(s.hotLeaves)} of ~${n(LEAF_PAGES)} leaf pages`} keys={s.leafKeys} hot={s.hotKey} hotCount={s.hotLeaves} />
        <AnimatePresence>
          {level >= 2 && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="mt-2 rounded-lg bg-code-bg px-2 py-1 text-center font-mono text-[11px] text-code-text">
              {s.hotKey} → {n(s.match)} tuple pointers (TIDs) <span className="text-muted">— block + offset into the heap</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function Level({ n: depth, level, label, keys, hot, hotCount }: { n: number; level: number; label: string; keys: string[]; hot: string; hotCount?: number }) {
  const reached = level >= depth;
  return (
    <div className={clsx('rounded-xl border px-2 py-1.5 transition-colors', reached ? 'border-brand/40 bg-brand-soft' : 'border-line bg-surface')}>
      <div className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-muted">
        <Icon name={reached ? 'ok' : 'table'} size={12} className={reached ? 'text-brand' : 'text-muted'} /> {label}
      </div>
      <div className="flex flex-wrap gap-1">
        {keys.map((k, i) => {
          const hotTile = k === hot && (hotCount == null || i < hotCount);
          return (
            <motion.span
              key={`${k}-${i}`}
              animate={reached && hotTile ? { scale: [1, 1.12, 1] } : { scale: 1 }}
              transition={{ duration: 0.4 }}
              className={clsx('rounded-md px-1.5 py-0.5 font-mono text-[11px]', hotTile && reached ? 'bg-brand font-bold text-on-brand' : 'bg-surface-2 text-muted')}
            >
              {k}
            </motion.span>
          );
        })}
      </div>
    </div>
  );
}

function Arrow({ on }: { on: boolean }) {
  return (
    <div className="flex justify-center py-0.5">
      <motion.span animate={{ opacity: on ? 1 : 0.25, y: on ? [0, 3, 0] : 0 }} transition={{ repeat: on ? Infinity : 0, duration: 1.4 }} className="block text-brand">
        <Icon name="compass" size={16} />
      </motion.span>
    </div>
  );
}

function Score({ title, icon, tone, pages, extra, checked, kept, active, dim }: { title: string; icon: 'compass' | 'indexes'; tone: 'warn' | 'brand'; pages: number; extra: string; checked: number; kept: number; active: boolean; dim?: boolean }) {
  return (
    <div className={clsx('rounded-2xl border p-3 transition-opacity', dim ? 'border-line bg-surface-2 opacity-50' : active ? (tone === 'warn' ? 'border-warn/40 bg-warn-soft' : 'border-brand/40 bg-brand-soft') : 'border-line bg-surface-2')}>
      <div className="mb-2 flex items-center gap-1 text-xs font-bold">
        <Icon name={icon} size={15} className={tone === 'warn' ? 'text-warn' : 'text-brand'} /> {title}
      </div>
      <dl className="space-y-1 font-mono text-[11px]">
        <Stat k="pages read" v={n(pages)} note={extra} />
        <Stat k="rows checked" v={n(checked)} />
        <Stat k="rows kept" v={n(kept)} />
      </dl>
    </div>
  );
}

function Stat({ k, v, note }: { k: string; v: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-muted">{k}</dt>
      <dd className="font-bold">
        {v} {note && <span className="font-normal text-muted">{note}</span>}
      </dd>
    </div>
  );
}
