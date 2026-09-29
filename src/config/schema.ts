export const schemaConfig = {
  database: 'postgres_demo',
  schema: 'public',
  tables: [
    {
      name: 'orders',
      columns: [
        { name: 'id', type: 'uuid', key: 'PK' },
        { name: 'tenant_id', type: 'uuid', key: 'FK' },
        { name: 'amount', type: 'numeric' },
        { name: 'status', type: 'text' },
      ],
      policies: [{ name: 'tenant_isolation', command: 'ALL', using: 'tenant_id = current_setting(\'app.tenant_id\')::uuid' }],
      triggers: [{ name: 'orders_audit', event: 'AFTER UPDATE', function: 'write_audit_event' }],
    },
    {
      name: 'audit_log',
      columns: [
        { name: 'id', type: 'uuid', key: 'PK' },
        { name: 'table_name', type: 'text' },
        { name: 'operation', type: 'text' },
        { name: 'created_at', type: 'timestamptz' },
      ],
      policies: [],
      triggers: [],
    },
  ],
  relationships: [{ from: 'orders.tenant_id', to: 'tenants.id', label: 'belongs to' }],
} as const;
