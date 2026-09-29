'use client';

import { presenterReveal } from '@/config/presenter-reveal';
import { usePresenterStore } from '@/lib/presenter-store';
import { ExecutionStageBar } from './ExecutionStageBar';
import { RowFilterVisualizer } from './RowFilterVisualizer';
import { PermissionMatrix } from './PermissionMatrix';
import { RowCompare } from './RowCompare';
import { DatabaseGraph } from './DatabaseGraph';
import { TriggerSimulator } from './TriggerSimulator';

function Reveal({ id, children }: { id: 'sql' | 'role' | 'rls' | 'rows' | 'result'; children: React.ReactNode }) {
  const revealed = usePresenterStore((state) => state.isRevealed(id));
  return <div className="transition-all duration-300" style={{ opacity: revealed ? 1 : 0.18, filter: revealed ? 'none' : 'blur(5px)', pointerEvents: revealed ? 'auto' : 'none' }}>{children}</div>;
}

export function InteractiveDatabasePanel() {
  return <div className="space-y-4" aria-label="Interactive PostgreSQL teaching canvas"><Reveal id="result"><ExecutionStageBar/></Reveal><div className="grid gap-4 xl:grid-cols-2"><Reveal id="rows"><RowFilterVisualizer/></Reveal><Reveal id="role"><PermissionMatrix/></Reveal></div><div className="grid gap-4 xl:grid-cols-2"><Reveal id="result"><RowCompare/></Reveal><Reveal id="rls"><TriggerSimulator/></Reveal></div><Reveal id="result"><DatabaseGraph/></Reveal><div className="text-center text-[9px] uppercase tracking-[.18em] text-slate-600">{presenterReveal.transitionMs}ms reveal transitions · Guided presenter mode</div></div>;
}
