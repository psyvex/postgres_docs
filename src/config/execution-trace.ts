export const executionTraceSteps = [
  { id: 'connect', label: 'Connect to PostgreSQL' },
  { id: 'validate', label: 'Validate query' },
  { id: 'execute', label: 'Execute query' },
  { id: 'result', label: 'Build result' },
] as const;

export const executionTraceCopy = {
  title: 'Execution trace',
  idle: 'Ready to execute',
  running: 'Executing query',
  complete: 'Query complete',
  failed: 'Execution failed',
} as const;
