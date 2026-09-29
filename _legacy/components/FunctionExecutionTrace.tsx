'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { functionExecutionCopy, functionExecutionSteps } from '@/config/functions-execution';

export type FunctionExecutionState = { status: 'idle' | 'running' | 'complete' | 'failed'; activeStep: number; durationMs?: number; rowCount?: number | null; error?: string };

export function FunctionExecutionTrace({ state }: { state: FunctionExecutionState }) {
  const [active, setActive] = useState(state.activeStep);
  useEffect(() => { setActive(state.status === 'running' ? 0 : state.activeStep); if (state.status !== 'running') return; const timers = functionExecutionSteps.map((_, index) => window.setTimeout(() => setActive(index), index * 450)); return () => timers.forEach(window.clearTimeout); }, [state]);
  const title = state.status === 'running' ? functionExecutionCopy.executing : state.status === 'complete' ? functionExecutionCopy.complete : state.status === 'failed' ? functionExecutionCopy.failed : 'Ready';
  return <div className="mt-5 rounded-2xl border border-[var(--line)] bg-black/10 p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">Function execution</span><span className="text-[10px] text-slate-500">{title}</span></div><div className="grid gap-2 sm:grid-cols-4">{functionExecutionSteps.map((item, index) => { const done = state.status === 'complete' || index < active; const current = state.status === 'running' && index === active; return <div key={item.id} className={`rounded-xl border p-3 transition-all duration-500 ${done || current ? 'border-cyan-300/30 bg-cyan-300/[.04]' : 'border-[var(--line)] opacity-50'}`}>{state.status === 'failed' && index === active ? <XCircle size={13} className="text-red-300"/> : done ? <CheckCircle2 size={13} className="text-emerald-300"/> : current ? <Loader2 size={13} className="animate-spin text-cyan-300"/> : <Circle size={13}/>}<div className="mt-2 text-[9px] text-slate-300">{item.label}</div></div>; })}</div>{state.status === 'complete' && <div className="mt-3 flex gap-2"><span className="rounded-lg border border-[var(--line)] px-3 py-2 text-[10px]">{state.rowCount ?? 0} rows</span><span className="rounded-lg border border-[var(--line)] px-3 py-2 text-[10px]">{state.durationMs ?? 0}ms</span></div>}{state.error && <div className="mt-3 rounded-lg border border-red-300/20 p-2 text-[10px] text-red-200">{state.error}</div>}</div>;
}
