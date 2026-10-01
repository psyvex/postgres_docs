'use client';

import { useState } from 'react';
import { Download } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useMotionPresets } from '@/lib/motion';

type Props = { columns: string[]; rows: Record<string, unknown>[] };

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(columns: string[], rows: Record<string, unknown>[]): string {
  const hdr = columns.map(csvCell).join(',');
  const body = rows.map((r) => columns.map((c) => csvCell(r[c])).join(',')).join('\n');
  return `${hdr}\n${body}`;
}

function toJson(columns: string[], rows: Record<string, unknown>[]): string {
  return JSON.stringify(rows.map((r) => Object.fromEntries(columns.map((c) => [c, r[c] ?? null]))), null, 2);
}

function sqlVal(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
}

function toInsert(columns: string[], rows: Record<string, unknown>[], table = 'result'): string {
  if (rows.length === 0) return `-- 0 rows`;
  const cols = columns.join(', ');
  return rows
    .map((r) => `INSERT INTO ${table} (${cols}) VALUES (${columns.map((c) => sqlVal(r[c])).join(', ')});`)
    .join('\n');
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

type Format = 'csv' | 'json' | 'insert';
type Feedback = 'idle' | 'copied' | 'error';

export function ExportMenu({ columns, rows }: Props) {
  const [open, setOpen] = useState(false);
  const [fb, setFb] = useState<Feedback>('idle');
  const [lastFmt, setLastFmt] = useState<Format>('csv');
  const { popover: menu } = useMotionPresets();

  function flash(f: Feedback, fmt: Format) {
    setFb(f); setLastFmt(fmt);
    setTimeout(() => setFb('idle'), 2000);
  }

  async function run(fmt: Format, action: 'copy' | 'download') {
    const text = fmt === 'csv' ? toCsv(columns, rows) : fmt === 'json' ? toJson(columns, rows) : toInsert(columns, rows);
    try {
      if (action === 'download') {
        download(
          fmt === 'csv' ? 'results.csv' : fmt === 'json' ? 'results.json' : 'results.sql',
          text,
          fmt === 'csv' ? 'text/csv' : fmt === 'json' ? 'application/json' : 'text/plain',
        );
      } else {
        await copyText(text);
      }
      flash('copied', fmt);
    } catch {
      flash('error', fmt);
    }
    setOpen(false);
  }

  const FB_LABEL: Record<Feedback, string> = { idle: '', copied: 'Copied ✓', error: 'Failed' };
  const FB_CLS: Record<Feedback, string> = { idle: '', copied: 'text-good', error: 'text-bad' };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 rounded px-2 py-0.5 text-[11px] font-semibold text-muted hover:bg-surface-2 hover:text-text"
        aria-expanded={open}
        aria-haspopup="true"
      >
        <Download className="h-3 w-3" /> Export
      </button>
      {fb !== 'idle' && (
        <span className={`ml-1 text-[11px] font-semibold ${FB_CLS[fb]}`}>{FB_LABEL[fb]} {lastFmt.toUpperCase()}</span>
      )}
      <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <motion.ul
            className="absolute end-0 top-full z-30 mt-1 min-w-36 overflow-hidden rounded-lg border border-line bg-surface shadow-card text-xs"
            {...menu}
          >
            {(
              [
                ['Copy as CSV', 'csv', 'copy'],
                ['Copy as JSON', 'json', 'copy'],
                ['Copy as INSERT', 'insert', 'copy'],
                ['|', '', ''],
                ['Download CSV', 'csv', 'download'],
                ['Download JSON', 'json', 'download'],
              ] as const
            ).map(([label, fmt, action]) =>
              label === '|' ? (
                <li key="sep" className="border-t border-line" />
              ) : (
                <li key={label}>
                  <button
                    onClick={() => run(fmt as Format, action as 'copy' | 'download')}
                    className="w-full px-3 py-1.5 text-start hover:bg-surface-2"
                  >
                    {label}
                  </button>
                </li>
              ),
            )}
          </motion.ul>
        </>
      )}
      </AnimatePresence>
    </div>
  );
}
