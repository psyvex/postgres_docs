export type DbMode = 'local' | 'live';

export type StatementResult = {
  columns: string[];
  rows: Record<string, unknown>[];
  /** Rows returned (SELECT) or affected (INSERT/UPDATE/DELETE) when known. */
  rowCount: number | null;
};

export type RunSuccess = { ok: true; results: StatementResult[]; durationMs: number };
export type RunFailure = { ok: false; error: string; detail?: string; hint?: string; code?: string; durationMs: number };
export type RunResult = RunSuccess | RunFailure;

export type LiveConnection = {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  ssl: boolean;
};

export interface DbAdapter {
  mode: DbMode;
  /** Runs one or more SQL statements in a fresh session context (role and settings are reset afterwards). */
  run(sql: string): Promise<RunResult>;
}

/**
 * Header carrying this deployment's `DB_QUERY_TOKEN`. Lives here, not in `guard.ts`, because the
 * browser-side adapter needs the name and `guard.ts` is server-only (`node:crypto`).
 */
export const TOKEN_HEADER = 'x-db-token';

/** Every run starts here so examples can reference demo tables without the `lab.` prefix. */
export const SESSION_PREFIX = 'SET search_path = lab, public;';
export const SESSION_RESET = 'RESET ROLE; RESET ALL;';

export function toFailure(error: unknown, durationMs: number): RunFailure {
  const e = error as { message?: string; detail?: string; hint?: string; code?: string };
  return { ok: false, error: e?.message ?? String(error), detail: e?.detail, hint: e?.hint, code: e?.code, durationMs };
}
