'use client';

import { useEffect } from 'react';
import { ChevronLeft, ChevronRight, Maximize2, Pause, Play, RotateCcw } from 'lucide-react';
import { labs } from '@/lib/lab-config';
import { presenterConfig } from '@/config/presenter';
import { useLabStore } from '@/lib/store';
import { usePresenterStore } from '@/lib/presenter-store';

export function PresenterControls() {
  const activeLab = useLabStore((state) => state.activeLab);
  const setLab = useLabStore((state) => state.setLab);
  const index = labs.findIndex((lab) => lab.id === activeLab);
  const previousLab = labs[index - 1];
  const nextLab = labs[index + 1];
  const mode = usePresenterStore((state) => state.mode);
  const revealIndex = usePresenterStore((state) => state.revealIndex);
  const playing = usePresenterStore((state) => state.playing);
  const setMode = usePresenterStore((state) => state.setMode);
  const next = usePresenterStore((state) => state.next);
  const previous = usePresenterStore((state) => state.previous);
  const togglePlay = usePresenterStore((state) => state.togglePlay);
  const reset = usePresenterStore((state) => state.reset);
  useEffect(() => { const handler = (event: KeyboardEvent) => { if (event.key === presenterConfig.shortcuts.next) next(); else if (event.key === presenterConfig.shortcuts.previous) previous(); else if (event.code === presenterConfig.shortcuts.play) { event.preventDefault(); togglePlay(); } else if (event.key.toLowerCase() === presenterConfig.shortcuts.reset) reset(); }; window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler); }, [next, previous, togglePlay, reset]);
  const open = () => document.documentElement.requestFullscreen?.();
  return <div className="glass sticky bottom-4 z-30 flex flex-wrap items-center gap-2 rounded-xl p-3 shadow-2xl"><div className="flex items-center gap-1"><button disabled={!previousLab} onClick={() => previousLab && setLab(previousLab.id)} className="rounded-lg border border-[var(--line)] p-2 text-slate-400 disabled:opacity-30"><ChevronLeft size={15}/></button><span className="px-2 text-[11px] text-slate-400">{index + 1} / {labs.length}</span><button disabled={!nextLab} onClick={() => nextLab && setLab(nextLab.id)} className="rounded-lg border border-[var(--line)] p-2 text-slate-400 disabled:opacity-30"><ChevronRight size={15}/></button></div><div className="flex rounded-lg border border-[var(--line)] p-0.5">{presenterConfig.modes.map((item) => <button key={item.id} onClick={() => setMode(item.id)} title={item.description} className={`rounded-md px-3 py-1.5 text-[10px] ${mode === item.id ? 'bg-cyan-400/10 text-cyan-200' : 'text-slate-500'}`}>{item.label}</button>)}</div><div className="ml-auto flex items-center gap-1"><button onClick={previous} className="rounded-lg p-2 text-slate-400 hover:bg-white/[.04] hover:text-white"><ChevronLeft size={14}/></button><span className="min-w-16 text-center text-[10px] text-slate-400">{presenterConfig.revealLabels[revealIndex]}</span><button onClick={next} className="rounded-lg p-2 text-slate-400 hover:bg-white/[.04] hover:text-white"><ChevronRight size={14}/></button><button onClick={togglePlay} className="rounded-lg bg-cyan-400 px-3 py-2 text-slate-950">{playing ? <Pause size={13}/> : <Play size={13}/>}</button><button onClick={reset} className="rounded-lg p-2 text-slate-400"><RotateCcw size={13}/></button><button onClick={open} className="rounded-lg border border-[var(--line)] p-2 text-slate-400 hover:text-white" title="Fullscreen"><Maximize2 size={13}/></button></div></div>;
}
