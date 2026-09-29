export const rlsScenarioTabs = [
  { id: 'dataset', label: 'Scenario' },
  { id: 'evaluation', label: 'Evaluation' },
] as const;

export const rlsScenarioCopy = {
  title: 'RLS scenario lab',
  subtitle: 'Compare candidate rows with the rows PostgreSQL actually returns.',
  candidateRows: 'Candidate rows',
  returnedRows: 'Rows returned by PostgreSQL',
  filteredRows: 'Filtered rows',
  tenant: 'Tenant context',
  run: 'Run scenario',
} as const;
