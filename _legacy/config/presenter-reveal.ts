export type RevealId = 'sql' | 'role' | 'rls' | 'rows' | 'result';

export const presenterReveal = {
  steps: [
    { id: 'sql' as RevealId, label: 'SQL', description: 'Start with the statement and intent.' },
    { id: 'role' as RevealId, label: 'Role', description: 'Show which database privileges are checked.' },
    { id: 'rls' as RevealId, label: 'RLS', description: 'Reveal the row policy decision.' },
    { id: 'rows' as RevealId, label: 'Rows', description: 'Reveal rows that survive the policy.' },
    { id: 'result' as RevealId, label: 'Result', description: 'Reveal the final result and execution trace.' },
  ],
  transitionMs: 280,
} as const;
