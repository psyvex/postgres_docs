import type { LabId } from '@/lib/lab-config';

export const lessons: Record<LabId, { goal: string; concepts: string[]; talkingPoints: string[] }> = {
  rls: { goal: 'Understand how PostgreSQL can enforce row visibility inside the database.', concepts: ['ENABLE ROW LEVEL SECURITY', 'CREATE POLICY', 'USING expression', 'session context'], talkingPoints: ['Privileges answer what a role can do.', 'Policies answer which rows the operation may touch.', 'The application should not be trusted to enforce tenant isolation alone.'] },
  roles: { goal: 'Understand the permission layer that sits underneath row policies.', concepts: ['roles', 'GRANT', 'REVOKE', 'table privileges'], talkingPoints: ['Start with least privilege.', 'Table privileges and RLS solve different authorization dimensions.', 'Test the effective permission, not just the intended configuration.'] },
  functions: { goal: 'Understand when reusable logic belongs close to the data.', concepts: ['CREATE FUNCTION', 'parameters', 'returns', 'execution context'], talkingPoints: ['Keep business-critical data rules close to the data when appropriate.', 'Make inputs and outputs explicit.', 'Review execution context carefully for security-sensitive functions.'] },
  triggers: { goal: 'Understand automatic database reactions to data changes.', concepts: ['CREATE TRIGGER', 'BEFORE / AFTER', 'trigger function', 'audit'], talkingPoints: ['A trigger reacts to a database event.', 'Keep trigger behavior predictable and observable.', 'Audit trails are a common practical use case.'] },
};
