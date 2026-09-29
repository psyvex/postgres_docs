'use client';

import { LabShell } from '@/components/LabShell';
import { PresenterControls } from '@/components/PresenterControls';
import { labs } from '@/lib/lab-config';
import { useLabStore } from '@/lib/store';

export default function PresenterPage() {
  const activeLab = useLabStore((state) => state.activeLab);
  const setLab = useLabStore((state) => state.setLab);
  const definition = labs.find((lab) => lab.id === activeLab) ?? labs[0];
  return <LabShell><div className="space-y-5"><PresenterControls/><div className="glass min-h-[65vh] rounded-3xl p-10 md:p-16"><div className="max-w-4xl"><div className="text-xs uppercase tracking-[.25em]" style={{color: definition.color}}>{definition.eyebrow}</div><h1 className="mt-4 text-5xl font-semibold tracking-tight text-white md:text-7xl">{definition.title}</h1><p className="mt-6 max-w-2xl text-base leading-7 text-[var(--muted)]">{definition.description}</p><div className="mt-12 grid gap-4 md:grid-cols-3">{definition.steps.map((step, index) => <button key={step.title} onClick={() => setLab(definition.id)} className="rounded-2xl border border-[var(--line)] bg-black/15 p-5 text-left hover:border-white/15"><div className="text-xs text-slate-500">0{index + 1}</div><div className="mt-3 text-sm font-semibold">{step.title}</div><div className="mt-2 text-xs leading-5 text-[var(--muted)]">{step.description}</div></button>)}</div></div></div></div></LabShell>;
}
