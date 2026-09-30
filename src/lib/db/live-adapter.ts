import { TOKEN_HEADER, type DbAdapter, type LiveConnection, type RunResult } from './types';

/**
 * Sends SQL to /api/db/query, which opens a short-lived `pg` session against the user's database.
 *
 * `serverToken` is this deployment's `DB_QUERY_TOKEN`, required whenever the server has
 * `ALLOW_REMOTE_DB=true`; sent as a header so it never sits in the JSON body next to the SQL.
 */
export function createLiveAdapter(connection: LiveConnection, serverToken?: string): DbAdapter {
  return {
    mode: 'live',
    async run(sql: string): Promise<RunResult> {
      const startedAt = performance.now();
      try {
        const response = await fetch('/api/db/query', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(serverToken ? { [TOKEN_HEADER]: serverToken } : {}),
          },
          body: JSON.stringify({ connection, sql }),
        });
        return (await response.json()) as RunResult;
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : 'Network error', durationMs: Math.round(performance.now() - startedAt) };
      }
    },
  };
}
