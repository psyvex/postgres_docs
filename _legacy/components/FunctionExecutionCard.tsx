'use client';

import { useEffect, useState } from 'react';
import { Check, Circle, Play } from 'lucide-react';
import { functionDemo } from '@/config/function-demo';

export function FunctionExecutionCard() {
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState(-1);
  useEffect(() => {
    if (!running) return;
    setStage(0);
    const timers = functionDemo.stages.slice(1).map((_, index) => window.setTimeout(() => setStage(index + 1), (index + 1) * 360));
    const done = window.setTimeout(() => setRunning(false), functionDemo.stages.length * 360 + 120);
    return () => { timers.forEach(window.clearTimeout); window.clearTimeout(done); };
  }, [running]);
  return <div className="glass rounded-2xl p-5"><div className="flex items-start justify-between gap-4"><div><div className="text-sm font-semibold">Function execution</div><div className="mt-1 font-mono text-[11px] text-slate-500">SELECT {functionDemo.name}({functionDemo.input.value});</div></div><button disabled={running} onClick={() => { setStage(-1); setRunning(true); }} className="flex items-center gap-2 rounded-lg bg-violet-400 px-3 py-2 text-[11px] font-semibold text-slate-950 disabled:opacity-50"><Play size={12}/> Run function</button></div><div className="mt-5 grid gap-2 md:grid-cols-4">{functionDemo.stages.map((item, index) => <div key={item.id} className={`rounded-xl border p-3 transition-all duration-300 ${index <= stage ? 'border-violet-400/25 bg-violet-400/[.05]' : 'border-[var(--line)] opacity-45'}`}><div className="flex justify-between"><span className="text-[10px] text-slate-500">0{index + 1}</span>{index <= stage ? <Check size={13} className="text-emerald-300"/> : <Circle size={13} className="text-slate-700"/>}</div><div className="mt-2 text-xs font-semibold">{item.label}</div><div className="mt-1 text-[10px] leading-4 text-slate-500">{item.detail}</div></div>)}</div><div className={`mt-4 rounded-xl border p-4 transition ${stage === functionDemo.stages.length - 1 ? 'border-emerald-400/25 bg-emerald-400/[.04]' : 'border-[var(--line)] opacity-50'}`}><div className="text-[10px] uppercase tracking-wider text-slate-500">Return value</div><div className="mt-2 font-mono text-sm text-white">{functionDemo.result.label} = {functionDemo.result.value}</div></div></div>;
}
