export const databaseWorkspaceTabs = [
  { id: 'connection', label: 'Connection' },
  { id: 'schema', label: 'Schema Explorer' },
  { id: 'table', label: 'Table Builder' },
] as const;

export const databaseWorkspaceCopy = {
  title: 'Database workspace',
  liveBadge: 'Live PostgreSQL',
  disconnectedBadge: 'Not connected',
  refresh: 'Refresh schema',
} as const;
