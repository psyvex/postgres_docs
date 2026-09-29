export const sqlPlaygroundModes = [
  { id: 'select', label: 'SELECT' },
  { id: 'explain', label: 'EXPLAIN' },
] as const;

export const sqlPlaygroundCopy = {
  title: 'SQL playground',
  execute: 'Execute query',
  clear: 'Clear',
  result: 'Query result',
  duration: 'Execution time',
  rows: 'Rows',
  safeMode: 'Read-only mode',
} as const;

export const sqlPlaygroundDefaults = {
  query: 'SELECT * FROM public.orders LIMIT 10;',
} as const;
