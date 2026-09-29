'use client';

import { LabShell } from '@/components/LabShell';
import { SqlWorkbench } from '@/components/SqlWorkbench';
import { InteractiveDatabasePanel } from '@/components/InteractiveDatabasePanel';

export default function InteractivePage() {
  return <LabShell><div className="space-y-5"><header className="glass rounded-2xl p-7"><div className="text-[11px] uppercase tracking-[.2em] text-cyan-300">Interactive PostgreSQL</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-5xl">One query. One execution story.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">Run the SQL and watch permissions, row policies, triggers, and database relationships react from the same execution state.</p></header><SqlWorkbench/><InteractiveDatabasePanel/></div></LabShell>;
}
