'use client';

import { Database, GitBranch, KeyRound, Play, ShieldCheck, Table2, UserRound, Zap } from 'lucide-react';
import { flowDefinitions, type FlowNodeKind } from '@/config/flow-definitions';

const icons: Record<FlowNodeKind, React.ElementType> = { client: UserRound, context: KeyRound, policy: ShieldCheck, function: Zap, trigger: GitBranch, table: Table2, audit: Database };
const tones: Record<FlowNodeKind, string> = { client: 'cyan', context: 'cyan', policy: 'green', function: 'purple', trigger: 'orange', table: 'purple', audit: 'orange' };

export function FlowPipeline({ type }: { type: keyof typeof flowDefinitions }) {
  const flow = flowDefinitions[type];
  return <div className="glass rounded-2xl p-5"><div className="mb-5 flex items-center justify-between"><div><div className="text-sm font-semibold">{flow.title}</div><div className="mt-1 text-[11px] text-[var(--muted)]">Click through the pipeline during the explanation.</div></div><Play size={15} className="text-slate-500"/></div><div className="overflow-x-auto pb-2"><div className="flex min-w-max items-center gap-2">{flow.nodes.map((node, index) => { const Icon = icons[node.kind]; const tone = tones[node.kind]; return <div key={node.id} className="flex items-center gap-2"><div className={`min-w-40 rounded-xl border border-${tone}-400/20 bg-${tone}-400/[.04] p-4 animate-float`}><div className="flex items-center gap-2"><Icon size={15}/><span className="text-xs font-semibold text-white">{node.label}</span></div><div className="mt-2 text-[10px] text-slate-500">{node.detail}</div></div>{index < flow.nodes.length - 1 && <div className="relative w-10"><div className="h-px bg-[var(--line)]"/><span className="absolute -top-1 left-0 h-2 w-2 rounded-full bg-cyan-300 flow-dot"/></div>}</div>})}</div></div></div>;
}
