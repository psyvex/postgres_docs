'use client';

import { focusJourney } from '@/config/focus-journey';
import { usePresenterStore } from '@/lib/presenter-store';

export function JourneyRail() {
  const index = usePresenterStore((state) => state.revealIndex);
  const mode = usePresenterStore((state) => state.mode);
  const next = usePresenterStore((state) => state.next);
  const previous = usePresenterStore((state) => state.previous);
  return <div className="glass rounded-2xl p-4"><div className="mb-3 flex items-center justify-between"><div><div className="text-xs font-semibold">Database journey</div><div className="text-[10px] text-slate-500">{focusJourney[index]?.description}</div></div><span className="text-[9px] uppercase tracking-wider text-cyan-300">{mode}</span></div><div className="flex gap-1.5 overflow-x-auto pb-1">{focusJourney.map((step, i) => { const active = i === index; const revealed = mode === 'live' || i <= index; return <button key={step.id} onClick={() => { if (i > index) next(); else if (i < index) previous(); }} className="min-w-20 flex-1 text-left"><div className={`h-1 rounded-full transition-all duration-500 ${active ? 'bg-cyan-300 shadow-[0_0_14px_rgba(103,232,249,.55)]' : revealed ? 'bg-cyan-300/40' : 'bg-white/[.07]'}`}/><div className={`mt-2 text-[9px] ${active ? 'text-cyan-200' : revealed ? 'text-slate-400' : 'text-slate-700'}`}>{step.label}</div></button>; })}</div></div>;
}
