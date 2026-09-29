'use client';

import { ArrowRight, Bolt, GitBranch } from 'lucide-react';
import { triggerJourney } from '@/config/trigger-journey';
import { useLabStore } from '@/lib/store';
import { usePresenterStore } from '@/lib/presenter-store';

export function TriggerPipeline() {
  const stage = useLabStore((state) => state.executionStage);
  const focused = usePresenterStore((state) => state.isFocused('trigger'));
  const trace = useLabStore((state) => state.trace);
  const active = Boolean(trace?.mutation) || stage === 'execute' || stage === 'result';
  return <div className={`glass rounded-2xl p-5 transition-all duration-500 ${focused ? 'ring-1 ring-orange-300/40 shadow-[0_0_35px_rgba(251,146,60,.08)]' : ''}`}><div className="mb-4 flex items-center gap-2"><Bolt size={15} className="text-orange-300"/><div><div className="text-sm font-semibold">{triggerJourney.title}</div><div className="text-[11px] text-[var(--muted)]">{triggerJourney.sample.event} → {triggerJourney.sample.function} → {triggerJourney.sample.sideEffect}</div></div></div><div className="flex flex-wrap items-stretch gap-2">{triggerJourney.steps.map((step, index) => { const visible = active || index === 0; const current = active && index === Math.min(triggerJourney.steps.length - 1, stage === 'result' ? 4 : 2); return <div key={step.id} className="flex min-w-28 flex-1 items-center gap-2"><div className={`flex-1 rounded-xl border p-3 transition-all duration-500 ${visible ? 'opacity-100' : 'opacity-35'} ${current || focused && index === 0 ? 'border-orange-300/30 bg-orange-300/[.05]' : 'border-[var(--line)]'}`}><div className="flex items-center gap-2"><GitBranch size={12} className="text-orange-300"/><span className="text-[10px] font-semibold">{step.label}</span></div><div className="mt-1 text-[9px] leading-4 text-slate-500">{step.description}</div></div>{index < triggerJourney.steps.length - 1 && <ArrowRight size={12} className="shrink-0 text-slate-700"/>}</div>; })}</div></div>;
}
