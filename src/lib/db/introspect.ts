import { runSql } from './store';

export type ColumnInfo = { name: string; type: string; nullable: boolean; isPk: boolean };
export type TableInfo = {
  schema: string;
  name: string;
  rlsEnabled: boolean;
  rlsForced: boolean;
  estimatedRows: number;
  columns: ColumnInfo[];
  policies: { name: string; command: string; permissive: string; roles: string[]; using: string | null; check: string | null }[];
  triggers: { name: string; timing: string; events: string; fn: string }[];
};
export type FunctionInfo = { schema: string; name: string; args: string; returns: string; kind: string; security: 'definer' | 'invoker'; language: string };
export type RoleInfo = { name: string; login: boolean; superuser: boolean; bypassRls: boolean; memberOf: string[] };

const USER_SCHEMAS = `n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast') AND n.nspname NOT LIKE 'pg_temp%'`;

// One round-trip returning JSON keeps this fast over the live HTTP adapter.
const TABLES_SQL = `
SELECT coalesce(json_agg(t ORDER BY t.schema, t.name), '[]') AS data FROM (
  SELECT n.nspname AS schema, c.relname AS name, c.relrowsecurity AS "rlsEnabled", c.relforcerowsecurity AS "rlsForced",
    greatest(c.reltuples, 0)::bigint AS "estimatedRows",
    (SELECT coalesce(json_agg(json_build_object(
        'name', a.attname, 'type', format_type(a.atttypid, a.atttypmod), 'nullable', NOT a.attnotnull,
        'isPk', EXISTS (SELECT 1 FROM pg_index i WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY(i.indkey))
      ) ORDER BY a.attnum), '[]')
     FROM pg_attribute a WHERE a.attrelid = c.oid AND a.attnum > 0 AND NOT a.attisdropped) AS columns,
    (SELECT coalesce(json_agg(json_build_object(
        'name', p.policyname, 'command', p.cmd, 'permissive', p.permissive, 'roles', p.roles, 'using', p.qual, 'check', p.with_check)), '[]')
     FROM pg_policies p WHERE p.schemaname = n.nspname AND p.tablename = c.relname) AS policies,
    (SELECT coalesce(json_agg(json_build_object(
        'name', tg.tgname,
        'timing', CASE WHEN tg.tgtype & 2 = 2 THEN 'BEFORE' WHEN tg.tgtype & 64 = 64 THEN 'INSTEAD OF' ELSE 'AFTER' END,
        'events', concat_ws(' OR ',
          CASE WHEN tg.tgtype & 4 = 4 THEN 'INSERT' END, CASE WHEN tg.tgtype & 8 = 8 THEN 'DELETE' END,
          CASE WHEN tg.tgtype & 16 = 16 THEN 'UPDATE' END, CASE WHEN tg.tgtype & 32 = 32 THEN 'TRUNCATE' END),
        'fn', tg.tgfoid::regproc::text)), '[]')
     FROM pg_trigger tg WHERE tg.tgrelid = c.oid AND NOT tg.tgisinternal) AS triggers
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relkind IN ('r', 'p') AND ${USER_SCHEMAS}
) t`;

const FUNCTIONS_SQL = `
SELECT coalesce(json_agg(f ORDER BY f.schema, f.name), '[]') AS data FROM (
  SELECT n.nspname AS schema, p.proname AS name, pg_get_function_arguments(p.oid) AS args,
    CASE WHEN p.prokind = 'p' THEN 'void' ELSE pg_get_function_result(p.oid) END AS returns,
    CASE p.prokind WHEN 'p' THEN 'procedure' WHEN 'a' THEN 'aggregate' ELSE 'function' END AS kind,
    CASE WHEN p.prosecdef THEN 'definer' ELSE 'invoker' END AS security, l.lanname AS language
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace JOIN pg_language l ON l.oid = p.prolang
  WHERE ${USER_SCHEMAS}
) f`;

const ROLES_SQL = `
SELECT coalesce(json_agg(r ORDER BY r.name), '[]') AS data FROM (
  SELECT r.rolname AS name, r.rolcanlogin AS login, r.rolsuper AS superuser, r.rolbypassrls AS "bypassRls",
    coalesce((SELECT json_agg(g.rolname) FROM pg_auth_members m JOIN pg_roles g ON g.oid = m.roleid WHERE m.member = r.oid), '[]') AS "memberOf"
  FROM pg_roles r WHERE r.rolname NOT LIKE 'pg\\_%'
) r`;

async function fetchJson<T>(sql: string): Promise<T> {
  const result = await runSql(sql, { silent: true });
  if (!result.ok) throw new Error(result.error);
  const value = result.results.at(-1)?.rows[0]?.data;
  return (typeof value === 'string' ? JSON.parse(value) : value) as T;
}

export const loadTables = () => fetchJson<TableInfo[]>(TABLES_SQL);
export const loadFunctions = () => fetchJson<FunctionInfo[]>(FUNCTIONS_SQL);
export const loadRoles = () => fetchJson<RoleInfo[]>(ROLES_SQL);

export function quoteIdent(name: string) {
  return `"${name.replaceAll('"', '""')}"`;
}
