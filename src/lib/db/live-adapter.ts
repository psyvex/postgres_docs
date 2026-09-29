import type { DbAdapter, LiveConnection, RunResult } from './types';

/** Sends SQL to /api/db/query, which opens a short-lived `pg` session against the user's database. */
export function createLiveAdapter(connection: LiveConnection): DbAdapter {
  return {
    mode: 'live',
    async run(sql: string): Promise<RunResult> {
      const startedAt = performance.now();
      try {
        const response = await fetch('/api/db/query', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ connection, sql }),
        });
        return (await response.json()) as RunResult;
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Network error', durationMs: Math.round(performance.now() - startedAt) };
      }
    },
  };
}
