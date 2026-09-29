'use client';

import { focusJourney } from '@/config/focus-journey';
import { usePresenterStore } from '@/lib/presenter-store';
import { ExecutionStageBar } from './ExecutionStageBar';
import { RowFilterVisualizer } from './RowFilterVisualizer';
import { PermissionMatrix } from './PermissionMatrix';
import { RowCompare } from './RowCompare';
import { DatabaseGraph } from './DatabaseGraph';
import { TriggerSimulator } from './TriggerSimulator';
import { JourneyRail } from './JourneyRail';

function Reveal({ id, children }: { id: 'sql' | 'role' | 'rls' | 'rows' | 'function' | 'trigger' | 'result'; children: React.ReactNode }) {
  const revealed = usePresenterStore((state) => state.isRevealed(id));
  const focused = usePresenterStore((state) => state.isFocused(id));
  return <div className="transition-all duration-500" style={{ opacity: revealed ? 1 : 0.16, filter: revealed ? 'none' : 'blur(5px)', pointerEvents: revealed ? 'auto' : 'none', transform: focused ? 'translateY(-2px) scale(1.008)' : 'none' }} aria-hidden={!revealed}>{children}</div>;
}

export function InteractiveDatabasePanel() {
  return <div className="space-y-4" aria-label="Interactive PostgreSQL teaching canvas"><JourneyRail/><Reveal id="result"><ExecutionStageBar/></Reveal><div className="grid gap-4 xl:grid-cols-2"><Reveal id="rows"><RowFilterVisualizer/></Reveal><Reveal id="role"><PermissionMatrix/></Reveal></div><div className="grid gap-4 xl:grid-cols-2"><Reveal id="function"><RowCompare/></Reveal><Reveal id="trigger"><TriggerSimulator/></Reveal></div><Reveal id="result"><DatabaseGraph/></Reveal><div className="text-center text-[9px] uppercase tracking-[.18em] text-slate-600">{focusJourney.length} guided steps · functions + triggers included</div></div>;
}
