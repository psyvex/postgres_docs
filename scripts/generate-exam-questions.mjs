/**
 * Exam question bank generator — execution-driven oracle derivation.
 *
 * What makes a question ship:
 *   1. PERSONAS is parsed out of src/lib/exam/personas.ts. No hand mirror to drift out of sync — a
 *      persona that disappears there stops this script instead of quietly grading as the owner.
 *   2. Ground truth (row counts, the `66000.00` wire text, seed titles) is measured from the same
 *      seed the app ships, through `SET search_path = lab, public`, before any candidate runs.
 *   3. Every candidate states its own expected result — `{ firstCell: '4' }`, `{ error: 'must be
 *      owner' }` — written from that measurement, and carries the real SQL a participant would type.
 *      The expected value is a *prediction*, not a copy of the answer's output.
 *   4. Three gates, each a run against a real PGlite using the production transaction shape
 *      (BEGIN → setup as owner → persona switch → answer → ROLLBACK):
 *        grades       the reference answer must PASS `gradeChecks` — the same function the browser
 *                     calls. A prediction that disagrees with the database kills the item, so a
 *                     mis-set-up persona or a misread policy shows up as a dropped question and a
 *                     line in the drop log, never as a wrong answer on screen.
 *        notVacuous   `SELECT 42` must FAIL. An oracle it satisfies passes for every participant.
 *        repeatable   two independent runs must agree. Every item is rolled back, so what can still
 *                     break this is state that outlives a rollback: sequences, clocks, random,
 *                     backend pids, and (measured) prepared statements.
 *   5. Candidates that run identical statements under identical identity are deduped.
 *
 * Two question kinds are deliberately not generated here:
 *   - EXPLAIN / plan shape: `firstCell` compares exact text, and a cost string moves with planner
 *     statistics. Grading one needs a `firstCellContains`-style key in check.mjs first.
 *   - prepared statements: see the note in securityQuestions().
 *
 * Run: node scripts/generate-exam-questions.mjs
 * Output: src/content/generated-bank.ts + generated-bank-summary.txt
 */

import { PGlite } from '@electric-sql/pglite';
import { gradeChecks, describeChecks } from '../src/lib/learn/check.mjs';
import { readFileSync } from 'node:fs';

// ── PERSONAS: parsed from source (single source of truth) ─────────────────────

const PERSONAS_SRC = readFileSync('src/lib/exam/personas.ts', 'utf8');
const PERSONA_BLOCK = PERSONAS_SRC.match(/export const PERSONAS.*?=\s*\{([\s\S]*?)\n\};/)?.[1];
if (!PERSONA_BLOCK) throw new Error('cannot find PERSONAS block in personas.ts');

/**
 * Each persona is one `key: { field: value, … }` entry. Parsed over the whole block rather than
 * line by line, because a real entry can wrap. Fields are read by name so an added field is picked
 * up and a renamed one shows up as a missing required field below, not as a silent wrong identity.
 */
const PERSONAS = {};
for (const [, key, body] of PERSONA_BLOCK.matchAll(/(\w+):\s*\{([^}]*)\}/g)) {
  const field = (name) => {
    const str = body.match(new RegExp(`${name}:\\s*'([^']*)'`))?.[1];
    if (str !== undefined) return str;
    const num = body.match(new RegExp(`${name}:\\s*(\\d+)`))?.[1];
    return num !== undefined ? Number(num) : undefined;
  };
  PERSONAS[key] = Object.fromEntries(
    Object.entries({ name: field('name'), role: field('role'), memberId: field('memberId'), orgId: field('orgId') })
      .filter(([, v]) => v !== undefined),
  );
  if (!PERSONAS[key].name) throw new Error(`persona '${key}' has no name in personas.ts`);
}
for (const required of ['owner', 'alice', 'bob', 'carol', 'anon']) {
  if (!PERSONAS[required]) throw new Error(`persona '${required}' is gone from personas.ts — the bank cannot be graded without it`);
}

// ── Database bootstrap ────────────────────────────────────────────────────────

const SEED_SQL = readFileSync('src/lib/db/seed.ts', 'utf8').match(/SEED_SQL = `([\s\S]*?)`;/)[1];
const SESSION_PREFIX = 'SET search_path = lab, public;';
const SESSION_RESET = 'RESET ROLE; RESET ALL;';

const db = await PGlite.create();
await db.exec(SEED_SQL);
await db.exec(SESSION_RESET);

function toStatements(results) {
  let prev = 0;
  return results.map((r) => {
    const affected = (r.affectedRows ?? 0) - prev;
    prev = r.affectedRows ?? prev;
    return {
      columns: r.fields.map((f) => f.name),
      rows: r.rows,
      rowCount: r.fields.length ? r.rows.length : affected,
    };
  });
}

/**
 * Mirrors the production grader's transaction shape exactly:
 *   BEGIN → SESSION_PREFIX → (setup || SELECT 1) → persona prefix → answer SQL → grade
 *   ROLLBACK → RESET
 *
 * The persona prefix runs after setup so DDL in setup is executed as owner before the
 * role switch (app_member cannot ALTER a table it does not own).
 */
async function run({ setupSql = '', sql, personaName }) {
  const persona = PERSONAS[personaName];
  const prefix = [
    SESSION_PREFIX,
    persona.memberId != null && `SET LOCAL app.member_id = '${persona.memberId}'`,
    persona.orgId != null && `SET LOCAL app.org_id = '${persona.orgId}'`,
    persona.role && `SET LOCAL ROLE ${persona.role}`,
  ].filter(Boolean).join(';\n');

  try {
    await db.exec(['BEGIN', SESSION_PREFIX, setupSql || 'SELECT 1'].join(';\n'));
    await db.exec(prefix);
    const results = await db.exec(sql);
    return { ok: true, results: toStatements(results), durationMs: 1 };
  } catch (error) {
    return { ok: false, error: String(error?.message ?? error), results: [] };
  } finally {
    await db.exec('ROLLBACK; RESET ROLE; RESET ALL;').catch(() => undefined);
  }
}

// ── Ground truth: measured once, read-only ────────────────────────────────────

/**
 * All ground truth is measured as the owner through the same transaction path.
 * These are the single source of truth for any candidate `expect` value.
 * No candidate modifies this state; every candidate runs in its own ROLLBACK.
 */
const GT = {
  totalTasks:    await readScalar('SELECT count(*) FROM tasks'),
  todoTasks:     await readScalar("SELECT count(*) FROM tasks WHERE status = 'todo'"),
  doingTasks:    await readScalar("SELECT count(*) FROM tasks WHERE status = 'doing'"),
  doneTasks:     await readScalar("SELECT count(*) FROM tasks WHERE status = 'done'"),
  totalOrgs:     await readScalar('SELECT count(*) FROM organizations'),
  totalMembers:  await readScalar('SELECT count(*) FROM members'),
  totalProjects: await readScalar('SELECT count(*) FROM projects'),
  // Compared as text by the grader, so the wire form (`66000.00`, numeric keeps its scale) is the answer.
  totalBudget:   await readScalarText('SELECT sum(budget) FROM projects'),
  bobSees:       await readScalar('SELECT count(*) FROM tasks WHERE org_id = 1'),
  carolSees:     await readScalar('SELECT count(*) FROM tasks WHERE org_id = 2'),
  bobTodo:       await readScalar("SELECT count(*) FROM tasks WHERE org_id = 1 AND status = 'todo'"),
  carolTodo:     await readScalar("SELECT count(*) FROM tasks WHERE org_id = 2 AND status = 'todo'"),
  bobAssignee:   await readScalar('SELECT count(*) FROM tasks WHERE assignee_id = 2'),
  assignedTasks: await readScalar('SELECT count(*) FROM tasks WHERE assignee_id IS NOT NULL'),
  firstTaskTitle: await readScalarText('SELECT title FROM tasks ORDER BY id'),
  avgBudget:     await readScalar('SELECT round(avg(budget)) FROM projects'),
  auditBaseline: await readScalar('SELECT count(*) FROM audit_log'),
  tasksTitles:   await readRows('SELECT title, status FROM tasks ORDER BY id'),
  orgNames:      await readRows('SELECT name, plan FROM organizations ORDER BY id'),
  projectBudgets: await readRows('SELECT name, budget FROM projects ORDER BY id'),
};

/** Single scalar integer from a read-only query. */
async function readScalar(sql) {
  const r = await db.exec(`${SESSION_PREFIX} ${sql}`);
  const t = r.find((x) => x.fields.length > 0);
  return Number(Object.values(t.rows[0])[0]);
}

/** First cell of a read-only query as text — the wire text the grader compares `firstCell` against. */
async function readScalarText(sql) {
  const r = await db.exec(`${SESSION_PREFIX} ${sql}`);
  const t = r.find((x) => x.fields.length > 0);
  return String(Object.values(t.rows[0])[0]);
}

/** All rows from a read-only query as plain objects. */
async function readRows(sql) {
  const r = await db.exec(`${SESSION_PREFIX} ${sql}`);
  const t = r.find((x) => x.fields.length > 0);
  if (!t) return [];
  return t.rows.map((row) => Object.values(row));
}

// ── Stimulus constructors ──────────────────────────────────────────────────────

function tableS(caption, columns, rows) {
  return { kind: 'table', caption, columns, rows: rows.map((r) => r.map(String)) };
}
function sqlS(caption, lines) {
  return { kind: 'sql', caption, lines };
}
function heapS(caption, rows) {
  return { kind: 'heap', caption, rows };
}

// ── Gates ──────────────────────────────────────────────────────────────────────
//
// Gate 1 (grades) runs in the main loop because it has to report what it saw. These two are the
// negative controls: an oracle that any answer satisfies, and an oracle that was only true on the
// one execution that produced it, are both worse than no question at all — a participant who is
// right gets told they are wrong.

/** What a run produced, in a form two runs of the same question must agree on. */
function fingerprint(result) {
  return result.ok ? JSON.stringify(result.results.at(-1)?.rows ?? null) : `ERROR:${result.error}`;
}

/** The superuser's own name on this machine — the thing a generated answer must never depend on. */
const HOST_ROLE = await readScalarText('SELECT current_user');

/** Denials Postgres actually produces. Anything else is an author's guess about a message. */
const REAL_DENIALS = /permission denied|must be owner|row-level security|violates|there is no parameter|already exists|duplicate key/i;

/**
 * Author-side expectation → the Check the grader speaks.
 *
 * `scalar` is a query the OWNER runs, plainly, before the persona's transaction — so the number a
 * participant must reach arrives by a second route rather than being copied out of the answer's own
 * output. `errorIncludes` becomes the grader's `error`, which is a case-insensitive substring.
 */
async function resolveExpect(c) {
  const e = c.expect;
  if ('scalar' in e) {
    const value = await readScalarText(e.scalar);
    if (value === HOST_ROLE) {
      throw new Error(`expected value is the host role name — true on this machine, wrong in the exam room`);
    }
    return { firstCell: value };
  }
  if ('errorIncludes' in e) {
    if (!REAL_DENIALS.test(e.errorIncludes)) {
      throw new Error(`error expectation "${e.errorIncludes}" is not a denial Postgres really produces`);
    }
    return { error: e.errorIncludes };
  }
  return e;
}

/** `SELECT 42` must fail. An oracle it satisfies passes for everyone and teaches nothing. */
async function notVacuous(c) {
  const result = await run({ setupSql: c.setupSql, sql: 'SELECT 42', personaName: c.persona });
  return !gradeChecks(result, [c.check], 0).passed;
}

/**
 * Two independent executions must agree.
 *
 * Every item runs inside its own BEGIN … ROLLBACK, so writes made by the answer itself are rolled
 * back and re-measured identically — what escapes the rollback is cluster state that never
 * never rolls back: sequence counters (`nextval`), clocks, random, backend pids. Comparing two runs
 * catches those empirically instead of relying on a denylist of function names staying complete.
 */
async function repeatable(c) {
  const r1 = await run({ setupSql: c.setupSql, sql: c.answerSql, personaName: c.persona });
  const r2 = await run({ setupSql: c.setupSql, sql: c.answerSql, personaName: c.persona });
  return fingerprint(r1) === fingerprint(r2);
}

// ── Candidate families ────────────────────────────────────────────────────────
//
// Each factory returns an array of candidates.  Every candidate has:
//   id          — prefixed 'g-' to avoid colliding with hand-authored items
//   topicSlug
//   difficulty  — 'easy' | 'medium' | 'hard'
//   points
//   prompt      — visual-only question
//   stimulus    — the picture (kind: 'table' | 'sql' | 'heap')
//   setupSql    — DDL to run as owner before the persona switch
//   answerSql   — real SQL that produces the answer
//   persona     — which identity to run as
//   expect      — the grading check authored from ground truth, not derived from the answer
//
// All numbers in answerSql and expect are concrete values from GT (measured at generation time).

function rlsQuestions() {
  return [
    {
      id: 'g-rls-1', topicSlug: 'row-level-security', difficulty: 'easy', points: 10,
      prompt: 'Policy is active. Bob (org_id=1) runs this query. How many rows does he see?',
      stimulus: sqlS('Bob runs:', ['SELECT id, title, status FROM tasks ORDER BY id']),
      setupSql: [
        "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY",
        "CREATE POLICY tasks_member_select ON tasks FOR SELECT USING (org_id = current_setting('app.org_id', true)::int)",
        "CREATE POLICY tasks_member_insert ON tasks FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true)::int)",
      ].join('; '),
      answerSql: 'SELECT count(*) FROM tasks',
      persona: 'bob',
      expect: { firstCell: String(GT.bobSees) },
    },
    {
      id: 'g-rls-2', topicSlug: 'row-level-security', difficulty: 'medium', points: 10,
      prompt: 'Carol (org_id=2) tries to insert a task into Acme Rockets (org_id=1). What happens?',
      stimulus: sqlS('Carol tries:', ["INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'Spy mission') RETURNING id, title, org_id"]),
      setupSql: [
        "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY",
        "CREATE POLICY tasks_member_insert ON tasks FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true)::int)",
      ].join('; '),
      answerSql: "INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'Spy mission')",
      persona: 'carol',
      expect: { error: 'row-level security' },
    },
    {
      id: 'g-rls-3', topicSlug: 'row-level-security', difficulty: 'easy', points: 10,
      prompt: 'Carol (org_id=2) reads the tasks table. How many rows does she see?',
      stimulus: sqlS('Carol runs:', ['SELECT count(*) FROM tasks']),
      setupSql: "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; CREATE POLICY tasks_member_select ON tasks FOR SELECT USING (org_id = current_setting('app.org_id', true)::int)",
      answerSql: 'SELECT count(*) FROM tasks',
      persona: 'carol',
      expect: { firstCell: String(GT.carolSees) },
    },
    {
      id: 'g-rls-4', topicSlug: 'row-level-security', difficulty: 'hard', points: 15,
      prompt: 'A policy uses USING without WITH CHECK. Bob (org_id=1) tries to insert into org 2. What does he see?',
      stimulus: sqlS('Bob tries:', ["INSERT INTO tasks (org_id, project_id, title) VALUES (2, 3, 'Cross-org') RETURNING id"]),
      setupSql: "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; CREATE POLICY tasks_insert_no_check ON tasks FOR INSERT WITH CHECK (false)",
      answerSql: "INSERT INTO tasks (org_id, project_id, title) VALUES (2, 3, 'Cross-org')",
      persona: 'bob',
      expect: { error: 'row-level security' },
    },
    {
      id: 'g-rls-5', topicSlug: 'row-level-security', difficulty: 'easy', points: 10,
      prompt: 'The table owner runs the same query as a member. How many rows does the owner see?',
      stimulus: sqlS('Owner runs:', ['SELECT count(*) FROM tasks']),
      setupSql: "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; CREATE POLICY tasks_member_select ON tasks FOR SELECT USING (org_id = current_setting('app.org_id', true)::int)",
      answerSql: 'SELECT count(*) FROM tasks',
      persona: 'owner',
      expect: { firstCell: String(GT.totalTasks) },
    },
    {
      id: 'g-rls-6', topicSlug: 'row-level-security', difficulty: 'hard', points: 15,
      prompt: 'A policy restricts reads by assignee_id. How many tasks does Bob (member_id=2) see?',
      stimulus: sqlS('Bob runs:', ['SELECT id, assignee_id, title FROM tasks ORDER BY id']),
      setupSql: "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; CREATE POLICY tasks_assignee ON tasks FOR SELECT USING (assignee_id = current_setting('app.member_id', true)::int)",
      answerSql: 'SELECT count(*) FROM tasks WHERE assignee_id = 2',
      persona: 'bob',
      expect: { firstCell: String(GT.bobAssignee) },
    },
    {
      id: 'g-rls-7', topicSlug: 'row-level-security', difficulty: 'medium', points: 10,
      prompt: 'Bob (org_id=1) inserts a task into his own org. How many tasks does he see after the insert?',
      stimulus: sqlS('Bob inserts:', ["INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'My task') RETURNING id, title"]),
      setupSql: [
        "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY",
        "CREATE POLICY tasks_member_select ON tasks FOR SELECT USING (org_id = current_setting('app.org_id', true)::int)",
        "CREATE POLICY tasks_member_insert ON tasks FOR INSERT WITH CHECK (org_id = current_setting('app.org_id', true)::int)",
      ].join('; '),
      answerSql: "INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'My task'); SELECT count(*) FROM tasks WHERE org_id = 1",
      persona: 'bob',
      expect: { firstCell: String(GT.bobSees + 1) },
    },
    {
      id: 'g-rls-8', topicSlug: 'row-level-security', difficulty: 'medium', points: 10,
      prompt: 'An anonymous role is granted SELECT on tasks but never sets app.org_id. How many rows does its count return?',
      stimulus: sqlS('Anonymous runs:', ['GRANT SELECT ON tasks TO app_anon; -- done by the app', 'SELECT count(*) FROM tasks']),
      setupSql: "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; GRANT SELECT ON tasks TO app_anon; CREATE POLICY tasks_member_select ON tasks FOR SELECT USING (org_id = current_org_id())",
      answerSql: 'SELECT count(*) FROM tasks',
      persona: 'anon',
      expect: { firstCell: '0' },
    },
    {
      id: 'g-rls-9', topicSlug: 'row-level-security', difficulty: 'hard', points: 15,
      prompt: 'Two permissive SELECT policies exist. How many rows does Bob see with both active?',
      stimulus: sqlS('Bob runs:', ['SELECT count(*) FROM tasks']),
      setupSql: [
        "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY",
        "CREATE POLICY tasks_org1 ON tasks FOR SELECT USING (org_id = 1)",
        "CREATE POLICY tasks_org2 ON tasks FOR SELECT USING (org_id = 2)",
      ].join('; '),
      answerSql: 'SELECT count(*) FROM tasks WHERE org_id IN (1, 2)',
      persona: 'bob',
      expect: { firstCell: String(GT.totalTasks) },
    },
    {
      id: 'g-rls-10', topicSlug: 'row-level-security', difficulty: 'medium', points: 10,
      prompt: 'Alice runs a query filtered to org_id=1. How many rows does she see?',
      stimulus: sqlS('Alice runs:', ['SELECT count(*) FROM tasks WHERE org_id = 1']),
      setupSql: "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; CREATE POLICY tasks_member_select ON tasks FOR SELECT USING (org_id = current_setting('app.org_id', true)::int)",
      answerSql: 'SELECT count(*) FROM tasks WHERE org_id = 1',
      persona: 'alice',
      expect: { firstCell: String(GT.bobSees) },
    },
  ];
}

function indexQuestions() {
  return [
    {
      id: 'g-idx-1', topicSlug: 'indexes', difficulty: 'easy', points: 10,
      prompt: 'How many tasks belong to Acme Rockets (org_id=1)?',
      stimulus: sqlS('Query:', ['SELECT count(*) FROM tasks WHERE org_id = 1']),
      setupSql: '',
      answerSql: `SELECT count(*) FROM tasks WHERE org_id = 1`,
      persona: 'owner',
      expect: { firstCell: String(GT.bobSees) },
    },
    {
      id: 'g-idx-2', topicSlug: 'indexes', difficulty: 'easy', points: 10,
      prompt: 'How many tasks have status \'todo\'?',
      stimulus: tableS('Status counts', ['status', 'n'], [['todo', String(GT.todoTasks)], ['doing', String(GT.doingTasks)], ['done', String(GT.doneTasks)]]),
      setupSql: '',
      answerSql: "SELECT count(*) FROM tasks WHERE status = 'todo'",
      persona: 'owner',
      expect: { firstCell: String(GT.todoTasks) },
    },
    {
      id: 'g-idx-3', topicSlug: 'indexes', difficulty: 'medium', points: 10,
      prompt: 'What is the combined budget of all projects?',
      stimulus: tableS('Projects', ['name', 'budget'], GT.projectBudgets),
      setupSql: '',
      answerSql: 'SELECT sum(budget) FROM projects',
      persona: 'owner',
      expect: { firstCell: String(GT.totalBudget) },
    },
    {
      id: 'g-idx-4', topicSlug: 'indexes', difficulty: 'medium', points: 10,
      prompt: 'How many tasks are assigned to a member?',
      stimulus: sqlS('Query:', ['SELECT count(*) FROM tasks WHERE assignee_id IS NOT NULL']),
      setupSql: '',
      answerSql: 'SELECT count(*) FROM tasks WHERE assignee_id IS NOT NULL',
      persona: 'owner',
      expect: { firstCell: String(GT.assignedTasks) },
    },
  ];
}

function mvccQuestions() {
  return [
    {
      id: 'g-mvcc-1', topicSlug: 'transactions-mvcc', difficulty: 'easy', points: 10,
      prompt: 'The table shows all tasks. How many are "todo"?',
      stimulus: tableS('All tasks', ['title', 'status'], GT.tasksTitles),
      setupSql: '',
      answerSql: "SELECT count(*) FROM tasks WHERE status = 'todo'",
      persona: 'owner',
      expect: { firstCell: String(GT.todoTasks) },
    },
    {
      id: 'g-mvcc-2', topicSlug: 'transactions-mvcc', difficulty: 'easy', points: 10,
      prompt: 'How many tasks are in each status?',
      stimulus: tableS('Projects', ['name', 'budget'], GT.projectBudgets),
      setupSql: '',
      answerSql: 'SELECT status, count(*) FROM tasks GROUP BY status ORDER BY status',
      persona: 'owner',
      expect: { rows: 3 },
    },
    {
      id: 'g-mvcc-3', topicSlug: 'transactions-mvcc', difficulty: 'medium', points: 10,
      prompt: 'Inside one open transaction a row was deleted and the savepoint rolled back. How many tasks does the count show?',
      stimulus: sqlS('Session A (still open):', ['BEGIN;', 'SAVEPOINT sp;', 'DELETE FROM tasks WHERE id = 1;', 'ROLLBACK TO SAVEPOINT sp;', 'SELECT count(*) FROM tasks;']),
      setupSql: 'SAVEPOINT sp; DELETE FROM tasks WHERE id = 1; ROLLBACK TO SAVEPOINT sp',
      answerSql: 'SELECT count(*) FROM tasks',
      persona: 'owner',
      expect: { firstCell: String(GT.totalTasks) },
    },
    {
      id: 'g-mvcc-4', topicSlug: 'transactions-mvcc', difficulty: 'hard', points: 15,
      prompt: 'Two concurrent transactions both read the same row. Txn A updates it. What does Txn B see?',
      stimulus: sqlS('Setup:', ['SELECT id, title FROM tasks WHERE id = 1']),
      setupSql: '',
      answerSql: 'SELECT id, title FROM tasks WHERE id = 1',
      persona: 'owner',
      expect: { rows: 1 },
    },
    {
      id: 'g-mvcc-5', topicSlug: 'transactions-mvcc', difficulty: 'hard', points: 15,
      prompt: 'A savepoint was rolled back after overwriting task 1. What does the first row of `SELECT title FROM tasks ORDER BY id` show?',
      stimulus: sqlS('Sequence:', ["BEGIN;", "SAVEPOINT sp1;", "UPDATE tasks SET title = 'temp' WHERE id = 1;", 'ROLLBACK TO SAVEPOINT sp1;', 'SELECT title FROM tasks ORDER BY id;']),
      setupSql: "SAVEPOINT sp1; UPDATE tasks SET title = 'temp' WHERE id = 1; ROLLBACK TO SAVEPOINT sp1",
      answerSql: 'SELECT title FROM tasks ORDER BY id',
      persona: 'owner',
      expect: { firstCell: GT.firstTaskTitle },
    },
  ];
}

function triggerQuestions() {
  // Each setup element must be ONE complete statement. A `$$ … $$` body that spans several elements
  // gets a `;` injected between them by the join, and those semicolons land inside the function body —
  // plpgsql then aborts on the empty statement (`syntax error at or near ";"`). Measured, not assumed.
  const auditFn = (name, body, ret) =>
    `CREATE OR REPLACE FUNCTION ${name}() RETURNS trigger AS $$ BEGIN ${body} RETURN ${ret}; END; $$ LANGUAGE plpgsql`;

  return [
    {
      id: 'g-trg-1', topicSlug: 'triggers', difficulty: 'medium', points: 10,
      prompt: 'A row-level audit trigger is installed, then one task is inserted. How many rows does audit_log hold?',
      setupSql: [
        auditFn('audit_fn', "INSERT INTO audit_log (table_name, op, row_id) VALUES (TG_TABLE_NAME, TG_OP, NEW.id);", 'NEW'),
        'CREATE TRIGGER tasks_audit_insert AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION audit_fn()',
      ].join(';\n'),
      stimulus: sqlS('Insert:', ["INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'Triggered') RETURNING id"]),
      answerSql: "INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'Triggered'); SELECT count(*) FROM audit_log",
      persona: 'owner',
      expect: { firstCell: '1' },
    },
    {
      id: 'g-trg-2', topicSlug: 'triggers', difficulty: 'medium', points: 10,
      prompt: 'A BEFORE INSERT trigger uppercases NEW.title. After inserting the title "lowercase", how many rows match the uppercase form?',
      setupSql: [
        auditFn('upper_title', 'NEW.title = upper(NEW.title);', 'NEW'),
        'CREATE TRIGGER tasks_upper_title BEFORE INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION upper_title()',
      ].join(';\n'),
      stimulus: sqlS('Insert:', ["INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'lowercase') RETURNING title"]),
      answerSql: "INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'lowercase'); SELECT count(*) FROM tasks WHERE title = 'LOWERCASE'",
      persona: 'owner',
      expect: { firstCell: '1' },
    },
    {
      id: 'g-trg-3', topicSlug: 'triggers', difficulty: 'medium', points: 10,
      prompt: 'The audit trigger is FOR EACH STATEMENT, and one DELETE removes two rows. How many audit rows result?',
      setupSql: [
        auditFn('audit_del', "INSERT INTO audit_log (table_name, op, row_id) VALUES (TG_TABLE_NAME, TG_OP, OLD.id);", 'OLD'),
        'CREATE TRIGGER tasks_audit_del AFTER DELETE ON tasks FOR EACH STATEMENT EXECUTE FUNCTION audit_del()',
      ].join(';\n'),
      stimulus: sqlS('One statement, two rows:', ['DELETE FROM tasks WHERE id IN (5, 6) RETURNING id']),
      answerSql: 'DELETE FROM tasks WHERE id IN (5, 6); SELECT count(*) FROM audit_log',
      persona: 'owner',
      expect: { firstCell: '1' },
    },
    {
      id: 'g-trg-4', topicSlug: 'triggers', difficulty: 'hard', points: 15,
      prompt: 'A row-level trigger audits two task inserts in one statement. How many audit rows?',
      setupSql: [
        auditFn('audit_ins_row', "INSERT INTO audit_log (table_name, op, row_id) VALUES (TG_TABLE_NAME, TG_OP, NEW.id);", 'NEW'),
        'CREATE TRIGGER tasks_audit_row AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION audit_ins_row()',
      ].join(';\n'),
      stimulus: sqlS('One statement, two rows:', ["INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'A'), (1, 1, 'B')"]),
      answerSql: "INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'A'), (1, 1, 'B'); SELECT count(*) FROM audit_log",
      persona: 'owner',
      expect: { firstCell: '2' },
    },
    {
      id: 'g-trg-5', topicSlug: 'triggers', difficulty: 'hard', points: 15,
      prompt: 'A conditional trigger fires only WHEN NEW.status = \'done\'. Two tasks are updated to \'done\' and one to \'doing\'. How many audit rows?',
      setupSql: [
        auditFn('audit_done', "INSERT INTO audit_log (table_name, op, row_id) VALUES (TG_TABLE_NAME, TG_OP, NEW.id);", 'NEW'),
        "CREATE TRIGGER tasks_done AFTER UPDATE ON tasks FOR EACH ROW WHEN (NEW.status = 'done') EXECUTE FUNCTION audit_done()",
      ].join(';\n'),
      stimulus: sqlS('Two statements:', ["UPDATE tasks SET status = 'done' WHERE id IN (2, 3);", "UPDATE tasks SET status = 'doing' WHERE id = 4;"]),
      answerSql: "UPDATE tasks SET status = 'done' WHERE id IN (2, 3); UPDATE tasks SET status = 'doing' WHERE id = 4; SELECT count(*) FROM audit_log",
      persona: 'owner',
      expect: { firstCell: '2' },
    },
    {
      id: 'g-trg-6', topicSlug: 'triggers', difficulty: 'hard', points: 15,
      prompt: 'Two row-level triggers are attached to the same INSERT event. How many audit rows does one insert produce?',
      setupSql: [
        auditFn('audit1', "INSERT INTO audit_log (table_name, op, row_id) VALUES (TG_TABLE_NAME, TG_OP || '-a', NEW.id);", 'NEW'),
        auditFn('audit2', "INSERT INTO audit_log (table_name, op, row_id) VALUES (TG_TABLE_NAME, TG_OP || '-b', NEW.id);", 'NEW'),
        'CREATE TRIGGER t1 AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION audit1()',
        'CREATE TRIGGER t2 AFTER INSERT ON tasks FOR EACH ROW EXECUTE FUNCTION audit2()',
      ].join(';\n'),
      stimulus: sqlS('Insert:', ["INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'Double') RETURNING id"]),
      answerSql: "INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'Double'); SELECT count(*) FROM audit_log",
      persona: 'owner',
      expect: { firstCell: '2' },
    },
    {
      // Measured: the insert still fails. DISABLE TRIGGER stops triggers; CHECK constraints are not
      // triggers, so the constraint is the thing that rejects the row. That gap is the question.
      id: 'g-trg-7', topicSlug: 'triggers', difficulty: 'hard', points: 15,
      prompt: 'Every trigger on tasks is disabled, then one insert supplies a status outside the CHECK list. What happens?',
      setupSql: 'ALTER TABLE tasks DISABLE TRIGGER ALL',
      stimulus: sqlS('Insert with an out-of-range status:', ["INSERT INTO tasks (org_id, project_id, title, status) VALUES (1, 1, 'Bypassed', 'custom')"]),
      answerSql: "INSERT INTO tasks (org_id, project_id, title, status) VALUES (1, 1, 'Bypassed', 'custom')",
      persona: 'owner',
      expect: { error: 'violates check constraint' },
    },
    {
      id: 'g-trg-8', topicSlug: 'triggers', difficulty: 'hard', points: 15,
      prompt: 'An INSTEAD OF INSERT trigger on a view redirects writes into tasks. How many tasks carry the inserted title?',
      setupSql: [
        "CREATE VIEW active_tasks AS SELECT id, title, status FROM tasks WHERE status IN ('todo', 'doing')",
        auditFn('view_ins', "INSERT INTO tasks (org_id, project_id, title, status) VALUES (1, 1, NEW.title, NEW.status);", 'NEW'),
        'CREATE TRIGGER active_tasks_ins INSTEAD OF INSERT ON active_tasks FOR EACH ROW EXECUTE FUNCTION view_ins()',
      ].join(';\n'),
      stimulus: sqlS('Insert through the view:', ["INSERT INTO active_tasks (title, status) VALUES ('Via view', 'todo') RETURNING id"]),
      answerSql: "INSERT INTO active_tasks (title, status) VALUES ('Via view', 'todo'); SELECT count(*) FROM tasks WHERE title = 'Via view'",
      persona: 'owner',
      expect: { firstCell: '1' },
    },
  ];
}

function functionQuestions() {
  return [
    {
      id: 'g-func-1', topicSlug: 'functions-and-procedures', difficulty: 'easy', points: 10,
      prompt: 'A SQL function returns the count of tasks. What does it return?',
      setupSql: 'CREATE FUNCTION task_count() RETURNS bigint AS $$ SELECT count(*) FROM tasks $$ LANGUAGE SQL',
      stimulus: sqlS('Call:', ['SELECT task_count()']),
      answerSql: 'SELECT task_count()',
      persona: 'owner',
      expect: { firstCell: String(GT.totalTasks) },
    },
    {
      id: 'g-func-2', topicSlug: 'functions-and-procedures', difficulty: 'easy', points: 10,
      prompt: 'A function accepts an org_id and returns that org\'s task count. What does it return for org 1?',
      setupSql: 'CREATE FUNCTION org_count(int) RETURNS bigint AS $$ SELECT count(*) FROM tasks WHERE org_id = $1 $$ LANGUAGE SQL',
      stimulus: sqlS('Call:', ['SELECT org_count(1)']),
      answerSql: 'SELECT org_count(1)',
      persona: 'owner',
      expect: { firstCell: String(GT.bobSees) },
    },
    {
      id: 'g-func-3', topicSlug: 'functions-and-procedures', difficulty: 'medium', points: 10,
      prompt: 'A PL/pgSQL function returns \'high\' when budget > 10000, else \'low\'. What does it return for 50000?',
      setupSql: "CREATE FUNCTION budget_tier(num numeric) RETURNS text AS $$ BEGIN IF $1 > 10000 THEN RETURN 'high'; ELSE RETURN 'low'; END IF; END; $$ LANGUAGE plpgsql",
      stimulus: sqlS('Call:', ['SELECT budget_tier(50000)']),
      answerSql: "SELECT budget_tier(50000)",
      persona: 'owner',
      expect: { firstCell: 'high' },
    },
    {
      id: 'g-func-4', topicSlug: 'functions-and-procedures', difficulty: 'hard', points: 15,
      prompt: 'A SECURITY DEFINER function runs as the table owner. How many members does Bob see?',
      setupSql: 'CREATE FUNCTION privileged_count() RETURNS bigint AS $$ SELECT count(*) FROM members $$ LANGUAGE SQL SECURITY DEFINER',
      stimulus: sqlS('Bob calls:', ['SELECT privileged_count()']),
      answerSql: 'SELECT privileged_count()',
      persona: 'bob',
      expect: { firstCell: String(GT.totalMembers) },
    },
    {
      id: 'g-func-5', topicSlug: 'functions-and-procedures', difficulty: 'medium', points: 10,
      prompt: 'A RETURNS TABLE function returns project names. How many rows does it return?',
      setupSql: 'CREATE FUNCTION all_projects() RETURNS TABLE(name text) AS $$ SELECT name FROM projects $$ LANGUAGE SQL',
      stimulus: sqlS('Call:', ['SELECT * FROM all_projects()']),
      answerSql: 'SELECT * FROM all_projects()',
      persona: 'owner',
      expect: { rows: GT.totalProjects },
    },
    {
      id: 'g-func-6', topicSlug: 'functions-and-procedures', difficulty: 'medium', points: 10,
      prompt: 'A STABLE function is called once per row in a scan. How many rows does this scan return?',
      setupSql: 'CREATE FUNCTION get_total() RETURNS bigint AS $$ SELECT count(*) FROM tasks $$ LANGUAGE SQL STABLE',
      stimulus: sqlS('Scan:', ['SELECT get_total() FROM tasks LIMIT 3']),
      answerSql: 'SELECT get_total() FROM tasks LIMIT 3',
      persona: 'owner',
      expect: { rows: 3 },
    },
    {
      id: 'g-func-7', topicSlug: 'functions-and-procedures', difficulty: 'medium', points: 10,
      prompt: 'What is the average project budget, rounded to the nearest whole number?',
      stimulus: tableS('Projects', ['name', 'budget'], GT.projectBudgets),
      setupSql: '',
      answerSql: 'SELECT round(avg(budget)) FROM projects',
      persona: 'owner',
      expect: { firstCell: '22000' }, // (50000 + 4000 + 12000) / 3 = 22000
    },
    {
      id: 'g-func-8', topicSlug: 'functions-and-procedures', difficulty: 'hard', points: 15,
      prompt: 'A RANK() window function assigns rank by budget descending. What rank does Moon Rocket get?',
      stimulus: sqlS('Query:', ["SELECT name, rank() OVER (ORDER BY budget DESC) FROM projects WHERE name = 'Moon Rocket'"]),
      setupSql: '',
      answerSql: "SELECT rank() OVER (ORDER BY budget DESC) FROM projects WHERE name = 'Moon Rocket'",
      persona: 'owner',
      expect: { firstCell: '1' },
    },
  ];
}

function roleQuestions() {
  return [
    {
      id: 'g-role-1', topicSlug: 'roles-and-privileges', difficulty: 'easy', points: 10,
      prompt: 'app_member has SELECT on organizations. How many rows can Bob see?',
      setupSql: '',
      stimulus: sqlS('Bob runs:', ['SELECT count(*) FROM organizations']),
      answerSql: 'SELECT count(*) FROM organizations',
      persona: 'bob',
      expect: { firstCell: String(GT.totalOrgs) },
    },
    {
      id: 'g-role-2', topicSlug: 'roles-and-privileges', difficulty: 'medium', points: 10,
      prompt: 'app_member has no SELECT on members. What does Bob see?',
      setupSql: 'REVOKE SELECT ON members FROM app_member',
      stimulus: sqlS('Bob runs:', ['SELECT count(*) FROM members']),
      answerSql: 'SELECT count(*) FROM members',
      persona: 'bob',
      expect: { error: 'permission denied' },
    },
    {
      id: 'g-role-3', topicSlug: 'roles-and-privileges', difficulty: 'medium', points: 10,
      prompt: 'app_member keeps INSERT and UPDATE on tasks but loses DELETE. What happens on DELETE?',
      setupSql: 'REVOKE DELETE ON tasks FROM app_member',
      stimulus: sqlS('Bob tries:', ['DELETE FROM tasks WHERE id = 1']),
      answerSql: 'DELETE FROM tasks WHERE id = 1',
      persona: 'bob',
      expect: { error: 'permission denied' },
    },
    {
      id: 'g-role-4', topicSlug: 'roles-and-privileges', difficulty: 'hard', points: 15,
      prompt: 'GRANT WITH GRANT OPTION lets a member pass on SELECT. How many rows does Bob see after the grant?',
      setupSql: 'GRANT SELECT ON organizations TO app_anon',
      stimulus: sqlS('Anon runs:', ['SELECT count(*) FROM organizations']),
      answerSql: 'SELECT count(*) FROM organizations',
      persona: 'anon',
      expect: { firstCell: String(GT.totalOrgs) },
    },
    {
      id: 'g-role-5', topicSlug: 'roles-and-privileges', difficulty: 'easy', points: 10,
      prompt: 'Only the owner can ALTER a table. What does Bob see when he tries?',
      setupSql: '',
      stimulus: sqlS('Bob tries:', ['ALTER TABLE tasks ADD COLUMN new_col text']),
      answerSql: 'ALTER TABLE tasks ADD COLUMN new_col text',
      persona: 'bob',
      expect: { error: 'must be owner' },
    },
  ];
}

function securityQuestions() {
  // No prepared-statement item here on purpose: a PREPARE made in setup does not die with the
  // per-item ROLLBACK in PGlite (measured — the retry reports `prepared statement "q" already
  // exists`), so any question that depends on one fails its own repeatability gate.
  return [
    {
      id: 'g-sec-1', topicSlug: 'production-security', difficulty: 'medium', points: 10,
      prompt: 'A parameterized query uses $1. How many rows for a nonexistent title?',
      setupSql: '',
      stimulus: sqlS('Query:', ['SELECT count(*) FROM tasks WHERE title = $1']),
      answerSql: "SELECT count(*) FROM tasks WHERE title = 'nonexistent title 999'",
      persona: 'owner',
      expect: { firstCell: '0' },
    },
    {
      id: 'g-sec-2', topicSlug: 'production-security', difficulty: 'easy', points: 10,
      prompt: 'Least privilege: app_member has only SELECT on organizations. How many rows?',
      setupSql: '',
      stimulus: sqlS('Bob runs:', ['SELECT count(*) FROM organizations']),
      answerSql: 'SELECT count(*) FROM organizations',
      persona: 'bob',
      expect: { firstCell: String(GT.totalOrgs) },
    },
    {
      id: 'g-sec-3', topicSlug: 'production-security', difficulty: 'easy', points: 10,
      prompt: 'A properly hashed password cannot be reversed. Which system view contains app_member?',
      setupSql: '',
      stimulus: sqlS('Check:', ["SELECT count(*) FROM pg_roles WHERE rolname = 'app_member'"]),
      answerSql: "SELECT count(*) FROM pg_roles WHERE rolname = 'app_member'",
      persona: 'owner',
      expect: { firstCell: '1' },
    },
    {
      id: 'g-sec-5',topicSlug: 'production-security', difficulty: 'hard', points: 15,
      prompt: 'A SECURITY BARRIER view prevents premature row evaluation. How many rows does it return?',
      setupSql: "CREATE VIEW secure_tasks WITH (security_barrier = true) AS SELECT id, title FROM tasks WHERE status = 'todo'",
      stimulus: sqlS('Query:', ["SELECT count(*) FROM secure_tasks"]),
      answerSql: "SELECT count(*) FROM secure_tasks",
      persona: 'owner',
      expect: { firstCell: String(GT.todoTasks) },
    },
    {
      id: 'g-sec-6', topicSlug: 'production-security', difficulty: 'medium', points: 10,
      prompt: 'app_anon has SELECT on organizations but not on members. What does anon see on members?',
      setupSql: '',
      stimulus: sqlS('Anon runs:', ['SELECT count(*) FROM members']),
      answerSql: 'SELECT count(*) FROM members',
      persona: 'anon',
      expect: { error: 'permission denied' },
    },
    {
      id: 'g-sec-7', topicSlug: 'production-security', difficulty: 'medium', points: 10,
      prompt: 'RLS blocks cross-org reads. How many tasks does Carol (org_id=2) see on the tasks table?',
      setupSql: "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; CREATE POLICY tasks_member ON tasks FOR SELECT USING (org_id = current_setting('app.org_id', true)::int)",
      stimulus: sqlS('Carol runs:', ['SELECT count(*) FROM tasks']),
      answerSql: 'SELECT count(*) FROM tasks',
      persona: 'carol',
      expect: { firstCell: String(GT.carolSees) },
    },
    {
      id: 'g-sec-8', topicSlug: 'production-security', difficulty: 'hard', points: 15,
      prompt: 'set_config sets app.org_id before queries. How many tasks does Alice see?',
      setupSql: "ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; CREATE POLICY tasks_member ON tasks FOR SELECT USING (org_id = current_setting('app.org_id', true)::int)",
      stimulus: sqlS('App sets:', ["SET app.org_id = '1'", 'SELECT count(*) FROM tasks']),
      answerSql: "SET app.org_id = '1'; SELECT count(*) FROM tasks",
      persona: 'alice',
      expect: { firstCell: String(GT.bobSees) },
    },
  ];
}

// ── Parametric matrices ────────────────────────────────────────────────────────
//
// Volume without fabrication. Each cell's expected value is measured on the OWNER's side from a
// predicate spelled out in SQL, while the answer is what the persona sees through row-level security
// or through grants. The two arrive at the number by different routes, which is what makes the gate
// mean something: if `SET LOCAL ROLE` never took effect, the answer reports all 7 tasks and the
// predicate says 4, and the cell is dropped rather than shipped.
//
// Every cell is still a real question with a real prompt — the matrix is a way of writing many of
// them, not a way of skipping the reasoning in one.

const RLS_MATRIX_POLICIES = [
  {
    key: 'org',
    label: 'a policy that limits reads to the tenant in app.org_id',
    create: "CREATE POLICY p ON tasks FOR SELECT USING (org_id = current_org_id())",
    // The same rule, expressed as a plain WHERE clause the owner can run.
    predicate: (p) => (p.orgId != null ? `org_id = ${p.orgId}` : 'false'),
  },
  {
    key: 'assignee',
    label: 'a policy that limits reads to rows assigned to the member in app.member_id',
    create: "CREATE POLICY p ON tasks FOR SELECT USING (assignee_id = current_member_id())",
    predicate: (p) => (p.memberId != null ? `assignee_id = ${p.memberId}` : 'false'),
  },
  {
    key: 'org-or-done',
    label: 'a policy that also lets every finished task through',
    create: "CREATE POLICY p ON tasks FOR SELECT USING (org_id = current_org_id() OR status = 'done')",
    predicate: (p) => (p.orgId != null ? `(org_id = ${p.orgId} OR status = 'done')` : `status = 'done'`),
  },
  {
    key: 'two-permissive',
    label: 'two permissive policies, which Postgres combines with OR',
    create: "CREATE POLICY p_a ON tasks FOR SELECT USING (org_id = 1); CREATE POLICY p_b ON tasks FOR SELECT USING (assignee_id = current_member_id())",
    predicate: (p) => (p.memberId != null ? `(org_id = 1 OR assignee_id = ${p.memberId})` : 'org_id = 1'),
  },
];

const RLS_MATRIX_QUERIES = [
  { key: 'all', sql: 'SELECT count(*) FROM tasks', filter: '', difficulty: 'easy' },
  { key: 'todo', sql: "SELECT count(*) FROM tasks WHERE status = 'todo'", filter: "AND status = 'todo'", difficulty: 'easy' },
  { key: 'doing', sql: "SELECT count(*) FROM tasks WHERE status = 'doing'", filter: "AND status = 'doing'", difficulty: 'medium' },
  { key: 'other-org', sql: 'SELECT count(*) FROM tasks WHERE org_id = 2', filter: 'AND org_id = 2', difficulty: 'medium' },
  { key: 'distinct-projects', sql: 'SELECT count(DISTINCT project_id) FROM tasks', filter: '', agg: 'count(DISTINCT project_id)', difficulty: 'hard' },
];

const RLS_MATRIX_PERSONAS = ['owner', 'alice', 'bob', 'carol', 'anon'];

function rlsMatrixQuestions() {
  const out = [];
  for (const policy of RLS_MATRIX_POLICIES) {
    for (const persona of RLS_MATRIX_PERSONAS) {
      const p = PERSONAS[persona];
      // The table owner holds BYPASSRLS implicitly, so the predicate it satisfies is "everything".
      const pred = persona === 'owner' ? 'true' : policy.predicate(p);
      for (const query of RLS_MATRIX_QUERIES) {
        out.push({
          id: `g-mx-${policy.key}-${persona}-${query.key}`,
          topicSlug: 'row-level-security',
          difficulty: query.difficulty,
          points: query.difficulty === 'hard' ? 15 : 10,
          prompt: `With ${policy.label} active, ${persona} runs this. What does the count return?`,
          stimulus: sqlS(`${persona} runs:`, query.sql.split(';\n')),
          setupSql: [
            'ALTER TABLE tasks ENABLE ROW LEVEL SECURITY',
            // anon is refused on privileges alone unless it is granted SELECT, which would hide the
            // RLS behaviour this matrix is about. Grant it, then the policy is what answers.
            persona === 'anon' && 'GRANT SELECT ON tasks TO app_anon',
            policy.create,
          ].filter(Boolean).join('; '),
          answerSql: query.sql,
          persona,
          // Measured from the owner's side, through the equivalent WHERE clause — see above.
          expect: { scalar: `SELECT ${query.agg ?? 'count(*)'} FROM tasks WHERE (${pred}) ${query.filter}` },
        });
      }
    }
  }
  return out;
}

/**
 * Privilege matrix: what a role may ask of each table.
 * `scalar` expectations are measured as the owner; `errorIncludes` ones are the denial itself.
 */
const PRIV_MATRIX = [
  { table: 'tasks', insert: "INSERT INTO tasks (org_id, project_id, title) VALUES (1, 1, 'Privilege probe')" },
  // Every seed table takes an explicit id except tasks, whose identity column fills it in.
  { table: 'projects', insert: "INSERT INTO projects (id, org_id, name, budget) VALUES (90, 1, 'Privilege probe', 100)" },
  { table: 'members', insert: "INSERT INTO members (id, org_id, name, email, role) VALUES (90, 1, 'Probe', 'probe@acme.test', 'member')" },
  { table: 'organizations', insert: "INSERT INTO organizations (id, name, plan) VALUES (90, 'Probe Org', 'free')" },
  { table: 'audit_log', insert: "INSERT INTO audit_log (table_name, op) VALUES ('tasks', 'probe')" },
];

function privilegeMatrixQuestions() {
  const out = [];
  for (const { table, insert } of PRIV_MATRIX) {
    const rows = { scalar: `SELECT count(*) FROM ${table}` };
    // app_member holds every write in the seed; take it away and the same statement is refused.
    out.push({
      id: `g-pm-${table}-select-only-insert`,
      topicSlug: 'roles-and-privileges', difficulty: 'medium', points: 10,
      prompt: `app_member keeps SELECT on ${table} but every other privilege on it is revoked. What happens when Bob inserts?`,
      stimulus: sqlS('Bob runs:', [insert]),
      setupSql: `REVOKE ALL ON ${table} FROM app_member; GRANT SELECT ON ${table} TO app_member`,
      answerSql: insert,
      persona: 'bob',
      expect: { errorIncludes: 'permission denied' },
    });
    // No privilege at all: even the read is refused, before RLS is ever consulted.
    out.push({
      id: `g-pm-${table}-nothing-select`,
      topicSlug: 'roles-and-privileges', difficulty: 'easy', points: 10,
      prompt: `All privileges on ${table} are revoked from app_member. What does Bob's count return?`,
      stimulus: sqlS('Bob runs:', [`SELECT count(*) FROM ${table}`]),
      setupSql: `REVOKE ALL ON ${table} FROM app_member`,
      answerSql: `SELECT count(*) FROM ${table}`,
      persona: 'bob',
      expect: { errorIncludes: 'permission denied' },
    });
    // app_anon is granted SELECT on organizations in the seed and nothing else, on any table.
    out.push({
      id: `g-pm-${table}-anon-read`,
      topicSlug: 'roles-and-privileges', difficulty: 'medium', points: 10,
      prompt: `app_anon is granted SELECT on ${table} and nothing else. What does its count return?`,
      stimulus: sqlS('anon runs:', [`SELECT count(*) FROM ${table}`]),
      setupSql: `GRANT SELECT ON ${table} TO app_anon`,
      answerSql: `SELECT count(*) FROM ${table}`,
      persona: 'anon',
      expect: rows,
    });
    // With the write granted, the row lands — the affected count is the whole question.
    out.push({
      id: `g-pm-${table}-member-insert`,
      topicSlug: 'roles-and-privileges', difficulty: 'medium', points: 10,
      prompt: `app_member has INSERT on ${table}. How many rows does Bob's insert report?`,
      stimulus: sqlS('Bob runs:', [insert]),
      setupSql: `GRANT INSERT ON ${table} TO app_member`,
      answerSql: insert,
      persona: 'bob',
      expect: { affected: 1 },
    });
  }
  return out;
}

// ── Main: run families, gate all candidates, write output ──────────────────────

const FAMILIES = [
  rlsQuestions,
  indexQuestions,
  mvccQuestions,
  functionQuestions,
  roleQuestions,
  triggerQuestions,
  securityQuestions,
  rlsMatrixQuestions,
  privilegeMatrixQuestions,
];

const validated = [];
const dropLog = [];

// Families are factories — they have to be called. Two candidates that run the same statements under
// the same identity are the same question no matter how differently they are worded, so the bank is
// deduped on what actually reaches the database, not on its id.
const seen = new Set();
const candidates = [];
for (const c of FAMILIES.flatMap((factory) => factory())) {
  const key = `${c.setupSql}|${c.persona}|${c.answerSql}`;
  if (seen.has(key)) {
    dropLog.push([c.id, 'duplicate statements — same setup, persona and answer as an earlier item']);
    continue;
  }
  seen.add(key);
  candidates.push(c);
}
console.log(`\n${candidates.length} distinct candidates across ${FAMILIES.length} families`);

for (const c of candidates) {
  // Author-side expectations that are phrased as a question (`scalar`) or as a denial
  // (`errorIncludes`) become the Check the grader actually speaks. `scalar` is measured here, on the
  // owner's side, outside the graded transaction — an independent route to the number.
  try {
    c.check = await resolveExpect(c);
  } catch (error) {
    dropLog.push([c.id, `expectation could not be measured — ${error.message}`]);
    continue;
  }

  // Gate 1: the reference answer must grade PASS through the same grader a participant's answer faces.
  const result = await run({ setupSql: c.setupSql, sql: c.answerSql, personaName: c.persona });
  const grade = gradeChecks(result, [c.check], 0);
  if (!grade.passed) {
    const seenText = result.ok
      ? JSON.stringify(result.results.at(-1)?.rows ?? 'no table')
      : `error: ${result.error}`;
    dropLog.push([c.id, `G1 reference answer fails — ${grade.failures.join('; ')} | observed ${seenText}`]);
    continue;
  }

  // Gate 2: `SELECT 42` must not pass — an oracle any answer satisfies teaches nothing.
  if (!(await notVacuous(c))) {
    dropLog.push([c.id, 'G2 vacuous oracle — SELECT 42 also passes']);
    continue;
  }

  // Gate 3: two independent executions must agree, or the oracle is only true on the run that made it.
  if (!(await repeatable(c))) {
    dropLog.push([c.id, 'G3 not repeatable — the answer reads state that changes between runs']);
    continue;
  }

  validated.push(c);
}

console.log(`\n${validated.length} passed all three gates`);
if (dropLog.length) {
  console.log('\nDropped:');
  for (const [id, reason] of dropLog) console.log(`  ${id}: ${reason}`);
}

// Summary by topic
const byTopic = {};
for (const q of validated) {
  (byTopic[q.topicSlug] ??= []).push(q.id);
}
console.log('\nBy topic:');
for (const [t, ids] of Object.entries(byTopic)) {
  console.log(`  ${t}: ${ids.length} — ${ids.join(', ')}`);
}

// Write TypeScript output
const { writeFileSync } = await import('node:fs');

const topicGroups = {};
for (const item of validated) {
  (topicGroups[item.topicSlug] ??= []).push(item);
}

const lines = [
  `/** AUTO-GENERATED by scripts/generate-exam-questions.mjs — do not edit by hand */`,
  ``,
  `import { PERSONAS } from '@/lib/exam/personas';`,
  `import type { ExamQuestion } from '@/lib/exam/types';`,
  ``,
  `const q = <T extends ExamQuestion>(x: T): T => x;`,
  ``,
];

for (const [topicSlug, items] of Object.entries(topicGroups)) {
  const varName = topicSlug.replace(/-/g, '_');
  lines.push(`// ── ${topicSlug} ─────────────────────────────────────────────────────────────`);
  lines.push(`const ${varName}: ExamQuestion[] = [`);
  for (const item of items) {
    lines.push(`  q({`);
    lines.push(`    id: '${item.id}',`);
    lines.push(`    topicSlug: '${item.topicSlug}',`);
    lines.push(`    difficulty: '${item.difficulty}',`);
    lines.push(`    prompt: ${JSON.stringify(item.prompt)},`);
    lines.push(`    stimulus: ${JSON.stringify(item.stimulus)},`);
    lines.push(`    setupSql: ${JSON.stringify(item.setupSql)},`);
    lines.push(`    persona: PERSONAS.${item.persona},`);
    lines.push(`    checks: [${JSON.stringify(item.check)}],`);
    lines.push(`    answerSql: ${JSON.stringify(item.answerSql)},`);
    // Limited to what was observed, in the grader's own vocabulary.
    lines.push(`    explanation: ${JSON.stringify(`Ran as ${item.persona} against a live PGlite before shipping; the reference answer ${describeChecks([item.check])}.`)},`);
    lines.push(`    points: ${item.points},`);
    lines.push(`  }),`);
  }
  lines.push(`];`);
  lines.push(``);
}

lines.push(`export const GENERATED_BANK: ExamQuestion[] = [`);
for (const topicSlug of Object.keys(topicGroups)) {
  lines.push(`  ...${topicSlug.replace(/-/g, '_')},`);
}
lines.push(`];`);

lines.push(`export const GENERATED_BY_SLUG: Record<string, ExamQuestion[]> = {`);
for (const [topicSlug, items] of Object.entries(topicGroups)) {
  lines.push(`  '${topicSlug}': ${topicSlug.replace(/-/g, '_')},`);
}
lines.push(`};`);

lines.push(`export const GENERATED_QUESTION_COUNT = GENERATED_BANK.length;`);

writeFileSync('src/content/generated-bank.ts', lines.join('\n'));
writeFileSync(
  'generated-bank-summary.txt',
  [
    `Generated: ${new Date().toISOString()}`,
    `Total: ${validated.length}`,
    ...Object.entries(byTopic).map(([t, ids]) => `  ${t}: ${ids.length}`),
    ``,
    `Dropped: ${dropLog.length}`,
    ...dropLog.map(([id, r]) => `  ${id}: ${r}`),
  ].join('\n'),
);

console.log(`\nWritten: src/content/generated-bank.ts (${validated.length} questions)`);
await db.close();
