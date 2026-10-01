'use client';

import { motion } from 'motion/react';
import clsx from 'clsx';
import { AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react';
import type { RunResult, StatementResult } from '@/lib/db/types';
import { isPlanResult, PlanToggle } from './PlanTree';
import type { PlanEntry } from './PlanTree';
import { ExportMenu } from './ExportMenu';

type Props = {
  result: RunResult;
  /** Leading statements (session setup) to hide from the output. */
  skip?: number;
  onAskAi?: () => void;
  compact?: boolean;
};

export function ResultView({ result, skip = 0, onAskAi, compact }: Props) {
  if (!result.ok) {
    return (
      <motion.div initial={{ x: -6 }} animate={{ x: [6, -4, 2, 0] }} transition={{ duration: 0.3 }} className="rounded-xl border border-bad/30 bg-bad-soft p-3 text-sm text-bad">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{result.error}</div>
            {result.detail && <div className="mt-1 text-xs opacity-80">Detail: {result.detail}</div>}
            {result.hint && <div className="mt-1 text-xs opacity-80">Hint: {result.hint}</div>}
            {result.code && <div className="mt-1 font-mono text-[11px] opacity-70">SQLSTATE {result.code}</div>}
          </div>
          {onAskAi && (
            <button onClick={onAskAi} className="flex shrink-0 items-center gap-1 rounded-lg bg-surface px-2 py-1 text-xs font-semibold text-accent">
              <Sparkles className="h-3.5 w-3.5" /> Fix with AI
            </button>
          )}
        </div>
      </motion.div>
    );
  }

  const statements = result.results.slice(skip);
  const visible = statements.filter((s) => s.columns.length > 0);
  const last = statements.at(-1);
  return (
    <div className="space-y-3">
      {visible.map((s, i) =>
        isPlanResult(s.columns, s.rows) ? (
          <PlanToggle key={i} plan={s.rows[0]['QUERY PLAN'] as PlanEntry[]} raw={<ResultTable result={s} compact={compact} />} />
        ) : (
          <ResultTable key={i} result={s} compact={compact} />
        ),
      )}
      {visible.length === 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-good-soft px-3 py-2 text-sm text-good">
          <CheckCircle2 className="h-4 w-4" /> Done{last?.rowCount ? ` · ${last.rowCount} row${last.rowCount === 1 ? '' : 's'} affected` : ''}
        </div>
      )}
      <div className="text-right text-[11px] text-muted">
        {statements.length} statement{statements.length === 1 ? '' : 's'} · {result.durationMs} ms
      </div>
    </div>
  );
}

export function ResultTable({ result, compact }: { result: StatementResult; compact?: boolean }) {
  if (result.rows.length === 0) {
    return <div className="rounded-xl border border-dashed border-line px-3 py-4 text-center text-sm text-muted">0 rows. Columns: {result.columns.join(', ')}</div>;
  }
  return (
    <div dir="ltr" className={clsx('overflow-auto rounded-xl border border-line bg-surface', compact ? 'max-h-72' : 'max-h-[60vh]')}>
      <table className="w-full border-collapse text-left text-[13px]">
        <thead className="sticky top-0 bg-surface-2">
          <tr>
            {result.columns.map((c) => (
              <th key={c} className="whitespace-nowrap border-b border-line px-3 py-2 font-mono text-xs font-semibold text-muted">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <motion.tr key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 12) * 0.03 }} className="border-b border-line last:border-0 hover:bg-surface-2/60">
              {result.columns.map((c) => (
                <td key={c} className="max-w-[28rem] truncate px-3 py-1.5 font-mono text-xs">{formatCell(row[c])}</td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </table>
      <div className="flex items-center justify-between border-t border-line bg-surface-2 px-3 py-1 text-[11px] text-muted">
        <span>{result.rows.length} row{result.rows.length === 1 ? '' : 's'}</span>
        <ExportMenu columns={result.columns} rows={result.rows} />
      </div>
    </div>
  );
}

export function formatCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return <span className="text-muted italic">null</span>;
  if (typeof value === 'boolean') return <span className={value ? 'text-good' : 'text-bad'}>{String(value)}</span>;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}
