export const functionExecutionSteps = [
  { id: 'connect', label: 'Connect to PostgreSQL' },
  { id: 'create', label: 'Create or replace function' },
  { id: 'call', label: 'Call function' },
  { id: 'result', label: 'Build result' },
] as const;

export const functionExecutionCopy = {
  createAndCall: 'Create & call',
  executing: 'Executing function',
  complete: 'Function complete',
  failed: 'Function failed',
} as const;
