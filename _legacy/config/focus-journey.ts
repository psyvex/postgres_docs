export type JourneyFocus = 'sql' | 'role' | 'rls' | 'rows' | 'function' | 'trigger' | 'result';

export const focusJourney: { id: JourneyFocus; label: string; description: string }[] = [
  { id: 'sql', label: 'SQL', description: 'Read the statement and identify the operation.' },
  { id: 'role', label: 'Role', description: 'Check the session role and privileges.' },
  { id: 'rls', label: 'RLS', description: 'Evaluate row visibility against policy.' },
  { id: 'rows', label: 'Rows', description: 'See which rows are visible or filtered.' },
  { id: 'function', label: 'Function', description: 'Enter the database function boundary.' },
  { id: 'trigger', label: 'Trigger', description: 'Follow the trigger event and OLD → NEW values.' },
  { id: 'result', label: 'Result', description: 'Reveal the final database result.' },
];
