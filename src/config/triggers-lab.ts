export const triggerEvents = ['INSERT', 'UPDATE', 'DELETE'] as const;
export const triggerTimings = ['BEFORE', 'AFTER', 'INSTEAD OF'] as const;
export const triggerLevels = ['ROW', 'STATEMENT'] as const;

export const triggerLabCopy = {
  title: 'Triggers & automation lab',
  create: 'Create trigger',
  preview: 'SQL Preview',
  function: 'Trigger function',
  event: 'Event',
  timing: 'Timing',
  level: 'Level',
} as const;
