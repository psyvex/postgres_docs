export const postgresTypes = ['uuid','text','integer','bigint','numeric','boolean','date','timestamp','timestamptz','jsonb'] as const;

export const tableBuilderDefaults = {
  schema: 'public',
  primaryKey: false,
  nullable: true,
} as const;

export const tableBuilderCopy = {
  title: 'Create PostgreSQL table',
  preview: 'SQL Preview',
  execute: 'Create Table',
  addColumn: 'Add column',
} as const;
