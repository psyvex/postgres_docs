export type ExecutionStage = 'idle' | 'parse' | 'authorize' | 'policy' | 'execute' | 'result';

export const executionMachine = {
  durations: { parse: 220, authorize: 260, policy: 360, execute: 300, result: 220 },
  labels: {
    idle: 'Ready', parse: 'Parsing SQL', authorize: 'Checking privileges', policy: 'Applying row policy', execute: 'Executing operation', result: 'Building result',
  },
  order: ['parse', 'authorize', 'policy', 'execute', 'result'] as ExecutionStage[],
} as const;
