'use client';

import { LabShell } from '@/components/LabShell';
import { PermissionMatrix } from '@/components/PermissionMatrix';
import { RowFilterVisualizer } from '@/components/RowFilterVisualizer';
import { TriggerRowDiff } from '@/components/TriggerRowDiff';
import { FunctionExecutionCard } from '@/components/FunctionExecutionCard';
import { RelationshipGraph } from '@/components/RelationshipGraph';
import { TriggerSimulator } from '@/components/TriggerSimulator';

export default function InteractivePage() {
  return <LabShell><div className="space-y-5"><header className="glass rounded-2xl p-7"><div className="text-[11px] uppercase tracking-[.2em] text-cyan-300">Interactive database lab</div><h1 className="mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">PostgreSQL mechanics, in motion.</h1><p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--muted)]">A single surface for the live explanations: permissions, RLS decisions, functions, triggers, row images, and database relationships.</p></header><div className="grid gap-5 xl:grid-cols-2"><PermissionMatrix/><FunctionExecutionCard/></div><RowFilterVisualizer/><div className="grid gap-5 xl:grid-cols-2"><TriggerRowDiff/><TriggerSimulator/></div><RelationshipGraph/></div></LabShell>;
}
