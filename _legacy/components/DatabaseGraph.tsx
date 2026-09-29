'use client';

import { Database, FunctionSquare, Link2 } from 'lucide-react';
import { databaseGraph } from '@/config/database-graph';
import { useLabStore } from '@/lib/store';

const icons = { table: Database, function: FunctionSquare } as const;

export function DatabaseGraph() {
  const stage = useLabStore((state) => state.executionStage);
  const active = stage === 'policy' || stage === 'execute' || stage === 'result';
  return <div className="glass rounded-2xl p-5"><div className="mb-4 flex items-center gap-2"><Link2 size={15} className="text-cyan-300"/><div><div className="text-sm font-semibold">Database relationships</div><div className="text-[11px] text-[var(--muted)]">Schema structure and automation paths.</div></div></div><div className="relative aspect-[16/8] overflow-hidden rounded-xl border border-[var(--line)] bg-black/15">{databaseGraph.edges.map((edge) => { const from = databaseGraph.nodes.find((node) => node.id === edge.from)!; const to = databaseGraph.nodes.find((node) => node.id === edge.to)!; return <div key={`${edge.from}-${edge.to}`} className={`absolute h-px origin-left transition-all duration-700 ${active ? 'bg-cyan-300/50' : 'bg-white/10'}`} style={{ left: `${from.x}%`, top: `${from.y}%`, width: `${Math.hypot(to.x - from.x, to.y - from.y)}%`, transform: `rotate(${Math.atan2(to.y - from.y, to.x - from.x) * 180 / Math.PI}deg)` }}><span className="absolute -top-4 left-1/2 whitespace-nowrap text-[8px] text-slate-600">{edge.label}</span></div>})}{databaseGraph.nodes.map((node) => { const Icon = icons[node.type as keyof typeof icons]; return <div key={node.id} className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-xl border px-3 py-2 transition-all duration-500 ${active ? 'border-cyan-400/30 bg-cyan-400/[.05]' : 'border-[var(--line)] bg-[#080b10]'}`} style={{ left: `${node.x}%`, top: `${node.y}%` }}><div className="flex items-center gap-2 text-[10px] font-semibold text-white">{Icon && <Icon size={12}/>} {node.label}</div></div>})}</div></div>;
}
