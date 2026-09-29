'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { queryEvents } from '@/config/query-events';
import { useLabStore } from '@/lib/store';

export function QueryTimeline() {
  const lab = useLabStore((state) => state.activeLab);
  const executing = useLabStore((state) => state.executing);
  const result = useLabStore((state) => state.result);
  const [active, setActive] = useState(-1);
  const events = queryEvents[lab];

  useEffect(() => {
    if (!executing) { setActive(result ? events.length - 1 : -1); return; }
    setActive(0);
    const timers = events.slice(1).map((_, index) => window.setTimeout(() => setActive(index + 1), (index + 1) * 250));
    return () => timers.forEach(window.clearTimeout);
  }, [executing, result, lab]);

  return <div className="glass rounded-2xl p-5"><div className="mb-4"><div className="text-sm font-semibold">Execution timeline</div><div className="mt-1 text-[11px] text-[var(--muted)]">Follow the request through the database.</div></div><div className="grid gap-2 md:grid-cols-4">{events.map((event, index) => { const reached = index <= active; return <div key={event.stage} className={`rounded-xl border p-3 transition-all duration-300 ${reached ? 'border-cyan-400/25 bg-cyan-400/[.04]' : 'border-[var(--line)] opacity-50'}`}><div className="flex items-center justify-between"><span className="text-[10px] text-slate-500">{event.stage}</span>{executing && index === active ? <Loader2 size={13} className="animate-spin text-cyan-300"/> : reached ? <Check size={13} className="text-emerald-300"/> : null}</div><div className="mt-2 text-xs font-semibold text-white">{event.title}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{event.detail}</div></div>})}</div></div>;
}
