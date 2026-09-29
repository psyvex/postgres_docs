'use client';

import { useEffect, useState } from 'react';
import { CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { triggerExecutionCopy, triggerExecutionSteps } from '@/config/trigger-execution';

type Trace = { status: 'idle' | 'running' | 'complete' | 'failed'; activeStep: number; durationMs?: number; error?: string };

export function TriggerExecutionTrace({ trace }: { trace: Trace }) {
  const [active, setActive] = useState(trace.activeStep);
  useEffect(() => { setActive(trace.status === 'running' ? 0 : trace.activeStep); if (trace.status !== 'running') return; const timers = triggerExecutionSteps.map((_, index) => window.setTimeout(() => setActive(index), index * 500)); return () => timers.forEach(window.clearTimeout); }, [trace]);
  const title = trace.status === 'running' ? triggerExecutionCopy.running : trace.status === 'complete' ? triggerExecutionCopy.complete : trace.status === 'failed' ? triggerExecutionCopy.failed : 'Ready';
  return <div className="glass rounded-2xl p-5"><div className="mb-4 flex items-center justify-between"><div className="text-sm font-semibold">{triggerExecutionCopy.title}</div><span className="text-[10px] text-slate-500">{title}</span></div><div className="grid gap-2 sm:grid-cols-4">{triggerExecutionSteps.map((item, index) => { const done = trace.status === 'complete' || index < active; const current = trace.status === 'running' && index === active; return <div key={item.id} className={`rounded-xl border p-3 transition-all duration-500 ${done || current ? 'border-cyan-300/30 bg-cyan-300/[.04]' : 'border-[var(--line)] opacity-50'}`}>{trace.status === 'failed' && index === active ? <XCircle size={13} className="text-red-300"/> : done ? <CheckCircle2 size={13} className="text-emerald-300"/> : current ? <Loader2 size={13} className="animate-spin text-cyan-300"/> : <Circle size={13}/>}<div className="mt-2 text-[9px] text-slate-300">{item.label}</div></div>; })}</div>{trace.durationMs !== undefined && <div className="mt-4 text-[10px] text-slate-500">Completed in {trace.durationMs}ms</div>}{trace.error && <div className="mt-3 rounded-lg border border-red-300/20 p-2 text-[10px] text-red-200">{trace.error}</div>}</div>;
}
