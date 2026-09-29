export const sessionContent = {
  product: { name: 'PostgreSQL Security Lab', subtitle: 'Interactive developer session' },
  navigation: { labsLabel: 'Labs', playground: 'SQL Playground', presenter: 'Presenter Mode', reset: 'Reset lab', databaseStatus: 'Demo DB' },
  rls: {
    policyName: 'tenant_isolation',
    contextLabel: 'Session context',
    contextDescription: 'The active tenant becomes part of the database session context.',
    enabledLabel: 'Enabled',
    disabledLabel: 'Break RLS',
    enabledMessage: 'PostgreSQL applies the row policy before rows reach the application.',
    disabledMessage: 'RLS is disabled, so the query can see rows belonging to every tenant.',
  },
  workbench: { title: 'SQL workbench', execute: 'Run Query', executing: 'Executing…', reset: 'reset', resultTitle: 'Execution result', empty: 'Run a query to inspect the result.' },
  errors: { unknownQuery: "This teaching lab does not recognize that query yet. Try the example query for the selected lab.", emptyQuery: 'Query is empty.' },
} as const;

export const formatRows = (count: number) => `${count} row${count === 1 ? '' : 's'}`;
export const formatDuration = (ms: number) => `${ms} ms`;
