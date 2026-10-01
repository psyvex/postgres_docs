/**
 * The exam question bank.
 *
 * Every answer is a SQL query. Every grade is a check against the seeded PGlite running exactly the same
 * flow the CI verifier uses: fresh PGlite per instance, SEED_SQL, session prefix, `gradeChecks`.
 *
 * Ground truth sources — all verified against a live PGlite (see `probe5.mjs`):
 * - Seed tables: 5 tables, 6 indexes, 7 tasks, 2 orgs, 4 members, 3 projects, 66000 total budget
 * - Status counts: 4 todo, 2 doing, 1 done
 * - RLS scenarios: bob org1 → 4, carol org2 → 3, alice by-assignee → 1
 * - app_anon: SELECT organizations = 2 rows; SELECT members = permission denied; INSERT organizations = denied
 * - Audit trigger: 1 trigger fires for INSERT, UPDATE, DELETE each (3 total ops recorded)
 * - Numeric: sum(budget) = "66000.00" (Postgres pads numeric with scale, wire format)
 *
 * IMPORTANT: setupSql runs as the database OWNER first. After that, `SET LOCAL ROLE` switches to the
 * persona for the participant's own answer. This order is load-bearing — app_member cannot ALTER a
 * table it does not own.
 */

import { PERSONAS } from '@/lib/exam/personas';
import type { ExamQuestion } from '@/lib/exam/types';
import { GENERATED_BY_SLUG } from './generated-bank';

const q = <T extends ExamQuestion>(x: T): T => x;

// ── Transactions & MVCC ──────────────────────────────────────────────────────

const mvcc: ExamQuestion[] = [
  q({
    id: 'mvcc-1',
    topicSlug: 'transactions-mvcc',
    difficulty: 'easy',
    prompt: 'How many tasks have status "todo"?',
    stimulus: {
      kind: 'table',
      caption: 'The seven tasks in the seed, grouped by status',
      columns: ['status', 'count'],
      rows: [['doing', '2'], ['done', '1'], ['todo', '4']],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '4' }],
    answerSql: "SELECT count(*) FROM tasks WHERE status = 'todo'",
    explanation: 'Four tasks have status "todo": Order 3 tons of rocket fuel, Add pricing page, Push notifications, Secret launch plan.',
    points: 10,
  }),

  q({
    id: 'mvcc-2',
    topicSlug: 'transactions-mvcc',
    difficulty: 'easy',
    prompt: 'What does the total project budget come to?',
    stimulus: {
      kind: 'table',
      caption: 'The three projects in the seed',
      columns: ['name', 'budget'],
      rows: [['Moon Rocket', '50000'], ['Website', '4000'], ['Mobile App', '12000']],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '66000.00' }],
    answerSql: 'SELECT sum(budget) FROM projects',
    explanation: 'Moon Rocket (50000) + Website (4000) + Mobile App (12000) = 66000. Postgres returns numeric aggregates as scale-padded strings.',
    points: 10,
  }),

  q({
    id: 'mvcc-3',
    topicSlug: 'transactions-mvcc',
    difficulty: 'easy',
    prompt: 'How many distinct statuses are in use?',
    stimulus: {
      kind: 'sql',
      caption: 'The status CHECK constraint allows: todo, doing, done',
      lines: ["SELECT distinct status FROM tasks"],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '3' }],
    answerSql: 'SELECT count(DISTINCT status) FROM tasks',
    explanation: 'Three distinct values: todo, doing, done. The CHECK constraint enforces this enum.',
    points: 10,
  }),

  q({
    id: 'mvcc-4',
    topicSlug: 'transactions-mvcc',
    difficulty: 'medium',
    prompt: 'How many tasks belong to projects in the "free" plan org?',
    stimulus: {
      kind: 'sql',
      caption: 'Globex Labs (org 2) has plan = free. Its only project is Mobile App (id 3).',
      lines: [
        'SELECT count(*)',
        'FROM tasks t JOIN projects p ON p.id = t.project_id',
        'JOIN organizations o ON o.id = p.org_id',
        "WHERE o.plan = 'free'",
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '3' }],
    answerSql: `SELECT count(*)\nFROM tasks t\nJOIN projects p ON p.id = t.project_id\nJOIN organizations o ON o.id = p.org_id\nWHERE o.plan = 'free'`,
    explanation: 'Globex Labs (plan = free) owns Mobile App. Mobile App holds three tasks: Login screen, Push notifications, Secret launch plan.',
    points: 15,
  }),

  q({
    id: 'mvcc-5',
    topicSlug: 'transactions-mvcc',
    difficulty: 'medium',
    prompt: 'How many tasks have no assignee?',
    stimulus: {
      kind: 'table',
      caption: 'The tasks that have NULL in the assignee_id column',
      columns: ['id', 'title'],
      rows: [['4', 'Add pricing page']],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '1' }],
    answerSql: 'SELECT count(*) FROM tasks WHERE assignee_id IS NULL',
    explanation: 'Exactly one task — "Add pricing page" — has no assignee. All others are assigned to a member.',
    points: 15,
  }),

  q({
    id: 'mvcc-6',
    topicSlug: 'transactions-mvcc',
    difficulty: 'hard',
    prompt: 'How many tasks belong to Alice\'s org, according to a subquery?',
    stimulus: {
      kind: 'sql',
      caption: 'Alice (member_id 1) is in org_id 1. Write the query using a subquery for the org.',
      lines: [
        'SELECT count(*)',
        'FROM tasks',
        'WHERE org_id IN (SELECT id FROM organizations WHERE plan = $1)',
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '4' }],
    answerSql: `SELECT count(*)\nFROM tasks\nWHERE org_id IN (SELECT id FROM organizations WHERE plan = 'pro')`,
    explanation: 'The subquery returns org_id 1 (Acme Rockets, plan = pro). Four tasks belong to org 1.',
    points: 20,
  }),
];

// ── Indexes ───────────────────────────────────────────────────────────────────

const indexes: ExamQuestion[] = [
  q({
    id: 'idx-1',
    topicSlug: 'indexes',
    difficulty: 'easy',
    prompt: 'How many distinct statuses are indexed?',
    stimulus: {
      kind: 'table',
      caption: 'Each status value maps to one or more rows in the table',
      columns: ['status', 'row_count'],
      rows: [['todo', '4'], ['doing', '2'], ['done', '1']],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '3' }],
    answerSql: 'SELECT count(DISTINCT status) FROM tasks',
    explanation: 'Three distinct status values exist in the tasks table. An index on status would have three distinct entries.',
    points: 10,
  }),

  q({
    id: 'idx-2',
    topicSlug: 'indexes',
    difficulty: 'easy',
    prompt: 'What is the highest-budget project called?',
    stimulus: {
      kind: 'table',
      caption: 'Projects ordered by budget descending',
      columns: ['name', 'budget'],
      rows: [['Moon Rocket', '50000'], ['Mobile App', '12000'], ['Website', '4000']],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: 'Moon Rocket' }],
    answerSql: 'SELECT name FROM projects ORDER BY budget DESC LIMIT 1',
    explanation: 'Moon Rocket has the highest budget at 50000. ORDER BY DESC with LIMIT 1 picks it out.',
    points: 10,
  }),

  q({
    id: 'idx-3',
    topicSlug: 'indexes',
    difficulty: 'medium',
    prompt: 'How many indexes does the lab schema have?',
    stimulus: {
      kind: 'table',
      caption: 'Every PRIMARY KEY and UNIQUE constraint creates an index automatically',
      columns: ['indexname'],
      rows: [
        ['organizations_pkey'],
        ['members_pkey'],
        ['members_email_key'],
        ['projects_pkey'],
        ['tasks_pkey'],
        ['audit_log_pkey'],
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '6' }],
    answerSql: "SELECT count(*) FROM pg_indexes WHERE schemaname = 'lab'",
    explanation: 'Six indexes: one for each primary key, plus the unique index on members.email. The audit_log also has its own primary key.',
    points: 15,
  }),

  q({
    id: 'idx-4',
    topicSlug: 'indexes',
    difficulty: 'medium',
    prompt: 'Which status appears in more than two tasks?',
    stimulus: {
      kind: 'sql',
      caption: 'GROUP BY counts rows per status value',
      lines: ["SELECT status, count(*) FROM tasks GROUP BY status HAVING count(*) > 2"],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: 'todo' }],
    answerSql: "SELECT status FROM tasks GROUP BY status HAVING count(*) > 2",
    explanation: '"todo" appears in 4 tasks, which is more than 2. "doing" appears in 2, "done" in 1 — neither exceeds the threshold.',
    points: 15,
  }),

  q({
    id: 'idx-5',
    topicSlug: 'indexes',
    difficulty: 'hard',
    prompt: 'What rank does "Website" have among projects by budget, where rank 1 is the largest?',
    stimulus: {
      kind: 'table',
      caption: 'rank() is assigned across the whole set — the filter has to come after it',
      columns: ['name', 'budget', 'rank'],
      rows: [['Moon Rocket', '50000', '1'], ['Mobile App', '12000', '2'], ['Website', '4000', '3']],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '3' }],
    answerSql: `SELECT r\nFROM (SELECT name, rank() OVER (ORDER BY budget DESC) AS r FROM projects) x\nWHERE name = 'Website'`,
    explanation: `Rank 3. The trap is WHERE. A window function is evaluated after WHERE, so writing
      \`FROM projects WHERE name = 'Website'\` leaves the window a single row, and rank() reports 1.
      Rank has to be computed over all three projects first, in a subquery, and the filter applied outside it.`,
    points: 25,
  }),
];

// ── Row-Level Security ─────────────────────────────────────────────────────────

const rls: ExamQuestion[] = [
  q({
    id: 'rls-1',
    topicSlug: 'row-level-security',
    difficulty: 'easy',
    prompt: 'How many tasks does Bob (org 1) see when the policy enforces org isolation?',
    stimulus: {
      kind: 'sql',
      caption: 'The policy: tasks are visible only when org_id matches the session\'s app.org_id',
      lines: ["CREATE POLICY p ON tasks USING (org_id = current_setting('app.org_id', true)::int)"],
    },
    setupSql: `ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
               CREATE POLICY p ON tasks USING (org_id = current_setting('app.org_id', true)::int);`,
    persona: PERSONAS.bob,
    checks: [{ firstCell: '4' }],
    answerSql: 'SELECT count(*) FROM tasks',
    explanation: 'Bob is in org 1 (Acme Rockets). The policy hides every task from org 2 (Globex Labs). Bob sees the four tasks owned by his org.',
    points: 10,
  }),

  q({
    id: 'rls-2',
    topicSlug: 'row-level-security',
    difficulty: 'easy',
    prompt: 'How many tasks does Carol (org 2) see under the same policy?',
    stimulus: {
      kind: 'table',
      caption: 'Carol is in Globex Labs (org 2)',
      columns: ['id', 'title'],
      rows: [['5', 'Login screen'], ['6', 'Push notifications'], ['7', 'Secret launch plan']],
    },
    setupSql: `ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
               CREATE POLICY p ON tasks USING (org_id = current_setting('app.org_id', true)::int);`,
    persona: PERSONAS.carol,
    checks: [{ firstCell: '3' }],
    answerSql: 'SELECT count(*) FROM tasks',
    explanation: 'Carol is in org 2. The three Globex tasks (Login screen, Push notifications, Secret launch plan) all belong to org 2 and are visible. The four Acme tasks are hidden.',
    points: 10,
  }),

  q({
    id: 'rls-3',
    topicSlug: 'row-level-security',
    difficulty: 'medium',
    prompt: 'How many tasks does Alice see under an assignee-based policy?',
    stimulus: {
      kind: 'sql',
      caption: 'The policy: a task is visible only when assignee_id matches the session\'s app.member_id',
      lines: ["CREATE POLICY p ON tasks USING (assignee_id = current_setting('app.member_id', true)::int)"],
    },
    setupSql: `ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
               CREATE POLICY p ON tasks USING (assignee_id = current_setting('app.member_id', true)::int);`,
    persona: PERSONAS.alice,
    checks: [{ firstCell: '1' }],
    answerSql: 'SELECT count(*) FROM tasks',
    explanation: 'Alice is member_id 1. Only one task — "Design fuel tank" — is assigned to her. Under an assignee-based policy, she sees only her own work.',
    points: 15,
  }),

  q({
    id: 'rls-4',
    topicSlug: 'row-level-security',
    difficulty: 'medium',
    prompt: 'What does the anonymous role see when it queries organizations?',
    stimulus: {
      kind: 'table',
      caption: 'The seed grants SELECT on organizations to app_anon',
      columns: ['id', 'name'],
      rows: [['1', 'Acme Rockets'], ['2', 'Globex Labs']],
    },
    setupSql: '',
    persona: PERSONAS.anon,
    checks: [{ firstCell: '2' }],
    answerSql: 'SELECT count(*) FROM organizations',
    explanation: 'app_anon has SELECT permission on organizations. Both rows are visible because there is no RLS policy on the organizations table.',
    points: 15,
  }),

  q({
    id: 'rls-5',
    topicSlug: 'row-level-security',
    difficulty: 'hard',
    prompt: 'What does the anonymous role see when it queries members — and why?',
    stimulus: {
      kind: 'sql',
      caption: 'app_anon has no grant on members. RLS is not yet enabled on members.',
      lines: ['SELECT * FROM members'],
    },
    setupSql: '',
    persona: PERSONAS.anon,
    checks: [{ error: 'permission denied' }],
    answerSql: 'SELECT * FROM members LIMIT 1',
    explanation: 'The seed grants SELECT on members only to app_member and app_admin. app_anon has no row-level grants on members, so the query is rejected at the privilege layer — before RLS even runs.',
    points: 25,
  }),
];

// ── Triggers ──────────────────────────────────────────────────────────────────

/**
 * Builds an audit trail on `tasks`, then performs one INSERT, one UPDATE and one DELETE. The three
 * writes are scenario *setup* rather than part of the answer, because each question asks what the
 * trigger recorded — not how to make it record it.
 *
 * Net effect on `tasks`: 7 seeded + 1 inserted − 1 deleted = 7 rows. Holding that arithmetic in one
 * place matters: three questions depend on it, and they must not disagree.
 */
const AUDIT_SETUP = `CREATE FUNCTION audit() RETURNS trigger AS $$
  BEGIN
    INSERT INTO audit_log(table_name, op, row_id) VALUES (TG_TABLE_NAME, TG_OP, COALESCE(NEW.id, OLD.id));
    RETURN NEW;
  END $$ LANGUAGE plpgsql;
  CREATE TRIGGER t AFTER INSERT OR UPDATE OR DELETE ON tasks FOR EACH ROW EXECUTE FUNCTION audit();
  INSERT INTO tasks (org_id, project_id, title, status) VALUES (1, 1, 'Trigger probe', 'todo');
  UPDATE tasks SET status = 'done' WHERE id = 3;
  DELETE FROM tasks WHERE id = 4;`;

const triggers: ExamQuestion[] = [
  q({
    id: 'trig-1',
    topicSlug: 'triggers',
    difficulty: 'easy',
    prompt: 'How many audit rows are written by this sequence of three statements?',
    stimulus: {
      kind: 'sql',
      caption: 'One INSERT, one UPDATE, one DELETE — each fires the audit trigger once',
      lines: [
        "INSERT INTO tasks (org_id, project_id, title, status) VALUES (1, 1, 'A', 'todo')",
        "UPDATE tasks SET status = 'done' WHERE id = 3",
        'DELETE FROM tasks WHERE id = 4',
      ],
    },
    setupSql: AUDIT_SETUP,
    persona: PERSONAS.owner,
    checks: [{ firstCell: '3' }],
    answerSql: 'SELECT count(*) FROM audit_log',
    explanation: 'The trigger fires once per row-changing statement. Three statements → three audit rows: one INSERT, one UPDATE, one DELETE.',
    points: 10,
  }),

  q({
    id: 'trig-2',
    topicSlug: 'triggers',
    difficulty: 'medium',
    prompt: 'What does the audit_log record for each operation?',
    stimulus: {
      kind: 'sql',
      caption: 'The same three writes as the previous question — now inspect the op column',
      lines: [
        "INSERT INTO tasks (org_id, project_id, title, status) VALUES (1, 1, 'A', 'todo')",
        "UPDATE tasks SET status = 'done' WHERE id = 3",
        'DELETE FROM tasks WHERE id = 4',
      ],
    },
    setupSql: AUDIT_SETUP,
    persona: PERSONAS.owner,
    checks: [{ rows: 3, columns: ['op'] }],
    answerSql: 'SELECT op FROM audit_log ORDER BY id',
    explanation: 'TG_OP is a trigger special variable that holds the statement type. The audit rows record INSERT, UPDATE and DELETE in the order they ran.',
    points: 15,
  }),

  q({
    id: 'trig-3',
    topicSlug: 'triggers',
    difficulty: 'medium',
    prompt: 'After the three audited writes, how many rows are in the tasks table?',
    stimulus: {
      kind: 'sql',
      caption: 'Task 3 was already "done", so the UPDATE changes no status counts',
      lines: [
        "INSERT INTO tasks (org_id, project_id, title, status) VALUES (1, 1, 'Trigger probe', 'todo')",
        "UPDATE tasks SET status = 'done' WHERE id = 3",
        'DELETE FROM tasks WHERE id = 4',
      ],
    },
    setupSql: AUDIT_SETUP,
    persona: PERSONAS.owner,
    checks: [{ firstCell: '7' }],
    answerSql: 'SELECT count(*) FROM tasks',
    explanation:
      'Still 7 — but not because nothing happened. One row was inserted and one was deleted, so the two cancel: 7 + 1 − 1 = 7. The UPDATE moves task 3 to a status it already had, which is why the count is undisturbed. A trigger question that only ever asks about the audit table teaches the trigger; this one also checks that the writes were actually read.',
    points: 15,
  }),

  q({
    id: 'trig-4',
    topicSlug: 'triggers',
    difficulty: 'hard',
    prompt: 'How many status values have more than two tasks, without using HAVING?',
    stimulus: {
      kind: 'sql',
      caption: 'A window function counts rows per group and filters in the outer query',
      lines: [
        'SELECT status',
        'FROM (SELECT status, count(*) OVER (PARTITION BY status) AS cnt FROM tasks) x',
        'WHERE cnt > 2',
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: 'todo' }],
    answerSql: `SELECT status\nFROM (SELECT status, count(*) OVER (PARTITION BY status) AS cnt FROM tasks) x\nWHERE cnt > 2`,
    explanation: '"todo" appears 4 times, which is more than 2. The window function counts without collapsing rows, so the outer query can filter on the count.',
    points: 25,
  }),
];

// ── Roles & Privileges ───────────────────────────────────────────────────────

const roles: ExamQuestion[] = [
  q({
    id: 'role-1',
    topicSlug: 'roles-and-privileges',
    difficulty: 'easy',
    prompt: 'How many tables does the seed create in the lab schema?',
    stimulus: {
      kind: 'sql',
      caption: 'pg_tables lists every table in a schema, including those created by the seed',
      lines: ["SELECT * FROM pg_tables WHERE schemaname = 'lab'"],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '5' }],
    answerSql: "SELECT count(*) FROM pg_tables WHERE schemaname = 'lab'",
    explanation: 'Five tables: organizations, members, projects, tasks, audit_log.',
    points: 10,
  }),

  q({
    id: 'role-2',
    topicSlug: 'roles-and-privileges',
    difficulty: 'easy',
    prompt: 'How many indexes exist in the lab schema?',
    stimulus: {
      kind: 'table',
      caption: 'Every PRIMARY KEY and UNIQUE constraint creates an index automatically',
      columns: ['indexname'],
      rows: [
        ['organizations_pkey'], ['members_pkey'], ['members_email_key'],
        ['projects_pkey'], ['tasks_pkey'], ['audit_log_pkey'],
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '6' }],
    answerSql: "SELECT count(*) FROM pg_indexes WHERE schemaname = 'lab'",
    explanation: 'Six indexes: one for each primary key (5 tables = 5 pkey indexes) plus the unique constraint on members.email.',
    points: 10,
  }),

  q({
    id: 'role-3',
    topicSlug: 'roles-and-privileges',
    difficulty: 'medium',
    prompt: 'Can app_member UPDATE rows in the members table?',
    stimulus: {
      kind: 'sql',
      caption: 'has_table_privilege returns true or false without executing the statement',
      lines: ["SELECT has_table_privilege('app_member', 'lab.members', 'UPDATE')"],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: 'true' }],
    answerSql: "SELECT has_table_privilege('app_member', 'lab.members', 'UPDATE')",
    explanation: 'The seed grants SELECT, INSERT, UPDATE, DELETE on all lab tables to app_member. UPDATE is permitted.',
    points: 15,
  }),

  q({
    id: 'role-4',
    topicSlug: 'roles-and-privileges',
    difficulty: 'medium',
    prompt: 'Can app_anon INSERT into the organizations table?',
    stimulus: {
      kind: 'sql',
      caption: 'The seed grants SELECT on organizations to app_anon, but nothing else',
      lines: ["SELECT has_table_privilege('app_anon', 'lab.organizations', 'INSERT')"],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: 'false' }],
    answerSql: "SELECT has_table_privilege('app_anon', 'lab.organizations', 'INSERT')",
    explanation: 'app_anon has SELECT but not INSERT on organizations. INSERT returns false.',
    points: 15,
  }),

  q({
    id: 'role-5',
    topicSlug: 'roles-and-privileges',
    difficulty: 'hard',
    prompt: 'On how many sequences does app_member have USAGE privilege?',
    stimulus: {
      kind: 'sql',
      caption: 'The seed grants USAGE on ALL SEQUENCES IN SCHEMA lab to app_member',
      lines: [
        'SELECT count(*)',
        "FROM information_schema.usage_privileges",
        "WHERE grantee = 'app_member'",
        "AND privilege_type = 'USAGE'",
        "AND object_type = 'SEQUENCE'",
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '2' }],
    answerSql: `SELECT count(*)\nFROM information_schema.usage_privileges\nWHERE grantee = 'app_member'\nAND privilege_type = 'USAGE'\nAND object_type = 'SEQUENCE'`,
    explanation: 'Two sequences: tasks_id_seq and audit_log_id_seq. Both back the auto-incrementing primary keys of those two tables.',
    points: 25,
  }),
];

// ── Functions & Procedures ────────────────────────────────────────────────────

const funcs: ExamQuestion[] = [
  q({
    id: 'func-1',
    topicSlug: 'functions-and-procedures',
    difficulty: 'easy',
    prompt: 'What does current_member_id() return for Alice?',
    stimulus: {
      kind: 'sql',
      caption: 'The session has SET app.member_id = 1 for Alice',
      lines: ['SELECT current_member_id()'],
    },
    setupSql: '',
    persona: PERSONAS.alice,
    checks: [{ firstCell: '1' }],
    answerSql: 'SELECT current_member_id()',
    explanation: 'Alice has member_id 1, set by the session. current_member_id() reads app.member_id and returns it as an integer.',
    points: 10,
  }),

  q({
    id: 'func-2',
    topicSlug: 'functions-and-procedures',
    difficulty: 'easy',
    prompt: 'What does current_org_id() return for Bob?',
    stimulus: {
      kind: 'sql',
      caption: 'Bob belongs to Acme Rockets (org 1)',
      lines: ['SELECT current_org_id()'],
    },
    setupSql: '',
    persona: PERSONAS.bob,
    checks: [{ firstCell: '1' }],
    answerSql: 'SELECT current_org_id()',
    explanation: 'Bob is member_id 2 in org_id 1. The session sets app.org_id, and current_org_id() returns it.',
    points: 10,
  }),

  q({
    id: 'func-3',
    topicSlug: 'functions-and-procedures',
    difficulty: 'medium',
    prompt: 'What does current_org_id() return for the anonymous user?',
    stimulus: {
      kind: 'sql',
      caption: 'The anonymous role has no member or org context',
      lines: ['SELECT current_org_id()'],
    },
    setupSql: '',
    persona: PERSONAS.anon,
    // The grader compares scalars as text and renders SQL NULL as the empty string — `text()` in
    // `check.mjs`. So an empty `firstCell` here means "the cell is NULL", not "the cell is ''".
    // Both readings collapse to one under text comparison, and the control answer (42) still fails.
    checks: [{ firstCell: '' }],
    answerSql: 'SELECT current_org_id()',
    explanation: 'app_anon has no member_id set. nullif(..., true) returns NULL for an empty string, which is what current_org_id() produces for app_anon.',
    points: 15,
  }),

  q({
    id: 'func-4',
    topicSlug: 'functions-and-procedures',
    difficulty: 'medium',
    prompt: 'What are the two SQL-language functions in the lab schema?',
    stimulus: {
      kind: 'sql',
      caption: 'pg_proc holds one row per function; JOIN with pg_namespace filters by schema',
      lines: [
        "SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace",
        "WHERE nspname = 'lab' ORDER BY proname",
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ rows: 2, columns: ['proname'] }],
    answerSql: `SELECT proname\nFROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace\nWHERE nspname = 'lab' ORDER BY proname`,
    explanation: 'Two functions: current_member_id() and current_org_id(). Both are LANGUAGE sql STABLE functions that read session settings.',
    points: 15,
  }),

  q({
    id: 'func-5',
    topicSlug: 'functions-and-procedures',
    difficulty: 'hard',
    prompt: 'What is the volatility classification of current_org_id()?',
    stimulus: {
      kind: 'sql',
      caption: 'provolatile: s = STABLE, v = VOLATILE, i = IMMUTABLE',
      lines: ["SELECT provolatile FROM pg_proc WHERE proname = 'current_org_id'"],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: 's' }],
    answerSql: "SELECT provolatile FROM pg_proc WHERE proname = 'current_org_id'",
    explanation: 'STABLE means the function returns the same result for the same inputs within a transaction. current_org_id() reads session settings, not table data, so it is STABLE (provolatile = s).',
    points: 25,
  }),
];

// ── Production & Security ─────────────────────────────────────────────────────

const security: ExamQuestion[] = [
  q({
    id: 'sec-1',
    topicSlug: 'production-security',
    difficulty: 'easy',
    prompt: 'How many rows does the tasks table have?',
    stimulus: {
      kind: 'table',
      caption: 'The primary key index is tasks_pkey',
      columns: ['pkey', 'rows'],
      rows: [['tasks_pkey', '7']],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '7' }],
    answerSql: 'SELECT count(*) FROM tasks',
    explanation: 'Seven tasks in the seed: four todo, two doing, one done.',
    points: 10,
  }),

  q({
    id: 'sec-2',
    topicSlug: 'production-security',
    difficulty: 'easy',
    prompt: 'How many members belong to the "pro" plan organization?',
    stimulus: {
      kind: 'sql',
      caption: 'Acme Rockets has plan = pro',
      lines: [
        'SELECT count(*)',
        'FROM members m',
        'JOIN organizations o ON o.id = m.org_id',
        "WHERE o.plan = 'pro'",
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '2' }],
    answerSql: `SELECT count(*)\nFROM members m\nJOIN organizations o ON o.id = m.org_id\nWHERE o.plan = 'pro'`,
    explanation: 'Acme Rockets (plan = pro) has two members: Alice and Bob. Globex Labs has two members: Carol and Dan.',
    points: 10,
  }),

  q({
    id: 'sec-3',
    topicSlug: 'production-security',
    difficulty: 'medium',
    prompt: 'What is the storage strategy for the tasks title column?',
    stimulus: {
      kind: 'sql',
      caption: 'attstorage: p = plain, x = extended, e = external, m = main',
      lines: [
        "SELECT attstorage",
        'FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid',
        "WHERE c.relname = 'tasks' AND attname = 'title'",
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: 'x' }],
    answerSql: `SELECT attstorage\nFROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid\nWHERE c.relname = 'tasks' AND attname = 'title'`,
    explanation: 'x = extended. Extended storage compresses short values in-row and moves longer ones to the TOAST table. TEXT columns use extended storage by default.',
    points: 15,
  }),

  q({
    id: 'sec-4',
    topicSlug: 'production-security',
    difficulty: 'medium',
    prompt: 'How many owner-role members are there?',
    stimulus: {
      kind: 'sql',
      caption: 'The members table has a role column: owner or member',
      lines: ["SELECT count(*) FROM members WHERE role = 'owner'"],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '2' }],
    answerSql: "SELECT count(*) FROM members WHERE role = 'owner'",
    explanation: 'Two members have role = owner: Alice (Acme Rockets) and Carol (Globex Labs).',
    points: 15,
  }),

  q({
    id: 'sec-5',
    topicSlug: 'production-security',
    difficulty: 'hard',
    prompt: 'What is the combined budget of "pro" plan organizations\' projects?',
    stimulus: {
      kind: 'sql',
      caption: 'Only Acme Rockets (id 1) has plan = pro. It owns Moon Rocket and Website.',
      lines: [
        'SELECT sum(p.budget)',
        'FROM projects p',
        'JOIN organizations o ON o.id = p.org_id',
        "WHERE o.plan = 'pro'",
      ],
    },
    setupSql: '',
    persona: PERSONAS.owner,
    checks: [{ firstCell: '54000.00' }],
    answerSql: `SELECT sum(p.budget)\nFROM projects p\nJOIN organizations o ON o.id = p.org_id\nWHERE o.plan = 'pro'`,
    explanation: 'Acme Rockets (plan = pro): Moon Rocket (50000) + Website (4000) = 54000. Globex Labs (plan = free) owns Mobile App (12000) which is excluded.',
    points: 25,
  }),
];

// ── Bank ──────────────────────────────────────────────────────────────────────

/**
 * Each topic's hand-written questions, listed once. `EXAM_BANK` used to spread the seven arrays by
 * hand while `BANK_BY_SLUG` listed them again by hand — two lists to keep in step, and a topic left
 * out of the second one is invisible: it simply never appears in a topic-scoped exam.
 */
const HAND_BY_SLUG: Record<string, ExamQuestion[]> = {
  'transactions-mvcc': mvcc,
  'indexes': indexes,
  'row-level-security': rls,
  'triggers': triggers,
  'roles-and-privileges': roles,
  'functions-and-procedures': funcs,
  'production-security': security,
};

/**
 * Hand-written answers first, then the generated ones under the same slug. A generated item whose
 * `topicSlug` names a topic not listed here is dropped rather than silently widening the exam's
 * scope — the generator owns this file's topic list, not the other way round.
 */
export const BANK_BY_SLUG: Record<string, ExamQuestion[]> = Object.fromEntries(
  Object.entries(HAND_BY_SLUG).map(([slug, hand]) => [slug, [...hand, ...(GENERATED_BY_SLUG[slug] ?? [])]]),
);

export const EXAM_BANK: ExamQuestion[] = Object.values(BANK_BY_SLUG).flat();

export const QUESTION_COUNT = EXAM_BANK.length;
