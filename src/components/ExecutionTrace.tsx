'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { executionTraceCopy, executionTraceSteps } from '@/config/execution-trace';
import type { ExecutionTrace } from '@/lib/execution-trace';

export function ExecutionTrace({ trace }: { trace: ExecutionTrace }) {
  const [activeStep, setActiveStep] = useState(trace.activeStep);
  useEffect(() => {
    setActiveStep(trace.status === 'running' ? 0 : trace.activeStep);
    if (trace.status !== 'running') return;
    const timers = executionTraceSteps.map((_, index) => window.setTimeout(() => setActiveStep(index), index * 450));
    return () => timers.forEach(window.clearTimeout);
  }, [trace]);
  const title = trace.status === 'running' ? executionTraceCopy.running : trace.status === 'complete' ? executionTraceCopy.complete : trace.status === 'failed' ? executionTraceCopy.failed : executionTraceCopy.idle;
  return <div className="glass rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><div className="text-sm font-semibold">{executionTraceCopy.title}</div><span className="text-[10px] text-slate-500">{title}</span></div><div className="grid gap-2 sm:grid-cols-4">{executionTraceSteps.map((item, index) => { const done = trace.status === 'complete' ? true : index < activeStep; const current = trace.status === 'running' && index === activeStep; return <div key={item.id} className={`rounded-xl border p-3 transition-all duration-500 ${done || current ? 'border-cyan-300/30 bg-cyan-300/[.04]' : 'border-[var(--line)] opacity-50'}`}>{trace.status === 'failed' && index === activeStep ? <XCircle size={14} className="text-red-300"/> : done ? <CheckCircle2 size={14} className="text-emerald-300"/> : current ? <Loader2 size={14} className="animate-spin text-cyan-300"/> : <Circle size={14} className="text-slate-500"/>}<div className="mt-2 text-[10px] text-slate-300">{item.label}</div></div>; })}</div>{trace.status === 'complete' && <div className="mt-4 flex gap-3"><div className="rounded-xl border border-[var(--line)] px-4 py-3"><div className="text-lg font-semibold">{trace.rowCount ?? 0}</div><div className="text-[10px] text-slate-500">rows</div></div><div className="rounded-xl border border-[var(--line)] px-4 py-3"><div className="text-lg font-semibold">{trace.durationMs ?? 0}ms</div><div className="text-[10px] text-slate-500">execution</div></div></div>}{trace.error && <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/[.04] p-3 text-[10px] text-red-200">{trace.error}</div>}</div>;
}
