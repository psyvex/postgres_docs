'use client';

import { Play, RotateCcw, Sparkles } from 'lucide-react';
import { sessionContent } from '@/config/content';
import { queryPresets } from '@/config/query-presets';
import { useLabStore } from '@/lib/store';
import { SqlExamples } from './SqlExamples';

export function SqlWorkbench() {
  const lab = useLabStore((state) => state.activeLab);
  const sql = useLabStore((state) => state.sqlByLab[lab]);
  const setSql = useLabStore((state) => state.setSql);
  const execute = useLabStore((state) => state.execute);
  const reset = useLabStore((state) => state.reset);
  const executing = useLabStore((state) => state.executing);
  const presets = queryPresets[lab];
  return <div className="rounded-xl border border-[var(--line)] bg-[#05080d] p-4">
    <div className="mb-3 flex items-center justify-between"><span className="text-[10px] uppercase tracking-wider text-slate-500">{sessionContent.workbench.title}</span><button onClick={reset} className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-white"><RotateCcw size={11}/> {sessionContent.workbench.reset}</button></div>
    <SqlExamples />
    <div className="mt-3 flex flex-wrap gap-2">{presets.map((preset) => <button key={preset.label} title={preset.purpose} onClick={() => setSql(preset.sql)} className="flex items-center gap-1.5 rounded-lg border border-[var(--line)] px-2.5 py-1.5 text-[10px] text-slate-400 hover:border-cyan-400/30 hover:text-cyan-200"><Sparkles size={11}/>{preset.label}</button>)}</div>
    <textarea value={sql} onChange={(event) => setSql(event.target.value)} spellCheck={false} className="mt-3 h-28 w-full resize-none rounded-lg border border-[var(--line)] bg-black/20 p-3 font-mono text-xs leading-6 text-slate-200 outline-none focus:border-cyan-400/40" />
    <div className="mt-2 flex justify-end"><button onClick={execute} disabled={executing} className="flex items-center gap-2 rounded-lg bg-cyan-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-cyan-300 disabled:opacity-60"><Play size={13}/>{executing ? sessionContent.workbench.executing : sessionContent.workbench.execute}</button></div>
  </div>;
}
