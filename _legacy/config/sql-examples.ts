import type { LabId } from '@/lib/lab-config';

export const sqlExamples: Record<LabId, { label: string; sql: string; explanation: string }[]> = {
  rls: [
    { label: 'Read orders', sql: 'SELECT * FROM orders;', explanation: 'The active row policy determines which rows are visible.' },
    { label: 'Inspect policy', sql: "SELECT policyname, cmd FROM pg_policies WHERE tablename = 'orders';", explanation: 'Inspect policies defined for the table.' },
  ],
  roles: [
    { label: 'Grant SELECT', sql: 'GRANT SELECT ON orders TO app_user;', explanation: 'Table privileges answer whether a role may perform an operation.' },
    { label: 'Inspect grants', sql: "SELECT grantee, privilege_type FROM information_schema.role_table_grants WHERE table_name = 'orders';", explanation: 'Inspect table privileges granted to roles.' },
  ],
  functions: [
    { label: 'Call function', sql: 'SELECT calculate_order_total();', explanation: 'A function packages reusable database-side logic.' },
    { label: 'Inspect function', sql: "SELECT routine_name, routine_type FROM information_schema.routines WHERE routine_schema = 'public';", explanation: 'Inspect routines exposed by the schema.' },
  ],
  triggers: [
    { label: 'Update row', sql: "UPDATE orders SET status = 'paid' WHERE id = '101';", explanation: 'A row mutation can automatically invoke trigger logic.' },
    { label: 'Inspect triggers', sql: "SELECT trigger_name, event_manipulation FROM information_schema.triggers WHERE event_object_table = 'orders';", explanation: 'Inspect trigger definitions attached to the table.' },
  ],
};
