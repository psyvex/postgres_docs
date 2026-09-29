'use client';

import { Play, RotateCcw } from 'lucide-react';
import { useLabStore } from '@/lib/store';

export function SqlWorkbench() {
  const sql = useLabStore((state) => state.sqlByLab[state.activeLab]);
  const setSql = useLabStore((state) => state.setSql);
  const execute = useLabStore((state) => state.execute);
  const reset = useLabStore((state) => state.reset);
  const executing = useLabStore((state) => state.executing);
  return <div className="rounded-xl border border-[var(--line)] bg-[#05080d] p-4">
    <div className="mb-3 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-slate-500">SQL workbench</span><button onClick={reset} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-white"><RotateCcw size={11}/> reset</button></div>
    <textarea value={sql} onChange={(event) => setSql(event.target.value)} spellCheck={false} className="h-28 w-full resize-none bg-transparent font-mono text-xs leading-6 text-slate-200 outline-none" />
    <div className="mt-2 flex justify-end"><button onClick={execute} disabled={executing} className="flex items-center gap-2 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"><Play size={13}/>{executing ? 'Executing…' : 'Run Query'}</button></div>
  </div>;
}
