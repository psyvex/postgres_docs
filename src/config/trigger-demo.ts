export const triggerDemoCopy = {
  title: 'Live trigger demo',
  payload: 'Event payload',
  execute: 'Fire INSERT event',
  generatedSql: 'Generated SQL',
  result: 'Database result',
  audit: 'Audit trail',
  waiting: 'Ready to fire an event',
  connectionRequired: 'Configure a PostgreSQL connection before running the demo.',
} as const;

export const triggerDemoDefaults = {
  schema: 'public',
  table: 'orders',
  payload: { tenant_id: '', customer_id: '', amount: 250 },
} as const;

export const triggerDemoEvents = ['INSERT'] as const;
