'use client';

import { LabShell } from '@/components/LabShell';
import { SqlWorkbench } from '@/components/SqlWorkbench';
import { ResultTable } from '@/components/ResultTable';

export default function PlaygroundPage() {
  return <LabShell><div className="space-y-5"><header className="glass rounded-2xl p-7"><div className="text-[11px] uppercase tracking-[.2em] text-[var(--cyan)]">SQL Playground</div><h1 className="mt-2 text-3xl font-semibold">Query the teaching database</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--muted)]">A shared workbench for exploring the same state used by the labs.</p></header><SqlWorkbench/><div className="glass rounded-2xl p-5"><ResultTable/></div></div></LabShell>;
}
