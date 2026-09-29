'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createLiveAdapter } from './live-adapter';
import { localAdapter } from './local-adapter';
import type { DbAdapter, DbMode, LiveConnection, RunResult } from './types';

type DbState = {
  mode: DbMode;
  connection: LiveConnection;
  /** Bumped after every run so schema explorers and table views refetch. */
  revision: number;
  setMode: (mode: DbMode) => void;
  setConnection: (patch: Partial<LiveConnection>) => void;
  bump: () => void;
};

export const defaultConnection: LiveConnection = {
  host: 'localhost',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: '',
  ssl: false,
};

export const useDbStore = create<DbState>()(
  persist(
    (set) => ({
      mode: 'local',
      connection: defaultConnection,
      revision: 0,
      setMode: (mode) => set((s) => ({ mode, revision: s.revision + 1 })),
      setConnection: (patch) => set((s) => ({ connection: { ...s.connection, ...patch } })),
      bump: () => set((s) => ({ revision: s.revision + 1 })),
    }),
    {
      name: 'postgres-lab:db',
      // The password stays in memory only — never written to localStorage.
      partialize: (s) => ({ mode: s.mode, connection: { ...s.connection, password: '' } }),
    },
  ),
);

export function getAdapter(): DbAdapter {
  const { mode, connection } = useDbStore.getState();
  return mode === 'live' ? createLiveAdapter(connection) : localAdapter;
}

/** Run SQL on the active database and notify listeners when it may have changed data or schema. */
export async function runSql(sql: string, options: { silent?: boolean } = {}): Promise<RunResult> {
  const result = await getAdapter().run(sql);
  if (!options.silent) useDbStore.getState().bump();
  return result;
}
