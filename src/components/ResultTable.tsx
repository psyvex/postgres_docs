'use client';

import { useLabStore } from '@/lib/store';

export function ResultTable() {
  const result = useLabStore((state) => state.result);
  if (!result) return <div className="grid min-h-52 place-items-center rounded-xl border border-dashed border-[var(--line)] text-xs text-slate-500">Run a query to inspect the result.</div>;
  return <div className="overflow-hidden rounded-xl border border-[var(--line)]">
    <div className="flex items-center justify-between border-b border-[var(--line)] bg-white/[.025] px-4 py-3 text-[10px] text-slate-500"><span>{result.message}</span><span>{result.durationMs} ms · {result.rowCount} rows</span></div>
    {result.status === 'error' ? <div className="p-5 text-xs text-red-300">{result.message}</div> : result.rowCount === 0 ? <div className="p-5 text-xs text-slate-500">No rows returned.</div> : <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr>{result.columns.map((column) => <th key={column} className="border-b border-[var(--line)] px-4 py-3 text-[10px] font-medium uppercase tracking-wider text-slate-500">{column}</th>)}</tr></thead><tbody>{result.rows.map((row, index) => <tr key={index} className="border-b border-[var(--line)] last:border-0 hover:bg-white/[.025]">{result.columns.map((column) => <td key={column} className="px-4 py-3 font-mono text-slate-300">{String(row[column] ?? 'null')}</td>)}</tr>)}</tbody></table></div>}
  </div>;
}
