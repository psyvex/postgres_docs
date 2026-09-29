export const rlsVisualizerStates = {
  idle: { label: 'Ready', tone: 'neutral' },
  evaluating: { label: 'Evaluating policy', tone: 'active' },
  allowed: { label: 'Row visible', tone: 'success' },
  filtered: { label: 'Row filtered', tone: 'danger' },
  error: { label: 'Evaluation error', tone: 'danger' },
} as const;

export const rlsVisualizerSteps = [
  'Query received',
  'Role resolved',
  'Policy evaluated',
  'Rows returned',
] as const;
