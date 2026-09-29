import { create } from 'zustand';
import { defaultSql, demoData, type LabId } from './lab-config';
import { executeTeachingQuery, seedLabState, type QueryResult, type QueryTrace } from './lab-engine';
import { executionMachine, type ExecutionStage } from '@/config/execution-machine';

type Store = ReturnType<typeof seedLabState> & { activeLab: LabId; sqlByLab: Record<LabId, string>; result: QueryResult | null; trace: QueryTrace | null; executing: boolean; executionStage: ExecutionStage; setLab: (lab: LabId) => void; setTenant: (tenantId: string) => void; setSql: (sql: string) => void; toggleRls: () => void; execute: () => void; reset: () => void; };
const initial = seedLabState();
const initialSql = Object.fromEntries(['rls', 'roles', 'functions', 'triggers'].map((lab) => [lab, defaultSql])) as Record<LabId, string>;

export const useLabStore = create<Store>((set, get) => ({
  ...initial, activeLab: 'rls', sqlByLab: initialSql, result: null, trace: null, executing: false, executionStage: 'idle',
  setLab: (activeLab) => set({ activeLab, result: null, trace: null, executionStage: 'idle' }),
  setTenant: (activeTenantId) => set({ activeTenantId, result: null, trace: null, executionStage: 'idle' }),
  setSql: (sql) => set((state) => ({ sqlByLab: { ...state.sqlByLab, [state.activeLab]: sql } })),
  toggleRls: () => set((state) => ({ rlsEnabled: !state.rlsEnabled, result: null, trace: null, executionStage: 'idle' })),
  execute: () => {
    const state = get();
    const preview = executeTeachingQuery(state.activeLab, state.sqlByLab[state.activeLab], state);
    set({ executing: true, result: null, trace: preview.trace, executionStage: 'parse' });
    const stages = executionMachine.order.filter((stage) => preview.trace.stages.includes(stage));
    let elapsed = 0;
    stages.slice(1).forEach((stage) => {
      const previous = stages[stages.indexOf(stage) - 1];
      elapsed += executionMachine.durations[previous];
      window.setTimeout(() => set({ executionStage: stage }), elapsed);
    });
    window.setTimeout(() => set({ result: preview.result, executing: false, executionStage: 'result' }), elapsed + executionMachine.durations.result);
  },
  reset: () => set({ ...seedLabState(), activeLab: 'rls', sqlByLab: initialSql, result: null, trace: null, executing: false, executionStage: 'idle' }),
}));
export const tenants = demoData.tenants;
