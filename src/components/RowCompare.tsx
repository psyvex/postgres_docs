'use client';

import { ArrowRight, Minus, Sparkles } from 'lucide-react';
import { rowCompareConfig } from '@/config/row-compare';
import { useLabStore } from '@/lib/store';

export function RowCompare() {
  const stage = useLabStore((state) => state.executionStage);
  const active = stage === 'execute' || stage === 'result';
  return <div className="glass rounded-2xl p-5"><div className="mb-4 flex items-center gap-2"><Sparkles size={15} className="text-orange-300"/><div><div className="text-sm font-semibold">{rowCompareConfig.title}</div><div className="text-[11px] text-[var(--muted)]">The row values available to a trigger function.</div></div></div><div className="space-y-2">{rowCompareConfig.sample.map((item) => { const changed = item.oldValue !== item.newValue; return <div key={item.field} className={`grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border p-3 transition-all duration-500 ${active && changed ? 'border-orange-400/30 bg-orange-400/[.05]' : 'border-[var(--line)]'}`}><div><div className="text-[9px] uppercase text-slate-600">OLD</div><div className="mt-1 font-mono text-xs text-slate-300">{item.oldValue}</div></div><div>{changed ? <ArrowRight size={14} className="text-orange-300"/> : <Minus size={14} className="text-slate-600"/>}</div><div><div className="text-[9px] uppercase text-slate-600">NEW</div><div className="mt-1 font-mono text-xs text-slate-300">{item.newValue}</div></div></div>})}</div></div>;
}
