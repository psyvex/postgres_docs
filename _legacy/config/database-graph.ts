export const databaseGraph = {
  nodes: [
    { id: 'orders', label: 'orders', type: 'table', x: 12, y: 48 },
    { id: 'tenants', label: 'tenants', type: 'table', x: 50, y: 20 },
    { id: 'function', label: 'write_audit_event()', type: 'function', x: 50, y: 76 },
    { id: 'audit', label: 'audit_log', type: 'table', x: 86, y: 76 },
  ],
  edges: [
    { from: 'orders', to: 'tenants', label: 'tenant_id → id' },
    { from: 'orders', to: 'function', label: 'AFTER UPDATE' },
    { from: 'function', to: 'audit', label: 'INSERT' },
  ],
  canvas: { width: 100, height: 100 },
} as const;
