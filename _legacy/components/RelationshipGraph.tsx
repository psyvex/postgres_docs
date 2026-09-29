'use client';

import { ArrowRight, Table2, Zap } from 'lucide-react';
import { relationshipGraph } from '@/config/relationship-graph';

const icons = { table: Table2, function: Zap } as const;

export function RelationshipGraph() {
  return <div className="glass rounded-2xl p-5"><div className="mb-5"><div className="text-sm font-semibold">Database relationship graph</div><div className="mt-1 text-[11px] text-[var(--muted)]">Foreign keys, trigger dependencies, and database functions in one view.</div></div><div className="grid gap-3 md:grid-cols-4">{relationshipGraph.nodes.map((node) => { const Icon = icons[node.type]; return <div key={node.id} className="rounded-xl border border-[var(--line)] bg-black/10 p-4"><div className="flex items-center gap-2"><Icon size={14} className="text-cyan-300"/><span className="text-xs font-semibold">{node.label}</span></div><div className="mt-2 text-[10px] text-slate-500">{node.type}</div></div>; })}</div><div className="mt-4 grid gap-2">{relationshipGraph.edges.map((edge) => <div key={`${edge.from}-${edge.to}`} className="flex items-center gap-2 rounded-lg border border-[var(--line)] px-3 py-2 text-[10px] text-slate-400"><span className="font-mono text-cyan-200">{edge.from}</span><ArrowRight size={12}/><span className="font-mono text-violet-200">{edge.to}</span><span className="ml-auto rounded-full bg-white/[.03] px-2 py-1">{edge.label}</span></div>)}</div></div>;
}
