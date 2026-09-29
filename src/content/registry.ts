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
  track: 'Security' | 'Programming' | 'Foundations' | 'Performance' | 'Operations';
  status: 'ready' | 'planned';
  /** Minutes to read + try the examples. */
  minutes?: number;
  references?: Reference[];
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
  // Roadmap — shown on the home page so the lab grows into a full Postgres handbook.
  { slug: 'indexes', title: 'Indexes & EXPLAIN', icon: 'indexes', tagline: 'B-tree, GIN, BRIN and reading query plans.', track: 'Performance', status: 'planned' },
  { slug: 'transactions-mvcc', title: 'Transactions & MVCC', icon: 'mvcc', tagline: 'Isolation levels, locks and how Postgres keeps versions.', track: 'Foundations', status: 'planned' },
  { slug: 'jsonb', title: 'JSONB', icon: 'jsonb', tagline: 'Documents inside a relational database.', track: 'Foundations', status: 'planned' },
  { slug: 'partitioning', title: 'Partitioning', icon: 'partitioning', tagline: 'Splitting huge tables by range, list or hash.', track: 'Performance', status: 'planned' },
  { slug: 'backup-replication', title: 'Backups & Replication', icon: 'backups', tagline: 'pg_dump, PITR, streaming and logical replication.', track: 'Operations', status: 'planned' },
];

export const readyTopics = topics.filter((t) => t.status === 'ready');
export const getTopic = (slug: string) => topics.find((t) => t.slug === slug && t.status === 'ready');
