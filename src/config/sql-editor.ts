export const sqlEditorCopy = {
  title: 'SQL Editor',
  database: 'postgres · public',
  run: 'Run query',
  stop: 'Stop',
  results: 'Results',
  messages: 'Messages',
  ready: 'Ready to execute',
  rows: 'rows',
  duration: 'duration',
  empty: 'Run a query to see results.',
} as const;

export const sqlEditorDefaults = {
  query: 'SELECT id, tenant_id, amount, status\nFROM public.orders\nORDER BY id DESC\nLIMIT 10;',
} as const;
