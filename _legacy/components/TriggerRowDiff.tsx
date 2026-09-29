'use client';

import { ArrowRight, Minus, Plus } from 'lucide-react';
import { triggerDiffDemo } from '@/config/trigger-diff';

const columns = Object.keys(triggerDiffDemo.oldRow) as Array<keyof typeof triggerDiffDemo.oldRow>;

export function TriggerRowDiff() {
  return <div className="glass rounded-2xl p-5"><div className="mb-4"><div className="text-sm font-semibold">OLD → NEW row image</div><div className="mt-1 text-[11px] text-[var(--muted)]">A trigger can inspect the row before and after a mutation.</div></div><div className="grid gap-3 md:grid-cols-[1fr_auto_1fr]"><div className="rounded-xl border border-red-400/15 bg-red-400/[.025] p-3"><div className="mb-2 text-[10px] uppercase tracking-wider text-red-300">OLD</div>{columns.map((column) => <div key={column} className="flex justify-between py-1.5 font-mono text-[10px]"><span className="text-slate-500">{column}</span><span>{triggerDiffDemo.oldRow[column]}</span></div>)}</div><div className="grid place-items-center"><ArrowRight size={18} className="text-orange-300"/></div><div className="rounded-xl border border-emerald-400/15 bg-emerald-400/[.025] p-3"><div className="mb-2 text-[10px] uppercase tracking-wider text-emerald-300">NEW</div>{columns.map((column) => { const changed = triggerDiffDemo.changedColumns.includes(column); return <div key={column} className={`flex justify-between py-1.5 font-mono text-[10px] ${changed ? 'rounded bg-emerald-400/[.08] text-emerald-200' : ''}`}><span className="text-slate-500">{column}</span><span>{triggerDiffDemo.newRow[column]}</span></div>; })}</div></div><div className="mt-3 flex items-center gap-2 text-[10px] text-slate-500"><Minus size={11}/>{triggerDiffDemo.trigger}<ArrowRight size={11}/><Plus size={11}/>{triggerDiffDemo.function}</div></div>;
}
