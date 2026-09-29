'use client';

import type { PGlite } from '@electric-sql/pglite';
import { SEED_CHECK_SQL, SEED_SQL } from './seed';
import { SESSION_PREFIX, SESSION_RESET, toFailure, type DbAdapter, type RunResult, type StatementResult } from './types';

/** Browser-only Postgres (PGlite, PostgreSQL 18 compiled to WASM), persisted in IndexedDB. */
const DATA_DIR = 'idb://postgres-lab';

let instance: Promise<PGlite> | null = null;

function getDb() {
  instance ??= (async () => {
    const { PGlite } = await import('@electric-sql/pglite');
    const db = await PGlite.create(DATA_DIR);
    const check = await db.query<{ seeded: boolean }>(SEED_CHECK_SQL);
    if (!check.rows[0]?.seeded) await db.exec(SEED_SQL);
    await db.exec(SESSION_RESET);
    return db;
  })();
  return instance;
}

// PGlite reports affectedRows cumulatively across a multi-statement exec, so derive per-statement counts.
function toStatements(results: Awaited<ReturnType<PGlite['exec']>>): StatementResult[] {
  let previousAffected = 0;
  return results.map((r) => {
    const affected = (r.affectedRows ?? 0) - previousAffected;
    previousAffected = r.affectedRows ?? previousAffected;
    return {
      columns: r.fields.map((f) => f.name),
      rows: r.rows as Record<string, unknown>[],
      rowCount: r.fields.length ? r.rows.length : affected,
    };
  });
}

export const localAdapter: DbAdapter = {
  mode: 'local',
  async run(sql: string): Promise<RunResult> {
    const startedAt = performance.now();
    const db = await getDb();
    try {
      const results = await db.exec(`${SESSION_PREFIX}\n${sql}`);
      return { ok: true, results: toStatements(results).slice(1), durationMs: Math.round(performance.now() - startedAt) };
    } catch (error) {
      // A failed statement inside an explicit BEGIN leaves the session aborted; roll it back.
      await db.exec('ROLLBACK').catch(() => undefined);
      return toFailure(error, Math.round(performance.now() - startedAt));
    } finally {
      await db.exec(SESSION_RESET).catch(() => undefined);
    }
  },
};

/** Boots PGlite (and seeds on first run) ahead of time, e.g. behind the splash screen. */
export async function warmLocalDatabase() {
  await getDb();
}

export async function resetLocalDatabase() {
  const db = await getDb();
  await db.exec(SEED_SQL);
  await db.exec(SESSION_RESET);
}
