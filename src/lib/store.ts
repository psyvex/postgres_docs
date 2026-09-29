import { create } from 'zustand';
import { defaultSql, demoData, type LabId } from './lab-config';
import { executeLabQuery, seedLabState, type QueryResult } from './lab-engine';

type Store = ReturnType<typeof seedLabState> & {
  activeLab: LabId;
  sqlByLab: Record<LabId, string>;
  result: QueryResult | null;
  executing: boolean;
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
  ...initial,
  activeLab: 'rls',
  sqlByLab: initialSql,
  result: null,
  executing: false,
  setLab: (activeLab) => set({ activeLab, result: null }),
  setTenant: (activeTenantId) => set({ activeTenantId, result: null }),
  setSql: (sql) => set((state) => ({ sqlByLab: { ...state.sqlByLab, [state.activeLab]: sql } })),
  toggleRls: () => set((state) => ({ rlsEnabled: !state.rlsEnabled, result: null })),
  execute: () => {
    const state = get();
    set({ executing: true });
    window.setTimeout(() => {
      const current = get();
      const result = executeLabQuery(current.activeLab, current.sqlByLab[current.activeLab], current);
      set({ result, executing: false });
    }, 350);
  },
  reset: () => set({ ...seedLabState(), activeLab: 'rls', sqlByLab: initialSql, result: null, executing: false }),
}));

export const tenants = demoData.tenants;
