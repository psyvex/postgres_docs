export type Permission = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE';

export const permissionMatrix = {
  roles: [
    { id: 'app_user', label: 'app_user', description: 'Application runtime role', permissions: { orders: ['SELECT', 'INSERT', 'UPDATE'] as Permission[] } },
    { id: 'reporting_user', label: 'reporting_user', description: 'Read-only reporting role', permissions: { orders: ['SELECT'] as Permission[] } },
    { id: 'admin_user', label: 'admin_user', description: 'Administrative teaching role', permissions: { orders: ['SELECT', 'INSERT', 'UPDATE', 'DELETE'] as Permission[] } },
  ],
  resources: ['orders', 'audit_log'],
} as const;
