import type { LabId } from '@/lib/lab-config';

export type QueryEvent = { stage: string; title: string; detail: string; tone: 'cyan' | 'green' | 'purple' | 'orange' | 'red' };

export const queryEvents: Record<LabId, QueryEvent[]> = {
  rls: [
    { stage: '01', title: 'Parse', detail: 'PostgreSQL parses the SELECT statement.', tone: 'cyan' },
    { stage: '02', title: 'Session context', detail: 'The active tenant context is available to the policy.', tone: 'purple' },
    { stage: '03', title: 'Apply policy', detail: 'The USING expression filters candidate rows.', tone: 'green' },
    { stage: '04', title: 'Return rows', detail: 'Only authorized rows reach the result.', tone: 'cyan' },
  ],
  roles: [
    { stage: '01', title: 'Identify role', detail: 'PostgreSQL evaluates the current database role.', tone: 'cyan' },
    { stage: '02', title: 'Check privilege', detail: 'Table privileges determine whether the operation is allowed.', tone: 'purple' },
    { stage: '03', title: 'Apply policy', detail: 'RLS can further restrict accessible rows.', tone: 'green' },
    { stage: '04', title: 'Execute', detail: 'The operation proceeds or is rejected.', tone: 'cyan' },
  ],
  functions: [
    { stage: '01', title: 'Call', detail: 'The SQL statement resolves a function.', tone: 'cyan' },
    { stage: '02', title: 'Execute', detail: 'PostgreSQL runs the function body.', tone: 'purple' },
    { stage: '03', title: 'Access data', detail: 'The function can read or change database state.', tone: 'green' },
    { stage: '04', title: 'Return', detail: 'The function result becomes query output.', tone: 'cyan' },
  ],
  triggers: [
    { stage: '01', title: 'Mutation', detail: 'An INSERT, UPDATE, or DELETE occurs.', tone: 'cyan' },
    { stage: '02', title: 'Trigger fires', detail: 'The configured event activates the trigger.', tone: 'orange' },
    { stage: '03', title: 'Function runs', detail: 'PostgreSQL invokes the trigger function.', tone: 'purple' },
    { stage: '04', title: 'Audit', detail: 'The resulting event is persisted.', tone: 'green' },
  ],
};
