'use client';

import { presenterConfig } from '@/config/presenter';
import { usePresenterStore } from '@/lib/presenter-store';

export function PresenterReveal() {
  const index = usePresenterStore((state) => state.revealIndex);
  return <div className="grid grid-cols-5 gap-1">{presenterConfig.revealLabels.map((label, itemIndex) => <div key={label} className={`rounded-lg border px-2 py-2 text-center text-[9px] transition-all ${itemIndex <= index ? 'border-cyan-400/25 bg-cyan-400/[.05] text-cyan-200' : 'border-[var(--line)] text-slate-600'}`}>{label}</div>)}</div>;
}
