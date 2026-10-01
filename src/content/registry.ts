/**
 * Single source of truth for learning content. To add a topic:
 *   1. add an entry here (status 'ready'),
 *   2. create src/content/topics/<slug>.mdx,
 *   3. register the import in src/content/load.ts.
 * See docs/CONTENT-GUIDE.md.
 */
import type { IconName } from '@/components/icons';

export type Reference = { title: string; url: string };

export type Topic = {
  slug: string;
  title: string;
  icon: IconName;
  tagline: string;
  track: 'Security' | 'Programming' | 'Foundations' | 'Performance' | 'Operations' | 'Integrations';
  status: 'ready' | 'planned' | 'break';
  /** Minutes to read + try the examples. */
  minutes?: number;
  references?: Reference[];
  /** Number of graded challenge blocks. Used by break-it lesson headers. */
  challengeCount?: number;
};

const PG_DOCS = 'https://www.postgresql.org/docs/current';

export const topics: Topic[] = [
  {
    slug: 'row-level-security',
    title: 'Row-Level Security',
    icon: 'rls',
    tagline: 'Let the database decide which rows each user can see and change.',
    track: 'Security',
    status: 'ready',
    minutes: 25,
    references: [
      { title: 'Row Security Policies (ddl-rowsecurity)', url: `${PG_DOCS}/ddl-rowsecurity.html` },
      { title: 'CREATE POLICY', url: `${PG_DOCS}/sql-createpolicy.html` },
      { title: 'ALTER TABLE … ENABLE / FORCE ROW LEVEL SECURITY', url: `${PG_DOCS}/sql-altertable.html` },
      { title: 'row_security configuration parameter', url: `${PG_DOCS}/runtime-config-client.html#GUC-ROW-SECURITY` },
      { title: 'current_setting / set_config', url: `${PG_DOCS}/functions-admin.html#FUNCTIONS-ADMIN-SET` },
    ],
  },
  {
    slug: 'roles-and-privileges',
    title: 'Roles & Privileges',
    icon: 'roles',
    tagline: 'Who can connect, and what each role may touch — least privilege by design.',
    track: 'Security',
    status: 'ready',
    minutes: 20,
    references: [
      { title: 'Database Roles', url: `${PG_DOCS}/user-manag.html` },
      { title: 'Privileges', url: `${PG_DOCS}/ddl-priv.html` },
      { title: 'GRANT', url: `${PG_DOCS}/sql-grant.html` },
      { title: 'ALTER DEFAULT PRIVILEGES', url: `${PG_DOCS}/sql-alterdefaultprivileges.html` },
      { title: 'Predefined Roles', url: `${PG_DOCS}/predefined-roles.html` },
      { title: 'Schemas & the public schema', url: `${PG_DOCS}/ddl-schemas.html#DDL-SCHEMAS-PATTERNS` },
    ],
  },
  {
    slug: 'functions-and-procedures',
    title: 'Functions & Procedures',
    icon: 'functions',
    tagline: 'Move logic next to the data: SQL & PL/pgSQL functions, procedures, SECURITY DEFINER.',
    track: 'Programming',
    status: 'ready',
    minutes: 25,
    references: [
      { title: 'CREATE FUNCTION', url: `${PG_DOCS}/sql-createfunction.html` },
      { title: 'CREATE PROCEDURE', url: `${PG_DOCS}/sql-createprocedure.html` },
      { title: 'PL/pgSQL', url: `${PG_DOCS}/plpgsql.html` },
      { title: 'Function volatility categories', url: `${PG_DOCS}/xfunc-volatility.html` },
      { title: 'Writing SECURITY DEFINER functions safely', url: `${PG_DOCS}/sql-createfunction.html#SQL-CREATEFUNCTION-SECURITY` },
      { title: 'Transaction management in procedures', url: `${PG_DOCS}/plpgsql-transactions.html` },
    ],
  },
  {
    slug: 'triggers',
    title: 'Triggers & Automation',
    icon: 'triggers',
    tagline: 'Run code automatically on INSERT, UPDATE, DELETE — audit logs, validation, derived data.',
    track: 'Programming',
    status: 'ready',
    minutes: 20,
    references: [
      { title: 'Triggers overview', url: `${PG_DOCS}/triggers.html` },
      { title: 'CREATE TRIGGER', url: `${PG_DOCS}/sql-createtrigger.html` },
      { title: 'PL/pgSQL trigger functions', url: `${PG_DOCS}/plpgsql-trigger.html` },
      { title: 'Event triggers', url: `${PG_DOCS}/event-triggers.html` },
    ],
  },
  {
    slug: 'production-security',
    title: 'Security in Production',
    icon: 'production',
    tagline: 'Putting it together: connection roles, injection, secrets, auditing and a go-live checklist.',
    track: 'Security',
    status: 'ready',
    minutes: 20,
    references: [
      { title: 'Client authentication (pg_hba.conf)', url: `${PG_DOCS}/client-authentication.html` },
      { title: 'SCRAM / password authentication', url: `${PG_DOCS}/auth-password.html` },
      { title: 'SSL/TLS support', url: `${PG_DOCS}/ssl-tcp.html` },
      { title: 'Secure schema usage patterns', url: `${PG_DOCS}/ddl-schemas.html#DDL-SCHEMAS-PATTERNS` },
      { title: 'PostgreSQL security information & CVEs', url: 'https://www.postgresql.org/support/security/' },
      { title: 'OWASP SQL Injection Prevention Cheat Sheet', url: 'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html' },
    ],
  },
  {
    slug: 'indexes',
    title: 'Indexes & EXPLAIN',
    icon: 'indexes',
    tagline: 'B-tree, GIN, BRIN and reading query plans.',
    track: 'Performance',
    status: 'ready',
    minutes: 16,
    references: [
      { title: 'Indexes (ddl-indexes)', url: `${PG_DOCS}/ddl-indexes.html` },
      { title: 'Using Indexes (queries-indexes)', url: `${PG_DOCS}/queries-indexes.html` },
      { title: 'EXPLAIN', url: `${PG_DOCS}/sql-explain.html` },
      { title: 'Index Types (indexes-types)', url: `${PG_DOCS}/indexes-types.html` },
      { title: 'CREATE INDEX', url: `${PG_DOCS}/sql-createindex.html` },
      { title: 'pg_trgm (full-text over arbitrary text)', url: `${PG_DOCS}/pgtrgm.html` },
    ],
  },
  {
    slug: 'break-rls',
    title: 'Break RLS',
    icon: 'skull',
    tagline: 'You are Bob. Make it so Bob cannot read Alice\'s rows.',
    track: 'Security',
    status: 'break',
    minutes: 15,
    challengeCount: 8,
  },
  // Roadmap, shown on the home page so the lab grows into a full Postgres handbook.
  {
    slug: 'transactions-mvcc',
    title: 'Transactions & MVCC',
    icon: 'mvcc',
    tagline: 'Isolation levels, locks and how Postgres keeps versions.',
    track: 'Foundations',
    status: 'ready',
    minutes: 22,
    references: [
      { title: 'Concurrency Control (mvcc)', url: `${PG_DOCS}/mvcc.html` },
      { title: 'Transaction Isolation', url: `${PG_DOCS}/transaction-iso.html` },
      { title: 'Vacuum (routine vacuuming)', url: `${PG_DOCS}/routine-vacuuming.html` },
      { title: 'Explicit Locking (SELECT … FOR UPDATE)', url: `${PG_DOCS}/explicit-locks.html` },
      { title: 'Savepoints', url: `${PG_DOCS}/tutorial-transaction.html#RUNNING-TRANSACTIONS` },
      { title: 'pg_stat_user_tables', url: `${PG_DOCS}/monitoring-stats.html#MONITORING-STATS-VIEWS` },
    ],
  },
  {
    slug: 'jsonb',
    title: 'JSONB',
    icon: 'jsonb',
    tagline: 'Documents inside a relational database.',
    track: 'Foundations',
    status: 'ready',
    minutes: 20,
    references: [
      { title: 'JSON Data Types', url: `${PG_DOCS}/datatype-json.html` },
      { title: 'JSON Functions and Operators', url: `${PG_DOCS}/functions-json.html` },
      { title: 'GIN Indexes (jsonb_ops / jsonb_path_ops)', url: `${PG_DOCS}/indexes-types.html#INDEXES-TYPES-GIN` },
      { title: 'Full Text Search (tsvector + GIN pattern)', url: `${PG_DOCS}/textsearch-intro.html` },
      { title: 'SQL/JSON Query Functions', url: `${PG_DOCS}/functions-json.html#FUNCTIONS-SQLJSON-QUERY-INTRO` },
    ],
  },
  {
    slug: 'partitioning',
    title: 'Partitioning',
    icon: 'partitioning',
    tagline: 'Splitting huge tables by range, list or hash.',
    track: 'Performance',
    status: 'ready',
    minutes: 18,
    references: [
      { title: 'Declarative Partitioning', url: `${PG_DOCS}/ddl-partitioning.html` },
      { title: 'Partition Management (ATTACH / DETACH)', url: `${PG_DOCS}/ddl-partitioning.html#DDL-PARTITION-MANAGEMENT` },
      { title: 'Partition Pruning', url: `${PG_DOCS}/ddl-partitioning.html#DDL-PARTITION-PRUNING` },
      { title: 'Partition and Query Performance', url: `${PG_DOCS}/ddl-partitioning.html#DDL-PARTITION-PERFORMANCE` },
      { title: 'Hash and List partitioning examples', url: `${PG_DOCS}/ddl-partitioning.html#DDL-PARTITIONING-EXAMPLES-HASH` },
    ],
  },
  {
    slug: 'backup-replication',
    title: 'Backups & Replication',
    icon: 'backups',
    tagline: 'WAL, base backups, PITR, streaming replication, and logical pub/sub.',
    track: 'Operations',
    status: 'ready',
    minutes: 18,
    references: [
      { title: 'Continuous Archiving and Point-in-Time Recovery', url: `${PG_DOCS}/continuous-archiving.html` },
      { title: 'pg_dump / pg_restore reference', url: `${PG_DOCS}/app-pgdump.html` },
      { title: 'Logical Replication', url: `${PG_DOCS}/logical-replication.html` },
      { title: 'High Availability, Load Balancing, and Replication', url: `${PG_DOCS}/high-availability.html` },
      { title: 'Backup and Restore (dump/restore discussion)', url: `${PG_DOCS}/backup-dump.html` },
    ],
  },
  // ─── Integrations ────────────────────────────────────────────────────────────
  // T6 lessons: real project code + live SQL — see docs/TASKS.md T6 tier.
  {
    slug: 'nestjs-rls',
    title: 'NestJS + RLS',
    icon: 'codeTree',
    tagline: 'Attach RLS policies to a NestJS app with a per-request connection middleware.',
    track: 'Integrations',
    status: 'ready',
    minutes: 20,
    references: [
      { title: 'NestJS DataSource / TypeORM', url: 'https://docs.nestjs.com/techniques/database' },
      { title: 'Middleware in NestJS', url: 'https://docs.nestjs.com/middleware' },
      { title: 'Pg RLS + Node.js (blog)', url: 'https://neon.tech/postgresql/learn/postgresql-getting-started/fundamentals/postgresql-row-level-security-nodejs' },
    ],
  },
  {
    slug: 'fastapi-rls',
    title: 'FastAPI + RLS',
    icon: 'codeTree',
    tagline: 'Set per-request identity with psycopg2 and a FastAPI dependency.',
    track: 'Integrations',
    status: 'planned',
    minutes: 20,
  },
  {
    slug: 'nextjs-rls',
    title: 'Next.js + RLS',
    icon: 'codeTree',
    tagline: 'Middleware, server actions and API routes — all three layers with RLS.',
    track: 'Integrations',
    status: 'planned',
    minutes: 20,
  },
  {
    slug: 'real-indexes',
    title: 'Indexes in Practice',
    icon: 'codeTree',
    tagline: 'Adding composite, partial and expression indexes to a real app schema.',
    track: 'Integrations',
    status: 'planned',
    minutes: 20,
  },
  {
    slug: 'real-transactions',
    title: 'Transactions in Practice',
    icon: 'codeTree',
    tagline: 'Serializable isolation, advisory locks and retry loops in NestJS.',
    track: 'Integrations',
    status: 'planned',
    minutes: 20,
  },
  {
    slug: 'live-database',
    title: 'Connect Your Database',
    icon: 'codeTree',
    tagline: 'Wire the playground to your own Postgres instance and run any lesson live.',
    track: 'Integrations',
    status: 'planned',
    minutes: 5,
  },
];

export const readyTopics = topics.filter((t) => t.status === 'ready' || t.status === 'break');
export const getTopic = (slug: string) =>
  topics.find((t) => t.slug === slug && (t.status === 'ready' || t.status === 'break'));

/** Tracks in the order the curriculum teaches them. */
export const TRACK_ORDER: Topic['track'][] = [
  'Security',
  'Programming',
  'Foundations',
  'Performance',
  'Operations',
  'Integrations',
];


/**
 * Every track in use, in curriculum order. A track missing from `TRACK_ORDER` is
 * appended rather than dropped, so adding one is a registry edit that cannot
 * silently hide its lessons from the sidebar — which is exactly what happened
 * when `Integrations` shipped without being listed anywhere outside this file.
 */
export function usedTracks(source: Topic[] = topics): Topic['track'][] {
  const rank = (track: Topic['track']) => {
    const i = TRACK_ORDER.indexOf(track);
    return i === -1 ? Infinity : i;
  };
  return Array.from(new Set(source.map((t) => t.track))).sort((a, b) => rank(a) - rank(b));
}
