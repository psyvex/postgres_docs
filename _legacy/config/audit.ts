export const auditConfig = {
  table: 'audit_log',
  columns: ['id', 'table_name', 'operation', 'created_at'],
  events: [
    { id: 'evt-001', tableName: 'orders', operation: 'UPDATE', description: 'Order status changed' },
  ],
  statuses: { pending: 'Waiting for trigger', fired: 'Trigger fired', persisted: 'Audit row persisted' },
} as const;
