import { create } from 'zustand';
import { defaultSql, demoData, type LabId } from './lab-config';
import { executeLabQuery, seedLabState, type QueryResult } from './lab-engine';
import { executionMachine, type ExecutionStage } from '@/config/execution-machine';

type Store = ReturnType<typeof seedLabState> & {
  activeLab: LabId;
  sqlByLab: Record<LabId, string>;
  result: QueryResult | null;
  executing: boolean;
  executionStage: ExecutionStage;
  setLab: (lab: LabId) => void;
  setTenant: (tenantId: string) => void;
  setSql: (sql: string) => void;
  toggleRls: () => void;
  execute: () => void;
  reset: () => void;
};

const initial = seedLabState();
const initialSql = Object.fromEntries(['rls', 'roles', 'functions', 'triggers'].map((lab) => [lab, defaultSql])) as Record<LabId, string>;

export const useLabStore = create<Store>((set, get) => ({
  ...initial, activeLab: 'rls', sqlByLab: initialSql, result: null, executing: false, executionStage: 'idle',
  setLab: (activeLab) => set({ activeLab, result: null, executionStage: 'idle' }),
  setTenant: (activeTenantId) => set({ activeTenantId, result: null, executionStage: 'idle' }),
  setSql: (sql) => set((state) => ({ sqlByLab: { ...state.sqlByLab, [state.activeLab]: sql } })),
  toggleRls: () => set((state) => ({ rlsEnabled: !state.rlsEnabled, result: null, executionStage: 'idle' })),
  execute: () => {
    const state = get();
    set({ executing: true, result: null, executionStage: 'parse' });
    let elapsed = 0;
    executionMachine.order.forEach((stage, index) => {
      if (index === executionMachine.order.length - 1) return;
      elapsed += executionMachine.durations[stage];
      window.setTimeout(() => set({ executionStage: executionMachine.order[index + 1] }), elapsed);
    });
    window.setTimeout(() => {
      const current = get();
      const result = executeLabQuery(current.activeLab, current.sqlByLab[current.activeLab], current);
      set({ result, executing: false, executionStage: 'result' });
    }, elapsed + executionMachine.durations.result);
  },
  reset: () => set({ ...seedLabState(), activeLab: 'rls', sqlByLab: initialSql, result: null, executing: false, executionStage: 'idle' }),
}));

export const tenants = demoData.tenants;
