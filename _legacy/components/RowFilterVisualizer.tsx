'use client';

import { useEffect, useState } from 'react';
import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import { rowVisualization } from '@/config/row-visualization';
import { focusVisuals } from '@/config/focus-visuals';
import { demoData } from '@/lib/lab-config';
import { useLabStore } from '@/lib/store';
import { usePresenterStore } from '@/lib/presenter-store';

export function RowFilterVisualizer() {
  const tenantId = useLabStore((state) => state.activeTenantId);
  const rlsEnabled = useLabStore((state) => state.rlsEnabled);
  const executing = useLabStore((state) => state.executing);
  const executionStage = useLabStore((state) => state.executionStage);
  const revealRls = usePresenterStore((state) => state.isRevealed('rls'));
  const revealRows = usePresenterStore((state) => state.isRevealed('rows'));
  const [revealed, setRevealed] = useState<string[]>([]);
  useEffect(() => { if (!executing) return; setRevealed([]); const ids = demoData.orders.filter((order) => !rlsEnabled || order.tenantId === tenantId).map((order) => order.id); const timers = ids.map((id, index) => window.setTimeout(() => setRevealed((current) => [...current, id]), index * rowVisualization.animation.staggerMs + rowVisualization.animation.decisionMs)); return () => timers.forEach(window.clearTimeout); }, [executing, tenantId, rlsEnabled]);
  const visible = demoData.orders.filter((order) => !rlsEnabled || order.tenantId === tenantId);
  const focusPolicy = revealRls && executionStage === 'policy';
  const focusRows = revealRows && (executionStage === 'execute' || executionStage === 'result');
  return <div className={`glass rounded-2xl p-5 transition-all duration-[360ms] ${focusPolicy ? 'ring-1 ring-emerald-300/40 shadow-[0_0_40px_rgba(52,211,153,.12)]' : focusRows ? 'ring-1 ring-cyan-300/30 shadow-[0_0_40px_rgba(34,211,238,.10)]' : ''}`}><div className="mb-4 flex items-center gap-2"><ShieldCheck size={15} className="text-emerald-300"/><div><div className="text-sm font-semibold">Row-level decision</div><div className="text-[11px] text-[var(--muted)]">{focusPolicy ? focusVisuals.rls.label : focusRows ? focusVisuals.rows.label : 'Watch candidate rows pass through the policy.'}</div></div></div><div className="space-y-2">{demoData.orders.map((row) => { const allowed = visible.some((item) => item.id === row.id); const active = !executing || revealed.includes(row.id); return <div key={row.id} className={`grid grid-cols-[1fr_1fr_.7fr_1fr_auto] items-center gap-2 rounded-xl border p-3 font-mono text-[10px] transition-all duration-300 ${active && allowed ? 'border-emerald-400/25 bg-emerald-400/[.04]' : active && !allowed ? 'border-red-400/10 bg-red-400/[.02] opacity-45' : 'border-[var(--line)] opacity-30'} ${focusRows && active ? 'translate-x-1' : ''}`}><span>{row.id}</span><span>{row.tenantId}</span><span>{row.amount}</span><span>{row.status}</span><span>{allowed ? <Eye size={13} className="text-emerald-300"/> : <EyeOff size={13} className="text-red-300"/>}</span></div>})}</div><div className="mt-3 text-[10px] text-slate-500">{rlsEnabled ? rowVisualization.labels.visible : 'RLS disabled · all candidate rows are visible'}</div></div>;
}
