'use client';

import { executionMachine, type ExecutionStage } from '@/config/execution-machine';
import { useLabStore } from '@/lib/store';

export function ExecutionStageBar() {
  const stage = useLabStore((state) => state.executionStage as ExecutionStage);
  const activeIndex = executionMachine.order.indexOf(stage);
  return <div className="glass rounded-2xl p-4"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-semibold">Database execution</span><span className="text-[10px] text-slate-500">{executionMachine.labels[stage]}</span></div><div className="flex gap-1">{executionMachine.order.map((item, index) => <div key={item} className="flex-1"><div className={`h-1 rounded-full transition-all duration-300 ${index <= activeIndex ? 'bg-cyan-300' : 'bg-white/[.06]'}`}/><div className="mt-2 text-[9px] text-slate-500">{executionMachine.labels[item]}</div></div>)}</div></div>;
}
