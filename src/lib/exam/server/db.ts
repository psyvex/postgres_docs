import 'server-only';
import { PGlite } from '@electric-sql/pglite';
import { SEED_CHECK_SQL, SEED_SQL } from '@/lib/db/seed';
import { SESSION_PREFIX, SESSION_RESET, toFailure, type RunResult, type StatementResult } from '@/lib/db/types';
import type { Persona } from '@/lib/exam/types';

/**
 * Server-side Postgres for exam grading: the same engine as the lessons (PGlite, PostgreSQL 18),
 * created without a data directory so it lives in memory and dies with the process.
 *
 * Design decisions worth the tokens:
 *
 * 1. **A pool of instances, each with its own lock.** A PGlite instance is a single session, so two
 *    concurrent submissions sharing one would interleave their transactions and grade against each
 *    other's state. Serialising per instance and running a few instances in parallel keeps isolation
 *    exact without making every submission wait behind an unrelated one.
 *
 * 2. **Isolation from the transaction, not from a fresh database.** DDL in Postgres is transactional,
 *    so `BEGIN … ROLLBACK` undoes policies, grants, triggers and row writes alike. A submission costs
 *    milliseconds instead of a ~1s reseed, and participant 2 still sees exactly the state the
 *    question describes.
 *
 * 3. **Setup and answer are separate `exec` calls.** `gradeChecks` grades the *last* table in a run.
 *    If setup and answer shared one exec, a question whose answer returns no table would be graded
 *    against setup's last table — an unearned pass. Running them apart means the graded `RunResult`
 *    contains only the participant's own statement.
 *
 * The shape of `run()` matches `localAdapter.run()` in `src/lib/db/local-adapter.ts`, including the
 * `slice(1)` and the affected-row delta, so the lesson grader applies identical rules to both sides.
 */

const POOL_SIZE = 2;

/** Statements that put the session in the persona's identity for the current transaction only. */
function personaPrefix(persona: Persona): string[] {
  return [
    `${SESSION_PREFIX.replace(/;$/, '')}`,
    persona.memberId != null && `SET LOCAL app.member_id = '${persona.memberId}'`,
    persona.orgId != null && `SET LOCAL app.org_id = '${persona.orgId}'`,
    persona.role && `SET LOCAL ROLE ${persona.role}`,
  ].filter((s): s is string => Boolean(s));
}

/**
 * PGlite reports `affectedRows` cumulatively across a multi-statement exec, and a statement that
 * returns no table reports its count there. Without the delta an `affected: n` check grades 0 here
 * while passing in the browser — the same correction `local-adapter.ts` and the CI verifier make.
 */
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

type Session = { db: Promise<PGlite>; chain: Promise<unknown>; pending: number };

let pool: Session[] | null = null;

function createSession(): Session {
  const db = (async () => {
    const instance = await PGlite.create();
    const check = await instance.query<{ seeded: boolean }>(SEED_CHECK_SQL);
    if (!check.rows[0]?.seeded) await instance.exec(SEED_SQL);
    await instance.exec(SESSION_RESET);
    return instance;
  })();
  return { db, chain: Promise.resolve(), pending: 0 };
}

/**
 * The pool lives on `globalThis` because a dev server hot-reload would otherwise hand out fresh
 * instances on every edit while the old ones still hold WASM memory.
 */
function getPool(): Session[] {
  const store = globalThis as typeof globalThis & { __examPool?: Session[] };
  pool = store.__examPool ?? (store.__examPool = Array.from({ length: POOL_SIZE }, createSession));
  return pool;
}

/** Picks the session with the shortest queue, so a burst spreads instead of stacking on one. */
function pickSession(): Session {
  const sessions = getPool();
  if (sessions.length === 1) return sessions[0];
  return sessions.reduce((best, s) => (s.pending < best.pending ? s : best), sessions[0]);
}

/**
 * Appends `job` to this session's queue. The chain swallows a rejection from the previous link
 * because a grading failure must not poison every later submission on the same instance — each job
 * already converts its own SQL errors into a `RunResult`, so nothing legitimate reaches the chain
 * as a rejection anyway.
 */
function enqueue<T>(session: Session, job: () => Promise<T>): Promise<T> {
  session.pending += 1;
  const run = session.chain.then(job, job);
  session.chain = run.then(noop, noop);
  session.chain.finally(() => {
    session.pending -= 1;
  });
  return run;
}

function noop() {}

export type GradeOutcome = { result: RunResult; durationMs: number };

/**
 * Runs `sql` as `persona` on a session where `setupSql` has already run, inside a transaction that is
 * always rolled back. Never throws: a raising answer arrives as `RunResult` `ok: false`, which is how
 * `gradeChecks` grades an `error:` check exactly as the lesson card does.
 */
export async function gradeAgainstScenario(setupSql: string, sql: string, persona: Persona): Promise<GradeOutcome> {
  const session = pickSession();
  return enqueue(session, async () => {
    const db = await session.db;
    const startedAt = performance.now();
    const elapsed = () => Math.round(performance.now() - startedAt);
    const prefix = personaPrefix(persona).join(';\n');

    try {
      // Order matters. Setup runs as the owner *before* the role switch, because scenario setup is
      // DDL — ENABLE ROW LEVEL SECURITY, CREATE POLICY, CREATE TRIGGER, GRANT — and a participant
      // answering as `app_member` cannot alter a table they do not own. Switching first would make
      // every RLS and trigger question fail with permission denied before the participant typed
      // anything. The switch happens after setup so the participant's own statement is the one that
      // runs restricted.
      await db.exec(['BEGIN', SESSION_PREFIX, setupSql || 'SELECT 1'].filter(Boolean).join(';\n'));
      await db.exec(prefix);

      const results = await db.exec(sql);
      return { result: { ok: true, results: toStatements(results), durationMs: elapsed() }, durationMs: elapsed() };
    } catch (error) {
      return { result: toFailure(error, elapsed()), durationMs: elapsed() };
    } finally {
      // A failed statement leaves the transaction aborted, and every later statement — RESET
      // included — then answers 25P02 ("current transaction is aborted"). ROLLBACK first, always.
      await db.exec('ROLLBACK; RESET ROLE; RESET ALL;').catch(() => undefined);
    }
  });
}

/**
 * Statement-count guard for submissions. Splitting on `;` is crude but sufficient for the one thing
 * it is used for: refusing a participant who pastes a whole script instead of answering the question.
 */
export function countStatements(sql: string): number {
  return sql
    .split(';')
    .map((s) => s.replace(/--.*$/gm, '').trim())
    .filter(Boolean).length;
}
