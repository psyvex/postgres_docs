export const rlsLabTabs = [
  { id: 'policy', label: 'Policy Builder' },
  { id: 'simulate', label: 'RLS Simulator' },
] as const;

export const rlsLabCopy = {
  title: 'Row-level security lab',
  simulate: 'Simulate query',
  result: 'Evaluation result',
  visible: 'Row visible',
  filtered: 'Row filtered',
  noPolicy: 'No matching policy result returned.',
} as const;
