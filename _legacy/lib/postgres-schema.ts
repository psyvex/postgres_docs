export const schemaQueries = {
  tables: `select table_schema, table_name from information_schema.tables where table_type = 'BASE TABLE' and table_schema not in ('pg_catalog', 'information_schema') order by table_schema, table_name`,
  columns: `select table_schema, table_name, column_name, data_type, is_nullable, column_default, ordinal_position from information_schema.columns where table_schema = $1 and table_name = $2 order by ordinal_position`,
  indexes: `select indexname, indexdef from pg_indexes where schemaname = $1 and tablename = $2 order by indexname`,
  policies: `select policyname, permissive, roles, cmd, qual, with_check from pg_policies where schemaname = $1 and tablename = $2 order by policyname`,
  triggers: `select trigger_name, event_manipulation, action_timing, action_statement from information_schema.triggers where event_object_schema = $1 and event_object_table = $2 order by trigger_name`,
} as const;

export type DatabaseTable = { schema: string; name: string };
export type DatabaseColumn = { name: string; type: string; nullable: boolean; defaultValue: string | null; position: number };
export type DatabaseIndex = { name: string; definition: string };
export type DatabasePolicy = { name: string; permissive: string; roles: string[]; command: string; using: string | null; withCheck: string | null };
export type DatabaseTrigger = { name: string; event: string; timing: string; action: string };
