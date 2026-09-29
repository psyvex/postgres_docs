export const triggerExecutionSteps = [
  { id: 'event', label: 'Database event' },
  { id: 'trigger', label: 'Trigger fires' },
  { id: 'function', label: 'Function executes' },
  { id: 'result', label: 'Transaction completes' },
] as const;

export const triggerExecutionCopy = {
  title: 'Trigger execution trace',
  run: 'Run event',
  running: 'Following database event',
  complete: 'Event complete',
  failed: 'Event failed',
} as const;
