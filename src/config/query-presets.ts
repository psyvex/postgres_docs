import type { LabId } from '@/lib/lab-config';

export const queryPresets: Record<LabId, { label: string; sql: string; purpose: string }[]> = {
  rls: [
    { label: 'Read orders', sql: 'SELECT * FROM orders;', purpose: 'See tenant filtering.' },
    { label: 'Read with tenant', sql: "SELECT * FROM orders WHERE tenant_id = 'a1';", purpose: 'Compare application filtering with database policy.' },
  ],
  roles: [
    { label: 'Grant SELECT', sql: 'GRANT SELECT ON orders TO app_user;', purpose: 'Change a role privilege.' },
    { label: 'Grant UPDATE', sql: 'GRANT UPDATE ON orders TO app_user;', purpose: 'Add a mutation privilege.' },
  ],
  functions: [
    { label: 'Calculate total', sql: 'SELECT calculate_order_total($1);', purpose: 'Call a database function.' },
  ],
  triggers: [
    { label: 'Mark paid', sql: "UPDATE orders SET status = 'paid' WHERE id = '101';", purpose: 'Fire the audit trigger.' },
  ],
};
