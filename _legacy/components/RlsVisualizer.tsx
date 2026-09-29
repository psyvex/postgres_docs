'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Filter, Loader2, ShieldCheck, XCircle } from 'lucide-react';
import { rlsVisualizerStates, rlsVisualizerSteps } from '@/config/rls-visualizer';
import { summarizeRlsResult, toVisualRows, type RlsVisualRow } from '@/lib/rls-visualization';

type Props = { rows: Array<Record<string, unknown>>; durationMs?: number; error?: string | null };

export function RlsVisualizer({ rows, durationMs, error }: Props) {
  const [step, setStep] = useState(error ? -1 : 0);
  const [visualRows, setVisualRows] = useState<RlsVisualRow[]>([]);
  useEffect(() => { if (error) { setStep(-1); return; } setStep(0); setVisualRows([]); const timers = rlsVisualizerSteps.map((_, index) => window.setTimeout(() => setStep(index), index * 500)); const final = window.setTimeout(() => setVisualRows(toVisualRows(rows)), rlsVisualizerSteps.length * 500); return () => { timers.forEach(window.clearTimeout); window.clearTimeout(final); }; }, [rows, error]);
  const summary = summarizeRlsResult(rows);
  const state = error ? rlsVisualizerStates.error : step < 2 ? rlsVisualizerStates.evaluating : rlsVisualizerStates.allowed;
  return <div className="glass rounded-2xl p-5"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><ShieldCheck size={16} className="text-cyan-300"/><span className="text-sm font-semibold">RLS evaluation</span></div><span className="rounded-full border border-[var(--line)] px-2 py-1 text-[10px] text-slate-400">{state.label}</span></div>{error ? <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-300/20 bg-red-300/[.05] p-3 text-xs text-red-200"><XCircle size={15}/>{error}</div> : <><div className="mt-5 grid gap-2 sm:grid-cols-4">{rlsVisualizerSteps.map((label, index) => <div key={label} className={`rounded-xl border p-3 transition-all duration-500 ${index <= step ? 'border-cyan-300/30 bg-cyan-300/[.05]' : 'border-[var(--line)] opacity-40'}`}>{index < step ? <CheckCircle2 size={14} className="text-emerald-300"/> : index === step ? <Loader2 size={14} className="animate-spin text-cyan-300"/> : <Circle size={14}/>}<div className="mt-2 text-[10px] text-slate-300">{label}</div></div>)}</div><div className="mt-5 flex gap-3"><div className="rounded-xl border border-[var(--line)] px-4 py-3"><div className="text-lg font-semibold text-white">{summary.visible}</div><div className="text-[10px] text-slate-500">rows returned</div></div><div className="rounded-xl border border-[var(--line)] px-4 py-3"><div className="text-lg font-semibold text-white">{durationMs ?? '—'}{durationMs !== undefined ? 'ms' : ''}</div><div className="text-[10px] text-slate-500">execution</div></div></div>{visualRows.length > 0 && <div className="mt-5 space-y-2">{visualRows.map((row) => <div key={row.id} className="flex items-center gap-2 rounded-xl border border-emerald-300/20 bg-emerald-300/[.03] p-3 transition-all"><CheckCircle2 size={14} className="text-emerald-300"/><span className="text-[10px] text-slate-300">Row {row.id} visible</span><span className="ml-auto text-[10px] text-slate-500">RLS allowed</span></div>)}</div>}</>}</div>;
}
