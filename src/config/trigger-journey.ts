export const triggerJourney = {
  title: 'Trigger pipeline',
  steps: [
    { id: 'event', label: 'Event', description: 'An INSERT, UPDATE, or DELETE occurs.' },
    { id: 'timing', label: 'Timing', description: 'PostgreSQL checks BEFORE or AFTER timing.' },
    { id: 'row', label: 'Row image', description: 'OLD and NEW expose row state to the trigger function.' },
    { id: 'function', label: 'Function', description: 'The trigger function executes.' },
    { id: 'audit', label: 'Side effect', description: 'The function writes the audit record or other side effect.' },
  ],
  sample: { event: 'UPDATE orders', timing: 'AFTER', function: 'write_audit_event()', sideEffect: 'INSERT audit_log' },
} as const;
