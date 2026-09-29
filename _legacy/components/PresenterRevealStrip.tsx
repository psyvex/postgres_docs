'use client';

import { presenterReveal } from '@/config/presenter-reveal';
import { usePresenterStore } from '@/lib/presenter-store';

export function PresenterRevealStrip() {
  const index = usePresenterStore((state) => state.revealIndex);
  const mode = usePresenterStore((state) => state.mode);
  const next = usePresenterStore((state) => state.next);
  const previous = usePresenterStore((state) => state.previous);
  return <div className="glass rounded-2xl p-4"><div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold">Presentation flow</div><div className="mt-1 text-[10px] text-slate-500">{presenterReveal.steps[index]?.description}</div></div><span className="rounded-full border border-[var(--line)] px-2 py-1 text-[9px] uppercase text-cyan-300">{mode}</span></div><div className="grid grid-cols-5 gap-2">{presenterReveal.steps.map((step, stepIndex) => <button key={step.id} onClick={() => { if (stepIndex > index) next(); else if (stepIndex < index) previous(); }} className="group text-left"><div className={`h-1 rounded-full transition-all duration-300 ${stepIndex <= index || mode === 'live' ? 'bg-cyan-300' : 'bg-white/[.07]'}`}/><div className={`mt-2 text-[9px] ${stepIndex === index ? 'text-cyan-200' : 'text-slate-600 group-hover:text-slate-400'}`}>{step.label}</div></button>)}</div></div>;
}
