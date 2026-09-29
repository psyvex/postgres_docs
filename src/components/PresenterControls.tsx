'use client';

import { ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import { labs } from '@/lib/lab-config';
import { useLabStore } from '@/lib/store';

export function PresenterControls() {
  const activeLab = useLabStore((state) => state.activeLab);
  const setLab = useLabStore((state) => state.setLab);
  const index = labs.findIndex((lab) => lab.id === activeLab);
  const previous = labs[index - 1];
  const next = labs[index + 1];
  const open = () => document.documentElement.requestFullscreen?.();
  return <div className="glass flex items-center justify-between rounded-xl p-3"><div className="flex items-center gap-2"><button disabled={!previous} onClick={() => previous && setLab(previous.id)} className="rounded-lg border border-[var(--line)] p-2 text-slate-400 disabled:opacity-30"><ChevronLeft size={15}/></button><span className="px-2 text-[11px] text-slate-400">{index + 1} / {labs.length}</span><button disabled={!next} onClick={() => next && setLab(next.id)} className="rounded-lg border border-[var(--line)] p-2 text-slate-400 disabled:opacity-30"><ChevronRight size={15}/></button></div><button onClick={open} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-[11px] text-slate-400 hover:text-white"><Maximize2 size={13}/> Presenter view</button></div>;
}
