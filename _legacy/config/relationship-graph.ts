export const relationshipGraph = {
  nodes: [
    { id: 'orders', label: 'orders', type: 'table' },
    { id: 'tenants', label: 'tenants', type: 'table' },
    { id: 'audit_log', label: 'audit_log', type: 'table' },
    { id: 'write_audit_event', label: 'write_audit_event', type: 'function' },
  ],
  edges: [
    { from: 'orders', to: 'tenants', label: 'tenant_id → id' },
    { from: 'orders', to: 'write_audit_event', label: 'AFTER UPDATE' },
    { from: 'write_audit_event', to: 'audit_log', label: 'INSERT' },
  ],
} as const;
