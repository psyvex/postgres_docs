'use client';

import { useEffect, useState } from 'react';
import { Check, Circle, Zap } from 'lucide-react';
import { auditConfig } from '@/config/audit';
import { useLabStore } from '@/lib/store';

export function TriggerSimulator() {
  const executing = useLabStore((state) => state.executing);
  const [stage, setStage] = useState(-1);
  const steps = [auditConfig.statuses.pending, auditConfig.statuses.fired, auditConfig.statuses.persisted];
  useEffect(() => {
    if (!executing) { setStage(-1); return; }
    setStage(0);
    const timers = [1, 2].map((step) => window.setTimeout(() => setStage(step), step * 350));
    return () => timers.forEach(window.clearTimeout);
  }, [executing]);
  return <div className="glass rounded-2xl p-5"><div className="mb-4 flex items-center gap-2"><Zap size={15} className="text-orange-300"/><div><div className="text-sm font-semibold">Trigger simulator</div><div className="text-[11px] text-[var(--muted)]">UPDATE → trigger → function → audit row</div></div></div><div className="space-y-2">{steps.map((step, index) => <div key={step} className={`flex items-center gap-3 rounded-xl border p-3 transition-all ${index <= stage ? 'border-orange-400/20 bg-orange-400/[.03]' : 'border-[var(--line)] opacity-45'}`}>{index <= stage ? <Check size={14} className="text-emerald-300"/> : <Circle size={14} className="text-slate-600"/>}<span className="text-xs">{step}</span></div>)}</div></div>;
}
