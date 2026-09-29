'use client';

import { ArrowDown, CornerDownLeft, FunctionSquare } from 'lucide-react';
import { functionJourney } from '@/config/function-journey';
import { useLabStore } from '@/lib/store';
import { usePresenterStore } from '@/lib/presenter-store';

export function FunctionCallStack() {
  const stage = useLabStore((state) => state.executionStage);
  const focused = usePresenterStore((state) => state.isFocused('function'));
  const active = stage === 'execute' || stage === 'result';
  return <div className={`glass rounded-2xl p-5 transition-all duration-500 ${focused ? 'ring-1 ring-cyan-300/40 shadow-[0_0_35px_rgba(103,232,249,.08)]' : ''}`}><div className="mb-4 flex items-center gap-2"><FunctionSquare size={15} className="text-cyan-300"/><div><div className="text-sm font-semibold">{functionJourney.title}</div><div className="text-[11px] text-[var(--muted)]">{functionJourney.sample.name}{functionJourney.sample.signature} → {functionJourney.sample.returnType}</div></div></div><div className="space-y-2">{functionJourney.steps.map((step, index) => { const visible = active || index === 0; const current = active && index === Math.min(3, Math.floor((stage === 'result' ? 3 : 2))); return <div key={step.id} className={`flex items-center gap-3 rounded-xl border p-3 transition-all duration-500 ${visible ? 'border-[var(--line)] opacity-100' : 'border-transparent opacity-40'} ${current || focused && index === 0 ? 'bg-cyan-300/[.06] border-cyan-300/25' : ''}`}><div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[.04] text-[10px] text-cyan-200">{index + 1}</div><div className="min-w-0 flex-1"><div className="text-xs font-medium">{step.label}</div><div className="mt-0.5 text-[10px] text-slate-500">{step.description}</div></div>{index < functionJourney.steps.length - 1 ? <ArrowDown size={12} className="text-slate-700"/> : <CornerDownLeft size={13} className="text-cyan-300"/>}</div>; })}</div></div>;
}
